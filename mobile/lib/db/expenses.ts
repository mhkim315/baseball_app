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

export async function addExpense(expense: Omit<Expense, "id" | "created_at">): Promise<number> {
  const database = await getDb();
  const result = await database.runAsync(
    "INSERT INTO expenses (record_id, date, category, amount, memo) VALUES (?, ?, ?, ?, ?)",
    expense.record_id ?? null,
    expense.date,
    expense.category,
    expense.amount,
    expense.memo ?? null,
  );
  return result.lastInsertRowId ?? 0;
}

export async function getExpensesByRecordId(recordId: number): Promise<Expense[]> {
  const database = await getDb();
  return database.getAllAsync<Expense>(
    "SELECT * FROM expenses WHERE record_id = ? ORDER BY amount DESC",
    recordId
  );
}

export async function getExpensesByDate(date: string): Promise<Expense[]> {
  const database = await getDb();
  return database.getAllAsync<Expense>(
    "SELECT * FROM expenses WHERE date = ? ORDER BY amount DESC",
    date
  );
}

export async function getExpensesByMonth(year: number, month: number): Promise<Expense[]> {
  const database = await getDb();
  const prefix = `${year}.${String(month).padStart(2, "0")}`;
  return database.getAllAsync<Expense>(
    "SELECT * FROM expenses WHERE date LIKE ? ORDER BY date DESC, amount DESC",
    `${prefix}%`
  );
}

export async function getAllExpenses(): Promise<Expense[]> {
  const database = await getDb();
  return database.getAllAsync<Expense>(
    "SELECT * FROM expenses ORDER BY date DESC, amount DESC"
  );
}

export async function getExpensesByRecordIds(recordIds: number[]): Promise<Expense[]> {
  if (recordIds.length === 0) return [];
  const database = await getDb();
  const placeholders = recordIds.map(() => "?").join(",");
  return database.getAllAsync<Expense>(
    `SELECT * FROM expenses WHERE record_id IN (${placeholders}) ORDER BY amount DESC`,
    ...recordIds
  );
}

const EXPENSE_ALLOWED_COLUMNS = new Set(["category", "amount", "memo"]);

export async function updateExpense(
  id: number,
  fields: Partial<Pick<Expense, "category" | "amount" | "memo">>
): Promise<void> {
  const database = await getDb();
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
  await database.runAsync(
    `UPDATE expenses SET ${setClauses.join(", ")} WHERE id = ?`,
    ...values
  );
}

export async function deleteExpense(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM expenses WHERE id = ?", id);
}

export async function deleteExpensesByRecordId(recordId: number): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM expenses WHERE record_id = ?", recordId);
}
