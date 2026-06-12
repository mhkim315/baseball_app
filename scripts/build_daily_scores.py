"""모든 팀의 live-results.json을 읽어 날짜별 경기 점수 + 승패 정보를 data/daily-scores.json 으로 집계"""
from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KST = timezone(timedelta(hours=9))


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


def load_json(path: str):
    with open(ROOT / path, encoding="utf-8") as f:
        return json.load(f)


def main():
    index = load_json("data/teams/index.json")
    team_ids = [t["id"] for t in index["teams"]]

    scores_by_date = {}
    today_str = datetime.now(KST).strftime("%Y-%m-%d")

    for team_id in team_ids:
        try:
            data = load_json(f"data/teams/{team_id}/live-results.json")
        except (FileNotFoundError, json.JSONDecodeError):
            continue

        for date, day_data in (data.get("byDate") or {}).items():
            games_list = day_data if isinstance(day_data, list) else day_data.get("games") or []
            for game in games_list:
                dedup_key = game.get("gameId")
                if not dedup_key:
                    dedup_key = f"{game['away']}|{game['home']}|{game.get('awayScore')}|{game.get('homeScore')}"
                else:
                    dedup_key = f"{date}|{dedup_key}"

                if date not in scores_by_date:
                    scores_by_date[date] = {}
                if dedup_key in scores_by_date[date]:
                    continue

                scores_by_date[date][dedup_key] = {
                    "away": game["away"],
                    "home": game["home"],
                    "awayScore": game.get("awayScore"),
                    "homeScore": game.get("homeScore"),
                    "outcome": game.get("outcome"),
                    "cancelled": game.get("cancelled", False),
                    "awayStarter": game.get("awayStarter"),
                    "homeStarter": game.get("homeStarter"),
                    "winPitcher": game.get("winPitcher"),
                    "losePitcher": game.get("losePitcher"),
                    "_srcGameId": game.get("gameId", ""),
                }

    # Merge exhibition game scores
    current_year = datetime.now(KST).year
    for y in range(current_year, current_year - 2, -1):
        exh_path = ROOT / "data" / "exhibition-games-{0}.json".format(y)
        if not exh_path.exists():
            continue
        try:
            exh_data = json.loads(exh_path.read_text(encoding="utf-8"))
            for g in exh_data.get("games", []):
                if g.get("cancelled"):
                    continue
                date_raw = g.get("date", "")
                if len(date_raw) != 8:
                    continue
                date_key = "{0}-{1}-{2}".format(date_raw[:4], date_raw[4:6], date_raw[6:8])
                dedup_key = "exh|{0}|{1}|{2}".format(date_key, g["away"], g["home"])

                if date_key in scores_by_date and dedup_key in scores_by_date[date_key]:
                    continue

                outcome = g.get("outcome")

                src_gid = g.get("gameId", "")
                game_id = ""
                if src_gid and len(src_gid) >= 12:
                    game_id = "{0}-{1}-0".format(src_gid[:8], src_gid[8:12])

                entry = {
                    "away": g["away"],
                    "home": g["home"],
                    "awayScore": g.get("awayScore"),
                    "homeScore": g.get("homeScore"),
                    "outcome": outcome,
                    "cancelled": False,
                    "awayStarter": g.get("awayStarter"),
                    "homeStarter": g.get("homeStarter"),
                    "winPitcher": g.get("winPitcher"),
                    "losePitcher": g.get("losePitcher"),
                    "gameIdx": 0,
                    "gameId": game_id,
                }

                if date_key not in scores_by_date:
                    scores_by_date[date_key] = {}
                scores_by_date[date_key][dedup_key] = entry
        except Exception as e:
            print("Skipping exhibition merge for {0}: {1}".format(y, e))


    out_dates = {}
    for date, games in sorted(scores_by_date.items()):
        pair_groups = {}
        for dedup_key, game in games.items():
            key = f"{game['away']}|{game['home']}"
            if key not in pair_groups:
                pair_groups[key] = []
            pair_groups[key].append(game)

        entries = []
        for key, group in pair_groups.items():
            for idx, game in enumerate(group):
                game["gameIdx"] = idx
                src_gid = game.pop("_srcGameId", "")
                if src_gid and len(src_gid) >= 12:
                    game["gameId"] = f"{src_gid[:8]}-{src_gid[8:12]}-{idx}"
                entries.append(game)

        out_dates[date] = entries

    out = {
        "generatedAt": datetime.now(KST).isoformat(),
        "dates": out_dates,
    }

    out_path = ROOT / "data" / "daily-scores.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {out_path} ({len(out['dates'])} dates with scores)")


if __name__ == "__main__":
    main()
