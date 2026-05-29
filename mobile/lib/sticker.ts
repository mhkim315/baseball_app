import { TEAM_NAME_TO_ID } from "@shared/constants";
import { cachedAllDailyScores } from "@/lib/gameCache";
import { EXHIBITION_SCORES } from "@/lib/exhibitionData";
import { LOCAL_SCHEDULE } from "@/lib/scheduleData";

// ─── Team Streak ────────────────────────────────────────────

export interface TeamStreakInfo {
  type: "W" | "L" | null;
  count: number;
  prevType: "W" | "L" | null;
  prevCount: number;
}

function isExhibitionDate(date: string): boolean {
  if (EXHIBITION_SCORES[date]) return true;
  const year = date.slice(0, 4);
  const month = String(parseInt(date.slice(5, 7), 10));
  const scheduleKey = `${year}:${month}`;
  const games = LOCAL_SCHEDULE[scheduleKey];
  if (games) {
    return games.some((g) => g.date === date && g.isExhibition);
  }
  return false;
}

/**
 * Compute the current win/loss streak for a team in a given year.
 * Draws are skipped (neither break nor extend). 시범경기 제외.
 *
 * 최적화: 최신 경기부터 역순 탐색, streak이 끊기는 즉시 break.
 */
export async function computeTeamStreak(year: number, teamId: string): Promise<TeamStreakInfo> {
  const teamName = Object.entries(TEAM_NAME_TO_ID).find(([, id]) => id === teamId)?.[0];
  if (!teamName) return { type: null, count: 0, prevType: null, prevCount: 0 };

  const allScores = await cachedAllDailyScores(year);
  if (!allScores) return { type: null, count: 0, prevType: null, prevCount: 0 };

  // Collect all non-draw results, newest first
  const results: { date: string; isWin: boolean }[] = [];

  for (const [date, entries] of Object.entries(allScores)) {
    if (isExhibitionDate(date)) continue;
    for (const entry of entries) {
      if (entry.cancelled) continue;
      if (entry.away !== teamName && entry.home !== teamName) continue;
      if (entry.awayScore == null || entry.homeScore == null) continue;
      if (entry.awayScore === entry.homeScore) continue;
      results.push({
        date,
        isWin: entry.away === teamName
          ? entry.awayScore > entry.homeScore
          : entry.homeScore > entry.awayScore,
      });
    }
  }

  if (results.length === 0) {
    return { type: null, count: 0, prevType: null, prevCount: 0 };
  }

  // Sort newest first, deduplicate by date
  results.sort((a, b) => b.date.localeCompare(a.date));
  const seen = new Set<string>();
  const unique = results.filter((r) => { if (seen.has(r.date)) return false; seen.add(r.date); return true; });

  // 역순(최신→과거) 탐색: 현재 streak 계산
  let count = 1;
  for (let i = 1; i < unique.length; i++) {
    if (unique[i].isWin === unique[0].isWin) count++;
    else break;
  }

  // 이전 streak 계산 (연패탈출 감지용)
  let prevType: "W" | "L" | null = null;
  let prevCount = 0;
  if (count < unique.length) {
    prevType = unique[count].isWin ? "W" : "L";
    prevCount = 1;
    for (let i = count + 1; i < unique.length; i++) {
      if (unique[i].isWin === (prevType === "W")) prevCount++;
      else break;
    }
  }

  return {
    type: unique[0].isWin ? "W" : "L",
    count,
    prevType,
    prevCount,
  };
}

// ─── Hashtag Resolution ─────────────────────────────────────

export interface HashtagResult {
  teamTag: string;  // e.g. "5연승", "연패탈출", "무승부"
  myTag: string;    // e.g. "직관3연승", "홈승리", "직관첫승"
}

/**
 * Determine auto-generated hashtags.
 *
 * 팀 태그:
 *   2연패+ → 1승 → #연패탈출
 *   2연승+ → #N연승
 *   무승부 → #무승부 (단, 내 streak이 있으면 myTag는 유지)
 *
 * 내 태그 (우선순위):
 *   전체 첫직관 → #첫직관
 *   해당팀 첫 승 → #직관첫승
 *   2연패+ → 1승 → #직관연패탈출 (※ myPrevStreak 필요, 여기서는 caller가 count로 유추)
 *   2연승+ → #직관N연승
 *   1승 (홈) → #홈승리
 *   1승 (원정) → #원정승리
 */
export function resolveHashtags(
  teamStreak: TeamStreakInfo,
  myStreak: { type: "W" | "L" | null; count: number },
  gameResult: "win" | "lose" | "draw",
  context: {
    isHome: boolean | null;
    isFirstWin: boolean;
    isFirstGame: boolean;
  },
): HashtagResult {
  // ── 패배: 모든 자동 태그 숨김 ──
  if (gameResult === "lose") {
    return { teamTag: "", myTag: "" };
  }

  let teamTag = "";
  let myTag = "";

  // ── 나의 태그 (승리/무승부 공통) ──
  if (context.isFirstGame) {
    myTag = "첫직관";
  } else if (context.isFirstWin) {
    myTag = "직관첫승";
  } else if (myStreak.type === "W" && myStreak.count >= 2) {
    myTag = `직관${myStreak.count}연승`;
  } else if (myStreak.type === "W" && myStreak.count === 1) {
    if (context.isHome === true) myTag = "홈승리";
    else if (context.isHome === false) myTag = "원정승리";
    // isHome === null → skip
  }

  // ── 팀 태그 ──
  if (gameResult === "draw") {
    teamTag = "무승부";
    // personal streak can still show alongside draw
  } else if (teamStreak.type === "W") {
    if (teamStreak.prevType === "L" && teamStreak.prevCount >= 2) {
      teamTag = "연패탈출";
    } else if (teamStreak.count >= 2) {
      teamTag = `${teamStreak.count}연승`;
    }
  }

  return { teamTag, myTag };
}
