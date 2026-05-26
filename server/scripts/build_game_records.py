from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone
from typing import Any

from naver_api import schedule_games, game_preview
from team_config import ROOT, selected_teams

KST = timezone(timedelta(hours=9))

NAVER_RECORD_URL = "https://api-gw.sports.naver.com/schedule/games/{game_id}/record"


def fetch_record(naver_game_id: str) -> dict[str, Any] | None:
    import ssl
    import urllib.request

    req = urllib.request.Request(
        NAVER_RECORD_URL.format(game_id=naver_game_id),
        headers={
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15, context=ssl.create_default_context()) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
            return data.get("result", {}).get("recordData")
    except Exception as e:
        print(f"  fetch_record failed: {e}")
        return None


def build_for_team(team: dict[str, Any], target_date: str, games_by_date: dict[str, list[dict[str, Any]]] | None = None) -> None:
    """Build game-record.json for a team's game on target_date."""
    if games_by_date is not None:
        kbo_games = [g for g in games_by_date.get(target_date, []) if g.get("categoryId") == "kbo"]
    else:
        all_games = schedule_games(target_date, target_date)
        kbo_games = [g for g in all_games if g.get("categoryId") == "kbo"]

    team_name = team["scheduleName"]
    team_code = team["kboCode"]

    # Find this team's game
    my_game = None
    for g in kbo_games:
        if team_name in (g.get("homeTeamName"), g.get("awayTeamName")) or team_code in (
            g.get("homeTeamCode"),
            g.get("awayTeamCode"),
        ):
            my_game = g
            break

    if not my_game:
        print(f"{team['id']}: no game on {target_date}")
        return

    naver_game_id = str(my_game.get("gameId") or "")
    if not naver_game_id:
        print(f"{team['id']}: missing gameId for {target_date}")
        return

    print(f"{team['id']}: building record for {naver_game_id}")

    # Fetch preview data (has lineups, starters)
    preview_result = game_preview(naver_game_id) if naver_game_id else {}
    preview_data = preview_result.get("previewData") if isinstance(preview_result.get("previewData"), dict) else {}

    # Fetch record data (has scores, box scores)
    record_data = fetch_record(naver_game_id)

    if not preview_data and not record_data:
        print(f"  no data available")
        return

    # Build lineup arrays from preview data
    def extract_lineup(raw: Any) -> list[dict[str, Any]]:
        if not isinstance(raw, dict):
            return []
        full = raw.get("fullLineUp") or []
        out = []
        for entry in full:
            if isinstance(entry, dict) and entry.get("batorder") is not None:
                out.append({
                    "order": int(entry["batorder"]),
                    "name": entry.get("playerName", ""),
                    "position": entry.get("positionName", "-"),
                })
        out.sort(key=lambda r: r["order"])
        return out

    home_lineup = extract_lineup(preview_data.get("homeTeamLineUp"))
    away_lineup = extract_lineup(preview_data.get("awayTeamLineUp"))

    def starter_info(raw: Any) -> dict[str, str]:
        if not isinstance(raw, dict):
            return {"name": "??"}
        info = raw.get("playerInfo") or {}
        return {"name": info.get("name") or raw.get("playerName") or raw.get("name") or "??"}

    home_starter = starter_info(preview_data.get("homeStarter"))
    away_starter = starter_info(preview_data.get("awayStarter"))

    game_info = preview_data.get("gameInfo") or (record_data or {}).get("gameInfo") or {}

    out: dict[str, Any] = {
        "meta": {
            "naverGameId": naver_game_id,
            "gameDate": target_date,
            "lastUpdated": datetime.now(KST).isoformat(timespec="seconds"),
        },
        "gameInfo": game_info,
        "homeStandings": preview_data.get("homeStandings") or (record_data or {}).get("homeStandings"),
        "awayStandings": preview_data.get("awayStandings") or (record_data or {}).get("awayStandings"),
        "homeLineup": home_lineup,
        "awayLineup": away_lineup,
        "homeStarter": home_starter,
        "awayStarter": away_starter,
        "scoreBoard": (record_data or {}).get("scoreBoard"),
        "battersBoxscore": (record_data or {}).get("battersBoxscore"),
        "pitchersBoxscore": (record_data or {}).get("pitchersBoxscore"),
        "pitchingResult": (record_data or {}).get("pitchingResult") or [],
        "etcRecords": (record_data or {}).get("etcRecords") or [],
    }

    out_path = ROOT / "data" / "teams" / team["id"] / "game-records" / f"{target_date}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  wrote {out_path}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Build game records for past KBO games")
    ap.add_argument("--team")
    ap.add_argument("--date", help="YYYY-MM-DD to build game record for")
    ap.add_argument("--recent", type=int, default=1, help="build records for last N days (default 1, ignored if --date is set)")
    ap.add_argument("--skip-existing", action="store_true", help="skip dates that already have a record file")
    args = ap.parse_args()

    if args.date:
        targets = [args.date]
    else:
        today = datetime.now(KST).date()
        targets = [(today - timedelta(days=i)).isoformat() for i in range(args.recent - 1, -1, -1)]

    print(f"Building game records for {len(targets)} day(s): {targets[0]} ~ {targets[-1]}")

    # Fetch all games in one call for efficiency
    if len(targets) > 1:
        games = schedule_games(targets[0], targets[-1])
        games_by_date: dict[str, list[dict[str, Any]]] = {}
        for g in games:
            d = g.get("gameDate") or str(g.get("gameDateTime", ""))[:10]
            games_by_date.setdefault(d, []).append(g)
    else:
        games_by_date = None

    for team in selected_teams(args.team):
        for target in targets:
            if args.skip_existing:
                existing = ROOT / "data" / "teams" / team["id"] / "game-records" / f"{target}.json"
                if existing.exists():
                    continue
            build_for_team(team, target, games_by_date)


if __name__ == "__main__":
    main()
