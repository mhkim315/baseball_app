import * as db from "./db";
import {
  fetchDailyScores as apiDailyScores,
  fetchAllDailyScores as apiAllDailyScores,
  fetchScheduleByMonth as apiScheduleByMonth,
  fetchTodayGames as apiTodayGames,
  fetchGameDetail as apiGameDetail,
  fetchStandingsJson as apiStandingsJson,
  fetchScoreSummary as apiScoreSummary,
  getWithStatus,
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

// Global concurrency limiter — max 3 concurrent API calls
const MAX_CONCURRENT = 3;
let inFlight = 0;
const requestQueue: (() => void)[] = [];

function acquireSlot(): Promise<void> {
  if (inFlight < MAX_CONCURRENT) {
    inFlight++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    requestQueue.push(() => { inFlight++; resolve(); });
  });
}

function releaseSlot() {
  inFlight--;
  const next = requestQueue.shift();
  if (next) next();
}

async function withConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
  await acquireSlot();
  try {
    return await fn();
  } finally {
    releaseSlot();
  }
}

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
  const baseDelay = RETRY_DELAYS[done];
  const jitter = baseDelay * (0.7 + Math.random() * 0.6); // ±30%
  setTimeout(async () => {
    try {
      // Don't write if cache was refreshed since this retry started
      if (cachedAt) {
        const current = db.getCache(key);
        if (current && current.updatedAt > cachedAt) {
          retryCounts.delete(key);
          return;
        }
      }
      const fresh = await withConcurrencyLimit(() => fetcher());
      if (fresh) {
        db.setCache(key, JSON.stringify(fresh));
        retryCounts.delete(key);
      } else {
        // null response (including 429/5xx) — continue backoff chain
        scheduleRetry(key, fetcher, cachedAt);
      }
    } catch {
      scheduleRetry(key, fetcher, cachedAt);
    }
  }, Math.round(jitter));
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
  const cached = db.getCache(cacheKeyStr);
  if (cached) {
    const parsed = safeParse(cached.data);
    if (parsed && Date.now() - cached.updatedAt < ttl) {
      return parsed as T;
    }
    // If parse failed or TTL expired, delete stale entry
    if (!parsed) {
      db.deleteCache(cacheKeyStr);
    }
  }

  // In-flight dedup: reuse an ongoing fetch for the same key
  const pending = pendingFetches.get(cacheKeyStr);
  if (pending) return pending.then((r) => r as T | null);

  const promise = (async (): Promise<T | null> => {
    const fresh = await withConcurrencyLimit(() => fetcher());
    if (fresh) {
      db.setCache(cacheKeyStr, JSON.stringify(fresh));
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
    // 2s cooldown before clearing dedup key, so concurrent callers
    // during a failure burst share the same null result instead of
    // each creating a new API request that also hits the rate limit.
    setTimeout(() => pendingFetches.delete(cacheKeyStr), 2000);
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

  // Before making an individual API call, check if the bulk aggregate is cached.
  // This prevents 100+ individual requests when cache is cold (e.g. calendar preload).
  const bulkCached = db.getCache(cacheKey("scores", "__all__"));
  if (bulkCached) {
    const bulkData = safeParse(bulkCached.data) as Record<string, ScoreEntry[]> | null;
    if (bulkData?.[date]) {
      // Write to per-date cache for future fast lookups
      db.setCache(cacheKey("scores", date), JSON.stringify({ games: bulkData[date] }));
      return { games: bulkData[date] };
    }
  }

  return fetchWithCache(cacheKey("scores", date), ttlForDate(date), async () => {
    const { data, status } = await getWithStatus<{ date: string; games: ScoreEntry[] }>(`/daily-scores/${date}`);
    if (status === 404) {
      // Server confirmed no games on this date — cache empty permanently
      return { games: [] };
    }
    // Return data (null on 5xx/network error → fetchWithCache will skip cache & retry)
    return data ?? null;
  });
}

// Read cached all-scores without triggering any API call (cache hit only)
export async function readCachedAllScores(): Promise<Record<string, ScoreEntry[]> | null> {
  const cached = db.getCache(cacheKey("scores", "__all__"));
  if (!cached) return null;
  const parsed = safeParse(cached.data) as Record<string, ScoreEntry[]> | null;
  return parsed ?? null;
}

// Build a date range string[] for a given season/year (March ~ today)
function dateRangeForSeason(year: number): string[] {
  const today = todayStr();
  const dates: string[] = [];
  const start = `${year}-03-01`;
  const end = year < thisYear() ? `${year}-12-31` : today;
  if (end < start) return [];
  const d = new Date(start);
  while (d.toISOString().slice(0, 10) <= end) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

// Bulk fetch all daily scores → populate per-date cache for instant individual lookups
const ALL_SCORES_TTL = 300_000; // 5 min (used only for the aggregate cache key)

// Module-level dedup for cachedAllDailyScores concurrent calls
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

  const targetYear = year ?? thisYear();
  const allScoresCacheKey = cacheKey("scores", "__all__");

  // ─── Step 1: Try aggregate cache ───
  const cached = db.getCache(allScoresCacheKey);
  if (cached) {
    const parsed = safeParse(cached.data) as Record<string, ScoreEntry[]> | null;
    if (parsed && Date.now() - cached.updatedAt < ALL_SCORES_TTL) return parsed;
  }

  // ─── Step 2: Reconstruct from per-date caches ───
  // Per-date caches have correct TTLs (past = ∞, today = 5min, future = 1hr).
  const seasonDates = dateRangeForSeason(targetYear);
  const result: Record<string, ScoreEntry[]> = {};
  const coldDates: string[] = [];

  const perDateEntries = seasonDates.map((date) => ({
    date,
    entry: db.getCache(cacheKey("scores", date)),
  }));
  for (const { date, entry } of perDateEntries) {
    if (!entry) {
      coldDates.push(date);
      continue;
    }
    const parsed = safeParse(entry.data) as { games: ScoreEntry[] } | null;
    if (parsed?.games) result[date] = parsed.games;
  }

  // Merge LOCAL_SCORES (exhibition games not covered by API)
  for (const [date, entries] of Object.entries(LOCAL_SCORES)) {
    if (date.startsWith(String(targetYear)) && !result[date]) {
      result[date] = entries;
    }
  }

  // If all dates are warm, no API call needed
  if (coldDates.length === 0) {
    // Still write the aggregate key for next time
    db.setCache(allScoresCacheKey, JSON.stringify(result));
    return result;
  }

  // ─── Step 3: Only fetch cold dates from API ───
  // Dedup concurrent calls via module-level allScoresPromise
  if (allScoresPromise) return allScoresPromise;

  allScoresPromise = (async () => {
    const data = await apiAllDailyScores();
    if (!data) {
      // API failed — return whatever we reconstructed (even if partial)
      if (Object.keys(result).length > 0) return result;
      return null;
    }

    const dates = { ...result, ...data.dates };

    // Merge LOCAL_SCORES exhibition games not covered by API
    for (const [date, entries] of Object.entries(LOCAL_SCORES)) {
      if (date.startsWith(String(targetYear)) && !dates[date]) {
        dates[date] = entries;
      }
    }

    // Populate per-date cache for newly fetched dates
    for (const [date, games] of Object.entries(data.dates)) {
      const key = cacheKey("scores", date);
      db.setCache(key, JSON.stringify({ games }));
    }

    db.setCache(allScoresCacheKey, JSON.stringify(dates));
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

// Game detail — TTL based on game date
export async function cachedGameDetail(gameId: string): Promise<GameDetail | null> {
  const gameDate = gameId.length >= 8 ? normalizeDate(gameId.slice(0, 8)) : "";
  const ttl = gameDate && gameDate < todayStr() ? Infinity : 300_000;
  return fetchWithCache(cacheKey("game", gameId), ttl, () =>
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
  return fetchWithCache(`score-summary:${year}`, 300_000, async () => {
    const { data, status } = await getWithStatus<{ year: number; teams: ScoreSummaryRow[] }>(`/score-summary/${year}`);
    if (status === 404) return { year, teams: [] };
    return data ?? null;
  });
}
