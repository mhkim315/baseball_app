"""KBO GetLineUpAnalysis 응답에 후보선수 데이터가 있는지 확인."""
import json
from build_lineup_from_naver import pick_game, fetch_kbo_lineup, team_by_code, fetch_kbo_games, is_home_kbo
from team_config import selected_teams, team_by_code as team_by_code2

# 오늘 날짜로 아무 팀이나 선택
team = selected_teams("doosan")[0]
print(f"Team: {team['id']} ({team['scheduleName']})")

from build_lineup_from_naver import kst_today
date = kst_today()
print(f"Date: {date}")

from naver_api import schedule_games
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))
start = datetime.fromisoformat(date[:10]).date()

game_found = None
for i in range(3):
    ds = (start + timedelta(days=i)).isoformat()
    for game in schedule_games(ds, ds):
        if game.get("categoryId") != "kbo":
            continue
        if team["scheduleName"] in (game.get("homeTeamName"), game.get("awayTeamName")) or team["kboCode"] in (game.get("homeTeamCode"), game.get("awayTeamCode")):
            game_found = (ds, game)
            break
    if game_found:
        break

if not game_found:
    print("No upcoming game found")
    exit()

day, game = game_found
print(f"Game: {game.get('homeTeamName')} vs {game.get('awayTeamName')} on {day}")

# Find KBO game ID
kbo_games = fetch_kbo_games(day)
for row in kbo_games:
    away = team_by_code(str(row.get("AWAY_ID") or ""))
    home = team_by_code(str(row.get("HOME_ID") or ""))
    if away and home and team["id"] in (away["id"], home["id"]):
        game_id = str(row.get("G_ID") or "")
        season_id = str(row.get("SEASON_ID") or "2026")
        print(f"KBO Game ID: {game_id}, Season: {season_id}")

        data = fetch_kbo_lineup(game_id, season_id)
        print(f"\nTotal blocks in response: {len(data)}")

        for idx, block in enumerate(data):
            print(f"\n--- Block {idx} ---")
            if isinstance(block, str):
                try:
                    parsed = json.loads(block)
                    print(f"  Type: string that contains JSON")
                    if isinstance(parsed, dict):
                        print(f"  Keys: {list(parsed.keys())}")
                        # Check for rows
                        rows = parsed.get("rows", [])
                        print(f"  Rows count: {len(rows)}")
                        if rows:
                            print(f"  First row: {rows[0]}")
                            print(f"  Last row: {rows[-1]}")
                    elif isinstance(parsed, list):
                        print(f"  List length: {len(parsed)}")
                        if parsed:
                            print(f"  First item: {parsed[0]}")
                except json.JSONDecodeError:
                    print(f"  String (first 200 chars): {block[:200]}")
            elif isinstance(block, dict):
                print(f"  Keys: {list(block.keys())}")
            elif isinstance(block, list):
                print(f"  List length: {len(block)}")
                if block:
                    print(f"  First item type: {type(block[0])}")
                    print(f"  First item: {block[0][:200] if isinstance(block[0], str) else block[0]}")
            else:
                print(f"  Type: {type(block)}, Value: {block}")
        break
    break
