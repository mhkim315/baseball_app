import os
import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from sqlalchemy import create_engine, text

from scripts.fcm_sender import send_fcm
from scripts.apns_sender import send_apns

logger = logging.getLogger("fullcount.push-worker")

# Short code → lowercase team ID (DB stores lowercase)
_SHORT_TO_TEAM = {
    "OB": "doosan", "LG": "lg", "WO": "kiwoom", "SK": "ssg",
    "KT": "kt", "HH": "hanwha", "SS": "samsung", "HT": "kia",
    "LT": "lotte", "NC": "nc",
}

ENABLED = os.getenv("ENABLE_PUSH_NOTIFICATIONS", "").lower() in ("1", "true", "yes")
DATABASE_URL = os.getenv("DATABASE_URL", "")
DRY_RUN = os.getenv("DRY_RUN", "true").lower() in ("1", "true", "yes")

_PREV_STATE: dict[str, dict] = {}
_LAST_WEATHER_PUSH: float = 0
_WEATHER_PUSH_INTERVAL = 1800  # 30 minutes


def _game_key(game: dict) -> str:
    return str(game.get("gameId", ""))


def _has_changed(gid: str, game: dict) -> list[str]:
    prev = _PREV_STATE.get(gid)
    if prev is None:
        return []  # new game — init state silently
    events = []
    if prev.get("status") != game.get("status"):
        events.append("status")
    prev_score = prev.get("score") or {}
    cur_score = game.get("score") or {}
    if prev_score.get("home") != cur_score.get("home") or prev_score.get("away") != cur_score.get("away"):
        events.append("score")
    prev_relay = prev.get("relay") or {}
    cur_relay = game.get("relay") or {}
    if prev_relay.get("inning") != cur_relay.get("inning") or prev_relay.get("isTop") != cur_relay.get("isTop"):
        events.append("inning")
    return events


def _parse_score_event(texts: list[dict]) -> str:
    """Extract batter + hit type and scoring runners from text relay entries.
    Only uses entries from the majority inning to avoid mixing innings."""
    if not texts:
        return ""
    # Find the inning where scoring happened (most 홈인 entries are here)
    inn_counts: dict[str, int] = {}
    for t in texts:
        txt = t.get("text", "") if isinstance(t, dict) else str(t)
        if "홈인" in txt and " : " in txt:
            inn = t.get("inn", "0") if isinstance(t, dict) else "0"
            inn_counts[inn] = inn_counts.get(inn, 0) + 1
    if not inn_counts:
        return ""
    score_inn = max(inn_counts, key=inn_counts.get)

    runners: list[str] = []
    hitter: str = ""
    found_homein = False
    for t in reversed(texts):
        txt = t.get("text", "") if isinstance(t, dict) else str(t)
        inn = t.get("inn", "0") if isinstance(t, dict) else "0"
        if inn != score_inn or " : " not in txt:
            continue
        left, right = txt.split(" : ", 1)
        if "홈인" in right:
            found_homein = True
            name = left.rsplit(" ", 1)[-1] if " " in left else left
            if name not in runners:
                runners.append(name)
        elif found_homein and not hitter:
            # Skip base running entries (도루, 진루 etc.) — only batting results
            if "루주자" not in left:
                hitter = f"{left.strip()} {right.strip()}"
                break
    if not hitter and not runners:
        return ""
    parts: list[str] = []
    if hitter:
        parts.append(hitter)
    if runners:
        parts.append("→ " + "·".join(reversed(runners)) + " 홈인")
    return " ".join(parts)


def _build_payload(game: dict, event: str = "") -> dict:
    score = game.get("score") or {}
    relay = game.get("relay") or {}
    from datetime import datetime, timezone

    # Pitcher/batter names
    pitcher = (relay.get("pitcher") or {}).get("name", "")
    batter = (relay.get("batter") or {}).get("name", "")

    # Score description from textRelays
    score_desc = ""
    if event == "score":
        score_desc = _parse_score_event(relay.get("textRelays", []))

    return {
        "type": "game_update",
        "event": event,
        "game_id": game.get("gameId", ""),
        "home_team": game.get("homeTeam", ""),
        "away_team": game.get("awayTeam", ""),
        "home_name": game.get("homeName") or game.get("homeTeam", ""),
        "away_name": game.get("awayName") or game.get("awayTeam", ""),
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
        "current_pitcher": pitcher,
        "current_batter": batter,
        "score_desc": score_desc,
        "status": game.get("status", ""),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def run_push_worker(widget_data_func, db_engine=None):
    global _LAST_WEATHER_PUSH
    if not ENABLED:
        return

    try:
        data = widget_data_func()
    except Exception as e:
        logger.warning("push_worker: failed to get widget data — %s", e)
        return

    games = data.get("games", []) if isinstance(data, dict) else []
    live_games = [g for g in games if g.get("status") == "live"]

    scheduled_games = [g for g in games if g.get("status") == "scheduled"]

    if not live_games:
        # Weather refresh push for scheduled games (every 30 min)
        if scheduled_games and time.time() - _LAST_WEATHER_PUSH > _WEATHER_PUSH_INTERVAL:
            _LAST_WEATHER_PUSH = time.time()
            engine = db_engine or create_engine(DATABASE_URL)
            for game in scheduled_games:
                gid = _game_key(game)
                home_team = _SHORT_TO_TEAM.get(game.get("homeTeam", ""), game.get("homeTeam", ""))
                away_team = _SHORT_TO_TEAM.get(game.get("awayTeam", ""), game.get("awayTeam", ""))
                payload = _build_payload(game)
                android_tokens, ios_tokens = [], []
                try:
                    with engine.connect() as conn:
                        rows = conn.execute(
                            text("SELECT token FROM device_tokens WHERE platform = 'android' AND target_team_id IN (:h, :a)"),
                            {"h": home_team, "a": away_team},
                        ).fetchall()
                        android_tokens = [r[0] for r in rows]
                except Exception as e:
                    logger.warning("push_worker: token query failed — %s", e)
                    continue
                if not android_tokens:
                    continue
                with ThreadPoolExecutor(max_workers=8) as ex:
                    for tok in android_tokens:
                        ex.submit(send_fcm, tok, payload, DRY_RUN)
            if db_engine is None:
                engine.dispose()
            logger.info("push_worker: weather refresh — %d scheduled games dispatched", len(scheduled_games))
        return

    changed = []
    for game in live_games:
        gid = _game_key(game)
        events = _has_changed(gid, game)
        if events:
            for event in events:
                changed.append((game, event))
        _PREV_STATE[gid] = game  # 첫 감지 시에도 반드시 상태 저장

    if not changed:
        return

    logger.info("push_worker: %d live game(s) changed — dispatching", len(changed))

    engine = db_engine or create_engine(DATABASE_URL)

    for game, event in changed:
        gid = _game_key(game)
        home_team = _SHORT_TO_TEAM.get(game.get("homeTeam", ""), game.get("homeTeam", ""))
        away_team = _SHORT_TO_TEAM.get(game.get("awayTeam", ""), game.get("awayTeam", ""))

        payload = _build_payload(game, event)
        logger.info("push_worker: change detected %s (%s) — %s vs %s (score %s:%s)",
                     gid, event, away_team, home_team,
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
        invalid_tokens: list[str] = []
        with ThreadPoolExecutor(max_workers=8) as ex:
            futs = {}
            for tok in android_tokens:
                futs[ex.submit(send_fcm, tok, payload, DRY_RUN)] = tok
            for tok in ios_tokens:
                futs[ex.submit(send_apns, tok, payload, DRY_RUN)] = tok
            for f in as_completed(futs):
                try:
                    result = f.result()
                    if result == "unregistered":
                        invalid_tokens.append(futs[f])
                except Exception:
                    pass  # errors already logged in senders

        # Clean up unregistered tokens
        if invalid_tokens:
            try:
                with engine.connect() as conn:
                    for tok in invalid_tokens:
                        conn.execute(text("DELETE FROM device_tokens WHERE token = :t"), {"t": tok})
                    conn.commit()
                logger.info("push_worker: deleted %d unregistered tokens", len(invalid_tokens))
            except Exception as e:
                logger.warning("push_worker: token cleanup failed — %s", e)

    if db_engine is None:
        engine.dispose()
