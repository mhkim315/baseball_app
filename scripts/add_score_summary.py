"""Append /api/score-summary endpoint to server's main.py.
Run on the OCI server via: python3 add_score_summary.py
Or copy the output to the server."""

import os

APPEND_CODE = r"""
# --- Score summary (cached) ---

_DAILY_SCORES_CACHE = {"data": None, "cached_date": None}

_HISTORICAL_SCORING = {
  2020: {
    "KIA": {"avgRuns": 4.9, "totalRuns": 430, "totalGames": 87},
    "KT": {"avgRuns": 5.7, "totalRuns": 492, "totalGames": 87},
    "LG": {"avgRuns": 5.9, "totalRuns": 534, "totalGames": 91},
    "NC": {"avgRuns": 6.2, "totalRuns": 531, "totalGames": 86},
    "SK": {"avgRuns": 4.3, "totalRuns": 384, "totalGames": 90},
    "두산": {"avgRuns": 5.9, "totalRuns": 528, "totalGames": 90},
    "롯데": {"avgRuns": 5.0, "totalRuns": 428, "totalGames": 85},
    "삼성": {"avgRuns": 4.9, "totalRuns": 443, "totalGames": 90},
    "키움": {"avgRuns": 5.5, "totalRuns": 511, "totalGames": 93},
    "한화": {"avgRuns": 3.5, "totalRuns": 312, "totalGames": 89},
  },
  2021: {
    "KIA": {"avgRuns": 4.0, "totalRuns": 302, "totalGames": 76},
    "KT": {"avgRuns": 5.3, "totalRuns": 412, "totalGames": 78},
    "LG": {"avgRuns": 4.7, "totalRuns": 364, "totalGames": 77},
    "NC": {"avgRuns": 5.5, "totalRuns": 423, "totalGames": 77},
    "SSG": {"avgRuns": 5.2, "totalRuns": 424, "totalGames": 82},
    "두산": {"avgRuns": 5.2, "totalRuns": 396, "totalGames": 76},
    "롯데": {"avgRuns": 5.3, "totalRuns": 424, "totalGames": 80},
    "삼성": {"avgRuns": 5.2, "totalRuns": 425, "totalGames": 82},
    "키움": {"avgRuns": 5.3, "totalRuns": 439, "totalGames": 83},
    "한화": {"avgRuns": 3.9, "totalRuns": 317, "totalGames": 81},
  },
  2022: {
    "KIA": {"avgRuns": 5.2, "totalRuns": 485, "totalGames": 94},
    "KT": {"avgRuns": 4.5, "totalRuns": 417, "totalGames": 93},
    "LG": {"avgRuns": 5.1, "totalRuns": 479, "totalGames": 94},
    "NC": {"avgRuns": 4.1, "totalRuns": 381, "totalGames": 92},
    "SSG": {"avgRuns": 4.9, "totalRuns": 471, "totalGames": 96},
    "두산": {"avgRuns": 4.7, "totalRuns": 430, "totalGames": 91},
    "롯데": {"avgRuns": 4.1, "totalRuns": 398, "totalGames": 96},
    "삼성": {"avgRuns": 4.3, "totalRuns": 407, "totalGames": 94},
    "키움": {"avgRuns": 4.2, "totalRuns": 411, "totalGames": 97},
    "한화": {"avgRuns": 4.1, "totalRuns": 388, "totalGames": 95},
  },
  2023: {
    "KIA": {"avgRuns": 4.6, "totalRuns": 392, "totalGames": 85},
    "KT": {"avgRuns": 4.7, "totalRuns": 427, "totalGames": 91},
    "LG": {"avgRuns": 5.0, "totalRuns": 302, "totalGames": 60},
    "NC": {"avgRuns": 4.7, "totalRuns": 410, "totalGames": 88},
    "SSG": {"avgRuns": 4.7, "totalRuns": 276, "totalGames": 59},
    "두산": {"avgRuns": 4.1, "totalRuns": 243, "totalGames": 59},
    "롯데": {"avgRuns": 4.3, "totalRuns": 379, "totalGames": 88},
    "삼성": {"avgRuns": 4.3, "totalRuns": 394, "totalGames": 91},
    "키움": {"avgRuns": 4.2, "totalRuns": 265, "totalGames": 63},
    "한화": {"avgRuns": 4.2, "totalRuns": 366, "totalGames": 88},
  },
  2024: {
    "KIA": {"avgRuns": 6.1, "totalRuns": 546, "totalGames": 90},
    "KT": {"avgRuns": 5.3, "totalRuns": 481, "totalGames": 91},
    "LG": {"avgRuns": 5.4, "totalRuns": 501, "totalGames": 93},
    "NC": {"avgRuns": 5.4, "totalRuns": 477, "totalGames": 89},
    "SSG": {"avgRuns": 5.2, "totalRuns": 477, "totalGames": 91},
    "두산": {"avgRuns": 5.4, "totalRuns": 506, "totalGames": 94},
    "롯데": {"avgRuns": 5.4, "totalRuns": 474, "totalGames": 87},
    "삼성": {"avgRuns": 5.0, "totalRuns": 457, "totalGames": 91},
    "키움": {"avgRuns": 4.8, "totalRuns": 420, "totalGames": 88},
    "한화": {"avgRuns": 5.1, "totalRuns": 462, "totalGames": 90},
  },
  2025: {
    "KIA": {"avgRuns": 4.9, "totalRuns": 430, "totalGames": 88},
    "KT": {"avgRuns": 4.4, "totalRuns": 402, "totalGames": 91},
    "LG": {"avgRuns": 5.1, "totalRuns": 458, "totalGames": 90},
    "NC": {"avgRuns": 4.7, "totalRuns": 401, "totalGames": 85},
    "SSG": {"avgRuns": 4.1, "totalRuns": 354, "totalGames": 87},
    "두산": {"avgRuns": 4.4, "totalRuns": 384, "totalGames": 88},
    "롯데": {"avgRuns": 4.8, "totalRuns": 440, "totalGames": 91},
    "삼성": {"avgRuns": 5.1, "totalRuns": 451, "totalGames": 88},
    "키움": {"avgRuns": 3.7, "totalRuns": 334, "totalGames": 91},
    "한화": {"avgRuns": 4.7, "totalRuns": 414, "totalGames": 89},
  },
}


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
