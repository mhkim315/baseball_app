"""
Routes to append to /home/opc/fullcount_backend/main.py on the Oracle VM.

These 8 endpoints serve stadium and cheer data from existing JSON files
in /home/opc/fullcount_backend/repo/data/.
"""

ROUTES = '''
# --- Stadium & Cheer API ---

@app.get("/schedule")
def get_schedule():
    data = load_json("kbo_schedule_2026.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    return {"year": data.get("year"), "games": data.get("games", [])}


@app.get("/stadium-brief")
def get_stadium_briefs():
    data = load_json("stadium-brief.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    return data


@app.get("/stadium-brief/{stadium_id}")
def get_stadium_brief(stadium_id: str):
    data = load_json("stadium-brief.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    if stadium_id not in data:
        return JSONResponse({"error": "Stadium not found"}, status_code=404)
    return data[stadium_id]


@app.get("/stadium-foods/{stadium_id}")
def get_stadium_foods(stadium_id: str):
    data = load_json("food-places.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    stadiums = data.get("stadiums", {})
    if stadium_id not in stadiums:
        return JSONResponse({"error": "Stadium not found"}, status_code=404)
    return {"stadiumId": stadium_id, "places": stadiums[stadium_id]}


@app.get("/stadium-surroundings/{stadium_id}")
def get_stadium_surroundings(stadium_id: str):
    data = load_json("stadium-surroundings.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    stadiums = data.get("stadiums", {})
    if stadium_id not in stadiums:
        return JSONResponse({"error": "Stadium not found"}, status_code=404)
    return stadiums[stadium_id]


@app.get("/stadium-eats/{stadium_id}")
def get_stadium_eats(stadium_id: str):
    data = load_json("stadium-eats.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    stadiums = data.get("stadiums", {})
    if stadium_id not in stadiums:
        return JSONResponse({"error": "Stadium not found"}, status_code=404)
    return stadiums[stadium_id]


@app.get("/cheering-songs/{team_id}")
def get_cheering_songs(team_id: str):
    data = load_json("cheering-songs.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    teams = data.get("teams", {})
    if team_id not in teams:
        return JSONResponse({"error": "Team not found"}, status_code=404)
    return teams[team_id]


@app.get("/cheering-players/{team_id}")
def get_cheering_players(team_id: str):
    data = load_json("cheering-players.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)
    teams = data.get("teams", {})
    if team_id not in teams:
        return JSONResponse({"error": "Team not found"}, status_code=404)
    return teams[team_id]
'''

if __name__ == "__main__":
    # Print the routes for appending to main.py
    print(ROUTES)
