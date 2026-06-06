import type { Badge, JikgwanRecord } from "@/lib/db";
import { BADGE_DEFINITIONS } from "./definitions";
import { formatDate } from "@/lib/dateUtils";

export interface BadgeEvaluationContext {
  records: JikgwanRecord[];
  existingBadges: Badge[];
  attendanceStreak: number;
  totalAttendanceDays: number;
  myTeam: string | null;
  installDate?: string;
  unlockedEmotions?: string[];
  todayStr?: string; // For testing or customized current date
}

export interface BadgeUpdateResult {
  newlyUnlocked: Badge[];
  progressUpdated: Badge[];
}

/**
 * Pure evaluation function. Does not access the database.
 * Computes which badges should be unlocked or progress updated based on the context.
 */
export function computeBadgeResults(context: BadgeEvaluationContext): BadgeUpdateResult {
  const {
    records,
    existingBadges,
    attendanceStreak,
    totalAttendanceDays,
    myTeam,
    installDate,
    unlockedEmotions,
    todayStr,
  } = context;

  const resolvedTodayStr =
    todayStr ??
    (() => {
      const today = new Date();
      return formatDate(today);
    })();

  const existingMap = new Map(existingBadges.map((b) => [b.badge_key, b]));
  const newlyUnlocked: Badge[] = [];
  const progressUpdated: Badge[] = [];

  for (const def of BADGE_DEFINITIONS) {
    const existing = existingMap.get(def.badgeKey);
    if (existing?.unlocked_date) continue;

    const result = def.check(
      records,
      existingBadges,
      attendanceStreak,
      myTeam,
      installDate,
      totalAttendanceDays,
      unlockedEmotions
    );

    if (result.unlocked) {
      const badge: Badge = {
        id: def.id,
        badge_key: def.badgeKey,
        unlocked_date: result.qualifyingDate ?? resolvedTodayStr,
        progress_current: result.progressTarget,
        progress_target: result.progressTarget,
        is_notified: 0,
      };
      newlyUnlocked.push(badge);
    } else if (result.progressCurrent !== (existing?.progress_current ?? 0)) {
      const badge: Badge = {
        id: def.id,
        badge_key: def.badgeKey,
        unlocked_date: null,
        progress_current: result.progressCurrent,
        progress_target: result.progressTarget,
        is_notified: existing?.is_notified ?? 0,
      };
      progressUpdated.push(badge);
    }
  }

  return { newlyUnlocked, progressUpdated };
}
