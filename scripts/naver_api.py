from __future__ import annotations

import json
import ssl
import urllib.parse
import urllib.request
import re
import logging
from typing import Any

NAVER_BASE = "https://api-gw.sports.naver.com"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"


def get_json(path: str, query: dict[str, str] | None = None) -> dict[str, Any]:
    qs = f"?{urllib.parse.urlencode(query)}" if query else ""
    req = urllib.request.Request(f"{NAVER_BASE}{path}{qs}", headers={"Accept": "application/json", "User-Agent": UA}, method="GET")
    with urllib.request.urlopen(req, timeout=45, context=ssl.create_default_context()) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))


def schedule_games(from_date: str, to_date: str) -> list[dict[str, Any]]:
    data = get_json("/schedule/games", {"fields": "all", "fromDate": from_date, "toDate": to_date, "size": "500", "categoryId": "kbo", "excludeUpperCategoryId": "event"})
    if data.get("code") != 200 or not data.get("success"):
        return []
    return list(data.get("result", {}).get("games") or [])


def game_preview(game_id: str) -> dict[str, Any]:
    data = get_json(f"/schedule/games/{urllib.parse.quote(game_id, safe='')}/preview")
    return dict(data.get("result") or {}) if data.get("success") else {}


def game_lineup(game_id: str) -> dict[str, Any]:
    data = get_json(f"/schedule/games/{urllib.parse.quote(game_id, safe='')}/lineup")
    return dict(data.get("result") or {}) if data.get("success") else {}


def parse_score_inning(inn_str: str) -> list[int | None]:
    """Parse Naver inning scores. Handles "0,0,1,0,4" and "['-','-','0','1','-']".
    Returns only played innings (truncates trailing None/unplayed)."""
    if not inn_str or not inn_str.strip():
        return []
    s = inn_str.strip()
    if s.startswith("[") and s.endswith("]"):
        import ast
        try:
            parts = ast.literal_eval(s)
        except (ValueError, SyntaxError):
            return []
        result = [int(x) if str(x).lstrip("-").isdigit() else None for x in parts]
    else:
        result = [int(x.strip()) if x.strip().lstrip("-").isdigit() else None for x in s.split(",") if x.strip() != ""]
    # Truncate trailing None (unplayed innings)
    while result and result[-1] is None:
        result.pop()
    return result


def parse_rheb(rheb_str: str) -> dict[str, int]:
    """Parse Naver RHEB. Handles both "5,10,0,2" and "[0,0,0,0]"."""
    if not rheb_str or not rheb_str.strip():
        return {"r": 0, "h": 0, "e": 0}
    s = rheb_str.strip()
    if s.startswith("[") and s.endswith("]"):
        import ast
        try:
            parts = ast.literal_eval(s)
        except (ValueError, SyntaxError):
            return {"r": 0, "h": 0, "e": 0}
        return {"r": int(parts[0]) if len(parts) > 0 else 0,
                "h": int(parts[1]) if len(parts) > 1 else 0,
                "e": int(parts[2]) if len(parts) > 2 else 0}
    parts = [x.strip() for x in s.split(",")]
    return {"r": int(parts[0]), "h": int(parts[1]), "e": int(parts[2])}


def game_relay(naver_game_id: str) -> dict[str, Any] | None:
    """Fetch live relay data (BSO, baserunners, pitcher/batter) from Naver.
    Returns the full result dict containing currentGameState and entry arrays."""
    try:
        data = get_json(f"/schedule/games/{urllib.parse.quote(naver_game_id, safe='')}/relay")
        if data.get("success"):
            return dict(data.get("result") or {})
    except Exception:
        pass
    return None

def get_weather(stadium_name: str) -> dict[str, str] | None:
    """Fetch current weather for a stadium by scraping Naver Search."""
    try:
        query = f"{stadium_name} 날씨"
        req = urllib.request.Request(
            f"https://search.naver.com/search.naver?query={urllib.parse.quote(query)}",
            headers={"User-Agent": UA}
        )
        with urllib.request.urlopen(req, timeout=10, context=ssl.create_default_context()) as resp:
            html = resp.read().decode("utf-8", errors="replace")
        
        t_match = re.search(r'<div class="temperature_text">.*?<span class="blind">.*?</span>([-0-9.]+)<span class="celsius">', html, re.DOTALL)
        c_match = re.search(r'<span class="weather before_slash">(.*?)</span>', html)
        
        if t_match and c_match:
            return {
                "temp": t_match.group(1).strip(),
                "condition": c_match.group(1).strip()
            }
    except Exception as e:
        logging.getLogger("fullcount").warning(f"Failed to fetch weather for {stadium_name}: {e}")
    return None
