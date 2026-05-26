import { getJikgwanRecords, getBadges, upsertBadge, checkAttendance, type Badge, type JikgwanRecord } from "@/lib/db";
import { computeStreakStats } from "@/lib/stats";
import { resolveIsWin } from "@/lib/expenseStats";
import { parseGameTeamIds } from "@shared/constants";
import { TEAM_COLORS } from "@shared/teamColors";

// --- Types ---

export type BadgeTier = "tutorial" | "easy" | "medium" | "hard" | "epic";

export interface BadgeDefinition {
  id: string;
  badgeKey: string;
  emoji: string;
  title: string;
  description: string;
  tier: BadgeTier;
  xp: number;
  category: "milestone" | "streak" | "attendance" | "exploration" | "secret";
  progressTarget: number;
  check: (records: JikgwanRecord[], existingBadges: Badge[], attendanceStreak: number) => BadgeEvalResult;
}

export interface BadgeEvalResult {
  unlocked: boolean;
  progressCurrent: number;
  progressTarget: number;
  qualifyingDate?: string; // YYYY.MM.DD — 경기 기준 배지는 record.date, 없으면 today (행위 기준)
}

export interface LevelInfo {
  level: number;
  title: string;
  currentXP: number;
  requiredXP: number;
  progress: number;
}

// --- Badge Definitions (15 total) ---

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // ── 직관 마일스톤 (5) ──
  {
    id: "first_step",
    badgeKey: "first_step",
    emoji: "👣",
    title: "첫걸음",
    description: "첫 번째 직관 기록을 작성했어요",
    tier: "tutorial",
    xp: 5,
    category: "milestone",
    progressTarget: 1,
    check: (records) => {
      const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: records.length >= 1,
        progressCurrent: Math.min(records.length, 1),
        progressTarget: 1,
        qualifyingDate: records.length >= 1 ? sorted[0].date : undefined,
      };
    },
  },
  {
    id: "games_10",
    badgeKey: "games_10",
    emoji: "⭐",
    title: "10회 달성",
    description: "직관 10회를 기록했어요",
    tier: "easy",
    xp: 10,
    category: "milestone",
    progressTarget: 10,
    check: (records) => {
      const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: records.length >= 10,
        progressCurrent: Math.min(records.length, 10),
        progressTarget: 10,
        qualifyingDate: records.length >= 10 ? sorted[9].date : undefined,
      };
    },
  },
  {
    id: "games_30",
    badgeKey: "games_30",
    emoji: "🌟",
    title: "30회 달성",
    description: "직관 30회를 기록했어요",
    tier: "medium",
    xp: 25,
    category: "milestone",
    progressTarget: 30,
    check: (records) => {
      const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: records.length >= 30,
        progressCurrent: Math.min(records.length, 30),
        progressTarget: 30,
        qualifyingDate: records.length >= 30 ? sorted[29].date : undefined,
      };
    },
  },
  {
    id: "games_50",
    badgeKey: "games_50",
    emoji: "💎",
    title: "50회 달성",
    description: "직관 50회를 기록했어요",
    tier: "hard",
    xp: 50,
    category: "milestone",
    progressTarget: 50,
    check: (records) => {
      const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: records.length >= 50,
        progressCurrent: Math.min(records.length, 50),
        progressTarget: 50,
        qualifyingDate: records.length >= 50 ? sorted[49].date : undefined,
      };
    },
  },
  {
    id: "games_100",
    badgeKey: "games_100",
    emoji: "👑",
    title: "100회 달성",
    description: "직관 100회를 기록했어요",
    tier: "epic",
    xp: 100,
    category: "milestone",
    progressTarget: 100,
    check: (records) => {
      const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: records.length >= 100,
        progressCurrent: Math.min(records.length, 100),
        progressTarget: 100,
        qualifyingDate: records.length >= 100 ? sorted[99].date : undefined,
      };
    },
  },
  // ── 연승 기록 (3) ──
  {
    id: "streak_3",
    badgeKey: "streak_3",
    emoji: "🔥",
    title: "3연승",
    description: "직관 3연승을 달성했어요",
    tier: "easy",
    xp: 10,
    category: "streak",
    progressTarget: 3,
    check: (records) => {
      const s = computeStreakStats(records);
      const best = Math.max(s.longestWin, s.currentType === "W" ? s.currentCount : 0);
      let qualifyingDate: string | undefined;
      if (best >= 3) {
        const games = records
          .filter((r) => { const iw = resolveIsWin(r); return iw != null && iw !== 0; })
          .sort((a, b) => a.date.localeCompare(b.date));
        let run = 0;
        for (const g of games) {
          if (resolveIsWin(g) === 1) { run++; if (run === 3) { qualifyingDate = g.date; break; } }
          else { run = 0; }
        }
      }
      return {
        unlocked: best >= 3,
        progressCurrent: Math.min(best, 3),
        progressTarget: 3,
        qualifyingDate,
      };
    },
  },
  {
    id: "streak_5",
    badgeKey: "streak_5",
    emoji: "🔥🔥",
    title: "5연승",
    description: "직관 5연승을 달성했어요",
    tier: "medium",
    xp: 25,
    category: "streak",
    progressTarget: 5,
    check: (records) => {
      const s = computeStreakStats(records);
      const best = Math.max(s.longestWin, s.currentType === "W" ? s.currentCount : 0);
      let qualifyingDate: string | undefined;
      if (best >= 5) {
        const games = records
          .filter((r) => { const iw = resolveIsWin(r); return iw != null && iw !== 0; })
          .sort((a, b) => a.date.localeCompare(b.date));
        let run = 0;
        for (const g of games) {
          if (resolveIsWin(g) === 1) { run++; if (run === 5) { qualifyingDate = g.date; break; } }
          else { run = 0; }
        }
      }
      return {
        unlocked: best >= 5,
        progressCurrent: Math.min(best, 5),
        progressTarget: 5,
        qualifyingDate,
      };
    },
  },
  {
    id: "streak_10",
    badgeKey: "streak_10",
    emoji: "💥",
    title: "10연승",
    description: "직관 10연승을 달성했어요",
    tier: "epic",
    xp: 100,
    category: "streak",
    progressTarget: 10,
    check: (records) => {
      const s = computeStreakStats(records);
      const best = Math.max(s.longestWin, s.currentType === "W" ? s.currentCount : 0);
      let qualifyingDate: string | undefined;
      if (best >= 10) {
        const games = records
          .filter((r) => { const iw = resolveIsWin(r); return iw != null && iw !== 0; })
          .sort((a, b) => a.date.localeCompare(b.date));
        let run = 0;
        for (const g of games) {
          if (resolveIsWin(g) === 1) { run++; if (run === 10) { qualifyingDate = g.date; break; } }
          else { run = 0; }
        }
      }
      return {
        unlocked: best >= 10,
        progressCurrent: Math.min(best, 10),
        progressTarget: 10,
        qualifyingDate,
      };
    },
  },
  // ── 앱 출석 (4) ──
  {
    id: "attend_first",
    badgeKey: "attend_first",
    emoji: "👋",
    title: "첫방문",
    description: "앱에 첫 출석했어요",
    tier: "tutorial",
    xp: 5,
    category: "attendance",
    progressTarget: 1,
    check: (_recs, _badges, streak) => ({
      unlocked: streak >= 1,
      progressCurrent: Math.min(streak, 1),
      progressTarget: 1,
    }),
  },
  {
    id: "attend_3",
    badgeKey: "attend_3",
    emoji: "📅",
    title: "3일 연속 출석",
    description: "3일 연속으로 앱에 방문했어요",
    tier: "easy",
    xp: 10,
    category: "attendance",
    progressTarget: 3,
    check: (_recs, _badges, streak) => ({
      unlocked: streak >= 3,
      progressCurrent: Math.min(streak, 3),
      progressTarget: 3,
    }),
  },
  {
    id: "attend_7",
    badgeKey: "attend_7",
    emoji: "🗓️",
    title: "7일 연속 출석",
    description: "7일 연속으로 앱에 방문했어요",
    tier: "medium",
    xp: 25,
    category: "attendance",
    progressTarget: 7,
    check: (_recs, _badges, streak) => ({
      unlocked: streak >= 7,
      progressCurrent: Math.min(streak, 7),
      progressTarget: 7,
    }),
  },
  {
    id: "attend_14",
    badgeKey: "attend_14",
    emoji: "🏆",
    title: "14일 연속 출석",
    description: "14일 연속으로 앱에 방문했어요",
    tier: "hard",
    xp: 50,
    category: "attendance",
    progressTarget: 14,
    check: (_recs, _badges, streak) => ({
      unlocked: streak >= 14,
      progressCurrent: Math.min(streak, 14),
      progressTarget: 14,
    }),
  },
  // ── 탐험 (2) ──
  {
    id: "first_away",
    badgeKey: "first_away",
    emoji: "✈️",
    title: "첫 원정",
    description: "첫 원정 경기를 직관했어요",
    tier: "easy",
    xp: 10,
    category: "exploration",
    progressTarget: 1,
    check: (records) => {
      const awayRecords = records.filter((r) => {
        if (!r.cheered_team || !r.game_id) return false;
        const ids = parseGameTeamIds(r.game_id);
        return ids.homeId && ids.homeId !== r.cheered_team;
      }).sort((a, b) => a.date.localeCompare(b.date));
      const awayCount = awayRecords.length;
      return {
        unlocked: awayCount >= 1,
        progressCurrent: Math.min(awayCount, 1),
        progressTarget: 1,
        qualifyingDate: awayCount >= 1 ? awayRecords[0].date : undefined,
      };
    },
  },
  {
    id: "stadium_3",
    badgeKey: "stadium_3",
    emoji: "🏟️",
    title: "구장 3개",
    description: "서로 다른 3개 구장을 방문했어요",
    tier: "medium",
    xp: 25,
    category: "exploration",
    progressTarget: 3,
    check: (records) => {
      const sorted = [...records].filter((r) => r.stadium).sort((a, b) => a.date.localeCompare(b.date));
      const stadiums = new Set<string>();
      let qualifyingDate: string | undefined;
      for (const r of sorted) {
        stadiums.add(r.stadium!);
        if (stadiums.size >= 3) { qualifyingDate = r.date; break; }
      }
      return {
        unlocked: stadiums.size >= 3,
        progressCurrent: Math.min(stadiums.size, 3),
        progressTarget: 3,
        qualifyingDate,
      };
    },
  },
  // ── 시크릿 (1) ──
  {
    id: "owl",
    badgeKey: "owl",
    emoji: "🦉",
    title: "올빼미",
    description: "새벽 0시~6시 사이에 직관 기록을 작성했어요",
    tier: "medium",
    xp: 25,
    category: "secret",
    progressTarget: 1,
    check: (records) => {
      const owlRecord = records.find((r) => {
        if (!r.created_at) return false;
        const hour = new Date(r.created_at.replace(" ", "T")).getHours();
        return hour >= 0 && hour < 6;
      });
      return {
        unlocked: !!owlRecord,
        progressCurrent: owlRecord ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: owlRecord ? owlRecord.date : undefined,
      };
    },
  },
  // ── Phase 2: 연승 확장 ──
  {
    id: "streak_7",
    badgeKey: "streak_7",
    emoji: "🔥🏆",
    title: "7연승",
    description: "직관 7연승을 달성했어요",
    tier: "hard",
    xp: 50,
    category: "streak",
    progressTarget: 7,
    check: (records) => {
      const s = computeStreakStats(records);
      const best = Math.max(s.longestWin, s.currentType === "W" ? s.currentCount : 0);
      let qualifyingDate: string | undefined;
      if (best >= 7) {
        const games = records
          .filter((r) => { const iw = resolveIsWin(r); return iw != null && iw !== 0; })
          .sort((a, b) => a.date.localeCompare(b.date));
        let run = 0;
        for (const g of games) {
          if (resolveIsWin(g) === 1) { run++; if (run === 7) { qualifyingDate = g.date; break; } }
          else { run = 0; }
        }
      }
      return { unlocked: best >= 7, progressCurrent: Math.min(best, 7), progressTarget: 7, qualifyingDate };
    },
  },
  // ── Phase 2: 시크릿 확장 ──
  {
    id: "doubleheader",
    badgeKey: "doubleheader",
    emoji: "👯",
    title: "더블헤더",
    description: "같은 날 2경기를 모두 직관했어요",
    tier: "medium",
    xp: 25,
    category: "secret",
    progressTarget: 1,
    check: (records) => {
      const dateCount = new Map<string, number>();
      for (const r of records) dateCount.set(r.date, (dateCount.get(r.date) ?? 0) + 1);
      const dhDate = [...dateCount.entries()].find(([, c]) => c >= 2);
      return {
        unlocked: !!dhDate,
        progressCurrent: dhDate ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: dhDate ? dhDate[0] : undefined,
      };
    },
  },
  // ── Phase 2: 탐험 확장 ──
  {
    id: "stadium_5",
    badgeKey: "stadium_5",
    emoji: "🏟️🏟️",
    title: "구장 5개",
    description: "서로 다른 5개 구장을 방문했어요",
    tier: "hard",
    xp: 50,
    category: "exploration",
    progressTarget: 5,
    check: (records) => {
      const sorted = [...records].filter((r) => r.stadium).sort((a, b) => a.date.localeCompare(b.date));
      const stadiums = new Set<string>();
      let qualifyingDate: string | undefined;
      for (const r of sorted) {
        stadiums.add(r.stadium!);
        if (stadiums.size >= 5) { qualifyingDate = r.date; break; }
      }
      return {
        unlocked: stadiums.size >= 5,
        progressCurrent: Math.min(stadiums.size, 5),
        progressTarget: 5,
        qualifyingDate,
      };
    },
  },
  {
    id: "stadium_all",
    badgeKey: "stadium_all",
    emoji: "🗺️",
    title: "전 구장 정복",
    description: "KBO 1군 8개 구장을 모두 방문했어요",
    tier: "epic",
    xp: 100,
    category: "exploration",
    progressTarget: 8,
    check: (records) => {
      const sorted = [...records].filter((r) => r.stadium).sort((a, b) => a.date.localeCompare(b.date));
      const stadiums = new Set<string>();
      let qualifyingDate: string | undefined;
      for (const r of sorted) {
        stadiums.add(r.stadium!);
        if (stadiums.size >= 8) { qualifyingDate = r.date; break; }
      }
      return {
        unlocked: stadiums.size >= 8,
        progressCurrent: Math.min(stadiums.size, 8),
        progressTarget: 8,
        qualifyingDate,
      };
    },
  },
  // ── Phase 2: 상대 전적 ──
  {
    id: "team_killer",
    badgeKey: "team_killer",
    emoji: "🎯",
    title: "킬러",
    description: "특정 팀 상대 직관 5연승을 달성했어요",
    tier: "medium",
    xp: 25,
    category: "milestone",
    progressTarget: 5,
    check: (records) => {
      const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
      const streaks = new Map<string, { current: number; best: number; bestDate: string | undefined }>();
      let maxStreak = 0;
      let qualifyingDate: string | undefined;
      for (const r of sorted) {
        const iw = resolveIsWin(r);
        if (!r.cheered_team || !r.game_id || iw !== 1) {
          for (const [, v] of streaks) v.current = 0;
          continue;
        }
        const ids = parseGameTeamIds(r.game_id);
        const opp = r.cheered_team === ids.awayId ? ids.homeId : ids.awayId;
        if (!opp) continue;
        const entry = streaks.get(opp) ?? { current: 0, best: 0, bestDate: undefined };
        entry.current++;
        if (entry.current > entry.best) { entry.best = entry.current; entry.bestDate = r.date; }
        if (entry.best > maxStreak) { maxStreak = entry.best; qualifyingDate = entry.bestDate; }
        streaks.set(opp, entry);
        // reset other teams' streaks
        for (const [k, v] of streaks) { if (k !== opp) v.current = 0; }
      }
      return {
        unlocked: maxStreak >= 5,
        progressCurrent: Math.min(maxStreak, 5),
        progressTarget: 5,
        qualifyingDate,
      };
    },
  },
  {
    id: "all_team_wins",
    badgeKey: "all_team_wins",
    emoji: "♟️",
    title: "전 구단 승리",
    description: "10개 구단 모두 상대로 승리한 경기를 직관했어요",
    tier: "epic",
    xp: 100,
    category: "milestone",
    progressTarget: 10,
    check: (records) => {
      const totalTeams = Object.keys(TEAM_COLORS).length;
      const beaten = new Set<string>();
      let qualifyingDate: string | undefined;
      const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
      for (const r of sorted) {
        if (resolveIsWin(r) !== 1 || !r.cheered_team || !r.game_id) continue;
        const ids = parseGameTeamIds(r.game_id);
        const opp = r.cheered_team === ids.awayId ? ids.homeId : ids.awayId;
        if (opp && !beaten.has(opp)) { beaten.add(opp); qualifyingDate = r.date; }
      }
      const target = totalTeams;
      return {
        unlocked: beaten.size >= target,
        progressCurrent: Math.min(beaten.size, target),
        progressTarget: target,
        qualifyingDate,
      };
    },
  },
  // ── Phase 2: 시크릿 추가 ──
  {
    id: "slugfest",
    badgeKey: "slugfest",
    emoji: "💣",
    title: "난타전",
    description: "양 팀 합계 20득점 이상 경기를 직관했어요",
    tier: "easy",
    xp: 10,
    category: "secret",
    progressTarget: 1,
    check: (records) => {
      const slugfest = records.find((r) => {
        if (r.score_home == null || r.score_away == null) return false;
        return r.score_home + r.score_away >= 20;
      });
      return {
        unlocked: !!slugfest,
        progressCurrent: slugfest ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: slugfest ? slugfest.date : undefined,
      };
    },
  },
  {
    id: "comeback",
    badgeKey: "comeback",
    emoji: "🔄",
    title: "컴백",
    description: "30일 이상 공백 후 다시 직관했어요",
    tier: "medium",
    xp: 25,
    category: "secret",
    progressTarget: 1,
    check: (records) => {
      const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
      let qualifyingDate: string | undefined;
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1].date.replace(/\./g, "-"));
        const curr = new Date(sorted[i].date.replace(/\./g, "-"));
        const days = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
        if (days >= 30) { qualifyingDate = sorted[i].date; break; }
      }
      return {
        unlocked: !!qualifyingDate,
        progressCurrent: qualifyingDate ? 1 : 0,
        progressTarget: 1,
        qualifyingDate,
      };
    },
  },
  // ── Phase 2: 출석 확장 ──
  {
    id: "attend_30",
    badgeKey: "attend_30",
    emoji: "📆",
    title: "30일 연속 출석",
    description: "30일 연속으로 앱에 방문했어요",
    tier: "hard",
    xp: 50,
    category: "attendance",
    progressTarget: 30,
    check: (_recs, _badges, streak) => ({
      unlocked: streak >= 30,
      progressCurrent: Math.min(streak, 30),
      progressTarget: 30,
    }),
  },
];

// --- XP / Level System ---

const LEVEL_TITLES = ["루키", "비기너", "아마추어", "세미프로", "프로", "올스타", "레전드"];

function xpForLevel(level: number): number {
  return level * (level + 1) * 20;
}

function tierXP(tier: BadgeTier): number {
  const map: Record<BadgeTier, number> = {
    tutorial: 5, easy: 10, medium: 25, hard: 50, epic: 100,
  };
  return map[tier];
}

export function computeLevel(badges: Badge[]): LevelInfo {
  const totalXP = badges
    .filter((b) => b.unlocked_date)
    .reduce((sum, b) => {
      const def = BADGE_DEFINITIONS.find((d) => d.badgeKey === b.badge_key);
      return sum + (def ? tierXP(def.tier) : 0);
    }, 0);

  let level = 1;
  let accumulated = 0;
  for (let lv = 1; lv <= 7; lv++) {
    const needed = xpForLevel(lv);
    if (totalXP >= accumulated + needed) {
      accumulated += needed;
      level = lv + 1;
    } else {
      break;
    }
  }
  level = Math.min(level, 7);

  const requiredXP = xpForLevel(level);
  const prevTotal = level > 1
    ? Array.from({ length: level - 1 }, (_, i) => xpForLevel(i + 1)).reduce((a, b) => a + b, 0)
    : 0;
  const xpIntoLevel = totalXP - prevTotal;

  return {
    level,
    title: LEVEL_TITLES[level - 1],
    currentXP: xpIntoLevel,
    requiredXP,
    progress: Math.min(xpIntoLevel / requiredXP, 1),
  };
}

// --- Badge Evaluation Engine ---

export async function evaluateBadges(): Promise<Badge[]> {
  const [records, existingBadges, attendanceStreak] = await Promise.all([
    getJikgwanRecords(),
    getBadges(),
    checkAttendance(),
  ]);

  const existingMap = new Map(existingBadges.map((b) => [b.badge_key, b]));
  const newlyUnlocked: Badge[] = [];
  const today = new Date();
  const todayStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;

  for (const def of BADGE_DEFINITIONS) {
    const existing = existingMap.get(def.badgeKey);
    if (existing?.unlocked_date) continue;

    const result = def.check(records, existingBadges, attendanceStreak);

    if (result.unlocked) {
      await upsertBadge({
        id: def.id,
        badge_key: def.badgeKey,
        unlocked_date: result.qualifyingDate ?? todayStr,
        progress_current: result.progressTarget,
        progress_target: result.progressTarget,
      });
      newlyUnlocked.push({
        id: def.id,
        badge_key: def.badgeKey,
        unlocked_date: result.qualifyingDate ?? todayStr,
        progress_current: result.progressTarget,
        progress_target: result.progressTarget,
        is_notified: 0,
      });
    } else if (result.progressCurrent !== existing?.progress_current) {
      await upsertBadge({
        id: def.id,
        badge_key: def.badgeKey,
        unlocked_date: null,
        progress_current: result.progressCurrent,
        progress_target: result.progressTarget,
      });
    }
  }

  return newlyUnlocked;
}
