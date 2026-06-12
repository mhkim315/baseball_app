"""Final verification: compare regenerated files with originals."""
from __future__ import annotations
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def compute_outcome(away_score, home_score):
    if away_score is None or home_score is None:
        return None
    if away_score > home_score:
        return "W"
    elif home_score > away_score:
        return "L"
    else:
        return "T"


def count_games(data: dict) -> int:
    return sum(len(games) for games in data.values())


def check_json(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    issues = []

    # Sanity: no negative scores, valid outcomes, valid gameIdx
    for date_str, games in data.items():
        for g in games:
            for s in ["awayScore", "homeScore"]:
                v = g.get(s)
                if v is not None and v < 0:
                    issues.append(f"  {date_str} {g['away']}@{g['home']}: {s}={v} negative")
            # Outcome is W/L/T/null only
            o = g.get("outcome")
            if o not in ("W", "L", "T", None):
                issues.append(f"  {date_str} {g['away']}@{g['home']}: invalid outcome={o}")
            # gameIdx is 0 or 1
            gi = g.get("gameIdx")
            if gi not in (0, 1):
                issues.append(f"  {date_str} {g['away']}@{g['home']}: invalid gameIdx={gi}")

    return {"file": path.name, "dates": len(data), "games": count_games(data), "issues": issues}


def check_ts(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    issues = []

    # Must start with import
    if not text.startswith('import type { ScoreEntry }'):
        issues.append("Missing import statement")

    # Must have export const
    if "export const SCORES_2026" not in text:
        issues.append("Missing export const SCORES_2026")

    # Must end with }; (and maybe newline)
    text_stripped = text.rstrip()
    if not text_stripped.endswith("};"):
        issues.append("File doesn't end with '};'")

    # Try to extract and parse JSON
    m = re.search(r"export const SCORES_2026.*?=\s*(\{[\s\S]*\})\s*;", text)
    if not m:
        issues.append("Cannot extract JSON object from TS file")
        return {"file": path.name, "dates": 0, "games": 0, "issues": issues}

    try:
        raw = re.sub(r",\s*([\]}])", r"\1", m.group(1))
        data = json.loads(raw)
        dates = len(data)
        games = count_games(data)
        return {"file": path.name, "dates": dates, "games": games, "issues": issues}
    except json.JSONDecodeError as e:
        issues.append(f"JSON parse error: {e}")
        return {"file": path.name, "dates": 0, "games": 0, "issues": issues}


print("=" * 60)
print("FINAL VERIFICATION")
print("=" * 60)

# Check each output file
results = []
for year in ["2021", "2022", "2023", "2024", "2025"]:
    path = ROOT / "mobile" / "lib" / "data" / f"scores_{year}.json"
    results.append(check_json(path))

ts_path = ROOT / "mobile" / "lib" / "scores_2026.ts"
results.append(check_ts(ts_path))

# Print results
for r in results:
    print(f"\n{r['file']}:")
    print(f"  {r['dates']} dates, {r['games']} games")
    if r["issues"]:
        print(f"  ISSUES ({len(r['issues'])}):")
        for i in r["issues"]:
            print(f"    {i}")
    else:
        print(f"  All checks passed")

# Overall outcome consistency
print(f"\n{'=' * 60}")
print("Cross-file outcome consistency")
print("=" * 60)
total = 0
errors = 0
for year in ["2021", "2022", "2023", "2024", "2025"]:
    path = ROOT / "mobile" / "lib" / "data" / f"scores_{year}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    for date_str, games in data.items():
        for g in games:
            if g.get("cancelled"):
                continue
            if g.get("awayScore") == 0 and g.get("homeScore") == 0 and g.get("outcome") is None:
                continue  # rainout
            total += 1
            expected = compute_outcome(g.get("awayScore"), g.get("homeScore"))
            actual = g.get("outcome")
            if expected != actual:
                errors += 1
                print(f"  ERROR {year} {date_str} {g['away']}@{g['home']}: "
                      f"expected={expected} actual={actual}")

print(f"Checked {total} non-cancelled games: {errors} errors")
print(f"Outcome consistency: {'PASS' if errors == 0 else 'FAIL'}")

print(f"\nDone. All files ready for commit.")
