// Re-export for unified import — 날짜 관련 함수는 dateUtils 하나만 import
export { formatDate, formatDateForApi } from "@shared/constants";

export function formatMonthKey(year: number, month: number): string {
  return `${year}.${String(month).padStart(2, "0")}`;
}

export function dotToDash(dateStr: string): string {
  return dateStr.replace(/\./g, "-");
}

export function dashToDot(dateStr: string): string {
  return dateStr.replace(/-/g, ".");
}

export function parseDotDate(dateStr: string): [number, number, number] | null {
  const parts = dateStr.split(".");
  if (parts.length !== 3) return null;
  const nums = parts.map(Number);
  if (nums.some(isNaN)) return null;
  return [nums[0], nums[1], nums[2]];
}

export function parseDashDate(dateStr: string): [number, number, number] | null {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const nums = parts.map(Number);
  if (nums.some(isNaN)) return null;
  return [nums[0], nums[1], nums[2]];
}

export function normalizeDate(d: string): string {
  if (/^\d{8}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return d;
}
