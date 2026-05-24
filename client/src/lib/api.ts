import { toast } from "sonner";
import { createApi } from "@shared/api";

let lastErrorToast = 0;

export const {
  fetchStandings,
  fetchTeams,
  fetchStadiumBriefs,
  fetchStadiumBrief,
  fetchStadiumFoods,
  fetchStadiumSurroundings,
  fetchStadiumEats,
  fetchCheeringSongs,
  fetchCheeringPlayers,
  fetchStandingsJson,
  fetchDailyScores,
  fetchAllDailyScores,
  fetchSchedule,
  fetchScheduleByMonth,
  fetchTodayGames,
  fetchGameDetail,
} = createApi({
  baseUrl: import.meta.env.VITE_API_BASE ?? "/api",
  timeout: 8000,
  onError: (_path: string, _error: unknown) => {
    // 404 on score/schedule endpoints is normal (no games on that day)
    if (_error instanceof Error && _error.message === "HTTP 404" &&
        (_path.startsWith("/daily-scores") || _path === "/today-games")) {
      return;
    }
    const now = Date.now();
    if (now - lastErrorToast > 3000) {
      lastErrorToast = now;
      toast.error("데이터를 불러오지 못했습니다", {
        description: "잠시 후 다시 시도해 주세요",
      });
    }
  },
});

export type {
  StandingsData,
  TeamData,
  ScoreEntry,
  StadiumBrief,
  FoodPlace,
  SurroundingSpot,
  EatsSpot,
  CheerSection,
  PlayerCheer,
  StandingRow,
  TodayGame,
  GameDetail,
  ScheduleGame,
  LineupPlayer,
} from "@shared/types";
