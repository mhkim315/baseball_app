"""Append /api/score-summary endpoint to server's main.py.
Run on the OCI server via: python3 add_score_summary.py
Or copy the output to the server."""

import os

APPEND_CODE = r"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from shared.scoring_data import _HISTORICAL_SCORING

# --- Score summary (cached) ---

_DAILY_SCORES_CACHE = {"data": None, "cached_date": None}


@app.get("/api/score-summary/{year}")
def get_score_summary(year: int):
    if year in _HISTORICAL_SCORING:
        teams = []
        for team_name, info in sorted(_HISTORICAL_SCORING[year].items()):
            teams.append({
                "teamName": team_name,
                "avgRuns": info["avgRuns"],
                "totalRuns": info["totalRuns"],
                "totalGames": info["totalGames"],
            })
        return {"year": year, "teams": teams}

    today = date.today()
    if _DAILY_SCORES_CACHE["data"] is None or _DAILY_SCORES_CACHE["cached_date"] != today:
        data = load_json("daily-scores.json")
        if data is None:
            return JSONResponse({"error": "Data not found"}, status_code=404)
        _DAILY_SCORES_CACHE["data"] = data
        _DAILY_SCORES_CACHE["cached_date"] = today

    dates = _DAILY_SCORES_CACHE["data"].get("dates", {})
    team_runs = {}
    team_games = {}
    for date_str, games in dates.items():
        if not date_str.startswith(str(year)):
            continue
        for game in games:
            if game.get("cancelled") or game.get("outcome") is None:
                continue
            team_runs[game["away"]] = team_runs.get(game["away"], 0) + game["awayScore"]
            team_games[game["away"]] = team_games.get(game["away"], 0) + 1
            team_runs[game["home"]] = team_runs.get(game["home"], 0) + game["homeScore"]
            team_games[game["home"]] = team_games.get(game["home"], 0) + 1
    teams = []
    for team in sorted(team_runs):
        games = team_games.get(team, 0)
        teams.append({
            "teamName": team,
            "avgRuns": round(team_runs[team] / games, 1) if games > 0 else 0,
            "totalRuns": team_runs[team],
            "totalGames": games,
        })
    return {"year": year, "teams": teams}
"""


def main():
    path = "/home/opc/fullcount_backend/main.py"
    with open(path, "r") as f:
        content = f.read()

    # Remove any previous broken append
    marker = "# --- Score summary (cached) ---"
    idx = content.find(marker)
    if idx != -1:
        content = content[:idx]

    content += APPEND_CODE

    # Verify syntax
    compile(content, path, "exec")

    with open(path, "w") as f:
        f.write(content)

    print("Done. main.py updated successfully.")


if __name__ == "__main__":
    main()
