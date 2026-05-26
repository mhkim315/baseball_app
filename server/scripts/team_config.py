from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "data" / "teams" / "index.json"


def load_config() -> dict[str, Any]:
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def teams() -> list[dict[str, Any]]:
    return list(load_config().get("teams") or [])


def team_by_id(team_id: str) -> dict[str, Any]:
    for team in teams():
        if team.get("id") == team_id:
            return team
    raise KeyError(f"unknown team id: {team_id}")


def team_by_code(code: str | None) -> dict[str, Any] | None:
    if not code:
        return None
    for team in teams():
        if team.get("kboCode") == code:
            return team
    return None


def team_by_name(name: str | None) -> dict[str, Any] | None:
    if not name:
        return None
    for team in teams():
        if name in (team.get("scheduleName"), team.get("teamName"), team.get("teamShort")):
            return team
    return None


def selected_teams(team_id: str | None = None) -> list[dict[str, Any]]:
    if team_id:
        return [team_by_id(team_id)]
    return teams()
