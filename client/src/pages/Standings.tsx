import { useState, useEffect, useCallback } from "react";
import { TEAM_COLORS } from "@/lib/teamColors";
import { fetchStandingsJson, type StandingRow } from "@/lib/api";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorRetry } from "@/components/ErrorRetry";
import { TEAM_NAME_TO_ID } from "@shared/constants";

function parseWLT(wlt: string): { wins: number; draws: number; losses: number } {
  const m = wlt.match(/(\d+)승(\d+)무(\d+)패/);
  if (!m) return { wins: 0, draws: 0, losses: 0 };
  return { wins: parseInt(m[1]), draws: parseInt(m[2]), losses: parseInt(m[3]) };
}

function formatDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return isoStr;
  }
}

function formatLast10(last10?: string): string {
  if (!last10) return "-";
  // last_10 may be like "8-2" or "5-4-1" (wins-losses-draws)
  const parts = last10.split("-");
  if (parts.length === 2) return `${parts[0]}승${parts[1]}패`;
  if (parts.length === 3) return `${parts[0]}승${parts[2]}무${parts[1]}패`;
  return last10;
}

export default function Standings() {
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [fetchedAt, setFetchedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchStandingsJson().then((data) => {
      if (data) {
        setStandings(data.rows);
        setFetchedAt(data.fetchedAt);
      } else {
        setError(true);
      }
      setLoading(false);
    }).catch(() => {
      setError(true);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      {/* 모바일 헤더 */}
      <div className="md:hidden px-5 pt-6 pb-4">
        <h1 className="text-xl font-bold">순위</h1>
        <p className="text-sm text-muted-foreground mt-0.5">2026 KBO 리그</p>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-2 md:mt-6">
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorRetry onRetry={load} />
        ) : (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
            {/* 테이블 헤더 */}
            <div className="grid grid-cols-[36px_1fr_40px_40px_40px_40px_54px_44px_52px_74px] px-3 py-3 text-[11px] text-muted-foreground border-b border-border bg-accent/50 min-w-[620px]">
              <span className="text-center">#</span>
              <span>팀</span>
              <span className="text-center">경기수</span>
              <span className="text-center">승</span>
              <span className="text-center">무</span>
              <span className="text-center">패</span>
              <span className="text-center">승률</span>
              <span className="text-center">차</span>
              <span className="text-center">연속</span>
              <span className="text-center">최근10경기</span>
            </div>

            {/* 순위 목록 */}
            {standings.map((row, index) => {
              const teamId = TEAM_NAME_TO_ID[row.teamName];
              const team = teamId ? TEAM_COLORS[teamId] : null;
              const { wins, draws, losses } = parseWLT(row.wlt);

              return (
                <div
                  key={`${row.teamName}-${index}`}
                  className="grid grid-cols-[36px_1fr_40px_40px_40px_40px_54px_44px_52px_74px] px-3 py-3 items-center border-b border-border last:border-b-0 hover:bg-accent/30 transition-colors min-w-[620px]"
                >
                  <span className={`text-center text-sm font-bold ${index < 5 ? "text-foreground" : "text-muted-foreground"}`}>
                    {row.rank}
                  </span>
                  <span className="text-sm font-medium truncate">{team?.shortName || row.teamName}</span>
                  <span className="text-center text-sm">{row.gamesPlayed ?? "-"}</span>
                  <span className="text-center text-sm">{wins}</span>
                  <span className="text-center text-sm">{draws}</span>
                  <span className="text-center text-sm">{losses}</span>
                  <span className="text-center text-sm font-medium">{row.winRate != null ? row.winRate.toFixed(3).slice(1) : "-"}</span>
                  <span className="text-center text-xs text-muted-foreground">
                    {row.gamesBehind == null ? "-" : row.gamesBehind === 0 ? "-" : row.gamesBehind.toFixed(1)}
                  </span>
                  <span className={`text-center text-xs font-medium ${
                    row.streak.includes("승") ? "text-blue-600" : row.streak.includes("무") ? "text-amber-600" : "text-red-500"
                  }`}>
                    {row.streak}
                  </span>
                  <span className="text-center text-xs font-medium text-muted-foreground">{formatLast10(row.last10)}</span>
                </div>
              );
            })}
            </div>
          </div>
        )}

        {/* 업데이트 시간 */}
        {fetchedAt && (
          <p className="text-center text-xs text-muted-foreground mt-4">
            {formatDate(fetchedAt)} 기준
          </p>
        )}
      </div>
    </div>
  );
}
