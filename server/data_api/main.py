from __future__ import annotations
import re
import json
import os
import sys
import random
import logging
import time
from datetime import datetime, timedelta, date, time as dt_time
from pathlib import Path
from collections import defaultdict
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import create_engine, text
from concurrent.futures import ThreadPoolExecutor, as_completed
from cachetools import TTLCache

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from shared.scoring_data import _HISTORICAL_SCORING

from data_api.push_router import router as push_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("fullcount")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")
engine = create_engine(DATABASE_URL)

ENABLE_PUSH = os.getenv("ENABLE_PUSH_NOTIFICATIONS", "").lower() in ("1", "true", "yes")

DATA_DIR = Path(os.getenv("DATA_DIR", "/home/opc/fullcount_backend/repo/data"))

app = FastAPI(title="Fullcount API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Rate limiting ---

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests=100, window_seconds=60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window = window_seconds
        self.requests: TTLCache = TTLCache(maxsize=50000, ttl=window_seconds)

    async def dispatch(self, request: Request, call_next):
        forwarded = request.headers.get("x-forwarded-for", "")
        client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
        
        timestamps = self.requests.get(client_ip, [])
        now = time.time()
        timestamps = [t for t in timestamps if now - t < self.window]
        
        if len(timestamps) >= self.max_requests:
            return JSONResponse(
                {"error": "Rate limit exceeded. Try again later."},
                status_code=429,
            )
            
        timestamps.append(now)
        self.requests[client_ip] = timestamps
        return await call_next(request)

app.add_middleware(RateLimitMiddleware, max_requests=100, window_seconds=60)

if ENABLE_PUSH:
    app.include_router(push_router)
    logger.info("Push notification router mounted")
else:
    app.include_router(push_router)
    logger.info("Push notification router mounted (disabled mode)")


# --- Helpers ---

def serialize_row(row):
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, date):
            d[k] = v.isoformat()
        elif isinstance(v, dt_time):
            d[k] = v.strftime("%H:%M")
    return d


_JSON_CACHE = {}
_JSON_CACHE_TTL = 300  # seconds (matches collector cycle)

_RELAY_CACHE: dict[str, tuple[float, dict | None]] = {}
_RELAY_CACHE_TTL = 5  # seconds — prevent Naver IP block

_WEATHER_CACHE: dict[str, tuple[float, dict | None]] = {}
_WEATHER_CACHE_TTL = 1800  # 30 minutes

_WIDGET_CACHE: dict[str, tuple[float, dict]] = {}
_WIDGET_CACHE_TTL = 7  # seconds — asymmetric with client 10s polling

def load_json(filename):
    now = time.time()
    if filename in _JSON_CACHE:
        cached_data, timestamp = _JSON_CACHE[filename]
        if now - timestamp < _JSON_CACHE_TTL:
            return cached_data

    path = DATA_DIR / filename
    if not path.exists():
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            _JSON_CACHE[filename] = (data, now)
            return data
    except json.JSONDecodeError:
        return None


def validate_date(date_str: str) -> bool:
    return bool(re.match(r"^\d{4}-\d{2}-\d{2}$", date_str))


# --- Global exception handler ---

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception in %s %s", request.method, request.url.path)
    return JSONResponse(
        {"error": "Internal server error"},
        status_code=500,
    )


# --- Scheduler ---

scheduler = BackgroundScheduler()


def scheduled_collect():
    try:
        from collector import collect
        collect()
    except Exception as e:
        print(f"Collection error: {e}")
    _JSON_CACHE.clear()
    # Pre-warm cache with fresh data written by collector
    load_json("today-games.json")
    load_json("daily-scores.json")
    next_interval = random.randint(180, 300)
    next_run_time = datetime.now() + timedelta(seconds=next_interval)
    scheduler.add_job(scheduled_collect, "date", run_date=next_run_time)


scheduler.add_job(scheduled_collect, "date", run_date=datetime.now() + timedelta(seconds=10))

if ENABLE_PUSH:
    def scheduled_push_worker():
        from scripts.push_worker import run_push_worker
        try:
            run_push_worker(_get_widget_data_cached, engine)
        except Exception as e:
            logger.warning("push_worker error: %s", e)
        next_interval = random.randint(5, 10)
        scheduler.add_job(scheduled_push_worker, "date", run_date=datetime.now() + timedelta(seconds=next_interval))

    scheduler.add_job(scheduled_push_worker, "date", run_date=datetime.now() + timedelta(seconds=15))

scheduler.start()


# --- Routes ---

@app.get("/")
def read_root():
    return {
        "status": "online",
        "scheduler_status": "running",
        "mode": "random_interval (3-5min)",
        "message": "Fullcount API Server",
    }


@app.get("/teams")
def get_teams():
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT * FROM teams"))
            rows = result.mappings().all()
            return [serialize_row(r) for r in rows]
    except Exception:
        return JSONResponse({"error": "Database unavailable"}, status_code=503)


@app.get("/standings")
def get_standings():
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT * FROM standings ORDER BY rank ASC"))
            rows = result.mappings().all()
            if rows:
                return [serialize_row(r) for r in rows]
    except Exception:
        pass
    data = load_json("kbo_standings.json")
    if data and "rows" in data:
        return data["rows"]
    return []


@app.get("/games")
def get_games():
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT * FROM games"))
            rows = result.mappings().all()
            return [serialize_row(r) for r in rows]
    except Exception:
        return JSONResponse({"error": "Database unavailable"}, status_code=503)


@app.get("/games/{game_date}")
def get_games_by_date(game_date: str):
    if not validate_date(game_date):
        return JSONResponse({"error": "Invalid date format. Use YYYY-MM-DD"}, status_code=400)
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT * FROM games WHERE date = :d"), {"d": game_date})
            rows = result.mappings().all()
            return [serialize_row(r) for r in rows]
    except Exception:
        return JSONResponse({"error": "Database unavailable"}, status_code=503)


def _get_weather_cached(stadium_name: str) -> dict | None:
    now = time.time()
    if stadium_name in _WEATHER_CACHE:
        cached_data, timestamp = _WEATHER_CACHE[stadium_name]
        if now - timestamp < _WEATHER_CACHE_TTL:
            return cached_data
    try:
        from scripts.naver_api import get_weather
        weather_data = get_weather(stadium_name)
        _WEATHER_CACHE[stadium_name] = (weather_data, now)
        return weather_data
    except Exception as e:
        logger.error(f"Error fetching weather for {stadium_name}: {e}")
        return None

@app.get("/weather/{stadium_name}")
def get_stadium_weather(stadium_name: str):
    import urllib.parse
    decoded_name = urllib.parse.unquote(stadium_name)
    weather_data = _get_weather_cached(decoded_name)
    if not weather_data:
        return JSONResponse({"error": "Weather data unavailable"}, status_code=404)
    return weather_data


@app.get("/stadium-brief")
def get_stadium_briefs():
    data = load_json("stadium-brief.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    return data


@app.get("/stadium-brief/{stadium_id}")
def get_stadium_brief(stadium_id: str):
    data = load_json("stadium-brief.json")
    if data is None or stadium_id not in data:
        return JSONResponse({"error": "Stadium not found"}, status_code=404)
    return data[stadium_id]


@app.get("/stadium-foods/{stadium_id}")
def get_stadium_foods(stadium_id: str):
    data = load_json("food-places.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    stadiums = data.get("stadiums", {})
    if stadium_id not in stadiums:
        return JSONResponse({"error": "Stadium not found"}, status_code=404)
    return {"stadiumId": stadium_id, "places": stadiums[stadium_id]}


@app.get("/stadium-eats/{stadium_id}")
def get_stadium_eats(stadium_id: str):
    data = load_json("stadium-eats.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    stadiums = data.get("stadiums", {})
    if stadium_id not in stadiums:
        return JSONResponse({"error": "Stadium not found"}, status_code=404)
    return stadiums[stadium_id]


@app.get("/stadium-surroundings/{stadium_id}")
def get_stadium_surroundings(stadium_id: str):
    data = load_json("stadium-surroundings.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    stadiums = data.get("stadiums", {})
    if stadium_id not in stadiums:
        return JSONResponse({"error": "Stadium not found"}, status_code=404)
    return stadiums[stadium_id]


@app.get("/cheering-songs/{team_id}")
def get_cheering_songs(team_id: str):
    data = load_json("cheering-songs.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    teams = data.get("teams", {})
    if team_id not in teams:
        return JSONResponse({"error": "Team not found"}, status_code=404)
    return teams[team_id]


@app.get("/cheering-players/{team_id}")
def get_cheering_players(team_id: str):
    data = load_json("cheering-players.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    teams = data.get("teams", {})
    if team_id not in teams:
        return JSONResponse({"error": "Team not found"}, status_code=404)
    return teams[team_id]


@app.get("/standings/json")
def get_standings_json():
    data = load_json("kbo_standings.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    return data


@app.get("/daily-scores")
def get_all_daily_scores():
    data = load_json("daily-scores.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    return data


@app.get("/daily-scores/{date}")
def get_daily_scores(date: str):
    if not validate_date(date):
        return JSONResponse({"error": "Invalid date format. Use YYYY-MM-DD"}, status_code=400)
    data = load_json("daily-scores.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    dates = data.get("dates", {})
    if date not in dates:
        return JSONResponse({"error": "Date not found"}, status_code=404)
    return {"date": date, "games": dates[date]}


@app.get("/schedule")
def get_schedule(year: int = None):
    if year is None:
        year = date.today().year
    data = load_json(f"kbo_schedule_{year}.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    return data


def _enrich_schedule_times(games_list: list) -> list:
    """Override schedule times with actual values from today-games.json (today/tomorrow only).
    Falls back to game-records JSON files for past games."""
    time_lookup = {}

    # 1. Enrich from today-games.json (today/tomorrow)
    today_data = load_json("today-games.json")
    if today_data:
        for tg in today_data.get("games", []) + today_data.get("nextGames", []):
            tg_date = tg.get("date", "")
            tg_time = tg.get("time")
            away = tg.get("away", {})
            home = tg.get("home", {})
            if tg_date and tg_time and isinstance(away, dict) and isinstance(home, dict):
                key = (tg_date.replace("-", ""), away.get("name", ""), home.get("name", ""))
                time_lookup[key] = tg_time

    # 2. Enrich from game-records (past games not covered by today-games.json)
    name_to_team_id = {v: k for k, v in TEAM_NAME_MAP.items()}
    for g in games_list:
        key = (g.get("date", ""), g.get("away", ""), g.get("home", ""))
        if key in time_lookup:
            continue
        d = g.get("date", "")
        if len(d) == 8:
            date_str = f"{d[:4]}-{d[4:6]}-{d[6:8]}"
        else:
            date_str = d
        home_name = g.get("home", "")
        home_id = name_to_team_id.get(home_name)
        if not home_id:
            continue
        record_path = DATA_DIR / "teams" / home_id / "game-records" / f"{date_str}.json"
        if record_path.exists():
            try:
                with open(record_path, "r", encoding="utf-8") as f:
                    record = json.load(f)
                gt = record.get("gameInfo", {}).get("gtime")
                if gt:
                    time_lookup[key] = gt
            except Exception:
                pass

    enriched = []
    for g in games_list:
        g = dict(g)  # shallow copy to avoid mutating cached data
        key = (g.get("date", ""), g.get("away", ""), g.get("home", ""))
        if key in time_lookup:
            g["time"] = time_lookup[key]
        enriched.append(g)
    return enriched


def _get_schedule_for_month(month: int, year: Optional[int] = None) -> Optional[dict]:
    """Return schedule dict for month/year, or None if data unavailable."""
    if month < 1 or month > 12:
        return None
    if year is not None:
        path = DATA_DIR / "seasons" / str(year) / "regular-season.json"
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            reg = json.load(f)
        result = []
        for g in reg.get("games", []):
            ds = g.get("date", "")
            if len(ds) == 8:
                m = int(ds[4:6])
                d = int(ds[6:8])
                if m == month:
                    result.append({
                        "date": ds, "month": m, "day": d,
                        "venue": g.get("venue", ""),
                        "away": g.get("away", ""),
                        "home": g.get("home", ""),
                        "time": g.get("time"),
                    })
        return {"year": year, "month": month, "games": _enrich_schedule_times(result)}
    # No year provided — use current year's schedule JSON
    year_default = date.today().year
    data = load_json(f"kbo_schedule_{year_default}.json")
    if data is None:
        return None
    games = [g for g in data.get("games", []) if g.get("month") == month]
    return {"year": data.get("year"), "month": month, "games": _enrich_schedule_times(games)}


@app.get("/schedule/{month}")
def get_schedule_by_month(month: int, year: int = None):
    if month < 1 or month > 12:
        return JSONResponse({"error": "Invalid month. Must be 1-12"}, status_code=400)
    result = _get_schedule_for_month(month, year)
    if result is not None:
        return result
    return JSONResponse({"error": "Data not found"}, status_code=404)

@app.get("/seasons")
def get_seasons():
    seasons_dir = DATA_DIR / "seasons"
    if not seasons_dir.exists():
        return {"years": []}
    years = sorted(
        [int(d.name) for d in seasons_dir.iterdir() if d.is_dir() and d.name.isdigit()],
        reverse=True,
    )
    return {"years": years}


@app.get("/regular-games/{year}")
def get_regular_games(year: int):
    path = DATA_DIR / "seasons" / str(year) / "regular-season.json"
    if not path.exists():
        return JSONResponse({"error": "Data not found"}, status_code=404)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/exhibition-games")
def get_exhibition_games(year: int = None):
    if year is not None:
        path = DATA_DIR / "seasons" / str(year) / "exhibition-games.json"
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        return JSONResponse({"error": "Data not found"}, status_code=404)
    year = date.today().year
    data = load_json(f"exhibition-games-{year}.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    return data


@app.get("/today-games")
def get_today_games():
    data = load_json("today-games.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    return data


@app.get("/refresh-data")
def get_refresh_data():
    today_str = date.today().isoformat()
    year = date.today().year
    today_games = load_json("today-games.json")
    standings_data = load_json("kbo_standings.json")
    standings = standings_data.get("rows") if standings_data else None
    daily = load_json("daily-scores.json")
    today_scores = daily.get("dates", {}).get(today_str, []) if daily else []
    team_runs = {}
    team_games = {}
    if daily:
        for date_str, games in daily.get("dates", {}).items():
            if not date_str.startswith(str(year)):
                continue
            for game in games:
                if game.get("cancelled") or game.get("outcome") is None:
                    continue
                team_runs[game["away"]] = team_runs.get(game["away"], 0) + game["awayScore"]
                team_games[game["away"]] = team_games.get(game["away"], 0) + 1
                team_runs[game["home"]] = team_runs.get(game["home"], 0) + game["homeScore"]
                team_games[game["home"]] = team_games.get(game["home"], 0) + 1
    teams = []
    for team in sorted(team_runs):
        g = team_games.get(team, 0)
        teams.append({
            "teamName": team,
            "avgRuns": round(team_runs[team] / g, 1) if g > 0 else 0,
            "totalRuns": team_runs[team],
            "totalGames": g,
        })
    score_summary = {"year": year, "teams": teams}

    # Build game-detail for today's games (5분 주기 캐시 갱신)
    today_game_details = {}
    for g in (today_games or {}).get("games", []):
        gid = g.get("id")
        if not gid:
            continue
        m = GAME_ID_REGEX.match(gid)
        if not m:
            continue
        date_str_raw = m.group(1)
        date_str = f"{date_str_raw[:4]}-{date_str_raw[4:6]}-{date_str_raw[6:8]}"
        away_code = m.group(2)
        home_code = m.group(3)
        away_team = TEAM_CODE_MAP.get(away_code)
        home_team = TEAM_CODE_MAP.get(home_code)
        if not away_team or not home_team:
            continue

        lineup = {"home": [], "away": []}
        starters = {"home": None, "away": None}
        score_board = None
        pitching_result = []
        etc_records = []

        for team_id, side in [(away_team, "away"), (home_team, "home")]:
            record_path = DATA_DIR / "teams" / team_id / "game-records" / f"{date_str}.json"
            if record_path.exists():
                try:
                    with open(record_path, "r", encoding="utf-8") as f:
                        record = json.load(f)
                    lineup[side] = record.get("homeLineup" if side == "home" else "awayLineup", [])
                    if not starters[side]:
                        starter = record.get("homeStarter" if side == "home" else "awayStarter")
                        if starter:
                            starters[side] = starter
                    if record.get("scoreBoard"):
                        score_board = record["scoreBoard"]
                    if record.get("pitchingResult"):
                        pitching_result = record["pitchingResult"]
                    if record.get("etcRecords"):
                        etc_records = record["etcRecords"]
                except json.JSONDecodeError:
                    pass

        today_game_details[gid] = {
            "gameId": gid,
            "date": date_str,
            "homeTeam": home_team,
            "awayTeam": away_team,
            "starters": starters,
            "lineup": lineup,
            "scoreBoard": score_board,
            "pitchingResult": pitching_result,
            "etcRecords": etc_records,
        }

    def resolve_venue_name(home_team_id: str) -> str | None:
        venue_map = {
            "doosan": "잠실야구장", "lg": "잠실야구장", "kiwoom": "고척스카이돔",
            "ssg": "인천SSG랜더스필드", "kt": "수원KT위즈파크", "hanwha": "대전한화생명이글스파크",
            "samsung": "대구삼성라이온즈파크", "kia": "광주기아챔피언스필드", "lotte": "사직야구장",
            "nc": "창원NC파크"
        }
        return venue_map.get(home_team_id)

    today_weather = {}
    stadiums = set()
    for g in (today_games or {}).get("games", []):
        gid = g.get("id")
        if not gid: continue
        m = GAME_ID_REGEX.match(gid)
        if not m: continue
        home_team = TEAM_CODE_MAP.get(m.group(3))
        if home_team:
            venue = resolve_venue_name(home_team)
            if venue:
                stadiums.add(venue)

    if stadiums:
        with ThreadPoolExecutor(max_workers=5) as ex:
            futures = {ex.submit(_get_weather_cached, s): s for s in stadiums}
            for f in as_completed(futures, timeout=12):
                s = futures[f]
                try:
                    w = f.result()
                    if w:
                        today_weather[s] = w
                except Exception:
                    pass

    return {
        "todayGames": today_games,
        "standings": standings,
        "todayScores": today_scores,
        "scoreSummary": score_summary,
        "todayGameDetails": today_game_details,
        "todayWeather": today_weather,
    }


# --- Widget data V3 (SSOT: names, starters, ranks, internal IDs) ---

_VENUE_SHORT: dict[str, str] = {
    "OB": "잠실", "LG": "잠실", "WO": "고척",
    "SK": "인천", "KT": "수원", "HH": "대전",
    "SS": "대구", "HT": "광주", "LT": "사직",
    "NC": "창원",
}

_NAVER_ID_RE = re.compile(r"^(\d{8})([A-Z]{2})([A-Z]{2})(\d)")


def _naver_to_internal_gid(naver_id: str) -> str:
    """Convert '20260615OBLG02026' → '20260615-OBLG-0'."""
    m = _NAVER_ID_RE.match(naver_id)
    if m:
        return f"{m.group(1)}-{m.group(2)}{m.group(3)}-{m.group(4)}"
    return naver_id


def _naver_status(s: str) -> str:
    """Map Naver status strings → widget status."""
    if not s:
        return "scheduled"
    su = s.upper()
    if su in ("STARTED", "PLAYING", "LIVE"):
        return "live"
    if su in ("RESULT", "ENDED", "FINISHED"):
        return "finished"
    if su in ("CANCEL", "CANCELLED"):
        return "cancelled"
    return "scheduled"


def _get_widget_data_cached() -> dict | None:
    """Build widget data dict with in-memory caching. Returns None on failure."""
    today_str = date.today().isoformat()
    now = time.time()

    if today_str in _WIDGET_CACHE:
        cached_time, cached_data = _WIDGET_CACHE[today_str]
        if now - cached_time < _WIDGET_CACHE_TTL:
            return cached_data

    # Memory-cached JSON lookups (no disk I/O inside 15 s window)
    today_games = load_json("today-games.json") or {}
    standings_data = load_json("kbo_standings.json") or {}

    rank_map: dict[str, int] = {}
    for row in standings_data.get("rows", []):
        rn = row.get("teamName")
        rk = row.get("rank")
        if rn and rk is not None:
            rank_map[rn] = rk

    starter_map: dict[str, dict] = {}
    for g in today_games.get("games", []):
        gid = g.get("id")
        if not gid:
            continue
        away = g.get("away", {})
        home = g.get("home", {})
        if not isinstance(away, dict):
            away = {}
        if not isinstance(home, dict):
            home = {}
        away_st = None
        home_st = None
        for side, key in ((away, "away"), (home, "home")):
            s = side.get("starter")
            if isinstance(s, dict) and s.get("name"):
                if key == "away":
                    away_st = s["name"]
                else:
                    home_st = s["name"]
            elif isinstance(s, str) and s:
                if key == "away":
                    away_st = s
                else:
                    home_st = s
        starter_map[gid] = {"away": away_st, "home": home_st}

    try:
        from scripts.naver_api import (
            schedule_games,
            game_relay,
            parse_score_inning,
            parse_rheb,
        )
        raw_games = schedule_games(today_str, today_str)
    except Exception as e:
        logger.error("widget-data: schedule_games failed — %s", e)
        return None

    kbo_games = [g for g in raw_games if g.get("categoryId") == "kbo"]

    games_data: list[dict] = []
    live_naver_ids: list[str] = []

    def _code_to_kr(code: str) -> str:
        tid = TEAM_CODE_MAP.get(code)
        return TEAM_NAME_MAP.get(tid, code) if tid else code

    for g in kbo_games:
        naver_id = str(g.get("gameId", ""))
        internal_id = _naver_to_internal_gid(naver_id)
        status = _naver_status(g.get("status", ""))

        home_code = str(g.get("homeTeamCode") or "")
        away_code = str(g.get("awayTeamCode") or "")
        home_kr = _code_to_kr(home_code)
        away_kr = _code_to_kr(away_code)

        hs = g.get("homeScore")
        aws = g.get("awayScore")

        starters = starter_map.get(internal_id, {})
        home_starter = starters.get("home")
        away_starter = starters.get("away")

        entry: dict = {
            "gameId": internal_id,
            "naverGameId": naver_id,
            "gameIdx": 0,
            "time": (g.get("gameDateTime") or g.get("startTime") or "")[11:16]
            if len(g.get("gameDateTime") or g.get("startTime") or "") >= 16
            else "",
            "venue": _VENUE_SHORT.get(home_code, g.get("stadium") or g.get("venue") or ""),
            "status": status,
            "homeTeam": home_code,
            "awayTeam": away_code,
            "homeName": home_kr,
            "awayName": away_kr,
            "homeStarter": home_starter,
            "awayStarter": away_starter,
            "homeRank": rank_map.get(home_kr),
            "awayRank": rank_map.get(away_kr),
            "score": {"home": hs, "away": aws} if hs is not None and aws is not None else None,
            "scoreBoard": {
                "rheb": {
                    "home": parse_rheb(str(g.get("homeTeamRheb") or "")),
                    "away": parse_rheb(str(g.get("awayTeamRheb") or "")),
                },
                "inn": {
                    "home": parse_score_inning(str(g.get("homeTeamScoreByInning") or "")),
                    "away": parse_score_inning(str(g.get("awayTeamScoreByInning") or "")),
                },
            },
            "relay": None,
        }
        games_data.append(entry)

        if status == "live":
            live_naver_ids.append(naver_id)

    # ── Assign gameIdx (1‑based; >1 = DH) ──────────────────
    seen: dict[str, int] = {}
    for entry in games_data:
        key = entry["awayTeam"] + entry["homeTeam"]
        idx = seen.get(key, 0) + 1
        seen[key] = idx
        entry["gameIdx"] = idx

    # ── Parallel relay fetch for live games ─────────────────
    if live_naver_ids:
        def _fetch_relay(nid: str) -> dict | None:
            try:
                rd = game_relay(nid)
                if not rd:
                    return None
                home_entry = rd.get("homeEntry", []) or []
                away_entry = rd.get("awayEntry", []) or []
                p2n: dict[str, str] = {}
                for e in home_entry + away_entry:
                    if isinstance(e, dict) and e.get("pcode") and e.get("name"):
                        p2n[str(e["pcode"])] = str(e["name"])

                cs = rd.get("currentGameState", {}) or {}
                pid = str(cs.get("pitcher") or "0")
                bid = str(cs.get("batter") or "0")
                return {
                    "strike": str(cs.get("strike") or "0"),
                    "ball": str(cs.get("ball") or "0"),
                    "out": str(cs.get("out") or "0"),
                    "base1": str(cs.get("base1") or "0"),
                    "base2": str(cs.get("base2") or "0"),
                    "base3": str(cs.get("base3") or "0"),
                    "pitcher": {"id": pid, "name": p2n.get(pid, "")} if pid != "0" else None,
                    "batter": {"id": bid, "name": p2n.get(bid, "")} if bid != "0" else None,
                }
            except Exception as e:
                logger.warning("widget-data: relay failed for %s — %s", nid, e)
                return None

        with ThreadPoolExecutor(max_workers=5) as ex:
            futures = {ex.submit(_fetch_relay, nid): nid for nid in live_naver_ids}
            relay_map: dict[str, dict | None] = {}
            for f in as_completed(futures, timeout=10):
                nid = futures[f]
                try:
                    relay_map[nid] = f.result()
                except Exception:
                    relay_map[nid] = None

        for entry in games_data:
            if entry["status"] == "live":
                entry["relay"] = relay_map.get(entry["naverGameId"])

    # ── Weather data ──────────────────────────────────
    today_weather = {}
    stadiums = set()
    for g in kbo_games:
        home_code = str(g.get("homeTeamCode") or "")
        venue = {
            "OB": "잠실야구장", "LG": "잠실야구장", "WO": "고척스카이돔",
            "SK": "인천SSG랜더스필드", "KT": "수원KT위즈파크", "HH": "대전한화생명이글스파크",
            "SS": "대구삼성라이온즈파크", "HT": "광주기아챔피언스필드", "LT": "사직야구장",
            "NC": "창원NC파크",
        }.get(home_code)
        if venue:
            stadiums.add(venue)
    if stadiums:
        with ThreadPoolExecutor(max_workers=5) as ex:
            futures = {ex.submit(_get_weather_cached, s): s for s in stadiums}
            for f in as_completed(futures, timeout=12):
                s = futures[f]
                try:
                    w = f.result()
                    if w:
                        today_weather[s] = w
                except Exception:
                    pass

    result: dict = {"games": games_data, "todayWeather": today_weather}
    _WIDGET_CACHE[today_str] = (time.time(), result)
    return result


@app.get("/widget-data")
def get_widget_data():
    data = _get_widget_data_cached()
    if data is None:
        return JSONResponse({"error": "Service unavailable"}, status_code=503)
    return data


@app.get("/postseason-odds")
def get_postseason_odds():
    data = load_json("kbo_postseason_odds.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    return data


@app.get("/ticket-policy")
def get_ticket_policy():
    data = load_json("kbo_ticket_policy.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    return data


# --- Game detail ---

TEAM_CODE_MAP = {
    "OB": "doosan", "LG": "lg", "WO": "kiwoom", "SK": "ssg",
    "KT": "kt", "HH": "hanwha", "SS": "samsung", "HT": "kia",
    "LT": "lotte", "NC": "nc",
}

TEAM_NAME_MAP = {
    "kt": "KT", "lg": "LG", "samsung": "\uc0bc\uc131", "ssg": "SSG",
    "kia": "KIA", "doosan": "\ub450\uc0b0", "hanwha": "\ud55c\ud654", "nc": "NC",
    "lotte": "\ub86f\ub370", "kiwoom": "\ud0a4\uc6c0",
}

GAME_ID_REGEX = re.compile(r"(\d{8})-([A-Z]{2})([A-Z]{2})-(\d)")


def _get_db_game_time(game_id: str) -> Optional[str]:
    """Query games.time from PostgreSQL for a given game_id."""
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT time::text FROM games WHERE id = :gid"),
                {"gid": game_id}
            ).fetchone()
            if row and row[0]:
                return row[0].strip()
    except Exception:
        pass
    return None


def _build_game_detail(game_id: str) -> Optional[dict]:
    """Build game detail dict from game ID. Returns None if data unavailable."""
    m = GAME_ID_REGEX.match(game_id)
    if not m:
        return None
    date_str_raw = m.group(1)
    date_str = f"{date_str_raw[:4]}-{date_str_raw[4:6]}-{date_str_raw[6:8]}"
    away_code = m.group(2)
    home_code = m.group(3)
    game_seq = int(m.group(4))

    away_team = TEAM_CODE_MAP.get(away_code)
    home_team = TEAM_CODE_MAP.get(home_code)
    if not away_team or not home_team:
        return None

    today = load_json("today-games.json")
    scores = load_json("daily-scores.json")
    game_data = None
    if today:
        for g in today.get("games", []) + today.get("nextGames", []):
            if g.get("id") == game_id:
                game_data = g
                break

    if not game_data and scores and date_str in scores.get("dates", {}):
        for g in scores["dates"][date_str]:
            if g.get("gameId") == game_id:
                game_data = g
                break
        if not game_data:
            home_kr = TEAM_NAME_MAP.get(home_team)
            away_kr = TEAM_NAME_MAP.get(away_team)
            day_games = scores["dates"][date_str]
            matchup_games = [g for g in day_games if g.get("home") == home_kr and g.get("away") == away_kr]
            if len(matchup_games) == 1:
                game_data = matchup_games[0]
            elif len(matchup_games) > 1:
                relative_idx = sum(
                    1 for i, g in enumerate(day_games)
                    if g.get("home") == home_kr and g.get("away") == away_kr and i < game_seq
                )
                game_data = next(
                    (g for g in matchup_games if g.get("gameIdx") == relative_idx),
                    matchup_games[relative_idx] if relative_idx < len(matchup_games) else matchup_games[0]
                )

    dh_game_number = 0
    if scores and date_str in scores.get("dates", {}):
        home_kr = TEAM_NAME_MAP.get(home_team)
        away_kr = TEAM_NAME_MAP.get(away_team)
        day_games = scores["dates"][date_str]
        matchup_games = [g for g in day_games if g.get("home") == home_kr and g.get("away") == away_kr]
        if len(matchup_games) > 1:
            relative_idx = sum(
                1 for i, g in enumerate(day_games)
                if g.get("home") == home_kr and g.get("away") == away_kr and i < game_seq
            )
            dh_game_number = relative_idx

    lineup = {"home": [], "away": []}
    starters = {"home": None, "away": None}
    score_board = None
    pitching_result = []
    etc_records = []
    lineup_confirmed = False
    game_time_from_records = None
    naver_game_id = None

    for team_id, side in [(away_team, "away"), (home_team, "home")]:
        if dh_game_number >= 1:
            record_path = DATA_DIR / "teams" / team_id / "game-records" / f"{date_str}_dh2.json"
            if not record_path.exists():
                record_path = DATA_DIR / "teams" / team_id / "game-records" / f"{date_str}.json"
        else:
            record_path = DATA_DIR / "teams" / team_id / "game-records" / f"{date_str}.json"
        if record_path.exists():
            try:
                with open(record_path, "r", encoding="utf-8") as f:
                    record = json.load(f)
                if not naver_game_id:
                    naver_game_id = record.get("meta", {}).get("naverGameId")
                lineup[side] = record.get("homeLineup" if side == "home" else "awayLineup", [])
                if not starters[side]:
                    starter = record.get("homeStarter" if side == "home" else "awayStarter")
                    if starter:
                        starters[side] = starter
                if record.get("scoreBoard"):
                    score_board = record["scoreBoard"]
                if record.get("pitchingResult"):
                    pitching_result = record["pitchingResult"]
                if record.get("etcRecords"):
                    etc_records = record["etcRecords"]
            except json.JSONDecodeError:
                pass

        if len(lineup[side]) == 0:
            fallback_path = DATA_DIR / "teams" / team_id / "lineup.json"
            if fallback_path.exists():
                try:
                    with open(fallback_path, "r", encoding="utf-8") as f:
                        lu = json.load(f)
                    batters = lu.get("batters", [])
                    if batters:
                        lineup[side] = batters
                    v = lu.get("meta", {}).get("lineupVerification", {})
                    if v.get("ours", {}).get("confirmed"):
                        lineup_confirmed = True
                    if not starters[side]:
                        sp = lu.get("startingPitcher")
                        if sp and sp.get("name") and sp["name"] not in ("??", "미정", ""):
                            starters[side] = sp
                except (json.JSONDecodeError, KeyError):
                    pass
        elif len(lineup[side]) > 0:
            lineup_confirmed = True

    # Extract actual game time from game-records (authoritative source)
    if not game_time_from_records:
        for team_id in (away_team, home_team):
            record_path = DATA_DIR / "teams" / team_id / "game-records" / f"{date_str}.json"
            if dh_game_number >= 1:
                alt_path = DATA_DIR / "teams" / team_id / "game-records" / f"{date_str}_dh2.json"
                if alt_path.exists():
                    record_path = alt_path
            if record_path.exists():
                try:
                    with open(record_path, "r", encoding="utf-8") as f:
                        rec = json.load(f)
                    gt = rec.get("gameInfo", {}).get("gtime")
                    if gt:
                        game_time_from_records = gt
                        break
                except Exception:
                    pass

    if game_data:
        away_s = game_data.get("awayStarter") or (game_data.get("away", {}).get("starter") if isinstance(game_data.get("away"), dict) else None)
        home_s = game_data.get("homeStarter") or (game_data.get("home", {}).get("starter") if isinstance(game_data.get("home"), dict) else None)
        if away_s and not starters["away"]:
            starters["away"] = away_s if isinstance(away_s, dict) else {"name": away_s}
        if home_s and not starters["home"]:
            starters["home"] = home_s if isinstance(home_s, dict) else {"name": home_s}

    result = {
        "gameId": game_id,
        "date": date_str,
        "homeTeam": home_team,
        "awayTeam": away_team,
        "starters": starters,
        "lineup": lineup,
        "lineupConfirmed": lineup_confirmed,
    }

    if score_board:
        result["scoreBoard"] = score_board
    if pitching_result:
        result["pitchingResult"] = pitching_result
    if etc_records:
        result["etcRecords"] = etc_records

    if not pitching_result and game_data:
        pr = []
        if game_data.get("winPitcher"):
            pr.append({"name": game_data["winPitcher"], "wls": "W"})
        if game_data.get("losePitcher"):
            pr.append({"name": game_data["losePitcher"], "wls": "L"})
        if not pr and scores and date_str in scores.get("dates", {}):
            home_kr = TEAM_NAME_MAP.get(home_team)
            away_kr = TEAM_NAME_MAP.get(away_team)
            for s in scores["dates"][date_str]:
                if s.get("home") == home_kr and s.get("away") == away_kr \
                        and s.get("gameIdx", 0) == game_seq:
                    if s.get("winPitcher"):
                        pr.append({"name": s["winPitcher"], "wls": "W"})
                    if s.get("losePitcher"):
                        pr.append({"name": s["losePitcher"], "wls": "L"})
                    break
        if pr:
            result["pitchingResult"] = pr

    if game_data:
        if isinstance(game_data.get("away"), dict):
            time_val = game_data.get("time")
            if not time_val or time_val == "18:30":
                time_val = game_time_from_records
            if not time_val or time_val == "18:30":
                db_time = _get_db_game_time(game_id)
                if db_time:
                    time_val = db_time
            result["gameInfo"] = {
                "time": time_val or "18:30",
                "venue": game_data.get("venue"),
                "status": game_data.get("status"),
            }
            if "score" in game_data:
                result["score"] = game_data["score"]
        else:
            time_val = game_data.get("gtime") or game_data.get("time")
            if not time_val or time_val == "18:30":
                time_val = game_time_from_records
            if not time_val or time_val == "18:30":
                db_time = _get_db_game_time(game_id)
                if db_time:
                    time_val = db_time
            result["gameInfo"] = {
                "time": time_val or "18:30",
                "venue": game_data.get("stadium") or game_data.get("venue", ""),
                "status": "finished" if game_data.get("awayScore") is not None else "scheduled",
            }
            if game_data.get("awayScore") is not None:
                result["score"] = {
                    "away": game_data["awayScore"],
                    "home": game_data["homeScore"],
                }

    # ── daily-scores.json outcome → finished override ──
    # today-games.json may still say "live" even though daily-scores.json has outcome.
    if scores and date_str in scores.get("dates", {}):
        home_kr = TEAM_NAME_MAP.get(home_team)
        away_kr = TEAM_NAME_MAP.get(away_team)
        for s in scores["dates"][date_str]:
            if s.get("home") == home_kr and s.get("away") == away_kr \
                    and s.get("gameIdx", 0) == game_seq:
                if s.get("outcome") is not None:
                    if "gameInfo" not in result:
                        result["gameInfo"] = {}
                    result["gameInfo"]["status"] = "finished"
                    if "score" not in result and s.get("awayScore") is not None:
                        result["score"] = {"away": s["awayScore"], "home": s["homeScore"]}
                break

    # ── Relay injection (Track 2: live BSO/baserunners/pitcher-batter) ──
    if result.get("gameInfo", {}).get("status") == "live":
        nid = naver_game_id
        if not nid:
            nid = f"{date_str_raw}{away_code}{home_code}{game_seq}{date_str_raw[:4]}"

        now = time.time()
        if nid in _RELAY_CACHE:
            cached_time, cached_data = _RELAY_CACHE[nid]
            if now - cached_time < _RELAY_CACHE_TTL:
                if cached_data is not None:
                    result["relay"] = cached_data
                return result

        try:
            from scripts.naver_api import game_relay
            relay_data = game_relay(nid)
            if relay_data:
                home_entry = relay_data.get("homeEntry", []) or []
                away_entry = relay_data.get("awayEntry", []) or []
                pcode_to_name = {}
                for e in home_entry + away_entry:
                    if isinstance(e, dict) and "pcode" in e and "name" in e:
                        pcode_to_name[e["pcode"]] = e["name"]

                cs = relay_data.get("currentGameState", {}) or {}
                pitcher_id = str(cs.get("pitcher") or "0")
                batter_id = str(cs.get("batter") or "0")

                relay_result = {
                    "strike": str(cs.get("strike") or "0"),
                    "ball": str(cs.get("ball") or "0"),
                    "out": str(cs.get("out") or "0"),
                    "base1": str(cs.get("base1") or "0"),
                    "base2": str(cs.get("base2") or "0"),
                    "base3": str(cs.get("base3") or "0"),
                    "pitcher": {"id": pitcher_id, "name": pcode_to_name.get(pitcher_id, "")} if pitcher_id != "0" else None,
                    "batter": {"id": batter_id, "name": pcode_to_name.get(batter_id, "")} if batter_id != "0" else None,
                }
                _RELAY_CACHE[nid] = (now, relay_result)
                result["relay"] = relay_result
            else:
                _RELAY_CACHE[nid] = (now, None)
        except Exception as e:
            logger.warning("Failed to fetch relay for %s: %s", nid, e)

    return result


@app.get("/game-detail/{game_id}")
def get_game_detail(game_id: str):
    result = _build_game_detail(game_id)
    if result is not None:
        return result
    # Return 400/404 for invalid format or unknown teams (re-run regex parsing for error messages)
    m = GAME_ID_REGEX.match(game_id)
    if not m:
        return JSONResponse({"error": "Invalid game ID format"}, status_code=400)
    if not TEAM_CODE_MAP.get(m.group(2)) or not TEAM_CODE_MAP.get(m.group(3)):
        return JSONResponse({"error": "Unknown team code"}, status_code=404)
    return JSONResponse({"error": "Game detail not found"}, status_code=404)


# --- Onboarding data (consolidated endpoint) ---


@app.get("/onboarding-data")
def get_onboarding_data():
    """Consolidated data for onboarding — replaces 8 individual API calls with 1."""
    today = load_json("today-games.json")
    if today is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)

    today_date = date.today()

    # All scores (daily-scores.json is already in _JSON_CACHE, so iteration is free)
    scores = load_json("daily-scores.json")
    recent_scores: dict[str, list] = {}
    if scores:
        dates_dict = scores.get("dates", {})
        for d, games in dates_dict.items():
            if d.startswith(str(current_year)):
                recent_scores[d] = games

    # Current month schedule
    current_month = today_date.month
    current_year = today_date.year
    schedule = _get_schedule_for_month(current_month, current_year)

    # Game details for recent 4 days of games (partial failure allowed)
    game_details: dict[str, dict] = {}
    team_name_to_code: dict[str, str] = {}
    for code, team_id in TEAM_CODE_MAP.items():
        kr_name = TEAM_NAME_MAP.get(team_id)
        if kr_name:
            team_name_to_code[kr_name] = code

    seen_game_ids: set[str] = set()
    for i in range(4):
        d = (today_date - timedelta(days=i)).isoformat()
        if d not in recent_scores:
            continue
        for game in recent_scores[d]:
            if game.get("cancelled"):
                continue
            kr_away = game.get("away", "")
            kr_home = game.get("home", "")
            away_code = team_name_to_code.get(kr_away)
            home_code = team_name_to_code.get(kr_home)
            if not away_code or not home_code:
                continue
            game_seq = game.get("gameIdx", 0)
            date_compact = d.replace("-", "")
            game_id = f"{date_compact}-{away_code}{home_code}-{game_seq}"
            if game_id in seen_game_ids:
                continue
            seen_game_ids.add(game_id)
            detail = _build_game_detail(game_id)
            if detail:
                game_details[game_id] = detail

    # Standings
    standings_data = load_json("kbo_standings.json")

    # Score summary for current year
    score_summary = _compute_score_summary(current_year, scores)

    return {
        "todayGames": today,
        "recentScores": recent_scores,
        "schedule": schedule,
        "todayGameDetails": game_details,
        "standings": standings_data.get("rows") if standings_data else None,
        "scoreSummary": score_summary,
    }


# --- Score summary ---


def _compute_score_summary(year: int, scores: Optional[dict]) -> Optional[dict]:
    """Compute score summary for the given year from daily-scores data."""
    if scores is None:
        return None

    # _HISTORICAL_SCORING is imported at module level from shared.scoring_data

    if year in _HISTORICAL_SCORING:
        teams = []
        for team_name, info in sorted(_HISTORICAL_SCORING[year].items()):
            teams.append({
                "teamName": team_name,
                "avgRuns": info["avgRuns"],
                "totalRuns": info["totalRuns"],
                "totalGames": info["totalGames"],
            })
        return {"year": year, "teams": teams}

    dates = scores.get("dates", {})
    team_runs = {}
    team_games = {}
    for date_str, games in dates.items():
        if not date_str.startswith(str(year)):
            continue
        for game in games:
            if game.get("cancelled") or game.get("outcome") is None:
                continue
            team_runs[game["away"]] = team_runs.get(game["away"], 0) + game["awayScore"]
            team_games[game["away"]] = team_games.get(game["away"], 0) + 1
            team_runs[game["home"]] = team_runs.get(game["home"], 0) + game["homeScore"]
            team_games[game["home"]] = team_games.get(game["home"], 0) + 1
    teams = []
    for team in sorted(team_runs):
        games = team_games.get(team, 0)
        teams.append({
            "teamName": team,
            "avgRuns": round(team_runs[team] / games, 1) if games > 0 else 0,
            "totalRuns": team_runs[team],
            "totalGames": games,
        })
    return {"year": year, "teams": teams}


@app.get("/api/score-summary/{year}")
def get_score_summary(year: int):
    data = load_json("daily-scores.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    result = _compute_score_summary(year, data)
    if result is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    return result
