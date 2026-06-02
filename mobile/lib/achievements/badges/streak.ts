import type { BadgeDefinition } from "../types";
import { findStreakQualifyingDate } from "../helpers";
import { computeStreakStats } from "@/lib/stats";

export const STREAK_BADGES: BadgeDefinition[] = [
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
];
