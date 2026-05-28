import { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from "react";
import { View, Text, Image, ScrollView, FlatList, StyleSheet, ActivityIndicator, Pressable, PanResponder, LayoutAnimation, Platform, UIManager, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, AppState } from "react-native";

import { useRouter } from "expo-router";
import DateStrip from "@/components/DateStrip";
import GameCard from "@/components/GameCard";
import CalendarGrid from "@/components/CalendarGrid";
import AchievementWidget from "@/components/AchievementWidget";
import {
  type TodayGame,
  type ScoreEntry,
  type ScheduleGame,
  fetchGameDetail,
} from "@/lib/api";
import {
  cachedScheduleByMonth,
  cachedDailyScores,
  cachedAllDailyScores,
  cachedTodayGames,
} from "@/lib/gameCache";
import { resolveGames, resolveGamesForSchedule, type ResolvedGame } from "@/lib/resolveGames";
import { formatDateForApi as formatDateStr } from "@shared/constants";
import { getInningInfo } from "@shared/gameStatus";

import MyButton from "@/components/MyButton";
import { useTheme } from "@/lib/ThemeContext";
import { teamPrimaryColor } from "@shared/teamColors";
import { useTeam } from "@/lib/TeamContext";

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
    toggleWrapper: {
      overflow: "hidden",
    },
    toggleOpen: {
      maxHeight: 500,
    },
    toggleHidden: {
      maxHeight: 0,
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
  const [gamesByDate, setGamesByDate] = useState<Record<string, ResolvedGame[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [displayTeam, setDisplayTeam] = useState<string | null>(null);
  const { myTeam } = useTeam();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [achievementOpen, setAchievementOpen] = useState(false);
  const [calResolvedGames, setCalResolvedGames] = useState<ResolvedGame[]>([]);
  const scheduleCache = useRef<{ month: number; year: number; games: ScheduleGame[] } | null>(null);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const calCache = useRef<Record<string, ResolvedGame[]>>({});
  const MAX_CAL_CACHE_ENTRIES = 15;
  const pruneCalCache = (cache: Record<string, ResolvedGame[]>) => {
    const keys = Object.keys(cache);
    if (keys.length <= MAX_CAL_CACHE_ENTRIES) return;
    keys.sort().splice(0, keys.length - MAX_CAL_CACHE_ENTRIES).forEach((k) => delete cache[k]);
  };
  const { width: screenWidth } = useWindowDimensions();
  const pageScrollRef = useRef<ScrollView>(null);
  const hasEverLoaded = useRef(false);
  const lastActedPageRef = useRef(1);

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
          setAchievementOpen(false);
          setCalendarOpen(true);
        }
      },
    })
  ).current;

  // Swipe for achievement: down to open, up to close
  const achievementOpenRef = useRef(achievementOpen);
  achievementOpenRef.current = achievementOpen;
  const achievementPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 10,
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -80 && achievementOpenRef.current) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setAchievementOpen(false);
        } else if (gs.dy > 80 && !achievementOpenRef.current) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setCalendarOpen(false);
          setAchievementOpen(true);
        }
      },
    })
  ).current;

  // Preload current month + adjacent months on mount
  useEffect(() => {
    const current = new Date().getMonth() + 1;
    const preloadAll = async () => {
      const [allScores] = await Promise.all([
        cachedAllDailyScores(),
        cachedScheduleByMonth(current, new Date().getFullYear()),
        cachedScheduleByMonth(current - 1, new Date().getFullYear()).catch(() => null),
        cachedScheduleByMonth(current + 1, new Date().getFullYear()).catch(() => null),
      ]);

      const cy = new Date().getFullYear();
      const buildAndCache = async (month: number) => {
        if (month < 1 || month > 12) return;
        const schedule = await cachedScheduleByMonth(month, cy);
        const gamesList = schedule?.games || [];
        const myDates = [...new Set(gamesList.map((g) => g.date))];
        const scoresRecord: Record<string, any[]> = {};
        for (const date of myDates) {
          const games = allScores?.[date];
          if (games) scoresRecord[date] = games;
        }
        const resolved = resolveGamesForSchedule(gamesList, scoresRecord);
        calCache.current[`${cy}:${month}`] = resolved;
        pruneCalCache(calCache.current);
        if (month === current) {
          setCalResolvedGames(resolved);
        }
      };
      buildAndCache(current);
      buildAndCache(current - 1);
      buildAndCache(current + 1);
    };
    preloadAll();
  }, []);

  const load = useCallback(() => {
    const dates = getDateWindow(selectedDate);
    setError(false);
    let cancelled = false;

    const month = selectedDate.getMonth() + 1;
    const schedulePromise = (scheduleCache.current?.month === month && scheduleCache.current?.year === selectedDate.getFullYear())
      ? Promise.resolve(scheduleCache.current.games)
      : cachedScheduleByMonth(month, selectedDate.getFullYear()).then((s) => {
          const gamesList = s?.games || [];
          scheduleCache.current = { month, year: selectedDate.getFullYear(), games: gamesList };
          return gamesList;
        }).catch(() => [] as ScheduleGame[]);

    // When the date window spans multiple months, fetch adjacent month schedule too
    const dateMonths = new Set(dates.map((d) => parseInt(d.slice(5, 7), 10)));
    const adjMonths = [...dateMonths].filter((m) => m !== month);
    const adjSchedulePromise = adjMonths.length > 0
      ? Promise.all(adjMonths.map((m) =>
          cachedScheduleByMonth(m, selectedDate.getFullYear()).catch(() => null)
        )).then((results) => results.flatMap((r) => r?.games || []))
      : Promise.resolve([] as ScheduleGame[]);

    const scorePromises = dates.map((ds) => cachedDailyScores(ds).catch(() => null));
    const todayPromise = cachedTodayGames().catch(() => null);
    const todayStr = formatDateStr(new Date());

    Promise.all([schedulePromise, adjSchedulePromise, ...scorePromises, todayPromise])
      .then(([scheduleGames, adjGames, ...rest]: [unknown, unknown, ...unknown[]]) => {
        if (cancelled) return;
        const scoresList = rest.slice(0, 3) as ({ games: ScoreEntry[] } | null)[];
        const todayData = rest[3] as { games: TodayGame[]; nextGames?: TodayGame[] } | null;
        const schedule = [...(scheduleGames as ScheduleGame[]), ...(adjGames as ScheduleGame[])];

        const result: Record<string, ResolvedGame[]> = {};
        for (let i = 0; i < 3; i++) {
          const ds = dates[i];
          const scoreEntries: ScoreEntry[] = scoresList[i]?.games || [];
          const isFuture = ds > todayStr;
          const isToday = ds === todayStr;

          const todayGamesForDate = isToday ? todayData?.games : undefined;
          const nextGamesForDate = !isToday ? todayData?.nextGames : undefined;
          const resolved = resolveGames(schedule, scoreEntries, ds, {
            todayGames: todayGamesForDate,
            nextGames: nextGamesForDate,
          });

          // Fallback: fetch game-detail for live games and missing pitchers
          const gamesNeedingDetail = resolved.filter(
            (g) => !isFuture && !g.isExhibition && (g.status === "live" || !g.homePitcher || !g.awayPitcher)
          );
          if (gamesNeedingDetail.length > 0) {
            Promise.all(
              gamesNeedingDetail.map((g) => fetchGameDetail(g.gameId).catch(() => null))
            ).then((results) => {
              if (cancelled) return;
              setGamesByDate((prev) => ({
                ...prev,
                [ds]: (prev[ds] || []).map((g) => {
                  const detail = results.find((r) => r?.gameId === g.gameId);
                  if (!detail) return g;

                  let liveInning = g.liveInning;
                  let isTop = g.isTop;
                  if (g.status === "live" && liveInning == null) {
                    const info = getInningInfo(detail.scoreBoard?.inn);
                    if (info) { liveInning = info.inning; isTop = info.isTop; }
                  }

                  return {
                    ...g,
                    liveInning,
                    isTop,
                    homePitcher: g.homePitcher || (detail.starters?.home?.name || undefined),
                    awayPitcher: g.awayPitcher || (detail.starters?.away?.name || undefined),
                  };
                }),
              }));
            }).catch(() => {});
          }

          result[ds] = resolved;
        }
        setGamesByDate(result);
        hasEverLoaded.current = true;
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        if (!hasEverLoaded.current) setError(true);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedDate]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  // Fetch calendar data when opened or month/year changes (cache + preload adjacent)
  useEffect(() => {
    if (!calendarOpen) return;
    let cancelled = false;
    const month = calMonth + 1;
    const cacheKey = `${calYear}:${month}`;

    // Restore from cache if available
    const cached = calCache.current[cacheKey];
    if (cached) {
      setCalResolvedGames(cached);
    }

    // Fetch this month (will update if cache exists)
    cachedScheduleByMonth(month, calYear).then(async (schedule) => {
      if (cancelled) return;
      const gamesList = schedule?.games || [];
      const myDates = [...new Set(gamesList.map((g) => g.date))];
      const scoreResults = await Promise.all(
        myDates.map((d) => cachedDailyScores(d).catch((e) => { console.warn('cachedDailyScores failed for', d, e); return null; }))
      );
      if (cancelled) return;
      const scoresRecord: Record<string, any[]> = {};
      for (let i = 0; i < myDates.length; i++) {
        if (scoreResults[i]?.games) scoresRecord[myDates[i]] = scoreResults[i]!.games;
      }
      const resolved = resolveGamesForSchedule(gamesList, scoresRecord);
      calCache.current[cacheKey] = resolved;
      pruneCalCache(calCache.current);
      if (!cancelled) {
        setCalResolvedGames(resolved);
      }
      // Preload adjacent months in background (same year)
      for (const adj of [month - 1, month + 1]) {
        const adjKey = `${calYear}:${adj}`;
        if (adj >= 1 && adj <= 12 && !calCache.current[adjKey]) {
          cachedScheduleByMonth(adj, calYear).then(async (s) => {
            const gl = s?.games || [];
            const dts = [...new Set(gl.map((g) => g.date))];
            const srs = await Promise.all(dts.map((d) => cachedDailyScores(d).catch((e) => { console.warn('cachedDailyScores preload failed for', d, e); return null; })));
            const src: Record<string, any[]> = {};
            for (let i = 0; i < dts.length; i++) {
              if (srs[i]?.games) src[dts[i]] = srs[i]!.games;
            }
            calCache.current[adjKey] = resolveGamesForSchedule(gl, src);
            pruneCalCache(calCache.current);
          }).catch((e) => { console.warn('adjacent month preload failed', e); });
        }
      }
    }).catch((e) => { console.warn('calendar schedule fetch failed', e); });
    return () => { cancelled = true; };
  }, [calendarOpen, calMonth, calYear]);

  // Evaluate badges on mount + refresh when app returns to foreground
  useEffect(() => {
    import("@/lib/achievements").then(async ({ backfillLiveRecords, evaluateBadges }) => {
      await backfillLiveRecords();
      await evaluateBadges();
    }).catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        load();
        import("@/lib/achievements").then(async ({ backfillLiveRecords, evaluateBadges }) => {
          await backfillLiveRecords();
          await evaluateBadges();
        }).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [load]);

  const handlePageSwipe = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
      if (page === 1 || page === lastActedPageRef.current) return;
      lastActedPageRef.current = page;
      const d = new Date(selectedDate);
      if (page === 0) {
        d.setDate(d.getDate() - 1);
      } else {
        d.setDate(d.getDate() + 1);
      }
      setSelectedDate(d);
    },
    [screenWidth, selectedDate]
  );

  // Reset scroll to center before paint.
  // Guard is NOT reset here — onMomentumScrollEnd fires again after scrollTo with
  // the same page value, so keeping the guard prevents a double advance.
  useLayoutEffect(() => {
    if (screenWidth > 0) {
      pageScrollRef.current?.scrollTo({ x: screenWidth, animated: false });
    }
  }, [selectedDate, screenWidth]);

  const sortGames = useCallback(
    (games: ResolvedGame[]) => {
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

  const renderGame = useCallback(({ item }: { item: ResolvedGame }) => {
    const isMyTeamGame = myTeam && (item.homeTeam === myTeam || item.awayTeam === myTeam);
    return (
      <GameCard
        homeTeam={item.homeTeam}
        awayTeam={item.awayTeam}
        time={item.time}
        stadium={item.venue}
        status={item.status === "cancelled" ? "finished" : item.status}
        homeScore={item.homeScore}
        awayScore={item.awayScore}
        homePitcher={item.homePitcher}
        awayPitcher={item.awayPitcher}
        winPitcher={item.winPitcher}
        losePitcher={item.losePitcher}
        cancelled={item.status === "cancelled"}
        liveInning={item.liveInning}
        isTop={item.isTop}
        highlighted={isMyTeamGame ? teamPrimaryColor(myTeam, isDark) : undefined}
        dense={!isMyTeamGame}
        onClick={() => router.push(`/game/${item.gameId}?ap=${encodeURIComponent(item.awayPitcher || "")}&hp=${encodeURIComponent(item.homePitcher || "")}`)}
      />
    );
  }, [myTeam, isDark, router]);

  const renderEmpty = (isMonday?: boolean) => (
    <View style={[styles.emptyContainer, isMonday && { paddingVertical: 20 }]}>
      {isMonday && (
        <Image source={require("../../assets/monday.png")} style={{ width: 300, height: 170, marginBottom: 12 }} resizeMode="contain" />
      )}
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
        <MyButton color={myTeam ? teamPrimaryColor(myTeam, isDark) : undefined} />
      </View>

      {/* Date strip */}
      <DateStrip
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        teamColor={myTeam ? teamPrimaryColor(myTeam, isDark) : undefined}
      />

      {/* Calendar toggle + content — pan wraps both for open/close swipe */}
      <View {...calendarPan.panHandlers}>
      <View style={[styles.toggleWrapper, calendarOpen ? styles.toggleOpen : styles.toggleHidden]}>
        <CalendarGrid
          year={calYear}
          month={calMonth}
          resolvedGames={calResolvedGames}
          loading={loading}
          selectedTeam={displayTeam || myTeam}
          myTeam={myTeam}
          onSelectDate={(d) => { setSelectedDate(d); setCalendarOpen(false); }}
          onMonthChange={(y, m) => { setCalYear(y); setCalMonth(m); }}
          onTeamChange={setDisplayTeam}
          onYearChange={(y) => setCalYear(y)}
        />
      </View>
      </View>

      {/* Toggle row */}
      <View style={{ flexDirection: "row", paddingHorizontal: 20 }}>
        <Pressable style={{ flex: 1, paddingVertical: 6 }} onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setCalendarOpen(!calendarOpen);
        }}>
          <Text style={styles.calToggleText}>
            {calendarOpen ? "캘린더 접기 ▲" : "캘린더 보기 ▼"}
          </Text>
        </Pressable>
        <Text style={[styles.calToggleText, { paddingVertical: 6 }]}>|</Text>
        <Pressable style={{ flex: 1, paddingVertical: 6 }} onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setCalendarOpen(false);
          setAchievementOpen(!achievementOpen);
        }}>
          <Text style={[styles.calToggleText, { textAlign: "right" }]}>
            {achievementOpen ? "도전과제 접기 ▲" : "도전과제 보기 ▼"}
          </Text>
        </Pressable>
      </View>
      <View {...achievementPan.panHandlers} style={[styles.toggleWrapper, achievementOpen ? styles.toggleOpen : styles.toggleHidden]}>
        <AchievementWidget />
      </View>

      {/* Game list — horizontal paging scroll */}
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={pageScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handlePageSwipe}
          onScrollBeginDrag={() => { lastActedPageRef.current = 1; }}
          style={{ flex: 1 }}
        >
          {(["prev", "current", "next"] as const).map((slot, idx) => {
            const offset = idx - 1; // -1, 0, +1
            const d = new Date(selectedDate);
            d.setDate(d.getDate() + offset);
            const ds = formatDateStr(d);
            const pageData = gamesByDate[ds];
            const loaded = pageData !== undefined;
            const pageGames = loaded ? sortGames(pageData) : [];
            const empty = loaded && pageGames.length === 0 && !error;
            return (
              <View key={slot} style={{ width: screenWidth, flex: 1 }}>
                {error ? renderError() : !loaded ? (
                  <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                    <ActivityIndicator size="small" color={theme.mutedForeground} />
                  </View>
                ) : empty ? renderEmpty(d.getDay() === 1) : (
                  <FlatList
                    key={slot}
                    data={pageGames}
                    renderItem={renderGame}
                    keyExtractor={(item) => item.gameId}
                    contentContainerStyle={styles.listContent}
                    ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                  />
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

