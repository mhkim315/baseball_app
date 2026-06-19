"""
Naver API 응답 → 내부 표준 형식 정규화 어댑터.

Naver가 필드명을 바꾸거나 응답 구조를 변경하면
이 파일만 수정하면 되고, main.py 등 소비자는 변경 불필요.
"""

import ast
import logging

logger = logging.getLogger("fullcount.naver-adapter")


# ── schedule_games ────────────────────────────────────────────

def normalize_game(raw: dict) -> dict:
    """Naver /schedule/games 응답 → 내부 표준 game dict."""
    return {
        "naverGameId": str(raw.get("gameId", "")),
        "statusCode": str(raw.get("statusCode") or ""),
        "homeTeamCode": str(raw.get("homeTeamCode") or ""),
        "awayTeamCode": str(raw.get("awayTeamCode") or ""),
        "homeScore": _normalize_score(raw.get("homeTeamScore")),
        "awayScore": _normalize_score(raw.get("awayTeamScore")),
        "homeStarter": raw.get("homeStarterName") or None,
        "awayStarter": raw.get("awayStarterName") or None,
        "gameDateTime": raw.get("gameDateTime") or "",
        "stadium": raw.get("stadium") or "",
        "categoryId": raw.get("categoryId") or "",
        "homeTeamScoreByInning": raw.get("homeTeamScoreByInning"),
        "awayTeamScoreByInning": raw.get("awayTeamScoreByInning"),
        "homeTeamRheb": raw.get("homeTeamRheb"),
        "awayTeamRheb": raw.get("awayTeamRheb"),
    }


def _normalize_score(val):  # -> int | None
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


# ── game_relay ─────────────────────────────────────────────────

def normalize_relay(raw):  # -> dict | None
    """Naver /schedule/games/{id}/relay 응답 → 내부 표준 relay dict."""
    if not raw:
        return None
    td = raw.get("textRelayData", {}) or {}
    cs = td.get("currentGameState", {}) or {}

    # pitcher/batter name lookup (homeEntry, awayEntry, homeLineup, awayLineup)
    p2n: dict[str, str] = {}
    for entry_key in ("homeEntry", "awayEntry", "homeLineup", "awayLineup"):
        entry = td.get(entry_key, {}) or {}
        for e in (entry.get("batter") or []) + (entry.get("pitcher") or []):
            if isinstance(e, dict) and e.get("pcode") and e.get("name"):
                p2n[str(e["pcode"])] = str(e["name"])

    pid = str(cs.get("pitcher") or "0")
    bid = str(cs.get("batter") or "0")

    return {
        "inning": str(td.get("inn") or "0"),
        "isTop": "1" if str(td.get("homeOrAway", "")) == "0" else "0",
        "strike": str(cs.get("strike") or "0"),
        "ball": str(cs.get("ball") or "0"),
        "out": str(cs.get("out") or "0"),
        "base1": str(cs.get("base1") or "0"),
        "base2": str(cs.get("base2") or "0"),
        "base3": str(cs.get("base3") or "0"),
        "pitcher": {"id": pid, "name": p2n.get(pid, "")} if pid != "0" else None,
        "batter": {"id": bid, "name": p2n.get(bid, "")} if bid != "0" else None,
    }


# ── 공통 헬퍼 ──────────────────────────────────────────────────

_NAVER_STATUS_MAP = {
    "STARTED": "live", "PLAYING": "live", "LIVE": "live", "2": "live",
    "RESULT": "finished", "ENDED": "finished", "FINISHED": "finished",
    "3": "finished", "4": "finished",
    "CANCEL": "cancelled", "CANCELLED": "cancelled",
    "5": "cancelled", "6": "cancelled", "7": "cancelled", "8": "cancelled",
}

def normalize_status(naver_status: str) -> str:
    if not naver_status:
        return "scheduled"
    return _NAVER_STATUS_MAP.get(naver_status.upper(), "scheduled")


def parse_score_inning(inn_raw) -> list:
    """
    Naver 이닝별 득점 파싱. 다음 형식들을 처리:
    - "0,0,1,0,4" (CSV 문자열)
    - ["0","2","-","-"] (실제 list)
    - "['0','2','-','-']" (list 문자열 표현)

    미진행 이닝("-")은 None으로, 뒤에서부터 잘라낸다.
    """
    if not inn_raw:
        return []

    # 이미 list면 변환만
    if isinstance(inn_raw, list):
        result = [_parse_inn_val(x) for x in inn_raw]
    else:
        s = str(inn_raw).strip()
        if s.startswith("[") and s.endswith("]"):
            try:
                parts = ast.literal_eval(s)
            except (ValueError, SyntaxError):
                return []
            result = [_parse_inn_val(x) for x in parts]
        else:
            result = [_parse_inn_val(x.strip()) for x in s.split(",") if x.strip()]

    # 뒤에서부터 미진행 이닝(None) 제거
    while result and result[-1] is None:
        result.pop()
    return result


def _parse_inn_val(x):  # -> int | None
    s = str(x).strip().strip("'\"")
    if s == "-" or not s:
        return None
    try:
        return int(s)
    except ValueError:
        return None


def parse_rheb(rheb_raw) -> dict:
    """
    Naver RHEB(득점/안타/에러) 파싱. 다음 형식들을 처리:
    - "5,10,0,2" (CSV)
    - [3, 5, 0] (실제 list)
    - "[3,5,0]" (list 문자열)
    """
    if not rheb_raw:
        return {"r": 0, "h": 0, "e": 0}

    if isinstance(rheb_raw, list):
        parts = rheb_raw
    else:
        s = str(rheb_raw).strip()
        if s.startswith("[") and s.endswith("]"):
            try:
                parts = ast.literal_eval(s)
            except (ValueError, SyntaxError):
                return {"r": 0, "h": 0, "e": 0}
        else:
            parts = [x.strip() for x in s.split(",")]

    return {
        "r": int(parts[0]) if len(parts) > 0 else 0,
        "h": int(parts[1]) if len(parts) > 1 else 0,
        "e": int(parts[2]) if len(parts) > 2 else 0,
    }
