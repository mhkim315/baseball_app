import * as SQLite from "expo-sqlite";
import { TEAM_COLORS } from "@shared/teamColors";

let db: SQLite.SQLiteDatabase | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbPromise) return dbPromise;
  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        db = await SQLite.openDatabaseAsync("fullcount.db");
        await initSchema(db);
        return db;
      } catch (e) {
        console.error("DB init failed, resetting for retry", e);
        dbPromise = null;
        db = null;
        throw e;
      }
    })();
  }
  return dbPromise;
}

async function initSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS jikgwan_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      date TEXT NOT NULL,
      photo_path TEXT,
      memo TEXT,
      score_away INTEGER,
      score_home INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      emotion TEXT DEFAULT NULL,
      three_line_1 TEXT DEFAULT NULL,
      three_line_2 TEXT DEFAULT NULL,
      three_line_3 TEXT DEFAULT NULL,
      frame_style TEXT DEFAULT 'classic',
      stadium TEXT DEFAULT NULL,
      is_win INTEGER DEFAULT NULL
    );
    CREATE TABLE IF NOT EXISTS win_rate_cache (
      team_id TEXT PRIMARY KEY,
      total_games INTEGER,
      wins INTEGER,
      draws INTEGER,
      losses INTEGER,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS api_cache (
      key TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      amount INTEGER NOT NULL,
      memo TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES jikgwan_records(id) ON DELETE SET NULL
    );
  `);
  await migrateJikgwanSchema(database);
  // Clean up cache entries older than 30 days on app start
  await database.runAsync(
    "DELETE FROM api_cache WHERE updated_at < ?",
    Date.now() - 30 * 86400_000
  );
}

async function migrateJikgwanSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  const columns = [
    { name: "emotion", type: "TEXT", dflt: "NULL" },
    { name: "three_line_1", type: "TEXT", dflt: "NULL" },
    { name: "three_line_2", type: "TEXT", dflt: "NULL" },
    { name: "three_line_3", type: "TEXT", dflt: "NULL" },
    { name: "frame_style", type: "TEXT", dflt: "'classic'" },
    { name: "stadium", type: "TEXT", dflt: "NULL" },
    { name: "is_win", type: "INTEGER", dflt: "NULL" },
    { name: "photos", type: "TEXT", dflt: "NULL" },
    { name: "cheered_team", type: "TEXT", dflt: "NULL" },
    { name: "is_live", type: "INTEGER", dflt: "NULL" },
    { name: "seat", type: "TEXT", dflt: "NULL" },
  ];
  const existing = await database.getAllAsync<{ name: string }>(
    "PRAGMA table_info(jikgwan_records)"
  );
  const existingNames = new Set(existing.map((c) => c.name));
  for (const col of columns) {
    if (existingNames.has(col.name)) continue;
    await database.execAsync(
      `ALTER TABLE jikgwan_records ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.dflt}`
    );
  }
}

export async function getCache(key: string): Promise<{ data: string; updatedAt: number } | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ data: string; updated_at: number }>(
    "SELECT data, updated_at FROM api_cache WHERE key = ?",
    key
  );
  return row ? { data: row.data, updatedAt: row.updated_at } : null;
}

export async function setCache(key: string, data: string): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    "INSERT OR REPLACE INTO api_cache (key, data, updated_at) VALUES (?, ?, ?)",
    key,
    data,
    Date.now()
  );
}

export async function deleteCache(key: string): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM api_cache WHERE key = ?", key);
}

export async function evictOldCacheEntries(cutoffMs: number): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM api_cache WHERE updated_at < ?", cutoffMs);
}

// --- User Settings ---

export async function getSetting(key: string): Promise<string | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM user_settings WHERE key = ?",
    key
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    "INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)",
    key,
    value
  );
}

export async function getMyTeam(): Promise<string | null> {
  return getSetting("my_team");
}

export async function setMyTeam(teamId: string): Promise<void> {
  await setSetting("my_team", teamId);
}

export async function getNickname(): Promise<string | null> {
  return getSetting("nickname");
}

export async function setNickname(name: string): Promise<void> {
  await setSetting("nickname", name);
}

export async function getProfileImage(): Promise<{ type: string; value: string } | null> {
  // Try single JSON key first
  const raw = await getSetting("profile_image");
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  // Legacy fallback: separate keys
  const type = await getSetting("profile_image_type");
  const value = await getSetting("profile_image_value");
  if (type && value) return { type, value };
  return null;
}

export async function setProfileImage(type: string, value: string): Promise<void> {
  await setSetting("profile_image", JSON.stringify({ type, value }));
}

// --- Jikgwan Records ---

export interface JikgwanRecord {
  id: number;
  game_id: string;
  date: string;
  photo_path: string | null;
  photos: string | null;
  memo: string | null;
  score_away: number | null;
  score_home: number | null;
  created_at: string;
  emotion: string | null;
  three_line_1: string | null;
  three_line_2: string | null;
  three_line_3: string | null;
  frame_style: string;
  stadium: string | null;
  is_win: number | null;
  cheered_team: string | null;
  is_live: number | null;
  seat: string | null;
}

export async function addJikgwanRecord(record: Omit<JikgwanRecord, "id" | "created_at">): Promise<number> {
  const database = await getDb();

  const result = await database.runAsync(
    `INSERT INTO jikgwan_records
      (game_id, date, photo_path, photos, memo, score_away, score_home, emotion, frame_style, stadium, is_win, cheered_team, is_live, seat)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    record.game_id || "",
    record.date || "",
    record.photo_path ?? null,
    record.photos ?? null,
    record.memo ?? null,
    record.score_away ?? null,
    record.score_home ?? null,
    record.emotion ?? null,
    record.frame_style || "classic",
    record.stadium ?? null,
    record.is_win ?? null,
    record.cheered_team ?? null,
    record.is_live ?? null,
    record.seat ?? null,
  );
  return result.lastInsertRowId ?? 0;
}

export async function getJikgwanRecords(): Promise<JikgwanRecord[]> {
  const database = await getDb();
  return database.getAllAsync<JikgwanRecord>(
    "SELECT * FROM jikgwan_records ORDER BY date DESC, id DESC"
  );
}

export async function getJikgwanRecordsByMonth(year: number, month: number): Promise<JikgwanRecord[]> {
  const database = await getDb();
  const prefix = `${year}.${String(month).padStart(2, "0")}`;
  return database.getAllAsync<JikgwanRecord>(
    "SELECT * FROM jikgwan_records WHERE date LIKE ? ORDER BY date DESC, id DESC",
    `${prefix}%`
  );
}

export async function updateJikgwanRecord(
  id: number,
  fields: Partial<Pick<JikgwanRecord, "memo" | "emotion" | "three_line_1" | "three_line_2" | "three_line_3" | "frame_style" | "is_win" | "photos" | "cheered_team" | "is_live" | "seat" | "score_away" | "score_home" | "stadium" | "game_id">>
): Promise<void> {
  const database = await getDb();
  const setClauses: string[] = [];
  const values: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    setClauses.push(`${key} = ?`);
    values.push(value ?? null);
  }
  if (setClauses.length === 0) return;
  values.push(id);
  await database.runAsync(
    `UPDATE jikgwan_records SET ${setClauses.join(", ")} WHERE id = ?`,
    ...values
  );
}

export async function deleteJikgwanRecord(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM jikgwan_records WHERE id = ?", id);
}

// --- Expenses ---

export interface Expense {
  id: number;
  record_id: number | null;
  date: string;
  category: string;
  amount: number;
  memo: string | null;
  created_at: string;
}

export const EXPENSE_CATEGORIES = {
  goods: { label: "굿즈", icon: "🧢" },
  uniform: { label: "유니폼", icon: "👕" },
  food: { label: "식비", icon: "🍔" },
  ticket: { label: "티켓", icon: "🎫" },
  transport: { label: "교통비", icon: "🚗" },
  other: { label: "기타", icon: "💸" },
} as const;

export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

export async function addExpense(expense: Omit<Expense, "id" | "created_at">): Promise<number> {
  const database = await getDb();
  const result = await database.runAsync(
    "INSERT INTO expenses (record_id, date, category, amount, memo) VALUES (?, ?, ?, ?, ?)",
    expense.record_id ?? null,
    expense.date,
    expense.category,
    expense.amount,
    expense.memo ?? null,
  );
  return result.lastInsertRowId ?? 0;
}

export async function getExpensesByRecordId(recordId: number): Promise<Expense[]> {
  const database = await getDb();
  return database.getAllAsync<Expense>(
    "SELECT * FROM expenses WHERE record_id = ? ORDER BY amount DESC",
    recordId
  );
}

export async function getExpensesByDate(date: string): Promise<Expense[]> {
  const database = await getDb();
  return database.getAllAsync<Expense>(
    "SELECT * FROM expenses WHERE date = ? ORDER BY amount DESC",
    date
  );
}

export async function getExpensesByMonth(year: number, month: number): Promise<Expense[]> {
  const database = await getDb();
  const prefix = `${year}.${String(month).padStart(2, "0")}`;
  return database.getAllAsync<Expense>(
    "SELECT * FROM expenses WHERE date LIKE ? ORDER BY date DESC, amount DESC",
    `${prefix}%`
  );
}

export async function getAllExpenses(): Promise<Expense[]> {
  const database = await getDb();
  return database.getAllAsync<Expense>(
    "SELECT * FROM expenses ORDER BY date DESC, amount DESC"
  );
}

export async function getExpensesByRecordIds(recordIds: number[]): Promise<Expense[]> {
  if (recordIds.length === 0) return [];
  const database = await getDb();
  const placeholders = recordIds.map(() => "?").join(",");
  return database.getAllAsync<Expense>(
    `SELECT * FROM expenses WHERE record_id IN (${placeholders}) ORDER BY amount DESC`,
    ...recordIds
  );
}

export async function updateExpense(
  id: number,
  fields: Partial<Pick<Expense, "category" | "amount" | "memo">>
): Promise<void> {
  const database = await getDb();
  const setClauses: string[] = [];
  const values: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    setClauses.push(`${key} = ?`);
    values.push(value ?? null);
  }
  if (setClauses.length === 0) return;
  values.push(id);
  await database.runAsync(
    `UPDATE expenses SET ${setClauses.join(", ")} WHERE id = ?`,
    ...values
  );
}

export async function deleteExpense(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM expenses WHERE id = ?", id);
}

export async function deleteExpensesByRecordId(recordId: number): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM expenses WHERE record_id = ?", recordId);
}

// --- Win Rate ---

export async function updateWinRate(
  teamId: string,
  result: "win" | "draw" | "loss"
): Promise<void> {
  const database = await getDb();
  const existing = await database.getFirstAsync<{
    total_games: number;
    wins: number;
    draws: number;
    losses: number;
  }>("SELECT * FROM win_rate_cache WHERE team_id = ?", teamId);

  const total = (existing?.total_games ?? 0) + 1;
  const wins = (existing?.wins ?? 0) + (result === "win" ? 1 : 0);
  const draws = (existing?.draws ?? 0) + (result === "draw" ? 1 : 0);
  const losses = (existing?.losses ?? 0) + (result === "loss" ? 1 : 0);

  await database.runAsync(
    `INSERT OR REPLACE INTO win_rate_cache (team_id, total_games, wins, draws, losses, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    teamId,
    total,
    wins,
    draws,
    losses
  );
}

export async function getWinRate(teamId: string): Promise<{
  total: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
} | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<{
    total_games: number;
    wins: number;
    draws: number;
    losses: number;
  }>("SELECT * FROM win_rate_cache WHERE team_id = ?", teamId);

  if (!row) return null;

  return {
    total: row.total_games,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    winRate: row.total_games > 0 ? row.wins / row.total_games : 0,
  };
}

export async function getWinRates(): Promise<
  Array<{
    teamId: string;
    total: number;
    wins: number;
    draws: number;
    losses: number;
    winRate: number;
  }>
> {
  const database = await getDb();
  const rows = await database.getAllAsync<{
    team_id: string;
    total_games: number;
    wins: number;
    draws: number;
    losses: number;
  }>("SELECT * FROM win_rate_cache ORDER BY total_games DESC");

  return rows.map((r) => ({
    teamId: r.team_id,
    total: r.total_games,
    wins: r.wins,
    draws: r.draws,
    losses: r.losses,
    winRate: r.total_games > 0 ? r.wins / r.total_games : 0,
  }));
}

export async function getTeamDiaryStats(teamId: string): Promise<{
  overall: { total: number; wins: number; draws: number; losses: number; winRate: number };
  live: { total: number; wins: number; draws: number; losses: number; winRate: number } | null;
}> {
  const database = await getDb();
  const rows = await database.getAllAsync<{ is_win: number; is_live: number | null }>(
    "SELECT is_win, is_live FROM jikgwan_records WHERE cheered_team = ? AND is_win IS NOT NULL",
    teamId
  );

  const overall = { wins: 0, draws: 0, losses: 0, total: 0, winRate: 0 };
  const live = { wins: 0, draws: 0, losses: 0, total: 0, winRate: 0 };

  for (const r of rows) {
    if (r.is_win === 1) overall.wins++;
    else if (r.is_win === 0) overall.draws++;
    else if (r.is_win === -1) overall.losses++;
    overall.total++;

    if (r.is_live === 1) {
      if (r.is_win === 1) live.wins++;
      else if (r.is_win === 0) live.draws++;
      else if (r.is_win === -1) live.losses++;
      live.total++;
    }
  }

  overall.winRate = overall.total > 0 ? overall.wins / overall.total : 0;
  live.winRate = live.total > 0 ? live.wins / live.total : 0;

  return {
    overall,
    live: live.total > 0 ? live : null,
  };
}
