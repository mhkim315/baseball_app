#!/usr/bin/env python3
"""
2025 scores_2025.json 점수 스왑 진단 및 수정 스크립트

build_season.py의 T_SCORE(away) / B_SCORE(home) 매핑 오류로 인해
일부 날짜의 awayScore/homeScore가 반대로 저장됨.

KBO API (올바른 T=원정, B=홈 매핑) 또는 server game-records(Naver)를
ground truth로 비교하여 swap 탐지 및 수정.

Usage:
    python scripts/fix_2025_score_swap.py --dry-run    # 진단만
    python scripts/fix_2025_score_swap.py              # 실제 수정
"""

import json
import os
import sys
import urllib.request
import urllib.parse
import ssl
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8")

KST = timezone(timedelta(hours=9))
ROOT = Path(__file__).resolve().parents[1]

KBO_URL = "https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

TEAM_NAME_TO_CODE = {
    "두산": "OB", "LG": "LG", "키움": "WO", "SSG": "SK",
    "KT": "KT", "한화": "HH", "KIA": "HT", "삼성": "SS",
    "롯데": "LT", "NC": "NC",
}
# KBO API uses same codes
KBO_ID_MAP = {
    "OB": "두산", "LG": "LG", "WO": "키움", "SK": "SSG",
    "KT": "KT", "HH": "한화", "HT": "KIA", "SS": "삼성",
    "LT": "롯데", "NC": "NC",
}


def compute_outcome(away_score, home_score):
    """W = away win, L = home win, T = tie"""
    if away_score is None or home_score is None:
        return None
    if away_score > home_score:
        return "W"
    elif home_score > away_score:
        return "L"
    else:
        return "T"


def load_scores():
    path = ROOT / "mobile" / "lib" / "data" / "scores_2025.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_scores(data):
    path = ROOT / "mobile" / "lib" / "data" / "scores_2025.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  Saved {path}")


def fetch_kbo_games(date_ymd: str) -> list[dict]:
    """Fetch games for a date from KBO API with CORRECT T/B mapping.
    T_SCORE_CN = Top (away) team score
    B_SCORE_CN = Bottom (home) team score
    """
    params = urllib.parse.urlencode({
        "leId": 1, "srId": 0, "date": date_ymd,
    }).encode()
    req = urllib.request.Request(KBO_URL, data=params, headers={
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": UA,
        "Referer": "https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx",
    })
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            data = json.loads(raw)
            games = data.get("game", [])
            result = []
            for g in games:
                t_score = g.get("T_SCORE_CN", "").strip()
                b_score = g.get("B_SCORE_CN", "").strip()
                cancel = g.get("CANCEL_SC_NM", "") != "정상경기"
                away_name = KBO_ID_MAP.get(g.get("AWAY_ID", ""))
                home_name = KBO_ID_MAP.get(g.get("HOME_ID", ""))
                result.append({
                    "away": away_name or g.get("AWAY_NM", ""),
                    "home": home_name or g.get("HOME_NM", ""),
                    "awayScore": int(t_score) if t_score.isdigit() else None,
                    "homeScore": int(b_score) if b_score.isdigit() else None,
                    "cancelled": cancel,
                    "gameId": g.get("G_ID", ""),
                })
            return result
    except Exception as e:
        print(f"    KBO API fail: {e}")
        return None


def find_gr_dates() -> set:
    """Find all dates covered by game-records in server-backup."""
    from collections import defaultdict
    gr_dates = set()
    records_dir = ROOT / "server-backup" / "2026-06-01" / "data" / "teams"
    if records_dir.exists():
        for team_dir in records_dir.iterdir():
            gr_dir = team_dir / "game-records"
            if gr_dir.is_dir():
                for f in gr_dir.iterdir():
                    if f.suffix == ".json":
                        date_part = f.stem.replace("_dh2", "")
                        gr_dates.add(date_part)
    return gr_dates


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Fix swapped scores in scores_2025.json")
    parser.add_argument("--dry-run", action="store_true", help="진단만 수행")
    parser.add_argument("--api-delay", type=float, default=0.5, help="KBO API 요청 간 간격(초)")
    args = parser.parse_args()

    scores = load_scores()
    all_dates = sorted([d for d in scores.keys() if d.startswith("2025-")])
    gr_dates = find_gr_dates()

    print(f"Total 2025 dates: {len(all_dates)}")
    print(f"Dates WITH game-records: {len(gr_dates)}")
    print(f"Dates WITHOUT game-records: {len(all_dates) - len([d for d in all_dates if d in gr_dates])}")

    # Phase 1: Dates with game-records → verify clean (skip unless forced)
    # Phase 2: Dates without game-records → KBO API verification
    dates_to_check = [d for d in all_dates if d not in gr_dates]

    print(f"\n{'='*60}")
    print(f"  KBO API 검증: {len(dates_to_check)} dates")
    print(f"{'='*60}")

    fixes = []
    kbo_failures = []

    for i, date_str in enumerate(dates_to_check):
        ymd = date_str.replace("-", "")
        local_games = scores.get(date_str, [])

        # Skip dates with no games
        if not local_games:
            continue

        # Skip dates with only cancelled/0-0 games
        has_real_games = any(
            g.get("awayScore") is not None and g.get("homeScore") is not None
            and not g.get("cancelled")
            and not (g.get("awayScore") == 0 and g.get("homeScore") == 0)
            for g in local_games
        )
        if not has_real_games:
            continue

        print(f"  [{i+1}/{len(dates_to_check)}] {date_str}...", end=" ")
        kbo_games = fetch_kbo_games(ymd)

        if kbo_games is None:
            kbo_failures.append(date_str)
            print("SKIP (API fail)")
            continue

        # Match local games to KBO games
        date_fixes = []
        for g in local_games:
            a_name, h_name = g["away"], g["home"]

            # Find matching KBO game
            match = None
            for kg in kbo_games:
                if kg["away"] == a_name and kg["home"] == h_name:
                    match = kg
                    break

            if not match:
                continue

            la = g.get("awayScore")
            lh = g.get("homeScore")
            ka = match["awayScore"]
            kh = match["homeScore"]

            if la is None or lh is None or ka is None or kh is None:
                continue

            # Skip 0-0 ties (pre-game or cancelled)
            if la == 0 and lh == 0 and ka == 0 and kh == 0:
                continue

            # Skip ties (scores equal on both sides = not a swap)
            if la == lh and ka == kh and la == ka:
                continue

            # Check if swapped (local away == KBO home AND local home == KBO away)
            if la == kh and lh == ka:
                # SWAPPED
                old_outcome = g.get("outcome")
                new_outcome = compute_outcome(ka, kh)
                date_fixes.append({
                    "date": date_str,
                    "away": a_name,
                    "home": h_name,
                    "oldScores": f"{la}-{lh}",
                    "newScores": f"{ka}-{kh}",
                    "oldOutcome": old_outcome,
                    "newOutcome": new_outcome,
                    "oldWinPitcher": g.get("winPitcher"),
                    "oldLosePitcher": g.get("losePitcher"),
                })

                if not args.dry_run:
                    # Fix scores
                    g["awayScore"] = ka
                    g["homeScore"] = kh
                    # Fix outcome
                    g["outcome"] = new_outcome
                    # Swap winPitcher ↔ losePitcher (home/away swapped, so win/lose swapped)
                    old_wp = g.get("winPitcher")
                    old_lp = g.get("losePitcher")
                    g["winPitcher"] = old_lp
                    g["losePitcher"] = old_wp

        if date_fixes:
            print(f"{len(date_fixes)} swapped games")
            for f in date_fixes:
                print(f"    {f['away']}@{f['home']}: {f['oldScores']} → {f['newScores']}  outcome: {f['oldOutcome']}→{f['newOutcome']}")
            fixes.extend(date_fixes)
        else:
            print("OK")

        time.sleep(args.api_delay)

    # Summary
    print(f"\n{'='*60}")
    print(f"  최종 요약")
    print(f"{'='*60}")
    print(f"  검사한 날짜: {len(dates_to_check)}")
    print(f"  SWAP 발견: {len(fixes)} games")
    print(f"  API 실패 (재시도 필요): {len(kbo_failures)} dates")

    if fixes:
        print(f"\n  SWAP 목록:")
        for f in fixes:
            print(f"    {f['date']} {f['away']}@{f['home']}: {f['oldScores']} → {f['newScores']}")

    if args.dry_run:
        print(f"\n  [DRY RUN] 수정 안 함. --dry-run 없이 실행하면 수정합니다.")
    else:
        if fixes:
            save_scores(scores)
            print(f"  scores_2025.json 수정 완료: {len(fixes)} games fixed")
        else:
            print("  수정할 게임 없음")

    return 0 if not kbo_failures else 1


if __name__ == "__main__":
    sys.exit(main())
