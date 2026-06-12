"""Build mobile bundle files from regenerated daily-scores.json.

Converts data/daily-scores.json → mobile/lib/data/scores_2021-2025.json + scores_2026.ts

For 2021-2025: Complete seasons, all games from Naver API.
For 2026: Merges Naver API (played games) with existing scores_2026.ts (future schedule).
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KST = timezone(timedelta(hours=9))

MOBILE_FIELDS = ["away", "home", "awayScore", "homeScore", "outcome", "cancelled", "winPitcher", "losePitcher", "gameIdx"]


def strip_entry(entry: dict) -> dict:
    """Keep only the fields the mobile app needs."""
    result = {}
    for field in MOBILE_FIELDS:
        result[field] = entry.get(field)
    return result


def game_key(entry: dict) -> tuple:
    """Unique key for a game within a date."""
    return (entry.get("away", ""), entry.get("home", ""))


def load_scores_ts(path: Path) -> dict[str, list[dict]]:
    """Parse scores_2026.ts into a dict of date → games."""
    text = path.read_text(encoding="utf-8")
    # Strip the TypeScript wrapper to get pure JSON
    m = re.search(r"export const SCORES_2026.*?=\s*(\{[\s\S]*\})\s*;", text)
    if not m:
        print(f"ERROR: could not parse {path}")
        sys.exit(1)
    raw = m.group(1)
    # Strip trailing commas before closing braces/brackets (valid TS, invalid JSON)
    raw = re.sub(r",\s*([\]}])", r"\1", raw)
    return json.loads(raw)


def write_scores_ts(data: dict[str, list[dict]], path: Path) -> None:
    """Write data as TypeScript module (compact format, 5 games per line)."""
    lines = ['import type { ScoreEntry } from "./api";', '', 'export const SCORES_2026: Record<string, ScoreEntry[]> = {']
    for date_str in sorted(data.keys()):
        games_json = json.dumps(data[date_str], ensure_ascii=False)
        lines.append(f'  "{date_str}": {games_json},')
    lines.append("};")
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def main():
    # Load daily-scores.json (Naver API regenerated data)
    ds_path = ROOT / "data" / "daily-scores.json"
    ds = json.loads(ds_path.read_text(encoding="utf-8"))
    all_dates = ds.get("dates", {})

    # --- 2021-2025: Direct conversion ---
    print("Generating 2021-2025 scores files...")
    for year in ["2021", "2022", "2023", "2024", "2025"]:
        year_data = {}
        for date_str, games in sorted(all_dates.items()):
            if date_str.startswith(year):
                year_data[date_str] = [strip_entry(g) for g in games]
        out_path = ROOT / "mobile" / "lib" / "data" / f"scores_{year}.json"
        out_path.write_text(json.dumps(year_data, ensure_ascii=False, indent=2), encoding="utf-8")
        game_count = sum(len(games) for games in year_data.values())
        print(f"  scores_{year}.json: {len(year_data)} dates, {game_count} games → {out_path}")

    # --- 2026: Merge Naver data with existing schedule ---
    print("\nGenerating 2026 scores (merge Naver + existing schedule)...")
    existing_path = ROOT / "mobile" / "lib" / "scores_2026.ts"
    existing = load_scores_ts(existing_path)

    naver_2026 = {}
    for date_str, games in all_dates.items():
        if date_str.startswith("2026"):
            naver_2026[date_str] = games

    merged = {}
    all_2026_dates = sorted(set(list(existing.keys()) + list(naver_2026.keys())))

    for date_str in all_2026_dates:
        existing_games = existing.get(date_str, [])
        naver_games = naver_2026.get(date_str, [])

        if not naver_games:
            # No Naver data for this date → future/unplayed → keep existing
            merged[date_str] = [strip_entry(g) for g in existing_games]
            continue

        if not existing_games:
            # Naver has data but existing doesn't → use Naver
            merged[date_str] = [strip_entry(g) for g in naver_games]
            continue

        # Both exist: merge by game key, Naver takes precedence for played games
        existing_by_key = {game_key(g): g for g in existing_games}
        naver_by_key = {game_key(g): g for g in naver_games}

        merged_games = []
        used_keys = set()

        # First, include all Naver games (they have correct scores)
        for key, ng in sorted(naver_by_key.items()):
            merged_games.append(strip_entry(ng))
            used_keys.add(key)

        # Then, fill in any existing games not covered by Naver (future/rainouts)
        for key, eg in existing_by_key.items():
            if key not in used_keys:
                merged_games.append(strip_entry(eg))

        merged[date_str] = merged_games

    out_path = ROOT / "mobile" / "lib" / "scores_2026.ts"
    write_scores_ts(merged, out_path)
    total_games = sum(len(games) for games in merged.values())
    print(f"  scores_2026.ts: {len(merged)} dates, {total_games} games → {out_path}")

    # --- Exhibition data: leave as-is (already correct) ---
    exh_path = ROOT / "mobile" / "lib" / "data" / "exhibitionData.json"
    exh = json.loads(exh_path.read_text(encoding="utf-8"))
    exh_games = sum(len(games) for games in exh.values())
    print(f"\n  exhibitionData.json: {len(exh)} dates, {exh_games} games (unchanged)")

    # --- Verify outcomes ---
    print("\nVerifying outcomes in generated files...")
    errors = 0

    def compute_outcome(away_score, home_score):
        if away_score is None or home_score is None:
            return None
        if away_score > home_score:
            return "W"
        elif home_score > away_score:
            return "L"
        else:
            return "T"

    for year in ["2021", "2022", "2023", "2024", "2025"]:
        path = ROOT / "mobile" / "lib" / "data" / f"scores_{year}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        for date_str, games in data.items():
            for g in games:
                if g.get("cancelled"):
                    continue
                expected = compute_outcome(g.get("awayScore"), g.get("homeScore"))
                actual = g.get("outcome")
                if expected != actual:
                    # 0-0 with null outcome = rainout/no result (valid, not an error)
                    if (g.get("awayScore") == 0 and g.get("homeScore") == 0
                            and actual is None):
                        continue
                    errors += 1
                    if errors <= 5:
                        print(f"  ERROR {year} {date_str} {g['away']}@{g['home']}: "
                              f"expected={expected} actual={actual}")

    # Count games in each file
    print(f"\n{'=' * 50}")
    print("Final summary")
    print(f"{'=' * 50}")
    for year in ["2021", "2022", "2023", "2024", "2025"]:
        path = ROOT / "mobile" / "lib" / "data" / f"scores_{year}.json"
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            g_count = sum(len(games) for games in data.values())
            print(f"  scores_{year}.json: {g_count} games")

    ts_path = ROOT / "mobile" / "lib" / "scores_2026.ts"
    if ts_path.exists():
        merged_check = load_scores_ts(ts_path)
        g_count = sum(len(games) for games in merged_check.values())
        print(f"  scores_2026.ts: {g_count} games")

    if errors == 0:
        print(f"\n  Outcome verification: PASS (0 errors)")
    else:
        print(f"\n  Outcome verification: FAIL ({errors} errors)")

    return 0 if errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
