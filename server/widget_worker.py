import json, os, time, sys, re, logging
from datetime import date
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s [widget] %(levelname)s: %(message)s")
logger = logging.getLogger("widget-worker")

DATA_DIR = Path(os.getenv("DATA_DIR", "/home/opc/fullcount_backend/repo/data"))
sys.path.insert(0, str(Path(__file__).parent))

TEAM_CODE_MAP = {
    "OB": "doosan", "LG": "lg", "WO": "kiwoom", "SK": "ssg",
    "KT": "kt", "HH": "hanwha", "SS": "samsung", "HT": "kia",
    "LT": "lotte", "NC": "nc",
}
TEAM_NAME_MAP = {"doosan": "두산", "lg": "LG", "kiwoom": "키움", "ssg": "SSG",
    "kt": "KT", "hanwha": "한화", "samsung": "삼성", "kia": "KIA",
    "lotte": "롯데", "nc": "NC",}

def load_json(filename):
    path = DATA_DIR / filename
    if not path.exists(): return None
    with open(path, "r", encoding="utf-8") as f: return json.load(f)

def _naver_to_internal_gid(naver_id):
    m = re.match(r"(\d{8})([A-Z]+)([A-Z]+)(\d+)", naver_id)
    if not m: return naver_id
    dt, away, home, seq = m.group(1), m.group(2), m.group(3), m.group(4)
    seq_int = int(seq)
    away_team = TEAM_CODE_MAP.get(away, away.lower())
    home_team = TEAM_CODE_MAP.get(home, home.lower())
    dh = "0" if seq_int <= 1 else str(seq_int - 1)
    return f"{dt}{away_team.upper() if len(away_team) <= 2 else away_team}{home_team.upper() if len(home_team) <= 2 else home_team}-{dh}"

def _naver_status(s):
    m = {"1": "scheduled", "2": "live", "3": "finished", "4": "finished",
         "5": "cancelled", "6": "cancelled", "7": "cancelled", "8": "cancelled"}
    return m.get(s, "scheduled")

_WIDGET_CACHE: dict[str, tuple[float, dict]] = {}
_WIDGET_CACHE_TTL = 7

def get_widget_data():
    today_str = date.today().isoformat()
    now = time.time()
    if today_str in _WIDGET_CACHE:
        ct, cd = _WIDGET_CACHE[today_str]
        if now - ct < _WIDGET_CACHE_TTL: return cd

    today_games = load_json("today-games.json") or {}
    standings = load_json("kbo_standings.json") or {}
    rank_map, streak_map = {}, {}
    for r in standings.get("rows", []):
        n = r.get("teamName")
        if n:
            if r.get("rank") is not None: rank_map[n] = r["rank"]
            if r.get("streak") is not None: streak_map[n] = r["streak"]

    starter_map = {}
    for g in today_games.get("games", []):
        gid = g.get("id")
        if not gid: continue
        away, home = g.get("away", {}) or {}, g.get("home", {}) or {}
        as_st, hs_st = None, None
        for side, key in ((away, "away"), (home, "home")):
            s = side.get("starter") if isinstance(side, dict) else None
            if isinstance(s, dict) and s.get("name"):
                if key == "away": as_st = s["name"]
                else: hs_st = s["name"]
            elif isinstance(s, str) and s:
                if key == "away": as_st = s
                else: hs_st = s
        starter_map[gid] = {"away": as_st, "home": hs_st}

    try:
        from scripts.naver_api import schedule_games, game_relay, parse_score_inning, parse_rheb
        raw = schedule_games(today_str, today_str)
    except Exception as e:
        logger.error("schedule_games failed: %s", e)
        return None

    kbo = [g for g in raw if g.get("categoryId") == "kbo"]
    games = []
    def _code_to_kr(code):
        tid = TEAM_CODE_MAP.get(code)
        return TEAM_NAME_MAP.get(tid, code) if tid else code

    for g in kbo:
        nid = str(g.get("gameId", ""))
        iid = _naver_to_internal_gid(nid)
        st = _naver_status(g.get("statusCode", ""))
        hc, ac = str(g.get("homeTeamCode", "")), str(g.get("awayTeamCode", ""))
        ht, at = _code_to_kr(hc), _code_to_kr(ac)
        sm = starter_map.get(iid, {})
        game = {
            "gameId": iid, "status": st, "homeTeam": hc, "awayTeam": ac,
            "homeName": ht, "awayName": at,
            "venue": g.get("venue", ""), "time": g.get("startTime", ""),
            "homeStarter": sm.get("home"), "awayStarter": sm.get("away"),
            "homeRank": rank_map.get(ht), "awayRank": rank_map.get(at),
            "homeStreak": streak_map.get(ht), "awayStreak": streak_map.get(at),
        }
        if st == "live":
            try:
                relay = game_relay(nid)
                game["relay"] = relay
                game["score"] = parse_score_inning(nid)
                game["scoreBoard"] = {"rheb": parse_rheb(nid), "inn": game["score"]["inning_detail"]}
            except: pass
        games.append(game)

    result = {"games": games, "todayWeather": today_games.get("todayWeather", {})}
    _WIDGET_CACHE[today_str] = (now, result)
    return result

app = FastAPI(title="Widget Data Worker")

@app.get("/widget-data")
def widget_data():
    data = get_widget_data()
    if data is None: return JSONResponse({"error": "Service unavailable"}, status_code=503)
    return data

@app.get("/health")
def health(): return {"status": "ok"}
