import { getDb } from "./connection";

export interface Badge {
  id: string;
  badge_key: string;
  unlocked_date: string | null;
  progress_current: number;
  progress_target: number;
  is_notified: number;
}

export async function getBadges(): Promise<Badge[]> {
  const database = await getDb();
  return database.getAllAsync<Badge>("SELECT * FROM badges");
}

export async function getBadgesByDate(date: string): Promise<Badge[]> {
  const database = await getDb();
  return database.getAllAsync<Badge>(
    "SELECT * FROM badges WHERE unlocked_date = ?", date
  );
}

export async function upsertBadge(
  badge: Omit<Badge, "is_notified"> & { is_notified?: number }
): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    `INSERT OR REPLACE INTO badges (id, badge_key, unlocked_date, progress_current, progress_target, is_notified)
     VALUES (?, ?, ?, ?, ?, ?)`,
    badge.id, badge.badge_key, badge.unlocked_date ?? null,
    badge.progress_current, badge.progress_target, badge.is_notified ?? 0
  );
}

export async function checkAttendance(): Promise<number> {
  const database = await getDb();
  const today = new Date();
  const todayStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;

  await database.runAsync(
    "INSERT OR IGNORE INTO attendance (date) VALUES (?)",
    todayStr
  );

  const rows = await database.getAllAsync<{ date: string }>(
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

export async function getTotalAttendanceDays(): Promise<number> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(DISTINCT date) AS count FROM attendance"
  );
  return row?.count ?? 0;
}
