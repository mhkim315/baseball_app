"""Naver API에서 KBO 순위 데이터를 가져와 data/kbo_standings.json 갱신.
daily-scores.json을 추가로 읽어 각 팀 최근 10경기 결과(last10)를 직접 계산.

Usage:
    python3 scripts/fetch_kbo_standings.py                    # 2026 시즌 (기본)
    python3 scripts/fetch_kbo_standings.py --year 2020        # 과거 시즌
    python3 scripts/fetch_kbo_standings.py --year 2020,2021   # 여러 시즌
"""
from __future__ import annotations

import argparse
import json
import ssl
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KST = timezone(timedelta(hours=9))


def determine_result(team_name: str, away: str, home: str, away_score: int, home_score: int) -> str | None:
    """주어진 팀 관점에서 승/W/무/D/패/L 반환.
    daily-scores.json은 outcome이 원정팀 기준이므로 점수로 직접 판정."""
    if away_score is None or home_score is None:
        return None
    if away_score == home_score:
        return "D"
    is_home = (team_name == home)
    if is_home:
        return "W" if home_score > away_score else "L"
    else:
        return "W" if away_score > home_score else "L"


def compute_last10(team_name: str, year: int, daily_scores: dict) -> str | None:
    """daily-scores.json에서 특정 팀의 최근 10경기(취소 제외) 결과를 계산.
    Returns "W-D-L" format string (e.g. "7-1-2" = 7승1무2패) or None if no games."""
    results: list[str] = []
    dates = daily_scores.get("dates", {})
    # 최신 날짜부터 내림차순 정렬
    for date_str in sorted(dates.keys(), reverse=True):
        if not date_str.startswith(str(year)):
            continue
        for game in sorted(dates[date_str], key=lambda g: g.get("gameIdx", 0)):
            if game.get("cancelled") or game.get("outcome") is None:
                continue
            if game.get("away") != team_name and game.get("home") != team_name:
                continue
            r = determine_result(
                team_name,
                game.get("away"),
                game.get("home"),
                game.get("awayScore"),
                game.get("homeScore"),
            )
            if r is not None:
                results.append(r)
                if len(results) == 10:
                    break
        if len(results) == 10:
            break

    if not results:
        return None

    w = results.count("W")
    d = results.count("D")
    l = results.count("L")
    return f"{w}-{l}-{d}"


def fetch_standings(year: int, daily_scores: dict | None = None) -> list[dict] | None:
    url = f"https://api-gw.sports.naver.com/statistics/categories/kbo/seasons/{year}/teams"
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "baseball-refac/1.0"})
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"  ERROR fetching standings for {year}: {e}")
        return None

    if data.get("code") != 200 or not data.get("success"):
        print(f"  API returned error for {year}")
        return None

    teams = data.get("result", {}).get("seasonTeamStats", [])
    if not teams:
        print(f"  No seasonTeamStats in response")
        return None

    rows = []
    for t in sorted(teams, key=lambda x: x["ranking"]):
        w = t["winGameCount"]
        d = t["drawnGameCount"]
        l = t["loseGameCount"]

        game_count = t.get("gameCount")

        # Compute last10 from our own game results data
        last10 = None
        if daily_scores is not None:
            last10 = compute_last10(t["teamName"], year, daily_scores)
            if last10:
                print(f"    {t['teamName']}: last10 = {last10}")

        rows.append({
            "rank": t["ranking"],
            "teamName": t["teamName"],
            "winRate": round(t["wra"], 3),
            "wlt": f"{w}승{d}무{l}패",
            "gamesBehind": round(float(t.get("gameBehind", 0)), 1),
            "streak": t.get("continuousGameResult", ""),
            "gamesPlayed": game_count,
            "last10": last10,
        })

    return rows


def load_daily_scores(year: int) -> dict | None:
    """daily-scores.json을 로드. 없으면 None 반환."""
    path = ROOT / "data" / "daily-scores.json"
    if not path.exists():
        print(f"  WARNING: {path} not found, skipping last10 computation")
        return None
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"  WARNING: cannot load daily-scores.json: {e}")
        return None


def main():
    ap = argparse.ArgumentParser(description="Fetch KBO standings for one or more seasons")
    ap.add_argument("--year", default="2026", help="Season year(s), comma-separated (default: 2026)")
    args = ap.parse_args()

    years = [int(y.strip()) for y in args.year.split(",") if y.strip()]
    current_season = datetime.now(KST).year
    daily_scores = load_daily_scores(current_season)

    for year in years:
        print(f"Fetching standings for {year}...")
        rows = fetch_standings(year, daily_scores=daily_scores)
        if rows is None:
            continue

        out_path = ROOT / "data" / f"kbo_standings_{year}.json"
        source = f"Naver API / statistics/categories/kbo/seasons/{year}/teams"
        out = {
            "source": source,
            "year": year,
            "fetchedAt": datetime.now(KST).isoformat(timespec="seconds"),
            "rows": rows,
        }
        out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  Wrote {len(rows)} teams -> {out_path}")

        # Also update kbo_standings.json if this is the current season (backwards compat)
        if year == current_season:
            compat_path = ROOT / "data" / "kbo_standings.json"
            compat_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"  Also updated kbo_standings.json (current season)")

    print("Done!")


if __name__ == "__main__":
    main()
