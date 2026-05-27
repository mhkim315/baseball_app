import { getDb } from "./connection";

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
