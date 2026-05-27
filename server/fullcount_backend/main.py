"""
Fullcount.kr Community Backend

Run: uvicorn main:app --host 0.0.0.0 --port 8000
Production: uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
"""

import os
import sys
import logging
from datetime import date
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from shared.scoring_data import _HISTORICAL_SCORING

from database import engine
from models import Base
from limiter import limiter
from auth import router as auth_router
from community import router as community_router
from account import router as account_router

_DAILY_SCORES_CACHE: dict[str, object] = {"data": None, "cached_date": None}
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://fullcount.kr,https://www.fullcount.kr")
origins = [o.strip() for o in ALLOWED_ORIGINS.split(",")] if ALLOWED_ORIGINS != "*" else ["*"]

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title="fullcount.kr Community API",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception in %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Please try again later."},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(community_router)
app.include_router(account_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/score-summary/{year}")
async def get_score_summary(year: int):
    # Past seasons are fully finalized — return hardcoded data
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

    # Current season (2026+) — fetch from external API once per day
    today = date.today()
    if _DAILY_SCORES_CACHE["data"] is None or _DAILY_SCORES_CACHE["cached_date"] != today:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get("https://api.fullcount.kr/daily-scores", timeout=30)
            if resp.status_code != 200:
                return JSONResponse(status_code=502, content={"error": "Data source unavailable"})
            _DAILY_SCORES_CACHE["data"] = resp.json()
            _DAILY_SCORES_CACHE["cached_date"] = today
    dates = _DAILY_SCORES_CACHE["data"].get("dates", {})
    team_runs: dict[str, int] = {}
    team_games: dict[str, int] = {}
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
