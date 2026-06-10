import { cachedDailyScores, cachedScheduleByMonth } from "@/lib/gameCache";
import type { ScheduleGame } from "@shared/types";
import { TEAM_NAME_TO_ID, formatDateForApi, buildGameId } from "@shared/constants";
import { TEAM_LIST } from "@shared/teamColors";
import { resolveVenue } from "@/lib/stadiumData";
import type { GameOption } from "@/components/diary/useDiaryForm";
export type ShortcutType = "diary_write" | "sticker" | "diary_stats" | "expense" | "";

export const SHORTCUT_LABELS: Record<ShortcutType, string> = {
  diary_write: "직관기록하기",
  sticker: "스티커 만들기",
  diary_stats: "직관통계",
  expense: "지출기록하기",
  "": "사용 안 함",
};

/** 주어진 myTeam을 ScoreEntry의 한글 팀명과 매칭해 해당되는 경기를 반환 */
function findMyTeamGame(games: { away: string; home: string; awayScore?: number; homeScore?: number; cancelled?: boolean }[], myTeam: string, gameId?: string): { found: boolean; game?: any } {
  for (const g of games) {
    if (g.cancelled) continue;
    const homeId = TEAM_NAME_TO_ID[g.home];
    const awayId = TEAM_NAME_TO_ID[g.away];
    if (homeId === myTeam || awayId === myTeam) {
      return { found: true, game: g };
    }
  }
  return { found: false };
}

/**
 * 오늘 + 요일 기반으로 직관기록 대상 날짜 계산 (KBO: 화~일 경기, 월 휴식)
 * - 월요일 → 어제 (일요일)
 * - 화요일 12시 이전 → 2일 전 (일요일)
 * - 수~일 12시 이전 → 어제
 * - 수~일 12시 이후 → 오늘
 */
export function findTargetDate(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const hour = now.getHours();

  if (day === 1) {
    // Monday → yesterday (Sunday)
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d;
  }
  if (day === 2 && hour < 12) {
    // Tuesday AM → 2 days ago (Sunday)
    const d = new Date(now);
    d.setDate(d.getDate() - 2);
    return d;
  }
  if (hour < 12 && day !== 1) {
    // Wed-Sun AM → yesterday
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d;
  }
  // PM → today
  return now;
}

export async function findRecentMyTeamGame(myTeam: string): Promise<{ gameId: string; date: string } | null> {
  const now = new Date();
  const currentHour = now.getHours();
  const todayStr = formatDateForApi(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDateForApi(yesterday);

  /** 경기 시작 시각이 현재보다 이전인지 확인 */
  function hasGameTimePassed(g: ScheduleGame): boolean {
    const gameTime = g.time || "18:30";
    const [gh, gm] = gameTime.split(":").map(Number);
    const gameStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), gh, gm);
    return now >= gameStart;
  }

  const tryResolveGame = async (dateStr: string, dateObj: Date) => {
    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();
    const [scheduleResult, scoresResult] = await Promise.all([
      cachedScheduleByMonth(month, year),
      cachedDailyScores(dateStr),
    ]);

    const games = scheduleResult?.games ?? [];
    const scores = scoresResult?.games ?? [];

    const dayGames = games.filter((g) => g.date === dateStr);
    let gi = 0;

    for (const g of dayGames) {
      const homeId = TEAM_NAME_TO_ID[g.home];
      const awayId = TEAM_NAME_TO_ID[g.away];

      if (homeId === myTeam || awayId === myTeam) {
        const score = scores.find((s) => TEAM_NAME_TO_ID[s.home] === homeId && TEAM_NAME_TO_ID[s.away] === awayId);

        // 취소 경기 스킵
        if (score?.cancelled) {
          gi++;
          continue;
        }

        // 시작 여부 판단: 상태, 점수, 시간 순으로 fallback
        const isStarted = g.status === "finished" || g.status === "live"
          || (score != null && (dateStr < todayStr || (score.awayScore !== undefined && score.awayScore > 0) || (score.homeScore !== undefined && score.homeScore > 0)))
          || (dateStr === todayStr && hasGameTimePassed(g));

        if (isStarted) {
          const suffix = String(gi);
          const mappedHomeTeam = TEAM_LIST.find((t) => t.shortName === g.home)?.id || homeId || "";
          const mappedAwayTeam = TEAM_LIST.find((t) => t.shortName === g.away)?.id || awayId || "";
          const builtId = buildGameId(mappedAwayTeam, mappedHomeTeam, dateStr.replace(/-/g, ""), suffix);
          return { gameId: builtId, date: dateStr };
        }
      }
      gi++;
    }
    return null;
  };

  // 1. 오늘 점수 있는 경기 확인
  const todayGame = await tryResolveGame(todayStr, now);
  if (todayGame) return todayGame;

  // 2. 14시 이전이면 어제 경기 확인
  if (currentHour < 14) {
    const yesterdayGame = await tryResolveGame(yesterdayStr, yesterday);
    if (yesterdayGame) return yesterdayGame;
  }

  return null;
}

/**
 * 특정 날짜의 myTeam 경기를 독립적으로 fetch하여 GameOption 반환
 * gamesByDate 윈도우 의존성 없음
 */
export async function getGameOptionForDate(date: Date, myTeam: string): Promise<GameOption | null> {
  const dateStr = formatDateForApi(date);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  const [scheduleResult, scoresResult] = await Promise.all([
    cachedScheduleByMonth(month, year),
    cachedDailyScores(dateStr),
  ]);

  const games = scheduleResult?.games ?? [];
  const scores = scoresResult?.games ?? [];

  const dayGames = games.filter((g) => g.date === dateStr);
  let gi = 0;

  for (const g of dayGames) {
    const homeId = TEAM_NAME_TO_ID[g.home];
    const awayId = TEAM_NAME_TO_ID[g.away];
    if (homeId !== myTeam && awayId !== myTeam) {
      gi++;
      continue;
    }

    // Find matching score entry
    const score = scores.find(
      (s) => TEAM_NAME_TO_ID[s.home] === homeId && TEAM_NAME_TO_ID[s.away] === awayId
    );

    const suffix = String(gi);
    const mappedHomeTeam = TEAM_LIST.find((t) => t.shortName === g.home)?.id || homeId || "";
    const mappedAwayTeam = TEAM_LIST.find((t) => t.shortName === g.away)?.id || awayId || "";
    const builtId = buildGameId(mappedAwayTeam, mappedHomeTeam, dateStr.replace(/-/g, ""), suffix);

    return {
      gameId: builtId,
      homeTeam: mappedHomeTeam,
      awayTeam: mappedAwayTeam,
      homeScore: score?.homeScore ?? null,
      awayScore: score?.awayScore ?? null,
      cancelled: score?.cancelled ?? false,
      venue: resolveVenue(mappedHomeTeam, g.venue),
      time: g.time || "",
      isExhibition: g.isExhibition,
      isPostseason: g.isPostseason,
      gameStatus: g.status,
      pairIdx: g.gameIdx,
    };
  }
  return null;
}
