import os
import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from sqlalchemy import create_engine, text

from scripts.fcm_sender import send_fcm
from scripts.apns_sender import send_apns

logger = logging.getLogger("fullcount.push-worker")

# ── Relay log: captures every poll cycle's relay data for timing analysis ──
_RELAY_LOG_ENABLED = os.getenv("RELAY_LOG_ENABLED", "").lower() in ("1", "true", "yes")
_PUSH_LOG_ENABLED = os.getenv("PUSH_LOG_ENABLED", "").lower() in ("1", "true", "yes")
_RELAY_LOG_DIR = os.getenv("RELAY_LOG_DIR", "/home/opc/fullcount_backend/logs")

from datetime import datetime, timezone

def _log_relay_snapshots(games: list):
    """Write relay snapshot for each game to a JSONL file (one per day)."""
    if not _RELAY_LOG_ENABLED:
        return
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        os.makedirs(_RELAY_LOG_DIR, exist_ok=True)
        path = os.path.join(_RELAY_LOG_DIR, f"relay_log_{today}.jsonl")
        ts = datetime.now(timezone.utc).isoformat()
        for g in games:
            relay = g.get("relay") or {}
            text_relays = relay.get("textRelays", [])
            entry = {
                "ts": ts,
                "game_id": g.get("gameId", ""),
                "status": g.get("status", ""),
                "home_score": (g.get("score") or {}).get("home", 0),
                "away_score": (g.get("score") or {}).get("away", 0),
                "inning": relay.get("inning", "0"),
                "is_top": relay.get("isTop", "0"),
                "pitcher": (relay.get("pitcher") or {}).get("name", ""),
                "batter": (relay.get("batter") or {}).get("name", ""),
                "textRelays": text_relays[-5:] if len(text_relays) > 5 else text_relays,
            }
            with open(path, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception as e:
        logger.warning("relay_log: write failed — %s", e)


def _log_push_dispatch(game: dict, event: str, payload: dict, subscriber_count: int):
    """Log dispatched push notification for cross-referencing with relay log."""
    if not _PUSH_LOG_ENABLED:
        return
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        os.makedirs(_RELAY_LOG_DIR, exist_ok=True)
        path = os.path.join(_RELAY_LOG_DIR, f"push_log_{today}.jsonl")
        entry = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "game_id": game.get("gameId", ""),
            "event": event,
            "subscribers": subscriber_count,
            "payload": {
                k: payload.get(k) for k in (
                    "home_score", "away_score", "home_name", "away_name",
                    "inning", "is_top", "current_pitcher", "current_batter",
                    "scoring_team", "score_desc",
                )
            },
        }
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception as e:
        logger.warning("push_log: write failed — %s", e)


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
_TEAM_INNING_LAST: dict[str, dict[str, str]] = {}  # gid -> {"home": pcode, "away": pcode}
_DETECTED_SCORING: dict[str, str] = {}  # gid -> scoring_team (saved before _PREV_STATE overwrite)
_LAST_PB: dict[str, dict[str, str]] = {}  # gid -> {"pitcher": name, "batter": name} — fallback when relay missing
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
        # Ignore score decreases (Daum/Naver merge race condition)
        cur_h, cur_a = int(cur_score.get("home", 0) or 0), int(cur_score.get("away", 0) or 0)
        prev_h, prev_a = int(prev_score.get("home", 0) or 0), int(prev_score.get("away", 0) or 0)
        if cur_h >= prev_h and cur_a >= prev_a:
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
    # No 홈인 found — use the most recent inning as fallback
    if not inn_counts:
        last_inn = "0"
        for t in reversed(texts):
            inn = t.get("inn", "0") if isinstance(t, dict) else "0"
            txt = t.get("text", "") if isinstance(t, dict) else str(t)
            if inn != "0" and " : " in txt and "루주자" not in txt.split(" : ")[0]:
                last_inn = inn
                break
        if last_inn == "0":
            return ""
        score_inn = last_inn
    else:
        score_inn = max(inn_counts, key=inn_counts.get)

    # Collect all 홈인 runners and the most recent hit from the scoring inning
    runners: list[str] = []
    hitter: str = ""
    for t in reversed(texts):
        txt = t.get("text", "") if isinstance(t, dict) else str(t)
        inn = t.get("inn", "0") if isinstance(t, dict) else "0"
        if inn != score_inn or " : " not in txt:
            continue
        left, right = txt.split(" : ", 1)
        if "홈인" in right:
            name = left.rsplit(" ", 1)[-1] if " " in left else left
            if name not in runners:
                runners.append(name)
        elif not hitter and "루주자" not in left:
            # Most recent non-루주자 batting result (may or may not be the scoring hit)
            hitter = f"{left.strip()} {right.strip()}"
    if not hitter and not runners:
        return ""
    parts: list[str] = []
    if hitter:
        parts.append(hitter)
    if runners:
        runners.reverse()
        parts.append("→ " + "·".join(runners) + " 홈인")
    return " ".join(parts)


def _track_inning_last_batter(gid: str, prev_game: dict):
    """Save the last batter for the team that just finished batting (before _PREV_STATE overwrite)."""
    prev_relay = prev_game.get("relay") or {}
    prev_batter = prev_relay.get("batter") or {}
    prev_pcode = prev_batter.get("id", "")
    prev_is_top = prev_relay.get("isTop", "0")
    if not prev_pcode:
        return
    team_key = "away" if prev_is_top == "1" else "home"
    _TEAM_INNING_LAST.setdefault(gid, {})[team_key] = prev_pcode


def _get_next_batter(game: dict) -> str:
    """For inning-start events, determine the next batter from the batting order."""
    relay = game.get("relay") or {}
    is_top = relay.get("isTop", "0")
    gid = game.get("gameId", "")

    team_key = "away" if is_top == "1" else "home"
    batters_key = "awayBatters" if is_top == "1" else "homeBatters"
    batters = relay.get(batters_key, [])

    if not batters:
        return ""

    last_pcode = _TEAM_INNING_LAST.get(gid, {}).get(team_key, "")
    if not last_pcode:
        return batters[0].get("name", "")  # no history → leadoff

    for i, b in enumerate(batters):
        if b.get("pcode") == last_pcode:
            next_idx = (i + 1) % len(batters)
            return batters[next_idx].get("name", "")

    return batters[0].get("name", "")  # pcode not in lineup (substitution) → leadoff


def _build_payload(game: dict, event: str = "") -> dict:
    score = game.get("score") or {}
    relay = game.get("relay") or {}

    # Pitcher/batter — for inning-start, compute next batter from lineup
    gid = game.get("gameId", "")
    pitcher = (relay.get("pitcher") or {}).get("name", "")
    batter = (relay.get("batter") or {}).get("name", "")
    if event == "inning":
        next_batter = _get_next_batter(game)
        if next_batter:
            batter = next_batter

    # Fallback to last known pitcher/batter when relay is missing them
    last_pb = _LAST_PB.get(gid, {})
    if not pitcher:
        pitcher = last_pb.get("pitcher", "")
    if not batter:
        batter = last_pb.get("batter", "")
    if pitcher or batter:
        _LAST_PB[gid] = {"pitcher": pitcher, "batter": batter}

    # Scoring team — pre-computed during detection (before _PREV_STATE overwrite)
    scoring_team = ""
    if event == "score":
        gid = game.get("gameId", "")
        scoring_team = _DETECTED_SCORING.pop(gid, "")

    # Score description — parsed from textRelays (experimental, currently unused)
    score_desc = ""

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
        "scoring_team": scoring_team,
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

    # Log relay snapshots every poll cycle for timing analysis
    _log_relay_snapshots(live_games)

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
            prev_game = _PREV_STATE.get(gid)
            for event in events:
                if event == "inning" and prev_game:
                    _track_inning_last_batter(gid, prev_game)
                elif event == "score" and prev_game:
                    prev_s = prev_game.get("score") or {}
                    cur_s = game.get("score") or {}
                    if cur_s.get("home", 0) > prev_s.get("home", 0):
                        _DETECTED_SCORING[gid] = game.get("homeName") or game.get("homeTeam", "")
                    elif cur_s.get("away", 0) > prev_s.get("away", 0):
                        _DETECTED_SCORING[gid] = game.get("awayName") or game.get("awayTeam", "")
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

        subscriber_count = len(android_tokens) + len(ios_tokens)
        _log_push_dispatch(game, event, payload, subscriber_count)

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
