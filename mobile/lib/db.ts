import * as SQLite from "expo-sqlite";
import { TEAM_COLORS } from "@shared/teamColors";

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync("fullcount.db");
    await initSchema(db);
  }
  return db;
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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS win_rate_cache (
      team_id TEXT PRIMARY KEY,
      total_games INTEGER,
      wins INTEGER,
      draws INTEGER,
      losses INTEGER,
      updated_at TEXT
    );
  `);
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
  const type = await getSetting("profile_image_type");
  const value = await getSetting("profile_image_value");
  if (!type || !value) return null;
  return { type, value };
}

export async function setProfileImage(type: string, value: string): Promise<void> {
  await setSetting("profile_image_type", type);
  await setSetting("profile_image_value", value);
}

// --- Jikgwan Records ---

export interface JikgwanRecord {
  id: number;
  game_id: string;
  date: string;
  photo_path: string | null;
  memo: string | null;
  score_away: number | null;
  score_home: number | null;
  created_at: string;
}

export async function addJikgwanRecord(record: Omit<JikgwanRecord, "id" | "created_at">): Promise<number> {
  const database = await getDb();
  const result = await database.runAsync(
    "INSERT INTO jikgwan_records (game_id, date, photo_path, memo, score_away, score_home) VALUES (?, ?, ?, ?, ?, ?)",
    record.game_id,
    record.date,
    record.photo_path,
    record.memo,
    record.score_away,
    record.score_home
  );
  return result.lastInsertRowId;
}

export async function getJikgwanRecords(): Promise<JikgwanRecord[]> {
  const database = await getDb();
  return database.getAllAsync<JikgwanRecord>(
    "SELECT * FROM jikgwan_records ORDER BY date DESC, id DESC"
  );
}

export async function deleteJikgwanRecord(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM jikgwan_records WHERE id = ?", id);
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
