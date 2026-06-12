#!/usr/bin/env python3
"""
daily-scores.json 교차 검증 및 수정 스크립트

build_season.py 의 T_SCORE/B_SCORE swap 버그로 인해 뒤집힌 데이터를 찾아 수정.

[Phase 1] game-records(Naver API)가 있는 게임 → Naver data를 ground truth로 비교
[Phase 2] game-records가 없는 게임 → KBO API 재조회로 실제 점수 확인 (샘플링)
[Phase 3] swap이 확인된 게임 → 점수/outcome/선발투수 swap 되돌리기

Usage:
    python scripts/fix_swapped_scores.py --dry-run     # 검증만, 수정 안 함
    python scripts/fix_swapped_scores.py               # 실제 수정
    python scripts/fix_swapped_scores.py --sample 30   # KBO API 샘플 크기 지정
"""

import json
import os
import re
import ssl
import sys
import tarfile
import tempfile
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

KST = timezone(timedelta(hours=9))

# ── config ──────────────────────────────────────────────────────

BACKUP_DIR = Path(__file__).resolve().parent.parent / "server-backup"
BACKUP_TGZ = BACKUP_DIR / "2026-06-11" / "backend_backup.tar.gz"
FALLBACK_DATA = BACKUP_DIR / "2026-06-01" / "data"
OUTPUT_PATH = BACKUP_DIR / "daily-scores-fixed.json"

KBO_URL = "https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

TEAM_CODE_TO_NAME = {
    "OB": "두산", "HH": "한화", "HT": "KIA", "WO": "키움",
    "KT": "KT", "LG": "LG", "LT": "롯데", "NC": "NC",
    "SS": "삼성", "SK": "SSG",
}
TEAM_NAME_TO_CODE = {v: k for k, v in TEAM_CODE_TO_NAME.items()}
TEAMS = list(TEAM_CODE_TO_NAME.keys())

# KBO API code → our code mapping
KBO_ID_MAP = {
    "OB": "doosan", "LG": "lg", "WO": "kiwoom", "SK": "ssg",
    "KT": "kt", "HT": "kia", "HH": "hanwha", "SS": "samsung",
    "LT": "lotte", "NC": "nc",
}


# ── 1. data loading ────────────────────────────────────────────

def load_daily_scores(data_root: Path) -> dict:
    path = data_root / "daily-scores.json"
    if not path.exists():
        print(f"[ERROR] {path} not found")
        return {}
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    return {"meta": raw.get("generatedAt", ""), "dates": raw.get("dates", {})}


def load_game_records(data_root: Path) -> dict:
    records = {}
    teams_dir = data_root / "teams"
    if not teams_dir.exists():
        return records
    for team_code in TEAMS:
        gr_dir = teams_dir / team_code / "game-records"
        if not gr_dir.is_dir():
            continue
        for fpath in sorted(gr_dir.iterdir()):
            if not fpath.suffix == ".json":
                continue
            fname = fpath.stem
            is_dh2 = fname.endswith("_dh2")
            game_idx = 1 if is_dh2 else 0
            try:
                with open(fpath, encoding="utf-8") as f:
                    data = json.load(f)
            except (json.JSONDecodeError, OSError):
                continue
            gi = data.get("gameInfo", {})
            if not gi:
                continue
            a_code = gi.get("aCode", "")
            h_code = gi.get("hCode", "")
            gdate = gi.get("gdate", 0)
            if not a_code or not h_code or not gdate:
                continue
            game_id = f"{gdate}-{a_code}{h_code}-{game_idx}"
            records[game_id] = data
    return records


def extract_gr_score(record):
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
    finished = ((status_code in ("1", "2") or cancel_flag == "Y")
                and away_r is not None and home_r is not None)
    return away_r, home_r, finished


# ── 2. KBO API re-fetch (correct T/B mapping) ──────────────────

def fetch_kbo_games(date_str: str) -> list[dict]:
    """Fetch games for a date from KBO API with CORRECT T/B mapping.
    T_SCORE_CN = Top (away) team score
    B_SCORE_CN = Bottom (home) team score
    """
    params = urllib.parse.urlencode({
        "leId": 1, "srId": 0, "date": date_str,
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
            return data.get("game", [])
    except Exception as e:
        print(f"  KBO API fail ({date_str}): {e}")
        return []


def parse_kbo_game_correct(g: dict) -> dict | None:
    """Parse KBO API game with CORRECT T/B → away/home mapping.

    KBO API field convention:
      - T = Top (away team), B = Bottom (home team)
      - T_SCORE_CN = away score, B_SCORE_CN = home score
      - T_PIT_P_NM = away starter, B_PIT_P_NM = home starter
    """
    away_id = g.get("AWAY_ID", "")
    home_id = g.get("HOME_ID", "")
    away_code = KBO_TEAM_MAP.get(away_id)
    home_code = KBO_TEAM_MAP.get(home_id)
    if not away_code or not home_code:
        return None

    t_score = g.get("T_SCORE_CN", "").strip()
    b_score = g.get("B_SCORE_CN", "").strip()

    return {
        "away": away_code,
        "home": home_code,
        "awayScore": int(t_score) if t_score.isdigit() else None,  # T = away
        "homeScore": int(b_score) if b_score.isdigit() else None,  # B = home
        "awayStarter": (g.get("T_PIT_P_NM", "") or "").strip() or None,  # T_PIT = away
        "homeStarter": (g.get("B_PIT_P_NM", "") or "").strip() or None,  # B_PIT = home
        "cancelled": g.get("CANCEL_SC_NM", "") != "정상경기",
        "gameId": g.get("G_ID", ""),
    }


# ── 3. swap detection ──────────────────────────────────────────

def is_swapped(daily_game, gr_away, gr_home):
    """Check if daily-scores has home/away scores swapped."""
    ds_away = daily_game.get("awayScore")
    ds_home = daily_game.get("homeScore")
    if ds_away is None or ds_home is None:
        return False
    # Normal match
    if ds_away == gr_away and ds_home == gr_home:
        return False
    # Swapped match
    if ds_away == gr_home and ds_home == gr_away:
        return True
    # Neither match nor swap → different issue
    return None  # indeterminate


def compute_outcome(away_score, home_score):
    """Compute outcome based on scores. W = away won, L = home won."""
    if away_score is None or home_score is None:
        return None
    if away_score == home_score:
        return "T"
    return "W" if away_score > home_score else "L"


# ── 4. main fix logic ──────────────────────────────────────────

def analyze_and_fix(daily_scores_data, records, args):
    """Analyze and optionally fix swapped scores in daily-scores.json."""
    dates = daily_scores_data.get("dates", {})
    fixes_applied = []
    verification_results = {
        "total": 0, "correct": 0, "swapped": 0, "no_gr": 0,
        "kbo_verified": 0, "kbo_swapped": 0, "kbo_correct": 0,
        "cancelled": 0, "missing_score": 0, "indeterminate": 0,
    }

    # ── Phase 1: game-records 기반 검증 ──
    print(f"\n{'='*60}")
    print(f"  Phase 1: game-records(Naver) 기반 검증")
    print(f"{'='*60}")

    gr_swapped_games = []
    gr_correct_games = []
    gr_indeterminate = []

    for date_str in sorted(dates):
        for game in dates[date_str]:
            verification_results["total"] += 1
            gid = game.get("gameId", "")

            if game.get("cancelled"):
                verification_results["cancelled"] += 1
                continue
            if game.get("awayScore") is None or game.get("homeScore") is None:
                verification_results["missing_score"] += 1
                continue

            gr = records.get(gid)
            if not gr:
                verification_results["no_gr"] += 1
                continue

            gr_away, gr_home, finished = extract_gr_score(gr)
            if not finished:
                verification_results["no_gr"] += 1
                continue

            result = is_swapped(game, gr_away, gr_home)
            if result is True:
                verification_results["swapped"] += 1
                gr_swapped_games.append((date_str, game, gr_away, gr_home))
            elif result is False:
                verification_results["correct"] += 1
                gr_correct_games.append(game)
            else:
                verification_results["indeterminate"] += 1
                gr_indeterminate.append(game)

    print(f"  game-records 보유 & 완료: {verification_results['correct'] + verification_results['swapped'] + verification_results['indeterminate']}")
    print(f"    정상 (일치):    {verification_results['correct']}")
    print(f"    SWAP 발견:      {verification_results['swapped']}")
    print(f"    기타 불일치:    {verification_results['indeterminate']}")
    print(f"  game-records 없음: {verification_results['no_gr']}")

    if gr_swapped_games:
        print(f"\n  [Phase 1] game-records 기반 SWAP 확인 ({len(gr_swapped_games)}건):")
        for date_str, game, gr_away, gr_home in gr_swapped_games[:10]:
            print(f"    {game['gameId']}: daily {game['away']}@{game['home']} "
                  f"{game['awayScore']}-{game['homeScore']} → Naver {gr_away}-{gr_home}")

    # ── Phase 2: KBO API 샘플 검증 (game-records 없는 게임) ──
    sample_size = args.sample
    if sample_size > 0 and verification_results["no_gr"] > 0:
        print(f"\n{'='*60}")
        print(f"  Phase 2: KBO API 재조회 검증 (샘플 {sample_size}개)")
        print(f"  올바른 T(away)/B(home) 매핑으로 재조회")
        print(f"{'='*60}")

        no_gr_games = []
        for date_str in sorted(dates):
            for game in dates[date_str]:
                if game.get("cancelled"):
                    continue
                if game.get("awayScore") is None or game.get("homeScore") is None:
                    continue
                gid = game.get("gameId", "")
                if gid in records:
                    continue
                no_gr_games.append((date_str, game))

        # Sample evenly across years
        by_year = defaultdict(list)
        for date_str, game in no_gr_games:
            by_year[date_str[:4]].append((date_str, game))

        samples = []
        per_year = max(1, sample_size // max(1, len(by_year)))
        for yr, games in sorted(by_year.items()):
            step = max(1, len(games) // per_year)
            for i in range(0, min(len(games), per_year * step), step):
                samples.append(games[i])
                if len(samples) >= sample_size:
                    break
            if len(samples) >= sample_size:
                break
        samples = samples[:sample_size]

        print(f"  샘플링: {len(samples)}게임 (전체 {len(no_gr_games)}게임 중)")

        for i, (date_str, game) in enumerate(samples):
            ymd = date_str.replace("-", "")
            kbo_games = fetch_kbo_games(ymd)

            # Match by extracting team codes from gameId
            # gameId format: "20200505-OBLG-0" → away="OB", home="LG"
            gid = game.get("gameId", "")
            id_match = re.match(r"\d{8}-(\w{2})(\w{2})-\d", gid)
            if not id_match:
                print(f"  [{i+1}/{len(samples)}] {gid}: gameId 파싱 실패")
                continue
            ds_away_code = id_match.group(1)
            ds_home_code = id_match.group(2)

            # Find matching game in KBO response
            matched = None
            for kg in kbo_games:
                kg_away_id = kg.get("AWAY_ID", "")
                kg_home_id = kg.get("HOME_ID", "")
                if kg_away_id == ds_away_code and kg_home_id == ds_home_code:
                    matched = parse_kbo_game_correct(kg)
                    break

            if not matched:
                print(f"  [{i+1}/{len(samples)}] {game['gameId']}: KBO 매칭 실패")
                continue

            kbo_away = matched["awayScore"]
            kbo_home = matched["homeScore"]
            ds_away = game.get("awayScore")
            ds_home = game.get("homeScore")

            if kbo_away is None or kbo_home is None:
                continue

            if ds_away == kbo_home and ds_home == kbo_away:
                verification_results["kbo_swapped"] += 1
                if verification_results["kbo_swapped"] <= 5:
                    print(f"  [SWAP] {game['gameId']}: daily {ds_away}-{ds_home} → KBO(정확) {kbo_away}-{kbo_home}")
            elif ds_away == kbo_away and ds_home == kbo_home:
                verification_results["kbo_correct"] += 1
            else:
                pass  # other mismatch

            verification_results["kbo_verified"] += 1
            time.sleep(0.3)  # rate limit

        print(f"\n  KBO API 검증 결과 ({verification_results['kbo_verified']}건):")
        print(f"    SWAP 확인:  {verification_results['kbo_swapped']}")
        print(f"    정상:       {verification_results['kbo_correct']}")
        swap_pct = (verification_results["kbo_swapped"] / max(1, verification_results["kbo_verified"]) * 100)
        print(f"    SWAP 비율:  {swap_pct:.0f}%")

    # ── Phase 3: Apply fixes ──
    if args.dry_run:
        print(f"\n{'='*60}")
        print(f"  [DRY RUN] 수정 없이 검증만 수행. 수정하려면 --dry-run 제거.")
        print(f"{'='*60}")
        return fixes_applied, verification_results

    print(f"\n{'='*60}")
    print(f"  Phase 3: 데이터 수정")
    print(f"{'='*60}")

    # Fix game-records verified swaps
    gr_swap_map = {}  # gameId → (correct_away, correct_home)
    for date_str, game, gr_away, gr_home in gr_swapped_games:
        gr_swap_map[game["gameId"]] = (gr_away, gr_home)

    fixed_count = 0
    for date_str in sorted(dates):
        for game in dates[date_str]:
            gid = game.get("gameId", "")
            should_fix = False
            correct_away = game.get("awayScore")
            correct_home = game.get("homeScore")

            if gid in gr_swap_map:
                correct_away, correct_home = gr_swap_map[gid]
                should_fix = True
            elif verification_results["kbo_swapped"] >= verification_results["kbo_verified"] * 0.8:
                # If >80% of KBO-verified samples are swapped, apply blanket fix
                # to all games without game-records (build_season.py affected)
                if gid not in records and not game.get("cancelled"):
                    if game.get("awayScore") is not None and game.get("homeScore") is not None:
                        # Swap scores and outcome
                        correct_away = game["homeScore"]
                        correct_home = game["awayScore"]
                        should_fix = True

            if should_fix:
                old_as = game.get("awayScore")
                old_hs = game.get("homeScore")
                old_outcome = game.get("outcome")
                old_away_starter = game.get("awayStarter")
                old_home_starter = game.get("homeStarter")

                game["awayScore"] = correct_away
                game["homeScore"] = correct_home
                game["outcome"] = compute_outcome(correct_away, correct_home)
                # Swap starters too (build_season.py also swapped B_PIT/T_PIT)
                if old_away_starter or old_home_starter:
                    game["awayStarter"] = old_home_starter
                    game["homeStarter"] = old_away_starter

                fixed_count += 1
                fixes_applied.append({
                    "gameId": gid,
                    "date": date_str,
                    "away": game["away"],
                    "home": game["home"],
                    "oldScores": f"{old_as}-{old_hs}",
                    "newScores": f"{correct_away}-{correct_home}",
                    "oldOutcome": old_outcome,
                    "newOutcome": game["outcome"],
                    "source": "game-records" if gid in gr_swap_map else "kbo-sample-inferred",
                })

    print(f"  수정 완료: {fixed_count}건")
    return fixes_applied, verification_results


# ── 5. report ──────────────────────────────────────────────────

def print_summary(fixes, results):
    print(f"\n{'='*60}")
    print(f"  최종 요약")
    print(f"{'='*60}")
    print(f"  전체 게임:        {results['total']}")
    print(f"  정상 (game-records 검증): {results['correct']}")
    print(f"  SWAP 발견 (game-records): {results['swapped']}")
    print(f"  KBO 샘플 SWAP 확인:      {results['kbo_swapped']}/{results['kbo_verified']}")
    print(f"  기타 불일치:      {results['indeterminate']}")
    print(f"  수정 적용:        {len(fixes)}건")
    print(f"{'='*60}")


# ── 6. main ────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description="daily-scores.json swap fix")
    parser.add_argument("--dry-run", action="store_true", help="검증만, 수정 안 함")
    parser.add_argument("--sample", type=int, default=30, help="KBO API 샘플 크기 (0=스킵)")
    parser.add_argument("--output", type=str, default=None, help="Output path for fixed JSON")
    args = parser.parse_args()

    # Load data
    if BACKUP_TGZ.exists():
        print(f"백업 tar: {BACKUP_TGZ}")
        with tempfile.TemporaryDirectory() as tmpdir:
            with tarfile.open(BACKUP_TGZ, "r:gz") as tar:
                members = [m for m in tar.getmembers()
                           if m.name.startswith("./repo/data/")
                           and (".json" in m.name or "game-records" in m.name)]
                print(f"  {len(members)} files extracting...")
                tar.extractall(tmpdir, members=members)
            data_root = Path(tmpdir) / "repo" / "data"
            return run(data_root, args)
    elif FALLBACK_DATA.exists():
        print(f"추출된 백업: {FALLBACK_DATA}")
        return run(FALLBACK_DATA, args)
    else:
        print("[ERROR] No backup data found")
        return 1


def run(data_root, args):
    daily_scores_data = load_daily_scores(data_root)
    n_games = sum(len(v) for v in daily_scores_data.get("dates", {}).values())
    print(f"daily-scores: {n_games} games, {len(daily_scores_data.get('dates', {}))} dates")

    records = load_game_records(data_root)
    dh2_count = sum(1 for k in records if k.endswith("-1"))
    print(f"game-records: {len(records)} records (DH2: {dh2_count})")

    fixes, results = analyze_and_fix(daily_scores_data, records, args)
    print_summary(fixes, results)

    # Save if not dry-run
    if not args.dry_run and fixes:
        output_path = args.output or str(OUTPUT_PATH)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(daily_scores_data, f, ensure_ascii=False, indent=2)
        print(f"\n수정된 파일 저장: {output_path}")

    return 0


# KBO_TEAM_MAP for the KBO API parsing (separate from file-level one)
KBO_TEAM_MAP = KBO_ID_MAP


if __name__ == "__main__":
    sys.exit(main())
