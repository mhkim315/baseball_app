import type { ScheduleGame, ScoreEntry, TodayGame } from "@/lib/api";
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

  const pairCount = new Map<string, number>();
  const todayStr = new Date().toISOString().slice(0, 10);
  const isFuture = dateFilter > todayStr;
  const isToday = dateFilter === todayStr;

  return daySchedule.map((g, gi) => {
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

    // gameId — always from buildGameId (per Opus: external API ID must not be source of truth)
    const gameDate = dateFilter.replace(/-/g, "");
    const gameId = buildGameId(awayId, homeId, gameDate, String(gi));

    // Status
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
      !isFuture &&
      gameHasStarted
    ) {
      status = "live";
    } else if (isToday && !score?.cancelled && gameHasStarted) {
      status = "live";
    } else if (status === "scheduled" && !isFuture && g.isExhibition) {
      status = "finished";
    }

    // DH info
    const finalPairCount = pairCount.get(pairKey) ?? 0;
    const isDHPair = finalPairCount > 1;
    const dhGameNumber = isDHPair ? pairIdx + 1 : 0;

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
