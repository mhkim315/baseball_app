import { requestWidgetUpdate } from "react-native-android-widget";
import { getMyTeamForWidget, SHORT_CODE_TO_TEAM_ID, SHORT_CODE_TO_NAME } from "@/lib/teamStorage";
import { GameStatusWidget } from "./GameStatusWidget";

import { getInningInfo } from "@shared/gameStatus";

const WIDGET_NAMES = [
  "Widget2x2", "Widget4x2",
  "Widget2x2Clear", "Widget2x2Live", "Widget2x2LiveOnly",
  "Widget4x2Clear", "Widget4x2Live", "Widget4x2LiveOnly",
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
  winPitcher?: string;
  losePitcher?: string;
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
  emptyReason?: string;  // "no_team" | "no_game" | "error"
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

async function updateAllWidgets(myTeam: string, data: WidgetGameData | null, emptyReason?: string) {
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
            emptyReason={emptyReason}
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
// 🔴 MOCK EMPTY STATE — "no_team" | "no_game" | "error" | false
const WIDGET_MOCK_EMPTY: string | false = false;

export async function updateWidgetPeriodic(): Promise<void> {
  let myTeam: string | null = null;
  try {
    myTeam = await getMyTeamForWidget();
  } catch (e) {
    console.warn("updateWidget: team lookup failed", e);
  }
  if (!myTeam) {
    await updateAllWidgets("", null, "no_team");
    return;
  }

  let data: WidgetGameData | null = null;
  let emptyReason: string | undefined = "no_game";

  // 🔴 MOCK EMPTY: short-circuit to test empty state views
  if (WIDGET_MOCK_EMPTY) {
    if (WIDGET_MOCK_EMPTY === "no_team") {
      await updateAllWidgets("", null, "no_team");
      return;
    }
    await updateAllWidgets(myTeam, null, WIDGET_MOCK_EMPTY);
    return;
  }

  // 🔴 MOCK: simulate live game for widget testing
  if (WIDGET_MOCK_LIVE) {
    // 2026-06-20 롯데(2) : 키움(1) 실시간 relay — 9회말 어준서 3구째 (2B-1S-1O, 1·2루) → praying
    const mockMyTeam = myTeam || "kiwoom";
    const mockIsHome = mockMyTeam === "kiwoom";
    data = {
      homeTeam: "키움",
      awayTeam: "롯데",
      homeScore: "1",
      awayScore: "2",
      inning: "9",
      isTop: "0",
      status: "live",
      homeIsMyTeam: mockIsHome,
      time: "21:05",
      stadium: "고척",
      weather: "21° 흐림",
      awayPitcher: "나균안",
      homePitcher: "로젠버그",
      ball: "2",
      strike: "1",
      out: "1",
      base1: "1",
      base2: "1",
      base3: "0",
      currentPitcher: "원종현",
      currentBatter: "어준서",
      scoreBoard: {
        rheb: { home: { r: 1, h: 5, e: 0 }, away: { r: 2, h: 7, e: 0 } },
        inn: {
          home: ["0", "0", "0", "0", "0", "0", "1", "0"],
          away: ["0", "0", "1", "0", "0", "1", "0", "0"],
        },
      },
      relay: { inning: 9, isTop: false, ball: 2, strike: 1, out: 1, base1: 1, base2: 1, base3: 0 },
      homeRank: "10",
      awayRank: "8",
      homeStreak: "5패",
      awayStreak: "4승",
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
        winPitcher: myGame.winPitcher || undefined,
        losePitcher: myGame.losePitcher || undefined,
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
      emptyReason = undefined;
    } else {
      emptyReason = "error";
    }
  }

  // If there is still absolutely no data, we will render noGameView.
  await updateAllWidgets(myTeam, data, data ? undefined : emptyReason);

  // Auto-stop handled by taskHandler.tsx after refresh completes
  // (avoids require() in headless context that may fail in Hermes)
}
