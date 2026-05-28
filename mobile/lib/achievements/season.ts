import type { Badge, JikgwanRecord } from "@/lib/db";
import { computeStreakStats } from "@/lib/stats";
import { resolveIsWin } from "@/lib/expenseStats";
import { parseGameTeamIds } from "@shared/constants";
import { TEAM_COLORS } from "@shared/teamColors";

export interface SeasonSummary {
  year: number;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  totalSpent: number;
  stadiums: string[];
  topOpponentWins: { teamId: string; shortName: string; wins: number } | null;
  topOpponentLosses: { teamId: string; shortName: string; losses: number } | null;
  longestWinStreak: number;
  emotionCounts: Record<string, number>;
  topEmotion: string | null;
  bestGame: JikgwanRecord | null;
  badgesEarned: number;
}

export function computeSeasonSummary(
  year: number,
  records: JikgwanRecord[],
  badges: Badge[],
  totalSpent: number
): SeasonSummary {
  const yearPrefix = `${year}.`;
  const yearRecords = records.filter((r) => r.date.startsWith(yearPrefix));

  let wins = 0;
  let losses = 0;
  let draws = 0;
  const stadiumSet = new Set<string>();
  const emotionCounts: Record<string, number> = {};
  const oppWins = new Map<string, { total: number }>();
  const oppLosses = new Map<string, { total: number }>();
  let bestGame: JikgwanRecord | null = null;

  // Use sorted records (ASC) to find best game (last win of season, or first game)
  const sorted = [...yearRecords].sort((a, b) => a.date.localeCompare(b.date));

  for (const r of sorted) {
    const iw = resolveIsWin(r);
    if (iw === 1) wins++;
    else if (iw === 0) draws++;
    else if (iw === -1) losses++;

    if (r.stadium) stadiumSet.add(r.stadium);
    if (r.emotion) emotionCounts[r.emotion] = (emotionCounts[r.emotion] || 0) + 1;

    // Track opponent win/loss
    if (r.cheered_team && r.game_id && iw != null) {
      const ids = parseGameTeamIds(r.game_id);
      const opp = r.cheered_team === ids.awayId ? ids.homeId : ids.awayId;
      if (opp) {
        if (iw === 1) {
          const entry = oppWins.get(opp) ?? { total: 0 };
          entry.total++;
          oppWins.set(opp, entry);
        } else if (iw === -1) {
          const entry = oppLosses.get(opp) ?? { total: 0 };
          entry.total++;
          oppLosses.set(opp, entry);
        }
      }
    }

    // Best game: prefer a win, then highest-scoring, then most recent
    if (!bestGame && iw === 1) bestGame = r;
  }
  // Fallback: any game
  if (!bestGame && sorted.length > 0) bestGame = sorted[sorted.length - 1];

  const s = computeStreakStats(yearRecords);

  const topWins = [...oppWins.entries()].sort((a, b) => b[1].total - a[1].total)[0];
  const topLosses = [...oppLosses.entries()].sort((a, b) => b[1].total - a[1].total)[0];

  const topEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const badgesEarned = badges.filter((b) => b.unlocked_date && b.unlocked_date.startsWith(yearPrefix)).length;

  return {
    year,
    totalGames: wins + losses + draws,
    wins,
    losses,
    draws,
    winRate: wins + losses + draws > 0 ? wins / (wins + losses + draws) : 0,
    totalSpent,
    stadiums: [...stadiumSet],
    topOpponentWins: topWins
      ? {
          teamId: topWins[0],
          shortName: TEAM_COLORS[topWins[0]]?.shortName ?? topWins[0],
          wins: topWins[1].total,
        }
      : null,
    topOpponentLosses: topLosses
      ? {
          teamId: topLosses[0],
          shortName: TEAM_COLORS[topLosses[0]]?.shortName ?? topLosses[0],
          losses: topLosses[1].total,
        }
      : null,
    longestWinStreak: Math.max(s.longestWin, s.currentType === "W" ? s.currentCount : 0),
    emotionCounts,
    topEmotion,
    bestGame,
    badgesEarned,
  };
}
