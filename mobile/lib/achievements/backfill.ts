import { getJikgwanRecords, updateJikgwanRecord, type JikgwanRecord } from "@/lib/db";
import { parseGameTeamIds } from "@shared/constants";
import { TEAM_COLORS } from "@shared/teamColors";
import { cachedDailyScores } from "@/lib/gameCache";

/**
 * Backfill records saved during live games with final scores once the game finishes.
 * Called on AppState foreground and after diary save, before evaluateBadges().
 * Returns the number of records that were updated.
 */
export async function backfillLiveRecords(): Promise<number> {
  const records = await getJikgwanRecords();
  const liveRecords = records.filter((r) => r.game_status === "live");
  if (liveRecords.length === 0) return 0;

  // Group by date to batch daily score fetches
  const byDate = new Map<string, JikgwanRecord[]>();
  for (const rec of liveRecords) {
    const dateKey = rec.date.replace(/\./g, "-"); // YYYY.MM.DD → YYYY-MM-DD
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(rec);
  }

  let updatedCount = 0;
  for (const [dateKey, recs] of byDate) {
    let scores;
    try {
      scores = await cachedDailyScores(dateKey);
    } catch {
      console.warn("backfillLiveRecords: failed to fetch scores for", dateKey);
      continue;
    }
    if (!scores?.games || scores.games.length === 0) continue;

    for (const rec of recs) {
      if (!rec.game_id) continue;
      const { awayId, homeId } = parseGameTeamIds(rec.game_id);
      if (!awayId || !homeId) continue;

      const awayShort = TEAM_COLORS[awayId]?.shortName;
      const homeShort = TEAM_COLORS[homeId]?.shortName;
      if (!awayShort || !homeShort) continue;

      // Find matching score entry by team names
      const matching = scores.games.filter((s) => s.away === awayShort && s.home === homeShort);
      if (matching.length === 0) continue;

      // Extract DH suffix from game_id for doubleheader matching
      const suffix = rec.game_id.split("-").pop() || "0";
      const gameIdx = parseInt(suffix, 10);
      const match = matching.find((s) => (s.gameIdx ?? 0) === gameIdx) || matching[0];

      if (!match || match.outcome == null || match.cancelled) continue;

      // Game is finished — update with final scores
      const finalAwayScore = match.awayScore;
      const finalHomeScore = match.homeScore;

      let isWin: number | null = null;
      if (rec.cheered_team) {
        if (rec.cheered_team === homeId) {
          isWin = finalHomeScore > finalAwayScore ? 1 : finalHomeScore < finalAwayScore ? -1 : 0;
        } else if (rec.cheered_team === awayId) {
          isWin = finalAwayScore > finalHomeScore ? 1 : finalAwayScore < finalHomeScore ? -1 : 0;
        }
      }

      await updateJikgwanRecord(rec.id, {
        score_away: finalAwayScore,
        score_home: finalHomeScore,
        is_win: isWin,
        game_status: "finished",
      });
      updatedCount++;
    }
  }

  return updatedCount;
}
