import {
  cachedTodayGames,
  cachedAllDailyScores,
  cachedScheduleByMonth,
  cachedGameDetail,
} from "@/lib/gameCache";
import * as db from "@/lib/db";
import { fetchOnboardingData, fetchRefreshData } from "@/lib/api";
import type { OnboardingData } from "@shared/types";

function getYear(): number {
  return new Date().getFullYear();
}

function getMonth(): number {
  return new Date().getMonth() + 1;
}

export async function prefetchInitialData(): Promise<void> {
  // 1. Today games + all scores + current schedule (parallel)
  const [todayResult] = await Promise.allSettled([
    cachedTodayGames(),
    cachedAllDailyScores(getYear()),
    cachedScheduleByMonth(getMonth(), getYear()),
  ]);

  // 2. Game detail prefetch for today's games
  if (todayResult.status === "fulfilled" && todayResult.value?.games?.length) {
    const gameIds = todayResult.value.games.map((g) => g.id);
    await Promise.allSettled(
      gameIds.map((gid) => cachedGameDetail(gid))
    );
  }
}

// ─── Consolidated Prefetch (단일 API 호출) ──────────────────

let consolidationPrefetchPromise: Promise<void> | null = null;

// ─── /refresh-data 경량 갱신 ────────────────────────────────

/** /refresh-data 응답을 SQLite 캐시에 기록한다. 실패 시 false 반환. */
async function fetchRefreshDataAndCache(): Promise<boolean> {
  try {
    const data = await fetchRefreshData();
    if (!data) return false;

    const today = new Date().toISOString().slice(0, 10);

    // todayGames → cache key "today:{YYYY-MM-DD}"
    await db.setCache(`today:${today}`, JSON.stringify(data.todayGames));

    // todayScores → cache key "scores:{YYYY-MM-DD}"
    if (data.todayScores) {
      await db.setCache(`scores:${today}`, JSON.stringify({ games: data.todayScores }));
    }

    // standings → cache key "standings:current"
    if (data.standings) {
      await db.setCache("standings:current", JSON.stringify({ rows: data.standings, fetchedAt: "" }));
    }

    // scoreSummary → cache key "score-summary:{year}"
    if (data.scoreSummary) {
      await db.setCache(`score-summary:${data.scoreSummary.year}`, JSON.stringify(data.scoreSummary));
    }

    return true;
  } catch {
    return false;
  }
}

/** Write onboarding response into SQLite cache so cachedXxx() functions hit instantly. */
async function writeToCache(data: OnboardingData): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  // todayGames → cache key "today:{YYYY-MM-DD}"
  await db.setCache(`today:${today}`, JSON.stringify(data.todayGames));

  // recentScores → per-date cache keys "scores:{YYYY-MM-DD}"
  for (const [date, games] of Object.entries(data.recentScores)) {
    await db.setCache(`scores:${date}`, JSON.stringify({ games }));
  }

  // Also write __all__ key so cachedAllDailyScores() hits cache in preloadAll()
  await db.setCache("scores:__all__", JSON.stringify(data.recentScores));

  // schedule → "schedule:{year}:{month}"
  if (data.schedule) {
    const { year, month } = data.schedule;
    await db.setCache(`schedule:${year}:${month}`, JSON.stringify(data.schedule));
  }

  // todayGameDetails → "game:{gameId}"
  for (const [gameId, detail] of Object.entries(data.todayGameDetails)) {
    await db.setCache(`game:${gameId}`, JSON.stringify(detail));
  }

  // standings → "standings:current"
  if (data.standings) {
    await db.setCache("standings:current", JSON.stringify({ rows: data.standings, fetchedAt: "" }));
  }

  // scoreSummary → "score-summary:{year}"
  if (data.scoreSummary) {
    await db.setCache(`score-summary:${data.scoreSummary.year}`, JSON.stringify(data.scoreSummary));
  }
}

/**
 * 단일 `/onboarding-data` API 호출로 데이터를 가져와
 * 로컬 SQLite 캐시에 주입한다. 실패 시 기존 `prefetchInitialData()`로 fallback.
 */
async function fetchAndCacheOnboarding(): Promise<void> {
  try {
    const data = await fetchOnboardingData();
    if (data) {
      await writeToCache(data);
      // Warm adjacent month schedules in background (don't block onboarding)
      const now = new Date();
      const m = now.getMonth() + 1;
      const y = now.getFullYear();
      cachedScheduleByMonth(m + 1, y).catch(() => {});
      cachedScheduleByMonth(m - 1, y).catch(() => {});
      return;
    }
  } catch {
    // Fallback to individual calls
  }
  await prefetchInitialData();
}

/**
 * 온보딩 시 호출. 중복 호출을 module-level promise로 방지.
 */
export async function prefetchOnboardingData(): Promise<void> {
  if (consolidationPrefetchPromise) return consolidationPrefetchPromise;
  consolidationPrefetchPromise = fetchAndCacheOnboarding();
  try {
    return await consolidationPrefetchPromise;
  } finally {
    consolidationPrefetchPromise = null;
  }
}

/**
 * 앱 재진입 시 cache canary 검사 후 필요한 경우에만 데이터 갱신.
 * today:{date} 캐시가 TTL 내에 있으면 스킵, 만료되었으면 /onboarding-data 호출.
 */
export async function prefetchOnAppInit(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const cached = await db.getCache(`today:${today}`);
  if (cached && Date.now() - cached.updatedAt < 300_000) {
    return; // 캐시가 아직 유효함
  }
  // Cache expired or missing — fetch, with in-flight dedup
  if (consolidationPrefetchPromise) {
    await consolidationPrefetchPromise;
    return;
  }
  consolidationPrefetchPromise = (async () => {
    const ok = await fetchRefreshDataAndCache();
    if (!ok) {
      // Fallback to /onboarding-data
      await fetchAndCacheOnboarding();
    }
  })();
  try {
    await consolidationPrefetchPromise;
  } finally {
    consolidationPrefetchPromise = null;
  }
}
