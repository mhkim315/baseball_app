import { TEAM_NAME_TO_ID } from "@shared/constants";
import { resolveVenue } from "./stadiumData";

export interface ExhibitionGame {
  date: string;
  venue: string;
  away: string;
  home: string;
  time: string;
  awayScore: number | null;
  homeScore: number | null;
  gameId: string;
  awayTeamId: string;
  homeTeamId: string;
  awayStarter: string | null;
  homeStarter: string | null;
  winPitcher: string | null;
  losePitcher: string | null;
  cancelled: boolean;
}

interface ExhibitionResponse {
  year: number;
  games: ExhibitionGame[];
}

const cache = new Map<number, ExhibitionGame[]>();

export async function fetchExhibitionGames(year?: number): Promise<ExhibitionGame[]> {
  const y = year ?? new Date().getFullYear();
  if (cache.has(y)) return cache.get(y)!;
  try {
    const url = year != null
      ? `https://api.fullcount.kr/exhibition-games?year=${year}`
      : "https://api.fullcount.kr/exhibition-games";
    const resp = await fetch(url);
    const data: ExhibitionResponse = await resp.json();
    const games = (data.games || []).map((g) => ({
      ...g,
      awayTeamId: TEAM_NAME_TO_ID[g.away] || "",
      homeTeamId: TEAM_NAME_TO_ID[g.home] || "",
    }));
    cache.set(y, games);
  } catch {
    cache.set(y, []);
  }
  return cache.get(y)!;
}
