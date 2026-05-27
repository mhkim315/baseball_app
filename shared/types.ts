// API response types
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

export interface ScoreEntry {
  away: string;
  home: string;
  awayScore: number;
  homeScore: number;
  outcome: string | null;
  cancelled: boolean;
  winPitcher: string | null;
  losePitcher: string | null;
  gameIdx?: number;   // 0, 1, ... for DH games
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

export interface CheerSong {
  name: string;
  youtubeUrl: string;
}

export interface CheerSection {
  title: string;
  songs: CheerSong[];
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

export interface ScoreSummaryRow {
  teamName: string;
  avgRuns: number;
  totalRuns: number;
  totalGames: number;
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

export interface LineupPlayer {
  order: number;
  position: string;
  name: string;
}

export interface GameDetail {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  starters: { home: { name: string } | null; away: { name: string } | null };
  lineup: { home: LineupPlayer[]; away: LineupPlayer[] };
  lineupConfirmed?: boolean;
  gameInfo?: { time: string; venue: string; status: string };
  score?: { away: number; home: number };
  scoreBoard?: {
    rheb?: { away: { r: number; h: number; e: number }; home: { r: number; h: number; e: number } };
    inn?: { away: (number | null)[]; home: (number | null)[] };
  };
  pitchingResult?: { name: string; wls: string; era?: string; ip?: string }[];
  etcRecords?: { how: string; result: string; desc?: string }[];
}

// Domain-specific types
export interface TeamColor {
  id: string;
  name: string;
  shortName: string;
  primary: string;
  primaryLight: string;
  secondary: string;
  tertiary: string;
}

export interface TicketTier {
  id: string;
  name: string;
  dDay: number | null;
  time: string | null;
  maxTickets: number | null;
  seats: string;
  note?: string;
}

export interface TeamTicketPolicy {
  name: string;
  color: string;
  venue: string;
  platform: string;
  tiers: TicketTier[];
}

export interface ScheduleGame {
  date: string;
  month: number;
  day: number;
  venue: string;
  away: string;
  home: string;
  time?: string;
  status?: string;
  gubun?: string;  // "정규" | "시범" | "포스트시즌" etc.
  isExhibition?: boolean;
  isPostseason?: boolean;
  gameIdx?: number;
}

// Stadium-specific types (used only in stadiumData.ts)
export interface ParkingSpot {
  name: string;
  description: string;
  lng?: number;
  lat?: number;
}

export interface NearbyRestaurant {
  name: string;
  category: string;
  address: string;
  phone: string;
  lng?: number;
  lat?: number;
}
