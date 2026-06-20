import * as db from "./db";
import {
  fetchDailyScores as apiDailyScores,
  fetchAllDailyScores as apiAllDailyScores,
  fetchScheduleByMonth as apiScheduleByMonth,
  fetchTodayGames as apiTodayGames,
  fetchGameDetail as apiGameDetail,
  fetchStandingsJson as apiStandingsJson,
  fetchScoreSummary as apiScoreSummary,
  fetchWidgetData as apiWidgetData,
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
import { fetchWithCache, ttlForDate, safeParse, cacheKey, withConcurrencyLimit, scheduleRetry } from "./cacheUtils";
import { normalizeDate } from "./dateUtils";

const now = () => new Date();
const todayStr = () => now().toISOString().slice(0, 10);
const thisYear = () => now().getFullYear();

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

  const today = todayStr();
  const ttl = ttlForDate(date);
  const key = cacheKey("scores", date);

  // Before making an individual API call, check if the bulk aggregate is cached.
  // This prevents 100+ individual requests when cache is cold (e.g. calendar preload).
  const bulkCached = db.getCache(cacheKey("scores", "__all__"));
  if (bulkCached) {
    const bulkData = safeParse(bulkCached.data) as Record<string, ScoreEntry[]> | null;
    if (bulkData?.[date]) {
      // Write to per-date cache for future fast lookups
      db.setCache(key, JSON.stringify({ games: bulkData[date] }));
      return { games: bulkData[date] };
    }
  }

  // Check per-date cache
  const perDateCached = db.getCache(key);
  if (perDateCached && Date.now() - perDateCached.updatedAt < ttl) {
    const parsed = safeParse(perDateCached.data) as { games: ScoreEntry[] } | null;
    if (parsed?.games) return { games: parsed.games };
  }

  // For today's date: wait for fresh data when cache is stale (no stale-while-revalidate)
  // For past/future dates: use fetchWithCache (stale data is acceptable)
  if (date === today || !perDateCached) {
    const raw = await getWithStatus<{ date: string; games: ScoreEntry[] }>(`/daily-scores/${date}`);
    const { data, status } = raw;
    if (status === 404) {
      db.setCache(key, JSON.stringify({ games: [] }));
      return { games: [] };
    }
    if (data) {
      db.setCache(key, JSON.stringify(data));
      return data;
    }
    // API failed → fall back to stale cache
    if (perDateCached) {
      const parsed = safeParse(perDateCached.data) as { games: ScoreEntry[] } | null;
      if (parsed?.games) {
        scheduleRetry(key, async () => {
          const { data: retryData, status: retryStatus } = await getWithStatus<{ date: string; games: ScoreEntry[] }>(`/daily-scores/${date}`);
          return retryStatus === 404 ? { games: [] } : retryData ?? null;
        }, perDateCached.updatedAt);
        return { games: parsed.games };
      }
    }
    return null;
  }

  // Past/future dates: use fetchWithCache with stale fallback
  return fetchWithCache(key, ttl, async () => {
    const { data, status } = await getWithStatus<{ date: string; games: ScoreEntry[] }>(`/daily-scores/${date}`);
    if (status === 404) return { games: [] };
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
  const key = cacheKey("today", todayStr());
  const cached = db.getCache(key);

  // Fresh cache → return immediately
  if (cached && Date.now() - cached.updatedAt < 120_000) {
    const parsed = safeParse(cached.data);
    if (parsed) return parsed as { games: TodayGame[]; nextGames?: TodayGame[] };
  }

  // Cache expired or missing → fetch fresh (no stale-while-revalidate for today's live data)
  const fresh = await withConcurrencyLimit(() => apiTodayGames());
  if (fresh) {
    db.setCache(key, JSON.stringify(fresh));
    return fresh;
  }

  // API failed → fall back to stale cache + background retry
  if (cached) {
    const parsed = safeParse(cached.data);
    if (parsed) {
      scheduleRetry(key, () => apiTodayGames(), cached.updatedAt);
      return parsed as { games: TodayGame[]; nextGames?: TodayGame[] };
    }
  }
  return null;
}

// Game detail — TTL based on game date
export async function cachedGameDetail(gameId: string): Promise<GameDetail | null> {
  const gameDate = gameId.length >= 8 ? normalizeDate(gameId.slice(0, 8)) : "";
  const today = todayStr();
  let ttl: number;
  if (gameDate && gameDate < today) {
    ttl = Infinity;       // past — never stale
  } else if (gameDate === today) {
    ttl = 30_000;         // today — 30s
  } else {
    ttl = 180_000;        // future — 3min
  }
  return fetchWithCache(cacheKey("game", gameId), ttl, () =>
    apiGameDetail(gameId)
  );
}

/** Bypass cache and fetch fresh GameDetail from server (used for live relay polling). */
export async function fetchGameDetailFresh(gameId: string): Promise<GameDetail | null> {
  return withConcurrencyLimit(() => apiGameDetail(gameId));
}

// Widget data — 1s TTL (server refreshes every 3s via Naver+Daum merge)
export async function cachedWidgetData(): Promise<import("@shared/types").WidgetData | null> {
  const key = cacheKey("widget", "all");
  const ttl = 1_000;
  return fetchWithCache(key, ttl, () => apiWidgetData());
}

export async function cachedStandings(): Promise<{
  rows: StandingRow[];
  fetchedAt: string;
} | null> {
  return fetchWithCache("standings:current", 180_000, () =>
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
