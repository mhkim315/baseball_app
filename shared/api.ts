import { ApiClient, type ApiClientOptions } from "./api-client";
import {
  DailyScoresResponseSchema,
  ScheduleByMonthResponseSchema,
  TodayGamesResponseSchema,
  GameDetailSchema,
} from "./schemas";
import type {
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
  OnboardingData,
  RefreshData,
  WidgetData,
} from "./types";

export function createApi(options: ApiClientOptions) {
  const client = new ApiClient(options);

  return {
    fetchStandings: (): Promise<StandingsData[]> =>
      client.get<StandingsData[]>("/standings").then((r) => r ?? []),

    fetchTeams: (): Promise<TeamData[]> =>
      client.get<TeamData[]>("/teams").then((r) => r ?? []),

    fetchStadiumBriefs: (): Promise<Record<string, StadiumBrief> | null> =>
      client.get<Record<string, StadiumBrief>>("/stadium-brief"),

    fetchStadiumBrief: (id: string): Promise<StadiumBrief | null> =>
      client.get<StadiumBrief>(`/stadium-brief/${id}`),

    fetchStadiumFoods: (stadiumId: string): Promise<FoodPlace[] | null> =>
      client
        .get<{ stadiumId: string; places: FoodPlace[] }>(
          `/stadium-foods/${stadiumId}`
        )
        .then((r) => r?.places ?? null),

    fetchStadiumSurroundings: (
      stadiumId: string
    ): Promise<{
      center: number[];
      zoom: number;
      spots: SurroundingSpot[];
    } | null> =>
      client.get<{
        center: number[];
        zoom: number;
        spots: SurroundingSpot[];
      }>(`/stadium-surroundings/${stadiumId}`),

    fetchStadiumEats: (
      stadiumId: string
    ): Promise<{ name: string; center: number[]; spots: EatsSpot[] } | null> =>
      client.get<{ name: string; center: number[]; spots: EatsSpot[] }>(
        `/stadium-eats/${stadiumId}`
      ),

    fetchCheeringSongs: (
      teamId: string
    ): Promise<{ sections: CheerSection[] } | null> =>
      client.get<{ sections: CheerSection[] }>(`/cheering-songs/${teamId}`),

    fetchCheeringPlayers: (
      teamId: string
    ): Promise<{ players: PlayerCheer[] } | null> =>
      client.get<{ players: PlayerCheer[] }>(`/cheering-players/${teamId}`),

    fetchStandingsJson: (): Promise<{
      source: string;
      fetchedAt: string;
      rows: StandingRow[];
    } | null> =>
      client.get<any[]>("/standings").then((rows) => {
        if (!rows) return null;
        const normalized: StandingRow[] = rows.map((r) => ({
          rank: r.rank,
          teamName: r.teamName ?? r.team_id ?? "",
          winRate: r.winRate ?? r.win_rate ?? 0,
          wlt: r.wlt || `${r.wins ?? 0}승${r.draws ?? 0}무${r.losses ?? 0}패`,
          gamesBehind: r.gamesBehind ?? r.game_back ?? null,
          streak: r.streak ?? "",
          gamesPlayed: r.gamesPlayed ?? r.games_played ?? undefined,
          last10: r.last10 ?? r.last_10 ?? undefined,
        }));
        return {
          source: "api",
          fetchedAt: new Date().toISOString(),
          rows: normalized,
        };
      }),

    fetchDailyScores: (
      date: string
    ): Promise<{ date: string; games: ScoreEntry[] } | null> =>
      client.get(`/daily-scores/${date}`, DailyScoresResponseSchema) as Promise<{ date: string; games: ScoreEntry[] } | null>,

    fetchAllDailyScores: (): Promise<{
      dates: Record<string, ScoreEntry[]>;
    } | null> =>
      client.get<{ dates: Record<string, ScoreEntry[]> }>("/daily-scores"),

    fetchSchedule: (): Promise<{ year: number; games: ScheduleGame[] } | null> =>
      client.get<{ year: number; games: ScheduleGame[] }>("/schedule"),

    fetchScheduleByMonth: (
      month: number,
      year?: number
    ): Promise<{
      year: number;
      month: number;
      games: ScheduleGame[];
    } | null> =>
      client.get(
        `/schedule/${month}${year != null ? `?year=${year}` : ""}`,
        ScheduleByMonthResponseSchema,
      ) as Promise<{ year: number; month: number; games: ScheduleGame[] } | null>,

    fetchSeasons: (): Promise<{ years: number[] } | null> =>
      client.get<{ years: number[] }>("/seasons"),

    fetchScoreSummary: (year: number): Promise<{ year: number; teams: ScoreSummaryRow[] } | null> =>
      client.get<{ year: number; teams: ScoreSummaryRow[] }>(`/api/score-summary/${year}`),

    fetchRegularGames: (
      year: number
    ): Promise<{ year: number; games: any[] } | null> =>
      client.get<{ year: number; games: any[] }>(`/regular-games/${year}`),

    fetchTodayGames: (): Promise<{ date: string; games: TodayGame[]; nextGames?: TodayGame[] } | null> =>
      client.get("/today-games", TodayGamesResponseSchema) as Promise<{ date: string; games: TodayGame[]; nextGames?: TodayGame[] } | null>,

    fetchGameDetail: (gameId: string): Promise<GameDetail | null> =>
      client.get(`/game-detail/${gameId}`, GameDetailSchema) as Promise<GameDetail | null>,

    fetchOnboardingData: (): Promise<OnboardingData | null> =>
      client.get<OnboardingData>("/onboarding-data"),

    fetchRefreshData: (): Promise<RefreshData | null> =>
      client.get<RefreshData>("/refresh-data"),

    fetchWidgetData: (): Promise<WidgetData | null> =>
      client.get<WidgetData>("/widget-data"),

    getWithStatus: <T>(path: string) =>
      client.getWithStatus<T>(path),
  };
}
