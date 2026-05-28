import {
  getJikgwanRecords,
  getBadges,
  checkAttendance,
  getTotalAttendanceDays,
  getMyTeam,
  getInstallDate,
  getUnlockedEmotions,
  addUnlockedEmotion,
  getDb,
  type Badge,
} from "@/lib/db";
import { computeBadgeResults } from "./pureEvaluator";
import { CHARACTER_LOCKABLE_SET, ALL_CHARACTERS } from "@/lib/emotions";

export interface CharacterReward {
  emotion: string;
  label: string;
}

/**
 * Persist badge evaluation results into SQLite inside a single immediate transaction.
 */
export async function persistBadgeResults(results: { newlyUnlocked: Badge[]; progressUpdated: Badge[] }): Promise<void> {
  const database = await getDb();
  await database.runAsync("BEGIN IMMEDIATE");
  try {
    const allUpdates = [...results.newlyUnlocked, ...results.progressUpdated];
    for (const badge of allUpdates) {
      await database.runAsync(
        `INSERT OR REPLACE INTO badges (id, badge_key, unlocked_date, progress_current, progress_target, is_notified)
         VALUES (?, ?, ?, ?, ?, ?)`,
        badge.id,
        badge.badge_key,
        badge.unlocked_date,
        badge.progress_current,
        badge.progress_target,
        badge.is_notified
      );
    }
    await database.runAsync("COMMIT");
  } catch (e) {
    await database.runAsync("ROLLBACK");
    throw e;
  }
}

/**
 * Evaluate all badges and return the list of newly unlocked badges.
 */
export async function evaluateBadges(): Promise<Badge[]> {
  const [
    records,
    existingBadges,
    attendanceStreak,
    totalAttendanceDays,
    myTeam,
    installDate,
    unlockedEmotions,
  ] = await Promise.all([
    getJikgwanRecords(),
    getBadges(),
    checkAttendance(),
    getTotalAttendanceDays(),
    getMyTeam(),
    getInstallDate(),
    getUnlockedEmotions(),
  ]);

  const results = computeBadgeResults({
    records,
    existingBadges,
    attendanceStreak,
    totalAttendanceDays,
    myTeam,
    installDate,
    unlockedEmotions,
  });

  await persistBadgeResults(results);

  return results.newlyUnlocked;
}

/**
 * Unlock a random locked character and return its information.
 */
export async function grantRandomCharacter(): Promise<CharacterReward | null> {
  const unlocked = await getUnlockedEmotions();
  const lockable = CHARACTER_LOCKABLE_SET.filter((c) => !unlocked.includes(c));
  if (lockable.length === 0) return null;
  const pick = lockable[Math.floor(Math.random() * lockable.length)];
  await addUnlockedEmotion(pick);
  const def = ALL_CHARACTERS.find((c) => c.id === pick);
  return { emotion: pick, label: def?.label ?? pick };
}
