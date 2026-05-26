"""Backfill KBO data for multiple seasons (2020-2024).

Usage:
    python3 scripts/backfill_multi_year.py --years 2020,2021,2022,2023,2024
    python3 scripts/backfill_multi_year.py --years 2020
    python3 scripts/backfill_multi_year.py --years 2020 --skip-records  # live-results only

For each year:
  1. Reads seasons/{year}/regular-season.json for game dates
  2. Fetches Naver schedule for the full season (1 call)
  3. Builds live-results.json for each team (from Naver schedule)
  4. Builds game-records for each team × date (preview + record APIs)
  5. After all years: runs build_daily_scores.py once
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

from naver_api import schedule_games
from team_config import ROOT, selected_teams
from build_game_records import build_for_team

KST = timezone(timedelta(hours=9))
SCRIPTS = ROOT / "scripts"

# Rate limiting
SLEEP_PER_RECORD = 0.3
SLEEP_PER_YEAR = 1.0

TEAM_CODE_TO_SCHEDULE_NAME = {
    "OB": "두산", "LG": "LG", "WO": "키움", "SK": "SSG", "KT": "KT",
    "HT": "KIA", "HH": "한화", "SS": "삼성", "LT": "롯데", "NC": "NC",
}


def run(script: str, args: list[str]) -> None:
    cmd = [sys.executable, str(SCRIPTS / script), *args]
    print(f"+ {' '.join(cmd)}", flush=True)
    subprocess.run(cmd, check=True)


def load_team_config() -> list[dict[str, Any]]:
    index_path = ROOT / "data" / "teams" / "index.json"
    return json.loads(index_path.read_text(encoding="utf-8")).get("teams", [])


def find_team_by_kbo_code(teams: list[dict[str, Any]], code: str) -> dict[str, Any] | None:
    for t in teams:
        if t.get("kboCode") == code:
            return t
    return None


def build_live_results_for_team(
    team: dict[str, Any],
    all_games: list[dict[str, Any]],
    season_year: int,
    live_path: Path,
) -> None:
    """Build live-results.json for a team from Naver schedule games."""
    team_name = team["scheduleName"]
    team_code = team["kboCode"]
    by_date: dict[str, list[dict[str, Any]]] = {}

    for g in all_games:
        if g.get("categoryId") != "kbo":
            continue
        away_name = g.get("awayTeamName", "")
        home_name = g.get("homeTeamName", "")
        away_code = g.get("awayTeamCode", "")
        home_code = g.get("homeTeamCode", "")

        is_away = team_name in (away_name, g.get("awayTeamShortName", "")) or team_code == away_code
        is_home = team_name in (home_name, g.get("homeTeamShortName", "")) or team_code == home_code
        if not is_away and not is_home:
            continue

        game_date = (g.get("gameDate") or str(g.get("gameDateTime", ""))[:10]).strip()
        if not game_date:
            continue

        away_score = int(g.get("awayTeamScore") or 0)
        home_score = int(g.get("homeTeamScore") or 0)
        our_score = away_score if is_away else home_score
        opp_score = home_score if is_away else away_score

        cancelled = bool(g.get("cancel"))
        status = g.get("statusCode", "")

        # Skip future games (BEFORE status) — only include finished/cancelled
        if status == "BEFORE" and not cancelled:
            continue

        finished = status in ("END", "RESULT")
        outcome: str | None = None
        if not cancelled and finished:
            winner = g.get("winner", "")
            if winner == "AWAY":
                outcome = "W" if is_away else "L"
            elif winner == "HOME":
                outcome = "W" if is_home else "L"
            elif winner == "DRAW":
                outcome = "T"
            elif our_score > opp_score:
                outcome = "W"
            elif our_score < opp_score:
                outcome = "L"
            elif our_score == opp_score and our_score > 0:
                outcome = "T"

        entry = {
            "away": away_name,
            "home": home_name,
            "venue": g.get("stadium") or g.get("stadiumName") or "",
            "awayScore": away_score,
            "homeScore": home_score,
            "scoreLine": f"{away_score}-{home_score}",
            "ourScore": our_score,
            "oppScore": opp_score,
            "ourScoreLine": f"{our_score}-{opp_score}",
            "outcome": outcome,
            "cancelled": cancelled,
            "gameId": g.get("gameId"),
            "awayStarter": str(g.get("awayStarterName") or "").strip() or None,
            "homeStarter": str(g.get("homeStarterName") or "").strip() or None,
            "winPitcher": str(g.get("winPitcherName") or "").strip() or None,
            "losePitcher": str(g.get("losePitcherName") or "").strip() or None,
        }

        by_date.setdefault(game_date, []).append(entry)

    # Merge with existing live-results (preserves data from other years/seasons)
    existing: dict[str, Any] = {}
    if live_path.exists():
        try:
            existing = json.loads(live_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, Exception):
            pass

    merged_by_date: dict[str, Any] = existing.get("byDate", {})
    merged_by_date.update(by_date)

    result = {
        "team": team_name,
        "source": f"Naver API (backfill {season_year}, merged)",
        "fetchedAt": datetime.now(KST).isoformat(timespec="seconds"),
        "byDate": dict(sorted(merged_by_date.items())),
    }
    live_path.parent.mkdir(parents=True, exist_ok=True)
    live_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  live-results: {len(by_date)} new + {len(merged_by_date) - len(by_date)} existing = {len(merged_by_date)} total dates")


def get_season_dates(year: int) -> list[str]:
    """Read season file and return sorted game date strings (YYYYMMDD)."""
    season_file = ROOT / "data" / "seasons" / str(year) / "regular-season.json"
    if not season_file.exists():
        print(f"ERROR: season file not found: {season_file}")
        print(f"  Run: python3 scripts/build_season.py --year {year} --output-dir data/seasons")
        sys.exit(1)
    season = json.loads(season_file.read_text(encoding="utf-8"))
    games = season.get("games", [])
    dates = sorted(set(g["date"] for g in games if g.get("date")))
    print(f"  {year} season: {len(dates)} game dates, {len(games)} total games")
    return dates


def backfill_live_results(year: int) -> None:
    """Build live-results.json for all teams for the given year."""
    print(f"\n{'='*60}")
    print(f"Phase 1: live-results for {year}")
    print(f"{'='*60}")

    dates = get_season_dates(year)
    from_d = f"{dates[0][:4]}-{dates[0][4:6]}-{dates[0][6:8]}"
    to_d = f"{dates[-1][:4]}-{dates[-1][4:6]}-{dates[-1][6:8]}"
    print(f"  Fetching Naver schedule {from_d} ~ {to_d}")
    all_games = schedule_games(from_d, to_d)
    print(f"  Got {len(all_games)} games from Naver schedule")
    if not all_games:
        print("  WARNING: no games returned! Check date format (needs YYYY-MM-DD)")
        return
    time.sleep(SLEEP_PER_YEAR)

    teams = selected_teams(None)
    for team in teams:
        live_path = ROOT / "data" / "teams" / team["id"] / "live-results.json"

        # For live-results, we overwrite (the backfill runs per-year, so only this
        # year's data is in the Naver schedule response). Existing live-results.json
        # from the live collector will be regenerated on next collector run.
        build_live_results_for_team(team, all_games, year, live_path)
        time.sleep(0.1)


def backfill_game_records(year: int) -> None:
    """Build game-records for all teams × dates for the given year."""
    print(f"\n{'='*60}")
    print(f"Phase 2: game records for {year}")
    print(f"{'='*60}")

    dates = get_season_dates(year)
    from_d = f"{dates[0][:4]}-{dates[0][4:6]}-{dates[0][6:8]}"
    to_d = f"{dates[-1][:4]}-{dates[-1][4:6]}-{dates[-1][6:8]}"

    # Fetch Naver schedule once for the whole season
    print(f"  Fetching Naver schedule {from_d} ~ {to_d}")
    all_games = schedule_games(from_d, to_d)
    print(f"  Got {len(all_games)} games from Naver schedule")
    if not all_games:
        print("  WARNING: no games returned! Check date format")
        return

    games_by_date: dict[str, list[dict]] = {}
    for g in all_games:
        d = (g.get("gameDate") or str(g.get("gameDateTime", ""))[:10]).strip()
        if d:
            games_by_date.setdefault(d, []).append(g)

    teams = selected_teams(None)
    total = len(dates) * len(teams)
    done, skipped, failed = 0, 0, 0
    start_time = time.time()

    for i, ds in enumerate(dates):
        d_iso = f"{ds[:4]}-{ds[4:6]}-{ds[6:8]}"
        for team in teams:
            rec_path = ROOT / "data" / "teams" / team["id"] / "game-records" / f"{d_iso}.json"
            if rec_path.exists():
                skipped += 1
                continue

            try:
                build_for_team(team, d_iso, games_by_date)
                done += 1
            except Exception as e:
                print(f"  FAIL {team['id']} {d_iso}: {e}")
                failed += 1

            time.sleep(SLEEP_PER_RECORD)

            # Progress report every 100 operations
            total_done = done + skipped + failed
            if total_done % 100 == 0:
                elapsed = time.time() - start_time
                rate = total_done / elapsed if elapsed > 0 else 0
                print(f"  Progress: {total_done}/{total} "
                      f"(done={done}, skipped={skipped}, failed={failed}) "
                      f"[{rate:.1f} ops/s, ~{(total - total_done)/rate:.0f}s remaining]")

    elapsed = time.time() - start_time
    print(f"\n  {year} records: {done} new, {skipped} skipped, {failed} failed in {elapsed:.0f}s")


def rebuild_daily_scores() -> None:
    """Run build_daily_scores.py to aggregate all live-results into daily-scores.json."""
    print(f"\n{'='*60}")
    print("Rebuilding daily-scores.json from all live-results")
    print(f"{'='*60}")
    run("build_daily_scores.py", [])


def main() -> None:
    ap = argparse.ArgumentParser(description="Backfill KBO data for multiple seasons")
    ap.add_argument("--years", required=True, help="Comma-separated years, e.g. '2020,2021,2022,2023,2024'")
    ap.add_argument("--skip-records", action="store_true", help="Skip game-records backfill (live-results only)")
    ap.add_argument("--skip-live", action="store_true", help="Skip live-results backfill")
    args = ap.parse_args()

    years = [y.strip() for y in args.years.split(",") if y.strip()]
    print(f"Backfilling years: {', '.join(years)}")
    print(f"Skip records: {args.skip_records}")
    print(f"Skip live-results: {args.skip_live}")

    for year_str in years:
        year = int(year_str)
        print(f"\n{'#'*60}")
        print(f"#  YEAR: {year}")
        print(f"{'#'*60}")

        if not args.skip_live:
            backfill_live_results(year)

        if not args.skip_records:
            backfill_game_records(year)

        print(f"\n  Year {year} complete!")

    # Always rebuild daily-scores at the end (merges all years' live-results)
    rebuild_daily_scores()

    print(f"\n{'='*60}")
    print("Backfill complete for all years!")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
