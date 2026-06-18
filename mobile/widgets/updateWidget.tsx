import { requestWidgetUpdate } from "react-native-android-widget";
import { getMyTeamForWidget, SHORT_CODE_TO_TEAM_ID, SHORT_CODE_TO_NAME } from "@/lib/teamStorage";
import { GameStatusWidget, type WidgetGameData } from "./GameStatusWidget";
import { getInningInfo } from "@shared/gameStatus";

const WIDGET_NAMES = ["Widget2x2", "Widget4x2"];

function buildWidgetData(game: any, myTeam: string): WidgetGameData {
  let inning = "0";
  let isTop = "0";

  if (game.status === "live") {
    if (game.relay?.inning) {
      inning = String(game.relay.inning);
      isTop = game.relay.isTop === true || String(game.relay.isTop) === "1" ? "1" : "0";
    } else {
      const info = getInningInfo(game.scoreBoard?.inn);
      if (info) {
        inning = String(info.inning);
        isTop = info.isTop ? "1" : "0";
      }
    }
  }

  const isMyHome = (SHORT_CODE_TO_TEAM_ID[game.homeTeam] || game.homeTeam) === myTeam;

  return {
    homeTeam: game.homeName || game.homeTeam,
    awayTeam: game.awayName || game.awayTeam,
    homeScore: String(game.score?.home ?? "0"),
    awayScore: String(game.score?.away ?? "0"),
    inning,
    isTop,
    homeIsMyTeam: isMyHome,
    status: game.status || "scheduled",
    time: game.time || "",
    stadium: game.venue || "",
    awayPitcher: game.awayStarter,
    homePitcher: game.homeStarter,
    ball: game.relay?.ball != null ? String(game.relay.ball) : undefined,
    strike: game.relay?.strike != null ? String(game.relay.strike) : undefined,
    out: game.relay?.out != null ? String(game.relay.out) : undefined,
    base1: game.relay?.base1 != null ? String(game.relay.base1) : undefined,
    base2: game.relay?.base2 != null ? String(game.relay.base2) : undefined,
    base3: game.relay?.base3 != null ? String(game.relay.base3) : undefined,
    currentPitcher: game.relay?.pitcher?.name || undefined,
    currentBatter: game.relay?.batter?.name || undefined,
  };
}

async function updateAllWidgets(data: WidgetGameData | null, myTeam: string): Promise<void> {
  for (const name of WIDGET_NAMES) {
    try {
      await requestWidgetUpdate({
        widgetName: name,
        renderWidget: (info) => (
          <GameStatusWidget
            width={info.width}
            height={info.height}
            data={data}
            myTeam={myTeam}
          />
        ),
      });
    } catch (e) {
      console.warn(`Widget update failed for ${name}`, e);
    }
  }
}

let _lastData: WidgetGameData | null = null;

export async function updateWidgetPeriodic(): Promise<void> {
  let myTeam: string | null = null;
  try {
    myTeam = await getMyTeamForWidget();
  } catch (e) {
    console.warn("updateWidget: team lookup failed", e);
  }

  if (!myTeam) {
    await updateAllWidgets(null, "");
    return;
  }

  try {
    const base = process.env.EXPO_PUBLIC_API_BASE || "https://api.fullcount.kr";
    const res = await fetch(`${base}/widget-data`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);

    const games: any[] = json.games || [];
    const myGame = games.find((g) => {
      const hid = SHORT_CODE_TO_TEAM_ID[g.homeTeam] || g.homeTeam;
      const aid = SHORT_CODE_TO_TEAM_ID[g.awayTeam] || g.awayTeam;
      return hid === myTeam || aid === myTeam;
    });

    if (myGame) {
      const now = new Date();
      const timeStr = myGame.time || "18:30";
      const [h, m] = timeStr.split(":").map(Number);
      const gameTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);

      if (now.getTime() < gameTime.getTime() - 30 * 60 * 1000) {
        myGame.status = "scheduled";
      } else if (now.getTime() < gameTime.getTime() && myGame.status === "finished") {
        myGame.status = "scheduled";
      }

      _lastData = buildWidgetData(myGame, myTeam);
    }
  } catch (e) {
    console.warn("updateWidget: API fetch failed", e);
  }

  await updateAllWidgets(_lastData, myTeam);
}
