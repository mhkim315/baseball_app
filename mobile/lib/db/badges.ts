import { getDb } from "./connection";

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
  const database = getDb();
  database.runSync(
    "UPDATE badges SET reward_emotion = ? WHERE badge_key = ?",
    emotion, badgeKey
  );
}

export function getBadges(): Badge[] {
  const database = getDb();
  return database.getAllSync<Badge>("SELECT * FROM badges");
}

export function getBadgesByDate(date: string): Badge[] {
  const database = getDb();
  return database.getAllSync<Badge>(
    "SELECT * FROM badges WHERE unlocked_date = ?", date
  );
}

export function upsertBadge(
  badge: Omit<Badge, "is_notified"> & { is_notified?: number }
): void {
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
  const todayStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;

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
    const expected = `${checkDate.getFullYear()}.${String(checkDate.getMonth() + 1).padStart(2, "0")}.${String(checkDate.getDate()).padStart(2, "0")}`;
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
