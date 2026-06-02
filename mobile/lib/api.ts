import { createApi } from "@shared/api";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "https://api.fullcount.kr";

export const api = createApi({
  baseUrl: API_BASE,
  timeout: 8000,
  onError: (path: string, error: unknown) => {
    console.warn(`API ${path} failed:`, error);
  },
});

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
  fetchOnboardingData,
  fetchRefreshData,
  fetchSeasons,
  fetchScoreSummary,
  getWithStatus,
} = api;

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
  ScoreSummaryRow,
  TodayGame,
  GameDetail,
  ScheduleGame,
  LineupPlayer,
} from "@shared/types";
