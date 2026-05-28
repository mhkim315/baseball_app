"""
Backfill DH (double-header) game-records to create _dh2.json files.

Run this on the server AFTER deploying the fixed build_game_records.py:
    python3 scripts/fix_dh_records.py
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_game_records import build_for_team
from naver_api import schedule_games
from team_config import ROOT, selected_teams

DATA_DIR = ROOT / "data"
DAILY_SCORES_PATH = DATA_DIR / "daily-scores.json"
SLEEP_BETWEEN_TEAMS = 1.5
SLEEP_BETWEEN_DATES = 3


def find_dh_dates() -> list[str]:
    scores = json.loads(DAILY_SCORES_PATH.read_text(encoding="utf-8"))
    dh_dates = []
    for date_str, games in scores.get("dates", {}).items():
        matchup_count: dict[tuple[str, str], int] = {}
        for g in games:
            key = (g.get("away", ""), g.get("home", ""))
            matchup_count[key] = matchup_count.get(key, 0) + 1
        if any(c > 1 for c in matchup_count.values()):
            dh_dates.append(date_str)
    return sorted(dh_dates)


def main() -> None:
    dh_dates = find_dh_dates()
    print(f"Found {len(dh_dates)} DH dates: {dh_dates}")

    all_teams = selected_teams(None)
    # Map KBO code → team config
    team_by_code: dict[str, dict] = {}
    for t in all_teams:
        code = t.get("kboCode")
        if code:
            team_by_code[code] = t

    done = 0

    for date_str in dh_dates:
        print(f"\n--- {date_str} ---")

        # Fetch this date's games (per-date scope avoids 500-game API limit)
        date_games = schedule_games(date_str, date_str)
        print(f"  fetched {len(date_games)} games")
        games_by_date = {date_str: date_games}

        # Identify teams from the response
        team_codes_on_date: set[str] = set()
        for g in date_games:
            if g.get("categoryId") != "kbo":
                continue
            home = g.get("homeTeamCode")
            away = g.get("awayTeamCode")
            if home:
                team_codes_on_date.add(home)
            if away:
                team_codes_on_date.add(away)

        for code in team_codes_on_date:
            team = team_by_code.get(code)
            if not team:
                continue

            # Delete old files to force rebuild
            for suffix in ("", "_dh2"):
                p = ROOT / "data" / "teams" / team["id"] / "game-records" / f"{date_str}{suffix}.json"
                if p.exists():
                    p.unlink()
                    print(f"  rm {team['id']}/{p.name}")

            build_for_team(team, date_str, games_by_date)
            done += 1
            time.sleep(SLEEP_BETWEEN_TEAMS)

        time.sleep(SLEEP_BETWEEN_DATES)

    print(f"\nDone: {done} teams processed")


if __name__ == "__main__":
    main()
