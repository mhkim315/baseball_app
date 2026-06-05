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
export function persistBadgeResults(results: { newlyUnlocked: Badge[]; progressUpdated: Badge[] }): void {
  const database = getDb();
  database.runSync("BEGIN IMMEDIATE");
  try {
    const allUpdates = [...results.newlyUnlocked, ...results.progressUpdated];
    for (const badge of allUpdates) {
      database.runSync(
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
    database.runSync("COMMIT");
  } catch (e) {
    database.runSync("ROLLBACK");
    throw e;
  }
}

/**
 * Evaluate all badges and return newly unlocked badges + background rewards.
 */
export function evaluateBadges(): { newlyUnlockedBadges: Badge[]; newlyUnlockedBackgrounds: BackgroundReward[] } {
  const records = getJikgwanRecords();
  const existingBadges = getBadges();
  const attendanceStreak = checkAttendance();
  const totalAttendanceDays = getTotalAttendanceDays();
  const myTeam = getMyTeam();
  const installDate = getInstallDate();
  const unlockedEmotions = getUnlockedEmotions();

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

  persistBadgeResults(results);

  // Level-up background unlock
  const allUnlocked = [...existingBadges, ...results.newlyUnlocked];
  const newLevel = computeLevel(allUnlocked).level;
  const newlyUnlockedBackgrounds: BackgroundReward[] = [];

  if (newLevel > oldLevel) {
    const levelsGained = newLevel - oldLevel;
    const currentUnlocked = getUnlockedBackgrounds();
    const stillLocked = LOCKABLE_BACKGROUNDS.filter((bg) => !currentUnlocked.includes(bg));
    const picks: string[] = [];
    const shuffled = stillLocked.sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(levelsGained, shuffled.length); i++) {
      picks.push(shuffled[i]);
    }
    if (picks.length > 0) {
      addUnlockedBackgrounds(picks);
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
export function grantRandomCharacter(badgeKey?: string): CharacterReward | null {
  const unlocked = getUnlockedEmotions();
  const lockable = CHARACTER_LOCKABLE_SET.filter((c) => !unlocked.includes(c));
  if (lockable.length === 0) return null;
  const pick = lockable[Math.floor(Math.random() * lockable.length)];
  addUnlockedEmotion(pick);
  if (badgeKey) {
    setBadgeRewardEmotion(badgeKey, pick);
  }
  const def = ALL_CHARACTERS.find((c) => c.id === pick);
  return { emotion: pick, label: def?.label ?? pick };
}
