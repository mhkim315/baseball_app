import * as SQLite from "expo-sqlite";

const CACHE_VERSION = 4;

let db: SQLite.SQLiteDatabase | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
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
    CREATE TABLE IF NOT EXISTS badges (
      id TEXT PRIMARY KEY,
      badge_key TEXT UNIQUE,
      unlocked_date TEXT,
      progress_current INTEGER DEFAULT 0,
      progress_target INTEGER DEFAULT 0,
      is_notified INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS totems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      emoji TEXT DEFAULT '🍀',
      description TEXT DEFAULT NULL,
      color TEXT DEFAULT NULL,
      hidden INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS diary_totems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      totem_id INTEGER NOT NULL,
      FOREIGN KEY (record_id) REFERENCES jikgwan_records(id) ON DELETE CASCADE,
      FOREIGN KEY (totem_id) REFERENCES totems(id) ON DELETE CASCADE,
      UNIQUE(record_id, totem_id)
    );
    CREATE INDEX IF NOT EXISTS idx_jikgwan_date ON jikgwan_records(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_record_id ON expenses(record_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_diary_totems_record ON diary_totems(record_id);
    CREATE INDEX IF NOT EXISTS idx_diary_totems_totem ON diary_totems(totem_id);
  `);
  await migrateJikgwanSchema(database);
  await migrateTotemSchema(database);
  // Clean up cache entries older than 30 days on app start
  await database.runAsync(
    "DELETE FROM api_cache WHERE updated_at < ?",
    Date.now() - 30 * 86400_000
  );
  // Invalidate all cache if version changed (forces re-fetch after server changes)
  const cachedVer = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM user_settings WHERE key = ?",
    "api_cache_version"
  );
  if (!cachedVer || cachedVer.value !== String(CACHE_VERSION)) {
    await database.runAsync("DELETE FROM api_cache");
    await database.runAsync(
      "INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)",
      "api_cache_version",
      String(CACHE_VERSION)
    );
  }
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
    { name: "game_type", type: "TEXT", dflt: "NULL" },
    { name: "game_status", type: "TEXT", dflt: "NULL" },
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

async function migrateTotemSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  const columns = [
    { name: "hidden", type: "INTEGER", dflt: "0" },
  ];
  const existing = await database.getAllAsync<{ name: string }>(
    "PRAGMA table_info(totems)"
  );
  const existingNames = new Set(existing.map((c) => c.name));
  for (const col of columns) {
    if (existingNames.has(col.name)) continue;
    await database.execAsync(
      `ALTER TABLE totems ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.dflt}`
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

export async function getInstallDate(): Promise<string> {
  const existing = await getSetting("install_date");
  if (existing) return existing;
  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
  await setSetting("install_date", dateStr);
  return dateStr;
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
  is_cancelled?: number;
  game_type: string | null;  // null=regular, "exhibition", "postseason"
  game_status: string | null; // "live", "finished", "scheduled", or null (legacy)
}

export async function addJikgwanRecord(record: Omit<JikgwanRecord, "id" | "created_at">): Promise<number> {
  const database = await getDb();

  const result = await database.runAsync(
    `INSERT INTO jikgwan_records
      (game_id, date, photo_path, photos, memo, score_away, score_home, emotion, frame_style, stadium, is_win, cheered_team, is_live, seat, game_type, game_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    record.game_type ?? null,
    record.game_status ?? null,
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

const JIKGWAN_ALLOWED_COLUMNS = new Set([
  "memo", "emotion", "three_line_1", "three_line_2", "three_line_3",
  "frame_style", "is_win", "photos", "cheered_team", "is_live", "seat",
  "score_away", "score_home", "stadium", "game_id", "game_type", "game_status",
]);

export async function updateJikgwanRecord(
  id: number,
  fields: Partial<Pick<JikgwanRecord, "memo" | "emotion" | "three_line_1" | "three_line_2" | "three_line_3" | "frame_style" | "is_win" | "photos" | "cheered_team" | "is_live" | "seat" | "score_away" | "score_home" | "stadium" | "game_id" | "game_type" | "game_status">>
): Promise<void> {
  const database = await getDb();
  const setClauses: string[] = [];
  const values: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (!JIKGWAN_ALLOWED_COLUMNS.has(key)) {
      console.warn(`updateJikgwanRecord: rejected unknown column "${key}"`);
      continue;
    }
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
  await database.runAsync("DELETE FROM diary_totems WHERE record_id = ?", id);
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

const EXPENSE_ALLOWED_COLUMNS = new Set(["category", "amount", "memo"]);

export async function updateExpense(
  id: number,
  fields: Partial<Pick<Expense, "category" | "amount" | "memo">>
): Promise<void> {
  const database = await getDb();
  const setClauses: string[] = [];
  const values: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (!EXPENSE_ALLOWED_COLUMNS.has(key)) {
      console.warn(`updateExpense: rejected unknown column "${key}"`);
      continue;
    }
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

// --- Badges / Attendance ---

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

// ── Character Unlock System ──

export async function getUnlockedEmotions(): Promise<string[]> {
  const raw = await getSetting("unlocked_emotions");
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  // First access: init with 3 basic characters
  const basic = ["default", "sad", "joyful"];
  await setSetting("unlocked_emotions", JSON.stringify(basic));
  return basic;
}

export async function addUnlockedEmotion(emotion: string): Promise<void> {
  const database = await getDb();
  // Serialize read-modify-write to prevent concurrent badge unlocks from overwriting each other
  await database.runAsync("BEGIN IMMEDIATE");
  try {
    const row = await database.getFirstAsync<{ value: string }>(
      "SELECT value FROM user_settings WHERE key = 'unlocked_emotions'"
    );
    let current: string[];
    if (row?.value) {
      try { current = JSON.parse(row.value); } catch { current = []; }
    } else {
      current = ["default", "sad", "joyful"];
    }
    if (!current.includes(emotion)) {
      current.push(emotion);
      await database.runAsync(
        "INSERT OR REPLACE INTO user_settings (key, value) VALUES ('unlocked_emotions', ?)",
        JSON.stringify(current)
      );
    }
    await database.runAsync("COMMIT");
  } catch (e) {
    await database.runAsync("ROLLBACK");
    throw e;
  }
}

// --- Totems ---

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

export async function updateTotem(
  id: number,
  fields: { name?: string; emoji?: string; description?: string | null; color?: string | null }
): Promise<void> {
  const database = await getDb();
  const setClauses: string[] = [];
  const values: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
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
    // Soft-delete: hide totem but keep diary_totems links → stats preserved
    await database.runAsync("UPDATE totems SET hidden = 1 WHERE id = ?", id);
  } else {
    // Hard-delete: remove diary_totems links and totem record entirely
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

  // Compute current streak
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

export async function getAllTotemStats(records: JikgwanRecord[]): Promise<TotemWithStats[]> {
  const database = await getDb();
  const totems = await database.getAllAsync<Totem>(
    "SELECT * FROM totems ORDER BY created_at DESC"
  );
  const results: TotemWithStats[] = [];
  for (const t of totems) {
    const stats = await getTotemStats(t.id, records);
    results.push(stats);
  }
  return results.sort((a, b) => b.winRate - a.winRate || b.count - a.count);
}

export async function deleteDiaryTotemsByRecordId(recordId: number): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM diary_totems WHERE record_id = ?", recordId);
}

export async function resetAllData(): Promise<void> {
  const database = await getDb();
  await database.execAsync(`
    DELETE FROM jikgwan_records;
    DELETE FROM expenses;
    DELETE FROM win_rate_cache;
    DELETE FROM api_cache;
    DELETE FROM user_settings;
    DELETE FROM badges;
    DELETE FROM attendance;
    DELETE FROM totems;
    DELETE FROM diary_totems;
  `);
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
