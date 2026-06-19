import { requestWidgetUpdate } from "react-native-android-widget";
import { getMyTeamForWidget, SHORT_CODE_TO_TEAM_ID, SHORT_CODE_TO_NAME } from "@/lib/teamStorage";
import { GameStatusWidget } from "./GameStatusWidget";

import { getInningInfo } from "@shared/gameStatus";

const WIDGET_NAMES = [
  "Widget1x1", "Widget1x2", "Widget1x3", "Widget1x4", "Widget1x5",
  "Widget2x1", "Widget2x2", "Widget2x3", "Widget2x4", "Widget2x5",
  "Widget3x1", "Widget3x2", "Widget3x3", "Widget3x4", "Widget3x5",
  "Widget4x1", "Widget4x2", "Widget4x3", "Widget4x4", "Widget4x5",
  "Widget5x1", "Widget5x2", "Widget5x3", "Widget5x4", "Widget5x5",
];

export interface WidgetGameData {
  homeTeam: string;
  awayTeam: string;
  homeScore: string;
  awayScore: string;
  inning: string;
  isTop: string;
  status: string;
  homeIsMyTeam: boolean;
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
  currentPitcher?: string;
  currentBatter?: string;
  scoreBoard?: any;
  relay?: any;
  rank?: string;
  streak?: string;
  homeRank?: string;
  awayRank?: string;
  homeStreak?: string;
  awayStreak?: string;
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
    homeIsMyTeam: false,
    ball: data.ball,
    strike: data.strike,
    out: data.out,
    base1: data.base1,
    base2: data.base2,
    base3: data.base3,
    currentPitcher: data.current_pitcher,
    currentBatter: data.current_batter,
    homeRank: data.home_rank,
    awayRank: data.away_rank,
    homeStreak: data.home_streak,
    awayStreak: data.away_streak,
  };
}

async function updateAllWidgets(myTeam: string, data: WidgetGameData | null) {
  for (const widgetName of WIDGET_NAMES) {
    await requestWidgetUpdate({
      widgetName,
      renderWidget: (widgetInfo) => {
        return (
          <GameStatusWidget
            width={widgetInfo.width}
            height={widgetInfo.height}
            data={data}
            myTeam={myTeam}
            widgetName={widgetName}
          />
        );
      },
    });
  }
}

export async function updateWidgetFromFCM(data: Record<string, string>): Promise<void> {
  const myTeam = await getMyTeamForWidget();
  if (!myTeam) return;

  const home = SHORT_CODE_TO_TEAM_ID[data.home_team || ""] || data.home_team || "";
  const away = SHORT_CODE_TO_TEAM_ID[data.away_team || ""] || data.away_team || "";
  if (home !== myTeam && away !== myTeam) return;

  const props = buildWidgetProps(data);
  // Preserve rich data from previous periodic fetch (not available in FCM flat keys)
  if (_lastWidgetGame) {
    props.scoreBoard = _lastWidgetGame.scoreBoard;
    props.relay = _lastWidgetGame.relay;
    props.homeIsMyTeam = _lastWidgetGame.homeIsMyTeam;
    props.homeRank = _lastWidgetGame.homeRank;
    props.awayRank = _lastWidgetGame.awayRank;
    props.homeStreak = _lastWidgetGame.homeStreak;
    props.awayStreak = _lastWidgetGame.awayStreak;
  }
  await updateAllWidgets(myTeam, props);
}

let _lastWidgetGame: WidgetGameData | null = null;

// 🔴 MOCK LIVE GAME — set to true for testing widget layouts
const WIDGET_MOCK_LIVE = false;

export async function updateWidgetPeriodic(): Promise<void> {
  let myTeam: string | null = null;
  try {
    myTeam = await getMyTeamForWidget();
  } catch (e) {
    console.warn("updateWidget: team lookup failed", e);
  }
  if (!myTeam) {
    await updateAllWidgets("", null);
    return;
  }

  let data: WidgetGameData | null = null;

  // 🔴 MOCK: simulate live game for widget testing
  if (WIDGET_MOCK_LIVE) {
    const mockMyTeam = myTeam || "lg";
    const mockIsHome = mockMyTeam === "lg";
    data = {
      homeTeam: mockIsHome ? "LG" : "KIA",
      awayTeam: mockIsHome ? "KIA" : "LG",
      homeScore: mockIsHome ? "4" : "2",
      awayScore: mockIsHome ? "2" : "4",
      inning: "5",
      isTop: "1",
      status: "live",
      homeIsMyTeam: mockIsHome,
      time: "18:30",
      stadium: "잠실",
      weather: "27° 맑음",
      awayPitcher: "올러",
      homePitcher: "장현식",
      ball: "2",
      strike: "1",
      out: "1",
      base1: "1",
      base2: "0",
      base3: "1",
      currentPitcher: "장현식",
      currentBatter: "김현수",
      scoreBoard: {
        rheb: { home: { r: 4, h: 7, e: 0 }, away: { r: 2, h: 5, e: 1 } },
        inn: {
          home: ["0", "1", "0", "2", "1"],
          away: ["1", "0", "0", "1", "0"],
        },
      },
      relay: { inning: 5, isTop: true, ball: 2, strike: 1, out: 1, base1: 1, base2: 0, base3: 1 },
      rank: mockIsHome ? "1" : "4",
      streak: mockIsHome ? "3승" : "2패",
      homeRank: mockIsHome ? "1" : "4",
      awayRank: mockIsHome ? "4" : "1",
      homeStreak: mockIsHome ? "3승" : "2패",
      awayStreak: mockIsHome ? "2패" : "3승",
    };
    _lastWidgetGame = data;
    await updateAllWidgets(myTeam, data);
    return;
  }

  try {
    const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "https://api.fullcount.kr";
    const res = await fetch(`${API_BASE}/widget-data`);
    if (!res.ok) {
      throw new Error(`API returned ${res.status}`);
    }
    const json = await res.json();
    if (json.error) {
      throw new Error(`API Error: ${json.error}`);
    }

    const games = json.games || [];
    const myGame = games.find((g: any) => {
      const homeId = SHORT_CODE_TO_TEAM_ID[g.homeTeam] || g.homeTeam;
      const awayId = SHORT_CODE_TO_TEAM_ID[g.awayTeam] || g.awayTeam;
      return homeId === myTeam || awayId === myTeam;
    });

    if (!myGame) {
      // No game today for my team → show last game as finished
      if (_lastWidgetGame) {
        data = { ..._lastWidgetGame, status: "finished" };
      }
    }

    if (myGame) {
      // 시간 기반 방어 로직 (현재 시간이 경기 시간보다 한참 전이면 무조건 scheduled)
      const now = new Date();
      const timeStr = myGame.time || "18:30";
      const [hours, minutes] = timeStr.split(":").map(Number);
      const gameTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
      
      if (now.getTime() < gameTime.getTime() - 1000 * 60 * 30) {
        // 경기 시작 30분 전까지는 무조건 scheduled (live나 finished 오판 방지)
        myGame.status = "scheduled";
      } else if (now.getTime() < gameTime.getTime()) {
        // 경기 시작 전인데 finished가 떨어지는 경우 방지
        if (myGame.status === "finished") myGame.status = "scheduled";
      }

      let inning = "0";
      let isTop = "0";
      if (myGame.status === "live") {
        if (myGame.relay?.inning) {
          inning = myGame.relay.inning.toString();
          isTop = (myGame.relay.isTop === true || String(myGame.relay.isTop) === "1") ? "1" : "0";
        } else {
          const info = getInningInfo(myGame.scoreBoard?.inn);
          if (info) {
            inning = info.inning.toString();
            isTop = info.isTop ? "1" : "0";
          } else {
            inning = "1";
            isTop = "1";
          }
        }
      }

      const weatherKey = myGame.venue ? Object.keys(json.todayWeather || {}).find((k) => k.includes(myGame.venue)) : undefined;
      const weatherData = weatherKey && json.todayWeather ? json.todayWeather[weatherKey] : null;

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
        currentPitcher: myGame.relay?.pitcher?.name || undefined,
        currentBatter: myGame.relay?.batter?.name || undefined,
        weather: weatherData ? `${weatherData.temp}° ${weatherData.condition}` : undefined,
        ball: myGame.relay?.ball?.toString(),
        strike: myGame.relay?.strike?.toString(),
        out: myGame.relay?.out?.toString(),
        base1: myGame.relay?.base1?.toString(),
        base2: myGame.relay?.base2?.toString(),
        base3: myGame.relay?.base3?.toString(),
        scoreBoard: myGame.scoreBoard,
        relay: myGame.relay,
        rank: (SHORT_CODE_TO_TEAM_ID[myGame.homeTeam] || myGame.homeTeam) === myTeam ? myGame.homeRank?.toString() : myGame.awayRank?.toString(),
        streak: (SHORT_CODE_TO_TEAM_ID[myGame.homeTeam] || myGame.homeTeam) === myTeam ? myGame.homeStreak : myGame.awayStreak,
        homeRank: myGame.homeRank?.toString(),
        awayRank: myGame.awayRank?.toString(),
        homeStreak: String(myGame.homeStreak ?? ""),
        awayStreak: String(myGame.awayStreak ?? ""),
      };
      
      _lastWidgetGame = data;
    }


  } catch (e) {
    console.warn("updateWidgetPeriodic: fetch failed", e);
    // Network error -> retain last data
    if (_lastWidgetGame) {
      data = _lastWidgetGame;
    }
  }

  // If there is still absolutely no data, we will render noGameView.
  await updateAllWidgets(myTeam, data);

  // Auto-stop handled by taskHandler.tsx after refresh completes
  // (avoids require() in headless context that may fail in Hermes)
}
