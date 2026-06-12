#!/usr/bin/env python3
"""
daily-scores.json outcome 필드 일괄 교정 스크립트

문제: 과거 데이터(2020~2025)의 outcome 필드가 매치업마다 다른 기준으로 잘못 기록됨.
원인: update_hub_data.py 병합 과정에서 outcome 계산 시 inconsistent한 convention 사용.

해결: 점수는 이미 정확하므로, 모든 outcome을 점수에서 다시 계산.
  - awayScore > homeScore → "W" (away win)
  - awayScore < homeScore → "L" (home win)
  - awayScore == homeScore → "T" (tie)
  - 취소 경기(cancelled=true) → outcome 보존

Usage:
    python scripts/recompute_outcomes.py --dry-run     # 변경될 항목만 출력
    python scripts/recompute_outcomes.py               # 실제 수정 후 저장
"""

import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

KST = timezone(timedelta(hours=9))

BACKUP_DIR = Path(__file__).resolve().parent.parent / "server-backup"
INPUT_PATH = BACKUP_DIR / "2026-06-01" / "data" / "daily-scores.json"
OUTPUT_PATH = BACKUP_DIR / "daily-scores-fixed.json"


def compute_outcome(away_score, home_score):
    if away_score is None or home_score is None:
        return None
    if away_score > home_score:
        return "W"
    elif home_score > away_score:
        return "L"
    else:
        return "T"


def main():
    import argparse
    parser = argparse.ArgumentParser(description="daily-scores.json outcome 재계산")
    parser.add_argument("--dry-run", action="store_true", help="변경사항만 출력 (저장 안 함)")
    parser.add_argument("--input", type=str, default=str(INPUT_PATH), help="입력 파일 경로")
    parser.add_argument("--output", type=str, default=str(OUTPUT_PATH), help="출력 파일 경로")
    args = parser.parse_args()

    # Load
    input_path = Path(args.input)
    if not input_path.exists():
        # Try the tar backup
        import tarfile, tempfile
        tar_path = BACKUP_DIR / "2026-06-11" / "backend_backup.tar.gz"
        if tar_path.exists():
            print(f"tar 백업에서 추출: {tar_path}")
            with tempfile.TemporaryDirectory() as tmpdir:
                with tarfile.open(tar_path, "r:gz") as tar:
                    members = [m for m in tar.getmembers()
                               if m.name == "./repo/data/daily-scores.json"]
                    tar.extractall(tmpdir, members=members)
                tmp_path = Path(tmpdir) / "repo" / "data" / "daily-scores.json"
                with open(tmp_path, encoding="utf-8") as f:
                    data = json.load(f)
        else:
            print(f"[ERROR] 입력 파일 없음: {input_path}")
            return 1
    else:
        with open(input_path, encoding="utf-8") as f:
            data = json.load(f)

    dates = data.get("dates", {})
    total = 0
    changed = 0
    changes = []

    for date_str in sorted(dates):
        for g in dates[date_str]:
            total += 1
            away_s = g.get("awayScore")
            home_s = g.get("homeScore")
            old_outcome = g.get("outcome")
            cancelled = g.get("cancelled", False)

            if cancelled:
                continue  # 취소 경기는 outcome 건드리지 않음
            if away_s is None or home_s is None:
                continue  # 점수 없으면 스킵

            new_outcome = compute_outcome(away_s, home_s)
            if new_outcome and new_outcome != old_outcome:
                changed += 1
                changes.append({
                    "gameId": g.get("gameId", "?"),
                    "date": date_str,
                    "matchup": f"{g.get('away','?')}@{g.get('home','?')}",
                    "score": f"{away_s}-{home_s}",
                    "oldOutcome": old_outcome,
                    "newOutcome": new_outcome,
                })
                g["outcome"] = new_outcome

    # Report
    print(f"전체 게임: {total}")
    print(f"취소 제외: {total - sum(1 for d in dates for g in dates[d] if g.get('cancelled'))}")
    print(f"outcome 변경: {changed}")

    if changes:
        print(f"\n변경 내역 (최초 30건):")
        for c in changes[:30]:
            print(f"  {c['date']} {c['gameId']}: {c['matchup']} {c['score']} "
                  f"{c['oldOutcome']}→{c['newOutcome']}")
        if len(changes) > 30:
            print(f"  ... 외 {len(changes) - 30}건")

    if not args.dry_run and changed > 0:
        data["generatedAt"] = datetime.now(KST).isoformat()
        data["_note"] = "outcome 필드 재계산 완료 (점수 기반 W/L/T)"
        output_path = Path(args.output)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"\n저장 완료: {output_path}")
    elif args.dry_run:
        print(f"\n[DRY RUN] 실제 변경 없이 미리보기만 출력")
        print(f"실행하려면: python scripts/recompute_outcomes.py")

    return 0


if __name__ == "__main__":
    sys.exit(main())
