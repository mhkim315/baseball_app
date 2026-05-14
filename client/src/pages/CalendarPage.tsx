import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TEAM_COLORS, TEAM_LIST } from "@/lib/teamColors";
import { fetchScheduleByMonth, fetchAllDailyScores, type ScheduleGame } from "@/lib/api";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorRetry } from "@/components/ErrorRetry";
import { TEAM_NAME_TO_ID, TEAM_ID_TO_CODE } from "@shared/constants";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

interface ScoreInfo {
  away: string;
  home: string;
  awayScore: number;
  homeScore: number;
  outcome: string | null;
  cancelled: boolean;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function teamShortName(teamId: string): string {
  return TEAM_LIST.find((t) => t.id === teamId)?.shortName || "";
}

export default function CalendarPage() {
  const [, setLocation] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTeam, setSelectedTeam] = useState<string>(() => {
    try {
      return localStorage.getItem("cal-team") || TEAM_LIST[0]?.id || "doosan";
    } catch {
      return TEAM_LIST[0]?.id || "doosan";
    }
  });
  const [games, setGames] = useState<ScheduleGame[]>([]);
  const [scoresByDate, setScoresByDate] = useState<Record<string, ScoreInfo[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([
      fetchScheduleByMonth(month + 1),
      fetchAllDailyScores(),
    ]).then(([schedule, allScores]) => {
      if (schedule) setGames(schedule.games);
      if (allScores) {
        const mapped: Record<string, ScoreInfo[]> = {};
        for (const [date, dateScores] of Object.entries(allScores.dates)) {
          mapped[date] = dateScores;
        }
        setScoresByDate(mapped);
      }
      if (!schedule && !allScores) setError(true);
      setLoading(false);
    }).catch(() => {
      setError(true);
      setLoading(false);
    });
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const teamName = useMemo(() => teamShortName(selectedTeam), [selectedTeam]);
  const teamColor = TEAM_COLORS[selectedTeam];

  // Filter games by selected team
  const filteredGames = useMemo(() => {
    if (!teamName) return [];
    return games.filter((g) => g.away === teamName || g.home === teamName);
  }, [games, teamName]);

  // Group filtered games by date
  const gamesByDate = useMemo(() => {
    const map = new Map<string, ScheduleGame[]>();
    for (const game of filteredGames) {
      const bucket = map.get(game.date) || [];
      bucket.push(game);
      map.set(game.date, bucket);
    }
    return map;
  }, [filteredGames]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();

  const goToPrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      {/* Header */}
      <div className="md:hidden px-5 pt-6 pb-4">
        <h1 className="text-xl font-bold">일정</h1>
        <p className="text-sm text-muted-foreground mt-0.5">구단을 선택하면 해당 팀 경기만 볼 수 있어요</p>
      </div>

      {/* Team filter (no "전체" button) */}
      <div className="max-w-lg mx-auto px-4">
        <div className="grid grid-cols-5 gap-2">
          {TEAM_LIST.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setSelectedTeam(t.id);
                localStorage.setItem("cal-team", t.id);
              }}
              className={`px-2 py-2 rounded-lg text-sm font-medium transition-all border text-center ${
                selectedTeam === t.id
                  ? "text-white border-transparent shadow-sm"
                  : "text-foreground border-border bg-card hover:bg-accent"
              }`}
              style={selectedTeam === t.id ? { backgroundColor: t.primary, borderColor: t.primary } : undefined}
            >
              {t.shortName}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-2 md:mt-6">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={goToPrevMonth} className="p-2 rounded-full hover:bg-accent transition-colors">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-bold">{year}년 {month + 1}월</h2>
          <button onClick={goToNextMonth} className="p-2 rounded-full hover:bg-accent transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: teamColor?.primary }} />
            홈경기
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
            승
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-400" />
            패
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
            무
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="text-[9px] font-bold bg-accent px-1 rounded">DH</span>
            더블헤더
          </span>
        </div>

        {/* Loading / Error / Calendar */}
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorRetry onRetry={load} />
        ) : (
          <div className="bg-card rounded-2xl border border-border p-3">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map((day, i) => (
                <div key={day} className={`text-center text-xs font-medium py-1.5 ${
                  i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"
                }`}>
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {calendarDays.map((day, index) => {
                if (day === null) return <div key={`empty-${index}`} className="min-h-[72px]" />;

                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
                const dayGames = gamesByDate.get(dateStr) || [];
                const dayScores = scoresByDate[dateStr] || [];
                const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
                const isFuture = dateStr > todayStr;
                const isDH = dayGames.length > 1;
                const dayLabels: string[] = dayGames.map((game) => {
                  const s = dayScores.find((sc) => sc.away === game.away && sc.home === game.home);
                  if (!s || s.cancelled || s.awayScore == null || s.homeScore == null || (s.awayScore === 0 && s.homeScore === 0)) return "";
                  const homeWon = s.homeScore > s.awayScore;
                  const tied = s.homeScore === s.awayScore;
                  if (tied) return "무";
                  const isHome = game.home === teamName;
                  if ((isHome && homeWon) || (!isHome && !homeWon)) return "승";
                  return "패";
                });
                const hasWin = dayLabels.includes("승");
                const hasLoss = dayLabels.includes("패");
                const dayBg = hasWin && !hasLoss ? "bg-blue-500/10" : hasLoss && !hasWin ? "bg-red-400/10" : "";
                const hasHome = dayGames.some((game) => game.home === teamName);

                const isClickable = !isFuture && dayGames.length > 0;

                return (
                  <div
                    key={day}
                    className={`min-h-[72px] rounded-lg p-1 text-xs transition-colors ${
                      isToday ? "bg-foreground/10 ring-1 ring-foreground/20" : ""
                    } ${
                      !isToday && dayGames.length > 0 ? "hover:bg-accent" : ""
                    } ${isClickable ? "cursor-pointer" : ""}`}
                    onClick={isClickable ? () => {
                      const game = dayGames[0];
                      const homeId = TEAM_NAME_TO_ID[game.home];
                      const awayId = TEAM_NAME_TO_ID[game.away];
                      const homeCode = TEAM_ID_TO_CODE[homeId || ""];
                      const awayCode = TEAM_ID_TO_CODE[awayId || ""];
                      if (homeCode && awayCode) {
                        setLocation(`/game/${dateStr.replace(/-/g, "")}-${awayCode}${homeCode}-0`);
                      }
                    } : undefined}
                  >
                    <div className={`rounded-xl border border-border ${dayBg || "bg-card"}`} style={hasHome && teamColor ? { borderLeft: `3px solid ${teamColor.primary}` } : undefined}>
                    {/* Day number */}
                    <div className={`flex items-center text-[11px] font-medium mb-0.5 ${
                      isToday ? "text-foreground font-bold" : dayGames.length > 0 ? "" : "text-muted-foreground/50"
                    }`}>
                      <span className="flex-1 text-center">{day}</span>
                      <div className="flex items-center gap-0.5">
                        {dayLabels.map((label, i) => label ? (
                          <span
                            key={i}
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: label === "승" ? "#3b82f6" : label === "패" ? "#ef4444" : "#f59e0b" }}
                          >
                            {label}
                          </span>
                        ) : null)}
                        {isDH && (
                          <span className="text-[8px] font-bold text-muted-foreground bg-accent rounded px-0.5">DH</span>
                        )}
                      </div>
                    </div>

                    {/* Games */}
                    <div className="flex flex-col gap-0.5">
                      {dayGames.map((game, gi) => {
                        const isHome = game.home === teamName;
                        const opponent = isHome ? game.away : game.home;
                        const isDh = dayGames.length > 1;

                        // Find score for this matchup
                        const score = dayScores.find(
                          (s) => s.away === game.away && s.home === game.home
                        );

                        let resultLabel = "";
                        let resultScore = "";
                        let resultBgClass = "";
                        let resultCancelled = false;

                        if (score?.cancelled) {
                          resultCancelled = true;
                          resultScore = "취소";
                          resultBgClass = "line-through text-muted-foreground";
                        } else if (score && score.awayScore != null && score.homeScore != null && !(score.awayScore === 0 && score.homeScore === 0)) {
                          const homeWon = score.homeScore > score.awayScore;
                          const tied = score.homeScore === score.awayScore;
                          resultScore = `${score.awayScore}:${score.homeScore}`;
                          if (tied) {
                            resultLabel = "무";
                            resultBgClass = "bg-amber-400/20 text-amber-700";
                          } else if ((isHome && homeWon) || (!isHome && !homeWon)) {
                            resultLabel = "승";
                            resultBgClass = "bg-blue-500/15 text-blue-700";
                          } else {
                            resultLabel = "패";
                            resultBgClass = "bg-red-400/15 text-red-600";
                          }
                        }

                        const prefix = isDh ? `${gi + 1}차 ` : "";

                        return (
                          <div
                            key={gi}
                            className={`py-[2px] text-[11px] leading-tight text-center ${
                              isHome
                                ? "font-medium"
                                : "text-muted-foreground"
                            }`}
                            title={`${game.away} vs ${game.home} · ${game.venue}`}
                          >
                            <div className="truncate text-center">
                              {prefix}{opponent}
                            </div>
                            {resultScore ? (
                              <span className={`inline-block rounded px-1 py-[1px] font-medium ${resultBgClass}`}>
                                {resultScore}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60 truncate">
                                {game.venue}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
