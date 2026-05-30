import {
  cachedTodayGames,
  cachedAllDailyScores,
  cachedScheduleByMonth,
  cachedGameDetail,
} from "@/lib/gameCache";

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
