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
import { TEAM_COLORS } from "@shared/teamColors";
import { TEAM_NAME_TO_ID, buildGameId, formatDateForApi as formatDateStr } from "@shared/constants";

import MyButton from "@/components/MyButton";
import { useTheme, teamPrimaryColor } from "@/lib/ThemeContext";
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
  isExhibition?: boolean;
  isPostseason?: boolean;
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
  const [gamesByDate, setGamesByDate] = useState<Record<string, EnhancedGame[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [displayTeam, setDisplayTeam] = useState<string | null>(null);
  const { myTeam } = useTeam();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [achievementOpen, setAchievementOpen] = useState(false);
  const [calGames, setCalGames] = useState<ScheduleGame[]>([]);
  const [calScores, setCalScores] = useState<Record<string, { away: string; home: string; awayScore: number; homeScore: number; outcome?: string | null; cancelled?: boolean }[]>>({});
  const scheduleCache = useRef<{ month: number; year: number; games: ScheduleGame[] } | null>(null);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const calCache = useRef<Record<string, { games: ScheduleGame[]; scores: Record<string, any[]> }>>({});
  const MAX_CAL_CACHE_ENTRIES = 15;
  const pruneCalCache = (cache: Record<string, { games: ScheduleGame[]; scores: Record<string, any[]> }>) => {
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
    // Load all scores in one call first, then build per-month caches from it
    const preloadAll = async () => {
      const [allScores] = await Promise.all([
        cachedAllDailyScores(),
        cachedScheduleByMonth(current, new Date().getFullYear()),
        cachedScheduleByMonth(current - 1, new Date().getFullYear()).catch(() => null),
        cachedScheduleByMonth(current + 1, new Date().getFullYear()).catch(() => null),
      ]);

      const cy = new Date().getFullYear();
      const fetchAndCache = async (month: number) => {
        if (month < 1 || month > 12) return;
        const schedule = await cachedScheduleByMonth(month, cy);
        const gamesList = schedule?.games || [];
        const myDates = [...new Set(gamesList.map((g) => g.date))];
        const scoresRecord: Record<string, any[]> = {};
        for (const date of myDates) {
          const games = allScores?.[date];
          if (games) scoresRecord[date] = games;
        }
        calCache.current[`${cy}:${month}`] = { games: gamesList, scores: scoresRecord };
        pruneCalCache(calCache.current);
        if (month === current) {
          setCalGames(gamesList);
          setCalScores(scoresRecord);
        }
      };
      fetchAndCache(current);
      fetchAndCache(current - 1);
      fetchAndCache(current + 1);
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

        const result: Record<string, EnhancedGame[]> = {};
        for (let i = 0; i < 3; i++) {
          const ds = dates[i];
          const dayGames = schedule.filter((g) => g.date === ds);
          const scoreEntries: ScoreEntry[] = scoresList[i]?.games || [];
          const isFuture = ds > todayStr;
          const isToday = ds === todayStr;

          // Pitcher map and status from todayGames (today) or nextGames (tomorrow)
          const pitcherMap = new Map<string, { away?: string; home?: string }>();
          const gameIdMap = new Map<string, string>();
          const gameStatusMap = new Map<string, string>();
          const gameTimeMap = new Map<string, string>();
          if (isToday && todayData?.games) {
            for (const g of todayData.games) {
              const key = `${ds}-${g.away.id}-${g.home.id}`;
              pitcherMap.set(key, {
                away: g.away.starter?.name !== "미정" ? g.away.starter?.name : undefined,
                home: g.home.starter?.name !== "미정" ? g.home.starter?.name : undefined,
              });
              gameIdMap.set(key, g.id);
              if (g.status) gameStatusMap.set(key, g.status);
              if (g.time) gameTimeMap.set(key, g.time);
            }
          } else {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = formatDateStr(tomorrow);
            if (ds === tomorrowStr && todayData?.nextGames) {
              for (const ng of todayData.nextGames) {
                const key = `${ng.date}-${ng.away.id}-${ng.home.id}`;
                pitcherMap.set(key, {
                  away: ng.away.starter?.name !== "미정" ? ng.away.starter?.name : undefined,
                  home: ng.home.starter?.name !== "미정" ? ng.home.starter?.name : undefined,
                });
                gameIdMap.set(key, ng.id);
                if (ng.status) gameStatusMap.set(key, ng.status);
                if (ng.time) gameTimeMap.set(key, ng.time);
              }
            }
          }

          const pairCount = new Map<string, number>();
          const enhanced: EnhancedGame[] = dayGames.map((g, gi) => {
            const homeId = TEAM_NAME_TO_ID[g.home] || "";
            const awayId = TEAM_NAME_TO_ID[g.away] || "";
            const pairKey = `${g.away}|${g.home}`;
            const pairIdx = pairCount.get(pairKey) || 0;
            pairCount.set(pairKey, pairIdx + 1);
            const matchingScores = scoreEntries.filter((s) => s.home === g.home && s.away === g.away);
            const score = matchingScores.find(s => (s.gameIdx ?? 0) === pairIdx + 1) || matchingScores[pairIdx];
            const gameKey = `${ds}-${awayId}-${homeId}`;
            const pitchers = pitcherMap.get(gameKey);
            const apiGameId = gameIdMap.get(gameKey);
            const serverStatus = gameStatusMap.get(gameKey);
            const serverTime = gameTimeMap.get(gameKey);

            const timeStr = serverTime || g.time || "18:30";
            const [h, m] = timeStr.split(":").map(Number);
            const startTime = new Date();
            startTime.setHours(h ?? 18, m ?? 30, 0, 0);
            const gameHasStarted = new Date() >= startTime;

            let status: "scheduled" | "live" | "finished" = "scheduled";
            if (score?.cancelled) {
              status = "finished";
            } else if (score && !isFuture && score.outcome !== null) {
              status = "finished";
            } else if (serverStatus === "live" && !isFuture && gameHasStarted) {
              status = "live";
            } else if (isToday && !score?.cancelled && gameHasStarted) {
              status = "live";
            }

            // Past exhibition games have no score data — mark as finished
            if (status === "scheduled" && !isFuture && g.isExhibition) {
              status = "finished";
            }

            const gameDate = ds.replace(/-/g, "");
            const isDHPair = (pairCount.get(pairKey) ?? 0) > 1;
            return {
              id: isDHPair ? buildGameId(awayId, homeId, gameDate, String(gi)) : (apiGameId || buildGameId(awayId, homeId, gameDate, String(gi))),
              homeTeam: homeId,
              awayTeam: awayId,
              time: serverTime || g.time || "18:30",
              venue: (g.venue || "").replace(/\s*\(.*?\)\s*$/, "").trim(),
              status,
              homeScore: score?.homeScore,
              awayScore: score?.awayScore,
              homePitcher: pitchers?.home,
              awayPitcher: pitchers?.away,
              winPitcher: score?.winPitcher,
              losePitcher: score?.losePitcher,
              cancelled: score?.cancelled,
              isExhibition: g.isExhibition,
            };
          });



          // Fallback: fetch game-detail for live games and missing pitchers
          const gamesNeedingDetail = enhanced.filter(
            (g) => !isFuture && !g.isExhibition && (g.status === "live" || !g.homePitcher || !g.awayPitcher)
          );
          if (gamesNeedingDetail.length > 0) {
            Promise.all(
              gamesNeedingDetail.map((g) => fetchGameDetail(g.id).catch(() => null))
            ).then((results) => {
              if (cancelled) return;
              setGamesByDate((prev) => ({
                ...prev,
                [ds]: (prev[ds] || []).map((g) => {
                  const detail = results.find((r) => r?.gameId === g.id);
                  if (!detail) return g;

                  // inning 추론: scoreBoard.inn 배열 길이로 초/말 판단
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

    // Restore from cache if available (year+month must match)
    const cached = calCache.current[cacheKey];
    if (cached) {
      setCalGames(cached.games);
      setCalScores(cached.scores);
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
      calCache.current[cacheKey] = { games: gamesList, scores: scoresRecord };
      pruneCalCache(calCache.current);
      if (!cancelled) {
        setCalGames(gamesList);
        setCalScores(scoresRecord);
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
            calCache.current[adjKey] = { games: gl, scores: src };
            pruneCalCache(calCache.current);
          }).catch((e) => { console.warn('adjacent month preload failed', e); });
        }
      }
    }).catch((e) => { console.warn('calendar schedule fetch failed', e); });
    return () => { cancelled = true; };
  }, [calendarOpen, calMonth, calYear]);

  // Refresh data when app returns to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        load();
        import("@/lib/achievements").then(({ evaluateBadges }) => evaluateBadges().catch(() => {}));
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
        liveInning={item.liveInning}
        isTop={item.isTop}
        highlighted={isMyTeamGame ? teamPrimaryColor(myTeam, isDark) : undefined}
        dense={!isMyTeamGame}
        onClick={() => router.push(`/game/${item.id}?ap=${encodeURIComponent(item.awayPitcher || "")}&hp=${encodeURIComponent(item.homePitcher || "")}`)}
      />
    );
  };

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
          games={calGames}
          scores={calScores}
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
          setAchievementOpen(false);
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
                    keyExtractor={(item) => item.id}
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

