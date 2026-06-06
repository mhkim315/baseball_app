import * as SQLite from "expo-sqlite";

const CACHE_VERSION = 4;

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync("fullcount.db");
    initSchema();
  }
  return db;
}

function initSchema(): void {
  const database = getDb();
  database.execSync(`
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
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT NULL,
      photos TEXT DEFAULT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_diary_totems_record ON diary_totems(record_id);
    CREATE INDEX IF NOT EXISTS idx_diary_totems_totem ON diary_totems(totem_id);
  `);
  migrateJikgwanSchema();
  migrateTotemSchema();
  migrateBadgesSchema();
  migrateCollectionSchema();
  // Clean up cache entries older than 30 days on app start
  database.runSync(
    "DELETE FROM api_cache WHERE updated_at < ?",
    Date.now() - 30 * 86400_000
  );
  // Invalidate all cache if version changed (forces re-fetch after server changes)
  const cachedVer = database.getFirstSync<{ value: string }>(
    "SELECT value FROM user_settings WHERE key = ?",
    "api_cache_version"
  );
  if (!cachedVer || cachedVer.value !== String(CACHE_VERSION)) {
    database.runSync("DELETE FROM api_cache");
    database.runSync(
      "INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)",
      "api_cache_version",
      String(CACHE_VERSION)
    );
  }
}

function migrateJikgwanSchema(): void {
  const database = getDb();
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
  const existing = database.getAllSync<{ name: string }>(
    "PRAGMA table_info(jikgwan_records)"
  );
  const existingNames = new Set(existing.map((c) => c.name));
  for (const col of columns) {
    if (existingNames.has(col.name)) continue;
    database.execSync(
      `ALTER TABLE jikgwan_records ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.dflt}`
    );
  }
}

function migrateTotemSchema(): void {
  const database = getDb();
  const columns = [
    { name: "hidden", type: "INTEGER", dflt: "0" },
  ];
  const existing = database.getAllSync<{ name: string }>(
    "PRAGMA table_info(totems)"
  );
  const existingNames = new Set(existing.map((c) => c.name));
  for (const col of columns) {
    if (existingNames.has(col.name)) continue;
    database.execSync(
      `ALTER TABLE totems ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.dflt}`
    );
  }
}

function migrateBadgesSchema(): void {
  const database = getDb();
  const columns = [
    { name: "reward_emotion", type: "TEXT", dflt: "NULL" },
  ];
  const existing = database.getAllSync<{ name: string }>(
    "PRAGMA table_info(badges)"
  );
  const existingNames = new Set(existing.map((c) => c.name));
  for (const col of columns) {
    if (existingNames.has(col.name)) continue;
    database.execSync(
      `ALTER TABLE badges ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.dflt}`
    );
  }
}

function migrateCollectionSchema(): void {
  const database = getDb();
  const columns = [
    { name: "photos", type: "TEXT", dflt: "NULL" },
  ];
  const existing = database.getAllSync<{ name: string }>(
    "PRAGMA table_info(collections)"
  );
  const existingNames = new Set(existing.map((c) => c.name));
  for (const col of columns) {
    if (existingNames.has(col.name)) continue;
    database.execSync(
      `ALTER TABLE collections ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.dflt}`
    );
  }
}

export function resetAllData(): void {
  const database = getDb();
  database.execSync(`
    DELETE FROM jikgwan_records;
    DELETE FROM expenses;
    DELETE FROM win_rate_cache;
    DELETE FROM api_cache;
    DELETE FROM user_settings;
    DELETE FROM badges;
    DELETE FROM attendance;
    DELETE FROM totems;
    DELETE FROM diary_totems;
    DELETE FROM collections;
  `);
  // Invalidate in-memory caches (dynamic require to avoid circular deps)
  require("./records").invalidateRecordsCache();
  require("./expenses").invalidateExpensesCache();
  require("./badges").invalidateBadgesCache();
}
