"""
Fix server/main.py: security & maintainability improvements.
1. DB password → environment variable
2. Rate limiter: X-Forwarded-For support
3. Exception logging
4. Hardcoded year → dynamic
"""

FIXES = r"""
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("fullcount")


# --- Patch 1: DATABASE_URL from env ---

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://fullcount_user:fullcount_pass_2026@localhost/fullcount_db")
engine = create_engine(DATABASE_URL)

DATA_DIR = Path(os.getenv("DATA_DIR", "/home/opc/fullcount_backend/repo/data"))

app = FastAPI(title="Fullcount API")
"""

RATE_LIMITER_FIX = """
    async def dispatch(self, request: Request, call_next):
        forwarded = request.headers.get("x-forwarded-for", "")
        client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
"""

EXCEPTION_HANDLER_FIX = """
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception in %s %s", request.method, request.url.path)
    return JSONResponse(
        {"error": "Internal server error"},
        status_code=500,
    )
"""

SCHEDULE_FIX = """
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
"""

EXHIBITION_FIX = """
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
"""


import re

path = "/home/opc/fullcount_backend/main.py"

with open(path, "r") as f:
    content = f.read()

changes = []

# --- Fix 1: DATABASE_URL + logging setup (lines 1-20) ---
old_header = """import re
import json
import os
import random
from datetime import datetime, timedelta, date, time
from pathlib import Path
from collections import defaultdict

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://fullcount_user:fullcount_pass_2026@localhost/fullcount_db"
engine = create_engine(DATABASE_URL)

DATA_DIR = Path("/home/opc/fullcount_backend/repo/data")

app = FastAPI(title="Fullcount API")"""

new_header = """import re
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

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://fullcount_user:fullcount_pass_2026@localhost/fullcount_db")
engine = create_engine(DATABASE_URL)

DATA_DIR = Path(os.getenv("DATA_DIR", "/home/opc/fullcount_backend/repo/data"))

app = FastAPI(title="Fullcount API")"""

assert old_header in content, "Header block not found!"
content = content.replace(old_header, new_header, 1)
changes.append("1. DATABASE_URL → os.getenv, added logging import + logger")

# --- Fix 2: Rate limiter IP ---
old_rate = """        client_ip = request.client.host if request.client else "unknown\""""
new_rate = """        forwarded = request.headers.get("x-forwarded-for", "")
        client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")"""

assert old_rate in content, "Rate limiter block not found!"
content = content.replace(old_rate, new_rate, 1)
changes.append("2. Rate limiter: X-Forwarded-For support")

# --- Fix 3: Exception handler ---
old_exc = """@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        {"error": "Internal server error"},
        status_code=500,
    )"""

assert old_exc in content, "Exception handler not found!"
content = content.replace(old_exc, EXCEPTION_HANDLER_FIX.strip(), 1)
changes.append("3. Exception handler: added logging")

# --- Fix 4: Schedule year hardcoding ---

# Replace get_schedule()
old_schedule = """@app.get("/schedule")
def get_schedule():
    data = load_json("kbo_schedule_2026.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    return data"""

# We need to check if this exact pattern exists
if old_schedule in content:
    # Replace the old simple version with the new one
    new_schedule = """@app.get("/schedule")
def get_schedule(year: int = None):
    if year is None:
        year = date.today().year
    data = load_json(f"kbo_schedule_{year}.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    return data"""
    content = content.replace(old_schedule, new_schedule, 1)
    changes.append("4a. get_schedule: dynamic year")
else:
    changes.append("4a. get_schedule: SKIP (pattern not found)")

# Replace the year default in get_schedule_by_month
old_sched_month_default = """    data = load_json("kbo_schedule_2026.json")"""
# Find the second occurrence (inside get_schedule_by_month, after the year path)
# The first occurrence was in get_schedule which we already replaced
if old_sched_month_default in content:
    new_sched_month_default = """    year = date.today().year
    data = load_json(f"kbo_schedule_{year}.json")"""
    content = content.replace(old_sched_month_default, new_sched_month_default, 1)
    changes.append("4b. get_schedule_by_month: dynamic year")
else:
    changes.append("4b. get_schedule_by_month: SKIP (already replaced by get_schedule fix)")

# Replace exhibition-games
old_exhibition = """    data = load_json("exhibition-games-2026.json")"""
if old_exhibition in content:
    new_exhibition = """    year = date.today().year
    data = load_json(f"exhibition-games-{year}.json")"""
    content = content.replace(old_exhibition, new_exhibition, 1)
    changes.append("4c. exhibition-games: dynamic year")
else:
    changes.append("4c. exhibition-games: SKIP (pattern not found)")

# Clean up the double blank lines that may have been introduced
content = re.sub(r'\n{4,}', '\n\n\n', content)

# Verify syntax
compile(content, path, "exec")

with open(path, "w") as f:
    f.write(content)

print("Fixes applied:")
for c in changes:
    print(f"  {c}")
print("\nSyntax OK. Ready to restart.")
