from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX_PATH = ROOT / "data" / "teams" / "index.json"
OUT_PATH = ROOT / "js" / "team-config.js"

TEMPLATE = """export const SITE_TITLE = "fullcount.kr";

export const STADIUMS = {stadiums_json};

export const TEAMS = {teams_json};

export const DEFAULT_TEAM_ID = "doosan";

export function getTeamById(teamId) {{
  return TEAMS.find((team) => team.id === teamId) || TEAMS.find((team) => team.id === DEFAULT_TEAM_ID);
}}

export function getTeamByScheduleName(name) {{
  return TEAMS.find((team) => team.scheduleName === name || team.teamName === name || team.teamShort === name);
}}

export function getStadiumByTeam(team) {{
  return STADIUMS[String(team?.stadiumHubId || "1")] || STADIUMS["1"];
}}
"""


def main() -> None:
    data = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    stadiums = data["stadiums"]
    teams = data["teams"]

    content = TEMPLATE.format(
        stadiums_json=json.dumps(stadiums, ensure_ascii=False, indent=2),
        teams_json=json.dumps(teams, ensure_ascii=False, indent=2),
    )
    OUT_PATH.write_text(content, encoding="utf-8")
    print(f"Generated {OUT_PATH}")


if __name__ == "__main__":
    main()
