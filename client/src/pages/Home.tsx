import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import DateSelector from "@/components/DateSelector";
import GameCard from "@/components/GameCard";
import { fetchTodayGames, fetchDailyScores, fetchScheduleByMonth, fetchGameDetail, type TodayGame, type ScoreEntry, type ScheduleGame } from "@/lib/api";
import { TEAM_COLORS } from "@/lib/teamColors";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorRetry } from "@/components/ErrorRetry";
import { TEAM_NAME_TO_ID, TEAM_ID_TO_CODE } from "@shared/constants";

// Reverse: teamId → shortName (Korean)
function teamShortName(teamId: string): string {
  return TEAM_COLORS[teamId]?.shortName || "";
}

function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
}

function getWeekLabel(date: Date): string {
  const d = new Date(date);
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
  const adjusted = d.getDate() + monthStart.getDay();
  const weekNum = Math.ceil(adjusted / 7);
  return `${d.getMonth() + 1}월 ${weekNum}주차`;
}

interface EnhancedGame {
  id: string;
  homeTeam: string;
  awayTeam: string;
  time: string;
  venue: string;
  status: "scheduled" | "live" | "finished";
  homeScore?: number;
  awayScore?: number;
  homePitcher?: string;
  awayPitcher?: string;
  winPitcher?: string | null;
  losePitcher?: string | null;
  cancelled?: boolean;
  liveInning?: number;
  isTop?: boolean;
}

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [, setLocation] = useLocation();
  const [enhancedGames, setEnhancedGames] = useState<EnhancedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const scheduleCache = useRef<{ month: number; games: ScheduleGame[] } | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    const dateStr = formatDateStr(selectedDate);
    setLoading(true);
    setError(false);
    let cancelled = false;

    const todayView = isToday(selectedDate);

    if (todayView) {
      // Today: use today-games (has starters) + dailyScores (has win/loss)
      Promise.all([
        fetchTodayGames(),
        fetchDailyScores(dateStr),
      ]).then(([gamesData, scoresData]) => {
        if (cancelled) return;
        const scoreEntries: ScoreEntry[] = scoresData?.games || [];
        if (gamesData?.games) {
          // If API date doesn't match selected date (e.g. just past midnight),
          // use nextGames as fallback instead of showing yesterday's games as today's
          const apiGames = gamesData.date === dateStr
            ? gamesData.games
            : (gamesData.nextGames?.filter((g) => g.date === dateStr) ?? []);
          const games: EnhancedGame[] = apiGames.map((g: TodayGame) => {
            const score = scoreEntries.find(
              (s) => s.away === TEAM_COLORS[g.away.id]?.shortName && s.home === TEAM_COLORS[g.home.id]?.shortName
            );
            const rawStatus = g.status as "scheduled" | "live" | "finished";
            const hasAnyScore = g.score != null || (score != null && !score.cancelled);
            // API may not update status to "live" for in-progress games;
            // treat "scheduled" + score data as live for today (only after game time)
            const [h, m] = (g.time || "18:30").split(":").map(Number);
            const startTime = new Date(selectedDate);
            startTime.setHours(h, m, 0, 0);
            const hasStarted = new Date() >= startTime;
            const gameStatus = rawStatus === "scheduled" && hasAnyScore && todayView && hasStarted ? "live" : rawStatus || "scheduled";
            return {
              id: g.id,
              homeTeam: g.home.id,
              awayTeam: g.away.id,
              time: g.time || "18:30",
              venue: g.venue || "",
              status: gameStatus,
              homeScore: g.score?.home ?? score?.homeScore,
              awayScore: g.score?.away ?? score?.awayScore,
              homePitcher: g.home.starter?.name,
              awayPitcher: g.away.starter?.name,
              winPitcher: score?.winPitcher,
              losePitcher: score?.losePitcher,
              cancelled: score?.cancelled,
              liveInning: (g as any).liveInning,
              isTop: (g as any).btop,
            };
          });
          setEnhancedGames(games);

          // Fallback: fetch game-detail for live games to get inning data
          const liveGames = games.filter((g) => g.status === "live" && g.liveInning == null);
          if (liveGames.length > 0) {
            Promise.all(
              liveGames.map((g) => fetchGameDetail(g.id).catch(() => null))
            ).then((results) => {
              if (cancelled) return;
              const updated = games.map((g) => {
                const detail = results.find((r) => r?.gameId === g.id);
                if (!detail?.scoreBoard?.inn || g.liveInning != null) return g;

                const inn = detail.scoreBoard.inn;
                const aLen = inn.away?.length ?? 0;
                const hLen = inn.home?.length ?? 0;
                let liveInning: number | undefined;
                let isTop: boolean | undefined;
                if (aLen > hLen) {
                  liveInning = aLen;
                  isTop = true;
                } else if (hLen > 0) {
                  liveInning = aLen;
                  isTop = false;
                }

                return { ...g, liveInning, isTop };
              });
              setEnhancedGames(updated);
            }).catch(() => {});
          }
        } else {
          setEnhancedGames([]);
        }
        setLoading(false);
      }).catch(() => {
        if (cancelled) return;
        setEnhancedGames([]);
        setError(true);
        setLoading(false);
      });
    } else {
      // Past/future dates: use schedule + dailyScores + nextGames (for pitchers)
      const month = selectedDate.getMonth() + 1;
      const schedulePromise = scheduleCache.current?.month === month
        ? Promise.resolve(scheduleCache.current.games)
        : fetchScheduleByMonth(month).then((s) => {
            const games = s?.games || [];
            scheduleCache.current = { month, games };
            return games;
          });

      Promise.all([
        schedulePromise,
        fetchDailyScores(dateStr),
        fetchTodayGames(),
      ]).then(([scheduleGames, scoresData, todayData]) => {
        if (cancelled) return;
        const dayGames = scheduleGames.filter((g: ScheduleGame) => g.date === dateStr);
        const scoreEntries: ScoreEntry[] = scoresData?.games || [];
        const isFuture = dateStr > formatDateStr(new Date());

        // Build pitcher map from nextGames (API returns tomorrow's games with pitchers)
        const pitcherMap = new Map<string, { away?: string; home?: string }>();
        for (const ng of todayData?.nextGames ?? []) {
          pitcherMap.set(`${ng.away.id}-${ng.home.id}`, {
            away: ng.away.starter?.name !== "미정" ? ng.away.starter?.name : undefined,
            home: ng.home.starter?.name !== "미정" ? ng.home.starter?.name : undefined,
          });
        }

        const games: EnhancedGame[] = dayGames.map((g: ScheduleGame) => {
          const homeId = TEAM_NAME_TO_ID[g.home] || "";
          const awayId = TEAM_NAME_TO_ID[g.away] || "";
          const homeCode = TEAM_ID_TO_CODE[homeId] || "";
          const awayCode = TEAM_ID_TO_CODE[awayId] || "";
          const score = scoreEntries.find(
            (s) => s.home === g.home && s.away === g.away
          );
          const pitchers = pitcherMap.get(`${awayId}-${homeId}`);
          return {
            id: `${dateStr.replace(/-/g, "")}-${awayCode}${homeCode}-0`,
            homeTeam: homeId,
            awayTeam: awayId,
            time: g.time || "18:30",
            venue: g.venue || "",
            status: score && !isFuture ? "finished" : "scheduled",
            homeScore: score ? score.homeScore : undefined,
            awayScore: score ? score.awayScore : undefined,
            homePitcher: pitchers?.home,
            awayPitcher: pitchers?.away,
            winPitcher: score?.winPitcher,
            losePitcher: score?.losePitcher,
            cancelled: score?.cancelled,
          };
        });
        setEnhancedGames(games);

        // Fallback: fetch game-detail for live games and missing pitcher data
        const gamesNeedingDetail = games.filter(
          (g) => g.status === "live" || !g.homePitcher || !g.awayPitcher
        );
        if (gamesNeedingDetail.length > 0) {
          Promise.all(
            gamesNeedingDetail.map((g) => fetchGameDetail(g.id).catch(() => null))
          ).then((results) => {
            if (cancelled) return;
            const updated = games.map((g) => {
              const detail = results.find((r) => r?.gameId === g.id);
              if (!detail) return g;

              let liveInning = g.liveInning;
              let isTop = g.isTop;
              if (g.status === "live" && detail.scoreBoard?.inn && liveInning == null) {
                const inn = detail.scoreBoard.inn;
                const aLen = inn.away?.length ?? 0;
                const hLen = inn.home?.length ?? 0;
                if (aLen > hLen) {
                  liveInning = aLen;
                  isTop = true;
                } else if (hLen > 0) {
                  liveInning = aLen;
                  isTop = false;
                }
              }

              return {
                ...g,
                liveInning,
                isTop,
                homePitcher: g.homePitcher || (detail.starters?.home?.name || undefined),
                awayPitcher: g.awayPitcher || (detail.starters?.away?.name || undefined),
              };
            });
            setEnhancedGames(updated);
          }).catch(() => {});
        }

        setLoading(false);
      }).catch(() => {
        if (cancelled) return;
        setEnhancedGames([]);
        setError(true);
        setLoading(false);
      });
    }

    return () => { cancelled = true; };
  }, [selectedDate]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      {/* Mobile header */}
      <div className="md:hidden px-5 pt-6 pb-2">
        <h1 className="text-2xl font-bold tracking-tight">⚾ fullcount.kr</h1>
        <p className="text-sm text-muted-foreground mt-1">
          오늘의 야구, 라인업부터 응원가까지
        </p>
      </div>

      {/* Week label + date slider */}
      <div className="sticky top-0 md:top-16 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto">
          <div className="px-5 pt-2 pb-0">
            <span className="text-xs text-muted-foreground font-medium">
              {isToday(selectedDate) ? "오늘" : getWeekLabel(selectedDate)}
            </span>
          </div>
          <DateSelector
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
          />
        </div>
      </div>

      {/* Game cards */}
      <div className="max-w-lg mx-auto px-4 mt-4">
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorRetry onRetry={load} />
        ) : enhancedGames.length > 0 ? (
          <div className="flex flex-col gap-3">
            {enhancedGames.map((game) => {
              const homeColor = TEAM_COLORS[game.homeTeam]?.primary;
              const awayColor = TEAM_COLORS[game.awayTeam]?.primary;

              return (
                <GameCard
                  key={game.id}
                  homeTeam={game.homeTeam}
                  awayTeam={game.awayTeam}
                  time={game.time}
                  stadium={game.venue}
                  status={game.status}
                  homeScore={game.homeScore}
                  awayScore={game.awayScore}
                  homePitcher={game.homePitcher}
                  awayPitcher={game.awayPitcher}
                  winPitcher={game.winPitcher}
                  losePitcher={game.losePitcher}
                  cancelled={game.cancelled}
                  liveInning={game.liveInning}
                  isTop={game.isTop}
                  onClick={() => setLocation(`/game/${game.id}`)}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground text-sm">
              이 날에는 경기가 없어요
            </p>
          </div>
        )}

        {/* Hint */}
        {enhancedGames.length > 0 && (
          <p className="text-center text-xs text-muted-foreground mt-6 mb-4">
            카드를 누르면 선발 라인업을 확인할 수 있어요
          </p>
        )}
      </div>
    </div>
  );
}
