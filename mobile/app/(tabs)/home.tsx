import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { View, Text, Image, ScrollView, FlatList, StyleSheet, ActivityIndicator, Pressable, PanResponder, LayoutAnimation, Platform, UIManager, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent } from "react-native";

import { useRouter, useFocusEffect } from "expo-router";
import DateStrip from "@/components/DateStrip";
import GameCard from "@/components/GameCard";
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
import { TEAM_NAME_TO_ID, buildGameId, formatDateForApi as formatDateStr } from "@shared/constants";
import { getMyTeam } from "@/lib/db";
import SettingsButton from "@/components/SettingsButton";
import { useTheme, teamPrimaryColor } from "@/lib/ThemeContext";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
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
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      paddingTop: 60,
      paddingHorizontal: 20,
      paddingBottom: 12,
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
  }), [theme]);
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [gamesByDate, setGamesByDate] = useState<Record<string, EnhancedGame[]>>({});
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
  const { width: screenWidth } = useWindowDimensions();
  const pageScrollRef = useRef<ScrollView>(null);

  // 3-date window for ScrollView paging
  const getDateWindow = useCallback((date: Date) => {
    const prev = new Date(date);
    prev.setDate(prev.getDate() - 1);
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    return [prev, date, next].map(d => formatDateStr(d));
  }, []);

  // Swipe for calendar: down to open, up to close
  const calendarOpenRef = useRef(calendarOpen);
  calendarOpenRef.current = calendarOpen;
  const calendarPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 10,
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -80 && calendarOpenRef.current) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setCalendarOpen(false);
        } else if (gs.dy > 80 && !calendarOpenRef.current) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setCalendarOpen(true);
        }
      },
    })
  ).current;

  useFocusEffect(
    useCallback(() => {
      getMyTeam().then(setMyTeamState);
    }, [])
  );

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

  const load = useCallback(() => {
    const dates = getDateWindow(selectedDate);
    setLoading(true);
    setError(false);
    let cancelled = false;

    const month = selectedDate.getMonth() + 1;
    const schedulePromise = scheduleCache.current?.month === month
      ? Promise.resolve(scheduleCache.current.games)
      : fetchScheduleByMonth(month).then((s) => {
          const gamesList = s?.games || [];
          scheduleCache.current = { month, games: gamesList };
          return gamesList;
        });

    const scorePromises = dates.map((ds) => fetchDailyScores(ds).catch(() => null));
    const todayPromise = fetchTodayGames().catch(() => null);
    const todayStr = formatDateStr(new Date());

    Promise.all([schedulePromise, ...scorePromises, todayPromise])
      .then(([scheduleGames, ...rest]: [unknown, ...unknown[]]) => {
        if (cancelled) return;
        const scoresList = rest.slice(0, 3) as ({ games: ScoreEntry[] } | null)[];
        const todayData = rest[3] as { games: TodayGame[]; nextGames?: TodayGame[] } | null;
        const schedule = scheduleGames as ScheduleGame[];

        const result: Record<string, EnhancedGame[]> = {};
        for (let i = 0; i < 3; i++) {
          const ds = dates[i];
          const dayGames = schedule.filter((g) => g.date === ds);
          const scoreEntries: ScoreEntry[] = scoresList[i]?.games || [];
          const isFuture = ds > todayStr;
          const isToday = ds === todayStr;

          // Pitcher map from todayGames (today) or nextGames (tomorrow)
          const pitcherMap = new Map<string, { away?: string; home?: string }>();
          const gameIdMap = new Map<string, string>();
          if (isToday && todayData?.games) {
            for (const g of todayData.games) {
              const key = `${ds}-${g.away.id}-${g.home.id}`;
              pitcherMap.set(key, {
                away: g.away.starter?.name !== "미정" ? g.away.starter?.name : undefined,
                home: g.home.starter?.name !== "미정" ? g.home.starter?.name : undefined,
              });
              gameIdMap.set(key, g.id);
            }
          } else {
            const tomorrowStr = formatDateStr(new Date(Date.now() + 86400000));
            if (ds === tomorrowStr && todayData?.nextGames) {
              for (const ng of todayData.nextGames) {
                const key = `${ng.date}-${ng.away.id}-${ng.home.id}`;
                pitcherMap.set(key, {
                  away: ng.away.starter?.name !== "미정" ? ng.away.starter?.name : undefined,
                  home: ng.home.starter?.name !== "미정" ? ng.home.starter?.name : undefined,
                });
                gameIdMap.set(key, ng.id);
              }
            }
          }

          const enhanced: EnhancedGame[] = dayGames.map((g) => {
            const homeId = TEAM_NAME_TO_ID[g.home] || "";
            const awayId = TEAM_NAME_TO_ID[g.away] || "";
            const score = scoreEntries.find((s) => s.home === g.home && s.away === g.away);
            const gameKey = `${ds}-${awayId}-${homeId}`;
            const pitchers = pitcherMap.get(gameKey);
            const apiGameId = gameIdMap.get(gameKey);

            let status: "scheduled" | "live" | "finished" = "scheduled";
            if (score?.cancelled) {
              status = "finished";
            } else if (score && !isFuture) {
              status = "finished";
            } else if (isToday) {
              const [h, m] = (g.time || "18:30").split(":").map(Number);
              const startTime = new Date();
              startTime.setHours(h, m, 0, 0);
              if (new Date() >= startTime) status = "live";
            }

            return {
              id: apiGameId || buildGameId(awayId, homeId, ds.replace(/-/g, "")),
              homeTeam: homeId,
              awayTeam: awayId,
              time: g.time || "18:30",
              venue: g.venue || "",
              status,
              homeScore: score?.homeScore,
              awayScore: score?.awayScore,
              homePitcher: pitchers?.home,
              awayPitcher: pitchers?.away,
              winPitcher: score?.winPitcher,
              losePitcher: score?.losePitcher,
              cancelled: score?.cancelled,
            };
          });

          // Fallback: fetch game-detail for missing pitchers
          const gamesNeedingPitchers = enhanced.filter(
            (g) => !isFuture && (!g.homePitcher || !g.awayPitcher)
          );
          if (gamesNeedingPitchers.length > 0) {
            Promise.all(
              gamesNeedingPitchers.map((g) => fetchGameDetail(g.id).catch(() => null))
            ).then((results) => {
              if (cancelled) return;
              setGamesByDate((prev) => ({
                ...prev,
                [ds]: (prev[ds] || []).map((g) => {
                  const detail = results.find((r) => r?.gameId === g.id);
                  if (!detail?.starters) return g;
                  return {
                    ...g,
                    homePitcher:
                      g.homePitcher || (detail.starters?.home?.name || undefined),
                    awayPitcher:
                      g.awayPitcher || (detail.starters?.away?.name || undefined),
                  };
                }),
              }));
            }).catch(() => {});
          }

          result[ds] = enhanced;
        }
        setGamesByDate(result);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });

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

  // 3-date paging handlers
  const dateStrs = useMemo(() => getDateWindow(selectedDate), [selectedDate, getDateWindow]);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
      if (page === 0) {
        setSelectedDate((prev) => {
          const d = new Date(prev);
          d.setDate(d.getDate() - 1);
          return d;
        });
      } else if (page === 2) {
        setSelectedDate((prev) => {
          const d = new Date(prev);
          d.setDate(d.getDate() + 1);
          return d;
        });
      }
    },
    [screenWidth]
  );

  // Reset scroll to center page when selectedDate changes
  useEffect(() => {
    const id = setTimeout(() => {
      if (screenWidth > 0) {
        pageScrollRef.current?.scrollTo({ x: screenWidth, animated: false });
      }
    }, 50);
    return () => clearTimeout(id);
  }, [selectedDate, screenWidth]);

  const sortGames = useCallback(
    (games: EnhancedGame[]) => {
      return [...games].sort((a, b) => {
        if (myTeam) {
          const aIsMyTeam = (a.homeTeam === myTeam || a.awayTeam === myTeam) ? 0 : 1;
          const bIsMyTeam = (b.homeTeam === myTeam || b.awayTeam === myTeam) ? 0 : 1;
          if (aIsMyTeam !== bIsMyTeam) return aIsMyTeam - bIsMyTeam;
        }
        return 0;
      });
    },
    [myTeam]
  );

  const renderGame = ({ item }: { item: EnhancedGame }) => {
    const isMyTeamGame = myTeam && (item.homeTeam === myTeam || item.awayTeam === myTeam);
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
        highlighted={isMyTeamGame ? teamPrimaryColor(myTeam, isDark) : undefined}
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
      <View style={[styles.header, { flexDirection: "row", alignItems: "center" }]}>
        <View style={styles.logoRow}>
          <Image source={require("../../assets/logo-icon.png")} style={{ width: 28, height: 28, borderRadius: 7 }} />
          <Text style={styles.title}>풀카운트</Text>
        </View>
        <View style={{ flex: 1 }} />
        <SettingsButton color={myTeam ? teamPrimaryColor(myTeam, isDark) : undefined} />
      </View>

      {/* Date strip */}
      <DateStrip
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        teamColor={myTeam ? teamPrimaryColor(myTeam, isDark) : undefined}
      />

      {/* Calendar toggle + content — pan wraps both for open/close swipe */}
      <View {...calendarPan.panHandlers}>
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
          selectedTeam={displayTeam || myTeam}
          myTeam={myTeam}
          onSelectDate={(d) => { setSelectedDate(d); setCalendarOpen(false); }}
          onMonthChange={(y, m) => { setCalYear(y); setCalMonth(m); }}
          onTeamChange={setDisplayTeam}
        />
      </View>
      </View>

      {/* Game list — horizontal paging scroll */}
      <View style={{ flex: 1 }}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView
          ref={pageScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          style={{ flex: 1 }}
        >
          {dateStrs.map((ds) => {
            const pageGames = sortGames(gamesByDate[ds] || []);
            const empty = pageGames.length === 0 && !error;
            return (
              <View key={ds} style={{ width: screenWidth, flex: 1 }}>
                {error ? renderError() : empty ? renderEmpty() : (
                  <FlatList
                    data={pageGames}
                    renderItem={renderGame}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                  />
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
      </View>
    </View>
  );
}

