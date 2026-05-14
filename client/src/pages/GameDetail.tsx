import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { ChevronLeft } from "lucide-react";
import { TEAM_COLORS } from "@/lib/teamColors";
import { fetchGameDetail, fetchDailyScores, type GameDetail, type ScoreEntry, type LineupPlayer } from "@/lib/api";
import { TeamBadge } from "@/components/TeamBadge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorRetry } from "@/components/ErrorRetry";

const POSITION_LABELS: Record<string, string> = {
  "1": "1B", "2": "2B", "3": "3B",
  "유": "SS", "포": "C", "중": "CF",
  "좌": "LF", "우": "RF", "지": "DH", "투": "P",
  "1루수": "1B", "2루수": "2B", "3루수": "3B",
  "유격수": "SS", "포수": "C", "중견수": "CF",
  "좌익수": "LF", "우익수": "RF", "지명타자": "DH", "투수": "P",
};

const WLS_LABELS: Record<string, string> = {
  "W": "승", "L": "패", "S": "세", "H": "홀",
};

const WLS_COLORS: Record<string, string> = {
  "W": "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950",
  "L": "text-red-500 bg-red-50 dark:text-red-400 dark:bg-red-950",
  "S": "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950",
  "H": "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950",
};

export default function GameDetailPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const gameId = params.id || "";

  const [detail, setDetail] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [scoreFallback, setScoreFallback] = useState<ScoreEntry | null>(null);

  const load = useCallback(() => {
    if (!gameId) return;
    setLoading(true);
    setError(false);
    setScoreFallback(null);
    let cancelled = false;

    fetchGameDetail(gameId).then((data) => {
      if (cancelled) return;
      if (data) {
        setDetail(data);
        if (data.gameInfo?.status === "finished" && !data.scoreBoard && !data.pitchingResult) {
          const dateStr = `${gameId.slice(0, 4)}-${gameId.slice(4, 6)}-${gameId.slice(6, 8)}`;
          fetchDailyScores(dateStr).then((scores) => {
            if (cancelled || !scores?.games) return;
            const homeName = TEAM_COLORS[data.homeTeam]?.shortName || "";
            const awayName = TEAM_COLORS[data.awayTeam]?.shortName || "";
            const match = scores.games.find(
              (s) => s.home === homeName && s.away === awayName
            );
            if (match) setScoreFallback(match);
          });
        }
      } else {
        setError(true);
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setError(true);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [gameId]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen pb-20 md:pb-8 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pb-20 md:pb-8">
        <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="max-w-lg mx-auto flex items-center gap-2 px-4 py-3">
            <button onClick={() => setLocation("/")} className="p-1 -ml-1 rounded-lg hover:bg-accent transition-colors">
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-medium">경기 상세</span>
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 mt-16">
          <ErrorRetry onRetry={load} />
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen pb-20 md:pb-8">
        <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="max-w-lg mx-auto flex items-center gap-2 px-4 py-3">
            <button onClick={() => setLocation("/")} className="p-1 -ml-1 rounded-lg hover:bg-accent transition-colors">
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-medium">경기 상세</span>
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 mt-16 text-center">
          <p className="text-muted-foreground">경기 정보를 준비 중이에요</p>
        </div>
      </div>
    );
  }

  const home = TEAM_COLORS[detail.homeTeam];
  const away = TEAM_COLORS[detail.awayTeam];
  const homeLineup = detail.lineup?.home || [];
  const awayLineup = detail.lineup?.away || [];
  const hasLineup = homeLineup.length > 0 && awayLineup.length > 0;
  const isFinished = detail.gameInfo?.status === "finished";
  const isLive = detail.gameInfo?.status === "live";
  const statusLabel = isFinished ? "경기 종료" : isLive ? "경기 중" : "경기 전";
  const showLineupStatus = !isFinished && !isLive;
  const lineupConfirmed = detail.lineupConfirmed ?? false;

  const scoreBoard = detail.scoreBoard;
  const rheb = scoreBoard?.rheb;
  const innData = scoreBoard?.inn;
  const maxInn = innData ? Math.max(innData.away.length, innData.home.length) : 0;

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto flex items-center gap-2 px-4 py-3">
          <button
            onClick={() => setLocation("/")}
            className="p-1 -ml-1 rounded-lg hover:bg-accent transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-medium">경기 상세</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-4">
        {/* Game header */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center gap-2">
              <TeamBadge teamId={detail.awayTeam} size="lg" />
              <span className="text-sm font-medium">{away?.name}</span>
              <span className="text-xs text-muted-foreground">
                {detail.starters?.away?.name || "-"}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-muted-foreground">{detail.gameInfo?.time || "18:30"}</span>
              {detail.score ? (
                <div className="flex items-center gap-3">
                  <span className={`text-2xl font-bold ${isFinished && detail.score!.away > detail.score!.home ? "" : ""}`}>{detail.score.away}</span>
                  <span className="text-sm text-muted-foreground">:</span>
                  <span className={`text-2xl font-bold ${isFinished && detail.score!.home > detail.score!.away ? "" : ""}`}>{detail.score.home}</span>
                </div>
              ) : (
                <span className="text-lg font-bold text-muted-foreground">VS</span>
              )}
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                isLive ? "bg-destructive/10 text-destructive animate-pulse" :
                isFinished ? "bg-accent text-muted-foreground" :
                "bg-accent text-muted-foreground"
              }`}>
                {isLive ? "경기 중" : statusLabel}
              </span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <TeamBadge teamId={detail.homeTeam} size="lg" />
              <span className="text-sm font-medium">{home?.name}</span>
              <span className="text-xs text-muted-foreground">
                {detail.starters?.home?.name || "-"}
              </span>
            </div>
          </div>
          {detail.gameInfo?.venue && (
            <p className="text-center text-xs text-muted-foreground mt-3">{detail.gameInfo.venue}</p>
          )}
        </div>

        {/* Scoreboard (inning-by-inning) for past games */}
        {innData && rheb && (
          <div className="bg-card rounded-2xl border border-border p-4 mt-3 overflow-x-auto">
            <h3 className="text-sm font-semibold mb-3">스코어보드</h3>
            <table className="w-full text-xs text-center">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="py-1 pr-2 text-left">팀</th>
                  {Array.from({ length: maxInn }).map((_, i) => (
                    <th key={i} className="py-1 px-1.5 w-7">{i + 1}</th>
                  ))}
                  <th className="py-1 px-1.5 border-l border-border w-7">R</th>
                  <th className="py-1 px-1.5 w-7">H</th>
                  <th className="py-1 px-1.5 w-7">E</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="py-1.5 pr-2 text-left font-medium">{away?.shortName}</td>
                  {Array.from({ length: maxInn }).map((_, i) => (
                    <td key={i} className="py-1.5 px-1.5">{innData.away[i] != null ? innData.away[i] : '-'}</td>
                  ))}
                  <td className="py-1.5 px-1.5 border-l border-border font-bold">{rheb.away.r ?? '-'}</td>
                  <td className="py-1.5 px-1.5">{rheb.away.h ?? '-'}</td>
                  <td className="py-1.5 px-1.5">{rheb.away.e ?? '-'}</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-2 text-left font-medium">{home?.shortName}</td>
                  {Array.from({ length: maxInn }).map((_, i) => (
                    <td key={i} className="py-1.5 px-1.5">{innData.home[i] != null ? innData.home[i] : '-'}</td>
                  ))}
                  <td className="py-1.5 px-1.5 border-l border-border font-bold">{rheb.home.r ?? '-'}</td>
                  <td className="py-1.5 px-1.5">{rheb.home.h ?? '-'}</td>
                  <td className="py-1.5 px-1.5">{rheb.home.e ?? '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Starting pitchers */}
        <div className="bg-card rounded-2xl border border-border p-4 mt-3">
          <h3 className="text-sm font-semibold mb-3">선발투수</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 bg-accent/30 rounded-xl p-3">
              <TeamBadge teamId={detail.awayTeam} size="sm" />
              <div>
                <p className="text-sm font-medium">{detail.starters?.away?.name || "미정"}</p>
                <p className="text-xs text-muted-foreground">{away?.shortName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-accent/30 rounded-xl p-3">
              <TeamBadge teamId={detail.homeTeam} size="sm" />
              <div>
                <p className="text-sm font-medium">{detail.starters?.home?.name || "미정"}</p>
                <p className="text-xs text-muted-foreground">{home?.shortName}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pitching result: 승/패 from game-records or dailyScores fallback */}
        {detail.pitchingResult && detail.pitchingResult.length > 0 ? (
          <div className="bg-card rounded-2xl border border-border p-4 mt-3">
            <h3 className="text-sm font-semibold mb-3">투수 기록</h3>
            <div className="flex flex-col gap-2">
              {detail.pitchingResult.map((p, i) => {
                const wlsLabel = WLS_LABELS[p.wls] || p.wls;
                const wlsColor = WLS_COLORS[p.wls] || "text-muted-foreground bg-accent";
                return (
                  <div key={i} className="flex items-center justify-between bg-accent/30 rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${wlsColor}`}>{wlsLabel}</span>
                      <span className="text-sm font-medium">{p.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.ip && <span>{p.ip}이닝</span>}
                      {p.era && <span className="ml-2">ERA {p.era}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : scoreFallback ? (
          <div className="bg-card rounded-2xl border border-border p-4 mt-3">
            <h3 className="text-sm font-semibold mb-3">투수 기록</h3>
            <div className="flex items-center justify-between bg-accent/30 rounded-xl px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950">승</span>
                <span className="text-sm font-medium">{scoreFallback.winPitcher || "-"}</span>
              </div>
            </div>
            <div className="flex items-center justify-between bg-accent/30 rounded-xl px-4 py-2.5 mt-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-red-500 bg-red-50 dark:text-red-400 dark:bg-red-950">패</span>
                <span className="text-sm font-medium">{scoreFallback.losePitcher || "-"}</span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Lineup or 예상/확정 */}
        {hasLineup ? (
          <div className="mt-3">
            {/* Lineup status badge */}
            {isLive ? (
              <div className="text-center mb-2">
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-destructive/10 text-destructive animate-pulse">
                  경기 중
                </span>
              </div>
            ) : showLineupStatus ? (
              <div className="text-center mb-2">
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  lineupConfirmed
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                }`}>
                  {lineupConfirmed ? "라인업 확정" : "예상 라인업"}
                </span>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              {/* Away lineup */}
              <div className="bg-card rounded-2xl border border-border p-4">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                  <TeamBadge teamId={detail.awayTeam} size="sm" />
                  <span className="text-sm font-semibold">{away?.shortName}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {awayLineup.map((player: LineupPlayer) => (
                    <div key={player.order} className="flex items-center gap-2 text-sm">
                      <span className="text-xs text-muted-foreground w-4 text-right">{player.order}</span>
                      <span className="text-xs text-muted-foreground w-5 text-center bg-accent rounded px-1">
                        {POSITION_LABELS[player.position] || player.position}
                      </span>
                      <span className="font-medium">{player.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Home lineup */}
              <div className="bg-card rounded-2xl border border-border p-4">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                  <TeamBadge teamId={detail.homeTeam} size="sm" />
                  <span className="text-sm font-semibold">{home?.shortName}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {homeLineup.map((player: LineupPlayer) => (
                    <div key={player.order} className="flex items-center gap-2 text-sm">
                      <span className="text-xs text-muted-foreground w-4 text-right">{player.order}</span>
                      <span className="text-xs text-muted-foreground w-5 text-center bg-accent rounded px-1">
                        {POSITION_LABELS[player.position] || player.position}
                      </span>
                      <span className="font-medium">{player.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 bg-card rounded-2xl border border-border p-8 text-center">
            <p className="text-muted-foreground text-sm mb-1">아직 라인업이 공개되지 않았어요</p>
            <p className="text-xs text-muted-foreground">경기 시작 전에 확정 후 업데이트돼요</p>
          </div>
        )}

        {/* Game highlights */}
        {detail.etcRecords && detail.etcRecords.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4 mt-3">
            <h3 className="text-sm font-semibold mb-3">경기 기록</h3>
            <div className="flex flex-col gap-2">
              {detail.etcRecords.map((r, i) => (
                <div key={i} className="text-sm flex items-start gap-2">
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap mt-0.5 bg-accent rounded px-1.5 py-0.5">{r.result}</span>
                  <span className="break-words min-w-0">{r.how}{r.desc ? ` (${r.desc})` : ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info message */}
        <p className="text-center text-xs text-muted-foreground mt-6 mb-4">
          {hasLineup
            ? (lineupConfirmed ? "라인업은 경기 시작 전에 확정돼요" : "예상 라인업은 전날 경기 데이터를 기반으로 해요")
            : ""}
        </p>
      </div>
    </div>
  );
}
