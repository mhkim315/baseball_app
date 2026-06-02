import type { JikgwanRecord } from "@/lib/db";
import { resolveIsWin } from "@/lib/expenseStats";

export function findStreakQualifyingDate(records: JikgwanRecord[], target: number): string | undefined {
  const games = records
    .filter((r) => {
      const iw = resolveIsWin(r);
      return iw != null && iw !== 0;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const seen = new Map<string, JikgwanRecord>();
  for (const g of games) seen.set(g.date, g);
  const unique = [...seen.values()].sort((a, b) => a.date.localeCompare(b.date));
  let run = 0;
  for (const g of unique) {
    if (resolveIsWin(g) === 1) {
      run++;
      if (run === target) return g.date;
    } else {
      run = 0;
    }
  }
  return undefined;
}

export function findStreakQualifyingDateLoss(records: JikgwanRecord[], target: number): string | undefined {
  const games = records
    .filter((r) => {
      const iw = resolveIsWin(r);
      return iw != null && iw !== 0;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const seen = new Map<string, JikgwanRecord>();
  for (const g of games) seen.set(g.date, g);
  const unique = [...seen.values()].sort((a, b) => a.date.localeCompare(b.date));
  let run = 0;
  for (const g of unique) {
    if (resolveIsWin(g) === -1) {
      run++;
      if (run === target) return g.date;
    } else {
      run = 0;
    }
  }
  return undefined;
}
