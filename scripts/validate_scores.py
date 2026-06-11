#!/usr/bin/env python3
"""
daily-scores.json 전수 검증 스크립트

game-records (Naver API, ground truth) vs daily-scores.json (앱 사용 데이터) 비교.

수정된 3가지 치명적 결함:
  1. DH 매칭: team name → gameId 기반 (오탐 없음)
  2. DH 파일: {date}.json + {date}_dh2.json 모두 확인
  3. outcome 필드: 사전 검증으로 시맨틱 동적 추론 후 사용

데이터 소스: server-backup/ 최신 tar.gz → 임시 추출
"""

import json
import os
import re
import sys
import tarfile
import tempfile
from collections import defaultdict
from pathlib import Path

# Windows CP949 터미널 대응
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


# ── config ──────────────────────────────────────────────────────

BACKUP_DIR = Path(__file__).resolve().parent.parent / "server-backup"
BACKUP_TGZ = BACKUP_DIR / "2026-06-11" / "backend_backup.tar.gz"
FALLBACK_DATA = BACKUP_DIR / "2026-06-01" / "data"

TEAM_CODE_TO_NAME = {
    "OB": "두산", "HH": "한화", "HT": "KIA", "WO": "키움",
    "KT": "KT", "LG": "LG", "LT": "롯데", "NC": "NC",
    "SS": "삼성", "SK": "SSG",
}
TEAMS = list(TEAM_CODE_TO_NAME.keys())


# ── 1. data loading ────────────────────────────────────────────

def load_daily_scores(data_root: Path) -> dict:
    """daily-scores.json → {date_str: [games]}"""
    path = data_root / "daily-scores.json"
    if not path.exists():
        print(f"[ERROR] daily-scores.json not found: {path}")
        return {}
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    return raw.get("dates", {})


def load_game_records(data_root: Path) -> dict:
    """
    game-records → {gameId: record}

    Naver API 의 scoreBoard.rheb.away.r / home.r 을 ground truth 로 사용.
    {date}.json → gameIdx=0, {date}_dh2.json → gameIdx=1.
    """
    records = {}
    teams_dir = data_root / "teams"
    if not teams_dir.exists():
        print(f"[ERROR] teams directory not found: {teams_dir}")
        return records

    for team_code in TEAMS:
        gr_dir = teams_dir / team_code / "game-records"
        if not gr_dir.is_dir():
            continue
        for fpath in sorted(gr_dir.iterdir()):
            if not fpath.suffix == ".json":
                continue
            fname = fpath.stem  # "2025-05-17" or "2025-05-17_dh2"

            is_dh2 = fname.endswith("_dh2")
            game_idx = 1 if is_dh2 else 0

            try:
                with open(fpath, encoding="utf-8") as f:
                    data = json.load(f)
            except (json.JSONDecodeError, OSError):
                continue

            game_info = data.get("gameInfo", {})
            a_code = game_info.get("aCode", "")
            h_code = game_info.get("hCode", "")
            gdate = game_info.get("gdate", 0)  # YYYYMMDD int

            if not a_code or not h_code or not gdate:
                continue

            game_id = f"{gdate}-{a_code}{h_code}-{game_idx}"
            records[game_id] = data

    return records


# ── 2. score extraction ────────────────────────────────────────

def extract_gr_score(record: dict):
    """game-records 에서 (awayR, homeR, is_finished) 추출."""
    if not isinstance(record, dict):
        return None, None, False
    sb = (record.get("scoreBoard") or {})
    if not isinstance(sb, dict):
        return None, None, False
    rheb = sb.get("rheb", {}) or {}
    away_r = (rheb.get("away") or {}).get("r")
    home_r = (rheb.get("home") or {}).get("r")
    cancel_flag = (record.get("gameInfo") or {}).get("cancelFlag", "N")
    status_code = (record.get("gameInfo") or {}).get("statusCode", "")
    is_finished = ((status_code in ("1", "2") or cancel_flag == "Y")
                   and away_r is not None and home_r is not None)
    return away_r, home_r, is_finished


# ── 3. outcome semantics verification ───────────────────────────

def verify_outcome_semantics(daily_scores, records, sample_size=200):
    """
    outcome 필드의 의미를 동적으로 결정.

    **game-records로 점수가 검증된 게임만 사용** (비검증 게임은 swap 오염 가능성).
    outcome="W"/"L" 이 각각 어느 팀 승리인지 확인.

    Returns: {"W": "away"|"home", "L": "away"|"home"} or None.
    """
    w_away = w_home = l_away = l_home = 0
    checked = 0

    for _date_str, games in daily_scores.items():
        for g in games:
            if g.get("cancelled"):
                continue
            away_s = g.get("awayScore")
            home_s = g.get("homeScore")
            outcome = g.get("outcome")
            game_id = g.get("gameId", "")
            if away_s is None or home_s is None or not outcome or away_s == home_s:
                continue

            # game-records로 점수 검증된 게임만 사용 (swap 오염 방지)
            gr = records.get(game_id)
            if not gr:
                continue
            gr_away, gr_home, finished = extract_gr_score(gr)
            if not finished:
                continue
            if gr_away != away_s or gr_home != home_s:
                continue  # 점수 불일치 = swap 가능성, 제외

            checked += 1
            if home_s > away_s:
                if outcome == "W": w_home += 1
                elif outcome == "L": l_home += 1
            else:
                if outcome == "W": w_away += 1
                elif outcome == "L": l_away += 1
            if checked >= sample_size:
                break
        if checked >= sample_size:
            break

    print(f"\n── outcome 필드 시맨틱 검증 (game-records 검증 샘플 {checked}개) ──")
    print(f"  W & away wins: {w_away},  W & home wins: {w_home}")
    print(f"  L & away wins: {l_away},  L & home wins: {l_home}")

    if w_away > 0 and w_home == 0 and l_home > 0 and l_away == 0:
        print("  => W = away 승리, L = home 승리")
        return {"W": "away", "L": "home"}
    elif w_home > 0 and w_away == 0 and l_away > 0 and l_home == 0:
        print("  => W = home 승리, L = away 승리")
        return {"W": "home", "L": "away"}
    else:
        total = w_away + w_home + l_away + l_home
        if total > 0:
            pct_w_away = (w_away / (w_away + w_home) * 100) if (w_away + w_home) > 0 else 0
            pct_l_home = (l_home / (l_away + l_home) * 100) if (l_away + l_home) > 0 else 0
            print(f"  [WARN] 시맨틱 혼재: W=away {pct_w_away:.0f}%, L=home {pct_l_home:.0f}%")
            print(f"  [INFO] 이는 데이터 자체에 점수 swap 이 섞여 있음을 의미하며,")
            print(f"         game-records 자체도 일부 일관성 문제가 있을 수 있습니다.")
        return None


# ── 3b. semantic mix diagnosis ──────────────────────────────────

def diagnose_semantic_mix(daily_scores, records, n=20):
    """outcome 시맨틱이 혼재된 원인을 진단.

    1. 두 팀의 game-records 간 교차 검증 (rheb 일관성)
    2. daily-scores outcome vs 실제 승리팀 비교
    """
    print(f"\n── 시맨틱 혼재 원인 진단 (샘플 {n}개) ──")
    checked = 0
    for _date_str, games in daily_scores.items():
        for g in games:
            if g.get("cancelled"):
                continue
            away_s = g.get("awayScore")
            home_s = g.get("homeScore")
            outcome = g.get("outcome")
            game_id = g.get("gameId", "")
            if away_s is None or home_s is None or not outcome or away_s == home_s:
                continue

            gr = records.get(game_id)
            if not gr:
                continue
            gr_away, gr_home, finished = extract_gr_score(gr)
            if not finished:
                continue
            if gr_away != away_s or gr_home != home_s:
                continue  # only look at score-matched games

            checked += 1
            actual_winner = "away" if away_s > home_s else "home"
            outcome_consistent = (
                (outcome == "W" and actual_winner == "away")
                or (outcome == "L" and actual_winner == "home")
            )
            marker = "OK" if outcome_consistent else "MISMATCH"
            print(f"  [{marker}] {game_id}: {g['away']}@{g['home']} "
                  f"{away_s}-{home_s}, outcome={outcome}, actual_winner={actual_winner}")
            if checked >= n:
                break
        if checked >= n:
            break


# ── 4. main validation ─────────────────────────────────────────

def validate(daily_scores, records, outcome_semantics):
    """전수 비교: 점수 + outcome + home/away swap."""
    issues = defaultdict(list)
    counts = {"total": 0, "match": 0, "score_mismatch": 0, "outcome_mismatch": 0,
              "no_gr": 0, "not_finished": 0, "cancelled": 0, "missing_score": 0,
              "score_swapped": 0}

    swapped_games = []  # home/away score swapped

    for _date_str, games in daily_scores.items():
        for g in games:
            counts["total"] += 1
            game_id = g.get("gameId", "")
            away = g.get("away")
            home = g.get("home")
            away_s = g.get("awayScore")
            home_s = g.get("homeScore")
            outcome = g.get("outcome")
            cancelled = g.get("cancelled", False)

            if cancelled:
                counts["cancelled"] += 1
                continue

            if away_s is None or home_s is None:
                counts["missing_score"] += 1
                continue

            gr = records.get(game_id)
            if not gr:
                counts["no_gr"] += 1
                continue

            gr_away, gr_home, finished = extract_gr_score(gr)
            if not finished:
                counts["not_finished"] += 1
                continue

            # Score comparison
            score_ok = (gr_away == away_s and gr_home == home_s)
            score_swapped = (gr_away == home_s and gr_home == away_s)

            if score_ok:
                counts["match"] += 1
            elif score_swapped:
                counts["score_mismatch"] += 1
                counts["score_swapped"] += 1
                swapped_games.append((game_id, away, home, away_s, home_s, gr_away, gr_home))
                issues["score_swapped_home_away"].append(
                    f"{game_id}: daily {away}@{home} {away_s}-{home_s} "
                    f"→ 실제 Naver {gr_away}-{gr_home} (홈/원정 점수 바뀜)"
                )
            else:
                counts["score_mismatch"] += 1
                issues["score_value_mismatch"].append(
                    f"{game_id}: daily {away}@{home} {away_s}-{home_s} "
                    f"vs Naver {gr_away}-{gr_home}"
                )

            # Outcome check (only when scores verified OK)
            if score_ok and outcome_semantics and outcome and away_s != home_s:
                actual_winner = "away" if away_s > home_s else "home"
                declared_winner = outcome_semantics.get(outcome)
                if actual_winner != declared_winner:
                    counts["outcome_mismatch"] += 1
                    issues["outcome"].append(
                        f"{game_id}: {away}@{home} {away_s}-{home_s}, "
                        f"outcome={outcome}→{declared_winner}승, 실제 {actual_winner} 승리"
                    )

    return issues, counts, swapped_games


# ── 5. analysis helpers ────────────────────────────────────────

def categorize_swapped(swapped_games, daily_scores):
    """점수 swap 게임을 날짜별/연도별로 분류.
    특정 날짜에 몰려 있는지 (merge_scores.js 손상), 흩어져 있는지 (collector.py 실시간 버그) 판단.
    """
    by_year = defaultdict(int)
    by_date = defaultdict(int)
    for gid, away, home, as_, hs, gr_a, gr_h in swapped_games:
        date_key = gid[:8]  # YYYYMMDD
        by_date[date_key] += 1
        by_year[date_key[:4]] += 1

    # 특정 날짜에 몰려 있는지 확인
    dense_dates = [(d, c) for d, c in by_date.items() if c >= 3]
    dense_dates.sort()

    print(f"\n── 점수 swap 연도별 분포 ──")
    for yr in sorted(by_year):
        print(f"  {yr}: {by_year[yr]}건")
    if dense_dates:
        print(f"\n── 3건 이상 몰린 날짜 (merge_scores.js 손상 가능성) ──")
        for d, c in dense_dates:
            print(f"  {d}: {c}건")


def find_known_dates(daily_scores):
    """a84bcaf 에서 이미 수정된 날짜 (2025-05-11, 2025-05-17) 의 현재 상태 확인."""
    for target_date in ("2025-05-11", "2025-05-17"):
        games = daily_scores.get(target_date, [])
        if not games:
            print(f"  {target_date}: 데이터 없음")
            continue
        print(f"\n── {target_date} (a84bcaf 수정 이력) 현재 상태 ──")
        for g in games:
            print(f"  {g['gameId']}: {g['away']}@{g['home']} {g['awayScore']}-{g['homeScore']} "
                  f"outcome={g.get('outcome','?')} cancelled={g.get('cancelled',False)}")


# ── 6. report ──────────────────────────────────────────────────

def print_report(issues, counts):
    print(f"\n{'=' * 70}")
    print(f"  전수 검증 결과")
    print(f"{'=' * 70}")
    print(f"  전체 게임:               {counts['total']:>6}")
    print(f"  일치:                    {counts['match']:>6}")
    print(f"  점수 불일치 (swap):       {counts.get('score_swapped', 0):>6}")
    print(f"  점수 불일치 (값 다름):    {counts['score_mismatch'] - counts.get('score_swapped', 0):>6}")
    print(f"  outcome 불일치:           {counts['outcome_mismatch']:>6}")
    print(f"  game-records 없음:       {counts['no_gr']:>6}")
    print(f"  진행 중(미완료):          {counts['not_finished']:>6}")
    print(f"  취소:                    {counts['cancelled']:>6}")
    print(f"  점수 없음:               {counts['missing_score']:>6}")

    comparable = counts["total"] - counts["cancelled"] - counts["missing_score"] - counts["not_finished"] - counts["no_gr"]
    if comparable > 0:
        accuracy = counts["match"] / comparable * 100
        print(f"\n  비교 가능 게임 중 정확도: {accuracy:.1f}% ({counts['match']}/{comparable})")

    for category, items in sorted(issues.items()):
        print(f"\n── {category} ({len(items)}건) ──")
        for item in items[:50]:
            print(f"  {item}")
        if len(items) > 50:
            print(f"  ... 외 {len(items) - 50}건")


# ── 7. main ────────────────────────────────────────────────────

def main():
    if BACKUP_TGZ.exists():
        print(f"백업 tar: {BACKUP_TGZ}")
        with tempfile.TemporaryDirectory() as tmpdir:
            with tarfile.open(BACKUP_TGZ, "r:gz") as tar:
                members = [m for m in tar.getmembers()
                           if m.name.startswith("./repo/data/")
                           and (".json" in m.name or "game-records" in m.name)]
                print(f"  {len(members)} files extracting...")
                tar.extractall(tmpdir, members=members)
            return run_validation(Path(tmpdir) / "repo" / "data")
    elif FALLBACK_DATA.exists():
        print(f"추출된 백업: {FALLBACK_DATA}")
        return run_validation(FALLBACK_DATA)
    else:
        print("[ERROR] 백업 데이터를 찾을 수 없습니다.")
        print(f"  tar: {BACKUP_TGZ} (exists: {BACKUP_TGZ.exists()})")
        print(f"  dir: {FALLBACK_DATA} (exists: {FALLBACK_DATA.exists()})")
        return 1


def run_validation(data_root):
    print(f"데이터 로딩: {data_root}")

    daily_scores = load_daily_scores(data_root)
    n_games = sum(len(v) for v in daily_scores.values())
    print(f"  daily-scores: {n_games} games, {len(daily_scores)} dates")

    records = load_game_records(data_root)
    dh2_count = sum(1 for k in records if k.endswith("-1"))
    print(f"  game-records: {len(records)} records (DH2: {dh2_count})")

    # Step 1: outcome 시맨틱 검증
    semantics = verify_outcome_semantics(daily_scores, records)

    # Step 1b: 시맨틱 혼재 시 원인 진단
    if semantics is None:
        diagnose_semantic_mix(daily_scores, records)

    # Step 2: 전수 검증
    issues, counts, swapped = validate(daily_scores, records, semantics)

    # Step 3: swap 패턴 분석
    categorize_swapped(swapped, daily_scores)

    # Step 4: a84bcaf 수정 이력 확인
    find_known_dates(daily_scores)

    # Step 5: 최종 리포트
    print_report(issues, counts)

    total_swapped = len(swapped)
    print(f"\n{'=' * 70}")
    print(f"  결론")
    print(f"{'=' * 70}")
    if total_swapped == 0 and counts["outcome_mismatch"] == 0:
        print("  [OK] 모든 데이터 일치 - 문제 없음")
    else:
        print(f"  점수 swap: {total_swapped}건 (collector.py + build_season.py 영향)")
        print(f"  outcome 불일치: {counts['outcome_mismatch']}건")
    print(f"{'=' * 70}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
