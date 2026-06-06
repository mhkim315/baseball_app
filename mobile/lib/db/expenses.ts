import { getDb } from "./connection";

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

// ── 메모리 캐시: 탭 전환 시 JS 스레드 블로킹 방지 ──
let expensesCache: Expense[] | null = null;

export function invalidateExpensesCache(): void {
  expensesCache = null;
}

export function addExpense(expense: Omit<Expense, "id" | "created_at">): number {
  invalidateExpensesCache();
  const database = getDb();
  const result = database.runSync(
    "INSERT INTO expenses (record_id, date, category, amount, memo) VALUES (?, ?, ?, ?, ?)",
    expense.record_id ?? null,
    expense.date,
    expense.category,
    expense.amount,
    expense.memo ?? null,
  );
  return result.lastInsertRowId ?? 0;
}

export function getExpensesByRecordId(recordId: number): Expense[] {
  const database = getDb();
  return database.getAllSync<Expense>(
    "SELECT * FROM expenses WHERE record_id = ? ORDER BY amount DESC",
    recordId
  );
}

export function getExpensesByDate(date: string): Expense[] {
  const database = getDb();
  return database.getAllSync<Expense>(
    "SELECT * FROM expenses WHERE date = ? ORDER BY amount DESC",
    date
  );
}

export function getExpensesByMonth(year: number, month: number): Expense[] {
  const prefix = `${year}.${String(month).padStart(2, "0")}`;
  if (expensesCache !== null) {
    return expensesCache.filter((e) => e.date.startsWith(prefix));
  }
  const database = getDb();
  return database.getAllSync<Expense>(
    "SELECT * FROM expenses WHERE date LIKE ? ORDER BY date DESC, amount DESC",
    `${prefix}%`
  );
}

export function getAllExpenses(): Expense[] {
  if (expensesCache !== null) return expensesCache;
  const database = getDb();
  expensesCache = database.getAllSync<Expense>(
    "SELECT * FROM expenses ORDER BY date DESC, amount DESC"
  );
  return expensesCache;
}

export function getExpensesByRecordIds(recordIds: number[]): Expense[] {
  if (recordIds.length === 0) return [];
  const database = getDb();
  const placeholders = recordIds.map(() => "?").join(",");
  return database.getAllSync<Expense>(
    `SELECT * FROM expenses WHERE record_id IN (${placeholders}) ORDER BY amount DESC`,
    ...recordIds
  );
}

const EXPENSE_ALLOWED_COLUMNS = new Set(["category", "amount", "memo"]);

export function updateExpense(
  id: number,
  fields: Partial<Pick<Expense, "category" | "amount" | "memo">>
): void {
  invalidateExpensesCache();
  const database = getDb();
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
  database.runSync(
    `UPDATE expenses SET ${setClauses.join(", ")} WHERE id = ?`,
    ...values
  );
}

export function deleteExpense(id: number): void {
  invalidateExpensesCache();
  const database = getDb();
  database.runSync("DELETE FROM expenses WHERE id = ?", id);
}

export function deleteExpensesByRecordId(recordId: number): void {
  invalidateExpensesCache();
  const database = getDb();
  database.runSync("DELETE FROM expenses WHERE record_id = ?", recordId);
}
