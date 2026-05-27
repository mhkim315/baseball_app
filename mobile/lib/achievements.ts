import { getJikgwanRecords, updateJikgwanRecord, getBadges, getDb, checkAttendance, getTotalAttendanceDays, getMyTeam, getInstallDate, type Badge, type JikgwanRecord } from "@/lib/db";
import { computeStreakStats } from "@/lib/stats";
import { resolveIsWin } from "@/lib/expenseStats";
import { parseGameTeamIds } from "@shared/constants";
import { TEAM_COLORS } from "@shared/teamColors";
import { cachedDailyScores } from "@/lib/gameCache";
import { EMOTION_COUNT, CHARACTER_LOCKABLE_SET, ALL_CHARACTERS } from "@/lib/emotions";

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
  teamId?: string;
  check: (records: JikgwanRecord[], existingBadges: Badge[], attendanceStreak: number, myTeam?: string | null, installDate?: string, totalAttendanceDays?: number) => BadgeEvalResult;
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

function findStreakQualifyingDate(records: JikgwanRecord[], target: number): string | undefined {
  const games = records
    .filter((r) => { const iw = resolveIsWin(r); return iw != null && iw !== 0; })
    .sort((a, b) => a.date.localeCompare(b.date));
  // Deduplicate by date (same logic as computeStreakStats)
  const seen = new Map<string, JikgwanRecord>();
  for (const g of games) seen.set(g.date, g);
  const unique = [...seen.values()].sort((a, b) => a.date.localeCompare(b.date));
  let run = 0;
  for (const g of unique) {
    if (resolveIsWin(g) === 1) { run++; if (run === target) return g.date; }
    else { run = 0; }
  }
  return undefined;
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
  // ── 집관 마일스톤 (5) ──
  {
    id: "home_first",
    badgeKey: "home_first",
    emoji: "📺",
    title: "첫 집관",
    description: "TV로 첫 집관 기록을 작성했어요",
    tier: "tutorial",
    xp: 5,
    category: "milestone",
    progressTarget: 1,
    check: (records) => {
      const homeRecords = records.filter((r) => r.is_live === 0).sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: homeRecords.length >= 1,
        progressCurrent: Math.min(homeRecords.length, 1),
        progressTarget: 1,
        qualifyingDate: homeRecords.length >= 1 ? homeRecords[0].date : undefined,
      };
    },
  },
  {
    id: "home_10",
    badgeKey: "home_10",
    emoji: "📺",
    title: "집관 10회",
    description: "TV 집관 10회를 기록했어요",
    tier: "easy",
    xp: 10,
    category: "milestone",
    progressTarget: 10,
    check: (records) => {
      const homeRecords = records.filter((r) => r.is_live === 0).sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: homeRecords.length >= 10,
        progressCurrent: Math.min(homeRecords.length, 10),
        progressTarget: 10,
        qualifyingDate: homeRecords.length >= 10 ? homeRecords[9].date : undefined,
      };
    },
  },
  {
    id: "home_30",
    badgeKey: "home_30",
    emoji: "🖥️",
    title: "집관 30회",
    description: "TV 집관 30회를 기록했어요",
    tier: "medium",
    xp: 25,
    category: "milestone",
    progressTarget: 30,
    check: (records) => {
      const homeRecords = records.filter((r) => r.is_live === 0).sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: homeRecords.length >= 30,
        progressCurrent: Math.min(homeRecords.length, 30),
        progressTarget: 30,
        qualifyingDate: homeRecords.length >= 30 ? homeRecords[29].date : undefined,
      };
    },
  },
  {
    id: "home_50",
    badgeKey: "home_50",
    emoji: "💻",
    title: "집관 50회",
    description: "TV 집관 50회를 기록했어요",
    tier: "hard",
    xp: 50,
    category: "milestone",
    progressTarget: 50,
    check: (records) => {
      const homeRecords = records.filter((r) => r.is_live === 0).sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: homeRecords.length >= 50,
        progressCurrent: Math.min(homeRecords.length, 50),
        progressTarget: 50,
        qualifyingDate: homeRecords.length >= 50 ? homeRecords[49].date : undefined,
      };
    },
  },
  {
    id: "home_100",
    badgeKey: "home_100",
    emoji: "🏠",
    title: "집관 100회",
    description: "TV 집관 100회를 기록했어요",
    tier: "epic",
    xp: 100,
    category: "milestone",
    progressTarget: 100,
    check: (records) => {
      const homeRecords = records.filter((r) => r.is_live === 0).sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: homeRecords.length >= 100,
        progressCurrent: Math.min(homeRecords.length, 100),
        progressTarget: 100,
        qualifyingDate: homeRecords.length >= 100 ? homeRecords[99].date : undefined,
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
      return {
        unlocked: best >= 3,
        progressCurrent: Math.min(best, 3),
        progressTarget: 3,
        qualifyingDate: best >= 3 ? findStreakQualifyingDate(records, 3) : undefined,
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
      return {
        unlocked: best >= 5,
        progressCurrent: Math.min(best, 5),
        progressTarget: 5,
        qualifyingDate: best >= 5 ? findStreakQualifyingDate(records, 5) : undefined,
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
      return {
        unlocked: best >= 10,
        progressCurrent: Math.min(best, 10),
        progressTarget: 10,
        qualifyingDate: best >= 10 ? findStreakQualifyingDate(records, 10) : undefined,
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
        // created_at is UTC from SQLite CURRENT_TIMESTAMP; convert to KST (UTC+9)
        const utcHour = parseInt(r.created_at.slice(11, 13), 10);
        const kstHour = (utcHour + 9) % 24;
        return kstHour >= 0 && kstHour < 6;
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
      return {
        unlocked: best >= 7,
        progressCurrent: Math.min(best, 7),
        progressTarget: 7,
        qualifyingDate: best >= 7 ? findStreakQualifyingDate(records, 7) : undefined,
      };
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
    category: "exploration",
    progressTarget: 1,
    check: (records) => {
      const dateGames = new Map<string, Set<string>>();
      for (const r of records) {
        if (!dateGames.has(r.date)) dateGames.set(r.date, new Set());
        dateGames.get(r.date)!.add(r.game_id);
      }
      const dhDate = [...dateGames.entries()].find(([, games]) => games.size >= 2);
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
    description: "KBO 1군 9개 구장을 모두 방문했어요",
    tier: "epic",
    xp: 100,
    category: "exploration",
    progressTarget: 9,
    check: (records) => {
      const sorted = [...records].filter((r) => r.stadium).sort((a, b) => a.date.localeCompare(b.date));
      const stadiums = new Set<string>();
      let qualifyingDate: string | undefined;
      for (const r of sorted) {
        stadiums.add(r.stadium!);
        if (stadiums.size >= 9) { qualifyingDate = r.date; break; }
      }
      return {
        unlocked: stadiums.size >= 9,
        progressCurrent: Math.min(stadiums.size, 9),
        progressTarget: 9,
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
      // Build per-opponent arrays, deduplicated by date
      const byOpp = new Map<string, Map<string, JikgwanRecord>>();
      for (const r of records) {
        if (!r.cheered_team || !r.game_id) continue;
        const ids = parseGameTeamIds(r.game_id);
        const opp = r.cheered_team === ids.awayId ? ids.homeId : ids.awayId;
        if (!opp) continue;
        if (!byOpp.has(opp)) byOpp.set(opp, new Map());
        byOpp.get(opp)!.set(r.date, r);
      }
      const streaks = new Map<string, { current: number; best: number; bestDate: string | undefined }>();
      let maxStreak = 0;
      let qualifyingDate: string | undefined;
      for (const [opp, dateMap] of byOpp) {
        const sorted = [...dateMap.values()].sort((a, b) => a.date.localeCompare(b.date));
        const entry = streaks.get(opp) ?? { current: 0, best: 0, bestDate: undefined };
        for (const r of sorted) {
          const iw = resolveIsWin(r);
          if (iw === 1) {
            entry.current++;
            if (entry.current > entry.best) { entry.best = entry.current; entry.bestDate = r.date; }
          } else {
            entry.current = 0;
          }
        }
        if (entry.best > maxStreak) { maxStreak = entry.best; qualifyingDate = entry.bestDate; }
        streaks.set(opp, entry);
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
    description: "9개 구단 모두 상대로 승리한 경기를 직관했어요",
    tier: "epic",
    xp: 100,
    category: "milestone",
    progressTarget: 9,
    check: (records) => {
      const beaten = new Set<string>();
      let qualifyingDate: string | undefined;
      const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
      for (const r of sorted) {
        if (resolveIsWin(r) !== 1 || !r.cheered_team || !r.game_id) continue;
        const ids = parseGameTeamIds(r.game_id);
        const opp = r.cheered_team === ids.awayId ? ids.homeId : ids.awayId;
        if (opp && !beaten.has(opp)) { beaten.add(opp); qualifyingDate = r.date; }
      }
      return {
        unlocked: beaten.size >= 9,
        progressCurrent: Math.min(beaten.size, 9),
        progressTarget: 9,
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
  // ── Phase 4: KBO 특화 배지 ──
  {
    id: "blowout",
    badgeKey: "blowout",
    emoji: "💪",
    title: "대승 직관",
    description: "10점차 이상 대승 경기 직관",
    tier: "easy",
    xp: 10,
    category: "exploration",
    progressTarget: 1,
    check: (records) => {
      const match = records.find((r) => {
        const win = resolveIsWin(r);
        return win === 1 && r.score_away != null && r.score_home != null
          && Math.abs(r.score_away! - r.score_home!) >= 10;
      });
      return {
        unlocked: !!match,
        progressCurrent: match ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: match?.date,
      };
    },
  },
  {
    id: "one_run_win",
    badgeKey: "one_run_win",
    emoji: "😱",
    title: "한점차 승리",
    description: "1점차 승리 경기 직관",
    tier: "easy",
    xp: 10,
    category: "exploration",
    progressTarget: 1,
    check: (records) => {
      const match = records.find((r) => {
        const win = resolveIsWin(r);
        return win === 1 && r.score_away != null && r.score_home != null
          && Math.abs(r.score_away! - r.score_home!) === 1;
      });
      return {
        unlocked: !!match,
        progressCurrent: match ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: match?.date,
      };
    },
  },
  {
    id: "opening_day",
    badgeKey: "opening_day",
    emoji: "🎊",
    title: "개막전 직관",
    description: "개막 시즌 경기 직관",
    tier: "easy",
    xp: 10,
    category: "milestone",
    progressTarget: 1,
    check: (records) => {
      const match = records.find((r) => {
        const parts = r.date.split('.');
        if (parts.length < 3) return false;
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        return month === 3 && day >= 20;
      });
      return {
        unlocked: !!match,
        progressCurrent: match ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: match?.date,
      };
    },
  },
  {
    id: "tie_game",
    badgeKey: "tie_game",
    emoji: "🤝",
    title: "무승부 직관",
    description: "무승부 경기 직관",
    tier: "easy",
    xp: 10,
    category: "exploration",
    progressTarget: 1,
    check: (records) => {
      const match = records.find((r) => resolveIsWin(r) === 0);
      return {
        unlocked: !!match,
        progressCurrent: match ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: match?.date,
      };
    },
  },
  {
    id: "shutout",
    badgeKey: "shutout",
    emoji: "🧤",
    title: "완봉승 직관",
    description: "상대팀 0점 승리 직관",
    tier: "easy",
    xp: 10,
    category: "exploration",
    progressTarget: 1,
    check: (records) => {
      const match = records.find((r) => {
        const win = resolveIsWin(r);
        return win === 1 && r.score_away != null && r.score_home != null
          && (r.score_home === 0 || r.score_away === 0);
      });
      return {
        unlocked: !!match,
        progressCurrent: match ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: match?.date,
      };
    },
  },
  // ── Phase 5: 구단별 시크릿 배지 (10종) ──
  {
    id: "cant_live_without_kia",
    badgeKey: "cant_live_without_kia",
    emoji: "🎵",
    title: "KIA 없인 못 살아",
    description: "KIA 응원가처럼 — KIA 승리를 5회 직관했어요",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "kia",
    progressTarget: 5,
    check: (records) => {
      const wins = records.filter(r =>
        r.cheered_team === "kia" && resolveIsWin(r) === 1
      );
      const sorted = [...wins].sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: wins.length >= 5,
        progressCurrent: Math.min(wins.length, 5),
        progressTarget: 5,
        qualifyingDate: wins.length >= 5 ? sorted[4]?.date : undefined,
      };
    },
  },
  {
    id: "jokka_line",
    badgeKey: "jokka_line",
    emoji: "🦾",
    title: "JOKKA 라인",
    description: "전설의 삼성 불펜처럼 — 1점차 접전 승리를 직관했어요",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "samsung",
    progressTarget: 1,
    check: (records) => {
      const match = records.find(r =>
        r.cheered_team === "samsung" && resolveIsWin(r) === 1 &&
        r.score_away != null && r.score_home != null &&
        Math.abs(r.score_away! - r.score_home!) === 1
      );
      return {
        unlocked: !!match,
        progressCurrent: match ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: match?.date,
      };
    },
  },
  {
    id: "seungri_yojeong",
    badgeKey: "seungri_yojeong",
    emoji: "🧚",
    title: "승리의 요정",
    description: "LG 연속 3승을 직관했어요 — 승리의 요정이 왔나봐요",
    tier: "medium",
    xp: 15,
    category: "secret",
    teamId: "lg",
    progressTarget: 3,
    check: (records) => {
      // Deduplicate by date to prevent multiple records on the same day inflating streak
      const lg = [...records
        .filter(r => r.cheered_team === "lg")
        .reduce((map, r) => { map.set(r.date, r); return map; }, new Map<string, JikgwanRecord>())
        .values()].sort((a, b) => a.date.localeCompare(b.date));
      let streak = 0, best = 0, bestDate: string | undefined;
      for (const r of lg) {
        if (resolveIsWin(r) === 1) { streak++; if (streak > best) { best = streak; bestDate = r.date; } }
        else { streak = 0; }
      }
      return {
        unlocked: best >= 3,
        progressCurrent: Math.min(best, 3),
        progressTarget: 3,
        qualifyingDate: bestDate,
      };
    },
  },
  {
    id: "positive_rhythm",
    badgeKey: "positive_rhythm",
    emoji: "🐻",
    title: "긍정리듬",
    description: "두산 2연패 직관 — 괜찮아요, 긍정리듬이 있어요",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "doosan",
    progressTarget: 2,
    check: (records) => {
      // Deduplicate by date to prevent multiple records on the same day inflating streak
      const doosan = [...records
        .filter(r => r.cheered_team === "doosan")
        .reduce((map, r) => { map.set(r.date, r); return map; }, new Map<string, JikgwanRecord>())
        .values()].sort((a, b) => a.date.localeCompare(b.date));
      let streak = 0, best = 0, bestDate: string | undefined;
      for (const r of doosan) {
        if (resolveIsWin(r) === -1) { streak++; if (streak > best) { best = streak; bestDate = r.date; } }
        else { streak = 0; }
      }
      return {
        unlocked: best >= 2,
        progressCurrent: Math.min(best, 2),
        progressTarget: 2,
        qualifyingDate: best >= 2 ? bestDate : undefined,
      };
    },
  },
  {
    id: "brand_god",
    badgeKey: "brand_god",
    emoji: "🏷️",
    title: "브랜드의 가치",
    description: "SSG 직관 3회 — 이게 바로 브랜드의 가치",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "ssg",
    progressTarget: 3,
    check: (records) => {
      const ssg = records
        .filter(r => r.cheered_team === "ssg")
        .sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: ssg.length >= 3,
        progressCurrent: Math.min(ssg.length, 3),
        progressTarget: 3,
        qualifyingDate: ssg.length >= 3 ? ssg[2]?.date : undefined,
      };
    },
  },
  {
    id: "wiz_magic",
    badgeKey: "wiz_magic",
    emoji: "🪄",
    title: "위즈 매직",
    description: "KT 홈경기 승리를 직관했어요 — 수원의 마법",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "kt",
    progressTarget: 1,
    check: (records) => {
      const match = records.find(r => {
        if (r.cheered_team !== "kt" || !r.game_id || resolveIsWin(r) !== 1) return false;
        const ids = parseGameTeamIds(r.game_id);
        return ids.homeId === "kt";
      });
      return {
        unlocked: !!match,
        progressCurrent: match ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: match?.date,
      };
    },
  },
  {
    id: "kim_taekjin",
    badgeKey: "kim_taekjin",
    emoji: "💻",
    title: "김택진입니다",
    description: "NC 원정경기 승리를 직관했어요 — 구단주의 마음으로",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "nc",
    progressTarget: 1,
    check: (records) => {
      const match = records.find(r => {
        if (r.cheered_team !== "nc" || !r.game_id || resolveIsWin(r) !== 1) return false;
        const ids = parseGameTeamIds(r.game_id);
        return ids.awayId === "nc";
      });
      return {
        unlocked: !!match,
        progressCurrent: match ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: match?.date,
      };
    },
  },
  {
    id: "busan_galmaegi",
    badgeKey: "busan_galmaegi",
    emoji: "🌊",
    title: "부산 갈매기",
    description: "사직구장에서 롯데 직관 — 돛대도 아니 달고 삿대도 없이",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "lotte",
    progressTarget: 3,
    check: (records) => {
      const 사직방문 = records
        .filter(r => r.cheered_team === "lotte" && r.stadium != null && r.stadium.includes("사직"))
        .sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: 사직방문.length >= 3,
        progressCurrent: Math.min(사직방문.length, 3),
        progressTarget: 3,
        qualifyingDate: 사직방문.length >= 3 ? 사직방문[2].date : undefined,
      };
    },
  },
  {
    id: "im_happy",
    badgeKey: "im_happy",
    emoji: "😇",
    title: "나는 행복합니다",
    description: "한화 패배를 5회 직관 — 그래도 나는 행복합니다",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "hanwha",
    progressTarget: 5,
    check: (records) => {
      const losses = records.filter(r =>
        r.cheered_team === "hanwha" && resolveIsWin(r) === -1
      );
      const sorted = [...losses].sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: losses.length >= 5,
        progressCurrent: Math.min(losses.length, 5),
        progressTarget: 5,
        qualifyingDate: losses.length >= 5 ? sorted[4]?.date : undefined,
      };
    },
  },
  {
    id: "heroes_way",
    badgeKey: "heroes_way",
    emoji: "🦸",
    title: "영웅의 길",
    description: "키움 응원 승리를 직관했어요 — 비재벌 구단의 자존심",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "kiwoom",
    progressTarget: 1,
    check: (records) => {
      const match = records.find(r =>
        r.cheered_team === "kiwoom" && resolveIsWin(r) === 1
      );
      return {
        unlocked: !!match,
        progressCurrent: match ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: match?.date,
      };
    },
  },
  // ── Phase 6: 구단별 배지 확장 (11종) ──
  {
  id: "tiger_charge",
  badgeKey: "tiger_charge",
  emoji: "🐯",
  title: "호랑이 군단",
  description: "KIA 타이거즈의 위엄 — 6점차 대승을 직관했어요",
  tier: "easy",
  xp: 10,
  category: "secret",
  teamId: "kia",
  progressTarget: 1,
  check: (records) => {
    const match = records.find(r =>
      r.cheered_team === "kia" && resolveIsWin(r) === 1 &&
      r.score_away != null && r.score_home != null &&
      Math.abs(r.score_away! - r.score_home!) >= 6
    );
    return {
      unlocked: !!match,
      progressCurrent: match ? 1 : 0,
      progressTarget: 1,
      qualifyingDate: match?.date,
    };
  },
},
{
  id: "lapark_master",
  badgeKey: "lapark_master",
  emoji: "🏟️",
  title: "라팍의 주인",
  description: "삼성 라이온즈 파크에서 홈 승리를 직관했어요",
  tier: "easy",
  xp: 10,
  category: "secret",
  teamId: "samsung",
  progressTarget: 1,
  check: (records) => {
    const match = records.find(r => {
      if (r.cheered_team !== "samsung" || !r.game_id || resolveIsWin(r) !== 1) return false;
      const ids = parseGameTeamIds(r.game_id);
      return ids.homeId === "samsung";
    });
    return {
      unlocked: !!match,
      progressCurrent: match ? 1 : 0,
      progressTarget: 1,
      qualifyingDate: match?.date,
    };
  },
},
{
  id: "shinbaram",
  badgeKey: "shinbaram",
  emoji: "🎺",
  title: "신바람 야구",
  description: "LG 8득점 이상 폭발 — 신나는 야구를 직관했어요",
  tier: "easy",
  xp: 10,
  category: "secret",
  teamId: "lg",
  progressTarget: 1,
  check: (records) => {
    const match = records.find(r => {
      if (r.cheered_team !== "lg" || resolveIsWin(r) !== 1) return false;
      if (r.score_away == null || r.score_home == null || !r.game_id) return false;
      const ids = parseGameTeamIds(r.game_id);
      if (!ids) return false;
      const isHome = ids.homeId === "lg";
      const teamScore = isHome ? r.score_home! : r.score_away!;
      return teamScore >= 8;
    });
    return {
      unlocked: !!match,
      progressCurrent: match ? 1 : 0,
      progressTarget: 1,
      qualifyingDate: match?.date,
    };
  },
},
{
  id: "jamsil_derby",
  badgeKey: "jamsil_derby",
  emoji: "⚔️",
  title: "잠실 더비 승자",
  description: "LG가 두산을 꺾는 잠실 더비를 직관했어요",
  tier: "easy",
  xp: 10,
  category: "secret",
  teamId: "lg",
  progressTarget: 1,
  check: (records) => {
    const match = records.find(r => {
      if (r.cheered_team !== "lg" || !r.game_id || resolveIsWin(r) !== 1) return false;
      const ids = parseGameTeamIds(r.game_id);
      const opponent = ids.homeId === "lg" ? ids.awayId : ids.homeId;
      return opponent === "doosan";
    });
    return {
      unlocked: !!match,
      progressCurrent: match ? 1 : 0,
      progressTarget: 1,
      qualifyingDate: match?.date,
    };
  },
},
{
  id: "jamsil_derby_doosan",
  badgeKey: "jamsil_derby_doosan",
  emoji: "⚔️",
  title: "잠실 더비 승자",
  description: "두산이 LG를 꺾는 잠실 더비를 직관했어요",
  tier: "easy",
  xp: 10,
  category: "secret",
  teamId: "doosan",
  progressTarget: 1,
  check: (records) => {
    const match = records.find(r => {
      if (r.cheered_team !== "doosan" || !r.game_id || resolveIsWin(r) !== 1) return false;
      const ids = parseGameTeamIds(r.game_id);
      const opponent = ids.homeId === "doosan" ? ids.awayId : ids.homeId;
      return opponent === "lg";
    });
    return {
      unlocked: !!match,
      progressCurrent: match ? 1 : 0,
      progressTarget: 1,
      qualifyingDate: match?.date,
    };
  },
},
{
  id: "for_victory",
  badgeKey: "for_victory",
  emoji: "🎸",
  title: "승리를 위하여",
  description: "두산의 승전가처럼 — 4점차 이상 승리를 직관했어요",
  tier: "easy",
  xp: 10,
  category: "secret",
  teamId: "doosan",
  progressTarget: 1,
  check: (records) => {
    const match = records.find(r =>
      r.cheered_team === "doosan" && resolveIsWin(r) === 1 &&
      r.score_away != null && r.score_home != null &&
      Math.abs(r.score_away! - r.score_home!) >= 4
    );
    return {
      unlocked: !!match,
      progressCurrent: match ? 1 : 0,
      progressTarget: 1,
      qualifyingDate: match?.date,
    };
  },
},
{
  id: "bazooka",
  badgeKey: "bazooka",
  emoji: "💥",
  title: "바주카 발사",
  description: "SSG 홈경기 3승을 직관했어요 — 레드웨이브의 주인공",
  tier: "easy",
  xp: 10,
  category: "secret",
  teamId: "ssg",
  progressTarget: 3,
  check: (records) => {
    const homeWins = records.filter(r => {
      if (r.cheered_team !== "ssg" || !r.game_id || resolveIsWin(r) !== 1) return false;
      const ids = parseGameTeamIds(r.game_id);
      return ids.homeId === "ssg";
    });
    const sorted = [...homeWins].sort((a, b) => a.date.localeCompare(b.date));
    return {
      unlocked: homeWins.length >= 3,
      progressCurrent: Math.min(homeWins.length, 3),
      progressTarget: 3,
      qualifyingDate: homeWins.length >= 3 ? sorted[2]?.date : undefined,
    };
  },
},
{
  id: "water_festival",
  badgeKey: "water_festival",
  emoji: "💦",
  title: "워터 페스티벌",
  description: "KT 여름 홈경기를 직관했어요 — 시원한 물대포와 함께",
  tier: "easy",
  xp: 10,
  category: "secret",
  teamId: "kt",
  progressTarget: 1,
  check: (records) => {
    const match = records.find(r => {
      if (r.cheered_team !== "kt") return false;
      const parts = r.date.split(".");
      if (parts.length < 2) return false;
      const month = parseInt(parts[1], 10);
      return month >= 6 && month <= 8;
    });
    return {
      unlocked: !!match,
      progressCurrent: match ? 1 : 0,
      progressTarget: 1,
      qualifyingDate: match?.date,
    };
  },
},
{
  id: "tears_of_blood",
  badgeKey: "tears_of_blood",
  emoji: "🩸",
  title: "눈물의 피",
  description: "NC가 두산을 5점차로 꺾는 통쾌한 승리를 직관했어요",
  tier: "easy",
  xp: 10,
  category: "secret",
  teamId: "nc",
  progressTarget: 1,
  check: (records) => {
    const match = records.find(r => {
      if (r.cheered_team !== "nc" || !r.game_id || resolveIsWin(r) !== 1) return false;
      if (r.score_away == null || r.score_home == null) return false;
      const ids = parseGameTeamIds(r.game_id);
      const opponent = ids.homeId === "nc" ? ids.awayId : ids.homeId;
      return opponent === "doosan" && Math.abs(r.score_away! - r.score_home!) >= 5;
    });
    return {
      unlocked: !!match,
      progressCurrent: match ? 1 : 0,
      progressTarget: 1,
      qualifyingDate: match?.date,
    };
  },
},
{
  id: "busan_port",
  badgeKey: "busan_port",
  emoji: "🎤",
  title: "돌아와요 부산항에",
  description: "사직구장에서 롯데 홈 승리를 직관했어요",
  tier: "easy",
  xp: 10,
  category: "secret",
  teamId: "lotte",
  progressTarget: 1,
  check: (records) => {
    const match = records.find(r => {
      if (r.cheered_team !== "lotte" || !r.game_id || resolveIsWin(r) !== 1) return false;
      const ids = parseGameTeamIds(r.game_id);
      return ids.homeId === "lotte";
    });
    return {
      unlocked: !!match,
      progressCurrent: match ? 1 : 0,
      progressTarget: 1,
      qualifyingDate: match?.date,
    };
  },
},
{
  id: "bodhisattva",
  badgeKey: "bodhisattva",
  emoji: "🪷",
  title: "보살팬",
  description: "한화 응원 10회 직관 — 인내와 사랑의 보살팬",
  tier: "easy",
  xp: 10,
  category: "secret",
  teamId: "hanwha",
  progressTarget: 10,
  check: (records) => {
    const hanwha = records
      .filter(r => r.cheered_team === "hanwha")
      .sort((a, b) => a.date.localeCompare(b.date));
    return {
      unlocked: hanwha.length >= 10,
      progressCurrent: Math.min(hanwha.length, 10),
      progressTarget: 10,
      qualifyingDate: hanwha.length >= 10 ? hanwha[9].date : undefined,
    };
  },
},
{
  id: "small_giant",
  badgeKey: "small_giant",
  emoji: "🦸‍♂️",
  title: "작은 거인",
  description: "키움의 원정 승리를 직관했어요 — 작지만 강한 영웅들",
  tier: "easy",
  xp: 10,
  category: "secret",
  teamId: "kiwoom",
  progressTarget: 1,
  check: (records) => {
    const match = records.find(r => {
      if (r.cheered_team !== "kiwoom" || !r.game_id || resolveIsWin(r) !== 1) return false;
      const ids = parseGameTeamIds(r.game_id);
      return ids.awayId === "kiwoom";
    });
    return {
      unlocked: !!match,
      progressCurrent: match ? 1 : 0,
      progressTarget: 1,
      qualifyingDate: match?.date,
    };
  },
},
{
  id: "irresponsible_pleasure",
  badgeKey: "irresponsible_pleasure",
  emoji: "🍿",
  title: "책임없는쾌락",
  description: "내 팀이 아닌 경기를 순수하게 즐겼어요 — 타팀 VS 타팀 직관 3회",
  tier: "easy",
  xp: 10,
  category: "exploration",
  progressTarget: 3,
  check: (records, _existingBadges, _attendanceStreak, myTeam) => {
    if (!myTeam) return { unlocked: false, progressCurrent: 0, progressTarget: 3 };
    const otherGames = records.filter(r => {
      if (!r.game_id) return false;
      const ids = parseGameTeamIds(r.game_id);
      return ids.homeId !== myTeam && ids.awayId !== myTeam;
    });
    const sorted = [...otherGames].sort((a, b) => a.date.localeCompare(b.date));
    return {
      unlocked: otherGames.length >= 3,
      progressCurrent: Math.min(otherGames.length, 3),
      progressTarget: 3,
      qualifyingDate: otherGames.length >= 3 ? sorted[2].date : undefined,
    };
  },
},
{
  id: "past_record_1",
  badgeKey: "past_record_1",
  emoji: "📜",
  title: "추억의 시작",
  description: "앱 설치 전 직관 기록을 1개 작성했어요",
  tier: "easy",
  xp: 10,
  category: "exploration",
  progressTarget: 1,
  check: (records, _existingBadges, _attendanceStreak, _myTeam, installDate) => {
    if (!installDate) return { unlocked: false, progressCurrent: 0, progressTarget: 1 };
    const pastRecords = records.filter(r => r.date < installDate);
    return {
      unlocked: pastRecords.length >= 1,
      progressCurrent: Math.min(pastRecords.length, 1),
      progressTarget: 1,
    };
  },
},
{
  id: "past_record_5",
  badgeKey: "past_record_5",
  emoji: "📖",
  title: "추억 소환",
  description: "앱 설치 전 직관 기록을 5개 작성했어요",
  tier: "easy",
  xp: 10,
  category: "exploration",
  progressTarget: 5,
  check: (records, _existingBadges, _attendanceStreak, _myTeam, installDate) => {
    if (!installDate) return { unlocked: false, progressCurrent: 0, progressTarget: 5 };
    const pastRecords = records.filter(r => r.date < installDate);
    return {
      unlocked: pastRecords.length >= 5,
      progressCurrent: Math.min(pastRecords.length, 5),
      progressTarget: 5,
    };
  },
},
{
  id: "past_record_10",
  badgeKey: "past_record_10",
  emoji: "📚",
  title: "추억 수집가",
  description: "앱 설치 전 직관 기록을 10개 작성했어요",
  tier: "medium",
  xp: 25,
  category: "exploration",
  progressTarget: 10,
  check: (records, _existingBadges, _attendanceStreak, _myTeam, installDate) => {
    if (!installDate) return { unlocked: false, progressCurrent: 0, progressTarget: 10 };
    const pastRecords = records.filter(r => r.date < installDate);
    return {
      unlocked: pastRecords.length >= 10,
      progressCurrent: Math.min(pastRecords.length, 10),
      progressTarget: 10,
    };
  },
},
{
  id: "past_record_20",
  badgeKey: "past_record_20",
  emoji: "⏳",
  title: "과거 여행자",
  description: "앱 설치 전 직관 기록을 20개 작성했어요",
  tier: "medium",
  xp: 25,
  category: "exploration",
  progressTarget: 20,
  check: (records, _existingBadges, _attendanceStreak, _myTeam, installDate) => {
    if (!installDate) return { unlocked: false, progressCurrent: 0, progressTarget: 20 };
    const pastRecords = records.filter(r => r.date < installDate);
    return {
      unlocked: pastRecords.length >= 20,
      progressCurrent: Math.min(pastRecords.length, 20),
      progressTarget: 20,
    };
  },
},
{
  id: "past_record_50",
  badgeKey: "past_record_50",
  emoji: "🕰️",
  title: "타임슬립",
  description: "앱 설치 전 직관 기록을 50개 작성했어요",
  tier: "hard",
  xp: 50,
  category: "exploration",
  progressTarget: 50,
  check: (records, _existingBadges, _attendanceStreak, _myTeam, installDate) => {
    if (!installDate) return { unlocked: false, progressCurrent: 0, progressTarget: 50 };
    const pastRecords = records.filter(r => r.date < installDate);
    return {
      unlocked: pastRecords.length >= 50,
      progressCurrent: Math.min(pastRecords.length, 50),
      progressTarget: 50,
    };
  },
},
  // ── Data-driven: 감정/일기/사진/경기종류 ──
  {
    id: "emotion_collector",
    badgeKey: "emotion_collector",
    emoji: "🎭",
    title: "감정 수집가",
    description: `${EMOTION_COUNT}가지 감정을 모두 기록했어요`,
    tier: "easy",
    xp: 10,
    category: "exploration",
    progressTarget: EMOTION_COUNT,
    check: (records) => {
      const emotions = new Set(records.filter(r => r.emotion).map(r => r.emotion));
      return {
        unlocked: emotions.size >= EMOTION_COUNT,
        progressCurrent: Math.min(emotions.size, EMOTION_COUNT),
        progressTarget: EMOTION_COUNT,
      };
    },
  },
  {
    id: "diary_10",
    badgeKey: "diary_10",
    emoji: "📝",
    title: "일기 수집가",
    description: "three_line 일기를 10회 작성했어요",
    tier: "easy",
    xp: 10,
    category: "milestone",
    progressTarget: 10,
    check: (records) => {
      const diaryCount = records.filter(r => r.three_line_1 || r.three_line_2 || r.three_line_3).length;
      const sorted = [...records].filter(r => r.three_line_1 || r.three_line_2 || r.three_line_3).sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: diaryCount >= 10,
        progressCurrent: Math.min(diaryCount, 10),
        progressTarget: 10,
        qualifyingDate: diaryCount >= 10 ? sorted[9]?.date : undefined,
      };
    },
  },
  {
    id: "diary_50",
    badgeKey: "diary_50",
    emoji: "📚",
    title: "일기 마스터",
    description: "three_line 일기를 50회 작성했어요",
    tier: "medium",
    xp: 25,
    category: "milestone",
    progressTarget: 50,
    check: (records) => {
      const diaryCount = records.filter(r => r.three_line_1 || r.three_line_2 || r.three_line_3).length;
      const sorted = [...records].filter(r => r.three_line_1 || r.three_line_2 || r.three_line_3).sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: diaryCount >= 50,
        progressCurrent: Math.min(diaryCount, 50),
        progressTarget: 50,
        qualifyingDate: diaryCount >= 50 ? sorted[49]?.date : undefined,
      };
    },
  },
  {
    id: "photo_10",
    badgeKey: "photo_10",
    emoji: "📸",
    title: "포토그래퍼",
    description: "사진을 10회 첨부했어요",
    tier: "easy",
    xp: 10,
    category: "milestone",
    progressTarget: 10,
    check: (records) => {
      const hasPhoto = (r: JikgwanRecord) => (r.photos && r.photos !== "[]") || r.photo_path;
      const photoCount = records.filter(hasPhoto).length;
      const sorted = [...records].filter(hasPhoto).sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: photoCount >= 10,
        progressCurrent: Math.min(photoCount, 10),
        progressTarget: 10,
        qualifyingDate: photoCount >= 10 ? sorted[9]?.date : undefined,
      };
    },
  },
  {
    id: "photo_50",
    badgeKey: "photo_50",
    emoji: "🖼️",
    title: "포토 마스터",
    description: "사진을 50회 첨부했어요",
    tier: "medium",
    xp: 25,
    category: "milestone",
    progressTarget: 50,
    check: (records) => {
      const hasPhoto = (r: JikgwanRecord) => (r.photos && r.photos !== "[]") || r.photo_path;
      const photoCount = records.filter(hasPhoto).length;
      const sorted = [...records].filter(hasPhoto).sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: photoCount >= 50,
        progressCurrent: Math.min(photoCount, 50),
        progressTarget: 50,
        qualifyingDate: photoCount >= 50 ? sorted[49]?.date : undefined,
      };
    },
  },
  {
    id: "game_type_all",
    badgeKey: "game_type_all",
    emoji: "🎓",
    title: "박학다식",
    description: "정규시즌·시범경기·포스트시즌을 모두 직관했어요",
    tier: "medium",
    xp: 25,
    category: "exploration",
    progressTarget: 3,
    check: (records) => {
      const types = new Set(records.map(r => r.game_type ?? "regular"));
      return {
        unlocked: types.size >= 3,
        progressCurrent: Math.min(types.size, 3),
        progressTarget: 3,
      };
    },
  },
  // ── 출석 확장 ──
  {
    id: "attend_100",
    badgeKey: "attend_100",
    emoji: "📆",
    title: "100일 연속 출석",
    description: "100일 연속으로 앱에 방문했어요",
    tier: "epic",
    xp: 100,
    category: "attendance",
    progressTarget: 100,
    check: (_recs, _badges, streak) => ({
      unlocked: streak >= 100,
      progressCurrent: Math.min(streak, 100),
      progressTarget: 100,
    }),
  },
  {
    id: "attend_total_30",
    badgeKey: "attend_total_30",
    emoji: "🗓️",
    title: "30일 누적 출석",
    description: "총 30일 동안 앱에 방문했어요",
    tier: "medium",
    xp: 25,
    category: "attendance",
    progressTarget: 30,
    check: (_recs, _badges, _streak, _myTeam, _installDate, totalDays) => ({
      unlocked: (totalDays ?? 0) >= 30,
      progressCurrent: Math.min(totalDays ?? 0, 30),
      progressTarget: 30,
    }),
  },
  {
    id: "attend_total_100",
    badgeKey: "attend_total_100",
    emoji: "🗓️",
    title: "100일 누적 출석",
    description: "총 100일 동안 앱에 방문했어요",
    tier: "hard",
    xp: 50,
    category: "attendance",
    progressTarget: 100,
    check: (_recs, _badges, _streak, _myTeam, _installDate, totalDays) => ({
      unlocked: (totalDays ?? 0) >= 100,
      progressCurrent: Math.min(totalDays ?? 0, 100),
      progressTarget: 100,
    }),
  },
  {
    id: "attend_total_365",
    badgeKey: "attend_total_365",
    emoji: "🎊",
    title: "365일 누적 출석",
    description: "총 365일 동안 앱에 방문했어요 — 1년을 함께했네요",
    tier: "epic",
    xp: 100,
    category: "attendance",
    progressTarget: 365,
    check: (_recs, _badges, _streak, _myTeam, _installDate, totalDays) => ({
      unlocked: (totalDays ?? 0) >= 365,
      progressCurrent: Math.min(totalDays ?? 0, 365),
      progressTarget: 365,
    }),
  },
  // ── 시즌 관련 ──
  {
    id: "final_game",
    badgeKey: "final_game",
    emoji: "🏁",
    title: "최종전",
    description: "시즌 최종전을 직관했어요",
    tier: "easy",
    xp: 10,
    category: "milestone",
    progressTarget: 1,
    check: (records) => {
      const match = records.find((r) => {
        const parts = r.date.split('.');
        if (parts.length < 3) return false;
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        return month === 10 && day >= 1;
      });
      return {
        unlocked: !!match,
        progressCurrent: match ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: match?.date,
      };
    },
  },
];

export function getVisibleBadgeDefinitions(myTeam: string | null): BadgeDefinition[] {
  return BADGE_DEFINITIONS.filter(def => {
    if (!def.teamId) return true;
    return def.teamId === myTeam;
  });
}

// --- Season Summary ---

export interface SeasonSummary {
  year: number;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  totalSpent: number;
  stadiums: string[];
  topOpponentWins: { teamId: string; shortName: string; wins: number } | null;
  topOpponentLosses: { teamId: string; shortName: string; losses: number } | null;
  longestWinStreak: number;
  emotionCounts: Record<string, number>;
  topEmotion: string | null;
  bestGame: JikgwanRecord | null;
  badgesEarned: number;
}

export function computeSeasonSummary(
  year: number,
  records: JikgwanRecord[],
  badges: Badge[],
  totalSpent: number,
): SeasonSummary {
  const yearPrefix = `${year}.`;
  const yearRecords = records.filter((r) => r.date.startsWith(yearPrefix));

  let wins = 0; let losses = 0; let draws = 0;
  const stadiumSet = new Set<string>();
  const emotionCounts: Record<string, number> = {};
  const oppWins = new Map<string, { total: number }>();
  const oppLosses = new Map<string, { total: number }>();
  let bestGame: JikgwanRecord | null = null;

  // Use sorted records (ASC) to find best game (last win of season, or first game)
  const sorted = [...yearRecords].sort((a, b) => a.date.localeCompare(b.date));

  for (const r of sorted) {
    const iw = resolveIsWin(r);
    if (iw === 1) wins++;
    else if (iw === 0) draws++;
    else if (iw === -1) losses++;

    if (r.stadium) stadiumSet.add(r.stadium);
    if (r.emotion) emotionCounts[r.emotion] = (emotionCounts[r.emotion] || 0) + 1;

    // Track opponent win/loss
    if (r.cheered_team && r.game_id && iw != null) {
      const ids = parseGameTeamIds(r.game_id);
      const opp = r.cheered_team === ids.awayId ? ids.homeId : ids.awayId;
      if (opp) {
        if (iw === 1) {
          const entry = oppWins.get(opp) ?? { total: 0 };
          entry.total++;
          oppWins.set(opp, entry);
        } else if (iw === -1) {
          const entry = oppLosses.get(opp) ?? { total: 0 };
          entry.total++;
          oppLosses.set(opp, entry);
        }
      }
    }

    // Best game: prefer a win, then highest-scoring, then most recent
    if (!bestGame && iw === 1) bestGame = r;
  }
  // Fallback: any game
  if (!bestGame && sorted.length > 0) bestGame = sorted[sorted.length - 1];

  const s = computeStreakStats(yearRecords);

  const topWins = [...oppWins.entries()].sort((a, b) => b[1].total - a[1].total)[0];
  const topLosses = [...oppLosses.entries()].sort((a, b) => b[1].total - a[1].total)[0];

  const topEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const badgesEarned = badges.filter((b) => b.unlocked_date && b.unlocked_date.startsWith(yearPrefix)).length;

  return {
    year,
    totalGames: wins + losses + draws,
    wins,
    losses,
    draws,
    winRate: wins + losses + draws > 0 ? wins / (wins + losses + draws) : 0,
    totalSpent,
    stadiums: [...stadiumSet],
    topOpponentWins: topWins ? { teamId: topWins[0], shortName: TEAM_COLORS[topWins[0]]?.shortName ?? topWins[0], wins: topWins[1].total } : null,
    topOpponentLosses: topLosses ? { teamId: topLosses[0], shortName: TEAM_COLORS[topLosses[0]]?.shortName ?? topLosses[0], losses: topLosses[1].total } : null,
    longestWinStreak: Math.max(s.longestWin, s.currentType === "W" ? s.currentCount : 0),
    emotionCounts,
    topEmotion,
    bestGame,
    badgesEarned,
  };
}

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

/**
 * Backfill records saved during live games with final scores once the game finishes.
 * Called on AppState foreground and after diary save, before evaluateBadges().
 * Returns the number of records that were updated.
 */
export async function backfillLiveRecords(): Promise<number> {
  const records = await getJikgwanRecords();
  const liveRecords = records.filter(r => r.game_status === "live");
  if (liveRecords.length === 0) return 0;

  // Group by date to batch daily score fetches
  const byDate = new Map<string, JikgwanRecord[]>();
  for (const rec of liveRecords) {
    const dateKey = rec.date.replace(/\./g, "-"); // YYYY.MM.DD → YYYY-MM-DD
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(rec);
  }

  let updatedCount = 0;
  for (const [dateKey, recs] of byDate) {
    let scores;
    try {
      scores = await cachedDailyScores(dateKey);
    } catch {
      console.warn("backfillLiveRecords: failed to fetch scores for", dateKey);
      continue;
    }
    if (!scores?.games || scores.games.length === 0) continue;

    for (const rec of recs) {
      if (!rec.game_id) continue;
      const { awayId, homeId } = parseGameTeamIds(rec.game_id);
      if (!awayId || !homeId) continue;

      const awayShort = TEAM_COLORS[awayId]?.shortName;
      const homeShort = TEAM_COLORS[homeId]?.shortName;
      if (!awayShort || !homeShort) continue;

      // Find matching score entry by team names
      const matching = scores.games.filter(
        s => s.away === awayShort && s.home === homeShort
      );
      if (matching.length === 0) continue;

      // Extract DH suffix from game_id for doubleheader matching
      const suffix = rec.game_id.split("-").pop() || "0";
      const gameIdx = parseInt(suffix, 10);
      const match = matching.find(s => (s.gameIdx ?? 0) === gameIdx) || matching[0];

      if (!match || match.outcome == null || match.cancelled) continue;

      // Game is finished — update with final scores
      const finalAwayScore = match.awayScore;
      const finalHomeScore = match.homeScore;

      let isWin: number | null = null;
      if (rec.cheered_team) {
        if (rec.cheered_team === homeId) {
          isWin = finalHomeScore > finalAwayScore ? 1 : finalHomeScore < finalAwayScore ? -1 : 0;
        } else if (rec.cheered_team === awayId) {
          isWin = finalAwayScore > finalHomeScore ? 1 : finalAwayScore < finalHomeScore ? -1 : 0;
        }
      }

      await updateJikgwanRecord(rec.id, {
        score_away: finalAwayScore,
        score_home: finalHomeScore,
        is_win: isWin,
        game_status: "finished",
      });
      updatedCount++;
    }
  }

  return updatedCount;
}

// --- Badge Evaluation Engine ---

export async function evaluateBadges(): Promise<Badge[]> {
  const [records, existingBadges, attendanceStreak, totalAttendanceDays, myTeam, installDate] = await Promise.all([
    getJikgwanRecords(),
    getBadges(),
    checkAttendance(),
    getTotalAttendanceDays(),
    getMyTeam(),
    getInstallDate(),
  ]);

  const existingMap = new Map(existingBadges.map((b) => [b.badge_key, b]));
  const newlyUnlocked: Badge[] = [];
  const today = new Date();
  const todayStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;

  // Wrap all badge upserts in a transaction so partial crash doesn't corrupt progress
  const database = await getDb();
  await database.runAsync("BEGIN IMMEDIATE");
  try {
    for (const def of BADGE_DEFINITIONS) {
      const existing = existingMap.get(def.badgeKey);
      if (existing?.unlocked_date) continue;

      const result = def.check(records, existingBadges, attendanceStreak, myTeam, installDate, totalAttendanceDays);

      if (result.unlocked) {
        await database.runAsync(
          `INSERT OR REPLACE INTO badges (id, badge_key, unlocked_date, progress_current, progress_target, is_notified)
           VALUES (?, ?, ?, ?, ?, ?)`,
          def.id, def.badgeKey, result.qualifyingDate ?? todayStr,
          result.progressTarget, result.progressTarget, 0
        );
        newlyUnlocked.push({
          id: def.id,
          badge_key: def.badgeKey,
          unlocked_date: result.qualifyingDate ?? todayStr,
          progress_current: result.progressTarget,
          progress_target: result.progressTarget,
          is_notified: 0,
        });
      } else if (result.progressCurrent !== existing?.progress_current) {
        await database.runAsync(
          `INSERT OR REPLACE INTO badges (id, badge_key, unlocked_date, progress_current, progress_target, is_notified)
           VALUES (?, ?, ?, ?, ?, ?)`,
          def.id, def.badgeKey, null,
          result.progressCurrent, result.progressTarget, 0
        );
      }
    }
    await database.runAsync("COMMIT");
  } catch (e) {
    await database.runAsync("ROLLBACK");
    throw e;
  }

  return newlyUnlocked;
}

// ── Character Reward System ──

export interface CharacterReward {
  emotion: string;
  label: string;
}

export async function grantRandomCharacter(): Promise<CharacterReward | null> {
  const { getUnlockedEmotions, addUnlockedEmotion } = await import("@/lib/db");
  const unlocked = await getUnlockedEmotions();
  const lockable = CHARACTER_LOCKABLE_SET.filter(c => !unlocked.includes(c));
  if (lockable.length === 0) return null;
  const pick = lockable[Math.floor(Math.random() * lockable.length)];
  await addUnlockedEmotion(pick);
  const def = ALL_CHARACTERS.find(c => c.id === pick);
  return { emotion: pick, label: def?.label ?? pick };
}
