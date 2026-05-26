"""Naver API로 경기 결과 수집. KBO API는 폴백."""
from __future__ import annotations

import argparse
import json
import ssl
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from team_config import ROOT, selected_teams, team_by_code

KST = timezone(timedelta(hours=9))
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"


def kst_today() -> str:
    return datetime.now(KST).date().isoformat()


def fetch_naver_games(from_date: str, to_date: str) -> list[dict[str, Any]]:
    """Naver API에서 경기 목록 + 결과 가져오기."""
    url = ("https://api-gw.sports.naver.com/schedule/games"
           f"?fields=all&fromDate={from_date}&toDate={to_date}&size=100&categoryId=kbo")
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": UA})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=45, context=ctx) as resp:
        data = json.loads(resp.read().decode("utf-8", errors="replace"))
    if data.get("code") != 200 or not data.get("success"):
        return []
    return list(data.get("result", {}).get("games") or [])


def entry_from_naver(game: dict[str, Any], team: dict[str, Any]) -> dict[str, Any] | None:
    """Naver 경기 데이터 → live-results entry."""
    away_name = game.get("awayTeamName", "")
    home_name = game.get("homeTeamName", "")
    away_code = game.get("awayTeamCode", "")
    home_code = game.get("homeTeamCode", "")

    # 팀 매칭
    is_away = team["scheduleName"] in (away_name, game.get("awayTeamShortName", "")) or team["kboCode"] == away_code
    is_home = team["scheduleName"] in (home_name, game.get("homeTeamShortName", "")) or team["kboCode"] == home_code
    if not is_away and not is_home:
        return None

    away_score = int(game.get("awayTeamScore") or 0)
    home_score = int(game.get("homeTeamScore") or 0)
    our_score = away_score if is_away else home_score
    opp_score = home_score if is_away else away_score

    cancelled = bool(game.get("cancel"))
    status = game.get("statusCode", "")

    # 미래 경기(BEFORE)는 결과에 포함하지 않음
    if status == "BEFORE" and not cancelled:
        return None

    finished = status in ("END", "RESULT")
    outcome = None
    if not cancelled and finished:
        winner = game.get("winner", "")
        if winner == "AWAY":
            outcome = "W" if is_away else "L"
        elif winner == "HOME":
            outcome = "W" if is_home else "L"
        elif winner == "DRAW":
            outcome = "T"
        # fallback: winner가 없어도 점수 차이로 승패 판정
        elif our_score > opp_score:
            outcome = "W"
        elif our_score < opp_score:
            outcome = "L"
        elif our_score == opp_score and our_score > 0:
            outcome = "T"

    return {
        "away": away_name,
        "home": home_name,
        "venue": game.get("stadium") or game.get("stadiumName") or "",
        "awayScore": away_score,
        "homeScore": home_score,
        "scoreLine": f"{away_score}-{home_score}",
        "ourScore": our_score,
        "oppScore": opp_score,
        "ourScoreLine": f"{our_score}-{opp_score}",
        "outcome": outcome,
        "cancelled": cancelled,
        "gameId": game.get("gameId"),
        "awayStarter": str(game.get("awayStarterName") or "").strip() or None,
        "homeStarter": str(game.get("homeStarterName") or "").strip() or None,
        "winPitcher": str(game.get("winPitcherName") or "").strip() or None,
        "losePitcher": str(game.get("losePitcherName") or "").strip() or None,
    }


def target_dates(args: argparse.Namespace) -> list[str]:
    if args.date:
        return sorted(set(args.date))
    if args.recent:
        today = datetime.now(KST).date()
        return [(today - timedelta(days=i)).isoformat() for i in range(args.recent - 1, -1, -1)]
    return [kst_today()]


def load_existing(team_id: str, team_name: str) -> dict[str, Any]:
    path = ROOT / "data" / "teams" / team_id / "live-results.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"team": team_name, "source": "Naver API", "byDate": {}}


def main() -> None:
    ap = argparse.ArgumentParser(description="Fetch KBO game results from Naver API (KBO API fallback)")
    ap.add_argument("--team")
    ap.add_argument("--date", action="append")
    ap.add_argument("--recent", type=int, default=30)
    args = ap.parse_args()

    wanted = selected_teams(args.team)
    payloads = {team["id"]: load_existing(team["id"], team["scheduleName"]) for team in wanted}

    all_dates = target_dates(args)
    if len(all_dates) > 1:
        from_d = all_dates[0]
        to_d = all_dates[-1]
        print(f"Fetching {from_d} ~ {to_d} ({len(all_dates)} days) in one request")
        try:
            games = fetch_naver_games(from_d, to_d)
        except Exception as exc:
            print(f"Naver API failed: {exc}")
            games = []
        # 날짜별로 그룹화
        by_date = {}
        for g in games:
            d = g.get("gameDate") or str(g.get("gameDateTime", ""))[:10]
            by_date.setdefault(d, []).append(g)
        for ds in all_dates:
            day_games = by_date.get(ds, [])
            if not day_games:
                # 개별 요청 폴백
                try:
                    day_games = fetch_naver_games(ds, ds)
                except Exception:
                    continue
            for team in wanted:
                results = []
                for game in day_games:
                    item = entry_from_naver(game, team)
                    if item:
                        results.append(item)
                if results:
                    payloads[team["id"]].setdefault("byDate", {})[ds] = {"games": results}
    else:
        # 단일 날짜는 기존 방식
        ds = all_dates[0]
        try:
            day_games = fetch_naver_games(ds, ds)
        except Exception as exc:
            print(f"{ds}: Naver API failed: {exc}")
            day_games = []
        for team in wanted:
            results = []
            for game in day_games:
                item = entry_from_naver(game, team)
                if item:
                    results.append(item)
            if results:
                payloads[team["id"]].setdefault("byDate", {})[ds] = {"games": results}

    fetched_at = datetime.now(KST).isoformat(timespec="seconds")
    for team in wanted:
        out = payloads[team["id"]]
        out.update({"team": team["scheduleName"], "source": "Naver API (api-gw.sports.naver.com)", "fetchedAt": fetched_at})
        path = ROOT / "data" / "teams" / team["id"] / "live-results.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
