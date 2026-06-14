import os
import json
import time
import logging
import subprocess
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import urllib.request
import urllib.parse
import ssl

KST = timezone(timedelta(hours=9))
DB_URL = "postgresql://fullcount_user:fullcount_pass_2026@localhost/fullcount_db"
UA = "Mozilla/5.0 (X11; Linux x86_64) KBO/1.0"
REPO_DIR = os.path.expanduser("~/fullcount_backend/repo")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.expanduser("~/fullcount_backend/collector.log")),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

engine = create_engine(DB_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_kst_now():
    return datetime.now(KST)


def fetch_json(url, method="GET", data=None, headers=None):
    if headers is None:
        headers = {"User-Agent": UA}
    if data and isinstance(data, dict):
        data = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            return json.loads(resp.read().decode("utf-8", errors="replace"))
    except Exception as e:
        logger.error(f"API fail ({url}): {e}")
        return None


def update_standings():
    url = f"https://api-gw.sports.naver.com/kbaseball/record/standings?category=kbo&year={get_kst_now().year}"
    data = fetch_json(url)
    if not data or not data.get("success"):
        return
    standings = data.get("result", {}).get("standings", [])
    db = SessionLocal()
    try:
        for s in standings:
            db.execute(text("""
                INSERT INTO standings (team_id, rank, games_played, wins, losses, draws, win_rate, game_back, last_10, streak)
                VALUES (:tid, :rank, :gp, :w, :l, :d, :wr, :gb, :l10, :stk)
                ON CONFLICT (team_id) DO UPDATE SET
                    rank = EXCLUDED.rank, games_played = EXCLUDED.games_played,
                    wins = EXCLUDED.wins, losses = EXCLUDED.losses, draws = EXCLUDED.draws,
                    win_rate = EXCLUDED.win_rate, game_back = EXCLUDED.game_back,
                    last_10 = EXCLUDED.last_10, streak = EXCLUDED.streak
            """), {"tid": s.get("teamCode"), "rank": s.get("rank"), "gp": s.get("gameCount"), "w": s.get("won"), "l": s.get("lost"), "d": s.get("drawn"), "wr": s.get("winRate"), "gb": s.get("gameBehind"), "l10": s.get("recentGame"), "stk": s.get("streak")})
        db.commit()
        logger.info("standings updated")
    except Exception as e:
        logger.error(f"standings update fail: {e}")
        db.rollback()
    finally:
        db.close()


def get_today_games():
    today = get_kst_now().strftime("%Y%m%d")
    url = "https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList"
    data = fetch_json(url, method="POST", data={"leId": 1, "srId": 0, "date": today}, headers={
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Referer": "https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx",
        "User-Agent": UA
    })
    if data and data.get("code") == "100":
        return data.get("game", [])
    return []


def update_score(game, g_time=None):
    game_id = game.get("G_ID")
    if not game_id:
        return
    url = "https://www.koreabaseball.com/ws/Schedule.asmx/GetGameScore"
    data = fetch_json(url, method="POST", data={"leId": 1, "srId": 0, "gameId": game_id}, headers={
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Referer": "https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx",
        "User-Agent": UA
    })
    if not data:
        return
    try:
        away_score = data.get("visitTeamScore")
        home_score = data.get("homeTeamScore")
        if away_score is None:
            away_score = data.get("homeTeamScore")
        if home_score is None:
            home_score = data.get("visitTeamScore")
        status = data.get("gameStatus") or "scheduled"
        db = SessionLocal()
        set_clauses = ["home_score = :hs", "away_score = :as", "status = :st"]
        params = {"hs": home_score, "as": away_score, "st": status, "gid": game_id}
        if g_time is not None:
            set_clauses.append("time = CAST(:tm AS time)")
            params["tm"] = g_time
        db.execute(text(f"UPDATE games SET {', '.join(set_clauses)} WHERE id = :gid"), params)
        db.commit()
        db.close()
        logger.info(f"score {game_id}: {away_score} - {home_score} (away - home)")
    except Exception as e:
        logger.error(f"score update fail ({game_id}): {e}")


def update_lineup(game):
    game_id = game.get("G_ID")
    if not game_id:
        return
    url = "https://www.koreabaseball.com/ws/Schedule.asmx/GetLineUpAnalysis"
    data = fetch_json(url, method="POST", data={"leId": 1, "srId": 0, "seasonId": get_kst_now().year, "gameId": game_id}, headers={
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Referer": "https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx",
        "User-Agent": UA
    })
    confirmed = False
    if data and isinstance(data, list) and len(data) > 0 and data[0]:
        try:
            ck = json.loads(data[0][0]) if isinstance(data[0][0], str) else data[0][0]
            confirmed = ck.get("LINEUP_CK", False)
        except:
            pass
    if confirmed:
        logger.info(f"lineup confirmed {game_id}")
    else:
        logger.info(f"lineup waiting {game_id}")


def regenerate_json_files():
    logger.info("regenerating JSON files...")
    try:
        result = subprocess.run(
            ["python3", "scripts/update_hub_data.py"],
            cwd=REPO_DIR, capture_output=True, text=True, timeout=120
        )
        for line in result.stdout.split("\n"):
            stripped = line.strip()
            if stripped:
                logger.info(f"  {stripped}")
        if result.returncode != 0:
            logger.error(f"JSON regenerate fail (exit {result.returncode})")
            if result.stderr:
                logger.error(f"  err: {result.stderr[-300:]}")
        else:
            logger.info("JSON files regenerated")
    except subprocess.TimeoutExpired:
        logger.error("JSON regenerate timeout")
    except Exception as e:
        logger.error(f"JSON regenerate error: {e}")


def collect():
    now = get_kst_now()
    logger.info(f"collect start: {now.isoformat()}")
    if now.minute < 5:
        update_standings()
    games = get_today_games()
    if games:
        for g in games:
            gtime_str = g.get("G_TIME", "18:30")
            # Always sync time from KBO API (reliable source), not just active window
            update_game_time(g.get("G_ID"), gtime_str)
            try:
                parts = gtime_str.split(":")
                gtime = now.replace(hour=int(parts[0]), minute=int(parts[1]), second=0)
            except:
                gtime = now.replace(hour=18, minute=30)
            if gtime - timedelta(hours=2) <= now <= gtime + timedelta(hours=4):
                update_score(g, g_time=gtime_str)
                update_lineup(g)
            elif now.hour >= 22:
                logger.info("checking next day starters...")
    regenerate_json_files()
    patch_today_games_times()
    logger.info("collect done")




def update_game_time(game_id, time_str):
    """Update only the time column in DB for a given game."""
    if not game_id or not time_str:
        return
    try:
        db = SessionLocal()
        db.execute(
            text("UPDATE games SET time = CAST(:tm AS time) WHERE id = :gid"),
            {"tm": time_str, "gid": game_id}
        )
        db.commit()
        db.close()
    except Exception as e:
        logger.error(f"time update fail ({game_id}): {e}")


def patch_today_games_times():
    """Patch today-games.json games[] times from DB (today only)."""
    json_path = os.path.expanduser("~/fullcount_backend/repo/data/today-games.json")
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        logger.warning(f"patch_today_games_times: cannot read today-games.json: {e}")
        return

    db = SessionLocal()
    try:
        for game in data.get("games", []):
            game_id = game.get("id", "")
            if not game_id:
                continue
            row = db.execute(
                text("SELECT time::text FROM games WHERE id = :gid"),
                {"gid": game_id}
            ).fetchone()
            if row and row[0]:
                game["time"] = row[0].strip()
                logger.info(f"patched time {game_id}: {game['time']}")
    except Exception as e:
        logger.error(f"patch_today_games_times error: {e}")
    finally:
        db.close()

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    logger.info("today-games.json time patched (nextGames times preserved from Naver)")


if __name__ == "__main__":
    collect()
