import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import DateSelector from "@/components/DateSelector";
import GameCard from "@/components/GameCard";
import { fetchGames, fetchTodayGames, fetchDailyScores, fetchScheduleByMonth, type GameData, type TodayGame, type ScoreEntry } from "@/lib/api";
import { TEAM_COLORS } from "@/lib/teamColors";

const TEAM_NAME_TO_ID: Record<string, string> = {
  "KT": "kt", "LG": "lg", "삼성": "samsung", "SSG": "ssg",
  "KIA": "kia", "두산": "doosan", "한화": "hanwha", "NC": "nc",
  "롯데": "lotte", "키움": "kiwoom",
};

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
}

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [, setLocation] = useLocation();
  const [enhancedGames, setEnhancedGames] = useState<EnhancedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const scheduleCache = useRef<{ month: number; games: any[] } | null>(null);

  useEffect(() => {
    const dateStr = formatDateStr(selectedDate);
    setLoading(true);

    const todayView = isToday(selectedDate);

    if (todayView) {
      // Today: use today-games (has starters) + dailyScores (has win/loss)
      Promise.all([
        fetchTodayGames(),
        fetchDailyScores(dateStr),
      ]).then(([gamesData, scoresData]) => {
        const scoreEntries: ScoreEntry[] = scoresData?.games || [];
        if (gamesData?.games) {
          const games: EnhancedGame[] = gamesData.games.map((g: TodayGame) => {
            const score = scoreEntries.find(
              (s) => s.away === TEAM_COLORS[g.away.id]?.shortName && s.home === TEAM_COLORS[g.home.id]?.shortName
            );
            return {
              id: g.id,
              homeTeam: g.home.id,
              awayTeam: g.away.id,
              time: g.time || "18:30",
              venue: g.venue || "",
              status: (g.status as "scheduled" | "live" | "finished") || "scheduled",
              homeScore: g.score?.home ?? score?.homeScore,
              awayScore: g.score?.away ?? score?.awayScore,
              homePitcher: g.home.starter?.name,
              awayPitcher: g.away.starter?.name,
              winPitcher: score?.winPitcher,
              losePitcher: score?.losePitcher,
              cancelled: score?.cancelled,
            };
          });
          setEnhancedGames(games);
        } else {
          setEnhancedGames([]);
        }
        setLoading(false);
      }).catch(() => {
        setEnhancedGames([]);
        setLoading(false);
      });
    } else {
      // Past/future dates: use schedule + dailyScores
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
      ]).then(([scheduleGames, scoresData]) => {
        const dayGames = scheduleGames.filter((g: any) => g.date === dateStr);
        const scoreEntries: ScoreEntry[] = scoresData?.games || [];

        const games: EnhancedGame[] = dayGames.map((g: any) => {
          const homeId = TEAM_NAME_TO_ID[g.home] || "";
          const awayId = TEAM_NAME_TO_ID[g.away] || "";
          const score = scoreEntries.find(
            (s) => s.home === g.home && s.away === g.away
          );
          return {
            id: `${dateStr.replace(/-/g, "")}-${awayId}-${homeId}`,
            homeTeam: homeId,
            awayTeam: awayId,
            time: g.time || "18:30",
            venue: g.venue || "",
            status: score ? "finished" : (g.status || "scheduled"),
            homeScore: score ? score.homeScore : undefined,
            awayScore: score ? score.awayScore : undefined,
            winPitcher: score?.winPitcher,
            losePitcher: score?.losePitcher,
            cancelled: score?.cancelled,
          };
        });
        setEnhancedGames(games);
        setLoading(false);
      }).catch(() => {
        setEnhancedGames([]);
        setLoading(false);
      });
    }
  }, [selectedDate]);

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      {/* Mobile header */}
      <div className="md:hidden px-5 pt-6 pb-2">
        <h1 className="text-2xl font-bold tracking-tight">fullcount.kr</h1>
        <p className="text-sm text-muted-foreground mt-1">
          구단별 라인업, 구장 먹거리, 응원가까지
        </p>
      </div>

      {/* Week label + date slider */}
      <div className="sticky top-0 md:top-16 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto">
          <div className="px-5 pt-2 pb-0">
            <span className="text-xs text-muted-foreground font-medium">
              {getWeekLabel(selectedDate)}
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
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
          </div>
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
                  onClick={() => setLocation(`/game/${game.id}`)}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground text-sm">
              이 날짜에 예정된 경기가 없습니다
            </p>
          </div>
        )}

        {/* Hint */}
        {enhancedGames.length > 0 && (
          <p className="text-center text-xs text-muted-foreground mt-6 mb-4">
            카드를 누르면 라인업을 확인할 수 있습니다
          </p>
        )}
      </div>
    </div>
  );
}
