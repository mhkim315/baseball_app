import { type Expense, type ExpenseCategory, EXPENSE_CATEGORIES, type JikgwanRecord } from "@/lib/db";
import { parseGameTeamIds } from "@shared/constants";

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

/** Get daily totals for a month (for calendar display) */
export function getDailyTotals(expenses: Expense[]): Map<number, number> {
  const totals = new Map<number, number>();
  for (const e of expenses) {
    const parts = e.date.split(".");
    if (parts.length < 3) continue;
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

export function computeHomeAwayExpenses(expenses: Expense[], records: JikgwanRecord[]): HomeAwayExpenseStat | null {
  const recMap = new Map<number, JikgwanRecord>();
  for (const r of records) recMap.set(r.id, r);
  const homeTotal = { total: 0, games: new Set<number>() };
  const awayTotal = { total: 0, games: new Set<number>() };
  for (const e of expenses) {
    if (e.record_id == null) continue;
    const rec = recMap.get(e.record_id);
    if (!rec?.game_id || !rec.cheered_team) continue;
    const { homeId } = parseGameTeamIds(rec.game_id);
    if (homeId === rec.cheered_team) {
      homeTotal.total += e.amount; homeTotal.games.add(e.record_id);
    } else {
      awayTotal.total += e.amount; awayTotal.games.add(e.record_id);
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

export function computeWinLossExpenses(expenses: Expense[], records: JikgwanRecord[]): WinLossExpenseStat | null {
  const recMap = new Map<number, JikgwanRecord>();
  for (const r of records) recMap.set(r.id, r);
  const w = { total: 0, games: new Set<number>() };
  const l = { total: 0, games: new Set<number>() };
  const d = { total: 0, games: new Set<number>() };
  for (const e of expenses) {
    if (e.record_id == null) continue;
    const rec = recMap.get(e.record_id);
    if (!rec || rec.is_win == null) continue;
    if (rec.is_win === 1) { w.total += e.amount; w.games.add(e.record_id); }
    else if (rec.is_win === -1) { l.total += e.amount; l.games.add(e.record_id); }
    else { d.total += e.amount; d.games.add(e.record_id); }
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

export function computeStadiumExpenses(expenses: Expense[], records: JikgwanRecord[]): StadiumExpenseStat[] | null {
  const recMap = new Map<number, JikgwanRecord>();
  for (const r of records) recMap.set(r.id, r);
  const m = new Map<string, { total: number; games: Set<number> }>();
  for (const e of expenses) {
    if (e.record_id == null) continue;
    const rec = recMap.get(e.record_id);
    if (!rec?.stadium) continue;
    const s = m.get(rec.stadium) || { total: 0, games: new Set() };
    s.total += e.amount; s.games.add(e.record_id);
    m.set(rec.stadium, s);
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

export function computeResultCategoryExpenses(expenses: Expense[], records: JikgwanRecord[]): ResultCategoryData | null {
  const recMap = new Map<number, JikgwanRecord>();
  for (const r of records) recMap.set(r.id, r);
  const winMap = new Map<string, number>();
  const lossMap = new Map<string, number>();
  for (const e of expenses) {
    if (e.record_id == null) continue;
    const rec = recMap.get(e.record_id);
    if (!rec || rec.is_win == null) continue;
    if (rec.is_win === 1) winMap.set(e.category, (winMap.get(e.category) || 0) + e.amount);
    else if (rec.is_win === -1) lossMap.set(e.category, (lossMap.get(e.category) || 0) + e.amount);
  }
  if (winMap.size === 0 && lossMap.size === 0) return null;
  return { win: winMap, loss: lossMap };
}
