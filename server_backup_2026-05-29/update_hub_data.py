from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
KST = timezone(timedelta(hours=9))


def run(script: str, args: list[str]) -> None:
    cmd = [sys.executable, str(SCRIPTS / script), *args]
    print("+ " + " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)


def main() -> None:
    ap = argparse.ArgumentParser(description="Update baseball_refac team data")
    ap.add_argument("--team", help="team id, omitted means all teams")
    ap.add_argument("--date", help="YYYY-MM-DD for preview/lineup")
    ap.add_argument("--recent", default="30", help="recent days for KBO results")
    ap.add_argument("--records-recent", default="10", help="recent days for game records (default 10)")
    ap.add_argument("--skip-results", action="store_true")
    ap.add_argument("--skip-preview", action="store_true")
    ap.add_argument("--skip-lineup", action="store_true")
    ap.add_argument("--skip-records", action="store_true")
    args = ap.parse_args()

    common = []
    if args.team:
        common += ["--team", args.team]
    # 순위는 항상 먼저 갱신
    run("fetch_kbo_standings.py", [])
    if not args.skip_results:
        run("fetch_kbo_game_results.py", [*common, "--recent", str(args.recent)])
    dated = list(common)
    dates_to_fetch = [args.date] if args.date else []
    if not args.date:
        today = datetime.now(KST).strftime("%Y-%m-%d")
        tomorrow = (datetime.now(KST) + timedelta(days=1)).strftime("%Y-%m-%d")
        dates_to_fetch = [tomorrow, today]
    if not args.skip_preview:
        for d in dates_to_fetch:
            run("build_game_preview_from_naver.py", dated + ["--date", d])
    if not args.skip_lineup:
        for d in dates_to_fetch:
            run("build_lineup_from_naver.py", dated + ["--date", d])
    if not args.skip_records:
        run("build_game_records.py", common + ["--recent", str(args.records_recent)])
    # 오늘 경기 통합 JSON 생성 (내일 데이터도 함께 생성)
    run("build_today_games.py", [])
    # 날짜별 경기 점수 집계 (live-results.json 기반)
    run("build_daily_scores.py", [])


if __name__ == "__main__":
    main()
