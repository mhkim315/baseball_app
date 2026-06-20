"""
Daum Sports API → 내부 표준 형식 정규화 어댑터.

Naver API 장애 시 폴백 데이터 소스.
Daum game ID는 날짜별로 순차 증가 (하루 5경기).
"""

import json, logging, urllib.request
from datetime import date, timedelta

logger = logging.getLogger("fullcount.daum-adapter")

DAUM_GAME_API = "https://sports.daum.net/prx/hermes/api/game"
DAUM_LIVE_API = "https://issue.daum.net/api/arms/SPORTS_GAME"
DAUM_LIST_API = "https://issue.daum.net/api/arms/SPORTS_GAME_LIST"
UA = "Mozilla/5.0"

# Known starting point: first KBO game on this date
_REF_DATE = date(2026, 6, 18)
_REF_FIRST_ID = 80100867
_GAMES_PER_DAY = 5


def _fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://sports.daum.net/"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


def get_daum_game_ids(date_str):
    """date_str = 'YYYYMMDD' → {cpGameId: daumGameId}

    Scans game IDs forward from the reference point until finding games
    with the target date. Handles days without games (Mondays, breaks)
    by skipping empty/unmatched IDs.
    """
    y, m, d = int(date_str[:4]), int(date_str[4:6]), int(date_str[6:8])
    target = date(y, m, d)
    days_diff = (target - _REF_DATE).days
    # Start several game-days before; non-game days (Mon, breaks) don't consume IDs
    gid = _REF_FIRST_ID + max(0, days_diff - 7) * _GAMES_PER_DAY

    mapping = {}
    # Scan a window of IDs; non-game days shift the actual IDs forward
    for _ in range(40):  # generous window to handle breaks + off-days
        url = "%s/%d" % (DAUM_GAME_API, gid)
        try:
            doc = _fetch_json(url)
        except Exception:
            gid += 1
            continue

        cpid = doc.get("cpGameId", "")
        sd = doc.get("startDate", "")
        lc = doc.get("league", {}).get("leagueCode", "")

        # Only collect KBO games from the target date
        if lc == "KBO" and sd == date_str:
            mapping[cpid] = gid
        elif lc == "KBO" and mapping:
            # Started seeing future KBO games → stop
            break

        gid += 1

        # Safety: if we've collected enough games, stop
        if len(mapping) >= _GAMES_PER_DAY:
            break

    return mapping


def fetch_daum_game(daum_game_id):
    """Fetch full game data from Daum including liveData."""
    url = "%s?gameId=%d&detail=liveData" % (DAUM_LIVE_API, daum_game_id)
    data = _fetch_json(url)
    doc = data.get("document", {})
    return doc


def normalize_game(doc):
    """Daum game document → 내부 표준 game dict (Naver 호환)."""
    home = doc.get("home", {})
    away = doc.get("away", {})
    hs = doc.get("homeScore", {})
    aws = doc.get("awayScore", {})
    field = doc.get("field", {})

    # Player name lookup from homePerson + awayPerson
    p2n = {}
    for person_list in [doc.get("homePerson", []), doc.get("awayPerson", [])]:
        for p in (person_list or []):
            cpid = p.get("cpPersonId")
            name = p.get("nameKo") or p.get("nameMain") or p.get("name")
            if cpid and name:
                p2n[str(cpid)] = name

    # Starters
    hsp = doc.get("homeStartPitcher", {}) or {}
    asp = doc.get("awayStartPitcher", {}) or {}

    return {
        "gameId": str(doc.get("gameId", "")),
        "cpGameId": doc.get("cpGameId", ""),
        "status": _normalize_status(doc.get("gameStatus", "")),
        "homeTeam": home.get("team", {}).get("cpTeamId", ""),
        "awayTeam": away.get("team", {}).get("cpTeamId", ""),
        "homeName": home.get("team", {}).get("shortName", ""),
        "awayName": away.get("team", {}).get("shortName", ""),
        "homeScore": int(home.get("result", 0) or 0),
        "awayScore": int(away.get("result", 0) or 0),
        "homeStarter": hsp.get("nameKo") or hsp.get("name"),
        "awayStarter": asp.get("nameKo") or asp.get("name"),
        "homeStarterId": hsp.get("cpPersonId"),
        "awayStarterId": asp.get("cpPersonId"),
        "venue": field.get("shortName", ""),
        "time": doc.get("startTime", ""),
        "scoreBoard": {
            "rheb": {
                "home": {"r": hs.get("run", 0), "h": hs.get("hit", 0), "e": hs.get("error", 0)},
                "away": {"r": aws.get("run", 0), "h": aws.get("hit", 0), "e": aws.get("error", 0)},
            },
            "inn": {
                "home": _parse_inn_str(hs.get("inning", "")),
                "away": _parse_inn_str(aws.get("inning", "")),
            },
        },
        "p2n": p2n,  # player name lookup for relay
    }


def normalize_relay(doc):
    """Daum ground state → 내부 표준 relay dict."""
    ld = doc.get("liveData", {}) or {}
    ground = ld.get("ground", {}) or {}

    period = ground.get("lastPeriod", "T01")
    inn = _parse_period(period)
    is_top = period.startswith("T") if period else True

    # Player IDs need name lookup from normalize_game's p2n
    return {
        "inning": str(inn),
        "isTop": "1" if is_top else "0",
        "ball": str(ground.get("ball", "0") or "0"),
        "strike": str(ground.get("strike", "0") or "0"),
        "out": str(ground.get("out", "0") or "0"),
        "base1": "1" if ground.get("base1") else "0",
        "base2": "1" if ground.get("base2") else "0",
        "base3": "1" if ground.get("base3") else "0",
        "_pitcherId": ground.get("currentPitcher"),
        "_batterId": ground.get("currentBatter"),
    }


def apply_relay_names(relay, p2n):
    """Fill pitcher/batter names from p2n lookup."""
    pid = relay.pop("_pitcherId", None)
    bid = relay.pop("_batterId", None)
    pname = p2n.get(str(pid), "") if pid else ""
    bname = p2n.get(str(bid), "") if bid else ""
    relay["pitcher"] = {"id": str(pid or "0"), "name": pname} if pid else None
    relay["batter"] = {"id": str(bid or "0"), "name": bname} if bid else None
    return relay


def _normalize_status(s):
    m = {
        "BEFORE": "scheduled", "READY": "scheduled",
        "PLAY": "live", "START": "live",
        "END": "finished", "CANCEL": "cancelled",
    }
    return m.get(s, "scheduled")


def _parse_period(period_str):
    """B05 → 5, T01 → 1"""
    if not period_str:
        return 0
    try:
        return int(period_str[1:])
    except (ValueError, IndexError):
        return 0


def _parse_inn_str(inn_str):
    """'0,2,3,0,0' → [0,2,3,0,0] (only played innings)"""
    if not inn_str:
        return []
    result = []
    for x in inn_str.split(","):
        x = x.strip()
        if x == "-" or not x:
            break
        try:
            result.append(int(x))
        except ValueError:
            break
    return result


def fetch_daum_games_batch(date_str, league="kbo", season="2026"):
    """Fetch all games for a date with liveData in a single request.
    Returns list of raw game docs compatible with normalize_game/normalize_relay.
    """
    url = "%s?leagueCode=%s&seasonKey=%s&fromDate=%s&toDate=%s&detail=true" % (
        DAUM_LIST_API, league, season, date_str, date_str)
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Referer": "https://sports.daum.net/",
    })
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
    return data.get("document", {}).get("list", [])
