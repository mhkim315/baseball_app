import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { ChevronLeft } from "lucide-react";
import { TEAM_COLORS } from "@/lib/teamColors";
import { fetchGameDetail, fetchDailyScores, fetchStandingsJson, fetchAllDailyScores, type GameDetail, type ScoreEntry } from "@/lib/api";
import { TeamBadge } from "@/components/TeamBadge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorRetry } from "@/components/ErrorRetry";
import GameHeaderCard from "@/components/GameHeaderCard";
import ScoreBoardTable from "@/components/ScoreBoardTable";
import PreviewCard from "@/components/PreviewCard";
import StartersCard from "@/components/StartersCard";
import PitchingResultCard from "@/components/PitchingResultCard";
import LineupSection from "@/components/LineupSection";

export default function GameDetailPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const gameId = params.id || "";

  const [detail, setDetail] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [scoreFallback, setScoreFallback] = useState<ScoreEntry | null>(null);
  const [previewData, setPreviewData] = useState<{
    homeRecord: string; awayRecord: string;
    homeRank: number; awayRank: number;
    homeRecent: ("승"|"패"|"무")[]; awayRecent: ("승"|"패"|"무")[];
  } | null>(null);

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
        // Always fetch daily scores for score/status fallback
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

  // Fetch standings + recent games for preview card
  useEffect(() => {
    if (!detail) return;
    const homeName = TEAM_COLORS[detail.homeTeam]?.shortName;
    const awayName = TEAM_COLORS[detail.awayTeam]?.shortName;
    if (!homeName || !awayName) return;
    let cancelled = false;

    Promise.all([
      fetchStandingsJson(),
      fetchAllDailyScores(),
    ]).then(([standings, allScores]) => {
      if (cancelled || !standings?.rows || !allScores?.dates) return;

      const homeStanding = standings.rows.find((r) => r.teamName === homeName);
      const awayStanding = standings.rows.find((r) => r.teamName === awayName);
      if (!homeStanding || !awayStanding) return;

      // Compute recent 5 games for each team
      const dates = Object.keys(allScores.dates).sort().reverse();
      const homeRecent: ("승"|"패"|"무")[] = [];
      const awayRecent: ("승"|"패"|"무")[] = [];

      for (const date of dates) {
        if (homeRecent.length >= 5 && awayRecent.length >= 5) break;
        const games = allScores.dates[date];
        for (const g of games) {
          if (g.cancelled || g.outcome == null) continue;
          if (homeRecent.length < 5 && g.away === homeName) {
            homeRecent.push(g.awayScore > g.homeScore ? "승" : g.awayScore < g.homeScore ? "패" : "무");
          }
          if (homeRecent.length < 5 && g.home === homeName) {
            homeRecent.push(g.homeScore > g.awayScore ? "승" : g.homeScore < g.awayScore ? "패" : "무");
          }
          if (awayRecent.length < 5 && g.away === awayName) {
            awayRecent.push(g.awayScore > g.homeScore ? "승" : g.awayScore < g.homeScore ? "패" : "무");
          }
          if (awayRecent.length < 5 && g.home === awayName) {
            awayRecent.push(g.homeScore > g.awayScore ? "승" : g.homeScore < g.awayScore ? "패" : "무");
          }
          if (homeRecent.length >= 5 && awayRecent.length >= 5) break;
        }
      }

      setPreviewData({
        homeRecord: homeStanding.wlt, awayRecord: awayStanding.wlt,
        homeRank: homeStanding.rank, awayRank: awayStanding.rank,
        homeRecent: homeRecent.slice(0, 5),
        awayRecent: awayRecent.slice(0, 5),
      });
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [detail]);

  // --- Derived state ---

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
        <StickyHeader title="경기 상세" onBack={() => setLocation("/")} />
        <div className="max-w-lg mx-auto px-4 mt-16">
          <ErrorRetry onRetry={load} />
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen pb-20 md:pb-8">
        <StickyHeader title="경기 상세" onBack={() => setLocation("/")} />
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
  // Combine score from detail + dailyScores fallback
  const gameScore = detail.score ?? (scoreFallback ? { away: scoreFallback.awayScore, home: scoreFallback.homeScore } : null);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const isFuture = detail.date > todayStr;
  const isToday = detail.date === todayStr;
  const isCancelled = detail.gameInfo?.status === "cancelled" || scoreFallback?.cancelled === true || detail.etcRecords?.some(r => r.how?.includes("취소") || r.result?.includes("취소")) === true;

  const hasScoreData = gameScore !== null;
  const hasFinishedSignals = !!detail.scoreBoard || (detail.pitchingResult && detail.pitchingResult.length > 0) || (detail.etcRecords && detail.etcRecords.length > 0);
  const isGameActive = hasScoreData || hasFinishedSignals;

  // Only consider game started if current time is past scheduled start
  const [gh, gm] = (detail.gameInfo?.time || "18:30").split(":").map(Number);
  const startTime = new Date(detail.date);
  startTime.setHours(gh, gm, 0, 0);
  const gameHasStarted = new Date() >= startTime;

  const isFinished = !isCancelled && !isFuture && gameHasStarted && (
    detail.gameInfo?.status === "finished" ||
    (isGameActive && !isToday)
  );

  const isLive = !isCancelled && !isFinished && gameHasStarted && (
    detail.gameInfo?.status === "live" ||
    (isGameActive && isToday)
  );

  const statusLabel = isCancelled ? "취소" : isFinished ? "경기 종료" : isLive ? "경기 중" : isFuture ? "경기 예정" : "경기 전";
  const isBeforeGame = !isFinished && !isLive && !isCancelled;
  const showLineupStatus = isBeforeGame;
  const lineupConfirmed = isFuture ? false : (detail.lineupConfirmed ?? false);
  const gs = gameScore;
  const awayWin = isFinished && gs ? gs.away > gs.home : null;
  const homeWin = isFinished && gs ? gs.home > gs.away : null;
  const isDraw = isFinished && gs ? gs.away === gs.home : false;
  const awayEmotion: "default" | "determined" | "sad" | "joyful" | "neutral" = isCancelled ? "neutral" : isBeforeGame ? "determined" : awayWin ? "joyful" : isDraw ? "neutral" : isFinished ? "sad" : "default";
  const homeEmotion: "default" | "determined" | "sad" | "joyful" | "neutral" = isCancelled ? "neutral" : isBeforeGame ? "determined" : homeWin ? "joyful" : isDraw ? "neutral" : isFinished ? "sad" : "default";

  const scoreBoard = detail.scoreBoard;
  const rheb = scoreBoard?.rheb;
  const innData = scoreBoard?.inn;
  const maxInn = innData ? Math.max(innData.away.length, innData.home.length) : 0;

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      <StickyHeader title="경기 상세" onBack={() => setLocation("/")} />

      <div className="max-w-lg mx-auto px-4 mt-4">
        {/* Game header: team badges, score, venue */}
        <GameHeaderCard
          awayTeam={detail.awayTeam}
          homeTeam={detail.homeTeam}
          awayStarterName={detail.starters?.away?.name}
          homeStarterName={detail.starters?.home?.name}
          gameTime={detail.gameInfo?.time || "18:30"}
          venue={detail.gameInfo?.venue || ""}
          gameScore={gameScore}
          isCancelled={isCancelled}
          isLive={isLive}
          isFinished={isFinished}
          isFuture={isFuture}
          awayWin={awayWin}
          homeWin={homeWin}
          isDraw={isDraw}
          awayEmotion={awayEmotion}
          homeEmotion={homeEmotion}
          statusLabel={statusLabel}
        />

        {/* Inning-by-inning scoreboard for finished games */}
        {innData && rheb && (
          <ScoreBoardTable
            awayTeam={detail.awayTeam}
            homeTeam={detail.homeTeam}
            innData={innData}
            rheb={rheb}
            maxInn={maxInn}
          />
        )}

        {/* Preview card for upcoming games */}
        {!isFinished && previewData && (
          <PreviewCard
            awayTeam={detail.awayTeam}
            homeTeam={detail.homeTeam}
            previewData={previewData}
          />
        )}

        {/* Starting pitchers */}
        <StartersCard
          awayTeam={detail.awayTeam}
          homeTeam={detail.homeTeam}
          awayStarterName={detail.starters?.away?.name}
          homeStarterName={detail.starters?.home?.name}
          isFuture={isFuture}
        />

        {/* Pitching result */}
        <PitchingResultCard detail={detail} scoreFallback={scoreFallback} />

        {/* Lineup section */}
        <LineupSection
          awayTeam={detail.awayTeam}
          homeTeam={detail.homeTeam}
          awayLineup={awayLineup}
          homeLineup={homeLineup}
          hasLineup={hasLineup}
          isLive={isLive}
          isFuture={isFuture}
          lineupConfirmed={lineupConfirmed}
          showLineupStatus={showLineupStatus}
        />

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
        {hasLineup && (
          <p className="text-center text-xs text-muted-foreground mt-6 mb-4">
            {lineupConfirmed ? "라인업은 경기 시작 전에 확정돼요" : "예상 라인업은 전날 경기 데이터를 기반으로 해요"}
          </p>
        )}
      </div>
    </div>
  );
}

function StickyHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-lg mx-auto flex items-center gap-2 px-4 py-3">
        <button
          onClick={onBack}
          className="p-1 -ml-1 rounded-lg hover:bg-accent transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm font-medium">{title}</span>
      </div>
    </div>
  );
}
