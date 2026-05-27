import { getDb } from "./connection";

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
  game_type: string | null;
  game_status: string | null;
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
