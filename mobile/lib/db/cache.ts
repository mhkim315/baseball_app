import { getDb } from "./connection";

export function getCache(key: string): { data: string; updatedAt: number } | null {
  const database = getDb();
  const row = database.getFirstSync<{ data: string; updated_at: number }>(
    "SELECT data, updated_at FROM api_cache WHERE key = ?",
    key
  );
  return row ? { data: row.data, updatedAt: row.updated_at } : null;
}

export function setCache(key: string, data: string): void {
  const database = getDb();
  database.runSync(
    "INSERT OR REPLACE INTO api_cache (key, data, updated_at) VALUES (?, ?, ?)",
    key,
    data,
    Date.now()
  );
}

export function deleteCache(key: string): void {
  const database = getDb();
  database.runSync("DELETE FROM api_cache WHERE key = ?", key);
}

export function evictOldCacheEntries(cutoffMs: number): void {
  const database = getDb();
  database.runSync("DELETE FROM api_cache WHERE updated_at < ?", cutoffMs);
}
