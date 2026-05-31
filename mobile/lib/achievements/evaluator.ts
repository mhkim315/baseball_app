import {
  getJikgwanRecords,
  getBadges,
  checkAttendance,
  getTotalAttendanceDays,
  getMyTeam,
  getInstallDate,
  getUnlockedEmotions,
  addUnlockedEmotion,
  addUnlockedBackgrounds,
  getUnlockedBackgrounds,
  setBadgeRewardEmotion,
  getDb,
  type Badge,
} from "@/lib/db";
import { computeBadgeResults } from "./pureEvaluator";
import { CHARACTER_LOCKABLE_SET, ALL_CHARACTERS } from "@/lib/emotions";
import { computeLevel } from "./level";
import { LOCKABLE_BACKGROUNDS, BG_LABEL_MAP } from "@/lib/backgrounds";

export interface CharacterReward {
  emotion: string;
  label: string;
}

export interface BackgroundReward {
  key: string;
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
 * Evaluate all badges and return newly unlocked badges + background rewards.
 */
export async function evaluateBadges(): Promise<{ newlyUnlockedBadges: Badge[]; newlyUnlockedBackgrounds: BackgroundReward[] }> {
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

  const oldLevel = computeLevel(existingBadges).level;

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

  // Level-up background unlock
  const allUnlocked = [...existingBadges, ...results.newlyUnlocked];
  const newLevel = computeLevel(allUnlocked).level;
  const newlyUnlockedBackgrounds: BackgroundReward[] = [];

  if (newLevel > oldLevel) {
    const levelsGained = newLevel - oldLevel;
    const currentUnlocked = await getUnlockedBackgrounds();
    const stillLocked = LOCKABLE_BACKGROUNDS.filter((bg) => !currentUnlocked.includes(bg));
    const picks: string[] = [];
    const shuffled = stillLocked.sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(levelsGained, shuffled.length); i++) {
      picks.push(shuffled[i]);
    }
    if (picks.length > 0) {
      await addUnlockedBackgrounds(picks);
      for (const key of picks) {
        newlyUnlockedBackgrounds.push({ key, label: BG_LABEL_MAP[key as keyof typeof BG_LABEL_MAP] || key });
      }
    }
  }

  return { newlyUnlockedBadges: results.newlyUnlocked, newlyUnlockedBackgrounds };
}

/**
 * Unlock a random locked character and return its information.
 */
export async function grantRandomCharacter(badgeKey?: string): Promise<CharacterReward | null> {
  const unlocked = await getUnlockedEmotions();
  const lockable = CHARACTER_LOCKABLE_SET.filter((c) => !unlocked.includes(c));
  if (lockable.length === 0) return null;
  const pick = lockable[Math.floor(Math.random() * lockable.length)];
  await addUnlockedEmotion(pick);
  if (badgeKey) {
    await setBadgeRewardEmotion(badgeKey, pick);
  }
  const def = ALL_CHARACTERS.find((c) => c.id === pick);
  return { emotion: pick, label: def?.label ?? pick };
}
