import * as db from "./db";
import {
  fetchDailyScores as apiDailyScores,
  fetchAllDailyScores as apiAllDailyScores,
  fetchScheduleByMonth as apiScheduleByMonth,
  fetchTodayGames as apiTodayGames,
  fetchGameDetail as apiGameDetail,
  fetchStandingsJson as apiStandingsJson,
  fetchScoreSummary as apiScoreSummary,
  type ScoreEntry,
  type ScheduleGame,
  type TodayGame,
  type GameDetail,
  type StandingRow,
  type ScoreSummaryRow,
} from "./api";
import { CHEER_SONGS, CHEER_PLAYERS } from "./cheerData";
import { LOCAL_SCHEDULE, LOCAL_SCORES } from "./scheduleData";
import { EXHIBITION_SCORES } from "./exhibitionData";
import { POSTSEASON_SCHEDULE, POSTSEASON_SCORES } from "./postseasonData";
import type { CheerSection, PlayerCheer } from "./api";

function cacheKey(name: string, id: string): string {
  return `${name}:${id}`;
}

const now = () => new Date();
const todayStr = () => now().toISOString().slice(0, 10);
const thisYear = () => now().getFullYear();

const pendingFetches = new Map<string, Promise<unknown | null>>();

// Background retry after API failure — exponential backoff: 5s, 15s, 45s
const RETRY_DELAYS = [5_000, 15_000, 45_000];
const retryCounts = new Map<string, number>();

function scheduleRetry<T>(key: string, fetcher: () => Promise<T | null>, cachedAt?: number) {
  const done = retryCounts.get(key) ?? 0;
  if (done >= RETRY_DELAYS.length) {
    retryCounts.delete(key);
    return;
  }
  retryCounts.set(key, done + 1);
  setTimeout(async () => {
    try {
      // Don't write if cache was refreshed since this retry started
      if (cachedAt) {
        const current = await db.getCache(key);
        if (current && current.updatedAt > cachedAt) {
          retryCounts.delete(key);
          return;
        }
      }
      const fresh = await fetcher();
      if (fresh) {
        await db.setCache(key, JSON.stringify(fresh));
        retryCounts.delete(key);
      }
    } catch {
      scheduleRetry(key, fetcher, cachedAt);
    }
  }, RETRY_DELAYS[done]);
}

function safeParse(json: string): unknown | null {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function ttlForDate(dateStr: string): number {
  const today = todayStr();
  if (dateStr < today) return Infinity;       // past: never expire
  if (dateStr === today) return 300_000;      // today: 5 minutes
  return 3600_000;                             // future: 1 hour
}

async function fetchWithCache<T>(
  cacheKeyStr: string,
  ttl: number,
  fetcher: () => Promise<T | null>
): Promise<T | null> {
  const cached = await db.getCache(cacheKeyStr);
  if (cached) {
    const parsed = safeParse(cached.data);
    if (parsed && Date.now() - cached.updatedAt < ttl) {
      return parsed as T;
    }
    // If parse failed or TTL expired, delete stale entry
    if (!parsed) {
      await db.deleteCache(cacheKeyStr);
    }
  }

  // In-flight dedup: reuse an ongoing fetch for the same key
  const pending = pendingFetches.get(cacheKeyStr);
  if (pending) return pending.then((r) => r as T | null);

  const promise = (async (): Promise<T | null> => {
    const fresh = await fetcher();
    if (fresh) {
      await db.setCache(cacheKeyStr, JSON.stringify(fresh));
      return fresh;
    }
    // API failed — return stale cache if available, retry in background
    if (cached) {
      const parsed = safeParse(cached.data);
      if (parsed) {
        scheduleRetry(cacheKeyStr, fetcher, cached.updatedAt);
        return parsed as T;
      }
    }
    // No stale cache — still retry in background so next attempt may succeed
    scheduleRetry(cacheKeyStr, fetcher);
    return null;
  })();

  pendingFetches.set(cacheKeyStr, promise);
  try {
    return await promise;
  } finally {
    pendingFetches.delete(cacheKeyStr);
  }
}

// Fallback cheering data for when the server endpoint hasn't been deployed yet
// Cheer data sourced from mobile/lib/cheerData.ts (same data as web's client/src/lib/cheerData.ts)

// Cheer songs — use local data directly
export async function cachedCheeringSongs(teamId: string): Promise<{ sections: CheerSection[] } | null> {
  const sections = CHEER_SONGS[teamId];
  return sections ? { sections } : null;
}

// Cheer players — use local data directly
export async function cachedCheeringPlayers(teamId: string): Promise<{ players: PlayerCheer[] } | null> {
  const players = CHEER_PLAYERS[teamId];
  return players ? { players } : null;
}

// Ensure date is YYYY-MM-DD regardless of server response format
function normalizeDate(d: string): string {
  if (/^\d{8}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return d;
}

// Schedule by month — never changes, cache forever (key includes year)
export async function cachedScheduleByMonth(month: number, year?: number): Promise<{ games: ScheduleGame[] } | null> {
  const y = year ?? thisYear();
  // Past seasons (2021–2025): use local data, no API call
  if (y <= 2025) {
    const rawGames = LOCAL_SCHEDULE[`${y}:${month}`] ?? [];
    const postseasonGames = POSTSEASON_SCHEDULE[`${y}:${month}`] ?? [];
    // Dedup: POSTSEASON_SCHEDULE entries take priority over LOCAL_SCHEDULE
    const seen = new Set(postseasonGames.map(g => `${g.date}|${g.away}|${g.home}`));
    const allGames = [...postseasonGames, ...rawGames.filter(g => !seen.has(`${g.date}|${g.away}|${g.home}`))];
    if (allGames.length === 0) return null;
    // Infer isExhibition: dates without LOCAL_SCORES are exhibition games,
    // postseason games are explicitly flagged and should not be treated as exhibition
    const games: ScheduleGame[] = allGames.map(g => ({
      ...g,
      isExhibition: g.isExhibition ?? (g.isPostseason ? false : (LOCAL_SCORES[g.date] ? undefined : true)),
    }));
    return { games };
  }
  // 2026+: API for regular season, local for exhibition games
  const apiResult = await fetchWithCache(cacheKey("schedule", `${y}:${month}`), 86_400_000, () =>
    apiScheduleByMonth(month, y)
  );
  // Normalize API dates (server might return YYYYMMDD or YYYY-MM-DD)
  if (apiResult?.games) {
    for (const g of apiResult.games) g.date = normalizeDate(g.date);
  }
  const localGames = LOCAL_SCHEDULE[`${y}:${month}`];
  if (!localGames) return apiResult;
  // Merge: local exhibition games + API regular season, dedup by date+away+home+gameIdx
  const merged = [...(apiResult?.games ?? [])];
  const seen = new Set(merged.map(g => `${g.date}|${g.away}|${g.home}|${g.gameIdx ?? 0}`));
  for (const g of localGames) {
    const key = `${g.date}|${g.away}|${g.home}|${g.gameIdx ?? 0}`;
    if (!seen.has(key)) {
      merged.push({ ...g, isExhibition: true });
      seen.add(key);
    }
  }
  merged.sort((a, b) => a.date.localeCompare(b.date) || (a.time || "00:00").localeCompare(b.time || "00:00"));
  return { games: merged };
}

// Daily scores — TTL based on date
export async function cachedDailyScores(date: string): Promise<{ games: ScoreEntry[] } | null> {
  // Postseason scores take priority over regular season scores for overlapping dates
  const postseasonScores = POSTSEASON_SCORES[date];
  if (postseasonScores) return { games: postseasonScores };
  // Regular season local scores (2021–2025) — may contain wrong data for postseason dates,
  // but those are shadowed by the POSTSEASON_SCORES check above
  const localScores = LOCAL_SCORES[date];
  if (localScores) return { games: localScores };
  // Exhibition data for past years (2020-2025)
  const exhibitionScores = EXHIBITION_SCORES[date];
  if (exhibitionScores) return { games: exhibitionScores };
  // No local data: past years have no API data, 2026+ try API
  const year = parseInt(date.slice(0, 4), 10);
  if (!isNaN(year) && year <= 2025) {
    return { games: [] };
  }
  return fetchWithCache(cacheKey("scores", date), ttlForDate(date), () =>
    apiDailyScores(date)
  );
}

// Bulk fetch all daily scores → populate per-date cache for instant individual lookups
const ALL_SCORES_TTL = 300_000; // 5 min
let allScoresPromise: Promise<Record<string, ScoreEntry[]> | null> | null = null;

export async function cachedAllDailyScores(year?: number): Promise<Record<string, ScoreEntry[]> | null> {
  // Past seasons (2021–2025): use local data, no API call
  if (year !== undefined && year <= 2025) {
    const filtered: Record<string, ScoreEntry[]> = {};
    const prefix = String(year);
    for (const [date, entries] of Object.entries(LOCAL_SCORES)) {
      if (date.startsWith(prefix)) {
        filtered[date] = entries;
      }
    }
    // Include exhibition scores for past years
    for (const [date, entries] of Object.entries(EXHIBITION_SCORES)) {
      if (date.startsWith(prefix)) {
        filtered[date] = entries;
      }
    }
    // Include postseason scores for past years (last write wins, overriding LOCAL_SCORES for same dates)
    for (const [date, entries] of Object.entries(POSTSEASON_SCORES)) {
      if (date.startsWith(prefix)) {
        filtered[date] = entries;
      }
    }
    return filtered;
  }

  const allScoresCacheKey = cacheKey("scores", "__all__");

  // Check cache first (with TTL)
  const cached = await db.getCache(allScoresCacheKey);
  let staleParsed: Record<string, ScoreEntry[]> | null = null;
  if (cached) {
    staleParsed = safeParse(cached.data) as Record<string, ScoreEntry[]> | null;
    if (staleParsed && Date.now() - cached.updatedAt < ALL_SCORES_TTL) return staleParsed;
    // TTL expired — keep staleParsed for fallback if API fails, don't delete cache
  }

  // Dedup concurrent calls
  if (allScoresPromise) return allScoresPromise;

  allScoresPromise = (async () => {
    const data = await apiAllDailyScores();
    if (!data) {
      // API failed — return stale cache if available
      if (staleParsed) return staleParsed;
      return null;
    }

    // data.dates is the raw dates map: { "2026-05-21": [...], ... }
    const dates = { ...data.dates };

    // Merge LOCAL_SCORES (March exhibition games, etc.) not covered by API
    const targetYear = year ?? thisYear();
    for (const [date, entries] of Object.entries(LOCAL_SCORES)) {
      if (date.startsWith(String(targetYear)) && !dates[date]) {
        dates[date] = entries;
      }
    }

    // Populate per-date cache so individual cachedDailyScores calls hit instantly
    for (const [date, games] of Object.entries(dates)) {
      const key = cacheKey("scores", date);
      await db.setCache(key, JSON.stringify({ games }));
    }

    // Also cache the full result briefly so rapid remounts skip the loop
    await db.setCache(allScoresCacheKey, JSON.stringify(dates));
    return dates;
  })();

  try {
    return await allScoresPromise;
  } finally {
    allScoresPromise = null;
  }
}

// Today's games — date-qualified key to survive midnight
export async function cachedTodayGames(): Promise<{ games: TodayGame[]; nextGames?: TodayGame[] } | null> {
  return fetchWithCache(cacheKey("today", todayStr()), 300_000, () =>
    apiTodayGames()
  );
}

// Game detail — moderate TTL
export async function cachedGameDetail(gameId: string): Promise<GameDetail | null> {
  return fetchWithCache(cacheKey("game", gameId), 300_000, () =>
    apiGameDetail(gameId)
  );
}

export async function cachedStandings(): Promise<{
  rows: StandingRow[];
  fetchedAt: string;
} | null> {
  return fetchWithCache("standings:current", 300_000, () =>
    apiStandingsJson()
  );
}

export async function cachedScoreSummary(
  year: number
): Promise<{ year: number; teams: ScoreSummaryRow[] } | null> {
  return fetchWithCache(`score-summary:${year}`, 300_000, () =>
    apiScoreSummary(year)
  );
}
