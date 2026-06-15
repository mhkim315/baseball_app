import os
import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

from sqlalchemy import create_engine, text

from scripts.fcm_sender import send_fcm
from scripts.apns_sender import send_apns

logger = logging.getLogger("fullcount.push-worker")

ENABLED = os.getenv("ENABLE_PUSH_NOTIFICATIONS", "").lower() in ("1", "true", "yes")
DATABASE_URL = os.getenv("DATABASE_URL", "")
DRY_RUN = os.getenv("DRY_RUN", "true").lower() in ("1", "true", "yes")

_PREV_STATE: dict[str, dict] = {}


def _game_key(game: dict) -> str:
    return str(game.get("gameId", ""))


def _has_changed(gid: str, game: dict) -> bool:
    prev = _PREV_STATE.get(gid)
    if prev is None:
        return True  # new game
    if prev.get("status") != game.get("status"):
        return True
    prev_score = prev.get("score") or {}
    cur_score = game.get("score") or {}
    if prev_score.get("home") != cur_score.get("home") or prev_score.get("away") != cur_score.get("away"):
        return True
    prev_relay = prev.get("relay") or {}
    cur_relay = game.get("relay") or {}
    for field in ("ball", "strike", "out", "base1", "base2", "base3"):
        if prev_relay.get(field) != cur_relay.get(field):
            return True
    return False


def _build_payload(game: dict) -> dict:
    score = game.get("score") or {}
    relay = game.get("relay") or {}
    from datetime import datetime, timezone
    return {
        "type": "game_update",
        "game_id": game.get("gameId", ""),
        "home_score": score.get("home", 0),
        "away_score": score.get("away", 0),
        "inning": relay.get("inning", 0),
        "is_top": relay.get("isTop", False),
        "ball": relay.get("ball", "0"),
        "strike": relay.get("strike", "0"),
        "out": relay.get("out", "0"),
        "base1": relay.get("base1", "0"),
        "base2": relay.get("base2", "0"),
        "base3": relay.get("base3", "0"),
        "status": game.get("status", ""),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def run_push_worker(widget_data_func, db_engine=None):
    if not ENABLED:
        return

    try:
        data = widget_data_func()
    except Exception as e:
        logger.warning("push_worker: failed to get widget data — %s", e)
        return

    games = data.get("games", []) if isinstance(data, dict) else []
    live_games = [g for g in games if g.get("status") == "live"]

    if not live_games:
        return

    changed = []
    for game in live_games:
        gid = _game_key(game)
        if _has_changed(gid, game):
            changed.append(game)
            _PREV_STATE[gid] = game

    if not changed:
        return

    logger.info("push_worker: %d live game(s) changed — dispatching", len(changed))

    engine = db_engine or create_engine(DATABASE_URL)

    for game in changed:
        gid = _game_key(game)
        home_team = game.get("homeTeam", "")
        away_team = game.get("awayTeam", "")
        team_codes = [home_team, away_team]

        payload = _build_payload(game)
        logger.info("push_worker: change detected %s — %s vs %s (score %s:%s)",
                     gid, away_team, home_team,
                     payload["away_score"], payload["home_score"])

        # Fetch subscribed tokens
        android_tokens, ios_tokens = [], []
        try:
            with engine.connect() as conn:
                rows = conn.execute(
                    text("SELECT token FROM device_tokens WHERE platform = 'android' AND target_team_id IN (:h, :a)"),
                    {"h": home_team, "a": away_team},
                ).fetchall()
                android_tokens = [r[0] for r in rows]
                rows = conn.execute(
                    text("SELECT token FROM device_tokens WHERE platform = 'ios' AND target_team_id IN (:h, :a)"),
                    {"h": home_team, "a": away_team},
                ).fetchall()
                ios_tokens = [r[0] for r in rows]
        except Exception as e:
            logger.warning("push_worker: token query failed — %s", e)
            continue

        if not android_tokens and not ios_tokens:
            logger.info("push_worker: no subscribers for %s", gid)
            continue

        # Dispatch
        with ThreadPoolExecutor(max_workers=8) as ex:
            futs = []
            for tok in android_tokens:
                futs.append(ex.submit(send_fcm, tok, payload, DRY_RUN))
            for tok in ios_tokens:
                futs.append(ex.submit(send_apns, tok, payload, DRY_RUN))
            for f in as_completed(futs):
                pass  # errors already logged in senders

    if db_engine is None:
        engine.dispose()
