import {
  cachedTodayGames,
  cachedAllDailyScores,
  cachedScheduleByMonth,
  cachedGameDetail,
} from "@/lib/gameCache";
import * as db from "@/lib/db";
import { fetchOnboardingData } from "@/lib/api";
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

// ─── Onboarding Prefetch (단일 API 호출) ──────────────────────

let onboardingPrefetchPromise: Promise<void> | null = null;

/** Write onboarding response into SQLite cache so cachedXxx() functions hit instantly. */
async function writeToCache(data: OnboardingData): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  // todayGames → cache key "today:{YYYY-MM-DD}"
  await db.setCache(`today:${today}`, JSON.stringify(data.todayGames));

  // recentScores → per-date cache keys "scores:{YYYY-MM-DD}"
  for (const [date, games] of Object.entries(data.recentScores)) {
    await db.setCache(`scores:${date}`, JSON.stringify({ games }));
  }

  // schedule → "schedule:{year}:{month}"
  if (data.schedule) {
    const { year, month } = data.schedule;
    await db.setCache(`schedule:${year}:${month}`, JSON.stringify(data.schedule));
  }

  // todayGameDetails → "game:{gameId}"
  for (const [gameId, detail] of Object.entries(data.todayGameDetails)) {
    await db.setCache(`game:${gameId}`, JSON.stringify(detail));
  }
}

/**
 * 단일 `/onboarding-data` API 호출로 온보딩 데이터를 가져와
 * 로컬 SQLite 캐시에 주입한다. 실패 시 기존 `prefetchInitialData()`로 fallback.
 */
export async function prefetchOnboardingData(): Promise<void> {
  if (onboardingPrefetchPromise) return onboardingPrefetchPromise;

  onboardingPrefetchPromise = (async () => {
    try {
      const data = await fetchOnboardingData();
      if (data) {
        await writeToCache(data);
        return;
      }
    } catch {
      // Fallback to individual calls
    }
    await prefetchInitialData();
  })();

  return onboardingPrefetchPromise;
}
