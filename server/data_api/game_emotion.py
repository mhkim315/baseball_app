"""
Game emotion computation — server-side port of mobile/lib/gameEmotion.ts.

Computes a CharacterEmotion (one of ~27 emotion IDs) for a given team perspective
in a baseball game. Supports:
  - Finished games: inning-by-inning analysis (walk-off, comeback, blowout, etc.)
  - Live games: event-based tracking (within-inning + half-inning end events)
  - Fallback: snapshot-based logic when no events are active

Module-level state (_prev_state, _trackers, _event_cache) persists across
polling cycles, keyed by "gameId_hm" or "gameId_aw".
"""

from typing import Optional

# ── Module-level state (persists across calls within the same process) ──

_prev_state: dict[str, dict] = {}      # "gameId_hm" | "gameId_aw" -> snapshot dict
_trackers: dict[str, dict] = {}        # same key -> half-inning tracker
_event_cache: dict[str, dict] = {}     # same key -> cached event {emotion, expire_inning, is_end_event}


# ── Finished-game helpers ──────────────────────────────────────

def _max_deficit(my_inns: list, opp_inns: list) -> int:
    """Max number of runs we were behind at any point."""
    my_sum = 0
    opp_sum = 0
    worst = 0
    for i in range(max(len(my_inns), len(opp_inns))):
        my_sum += int(my_inns[i]) if i < len(my_inns) and my_inns[i] is not None else 0
        opp_sum += int(opp_inns[i]) if i < len(opp_inns) and opp_inns[i] is not None else 0
        worst = min(worst, my_sum - opp_sum)
    return -worst


def _max_lead(my_inns: list, opp_inns: list) -> int:
    """Max number of runs we led by at any point."""
    my_sum = 0
    opp_sum = 0
    best = 0
    for i in range(max(len(my_inns), len(opp_inns))):
        my_sum += int(my_inns[i]) if i < len(my_inns) and my_inns[i] is not None else 0
        opp_sum += int(opp_inns[i]) if i < len(opp_inns) and opp_inns[i] is not None else 0
        best = max(best, my_sum - opp_sum)
    return best


def _last_inning_scored(inns: list, is_home: bool) -> bool:
    """Did the team score in the final half-inning?"""
    if not inns:
        return False
    last_idx = len(inns) - 1
    return last_idx >= 0 and (int(inns[last_idx]) if inns[last_idx] is not None else 0) > 0


# ── Live-game helpers ───────────────────────────────────────────

def _snap_key(game_id: str, is_my_home: bool) -> str:
    return f"{game_id}_{'hm' if is_my_home else 'aw'}"


def _half_key(inning: int, is_top: bool) -> str:
    return f"{inning}-{'top' if is_top else 'bottom'}"


def _my_batting(is_top: bool, is_my_home: bool) -> bool:
    return is_my_home != is_top


def _bases_loaded(b1: Optional[str], b2: Optional[str], b3: Optional[str]) -> bool:
    return b1 == "1" and b2 == "1" and b3 == "1"


def _has_risp(b2: Optional[str], b3: Optional[str]) -> bool:
    return b2 == "1" or b3 == "1"


def _has_any_runner(b1: Optional[str], b2: Optional[str], b3: Optional[str]) -> bool:
    return b1 == "1" or b2 == "1" or b3 == "1"


def _ensure_snapshot(my_score: int, opp_score: int, inning: int, is_top: bool,
                     base1: Optional[str], base2: Optional[str], base3: Optional[str],
                     my_errors: int, opp_errors: int) -> dict:
    return {
        "my_score": my_score,
        "opp_score": opp_score,
        "inning": inning,
        "is_top": is_top,
        "base1": base1 or "0",
        "base2": base2 or "0",
        "base3": base3 or "0",
        "my_errors": my_errors,
        "opp_errors": opp_errors,
    }


def _detect_within_inning_event(now: dict, prev: dict, is_my_batting: bool, inning: int) -> Optional[str]:
    """Compare current vs previous state. Return emotion for threshold-crossing events, or None."""
    my_scored = now["my_score"] > prev["my_score"]
    opp_scored = now["opp_score"] > prev["opp_score"]
    opp_errors_up = now["opp_errors"] > prev["opp_errors"]
    my_errors_up = now["my_errors"] > prev["my_errors"]
    now_bl = _bases_loaded(now["base1"], now["base2"], now["base3"])
    now_risp = _has_risp(now["base2"], now["base3"])
    prev_bl = _bases_loaded(prev["base1"], prev["base2"], prev["base3"])
    prev_risp = _has_risp(prev["base2"], prev["base3"])

    if is_my_batting:
        if my_scored:
            return "in_love"
        if opp_errors_up:
            return "tongue"
        if now_bl and not prev_bl:
            return "provocative"
        if now_risp and not prev_risp:
            return "joyful"
        # Runner on base (only before 8th inning)
        if inning < 8 and not now_risp and not now_bl:
            now_on = _has_any_runner(now["base1"], now["base2"], now["base3"])
            prev_on = _has_any_runner(prev["base1"], prev["base2"], prev["base3"])
            if now_on and not prev_on:
                return "curious"
    else:
        if opp_scored:
            burst = now["opp_score"] - prev["opp_score"]
            if burst >= 3:
                return "devastated"
            return "angry"
        if my_errors_up:
            return "karen"
        if now_bl and not prev_bl:
            return "extream_shock"
        if now_risp and not prev_risp:
            return "flustered"
        if inning < 8 and not now_risp and not now_bl:
            now_on = _has_any_runner(now["base1"], now["base2"], now["base3"])
            prev_on = _has_any_runner(prev["base1"], prev["base2"], prev["base3"])
            if now_on and not prev_on:
                return "annoyed"

    return None


# ── Finished game emotion ──────────────────────────────────────

def _finished_emotion(diff: int, my_score: int, opp_score: int, inning: int,
                      is_my_home: bool, my_inns: Optional[list], opp_inns: Optional[list]) -> str:
    extra = inning >= 10
    has_inn = my_inns and opp_inns and len(my_inns) > 0 and len(opp_inns) > 0

    if diff > 0:
        walk_off = has_inn and is_my_home and _last_inning_scored(my_inns, True) and inning >= 9
        comeback = _max_deficit(my_inns or [], opp_inns or []) if has_inn else 0
        blowout = diff >= 8
        shutout = opp_score == 0
        close = diff <= 2

        if walk_off and extra:
            return "in_love"
        if walk_off:
            return "in_love"
        if comeback >= 2:
            return "joyful"
        if blowout and shutout:
            return "mocking"
        if blowout:
            return "mocking"
        if shutout:
            return "tongue"
        if close and extra:
            return "determined"
        if close:
            return "thumbs_up"
        return "joyful"

    if diff < 0:
        blown_lead = _max_lead(my_inns or [], opp_inns or []) if has_inn else 0
        walk_off_loss = has_inn and not is_my_home and _last_inning_scored(opp_inns, True) and inning >= 9
        blowout = diff <= -8
        shutout = my_score == 0
        close = diff >= -2

        if walk_off_loss and extra:
            return "devastated"
        if walk_off_loss:
            return "devastated"
        if blown_lead >= 5:
            return "furious"
        if blown_lead >= 2:
            return "angry"
        if blowout and shutout:
            return "resigned_disgust"
        if blowout:
            return "resigned_disgust"
        if shutout:
            return "depressed"
        if close and extra:
            return "crying"
        if close:
            return "sad"
        return "crying"

    # Tie
    if extra:
        return "sleepy"
    return "neutral"


# ── Live snapshot fallback ─────────────────────────────────────

def _live_snapshot_emotion(diff: int, inning: int, is_top: bool, is_my_home: bool,
                           base1: Optional[str], base2: Optional[str], base3: Optional[str]) -> str:
    inning_num = inning or 1
    bases_loaded = _bases_loaded(base1, base2, base3)
    scoring_position = _has_risp(base2, base3)
    opp_has_chances = is_my_home == is_top
    my_chances = is_my_home != is_top

    if diff == 0:
        if inning_num >= 10:
            return "sleepy"
        if opp_has_chances and bases_loaded:
            return "extream_shock"
        if my_chances and bases_loaded:
            return "in_love"
        if inning_num >= 7:
            return "determined"
        return "default"
    if diff >= 5:
        return "mocking"
    if 1 <= diff <= 4:
        if opp_has_chances and scoring_position and diff <= 2:
            return "flustered"
        return "joyful"
    if diff <= -5:
        return "resigned_disgust"
    if -4 <= diff <= -1:
        if inning_num >= 9:
            return "praying"
        if my_chances and scoring_position and diff >= -2:
            return "determined"
        return "sad"
    return "default"


# ── Main entry point ───────────────────────────────────────────

def compute_game_emotion(
    status: str,                       # "scheduled" | "live" | "finished" | "cancelled"
    my_score: int,
    opp_score: int,
    inning: int,
    is_top: bool,
    is_my_home: bool,
    base1: Optional[str] = None,
    base2: Optional[str] = None,
    base3: Optional[str] = None,
    my_inns: Optional[list] = None,
    opp_inns: Optional[list] = None,
    game_id: Optional[str] = None,
    my_errors: int = 0,
    opp_errors: int = 0,
) -> str:
    if status == "cancelled":
        return "rain_cancellation"
    if status == "scheduled":
        return "default"

    diff = my_score - opp_score

    # ── Finished game ──
    if status == "finished":
        return _finished_emotion(diff, my_score, opp_score, inning,
                                 is_my_home, my_inns, opp_inns)

    # ── Live game: event-based + snapshot fallback ──
    if game_id and inning > 0:
        sk = _snap_key(game_id, is_my_home)
        now = _ensure_snapshot(my_score, opp_score, inning, is_top,
                               base1, base2, base3, my_errors, opp_errors)
        prev = _prev_state.get(sk)
        hk = _half_key(inning, is_top)
        my_bat = _my_batting(is_top, is_my_home)

        # ── 1. Half-inning change: finalize previous half-inning ──
        if prev and sk in _trackers and _trackers[sk]["key"] != hk:
            t = _trackers[sk]
            my_runs = now["my_score"] - t["my_runs_before"]
            opp_runs = now["opp_score"] - t["opp_runs_before"]
            was_my_bat = _my_batting(prev["is_top"], is_my_home)

            if was_my_bat:
                if my_runs == 0 and t["had_bases_loaded"]:
                    _event_cache[sk] = {"emotion": "furious", "expire_inning": inning + 1, "is_end_event": True}
                elif my_runs == 0 and t["had_risp"]:
                    _event_cache[sk] = {"emotion": "angry", "expire_inning": inning + 1, "is_end_event": True}
                else:
                    _event_cache.pop(sk, None)
            else:
                # Lead blown check first (highest priority)
                if t["my_lead_before"] >= 3 and (now["my_score"] - now["opp_score"]) <= 0:
                    _event_cache[sk] = {"emotion": "extream_shock", "expire_inning": inning + 1, "is_end_event": True}
                elif opp_runs == 0 and t["had_bases_loaded"]:
                    _event_cache[sk] = {"emotion": "in_love", "expire_inning": inning + 1, "is_end_event": True}
                elif opp_runs == 0 and t["had_risp"]:
                    _event_cache[sk] = {"emotion": "joyful", "expire_inning": inning + 1, "is_end_event": True}
                else:
                    _event_cache.pop(sk, None)

            # Reset tracker for new half-inning
            _trackers[sk] = {
                "key": hk,
                "my_runs_before": now["my_score"],
                "opp_runs_before": now["opp_score"],
                "my_errors_before": now["my_errors"],
                "opp_errors_before": now["opp_errors"],
                "my_lead_before": now["my_score"] - now["opp_score"],
                "had_bases_loaded": _bases_loaded(now["base1"], now["base2"], now["base3"]),
                "had_risp": _has_risp(now["base2"], now["base3"]),
            }

        # ── 2. Initialize tracker if first call ──
        if sk not in _trackers:
            _trackers[sk] = {
                "key": hk,
                "my_runs_before": now["my_score"],
                "opp_runs_before": now["opp_score"],
                "my_errors_before": now["my_errors"],
                "opp_errors_before": now["opp_errors"],
                "my_lead_before": now["my_score"] - now["opp_score"],
                "had_bases_loaded": _bases_loaded(now["base1"], now["base2"], now["base3"]),
                "had_risp": _has_risp(now["base2"], now["base3"]),
            }

        # Update tracker chance flags
        tracker = _trackers[sk]
        if _bases_loaded(now["base1"], now["base2"], now["base3"]):
            tracker["had_bases_loaded"] = True
        if _has_risp(now["base2"], now["base3"]):
            tracker["had_risp"] = True

        # ── 3. Detect within-inning events ──
        if prev:
            event = _detect_within_inning_event(now, prev, my_bat, inning)
            if event:
                _event_cache[sk] = {"emotion": event, "expire_inning": 0, "is_end_event": False}

            # Track cumulative opponent runs this half-inning
            if not my_bat and now["opp_score"] > prev["opp_score"]:
                total_runs = now["opp_score"] - tracker["opp_runs_before"]
                if total_runs >= 3:
                    _event_cache[sk] = {"emotion": "devastated", "expire_inning": 0, "is_end_event": False}

        # ── 4. Save prev state ──
        _prev_state[sk] = now

        # ── 5. Resolve: cached event wins over snapshot ──
        ec = _event_cache.get(sk)
        if ec:
            if ec["is_end_event"] and inning > ec["expire_inning"]:
                del _event_cache[sk]
            else:
                return ec["emotion"]

    # ── Snapshot-based fallback ──
    return _live_snapshot_emotion(diff, inning, is_top, is_my_home, base1, base2, base3)
