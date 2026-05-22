from __future__ import annotations
import json, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from naver_api import schedule_games
from team_config import selected_teams
from build_game_records import build_for_team

DATA = Path("/home/opc/fullcount_backend/repo/data")
season = json.loads((DATA / "seasons" / "2025" / "regular-season.json").read_text())
dates = sorted(set(g["date"] for g in season["games"]))
print(f"2025 season: {len(dates)} game days")

from_d = f"{dates[0][:4]}-{dates[0][4:6]}-{dates[0][6:8]}"
to_d = f"{dates[-1][:4]}-{dates[-1][4:6]}-{dates[-1][6:8]}"
print(f"Fetching Naver schedule {from_d} ~ {to_d}")
all_games = schedule_games(from_d, to_d)

games_by_date: dict[str, list[dict]] = {}
for g in all_games:
    d = (g.get("gameDate") or str(g.get("gameDateTime", ""))[:10]).strip()
    if d:
        games_by_date.setdefault(d, []).append(g)

teams = selected_teams(None)
done, skipped = 0, 0

for ds in dates:
    d_iso = f"{ds[:4]}-{ds[4:6]}-{ds[6:8]}"
    for team in teams:
        rec_path = DATA / "teams" / team["id"] / "game-records" / f"{d_iso}.json"
        if rec_path.exists():
            skipped += 1
            continue
        try:
            build_for_team(team, d_iso, games_by_date)
            done += 1
        except Exception as e:
            print(f"  FAIL {team['id']} {d_iso}: {e}")
        time.sleep(0.3)

print(f"\nDone! {done} new records, {skipped} skipped")
