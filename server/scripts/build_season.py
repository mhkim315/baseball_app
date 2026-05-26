"""
Fetch KBO season data for a given year from the official KBO API.

Usage:
    python scripts/build_season.py --year 2025 [--output-dir ./output]

Generates:
    {output_dir}/2025/regular-season.json    (~700 games)
    {output_dir}/2025/exhibition-games.json  (~50 games)

Uses koreabaseball.com GetKboGameList with srId=0 (regular) and srId=1 (exhibition).
"""
from __future__ import annotations
import argparse
import json
import os
import random
import ssl
import time
import urllib.request
import urllib.parse
from datetime import datetime, date, timedelta, timezone

KST = timezone(timedelta(hours=9))
KBO_URL = "https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList"

HEADERS = {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx",
}

KBO_TEAM_MAP = {
    "OB": "doosan", "LG": "lg", "WO": "kiwoom", "SK": "ssg",
    "KT": "kt", "HT": "kia", "HH": "hanwha", "SS": "samsung",
    "LT": "lotte", "NC": "nc",
}

# Rate limiting: random sleep between calls (seconds)
SLEEP_MIN = 0.3
SLEEP_MAX = 0.5

MAX_RETRIES = 3
RETRY_DELAYS = [1, 2, 4]  # seconds


def fetch_games(year: int, sr_id: int, date_str: str) -> list[dict]:
    """Fetch games for a specific date and series type from KBO API."""
    params = urllib.parse.urlencode({
        "leId": 1,
        "srId": sr_id,
        "date": date_str,
    }).encode()

    req = urllib.request.Request(KBO_URL, data=params, headers=HEADERS)
    ctx = ssl.create_default_context()

    for attempt in range(MAX_RETRIES):
        try:
            with urllib.request.urlopen(req, timeout=20, context=ctx) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                data = json.loads(raw)
                return data.get("game", [])
        except (urllib.error.HTTPError, urllib.error.URLError, OSError) as e:
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAYS[attempt] + random.uniform(0, 1)
                print(f"  Retry {attempt + 1}/{MAX_RETRIES} after {delay:.1f}s: {e}")
                time.sleep(delay)
            else:
                print(f"  Failed after {MAX_RETRIES} attempts: {e}")
                return []
        except json.JSONDecodeError:
            print(f"  Invalid JSON response for {date_str} (srId={sr_id})")
            return []


def parse_game(g: dict) -> dict | None:
    """Convert KBO API game entry to our standard format."""
    away_id = g.get("AWAY_ID", "")
    home_id = g.get("HOME_ID", "")

    away_code = KBO_TEAM_MAP.get(away_id)
    home_code = KBO_TEAM_MAP.get(home_id)
    if not away_code or not home_code:
        # Skip games with unknown team codes
        return None

    t_score = g.get("T_SCORE_CN", "").strip()
    b_score = g.get("B_SCORE_CN", "").strip()

    away_score = int(b_score) if b_score.isdigit() else None
    home_score = int(t_score) if t_score.isdigit() else None

    cancelled = g.get("CANCEL_SC_NM", "") != "정상경기"

    return {
        "date": g.get("G_DT", ""),
        "time": g.get("G_TM", "13:00"),
        "venue": g.get("S_NM", ""),
        "away": g.get("AWAY_NM", ""),
        "home": g.get("HOME_NM", ""),
        "awayTeamId": away_code,
        "homeTeamId": home_code,
        "awayScore": away_score,
        "homeScore": home_score,
        "gameId": g.get("G_ID", ""),
        "awayStarter": (g.get("B_PIT_P_NM", "") or "").strip() or None,
        "homeStarter": (g.get("T_PIT_P_NM", "") or "").strip() or None,
        "winPitcher": (g.get("W_PIT_P_NM", "") or "").strip() or None,
        "losePitcher": (g.get("L_PIT_P_NM", "") or "").strip() or None,
        "savePitcher": (g.get("SV_PIT_P_NM", "") or "").strip() or None,
        "cancelled": cancelled,
    }


def collect_games(year: int, sr_id: int, start_date: date, end_date: date, label: str) -> list[dict]:
    """Iterate over a date range and collect games from KBO API."""
    all_games: list[dict] = []
    total_days = (end_date - start_date).days + 1
    current = start_date
    day_count = 0

    print(f"\nFetching {label} (srId={sr_id}, {year})")
    print(f"  Date range: {start_date} ~ {end_date} ({total_days} days)")

    while current <= end_date:
        ds = current.strftime("%Y%m%d")
        games = fetch_games(year, sr_id, ds)

        if games:
            for g in games:
                parsed = parse_game(g)
                if parsed:
                    all_games.append(parsed)
            day_count += 1
            if day_count == 1 or day_count % 10 == 0:
                print(f"  {ds}: {len(games)} games (total: {len(all_games)})")
        else:
            if day_count > 0 and day_count % 20 == 0:
                print(f"  {ds}: 0 games (skipped)")

        # Rate limiting: random sleep between calls
        time.sleep(random.uniform(SLEEP_MIN, SLEEP_MAX))
        current += timedelta(days=1)

    print(f"  Done: {len(all_games)} games across {day_count} game days")
    return all_games


def main():
    parser = argparse.ArgumentParser(description="Build KBO season data files")
    parser.add_argument("--year", type=int, required=True, help="Season year (e.g. 2025)")
    parser.add_argument("--output-dir", type=str, default="./output", help="Output directory")
    parser.add_argument("--start-date", type=str, default=None, help="Override regular season start date (YYYY-MM-DD)")
    parser.add_argument("--end-date", type=str, default=None, help="Override regular season end date (YYYY-MM-DD)")
    args = parser.parse_args()

    year = args.year
    output_dir = os.path.join(args.output_dir, str(year))
    os.makedirs(output_dir, exist_ok=True)

    # Determine date ranges for the given year
    # Exhibition: ~Mar 1 to Mar 31 (actual games will be subset)
    exhibition_start = date(year, 3, 1)
    exhibition_end = date(year, 3, 31)

    # Regular season: overrideable via --start-date / --end-date
    if args.start_date:
        regular_start = date.fromisoformat(args.start_date)
        print(f"  Using overridden regular season start: {regular_start}")
    else:
        regular_start = date(year, 3, 22)

    if args.end_date:
        regular_end = date.fromisoformat(args.end_date)
        print(f"  Using overridden regular season end: {regular_end}")
    else:
        regular_end = date(year, 10, 31)

    # --- Collect exhibition games (srId=1) ---
    exhibition_games = collect_games(
        year, sr_id=1,
        start_date=exhibition_start,
        end_date=exhibition_end,
        label="Exhibition games",
    )

    if exhibition_games:
        exhibition_games.sort(key=lambda g: (g["date"], g["gameId"]))
        exhibition_output = os.path.join(output_dir, "exhibition-games.json")
        with open(exhibition_output, "w", encoding="utf-8") as f:
            json.dump({
                "year": year,
                "generatedAt": datetime.now(KST).isoformat(),
                "source": f"KBO API (koreabaseball.com/ws/Main.asmx/GetKboGameList, srId=1)",
                "games": exhibition_games,
            }, f, ensure_ascii=False, indent=2)
        print(f"\nWritten {len(exhibition_games)} exhibition games to {exhibition_output}")
    else:
        print(f"\nNo exhibition games found for {year}")

    # --- Collect regular season games (srId=0) ---
    regular_games = collect_games(
        year, sr_id=0,
        start_date=regular_start,
        end_date=regular_end,
        label="Regular season games",
    )

    if regular_games:
        regular_games.sort(key=lambda g: (g["date"], g["gameId"]))
        regular_output = os.path.join(output_dir, "regular-season.json")
        with open(regular_output, "w", encoding="utf-8") as f:
            json.dump({
                "year": year,
                "generatedAt": datetime.now(KST).isoformat(),
                "source": f"KBO API (koreabaseball.com/ws/Main.asmx/GetKboGameList, srId=0)",
                "games": regular_games,
            }, f, ensure_ascii=False, indent=2)
        print(f"\nWritten {len(regular_games)} regular season games to {regular_output}")
    else:
        print(f"\nNo regular season games found for {year}")

    print("\nDone!")


if __name__ == "__main__":
    main()
