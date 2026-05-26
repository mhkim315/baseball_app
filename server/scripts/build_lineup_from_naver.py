from __future__ import annotations

import argparse
import json
import ssl
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any

from naver_api import game_preview, schedule_games
from team_config import ROOT, selected_teams, team_by_code

KST = timezone(timedelta(hours=9))
KBO_LIST_URL = "https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList"
KBO_LINEUP_URL = "https://www.koreabaseball.com/ws/Schedule.asmx/GetLineUpAnalysis"
MIN_EXPECTED_BATTERS = 5
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"


def kst_today() -> str:
    return datetime.now(KST).date().isoformat()


def kst_now() -> str:
    return datetime.now(KST).isoformat(timespec="seconds")


def post_kbo(url: str, fields: dict[str, Any]) -> Any:
    body = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(
        url, data=body, method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "ko-KR,ko;q=0.9",
            "Referer": "https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx",
            "User-Agent": UA,
        },
    )
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=45, context=ctx) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))


def fetch_kbo_games(iso_date: str) -> list[dict[str, Any]]:
    data = post_kbo(KBO_LIST_URL, {"leId": 1, "srId": 0, "date": iso_date.replace("-", "")})
    if isinstance(data, dict) and data.get("code") == "100":
        return list(data.get("game") or [])
    return []


def fetch_kbo_lineup(game_id: str, season_id: str) -> tuple[list[Any], bool]:
    """KBO API에서 라인업 + 확정 여부 반환. 실패 시 ([], False)."""
    try:
        data = post_kbo(KBO_LINEUP_URL, {"leId": 1, "srId": 0, "seasonId": season_id, "gameId": game_id})
    except Exception:
        return [], False
    if not isinstance(data, list) or len(data) < 5:
        return [], False
    # Block 0: LINEUP_CK
    lineup_ck = False
    if data[0] and isinstance(data[0], list) and data[0]:
        try:
            ck = json.loads(data[0][0]) if isinstance(data[0][0], str) else data[0][0]
            lineup_ck = ck.get("LINEUP_CK", False) if isinstance(ck, dict) else False
        except (json.JSONDecodeError, TypeError):
            pass
    return data, lineup_ck


def pick_game(team: dict[str, Any], start_date: str, days: int = 21) -> tuple[str, dict[str, Any]] | None:
    start = datetime.fromisoformat(start_date[:10]).date()
    for i in range(days):
        ds = (start + timedelta(days=i)).isoformat()
        for game in schedule_games(ds, ds):
            if game.get("categoryId") != "kbo":
                continue
            if team["scheduleName"] in (game.get("homeTeamName"), game.get("awayTeamName")) or team["kboCode"] in (game.get("homeTeamCode"), game.get("awayTeamCode")):
                return ds, game
    return None


def find_kbo_game(team: dict[str, Any], iso_date: str, naver_game: dict[str, Any]) -> dict[str, Any] | None:
    opponent = naver_game.get("awayTeamName") if is_home_naver(team, naver_game) else naver_game.get("homeTeamName")
    for row in fetch_kbo_games(iso_date):
        away = team_by_code(str(row.get("AWAY_ID") or ""))
        home = team_by_code(str(row.get("HOME_ID") or ""))
        ids = {away.get("id") if away else None, home.get("id") if home else None}
        names = {away.get("scheduleName") if away else None, home.get("scheduleName") if home else None}
        if team["id"] in ids and (not opponent or opponent in names):
            return row
    return None


def is_home_naver(team: dict[str, Any], game: dict[str, Any]) -> bool:
    return team["scheduleName"] == game.get("homeTeamName") or team["kboCode"] == game.get("homeTeamCode")


def is_home_kbo(team: dict[str, Any], row: dict[str, Any]) -> bool:
    return str(row.get("HOME_ID") or "") == team["kboCode"]


def table_rows(block: Any) -> list[dict[str, Any]]:
    if not isinstance(block, list) or not block or not isinstance(block[0], str):
        return []
    try:
        table = json.loads(block[0])
    except json.JSONDecodeError:
        return []
    out = []
    for item in table.get("rows") or []:
        cells = item.get("row") if isinstance(item, dict) else None
        if not isinstance(cells, list) or len(cells) < 3:
            continue
        values = [str(cell.get("Text") or "").strip() if isinstance(cell, dict) else "" for cell in cells]
        try:
            order = int(values[0])
        except ValueError:
            continue
        position = values[1]
        name = values[2]
        if not name:
            continue
        out.append({"order": order, "name": name, "position": position or "-"})
    out.sort(key=lambda row: row["order"])
    return [{"order": i, "name": row["name"], "position": row["position"]} for i, row in enumerate(out, start=1)]


def expected_lineups_from_kbo(team: dict[str, Any], iso_date: str, naver_game: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], str | None, bool]:
    """KBO 라인업 + 확정 여부."""
    kbo_game = find_kbo_game(team, iso_date, naver_game)
    if not kbo_game:
        return [], [], None, False
    game_id = str(kbo_game.get("G_ID") or "")
    if not game_id:
        return [], [], None, False
    season_id = str(kbo_game.get("SEASON_ID") or iso_date[:4])
    data, lineup_ck = fetch_kbo_lineup(game_id, season_id)
    if not data:
        return [], [], None, False
    home_rows = table_rows(data[3]) if len(data) > 3 else []
    away_rows = table_rows(data[4]) if len(data) > 4 else []
    if is_home_kbo(team, kbo_game):
        return home_rows, away_rows, game_id, lineup_ck
    return away_rows, home_rows, game_id, lineup_ck


def starter_name(starter: Any) -> str | None:
    if not isinstance(starter, dict):
        return None
    info = starter.get("playerInfo") if isinstance(starter.get("playerInfo"), dict) else {}
    for value in (info.get("name"), starter.get("name"), starter.get("playerName")):
        text = str(value or "").strip()
        if text and text != "??":
            return text
    return None


def starter_payload(starter: Any) -> dict[str, str]:
    return {"name": starter_name(starter) or "??"}


def starters_from_naver(team: dict[str, Any], game: dict[str, Any], preview_data: dict[str, Any]) -> tuple[dict[str, str], dict[str, str]]:
    home = preview_data.get("homeStarter")
    away = preview_data.get("awayStarter")
    if is_home_naver(team, game):
        return starter_payload(home), starter_payload(away)
    return starter_payload(away), starter_payload(home)


def merge_youtube_urls(old_rows: list[Any], new_rows: list[dict[str, Any]]) -> None:
    old_by_name = {row.get("name"): row for row in old_rows if isinstance(row, dict) and row.get("name")}
    for row in new_rows:
        old = old_by_name.get(row.get("name"))
        if old and old.get("youtubeUrl"):
            row["youtubeUrl"] = old["youtubeUrl"]


def build_for_team(team: dict[str, Any], start_date: str) -> None:
    picked = pick_game(team, start_date)
    if not picked:
        print(f"{team['id']}: no upcoming game")
        return
    day, game = picked
    naver_game_id = str(game.get("gameId") or "")
    preview_result = game_preview(naver_game_id) if naver_game_id else {}
    preview_data = preview_result.get("previewData") if isinstance(preview_result.get("previewData"), dict) else {}

    ours, theirs, kbo_game_id, lineup_ck = expected_lineups_from_kbo(team, day, game)

    if len(ours) < MIN_EXPECTED_BATTERS:
        print(f"{team['id']}: KBO lineup unavailable ({len(ours)} rows), loading previous")

    our_starter, opp_starter = starters_from_naver(team, game, preview_data)
    is_home = is_home_naver(team, game)
    opponent = game.get("awayTeamName") if is_home else game.get("homeTeamName")

    old_path = ROOT / "data" / "teams" / team["id"] / "lineup.json"
    old = {}
    if old_path.exists():
        try:
            old = json.loads(old_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            old = {}

    # 이전 라인업에서 YouTube URL 유지
    merge_youtube_urls(old.get("batters") or [], ours)
    merge_youtube_urls(old.get("opponentBatters") or [], theirs)

    source = "kbo-expected"
    if lineup_ck:
        source = "kbo-confirmed"
    elif not ours:
        source = "empty"
        # KBO 실패 시 이전 라인업 데이터 유지
        if old.get("batters"):
            ours = old["batters"]
            print(f"  → using previous lineup ({len(ours)} batters)")

    out = {
        "meta": {
            "teamId": team["id"],
            "lineupDate": day,
            "lastUpdated": kst_now(),
            "gameId": naver_game_id,
            "kboGameId": kbo_game_id,
            "opponent": opponent,
            "venue": game.get("stadium") or game.get("stadiumName") or "",
            "gameTime": str(game.get("gameDateTime") or "")[11:16],
            "lineupVerification": {
                "ours": {"source": source, "confirmed": lineup_ck},
                "opponent": {"source": "kbo-opponent", "confirmed": lineup_ck},
                "startingPitcher": {"source": "naver-preview"},
            },
        },
        "opponentMeta": {"teamShort": opponent, "teamName": opponent},
        "batters": ours,
        "opponentBatters": theirs,
        "startingPitcher": our_starter,
        "opponentStartingPitcher": opp_starter,
    }
    old_path.parent.mkdir(parents=True, exist_ok=True)
    old_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    status = "확정" if lineup_ck else "예상"
    print(f"wrote {old_path} ({len(ours)} batters [{status}], starter={our_starter['name']})")


def main() -> None:
    ap = argparse.ArgumentParser(description="KBO expected lineup + Naver starters -> team lineup.json")
    ap.add_argument("--team")
    ap.add_argument("--date", default=kst_today())
    args = ap.parse_args()
    for team in selected_teams(args.team):
        build_for_team(team, args.date)


if __name__ == "__main__":
    main()
