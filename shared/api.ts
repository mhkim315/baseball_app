import { ApiClient, type ApiClientOptions } from "./api-client";
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
  TodayGame,
  GameDetail,
  ScheduleGame,
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
      client.get<{ source: string; fetchedAt: string; rows: StandingRow[] }>(
        "/standings/json"
      ),

    fetchDailyScores: (
      date: string
    ): Promise<{ date: string; games: ScoreEntry[] } | null> =>
      client.get<{ date: string; games: ScoreEntry[] }>(
        `/daily-scores/${date}`
      ),

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
      client.get<{ year: number; month: number; games: ScheduleGame[] }>(
        `/schedule/${month}${year != null ? `?year=${year}` : ""}`
      ),

    fetchSeasons: (): Promise<{ years: number[] } | null> =>
      client.get<{ years: number[] }>("/seasons"),

    fetchRegularGames: (
      year: number
    ): Promise<{ year: number; games: any[] } | null> =>
      client.get<{ year: number; games: any[] }>(`/regular-games/${year}`),

    fetchTodayGames: (): Promise<{ date: string; games: TodayGame[]; nextGames?: TodayGame[] } | null> =>
      client.get<{ date: string; games: TodayGame[]; nextGames?: TodayGame[] }>("/today-games"),

    fetchGameDetail: (gameId: string): Promise<GameDetail | null> =>
      client.get<GameDetail>(`/game-detail/${gameId}`),
  };
}
