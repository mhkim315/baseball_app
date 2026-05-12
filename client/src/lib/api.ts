const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export interface GameData {
  id: string;
  date: string;
  time: string;
  venue: string;
  home_team_id: string;
  away_team_id: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
}

export interface StandingsData {
  team_id: string;
  rank: number;
  wins: number;
  draws: number;
  losses: number;
  pct: string;
  gb: string;
  streak: string;
}

export interface TeamData {
  id: string;
  name: string;
  short_name: string;
}

export interface StadiumBrief {
  id: string;
  name: string;
  location: string;
  capacity: string;
  homeTeams: string;
  ticket: { purchase: string; price: string };
  parking: { fee: string; note: string };
  transit: { subway: string; bus: string };
}

export interface FoodPlace {
  shop: string;
  menu: string;
  category: string;
  floor: string;
  zone: string;
  standZone?: string;
  detail?: string;
  leftPct?: number;
  topPct?: number;
  labelLeftPct?: number;
  labelTopPct?: number;
  labelDirection?: string;
  _i?: number;
}

export interface SurroundingSpot {
  id: string;
  kind: string;
  name: string;
  lng: number;
  lat: number;
  description: string;
}

export interface EatsSpot {
  name: string;
  lng: number;
  lat: number;
  address: string;
  phone: string;
  category: string;
  cat: string;
}

export interface CheerSection {
  title: string;
  songs: { name: string; youtubeUrl: string }[];
}

export interface PlayerCheer {
  name: string;
}

export interface StandingRow {
  rank: number;
  teamName: string;
  winRate: number;
  wlt: string;
  gamesBehind: number;
  streak: string;
}

export interface TodayGame {
  id: string;
  date: string;
  venue: string;
  time: string;
  status: string;
  away: { id: string; name: string; starter?: { name: string }; rank?: number; record?: string };
  home: { id: string; name: string; starter?: { name: string }; rank?: number; record?: string };
  score?: { away: number; home: number };
}

export interface GameDetail {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  starters: { home: { name: string } | null; away: { name: string } | null };
  lineup: { home: any[]; away: any[] };
  gameInfo?: { time: string; venue: string; status: string };
  score?: { away: number; home: number };
  scoreBoard?: {
    rheb?: { away: { r: number; h: number; e: number }; home: { r: number; h: number; e: number } };
    inn?: { away: (number | null)[]; home: (number | null)[] };
  };
  pitchingResult?: { name: string; wls: string; era?: string; ip?: string }[];
  etcRecords?: { how: string; result: string; desc?: string }[];
}

// Generic fetch helper
async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error(`API error [${path}]:`, error);
    return null;
  }
}

// Games
export async function fetchGames(date?: string): Promise<GameData[]> {
  const url = date ? `${API_BASE}/games/${date}` : `${API_BASE}/games`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return [];
  }
}

// Standings (DB)
export async function fetchStandings(): Promise<StandingsData[]> {
  const data = await apiFetch<StandingsData[]>("/standings");
  return data ?? [];
}

// Teams
export async function fetchTeams(): Promise<TeamData[]> {
  const data = await apiFetch<TeamData[]>("/teams");
  return data ?? [];
}

// Stadium briefs
export async function fetchStadiumBriefs(): Promise<Record<string, StadiumBrief> | null> {
  return apiFetch<Record<string, StadiumBrief>>("/stadium-brief");
}

export async function fetchStadiumBrief(id: string): Promise<StadiumBrief | null> {
  return apiFetch<StadiumBrief>(`/stadium-brief/${id}`);
}

// Stadium foods
export async function fetchStadiumFoods(stadiumId: string): Promise<FoodPlace[] | null> {
  const data = await apiFetch<{ stadiumId: string; places: FoodPlace[] }>(`/stadium-foods/${stadiumId}`);
  return data?.places ?? null;
}

// Stadium surroundings (parking/transit spots)
export async function fetchStadiumSurroundings(stadiumId: string): Promise<{ center: number[]; zoom: number; spots: SurroundingSpot[] } | null> {
  return apiFetch<{ center: number[]; zoom: number; spots: SurroundingSpot[] }>(`/stadium-surroundings/${stadiumId}`);
}

// Stadium nearby restaurants
export async function fetchStadiumEats(stadiumId: string): Promise<{ name: string; center: number[]; spots: EatsSpot[] } | null> {
  return apiFetch<{ name: string; center: number[]; spots: EatsSpot[] }>(`/stadium-eats/${stadiumId}`);
}

// Cheering songs
export async function fetchCheeringSongs(teamId: string): Promise<{ sections: CheerSection[] } | null> {
  return apiFetch<{ sections: CheerSection[] }>(`/cheering-songs/${teamId}`);
}

// Cheering players
export async function fetchCheeringPlayers(teamId: string): Promise<{ players: PlayerCheer[] } | null> {
  return apiFetch<{ players: PlayerCheer[] }>(`/cheering-players/${teamId}`);
}

// Standings (JSON, more detailed)
export async function fetchStandingsJson(): Promise<{ source: string; fetchedAt: string; rows: StandingRow[] } | null> {
  return apiFetch<{ source: string; fetchedAt: string; rows: StandingRow[] }>("/standings/json");
}

// Daily scores
export async function fetchDailyScores(date: string): Promise<{ date: string; games: any[] } | null> {
  return apiFetch<{ date: string; games: any[] }>(`/daily-scores/${date}`);
}

export async function fetchAllDailyScores(): Promise<{ dates: Record<string, any[]> } | null> {
  return apiFetch<{ dates: Record<string, any[]> }>("/daily-scores");
}

// Schedule
export async function fetchSchedule(): Promise<{ year: number; games: any[] } | null> {
  return apiFetch<{ year: number; games: any[] }>("/schedule");
}

export async function fetchScheduleByMonth(month: number): Promise<{ year: number; month: number; games: any[] } | null> {
  return apiFetch<{ year: number; month: number; games: any[] }>(`/schedule/${month}`);
}

// Today's games (with starters)
export async function fetchTodayGames(): Promise<{ date: string; games: TodayGame[] } | null> {
  return apiFetch<{ date: string; games: TodayGame[] }>("/today-games");
}

// Game detail (with lineup)
export async function fetchGameDetail(gameId: string): Promise<GameDetail | null> {
  return apiFetch<GameDetail>(`/game-detail/${gameId}`);
}
