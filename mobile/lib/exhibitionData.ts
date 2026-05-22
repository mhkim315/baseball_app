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

let cached: ExhibitionGame[] | null = null;

export async function fetchExhibitionGames(): Promise<ExhibitionGame[]> {
  if (cached) return cached;
  try {
    const resp = await fetch("https://api.fullcount.kr/exhibition-games");
    const data: ExhibitionResponse = await resp.json();
    cached = (data.games || []).map((g) => ({
      ...g,
      awayTeamId: TEAM_NAME_TO_ID[g.away] || "",
      homeTeamId: TEAM_NAME_TO_ID[g.home] || "",
    }));
  } catch {
    cached = [];
  }
  return cached;
}
