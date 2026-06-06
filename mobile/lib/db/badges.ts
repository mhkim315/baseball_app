import { getDb } from "./connection";
import { formatDate } from "../dateUtils";

// ── 메모리 캐시 ──
let badgesCache: Badge[] | null = null;

export function invalidateBadgesCache(): void {
  badgesCache = null;
}

export interface Badge {
  id: string;
  badge_key: string;
  unlocked_date: string | null;
  progress_current: number;
  progress_target: number;
  is_notified: number;
  reward_emotion?: string | null;
}

export function setBadgeRewardEmotion(badgeKey: string, emotion: string): void {
  invalidateBadgesCache();
  const database = getDb();
  database.runSync(
    "UPDATE badges SET reward_emotion = ? WHERE badge_key = ?",
    emotion, badgeKey
  );
}

export function getBadges(): Badge[] {
  if (badgesCache !== null) return badgesCache;
  const database = getDb();
  badgesCache = database.getAllSync<Badge>("SELECT * FROM badges");
  return badgesCache;
}

export function getBadgesByDate(date: string): Badge[] {
  if (badgesCache !== null) {
    return badgesCache.filter((b) => b.unlocked_date === date);
  }
  const database = getDb();
  return database.getAllSync<Badge>(
    "SELECT * FROM badges WHERE unlocked_date = ?", date
  );
}

export function upsertBadge(
  badge: Omit<Badge, "is_notified"> & { is_notified?: number }
): void {
  invalidateBadgesCache();
  const database = getDb();
  database.runSync(
    `INSERT OR REPLACE INTO badges (id, badge_key, unlocked_date, progress_current, progress_target, is_notified)
     VALUES (?, ?, ?, ?, ?, ?)`,
    badge.id, badge.badge_key, badge.unlocked_date ?? null,
    badge.progress_current, badge.progress_target, badge.is_notified ?? 0
  );
}

export function checkAttendance(): number {
  const database = getDb();
  const today = new Date();
  const todayStr = formatDate(today);

  database.runSync(
    "INSERT OR IGNORE INTO attendance (date) VALUES (?)",
    todayStr
  );

  const rows = database.getAllSync<{ date: string }>(
    "SELECT date FROM attendance ORDER BY date DESC"
  );

  let streak = 0;
  const checkDate = new Date(today);
  for (const row of rows) {
    const expected = formatDate(checkDate);
    if (row.date === expected) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function getTotalAttendanceDays(): number {
  const database = getDb();
  const row = database.getFirstSync<{ count: number }>(
    "SELECT COUNT(DISTINCT date) AS count FROM attendance"
  );
  return row?.count ?? 0;
}
