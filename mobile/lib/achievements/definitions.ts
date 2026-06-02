import { MILESTONE_BADGES } from "./badges/milestone";
import { STREAK_BADGES } from "./badges/streak";
import { ATTENDANCE_BADGES } from "./badges/attendance";
import { EXPLORATION_BADGES } from "./badges/exploration";
import { SECRET_BADGES } from "./badges/secret";
import type { BadgeDefinition } from "./types";

export type { BadgeTier, BadgeDefinition, BadgeEvalResult } from "./types";
export { findStreakQualifyingDate, findStreakQualifyingDateLoss } from "./helpers";

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  ...MILESTONE_BADGES,
  ...STREAK_BADGES,
  ...ATTENDANCE_BADGES,
  ...EXPLORATION_BADGES,
  ...SECRET_BADGES,
];

export function getVisibleBadgeDefinitions(myTeam: string | null): BadgeDefinition[] {
  return BADGE_DEFINITIONS.filter((def) => {
    if (!def.teamId) return true;
    return def.teamId === myTeam;
  });
}
