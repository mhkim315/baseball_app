"""
오늘 날짜의 모든 KBO 경기 정보를 data/today-games.json 으로 집계합니다.
각 경기당 양팀 선발투수, 순위, 기록, 경기장, 시간 정보를 포함합니다.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KST = timezone(timedelta(hours=9))


def load_json(path: str):
    with open(ROOT / path, encoding="utf-8") as f:
        return json.load(f)


def build_team_map():
    """scheduleName -> team info 매핑 생성"""
    index = load_json("data/teams/index.json")
    result = {}
    for t in index["teams"]:
        for key in [t["scheduleName"], t["teamName"], t["teamShort"]]:
            result[key] = t
    return result


def today_str():
    return datetime.now(KST).strftime("%Y-%m-%d")


def find_game_for_team(team, today):
    """팀의 오늘 경기에서 상대팀 정보 찾기"""
    schedule = load_json("data/kbo_schedule_2026.json")
    by_team = schedule.get("byTeam", {})
    team_schedule = by_team.get(team["scheduleName"], [])
    for game in team_schedule:
        if game["date"] == today:
            return game
    return None


def _load_team_data(team_id, filename):
    """팀 데이터 파일 로드, 실패 시 None 반환."""
    try:
        return load_json(f"data/teams/{team_id}/{filename}")
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def starter_summary(starter):
    """선발투수 요약 정보 추출"""
    if not starter or not isinstance(starter, dict):
        return {"name": "미정"}
    info = starter.get("playerInfo") if isinstance(starter.get("playerInfo"), dict) else {}
    name = (
        info.get("name")
        or starter.get("name")
        or starter.get("playerName")
        or "미정"
    )
    name = str(name).strip()
    if name in ("??", "?"):
        name = "미정"
    result = {"name": name}
    for key in ("era", "wins", "losses", "whip"):
        val = starter.get(key) or (info.get(key) if info else None)
        if val is not None:
            result[key] = str(val) if not isinstance(val, (int, float)) else val
    return result


def fetch_naver_starters_for_date(target_date):
    """Naver API에서 target_date의 선발투수 정보를 가져옵니다.
    per-team 파일이 오늘 데이터로 덮어써져 내일 선발투수가 사라지는 문제를 보완합니다."""
    try:
        from naver_api import game_preview, schedule_games
        naver_games = schedule_games(target_date, target_date)
    except Exception:
        return {}

    result = {}
    for g in naver_games:
        if g.get("categoryId") != "kbo":
            continue
        away_name = g.get("awayTeamName", "")
        home_name = g.get("homeTeamName", "")
        game_id = str(g.get("gameId") or "")
        if not away_name or not home_name or not game_id:
            continue

        try:
            preview = game_preview(game_id)
        except Exception:
            continue

        preview_data = preview.get("previewData") or preview
        away_starter = starter_summary(preview_data.get("awayStarter"))
        home_starter = starter_summary(preview_data.get("homeStarter"))
        result[f"{away_name}-{home_name}"] = {
            "away": away_starter,
            "home": home_starter,
        }

    return result


def build_games_for_date(target_date, schedule, team_map):
    """지정된 날짜의 경기 정보를 빌드합니다."""
    day_games = [g for g in schedule.get("games", []) if g["date"] == target_date]
    if not day_games:
        return []

    games_out = []
    for g in day_games:
        away_name = g["away"]
        home_name = g["home"]
        away_team = team_map.get(away_name)
        home_team = team_map.get(home_name)

        if not away_team or not home_team:
            continue

        # 양팀의 lineup / preview 로드 (선발투수가 target_date에 맞는 쪽을 사용)
        home_lineup = _load_team_data(home_team["id"], "lineup.json")
        away_lineup = _load_team_data(away_team["id"], "lineup.json")
        home_preview = _load_team_data(home_team["id"], "game-preview.json")
        away_preview = _load_team_data(away_team["id"], "game-preview.json")

        # target_date에 맞는 lineup 선택
        lineup = None
        lineup_team_id = None
        for lu, tid in [(home_lineup, home_team["id"]), (away_lineup, away_team["id"])]:
            if lu and lu.get("meta", {}).get("lineupDate", "") == target_date:
                lineup = lu
                lineup_team_id = tid
                break

        # 선발투수용 preview: 경기 매칭 + gdate가 target_date와 일치하거나 가까운 것
        starter_preview = None
        starter_preview_team_id = None
        preview = None  # 순위/기록용은 아무 preview나 사용
        for pr, tid in [(home_preview, home_team["id"]), (away_preview, away_team["id"])]:
            if pr:
                if not preview:
                    preview = pr
                gi = pr.get("gameInfo") or {}
                preview_date = str(gi.get("gdate") or "")
                pr_home = gi.get("hName", "")
                pr_away = gi.get("aName", "")
                # 같은 매치업이고 날짜가 target_date와 같거나 하루 전이면 사용
                if pr_home == home_name and pr_away == away_name:
                    if preview_date == target_date.replace("-", ""):
                        starter_preview = pr
                        starter_preview_team_id = tid

        # 선발투수는 lineup.json에서만 (preview의 데이터는 날짜 불일치 가능)
        away_starter = {"name": "미정"}
        home_starter = {"name": "미정"}

        if lineup:
            # lineup의 teamId 기준으로 ours/theirs 매핑
            if lineup_team_id == home_team["id"]:
                home_starter = starter_summary(lineup.get("startingPitcher"))
                away_starter = starter_summary(lineup.get("opponentStartingPitcher"))
            else:
                home_starter = starter_summary(lineup.get("opponentStartingPitcher"))
                away_starter = starter_summary(lineup.get("startingPitcher"))

        # preview에서 팀 순위/기록 가져오기
        away_rank = None
        home_rank = None
        away_record = None
        home_record = None

        if preview:
            preview_data = preview if not isinstance(preview.get("previewData"), dict) else preview["previewData"]
            game_info = preview_data.get("gameInfo") or preview.get("gameInfo") or {}
            home_standings = preview_data.get("homeStandings") or preview.get("homeStandings")
            away_standings = preview_data.get("awayStandings") or preview.get("awayStandings")

            # homeStandings/awayStandings가 실제 홈/원정과 반대일 수 있으므로 보정
            if home_standings and away_standings:
                if home_standings.get("name") != home_name and away_standings.get("name") == home_name:
                    home_standings, away_standings = away_standings, home_standings

            if home_standings:
                home_rank = home_standings.get("rank")
                w = home_standings.get("w", 0)
                d = home_standings.get("d", 0)
                l_val = home_standings.get("l", 0)
                home_record = f"{w}승{d}무{l_val}패"
            if away_standings:
                away_rank = away_standings.get("rank")
                w = away_standings.get("w", 0)
                d = away_standings.get("d", 0)
                l_val = away_standings.get("l", 0)
                away_record = f"{w}승{d}무{l_val}패"

            # 선발투수를 preview에서도 보완 (lineup에 없고, preview 날짜가 일치할 경우)
            if starter_preview:
                sp_data = starter_preview if not isinstance(starter_preview.get("previewData"), dict) else starter_preview["previewData"]
                if home_starter["name"] == "미정" and sp_data.get("homeStarter"):
                    home_starter = starter_summary(sp_data["homeStarter"])
                if away_starter["name"] == "미정" and sp_data.get("awayStarter"):
                    away_starter = starter_summary(sp_data["awayStarter"])

        # 게임 시간 가져오기
        game_time = ""
        if preview:
            preview_data_inner = preview.get("previewData") or preview
            gi = preview_data_inner.get("gameInfo") or {}
            game_time = str(gi.get("gtime") or "").strip()

        game_entry = {
            "id": f"{target_date.replace('-', '')}-{away_team['kboCode']}{home_team['kboCode']}-0",
            "date": target_date,
            "venue": g.get("venue", ""),
            "time": game_time,
            "status": "scheduled",
            "away": {
                "id": away_team["id"],
                "name": away_name,
                "starter": away_starter,
                "rank": away_rank,
                "record": away_record,
            },
            "home": {
                "id": home_team["id"],
                "name": home_name,
                "starter": home_starter,
                "rank": home_rank,
                "record": home_record,
            },
            "score": {"away": None, "home": None},
        }

        # 완료된 경기면 daily-scores.json에서 점수 반영
        try:
            daily = load_json("data/daily-scores.json")
            date_scores = daily.get("dates", {}).get(target_date, [])
            for s in date_scores:
                if s.get("away") == away_name and s.get("home") == home_name:
                    if s.get("awayScore") is not None and s.get("homeScore") is not None:
                        game_entry["score"]["away"] = s["awayScore"]
                        game_entry["score"]["home"] = s["homeScore"]
                    if s.get("outcome"):
                        game_entry["status"] = "finished"
                    elif s.get("cancelled"):
                        game_entry["status"] = "cancelled"
                    elif s.get("awayScore") is not None and s.get("homeScore") is not None:
                        now_kst = datetime.now(KST)
                        if game_time:
                            try:
                                gh, gm = map(int, str(game_time).split(":")[:2])
                                game_start = now_kst.replace(hour=gh, minute=gm, second=0, microsecond=0)
                                game_entry["status"] = "live" if now_kst >= game_start else "scheduled"
                            except (ValueError, TypeError):
                                game_entry["status"] = "live"
                        else:
                            game_entry["status"] = "live"
                    break
        except (FileNotFoundError, json.JSONDecodeError):
            pass
        games_out.append(game_entry)

    return games_out


def build_games():
    today = today_str()
    schedule = load_json("data/kbo_schedule_2026.json")
    team_map = build_team_map()

    today_games = build_games_for_date(today, schedule, team_map)
    tomorrow = (datetime.now(KST) + timedelta(days=1)).strftime("%Y-%m-%d")
    tomorrow_games = build_games_for_date(tomorrow, schedule, team_map)

    # 내일 선발투수 보완: per-team 파일이 오늘 데이터로 덮어써졌으므로
    # Naver API에서 직접 내일 선발투수 정보를 가져옵니다.
    try:
        naver_starters = fetch_naver_starters_for_date(tomorrow)
        for game in tomorrow_games:
            key = f"{game['away']['name']}-{game['home']['name']}"
            ns = naver_starters.get(key)
            if ns:
                if game['away']['starter']['name'] == '미정' and ns['away']['name'] != '미정':
                    game['away']['starter'] = ns['away']
                if game['home']['starter']['name'] == '미정' and ns['home']['name'] != '미정':
                    game['home']['starter'] = ns['home']
    except Exception:
        pass  # Naver API 실패해도 무시 — 기존 "미정" 유지

    return {
        "date": today,
        "generatedAt": datetime.now(KST).isoformat(),
        "games": today_games,
        "noGames": len(today_games) == 0,
        "nextGames": tomorrow_games,
    }


def main():
    result = build_games()
    out_path = ROOT / "data" / "today-games.json"
    out_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {out_path} ({len(result['games'])} games)")


if __name__ == "__main__":
    main()
