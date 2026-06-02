import { type Expense, type ExpenseCategory, EXPENSE_CATEGORIES, type JikgwanRecord } from "@/lib/db";
import { parseGameTeamIds } from "@shared/constants";
import { filterByGameType } from "@/lib/gameTypeFilter";

export interface CategoryTotal {
  category: ExpenseCategory;
  label: string;
  icon: string;
  amount: number;
}

export interface MonthlyTotal {
  year: number;
  month: number;
  amount: number;
  categories: CategoryTotal[];
}

export interface ExpenseStats {
  seasonTotal: number;
  categoryTotals: CategoryTotal[];
  monthlyTotals: MonthlyTotal[];
}

export function computeExpenseStats(expenses: Expense[], seasonYear = 2026): ExpenseStats {
  const seasonExpenses = expenses.filter((e) => {
    const parts = e.date.split(".");
    if (parts.length !== 3) return false;
    return parseInt(parts[0]) === seasonYear;
  });

  // Category totals
  const catMap = new Map<ExpenseCategory, number>();
  for (const e of seasonExpenses) {
    const cat = e.category as ExpenseCategory;
    catMap.set(cat, (catMap.get(cat) || 0) + e.amount);
  }
  const categoryTotals: CategoryTotal[] = Array.from(catMap.entries())
    .map(([cat, amount]) => {
      const info = EXPENSE_CATEGORIES[cat] || EXPENSE_CATEGORIES.other;
      return { category: cat, label: info.label, icon: info.icon, amount };
    })
    .sort((a, b) => b.amount - a.amount);

  const seasonTotal = categoryTotals.reduce((sum, c) => sum + c.amount, 0);

  // Monthly breakdown
  const monthMap = new Map<string, { amount: number; catMap: Map<ExpenseCategory, number> }>();
  for (const e of seasonExpenses) {
    const parts = e.date.split(".");
    if (parts.length !== 3) continue;
    const key = `${parts[0]}-${parts[1]}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, { amount: 0, catMap: new Map() });
    }
    const m = monthMap.get(key)!;
    m.amount += e.amount;
    const cat = e.category as ExpenseCategory;
    m.catMap.set(cat, (m.catMap.get(cat) || 0) + e.amount);
  }

  const monthlyTotals: MonthlyTotal[] = Array.from(monthMap.entries())
    .map(([key, data]) => {
      const [y, m] = key.split("-").map(Number);
      const categories: CategoryTotal[] = Array.from(data.catMap.entries())
        .map(([cat, amount]) => {
          const info = EXPENSE_CATEGORIES[cat] || EXPENSE_CATEGORIES.other;
          return { category: cat, label: info.label, icon: info.icon, amount };
        })
        .sort((a, b) => b.amount - a.amount);
      return { year: y, month: m, amount: data.amount, categories };
    })
    .sort((a, b) => a.year - b.year || a.month - b.month);

  return { seasonTotal, categoryTotals, monthlyTotals };
}

/** Get daily totals for a specific month (for calendar display).
 *  @param month 0-indexed (0=January, 11=December) — matches JS Date convention. */
export function getDailyTotals(expenses: Expense[], year: number, month: number): Map<number, number> {
  const totals = new Map<number, number>();
  for (const e of expenses) {
    const parts = e.date.split(".");
    if (parts.length < 3) continue;
    if (parseInt(parts[0]) !== year || parseInt(parts[1]) !== month + 1) continue;
    const day = parseInt(parts[2]);
    if (isNaN(day)) continue;
    totals.set(day, (totals.get(day) || 0) + e.amount);
  }
  return totals;
}

/** Get category icons for a set of expenses, sorted by amount descending */
export function getCategoryIcons(expenses: Expense[]): { icon: string; amount: number }[] {
  const catMap = new Map<ExpenseCategory, number>();
  for (const e of expenses) {
    const cat = e.category as ExpenseCategory;
    catMap.set(cat, (catMap.get(cat) || 0) + e.amount);
  }
  return Array.from(catMap.entries())
    .map(([cat, amount]) => ({ icon: (EXPENSE_CATEGORIES[cat] || EXPENSE_CATEGORIES.other).icon, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function formatAmount(amount: number): string {
  return `${amount.toLocaleString()}`;
}

// ── Game-linked expense stats ──

export interface HomeAwayExpenseStat {
  home: { total: number; gameCount: number; avgPerGame: number };
  away: { total: number; gameCount: number; avgPerGame: number };
}

export function computeHomeAwayExpenses(expenses: Expense[], records: JikgwanRecord[], gameType?: string | null): HomeAwayExpenseStat | null {
  const filteredRecords = filterByGameType(records, gameType);
  const recMap = new Map<number, JikgwanRecord>();
  for (const r of filteredRecords) recMap.set(r.id, r);
  const homeTotal = { total: 0, games: new Set<number>() };
  const awayTotal = { total: 0, games: new Set<number>() };
  for (const e of expenses) {
    const rec = e.record_id != null ? recMap.get(e.record_id) : findRecordByDate(e.date, filteredRecords);
    if (!rec?.game_id || !rec.cheered_team) continue;
    const rid = e.record_id ?? rec.id;
    const { homeId } = parseGameTeamIds(rec.game_id);
    if (!homeId) continue;
    if (homeId === rec.cheered_team) {
      homeTotal.total += e.amount; homeTotal.games.add(rid);
    } else {
      awayTotal.total += e.amount; awayTotal.games.add(rid);
    }
  }
  if (homeTotal.games.size === 0 && awayTotal.games.size === 0) return null;
  return {
    home: { total: homeTotal.total, gameCount: homeTotal.games.size, avgPerGame: homeTotal.games.size > 0 ? homeTotal.total / homeTotal.games.size : 0 },
    away: { total: awayTotal.total, gameCount: awayTotal.games.size, avgPerGame: awayTotal.games.size > 0 ? awayTotal.total / awayTotal.games.size : 0 },
  };
}

export interface WinLossExpenseStat {
  win: { total: number; gameCount: number; avgPerGame: number };
  loss: { total: number; gameCount: number; avgPerGame: number };
  draw: { total: number; gameCount: number; avgPerGame: number };
}

export function computeWinLossExpenses(expenses: Expense[], records: JikgwanRecord[], gameType?: string | null): WinLossExpenseStat | null {
  const filteredRecords = filterByGameType(records, gameType);
  const recMap = new Map<number, JikgwanRecord>();
  for (const r of filteredRecords) recMap.set(r.id, r);
  const w = { total: 0, games: new Set<number>() };
  const l = { total: 0, games: new Set<number>() };
  const d = { total: 0, games: new Set<number>() };
  for (const e of expenses) {
    const rec = e.record_id != null ? recMap.get(e.record_id) : findRecordByDate(e.date, filteredRecords);
    if (!rec) continue;
    const rid = e.record_id ?? rec.id;
    const iw = resolveIsWin(rec);
    if (iw === 1) { w.total += e.amount; w.games.add(rid); }
    else if (iw === -1) { l.total += e.amount; l.games.add(rid); }
    else if (iw === 0) { d.total += e.amount; d.games.add(rid); }
  }
  if (w.games.size === 0 && l.games.size === 0 && d.games.size === 0) return null;
  return {
    win: { total: w.total, gameCount: w.games.size, avgPerGame: w.games.size > 0 ? w.total / w.games.size : 0 },
    loss: { total: l.total, gameCount: l.games.size, avgPerGame: l.games.size > 0 ? l.total / l.games.size : 0 },
    draw: { total: d.total, gameCount: d.games.size, avgPerGame: d.games.size > 0 ? d.total / d.games.size : 0 },
  };
}

export interface StadiumExpenseStat {
  stadium: string;
  total: number;
  gameCount: number;
  avgPerGame: number;
}

export function computeStadiumExpenses(expenses: Expense[], records: JikgwanRecord[], gameType?: string | null): StadiumExpenseStat[] | null {
  const filteredRecords = filterByGameType(records, gameType);
  const recMap = new Map<number, JikgwanRecord>();
  for (const r of filteredRecords) recMap.set(r.id, r);
  const m = new Map<string, { total: number; games: Set<number> }>();
  for (const e of expenses) {
    const rec = e.record_id != null ? recMap.get(e.record_id) : findRecordByDate(e.date, filteredRecords);
    if (!rec?.stadium) continue;
    const rid = e.record_id ?? rec.id;
    if (!m.has(rec.stadium)) m.set(rec.stadium, { total: 0, games: new Set() });
    const s = m.get(rec.stadium)!;
    s.total += e.amount; s.games.add(rid);
  }
  if (m.size === 0) return null;
  return Array.from(m.entries()).map(([stadium, v]) => ({
    stadium, total: v.total, gameCount: v.games.size,
    avgPerGame: v.games.size > 0 ? v.total / v.games.size : 0,
  })).sort((a, b) => b.total - a.total);
}

export interface ResultCategoryData {
  win: Map<string, number>;
  loss: Map<string, number>;
}

/** Fallback: find a jikgwan record by date. Only returns a match when exactly one
 *  record exists for the given date (ambiguous for doubleheaders → skip). */
function findRecordByDate(date: string, records: JikgwanRecord[]): JikgwanRecord | null {
  const found: JikgwanRecord[] = [];
  for (const r of records) {
    if (r.date === date) found.push(r);
  }
  return found.length === 1 ? found[0] : null;
}

/** Derive isWin from record scores when stored is_win is null/unset.
 *  Only returns a result when both scores are present and not both zero. */
export function resolveIsWin(rec: JikgwanRecord): number | null {
  if (rec.game_status === "live") return null;  // Skip records saved during live game (non-final scores)
  if (rec.is_win != null) return rec.is_win;
  if (rec.score_away == null || rec.score_home == null) return null;
  if (rec.score_away === 0 && rec.score_home === 0) return null;
  if (!rec.cheered_team) return null;
  const { awayId, homeId } = parseGameTeamIds(rec.game_id);
  if (!awayId || !homeId) return null;
  if (rec.cheered_team === homeId) return rec.score_home > rec.score_away ? 1 : rec.score_home < rec.score_away ? -1 : 0;
  if (rec.cheered_team === awayId) return rec.score_away > rec.score_home ? 1 : rec.score_away < rec.score_home ? -1 : 0;
  return null;
}

export function computeResultCategoryExpenses(expenses: Expense[], records: JikgwanRecord[], gameType?: string | null): ResultCategoryData | null {
  const filteredRecords = filterByGameType(records, gameType);
  const recMap = new Map<number, JikgwanRecord>();
  for (const r of filteredRecords) recMap.set(r.id, r);
  const winMap = new Map<string, number>();
  const lossMap = new Map<string, number>();
  for (const e of expenses) {
    const rec = e.record_id != null ? recMap.get(e.record_id) : findRecordByDate(e.date, filteredRecords);
    if (!rec) continue;
    const iw = resolveIsWin(rec);
    if (iw === 1) winMap.set(e.category, (winMap.get(e.category) || 0) + e.amount);
    else if (iw === -1) lossMap.set(e.category, (lossMap.get(e.category) || 0) + e.amount);
  }
  if (winMap.size === 0 && lossMap.size === 0) return null;
  return { win: winMap, loss: lossMap };
}
