from __future__ import annotations

import json
import ssl
import urllib.parse
import urllib.request
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
