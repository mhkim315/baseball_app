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

export function addTotem(
  name: string,
  emoji?: string,
  description?: string,
  color?: string
): number {
  const database = getDb();
  const result = database.runSync(
    "INSERT INTO totems (name, emoji, description, color) VALUES (?, ?, ?, ?)",
    name,
    emoji || "🍀",
    description ?? null,
    color ?? null
  );
  return result.lastInsertRowId ?? 0;
}

const TOTEM_ALLOWED_COLUMNS = new Set(["name", "emoji", "description", "color"]);

export function updateTotem(
  id: number,
  fields: { name?: string; emoji?: string; description?: string | null; color?: string | null }
): void {
  const database = getDb();
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
  database.runSync(
    `UPDATE totems SET ${setClauses.join(", ")} WHERE id = ?`,
    ...values
  );
}

export function deleteTotem(id: number, keepRecords: boolean): void {
  const database = getDb();
  if (keepRecords) {
    database.runSync("UPDATE totems SET hidden = 1 WHERE id = ?", id);
  } else {
    database.runSync("DELETE FROM diary_totems WHERE totem_id = ?", id);
    database.runSync("DELETE FROM totems WHERE id = ?", id);
  }
}

export function getAllTotems(): Totem[] {
  const database = getDb();
  return database.getAllSync<Totem>(
    "SELECT * FROM totems WHERE hidden = 0 ORDER BY created_at DESC"
  );
}

export function addDiaryTotem(recordId: number, totemId: number): void {
  const database = getDb();
  database.runSync(
    "INSERT OR IGNORE INTO diary_totems (record_id, totem_id) VALUES (?, ?)",
    recordId,
    totemId
  );
}

export function removeDiaryTotem(recordId: number, totemId: number): void {
  const database = getDb();
  database.runSync(
    "DELETE FROM diary_totems WHERE record_id = ? AND totem_id = ?",
    recordId,
    totemId
  );
}

export function getDiaryTotems(recordId: number): Totem[] {
  const database = getDb();
  return database.getAllSync<Totem>(
    `SELECT t.* FROM totems t
     INNER JOIN diary_totems dt ON dt.totem_id = t.id
     WHERE dt.record_id = ?
     ORDER BY t.name`,
    recordId
  );
}

export function setDiaryTotems(recordId: number, totemIds: number[]): void {
  const database = getDb();
  database.runSync("DELETE FROM diary_totems WHERE record_id = ?", recordId);
  for (const totemId of totemIds) {
    database.runSync(
      "INSERT OR IGNORE INTO diary_totems (record_id, totem_id) VALUES (?, ?)",
      recordId,
      totemId
    );
  }
}

export function getTotemStats(
  totemId: number,
  records: JikgwanRecord[]
): TotemWithStats {
  const database = getDb();
  const [totem] = database.getAllSync<Totem>(
    "SELECT * FROM totems WHERE id = ?",
    totemId
  );
  if (!totem) throw new Error(`getTotemStats: totem ${totemId} not found`);
  const recordIds = new Set(
    database.getAllSync<{ record_id: number }>(
      "SELECT record_id FROM diary_totems WHERE totem_id = ?",
      totemId
    ).map((r) => r.record_id)
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

export function getAllTotemStats(records: JikgwanRecord[], includeHidden = false): TotemWithStats[] {
  const database = getDb();
  const totems = database.getAllSync<Totem>(
    includeHidden
      ? "SELECT * FROM totems ORDER BY created_at DESC"
      : "SELECT * FROM totems WHERE hidden = 0 ORDER BY created_at DESC"
  );
  const results: TotemWithStats[] = [];
  for (const t of totems) {
    try {
      const stats = getTotemStats(t.id, records);
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

export function deleteDiaryTotemsByRecordId(recordId: number): void {
  const database = getDb();
  database.runSync("DELETE FROM diary_totems WHERE record_id = ?", recordId);
}
