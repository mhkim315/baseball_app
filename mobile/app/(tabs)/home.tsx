import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, LayoutAnimation, Platform, UIManager } from "react-native";
import { useRouter } from "expo-router";
import DateStrip from "@/components/DateStrip";
import GameCard from "@/components/GameCard";
import TeamExpander from "@/components/TeamExpander";
import CalendarGrid from "@/components/CalendarGrid";
import {
  fetchTodayGames,
  fetchDailyScores,
  fetchScheduleByMonth,
  fetchGameDetail,
  fetchAllDailyScores,
  type TodayGame,
  type ScoreEntry,
  type ScheduleGame,
} from "@/lib/api";
import { TEAM_COLORS, TEAM_LIST } from "@shared/teamColors";
import { TEAM_NAME_TO_ID, TEAM_ID_TO_CODE } from "@shared/constants";
import { getMyTeam } from "@/lib/db";
import { theme } from "@/lib/theme";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function formatDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
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

export default function HomeScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [games, setGames] = useState<EnhancedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [myTeam, setMyTeamState] = useState<string | null>(null);
  const [displayTeam, setDisplayTeam] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calGames, setCalGames] = useState<ScheduleGame[]>([]);
  const [calScores, setCalScores] = useState<Record<string, { away: string; home: string; awayScore: number; homeScore: number; outcome?: string | null; cancelled?: boolean }[]>>({});
  const scheduleCache = useRef<{ month: number; games: ScheduleGame[] } | null>(null);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const calCache = useRef<Record<number, { games: ScheduleGame[]; scores: Record<string, any[]> }>>({});

  useEffect(() => {
    getMyTeam().then(setMyTeamState);
  }, []);

  // Preload current month + adjacent months on mount
  useEffect(() => {
    const current = new Date().getMonth() + 1;
    const fetchAndCache = (month: number) => {
      if (month < 1 || month > 12) return Promise.resolve();
      return Promise.all([
        fetchScheduleByMonth(month),
        fetchAllDailyScores(),
      ]).then(([schedule, scores]) => {
        const data = { games: schedule?.games || [], scores: scores?.dates || {} };
        calCache.current[month] = data;
        if (month === current) {
          setCalGames(data.games);
          setCalScores(data.scores);
        }
      }).catch(() => {});
    };
    fetchAndCache(current);
    fetchAndCache(current - 1);
    fetchAndCache(current + 1);
  }, []);

  const activeTeam = displayTeam || myTeam;

  const load = useCallback(() => {
    const dateStr = formatDateStr(selectedDate);
    setLoading(true);
    setError(false);
    let cancelled = false;

    const todayView = isToday(selectedDate);

    if (todayView) {
      Promise.all([
        fetchTodayGames(),
        fetchDailyScores(dateStr),
      ]).then(([gamesData, scoresData]) => {
        if (cancelled) return;
        const scoreEntries: ScoreEntry[] = scoresData?.games || [];
        if (gamesData?.games) {
          const apiGames = gamesData.date === dateStr
            ? gamesData.games
            : (gamesData.nextGames?.filter((g) => g.date === dateStr) ?? []);
          const enhanced: EnhancedGame[] = apiGames.map((g: TodayGame) => {
            const score = scoreEntries.find(
              (s) => s.away === TEAM_COLORS[g.away.id]?.shortName && s.home === TEAM_COLORS[g.home.id]?.shortName
            );
            const rawStatus = g.status as "scheduled" | "live" | "finished";
            const [h, m] = (g.time || "18:30").split(":").map(Number);
            const startTime = new Date(selectedDate);
            startTime.setHours(h, m, 0, 0);
            const hasStarted = new Date() >= startTime;
            const gameStatus = rawStatus === "scheduled" && g.score != null && todayView && hasStarted ? "live" : rawStatus || "scheduled";
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
            };
          });
          setGames(enhanced);
        } else {
          setGames([]);
        }
        setLoading(false);
      }).catch(() => {
        if (cancelled) return;
        setGames([]);
        setLoading(false);
      });
    } else {
      const month = selectedDate.getMonth() + 1;
      const schedulePromise = scheduleCache.current?.month === month
        ? Promise.resolve(scheduleCache.current.games)
        : fetchScheduleByMonth(month).then((s) => {
            const gamesList = s?.games || [];
            scheduleCache.current = { month, games: gamesList };
            return gamesList;
          });

      Promise.all([
        schedulePromise,
        fetchDailyScores(dateStr).catch(() => null),
        fetchTodayGames().catch(() => null),
      ]).then(([scheduleGames, scoresData, todayData]) => {
        if (cancelled) return;
        const dayGames = scheduleGames.filter((g: ScheduleGame) => g.date === dateStr);
        const scoreEntries: ScoreEntry[] = scoresData?.games || [];
        const isFuture = dateStr > formatDateStr(new Date());
        const tomorrowDate = new Date();
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrowStr = formatDateStr(tomorrowDate);
        const isTomorrow = dateStr === tomorrowStr;

        const pitcherMap = new Map<string, { away?: string; home?: string }>();
        const gameIdMap = new Map<string, string>();
        if (isTomorrow) {
          for (const ng of todayData?.nextGames ?? []) {
            const key = `${ng.date}-${ng.away.id}-${ng.home.id}`;
            pitcherMap.set(key, {
              away: ng.away.starter?.name !== "미정" ? ng.away.starter?.name : undefined,
              home: ng.home.starter?.name !== "미정" ? ng.home.starter?.name : undefined,
            });
            gameIdMap.set(key, ng.id);
          }
        }

        const enhanced: EnhancedGame[] = dayGames.map((g: ScheduleGame) => {
          const homeId = TEAM_NAME_TO_ID[g.home] || "";
          const awayId = TEAM_NAME_TO_ID[g.away] || "";
          const homeCode = TEAM_ID_TO_CODE[homeId] || "";
          const awayCode = TEAM_ID_TO_CODE[awayId] || "";
          const score = scoreEntries.find(
            (s) => s.home === g.home && s.away === g.away
          );
          const gameKey = `${dateStr}-${awayId}-${homeId}`;
          const pitchers = pitcherMap.get(gameKey);
          const apiGameId = gameIdMap.get(gameKey);
          return {
            id: apiGameId || `${dateStr.replace(/-/g, "")}-${awayCode}${homeCode}-0`,
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
        setGames(enhanced);

        // Fallback: fetch game-detail for missing pitchers
        const gamesNeedingPitchers = enhanced.filter((g) => !isFuture && (!g.homePitcher || !g.awayPitcher));
        if (gamesNeedingPitchers.length > 0) {
          Promise.all(
            gamesNeedingPitchers.map((g) => fetchGameDetail(g.id).catch(() => null))
          ).then((results) => {
            if (cancelled) return;
            setGames((prev) =>
              prev.map((g) => {
                const detail = results.find((r) => r?.gameId === g.id);
                if (!detail?.starters) return g;
                return {
                  ...g,
                  homePitcher: g.homePitcher || (detail.starters?.home?.name || undefined),
                  awayPitcher: g.awayPitcher || (detail.starters?.away?.name || undefined),
                };
              })
            );
          }).catch(() => {});
        }

        setLoading(false);
      }).catch(() => {
        if (cancelled) return;
        setGames([]);
        setLoading(false);
      });
    }

    return () => { cancelled = true; };
  }, [selectedDate]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  // Fetch calendar data when opened or month changes (cache + preload adjacent)
  useEffect(() => {
    if (!calendarOpen) return;
    let cancelled = false;
    const month = calMonth + 1;

    // Restore from cache if available
    const cached = calCache.current[month];
    if (cached) {
      setCalGames(cached.games);
      setCalScores(cached.scores);
    }

    // Fetch this month (will update if cache exists)
    Promise.all([
      fetchScheduleByMonth(month),
      fetchAllDailyScores(),
    ]).then(([schedule, scores]) => {
      if (cancelled) return;
      const games = schedule?.games || [];
      const sc = scores?.dates || {};
      calCache.current[month] = { games, scores: sc };
      setCalGames(games);
      setCalScores(sc);
      // Preload adjacent months in background
      for (const adj of [month - 1, month + 1]) {
        if (adj >= 1 && adj <= 12 && !calCache.current[adj]) {
          Promise.all([
            fetchScheduleByMonth(adj),
            fetchAllDailyScores(),
          ]).then(([s, sc2]) => {
            calCache.current[adj] = { games: s?.games || [], scores: sc2?.dates || {} };
          }).catch(() => {});
        }
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [calendarOpen, calMonth]);

  // Sort: my team games first
  const sortedGames = [...games].sort((a, b) => {
    if (activeTeam) {
      const aIsMyTeam = a.homeTeam === activeTeam || a.awayTeam === activeTeam ? 0 : 1;
      const bIsMyTeam = b.homeTeam === activeTeam || b.awayTeam === activeTeam ? 0 : 1;
      if (aIsMyTeam !== bIsMyTeam) return aIsMyTeam - bIsMyTeam;
    }
    return 0;
  });

  const renderGame = ({ item }: { item: EnhancedGame }) => {
    const isMyTeamGame = activeTeam && (item.homeTeam === activeTeam || item.awayTeam === activeTeam);
    return (
      <GameCard
        homeTeam={item.homeTeam}
        awayTeam={item.awayTeam}
        time={item.time}
        stadium={item.venue}
        status={item.status}
        homeScore={item.homeScore}
        awayScore={item.awayScore}
        homePitcher={item.homePitcher}
        awayPitcher={item.awayPitcher}
        winPitcher={item.winPitcher}
        losePitcher={item.losePitcher}
        cancelled={item.cancelled}
        highlighted={isMyTeamGame ? TEAM_COLORS[activeTeam]?.primary : undefined}
        dense={!isMyTeamGame}
        onClick={() => router.push(`/game/${item.id}?ap=${encodeURIComponent(item.awayPitcher || "")}&hp=${encodeURIComponent(item.homePitcher || "")}`)}
      />
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>이 날에는 경기가 없어요</Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.errorText}>데이터를 불러올 수 없습니다</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.logoRow}>
            <Text style={styles.logoIcon}>⚾</Text>
            <Text style={styles.title}>풀카운트</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable onPress={() => router.push("/my")} style={styles.myBtn} hitSlop={8}>
              <Text style={styles.myBtnText}>MY</Text>
            </Pressable>
            {myTeam && (
              <TeamExpander
                currentTeamId={activeTeam || myTeam}
                onSelectTeam={setDisplayTeam}
              />
            )}
          </View>
        </View>
      </View>

      {/* Date strip */}
      <DateStrip
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        teamColor={activeTeam ? TEAM_COLORS[activeTeam]?.primary : undefined}
      />

      {/* Calendar toggle */}
      <Pressable style={styles.calToggle} onPress={() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCalendarOpen(!calendarOpen);
      }}>
        <Text style={styles.calToggleText}>
          {calendarOpen ? "캘린더 접기 ▲" : "캘린더 보기 ▼"}
        </Text>
      </Pressable>
      <View style={[styles.calWrapper, calendarOpen ? styles.calWrapperOpen : styles.calWrapperHidden]}>
        <CalendarGrid
          year={calYear}
          month={calMonth}
          games={calGames}
          scores={calScores}
          loading={false}
          selectedTeam={activeTeam}
          onSelectDate={(d) => { setSelectedDate(d); setCalendarOpen(false); }}
          onMonthChange={(y, m) => { setCalYear(y); setCalMonth(m); }}
        />
      </View>

      {/* Game list */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={error ? [] : sortedGames}
          renderItem={renderGame}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={error ? renderError : renderEmpty}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  myBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.foreground,
  },
  myBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.background,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoIcon: {
    fontSize: 22,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.foreground,
  },
  subtitle: {
    fontSize: 13,
    color: theme.mutedForeground,
    marginTop: 4,
  },
  calToggle: {
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  calToggleText: {
    fontSize: 12,
    color: theme.mutedForeground,
  },
  calWrapper: {
    overflow: "hidden",
  },
  calWrapperOpen: {
    maxHeight: 500,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  calWrapperHidden: {
    maxHeight: 0,
    paddingBottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  emptyText: {
    color: theme.mutedForeground,
    fontSize: 14,
  },
  errorText: {
    color: theme.destructive,
    fontSize: 14,
  },
});
