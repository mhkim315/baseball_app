import type { JikgwanRecord } from "@/lib/db";

export function filterByGameType(records: JikgwanRecord[], gameType?: string | null): JikgwanRecord[] {
  if (gameType === undefined) return records;
  if (gameType === "regular") return records.filter((r) => (r.game_type ?? null) === null);
  return records.filter((r) => r.game_type === gameType);
}
