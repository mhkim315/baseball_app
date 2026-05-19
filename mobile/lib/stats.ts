import { parseGameTeamIds } from "@shared/constants";
import type { JikgwanRecord } from "@/lib/db";
import { resolveIsWin } from "@/lib/expenseStats";

export interface DiaryStats {
  totalGames: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  currentStreak: number;
  longestStreak: number;
  stadiums: string[];
  emotionCounts: Record<string, number>;
}

export interface OpponentStat {
  opponentId: string;
  wins: number;
  draws: number;
  losses: number;
  total: number;
  winRate: number;
}

export interface HomeAwayStat {
  home: { wins: number; draws: number; losses: number; total: number; winRate: number };
  away: { wins: number; draws: number; losses: number; total: number; winRate: number };
}

export interface DayOfWeekStat {
  day: string;
  wins: number;
  draws: number;
  losses: number;
  total: number;
  winRate: number;
}

export interface StreakStat {
  currentType: "W" | "L" | "D" | null;
  currentCount: number;
  longestWin: number;
  longestLose: number;
}

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function parseDateStr(dateStr: string): Date | null {
  const parts = dateStr.split(".");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  return new Date(y, m - 1, d);
}

function opponentTeam(gameId: string, cheeredTeam: string): string {
  const { awayId, homeId } = parseGameTeamIds(gameId);
  return awayId === cheeredTeam ? homeId : awayId;
}

export function computeDiaryStats(records: JikgwanRecord[]): DiaryStats {
  const wins = records.filter((r) => resolveIsWin(r) === 1).length;
  const draws = records.filter((r) => resolveIsWin(r) === 0).length;
  const losses = records.filter((r) => resolveIsWin(r) === -1).length;
  const totalGames = wins + draws + losses;
  const winRate = totalGames > 0 ? wins / totalGames : 0;

  const stadiums = [
    ...new Set(records.map((r) => r.stadium).filter(Boolean)),
  ] as string[];

  const emotionCounts: Record<string, number> = {};
  for (const r of records) {
    if (r.emotion) {
      emotionCounts[r.emotion] = (emotionCounts[r.emotion] || 0) + 1;
    }
  }

  const dates = [
    ...new Set(records.map((r) => r.date)),
  ].sort().reverse();
  let currentStreak = 0;
  const today = new Date();
  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = `${expected.getFullYear()}.${String(expected.getMonth() + 1).padStart(2, "0")}.${String(expected.getDate()).padStart(2, "0")}`;
    if (dates[i] === expectedStr) {
      currentStreak++;
    } else {
      break;
    }
  }

  let longestStreak = 0;
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = parseDateStr(dates[i - 1]);
    const curr = parseDateStr(dates[i]);
    if (prev && curr) {
      const diffDays = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
      if (Math.round(diffDays) === 1) {
        streak++;
      } else {
        longestStreak = Math.max(longestStreak, streak);
        streak = 1;
      }
    }
  }
  longestStreak = Math.max(longestStreak, streak);

  return {
    totalGames,
    wins,
    draws,
    losses,
    winRate,
    currentStreak,
    longestStreak,
    stadiums,
    emotionCounts,
  };
}

export function computeOpponentStats(records: JikgwanRecord[], cheeredTeam: string): OpponentStat[] {
  const map = new Map<string, { wins: number; draws: number; losses: number }>();
  for (const r of records) {
    if (resolveIsWin(r) == null || !r.cheered_team) continue;
    if (r.cheered_team !== cheeredTeam) continue;
    const opp = opponentTeam(r.game_id, cheeredTeam);
    if (!opp) continue;
    const iw = resolveIsWin(r);
    const entry = map.get(opp) || { wins: 0, draws: 0, losses: 0 };
    if (iw === 1) entry.wins++;
    else if (iw === 0) entry.draws++;
    else if (iw === -1) entry.losses++;
    map.set(opp, entry);
  }
  const stats: OpponentStat[] = [];
  for (const [opponentId, v] of map) {
    const total = v.wins + v.draws + v.losses;
    stats.push({ opponentId, ...v, total, winRate: total > 0 ? v.wins / total : 0 });
  }
  stats.sort((a, b) => b.winRate - a.winRate || b.total - a.total);
  return stats;
}

export function computeHomeAwayStats(records: JikgwanRecord[], cheeredTeam: string): HomeAwayStat {
  const home = { wins: 0, draws: 0, losses: 0, total: 0, winRate: 0 };
  const away = { wins: 0, draws: 0, losses: 0, total: 0, winRate: 0 };
  for (const r of records) {
    if (resolveIsWin(r) == null || !r.cheered_team) continue;
    if (r.cheered_team !== cheeredTeam) continue;
    const { homeId } = parseGameTeamIds(r.game_id);
    const iw = resolveIsWin(r);
    const target = homeId === cheeredTeam ? home : away;
    if (iw === 1) target.wins++;
    else if (iw === 0) target.draws++;
    else if (iw === -1) target.losses++;
  }
  home.total = home.wins + home.draws + home.losses;
  away.total = away.wins + away.draws + away.losses;
  home.winRate = home.total > 0 ? home.wins / home.total : 0;
  away.winRate = away.total > 0 ? away.wins / away.total : 0;
  return { home, away };
}

export function computeDayOfWeekStats(records: JikgwanRecord[]): DayOfWeekStat[] {
  const dayMap = new Map<number, { wins: number; draws: number; losses: number }>();
  for (let i = 0; i < 7; i++) dayMap.set(i, { wins: 0, draws: 0, losses: 0 });
  for (const r of records) {
    const iw = resolveIsWin(r);
    if (iw == null) continue;
    const d = parseDateStr(r.date);
    if (!d) continue;
    const dayIdx = d.getDay();
    const entry = dayMap.get(dayIdx)!;
    if (iw === 1) entry.wins++;
    else if (iw === 0) entry.draws++;
    else if (iw === -1) entry.losses++;
  }
  return DAY_NAMES.map((day, i) => {
    const v = dayMap.get(i)!;
    const total = v.wins + v.draws + v.losses;
    return { day, ...v, total, winRate: total > 0 ? v.wins / total : 0 };
  });
}

export function computeStreakStats(records: JikgwanRecord[]): StreakStat {
  const games = records
    .filter((r) => {
      const iw = resolveIsWin(r);
      return iw != null && iw !== 0;
    })
    .sort((a, b) => {
      const da = parseDateStr(a.date);
      const db = parseDateStr(b.date);
      return (da?.getTime() ?? 0) - (db?.getTime() ?? 0);
    });

  let longestWin = 0;
  let longestLose = 0;
  let run = 0;
  let runType: "W" | "L" | null = null;

  for (const g of games) {
    const type = resolveIsWin(g) === 1 ? "W" : "L";
    if (type === runType) {
      run++;
    } else {
      if (runType === "W") longestWin = Math.max(longestWin, run);
      if (runType === "L") longestLose = Math.max(longestLose, run);
      run = 1;
      runType = type;
    }
  }
  if (runType === "W") longestWin = Math.max(longestWin, run);
  if (runType === "L") longestLose = Math.max(longestLose, run);

  let currentType: "W" | "L" | null = null;
  let currentCount = 0;
  for (let i = games.length - 1; i >= 0; i--) {
    const type = resolveIsWin(games[i]) === 1 ? "W" : "L";
    if (i === games.length - 1) {
      currentType = type;
      currentCount = 1;
    } else {
      const prevType = resolveIsWin(games[i + 1]) === 1 ? "W" : "L";
      if (type === prevType) {
        currentCount++;
      } else {
        break;
      }
    }
  }

  return { currentType, currentCount, longestWin, longestLose };
}
