import type { ScheduleGame, ScoreEntry, TodayGame } from "@/lib/api";
import type { RelayState } from "@shared/types";
import { TEAM_NAME_TO_ID, buildGameId } from "@shared/constants";

export interface ResolvedGame {
  gameId: string;
  date: string;

  homeTeam: string;
  awayTeam: string;
  homeId: string;
  awayId: string;

  time: string;
  venue: string;
  status: "scheduled" | "live" | "finished" | "cancelled";
  isExhibition: boolean;
  isPostseason: boolean;

  homeScore?: number;
  awayScore?: number;
  outcome?: string | null;
  winPitcher?: string | null;
  losePitcher?: string | null;

  homePitcher?: string;
  awayPitcher?: string;

  dhGameNumber: number; // 0=단일경기, 1=DH 1차전, 2=DH 2차전
  isDoubleHeader: boolean;

  liveInning?: number;
  isTop?: boolean;
  relay?: RelayState | null;

  /** Raw references for consumers that need deep access (e.g. game/[id]) */
  _raw: {
    schedule?: ScheduleGame;
    score?: ScoreEntry;
    today?: TodayGame;
  };
}

export interface ResolveGamesOptions {
  todayGames?: TodayGame[];
  nextGames?: TodayGame[];
}

function isLiveStatus(s: string): boolean {
  return s === "live" || s === "LIVE" || s === "1";
}

function normalizeStarter(name?: string): string | undefined {
  if (!name || name === "미정") return undefined;
  return name;
}

/**
 * Match schedule games against scores for a single date.
 * dateFilter is required because ScoreEntry has no date field.
 */
export function resolveGames(
  schedule: ScheduleGame[],
  scores: ScoreEntry[],
  dateFilter: string,
  options?: ResolveGamesOptions
): ResolvedGame[] {
  const daySchedule = schedule.filter((g) => g.date === dateFilter);
  const todayGames = options?.todayGames ?? [];
  const nextGames = options?.nextGames ?? [];

  // Pre-count same-pair games to detect double-headers before processing
  const pairTotal = new Map<string, number>();
  for (const g of daySchedule) {
    const pk = `${g.away}|${g.home}`;
    pairTotal.set(pk, (pairTotal.get(pk) ?? 0) + 1);
  }

  const pairCount = new Map<string, number>();
  const todayStr = new Date().toISOString().slice(0, 10);
  const isFuture = dateFilter > todayStr;
  const isToday = dateFilter === todayStr;

  return daySchedule.map((g) => {
    const homeId = TEAM_NAME_TO_ID[g.home] || "";
    const awayId = TEAM_NAME_TO_ID[g.away] || "";
    const pairKey = `${g.away}|${g.home}`;
    const pairIdx = pairCount.get(pairKey) ?? 0;
    pairCount.set(pairKey, pairIdx + 1);

    // Score matching
    const matchingScores = scores.filter(
      (s) => s.home === g.home && s.away === g.away
    );
    const score =
      matchingScores.find((s) => (s.gameIdx ?? 0) === pairIdx + 1) ??
      matchingScores[pairIdx];

    // TodayGame enrichment (today only)
    const gamesKey = `${dateFilter}-${awayId}-${homeId}`;
    const today =
      todayGames.find(
        (tg) => `${tg.date}-${tg.away.id}-${tg.home.id}` === gamesKey
      ) ??
      nextGames.find(
        (ng) => `${ng.date}-${ng.away.id}-${ng.home.id}` === gamesKey
      );

    // Pitchers from today API
    const awayPitcher = normalizeStarter(today?.away.starter?.name);
    const homePitcher = normalizeStarter(today?.home.starter?.name);

    // Time from today API or schedule
    const time = today?.time || g.time || "18:30";

    // DH info (using pre-counted pairTotal so first game of a DH pair is correctly identified)
    const isDHPair = (pairTotal.get(pairKey) ?? 1) > 1;
    const dhGameNumber = isDHPair ? pairIdx + 1 : 0;

    // gameId — suffix matches widget-data convention: "0" for single games, DH number for DH
    const gameDate = dateFilter.replace(/-/g, "");
    const gameId = buildGameId(awayId, homeId, gameDate, String(dhGameNumber));
    const [h, m] = time.split(":").map(Number);
    const startTime = new Date();
    startTime.setHours(h ?? 18, m ?? 30, 0, 0);
    const gameHasStarted = new Date() >= startTime;

    let status: "scheduled" | "live" | "finished" | "cancelled" = "scheduled";
    if (score?.cancelled) {
      status = "cancelled";
    } else if (score && !isFuture && score.outcome !== null) {
      status = "finished";
    } else if (
      today?.status &&
      isLiveStatus(today.status) &&
      !isFuture
    ) {
      status = "live";
    } else if (isToday && !score?.cancelled && gameHasStarted) {
      status = "live";
    } else if (status === "scheduled" && !isFuture && g.isExhibition) {
      status = "finished";
    }

    return {
      gameId,
      date: dateFilter,
      homeTeam: homeId,
      awayTeam: awayId,
      homeId,
      awayId,
      time,
      venue: (g.venue || "").replace(/\s*\(.*?\)\s*$/, "").trim(),
      status,
      isExhibition: g.isExhibition ?? false,
      isPostseason: g.isPostseason ?? false,
      homeScore: score?.homeScore,
      awayScore: score?.awayScore,
      outcome: score?.outcome ?? null,
      winPitcher: score?.winPitcher ?? null,
      losePitcher: score?.losePitcher ?? null,
      homePitcher,
      awayPitcher,
      dhGameNumber,
      isDoubleHeader: isDHPair,
      _raw: {
        schedule: g,
        score,
        today,
      },
    };
  });
}

/**
 * Convenience: resolve all games for a set of dates (e.g. a calendar month).
 * Processes each date separately for correct score matching.
 */
export function resolveGamesForSchedule(
  schedule: ScheduleGame[],
  scoresByDate: Record<string, ScoreEntry[]>,
  options?: ResolveGamesOptions
): ResolvedGame[] {
  const dates = [...new Set(schedule.map((g) => g.date))].sort();
  const result: ResolvedGame[] = [];
  for (const date of dates) {
    const daySchedule = schedule.filter((g) => g.date === date);
    const dayScores = scoresByDate[date] || [];
    result.push(...resolveGames(daySchedule, dayScores, date, options));
  }
  return result;
}

/** 승/무/패 판정 — targetTeam 기준으로 결과 반환 */
export function getResultLabel(rg: ResolvedGame, targetTeam: string | null): string | null {
  if (!targetTeam || rg.status === "cancelled") return null;
  if (rg.outcome == null || rg.homeScore == null || rg.awayScore == null) return null;
  const isHome = rg.homeTeam === targetTeam;
  const our = isHome ? rg.homeScore : rg.awayScore;
  const their = isHome ? rg.awayScore : rg.homeScore;
  if (our > their) return "승";
  if (our < their) return "패";
  return "무";
}

export function getResultColor(label: string | null): string {
  if (label === "승") return "#3b82f6";
  if (label === "패") return "#ef4444";
  if (label === "무") return "#f59e0b";
  return "#888";
}
