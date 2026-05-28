import { getDb } from "./connection";
import type { JikgwanRecord } from "./records";

export interface Totem {
  id: number;
  name: string;
  emoji: string;
  description: string | null;
  color: string | null;
  created_at: string;
}

export interface TotemWithStats extends Totem {
  count: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  currentStreak: number;
}

export async function addTotem(
  name: string,
  emoji?: string,
  description?: string,
  color?: string
): Promise<number> {
  const database = await getDb();
  const result = await database.runAsync(
    "INSERT INTO totems (name, emoji, description, color) VALUES (?, ?, ?, ?)",
    name,
    emoji || "🍀",
    description ?? null,
    color ?? null
  );
  return result.lastInsertRowId ?? 0;
}

const TOTEM_ALLOWED_COLUMNS = new Set(["name", "emoji", "description", "color"]);

export async function updateTotem(
  id: number,
  fields: { name?: string; emoji?: string; description?: string | null; color?: string | null }
): Promise<void> {
  const database = await getDb();
  const setClauses: string[] = [];
  const values: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (!TOTEM_ALLOWED_COLUMNS.has(key)) {
      console.warn(`updateTotem: rejected unknown column "${key}"`);
      continue;
    }
    setClauses.push(`${key} = ?`);
    values.push(value ?? null);
  }
  if (setClauses.length === 0) return;
  values.push(id);
  await database.runAsync(
    `UPDATE totems SET ${setClauses.join(", ")} WHERE id = ?`,
    ...values
  );
}

export async function deleteTotem(id: number, keepRecords: boolean): Promise<void> {
  const database = await getDb();
  if (keepRecords) {
    await database.runAsync("UPDATE totems SET hidden = 1 WHERE id = ?", id);
  } else {
    await database.runAsync("DELETE FROM diary_totems WHERE totem_id = ?", id);
    await database.runAsync("DELETE FROM totems WHERE id = ?", id);
  }
}

export async function getAllTotems(): Promise<Totem[]> {
  const database = await getDb();
  return database.getAllAsync<Totem>(
    "SELECT * FROM totems WHERE hidden = 0 ORDER BY created_at DESC"
  );
}

export async function addDiaryTotem(recordId: number, totemId: number): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    "INSERT OR IGNORE INTO diary_totems (record_id, totem_id) VALUES (?, ?)",
    recordId,
    totemId
  );
}

export async function removeDiaryTotem(recordId: number, totemId: number): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    "DELETE FROM diary_totems WHERE record_id = ? AND totem_id = ?",
    recordId,
    totemId
  );
}

export async function getDiaryTotems(recordId: number): Promise<Totem[]> {
  const database = await getDb();
  return database.getAllAsync<Totem>(
    `SELECT t.* FROM totems t
     INNER JOIN diary_totems dt ON dt.totem_id = t.id
     WHERE dt.record_id = ?
     ORDER BY t.name`,
    recordId
  );
}

export async function setDiaryTotems(recordId: number, totemIds: number[]): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM diary_totems WHERE record_id = ?", recordId);
  for (const totemId of totemIds) {
    await database.runAsync(
      "INSERT OR IGNORE INTO diary_totems (record_id, totem_id) VALUES (?, ?)",
      recordId,
      totemId
    );
  }
}

export async function getTotemStats(
  totemId: number,
  records: JikgwanRecord[]
): Promise<TotemWithStats> {
  const database = await getDb();
  const [totem] = await database.getAllAsync<Totem>(
    "SELECT * FROM totems WHERE id = ?",
    totemId
  );
  if (!totem) throw new Error(`getTotemStats: totem ${totemId} not found`);
  const recordIds = new Set(
    (await database.getAllAsync<{ record_id: number }>(
      "SELECT record_id FROM diary_totems WHERE totem_id = ?",
      totemId
    )).map((r) => r.record_id)
  );

  let count = 0, wins = 0, draws = 0, losses = 0;
  const datedResults: { date: string; isWin: number | null }[] = [];

  for (const r of records) {
    if (!recordIds.has(r.id)) continue;
    count++;
    const iw = r.is_win;
    if (iw === 1) wins++;
    else if (iw === 0) losses++;
    else draws++;
    datedResults.push({ date: r.date, isWin: iw });
  }

  datedResults.sort((a, b) => a.date.localeCompare(b.date));
  let currentStreak = 0;
  for (let i = datedResults.length - 1; i >= 0; i--) {
    const res = datedResults[i];
    if (res.isWin === 1) {
      if (currentStreak >= 0) currentStreak++;
      else break;
    } else if (res.isWin === 0) {
      if (currentStreak <= 0) currentStreak--;
      else break;
    } else break;
  }

  return {
    id: totem.id,
    name: totem.name,
    emoji: totem.emoji,
    description: totem.description,
    color: totem.color,
    created_at: totem.created_at,
    count,
    wins,
    draws,
    losses,
    winRate: count > 0 ? wins / count : 0,
    currentStreak,
  };
}

export async function getAllTotemStats(records: JikgwanRecord[], includeHidden = false): Promise<TotemWithStats[]> {
  const database = await getDb();
  const totems = await database.getAllAsync<Totem>(
    includeHidden
      ? "SELECT * FROM totems ORDER BY created_at DESC"
      : "SELECT * FROM totems WHERE hidden = 0 ORDER BY created_at DESC"
  );
  const results: TotemWithStats[] = [];
  for (const t of totems) {
    try {
      const stats = await getTotemStats(t.id, records);
      results.push(stats);
    } catch (e) {
      console.warn(`getTotemStats failed for totem ${t.id}`, e);
      results.push({
        ...t,
        count: 0, wins: 0, draws: 0, losses: 0,
        winRate: 0, currentStreak: 0,
      });
    }
  }
  return results.sort((a, b) => b.winRate - a.winRate || b.count - a.count);
}

export async function deleteDiaryTotemsByRecordId(recordId: number): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM diary_totems WHERE record_id = ?", recordId);
}
