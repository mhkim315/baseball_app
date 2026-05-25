import re
import json
import os
import random
import logging
from datetime import datetime, timedelta, date, time
from pathlib import Path
from collections import defaultdict

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import create_engine, text

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("fullcount")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://fullcount_user:CHANGE_ME@localhost/fullcount_db")
engine = create_engine(DATABASE_URL)

DATA_DIR = Path(os.getenv("DATA_DIR", "/home/opc/fullcount_backend/repo/data"))

app = FastAPI(title="Fullcount API")


# --- Rate limiting ---

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests=100, window_seconds=60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window = timedelta(seconds=window_seconds)
        self.requests: dict[str, list[datetime]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        forwarded = request.headers.get("x-forwarded-for", "")
        client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
        now = datetime.now()
        window_start = now - self.window
        ip_requests = self.requests[client_ip]
        ip_requests[:] = [t for t in ip_requests if t > window_start]
        if len(ip_requests) >= self.max_requests:
            return JSONResponse(
                {"error": "Rate limit exceeded. Try again later."},
                status_code=429,
            )
        ip_requests.append(now)
        return await call_next(request)

app.add_middleware(RateLimitMiddleware, max_requests=100, window_seconds=60)


# --- Helpers ---

def serialize_row(row):
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, date):
            d[k] = v.isoformat()
        elif isinstance(v, time):
            d[k] = v.strftime("%H:%M")
    return d


def load_json(filename):
    path = DATA_DIR / filename
    if not path.exists():
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
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
    next_interval = random.randint(180, 300)
    next_run_time = datetime.now() + timedelta(seconds=next_interval)
    scheduler.add_job(scheduled_collect, "date", run_date=next_run_time)


scheduler.add_job(scheduled_collect, "date", run_date=datetime.now() + timedelta(seconds=10))
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


@app.get("/schedule/{month}")
def get_schedule_by_month(month: int, year: int = None):
    if month < 1 or month > 12:
        return JSONResponse({"error": "Invalid month. Must be 1-12"}, status_code=400)

    if year is not None:
        path = DATA_DIR / "seasons" / str(year) / "regular-season.json"
        if not path.exists():
            return JSONResponse({"error": "Data not found"}, status_code=404)
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
                        "date": ds,
                        "month": m,
                        "day": d,
                        "venue": g.get("venue", ""),
                        "away": g.get("away", ""),
                        "home": g.get("home", ""),
                        "time": g.get("time"),
                    })
        return {"year": year, "month": month, "games": result}

    year = date.today().year
    data = load_json(f"kbo_schedule_{year}.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    games = [g for g in data.get("games", []) if g.get("month") == month]
    return {"year": data.get("year"), "month": month, "games": games}

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


@app.get("/game-detail/{game_id}")
def get_game_detail(game_id: str):
    m = GAME_ID_REGEX.match(game_id)
    if not m:
        return JSONResponse({"error": "Invalid game ID format"}, status_code=400)
    date_str_raw = m.group(1)
    date_str = f"{date_str_raw[:4]}-{date_str_raw[4:6]}-{date_str_raw[6:8]}"
    away_code = m.group(2)
    home_code = m.group(3)

    away_team = TEAM_CODE_MAP.get(away_code)
    home_team = TEAM_CODE_MAP.get(home_code)
    if not away_team or not home_team:
        return JSONResponse({"error": "Unknown team code"}, status_code=404)

    today = load_json("today-games.json")
    game_data = None
    if today:
        for g in today.get("games", []):
            if g.get("id") == game_id:
                game_data = g
                break

    if not game_data:
        scores = load_json("daily-scores.json")
        if scores and date_str in scores.get("dates", {}):
            for g in scores["dates"][date_str]:
                if g.get("gameId") == game_id:
                    game_data = g
                    break
            if not game_data:
                home_kr = TEAM_NAME_MAP.get(home_team)
                away_kr = TEAM_NAME_MAP.get(away_team)
                for g in scores["dates"][date_str]:
                    if g.get("home") == home_kr and g.get("away") == away_kr:
                        game_data = g
                        break

    lineup = {"home": [], "away": []}
    starters = {"home": None, "away": None}
    score_board = None
    pitching_result = []
    etc_records = []
    lineup_confirmed = False

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
                        if sp and sp.get("name"):
                            starters[side] = sp
                except (json.JSONDecodeError, KeyError):
                    pass
        elif len(lineup[side]) > 0:
            lineup_confirmed = True

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
        if pr:
            result["pitchingResult"] = pr

    if game_data:
        if isinstance(game_data.get("away"), dict):
            result["gameInfo"] = {
                "time": game_data.get("time"),
                "venue": game_data.get("venue"),
                "status": game_data.get("status"),
            }
            if "score" in game_data:
                result["score"] = game_data["score"]
        else:
            result["gameInfo"] = {
                "time": game_data.get("gtime") or game_data.get("time", "18:30"),
                "venue": game_data.get("stadium") or game_data.get("venue", ""),
                "status": "finished" if game_data.get("awayScore") is not None else "scheduled",
            }
            if game_data.get("awayScore") is not None:
                result["score"] = {
                    "away": game_data["awayScore"],
                    "home": game_data["homeScore"],
                }

    return result


# --- Score summary (cached) ---


_HISTORICAL_SCORING = {
  2020: {
    "KIA": {"avgRuns": 4.9, "totalRuns": 430, "totalGames": 87},
    "KT": {"avgRuns": 5.7, "totalRuns": 492, "totalGames": 87},
    "LG": {"avgRuns": 5.9, "totalRuns": 534, "totalGames": 91},
    "NC": {"avgRuns": 6.2, "totalRuns": 531, "totalGames": 86},
    "SK": {"avgRuns": 4.3, "totalRuns": 384, "totalGames": 90},
    "두산": {"avgRuns": 5.9, "totalRuns": 528, "totalGames": 90},
    "롯데": {"avgRuns": 5.0, "totalRuns": 428, "totalGames": 85},
    "삼성": {"avgRuns": 4.9, "totalRuns": 443, "totalGames": 90},
    "키움": {"avgRuns": 5.5, "totalRuns": 511, "totalGames": 93},
    "한화": {"avgRuns": 3.5, "totalRuns": 312, "totalGames": 89},
  },
  2021: {
    "KIA": {"avgRuns": 4.0, "totalRuns": 302, "totalGames": 76},
    "KT": {"avgRuns": 5.3, "totalRuns": 412, "totalGames": 78},
    "LG": {"avgRuns": 4.7, "totalRuns": 364, "totalGames": 77},
    "NC": {"avgRuns": 5.5, "totalRuns": 423, "totalGames": 77},
    "SSG": {"avgRuns": 5.2, "totalRuns": 424, "totalGames": 82},
    "두산": {"avgRuns": 5.2, "totalRuns": 396, "totalGames": 76},
    "롯데": {"avgRuns": 5.3, "totalRuns": 424, "totalGames": 80},
    "삼성": {"avgRuns": 5.2, "totalRuns": 425, "totalGames": 82},
    "키움": {"avgRuns": 5.3, "totalRuns": 439, "totalGames": 83},
    "한화": {"avgRuns": 3.9, "totalRuns": 317, "totalGames": 81},
  },
  2022: {
    "KIA": {"avgRuns": 5.2, "totalRuns": 485, "totalGames": 94},
    "KT": {"avgRuns": 4.5, "totalRuns": 417, "totalGames": 93},
    "LG": {"avgRuns": 5.1, "totalRuns": 479, "totalGames": 94},
    "NC": {"avgRuns": 4.1, "totalRuns": 381, "totalGames": 92},
    "SSG": {"avgRuns": 4.9, "totalRuns": 471, "totalGames": 96},
    "두산": {"avgRuns": 4.7, "totalRuns": 430, "totalGames": 91},
    "롯데": {"avgRuns": 4.1, "totalRuns": 398, "totalGames": 96},
    "삼성": {"avgRuns": 4.3, "totalRuns": 407, "totalGames": 94},
    "키움": {"avgRuns": 4.2, "totalRuns": 411, "totalGames": 97},
    "한화": {"avgRuns": 4.1, "totalRuns": 388, "totalGames": 95},
  },
  2023: {
    "KIA": {"avgRuns": 4.6, "totalRuns": 392, "totalGames": 85},
    "KT": {"avgRuns": 4.7, "totalRuns": 427, "totalGames": 91},
    "LG": {"avgRuns": 5.0, "totalRuns": 302, "totalGames": 60},
    "NC": {"avgRuns": 4.7, "totalRuns": 410, "totalGames": 88},
    "SSG": {"avgRuns": 4.7, "totalRuns": 276, "totalGames": 59},
    "두산": {"avgRuns": 4.1, "totalRuns": 243, "totalGames": 59},
    "롯데": {"avgRuns": 4.3, "totalRuns": 379, "totalGames": 88},
    "삼성": {"avgRuns": 4.3, "totalRuns": 394, "totalGames": 91},
    "키움": {"avgRuns": 4.2, "totalRuns": 265, "totalGames": 63},
    "한화": {"avgRuns": 4.2, "totalRuns": 366, "totalGames": 88},
  },
  2024: {
    "KIA": {"avgRuns": 6.1, "totalRuns": 546, "totalGames": 90},
    "KT": {"avgRuns": 5.3, "totalRuns": 481, "totalGames": 91},
    "LG": {"avgRuns": 5.4, "totalRuns": 501, "totalGames": 93},
    "NC": {"avgRuns": 5.4, "totalRuns": 477, "totalGames": 89},
    "SSG": {"avgRuns": 5.2, "totalRuns": 477, "totalGames": 91},
    "두산": {"avgRuns": 5.4, "totalRuns": 506, "totalGames": 94},
    "롯데": {"avgRuns": 5.4, "totalRuns": 474, "totalGames": 87},
    "삼성": {"avgRuns": 5.0, "totalRuns": 457, "totalGames": 91},
    "키움": {"avgRuns": 4.8, "totalRuns": 420, "totalGames": 88},
    "한화": {"avgRuns": 5.1, "totalRuns": 462, "totalGames": 90},
  },
  2025: {
    "KIA": {"avgRuns": 4.9, "totalRuns": 430, "totalGames": 88},
    "KT": {"avgRuns": 4.4, "totalRuns": 402, "totalGames": 91},
    "LG": {"avgRuns": 5.1, "totalRuns": 458, "totalGames": 90},
    "NC": {"avgRuns": 4.7, "totalRuns": 401, "totalGames": 85},
    "SSG": {"avgRuns": 4.1, "totalRuns": 354, "totalGames": 87},
    "두산": {"avgRuns": 4.4, "totalRuns": 384, "totalGames": 88},
    "롯데": {"avgRuns": 4.8, "totalRuns": 440, "totalGames": 91},
    "삼성": {"avgRuns": 5.1, "totalRuns": 451, "totalGames": 88},
    "키움": {"avgRuns": 3.7, "totalRuns": 334, "totalGames": 91},
    "한화": {"avgRuns": 4.7, "totalRuns": 414, "totalGames": 89},
  },
}


@app.get("/api/score-summary/{year}")
def get_score_summary(year: int):
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

    data = load_json("daily-scores.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)

    dates = data.get("dates", {})
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
