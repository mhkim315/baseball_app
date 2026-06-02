import type { BadgeDefinition } from "../types";
import { resolveIsWin } from "@/lib/expenseStats";
import { parseGameTeamIds } from "@shared/constants";

export const MILESTONE_BADGES: BadgeDefinition[] = [
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
  // ── 상대 전적 ──
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
    check: (records, _existingBadges, _attendanceStreak, _myTeam, _installDate, _totalAttendanceDays, _unlockedEmotions) => {
      const byOpp = new Map<string, Map<string, typeof records[0]>>();
      for (const r of records) {
        if (!r.cheered_team || !r.game_id) continue;
        const ids = parseGameTeamIds(r.game_id);
        const opp = r.cheered_team === ids.awayId ? ids.homeId : ids.awayId;
        if (!opp) continue;
        if (!byOpp.has(opp)) byOpp.set(opp, new Map());
        byOpp.get(opp)!.set(r.date, r);
      }
      let maxStreak = 0;
      let qualifyingDate: string | undefined;
      for (const [, dateMap] of byOpp) {
        const sorted = [...dateMap.values()].sort((a, b) => a.date.localeCompare(b.date));
        let current = 0, best = 0;
        for (const r of sorted) {
          const iw = resolveIsWin(r);
          if (iw === 1) {
            current++;
            if (current > best) {
              best = current;
              if (best >= 5) qualifyingDate = r.date;
            }
          } else {
            current = 0;
          }
        }
        if (best > maxStreak) maxStreak = best;
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
        if (opp && !beaten.has(opp)) {
          beaten.add(opp);
          qualifyingDate = r.date;
        }
      }
      return {
        unlocked: beaten.size >= 9,
        progressCurrent: Math.min(beaten.size, 9),
        progressTarget: 9,
        qualifyingDate,
      };
    },
  },
  // ── 시즌 관련 ──
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
        const parts = r.date.split(".");
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
        const parts = r.date.split(".");
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
  // ── Data-driven: 일기/사진 ──
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
      const diaryCount = records.filter((r) => r.three_line_1 || r.three_line_2 || r.three_line_3).length;
      const sorted = [...records]
        .filter((r) => r.three_line_1 || r.three_line_2 || r.three_line_3)
        .sort((a, b) => a.date.localeCompare(b.date));
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
      const diaryCount = records.filter((r) => r.three_line_1 || r.three_line_2 || r.three_line_3).length;
      const sorted = [...records]
        .filter((r) => r.three_line_1 || r.three_line_2 || r.three_line_3)
        .sort((a, b) => a.date.localeCompare(b.date));
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
      const hasPhoto = (r: typeof records[0]) => (r.photos && r.photos !== "[]") || r.photo_path;
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
      const hasPhoto = (r: typeof records[0]) => (r.photos && r.photos !== "[]") || r.photo_path;
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
];
