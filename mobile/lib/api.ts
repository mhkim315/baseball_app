import { createApi } from "@shared/api";

const API_BASE = "https://api.fullcount.kr";

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
  baseUrl: API_BASE,
  timeout: 8000,
  onError: (_path: string, _error: unknown) => {
    // Mobile: silent failure for now; UI handles error state
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
