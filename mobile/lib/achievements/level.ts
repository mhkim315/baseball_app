import type { Badge } from "@/lib/db";
import { BADGE_DEFINITIONS, type BadgeTier } from "./definitions";

export interface LevelInfo {
  level: number;
  title: string;
  currentXP: number;
  requiredXP: number;
  progress: number;
}

const LEVEL_TITLES = ["루키", "비기너", "아마추어", "세미프로", "프로", "올스타", "레전드"];

export function xpForLevel(level: number): number {
  return level * (level + 1) * 20;
}

export function tierXP(tier: BadgeTier): number {
  const map: Record<BadgeTier, number> = {
    tutorial: 5,
    easy: 10,
    medium: 25,
    hard: 50,
    epic: 100,
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
