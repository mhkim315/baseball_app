"""Naver API에서 KBO 순위 데이터를 가져와 data/kbo_standings.json 갱신.

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


def fetch_standings(year: int) -> list[dict] | None:
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
    rows = []
    for t in sorted(teams, key=lambda x: x["ranking"]):
        w = t["winGameCount"]
        d = t["drawnGameCount"]
        l = t["loseGameCount"]
        rows.append({
            "rank": t["ranking"],
            "teamName": t["teamName"],
            "winRate": round(t["wra"], 3),
            "wlt": f"{w}승{d}무{l}패",
            "gamesBehind": round(float(t.get("gameBehind", 0)), 1),
            "streak": t.get("continuousGameResult", ""),
        })

    return rows


def main():
    ap = argparse.ArgumentParser(description="Fetch KBO standings for one or more seasons")
    ap.add_argument("--year", default="2026", help="Season year(s), comma-separated (default: 2026)")
    args = ap.parse_args()

    years = [int(y.strip()) for y in args.year.split(",") if y.strip()]
    current_season = datetime.now(KST).year

    for year in years:
        print(f"Fetching standings for {year}...")
        rows = fetch_standings(year)
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
