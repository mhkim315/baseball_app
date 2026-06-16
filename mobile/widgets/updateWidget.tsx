import { requestWidgetUpdate } from "react-native-android-widget";
import { getMyTeamForWidget, SHORT_CODE_TO_TEAM_ID, SHORT_CODE_TO_NAME } from "@/lib/teamStorage";
import { GameStatusWidget } from "./GameStatusWidget";
import { getInningInfo } from "@shared/gameStatus";

/** 등록된 모든 위젯 (1x1 ~ 5x5) — Android 위젯 피커에 표시되는 이름과 일치 */
const WIDGET_NAMES = [
  "Widget1x1", "Widget1x2", "Widget1x3", "Widget1x4", "Widget1x5",
  "Widget2x1", "Widget2x2", "Widget2x3", "Widget2x4", "Widget2x5",
  "Widget3x1", "Widget3x2", "Widget3x3", "Widget3x4", "Widget3x5",
  "Widget4x1", "Widget4x2", "Widget4x3", "Widget4x4", "Widget4x5",
  "Widget5x1", "Widget5x2", "Widget5x3", "Widget5x4", "Widget5x5",
];

interface WidgetGameData {
  homeTeam: string;
  awayTeam: string;
  homeScore: string;
  awayScore: string;
  inning: string;
  isTop: string;
  status: string;
  homeIsMyTeam?: boolean;
  time?: string;
  stadium?: string;
  weather?: string;
  awayPitcher?: string;
  homePitcher?: string;
  ball?: string;
  strike?: string;
  out?: string;
  base1?: string;
  base2?: string;
  base3?: string;
}

function buildWidgetProps(data: Record<string, string>): WidgetGameData {
  return {
    homeTeam: SHORT_CODE_TO_NAME[data.home_team || ""] || data.home_team || "",
    awayTeam: SHORT_CODE_TO_NAME[data.away_team || ""] || data.away_team || "",
    homeScore: data.home_score || "0",
    awayScore: data.away_score || "0",
    inning: data.inning || "0",
    isTop: data.is_top || "0",
    status: data.status || "scheduled",
    ball: data.ball,
    strike: data.strike,
    out: data.out,
    base1: data.base1,
    base2: data.base2,
    base3: data.base3,
  };
}

/** 모든 위젯 타입에 동일한 데이터로 렌더링 (각 위젯이 자신의 width/height에 맞춰 표시) */
async function updateAllWidgets(myTeam: string, data: WidgetGameData | null) {
  for (const widgetName of WIDGET_NAMES) {
    await requestWidgetUpdate({
      widgetName,
      renderWidget: (widgetInfo) => (
        <GameStatusWidget
          width={widgetInfo.width}
          height={widgetInfo.height}
          data={data}
          myTeam={myTeam}
        />
      ),
    });
  }
}

/** FCM payload로 직접 모든 위젯 업데이트 (백그라운드에서 HTTP fetch 금지) */
export async function updateWidgetFromFCM(data: Record<string, string>): Promise<void> {
  const myTeam = await getMyTeamForWidget();
  if (!myTeam) return;

  const home = SHORT_CODE_TO_TEAM_ID[data.home_team || ""] || data.home_team || "";
  const away = SHORT_CODE_TO_TEAM_ID[data.away_team || ""] || data.away_team || "";
  if (home !== myTeam && away !== myTeam) return;

  const props = buildWidgetProps(data);
  await updateAllWidgets(myTeam, props);
}

/** widget-data API 응답으로 모든 위젯 업데이트 (주기적 fallback / 위젯 추가 시) */
export async function updateWidgetPeriodic(): Promise<void> {
  const myTeam = await getMyTeamForWidget();
  if (!myTeam) return;

  let data: WidgetGameData | null = null;

  try {
    const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "https://api.fullcount.kr";
    const res = await fetch(`${API_BASE}/widget-data`);
    const json = await res.json();

    const games = json.games || [];
    const myGame = games.find((g: any) => {
      const homeId = SHORT_CODE_TO_TEAM_ID[g.homeTeam] || g.homeTeam;
      const awayId = SHORT_CODE_TO_TEAM_ID[g.awayTeam] || g.awayTeam;
      return homeId === myTeam || awayId === myTeam;
    });

    if (myGame) {
      let inning = "0";
      let isTop = "0";
      if (myGame.status === "live") {
        const info = getInningInfo(myGame.scoreBoard?.inn);
        if (info) {
          inning = info.inning.toString();
          isTop = info.isTop ? "1" : "0";
        } else {
          inning = "1";
          isTop = "1";
        }
      }

      data = {
        homeTeam: myGame.homeName || myGame.homeTeam,
        awayTeam: myGame.awayName || myGame.awayTeam,
        homeScore: myGame.score?.home?.toString() || "0",
        awayScore: myGame.score?.away?.toString() || "0",
        inning,
        isTop,
        homeIsMyTeam: (SHORT_CODE_TO_TEAM_ID[myGame.homeTeam] || myGame.homeTeam) === myTeam,
        status: myGame.status || "scheduled",
        time: myGame.time || "",
        stadium: myGame.venue || "",
        awayPitcher: myGame.awayStarter || undefined,
        homePitcher: myGame.homeStarter || undefined,
        weather: json.todayWeather?.[myGame.venue || ""] ? `${json.todayWeather[myGame.venue].temp}° ${json.todayWeather[myGame.venue].condition}` : undefined,
        ball: myGame.relay?.ball?.toString(),
        strike: myGame.relay?.strike?.toString(),
        out: myGame.relay?.out?.toString(),
        base1: myGame.relay?.base1?.toString(),
        base2: myGame.relay?.base2?.toString(),
        base3: myGame.relay?.base3?.toString(),
      };
    }
  } catch (e) {
    console.warn("updateWidgetPeriodic: fetch failed", e);
  }

  await updateAllWidgets(myTeam, data);
}
