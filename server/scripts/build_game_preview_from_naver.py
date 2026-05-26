from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone
from typing import Any

from naver_api import game_preview, schedule_games
from team_config import ROOT, selected_teams

KST = timezone(timedelta(hours=9))


def kst_today() -> str:
    return datetime.now(KST).date().isoformat()


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


def normalize_preview(raw: dict[str, Any], game_id: str) -> dict[str, Any]:
    preview = raw.get("previewData") if isinstance(raw.get("previewData"), dict) else {}
    out = {"meta": {"source": "naver:api-gw", "naverGameId": game_id, "fetchedAt": datetime.now(KST).isoformat(timespec="seconds")}}
    for key in ("gameInfo", "homeStandings", "awayStandings", "seasonVsResult", "homeTeamPreviousGames", "awayTeamPreviousGames", "homeStarter", "awayStarter"):
        if key in preview:
            out[key] = preview[key]
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Naver preview -> team game-preview.json")
    ap.add_argument("--team")
    ap.add_argument("--date", default=kst_today())
    args = ap.parse_args()
    for team in selected_teams(args.team):
        picked = pick_game(team, args.date)
        if not picked:
            print(f"{team['id']}: no upcoming game")
            continue
        _, game = picked
        game_id = str(game.get("gameId") or "")
        if not game_id:
            print(f"{team['id']}: missing gameId")
            continue
        out = normalize_preview(game_preview(game_id), game_id)
        path = ROOT / "data" / "teams" / team["id"] / "game-preview.json"
        path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
