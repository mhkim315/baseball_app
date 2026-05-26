"""
Naver API에서 팀 득실점을 가져와 피타고리안 승률 + 몬테카를로 시뮬레이션으로
포스트시즌 진출 확률을 계산, data/kbo_postseason_odds.json 출력.
"""
from __future__ import annotations

import json
import math
import random
import ssl
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

NAVER_BASE = "https://api-gw.sports.naver.com"
UA = "Mozilla/5.0 (baseball-refac-local/1.0)"
ROOT = Path(__file__).resolve().parents[1]
KST = timezone(timedelta(hours=9))
SIM_COUNT = 20000  # 몬테카를로 반복 횟수
PLAYOFF_SPOTS = 5  # KBO 포스트시즌 진출 팀 수


def fetch_json(url: str) -> dict[str, Any]:
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": UA})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))


def fetch_team_stats(year: int) -> list[dict[str, Any]]:
    data = fetch_json(f"{NAVER_BASE}/statistics/categories/kbo/seasons/{year}/teams")
    if data.get("code") != 200 or not data.get("success"):
        raise RuntimeError("Naver API returned error for team stats")
    return list(data.get("result", {}).get("seasonTeamStats") or [])


def load_local_schedule() -> list[dict[str, Any]]:
    """data/kbo_schedule_2026.json에서 전체 시즌 일정 로드."""
    path = ROOT / "data" / "kbo_schedule_2026.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    return list(data.get("games") or [])


def pythagorean_exp(runs_per_game: float, runs_allowed_per_game: float) -> float:
    """PythagenPat 지수."""
    return max(1.5, min(2.5, (runs_per_game + runs_allowed_per_game) ** 0.287))


def main():
    print("Fetching team stats...")
    stats = fetch_team_stats(2026)

    # Naver teamId → schedule name 매핑. teamName이 schedule과 일치.
    teams = {}
    for s in stats:
        tid = s["teamName"]  # schedule 파일과 일치하는 이름 (한글/영문 혼용)
        rs = s["offenseRun"]
        ra = s["defenseR"]
        g = s["gameCount"]
        teams[tid] = {
            "teamId": tid,
            "teamName": tid,
            "teamShortName": s.get("teamShortName", tid),
            "wins": s["winGameCount"],
            "losses": s["loseGameCount"],
            "draws": s["drawnGameCount"],
            "wra": s["wra"],
            "rs": rs,
            "ra": ra,
            "games": g,
            "rs_per_g": rs / g if g > 0 else 0,
            "ra_per_g": ra / g if g > 0 else 0,
            "ranking": s["ranking"],
        }

    # 피타고리안 승률 계산
    TOTAL_GAMES = 144
    for t in teams.values():
        exp = pythagorean_exp(t["rs_per_g"], t["ra_per_g"])
        t["py_exp"] = exp
        rs_pow = t["rs"] ** exp
        ra_pow = t["ra"] ** exp
        t["py_win_pct"] = rs_pow / (rs_pow + ra_pow) if (rs_pow + ra_pow) > 0 else 0.500
        t["py_wins"] = round(TOTAL_GAMES * t["py_win_pct"])
        print(f"  {t['teamName']}: RS={t['rs']} RA={t['ra']} G={t['games']} "
              f"exp={exp:.3f} py%={t['py_win_pct']:.3f} pyW={t['py_wins']}")

    # 남은 경기 수
    for t in teams.values():
        remaining = TOTAL_GAMES - t["games"]
        t["remaining"] = remaining
        py_remaining_wins = remaining * t["py_win_pct"] if remaining > 0 else 0
        t["py_proj_wins"] = round(t["wins"] + py_remaining_wins)

    # 로컬 전체 일정에서 미래 경기만 추출
    today_str = datetime.now(KST).strftime("%Y-%m-%d")
    print(f"\nLoading full schedule from kbo_schedule_2026.json...")
    all_schedule = load_local_schedule()
    future_games = [g for g in all_schedule if g["date"] >= today_str]
    print(f"  {len(all_schedule)} total games, {len(future_games)} remaining from {today_str}")

    # 이미 진행된 경기도 schedule에 포함되어 있을 수 있음
    # game results(Live Results)에 있는 날짜의 경기는 제외
    # 각 팀의 games 수와 schedule상 played games 수가 일치해야 함
    played_by_team = {tid: teams[tid]["games"] for tid in teams}
    # schedule에서 각 팀이 등장하는 횟수 = played + remaining
    # remaining = total_schedule_appearances - played
    for tid in teams:
        sched_count = sum(1 for g in all_schedule if g["away"] == tid or g["home"] == tid)
        remaining_from_sched = sched_count - played_by_team[tid]
        if remaining_from_sched < 0:
            remaining_from_sched = 0
        # played_by_team 기준 remaining과 sched 기준 remaining 중 작은 것 사용
        teams[tid]["sched_remaining"] = remaining_from_sched

    # 날짜 기준 미래 경기만, 그리고 우리가 아는 팀만
    future_games = [
        g for g in future_games
        if g["away"] in teams and g["home"] in teams
    ]
    print(f"  {len(future_games)} valid future games to simulate")

    # 시즌 진행률에 따른 회귀 강도 (적게 치를수록 .500에 가깝게 회귀)
    avg_games = sum(t["games"] for t in teams.values()) / len(teams)
    # 30G → 0.7, 60G → 0.54, 90G → 0.44, 120G → 0.37, 144G → 0.33
    regression_weight = max(0.05, 70 / (avg_games + 70))
    print(f"  Avg games: {avg_games:.0f}, regression to .500 weight: {regression_weight:.3f}")

    # 몬테카를로 시뮬레이션
    print(f"\nRunning {SIM_COUNT:,} Monte Carlo simulations...")
    playoff_counts = {tid: 0 for tid in teams}

    for sim_i in range(SIM_COUNT):
        if sim_i % 5000 == 0:
            print(f"  Simulation {sim_i}/{SIM_COUNT}...")

        # 각 팀 전력에 회귀 + 랜덤 노이즈 추가
        sim_py = {}
        for tid in teams:
            regressed = teams[tid]["py_win_pct"] * (1 - regression_weight) + 0.500 * regression_weight
            noise = random.gauss(0, 0.025)
            sim_py[tid] = max(0.250, min(0.750, regressed + noise))

        sim_wins = {tid: teams[tid]["wins"] for tid in teams}
        sim_draws = {tid: teams[tid]["draws"] for tid in teams}

        for game in future_games:
            away = game.get("away", "")  # local schedule: "away"/"home" (team names)
            home = game.get("home", "")
            if away not in teams or home not in teams:
                continue

            # log5 승률 계산: A가 B(홈)를 이길 확률
            a_py = sim_py[away]
            h_py = sim_py[home]
            # 홈 어드밴티지 (KBO 홈 승률 약 53%)
            home_adv = 1.03
            h_adj = h_py * home_adv / (h_py * home_adv + (1 - h_py))
            # log5
            a_win_prob = (a_py * (1 - h_adj)) / (a_py * (1 - h_adj) + (1 - a_py) * h_adj)

            r = random.random()
            draw_chance = 0.005  # 무승부 확률 약 0.5%
            if r < draw_chance:
                sim_draws[home] += 1
                sim_draws[away] += 1
            elif r < draw_chance + a_win_prob:
                sim_wins[away] += 1
            else:
                sim_wins[home] += 1

        # 최종 순위 계산 (승수 > 무승부 많은 쪽)
        ranked = sorted(teams.keys(), key=lambda tid: (sim_wins[tid], sim_draws[tid]), reverse=True)
        for i, tid in enumerate(ranked[:PLAYOFF_SPOTS]):
            playoff_counts[tid] += 1

    # 결과 정리
    print("\n=== Postseason Probability (Pythagorean + Monte Carlo) ===")
    results = []
    for tid in sorted(teams.keys(), key=lambda t: teams[t]["ranking"]):
        t = teams[tid]
        prob = playoff_counts[tid] / SIM_COUNT * 100
        results.append({
            "teamId": t["teamId"],
            "teamName": t["teamName"],
            "teamShortName": t["teamShortName"],
            "ranking": t["ranking"],
            "games": t["games"],
            "wins": t["wins"],
            "draws": t["draws"],
            "losses": t["losses"],
            "wra": round(t["wra"], 3),
            "rs": t["rs"],
            "ra": t["ra"],
            "pyWinPct": round(t["py_win_pct"], 4),
            "pyExp": round(t["py_exp"], 3),
            "pyWins": t["py_wins"],
            "pyProjWins": t["py_proj_wins"],
            "remaining": t["remaining"],
            "playoffProb": round(prob, 1),
        })
        print(f"  {t['teamName']:>6s} {t['ranking']:2d}위 | RS={t['rs']:3d} RA={t['ra']:3d} | "
              f"py%={t['py_win_pct']:.3f} | pyW={t['py_wins']:3d} | "
              f"가을야구 확률: {prob:5.1f}%")

    output = {
        "calculatedAt": datetime.now(KST).isoformat(timespec="seconds"),
        "source": "Naver API / PythagenPat + Monte Carlo",
        "simulations": SIM_COUNT,
        "totalGames": TOTAL_GAMES,
        "playoffSpots": PLAYOFF_SPOTS,
        "teams": results,
    }

    out_path = ROOT / "data" / "kbo_postseason_odds.json"
    out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSaved to {out_path}")


if __name__ == "__main__":
    main()
