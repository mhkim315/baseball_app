import { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from "react";
import { View, Text, Image, ScrollView, FlatList, StyleSheet, ActivityIndicator, Pressable, PanResponder, LayoutAnimation, Platform, UIManager, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, AppState, InteractionManager } from "react-native";

import { useRouter, useFocusEffect } from "expo-router";
import DateStrip from "@/components/DateStrip";
import GameCard from "@/components/GameCard";
import CalendarContainer from "@/components/CalendarContainer";
import AchievementWidget from "@/components/AchievementWidget";
import {
  type TodayGame,
  type ScoreEntry,
  type ScheduleGame,
} from "@/lib/api";
import {
  cachedScheduleByMonth,
  cachedDailyScores,
  cachedAllDailyScores,
  cachedTodayGames,
  cachedWidgetData,
} from "@/lib/gameCache";
import { resolveGames, resolveGamesForSchedule, type ResolvedGame } from "@/lib/resolveGames";
import { formatDateForApi as formatDateStr } from "@shared/constants";
import { getInningInfo } from "@shared/gameStatus";

import MyButton from "@/components/MyButton";
import ShortcutButton from "@/components/ShortcutButton";
import ShortcutPickerModal from "@/components/ShortcutPickerModal";
import SimpleAlert from "@/components/SimpleAlert";
import DiaryEntryModal from "@/components/DiaryEntryModal";
import ExpenseModal from "@/components/ExpenseModal";
import AchievementToast from "@/components/AchievementToast";
import HomeCoachMark from "@/components/HomeCoachMark";
import CoachMark from "@/components/CoachMark";
import { prefetchOnAppInit } from "@/lib/prefetch";
import { useTheme } from "@/lib/ThemeContext";
import { teamPrimaryColor } from "@shared/teamColors";
import { useTeam } from "@/lib/TeamContext";
import { backfillLiveRecords, evaluateBadges, grantRandomCharacter } from "@/lib/achievements";
import { type Badge, getTodayBackCoachSeen, setTodayBackCoachSeen, getHomeCoachSeen, setHomeCoachSeen, getHomeStickerCoachSeen, setHomeStickerCoachSeen, getVisitCount, getShortcut, setShortcut as saveShortcut, getJikgwanRecords } from "@/lib/db";
import { findTargetDate, getGameOptionForDate, findRecentMyTeamGame, type ShortcutType } from "@/lib/shortcutHelper";
import type { GameOption } from "@/components/diary/useDiaryForm";

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

  const { myTeam } = useTeam();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [achievementOpen, setAchievementOpen] = useState(false);
  const [calResolvedGames, setCalResolvedGames] = useState<ResolvedGame[]>([]);
  const [toastBadges, setToastBadges] = useState<Badge[]>([]);
  const [toastRewards, setToastRewards] = useState<{ type?: string; emotion?: string; label: string; key?: string }[]>([]);
  const [showCoachMark, setShowCoachMark] = useState(false);
  const [showTodayBackCoach, setShowTodayBackCoach] = useState(false);
  const hasLeftTodayRef = useRef(false);
  const todayBackChecked = useRef(false);
  const [showHomeStickerCoach, setShowHomeStickerCoach] = useState(false);
  const [showNoStickerAlert, setShowNoStickerAlert] = useState(false);
  const [showNoGameAlert, setShowNoGameAlert] = useState(false);
  const [showShortcutErrorAlert, setShowShortcutErrorAlert] = useState(false);
  const homeStickerCoachCheckedRef = useRef(false);
  const showCoachMarkRef = useRef(false);
  const scheduleCache = useRef<{ month: number; year: number; games: ScheduleGame[] } | null>(null);
  const [resultByDate, setResultByDate] = useState<Record<string, number>>({});

  // Shortcut state
  const [shortcut, setShortcut] = useState<ShortcutType | null>(null);
  const [showShortcutPicker, setShowShortcutPicker] = useState(false);
  const [showDiaryEntryModal, setShowDiaryEntryModal] = useState(false);
  const [shortcutGameOption, setShortcutGameOption] = useState<GameOption | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
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
          setCalendarOpen(false);
        } else if (gs.dy > 80 && !calendarOpenRef.current) {
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
          setAchievementOpen(false);
        } else if (gs.dy > 80 && !achievementOpenRef.current) {
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
      .then(async ([scheduleGames, adjGames, ...rest]: [unknown, unknown, ...unknown[]]) => {
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


          result[ds] = resolved;
        }

        // Enrich live games via widget-data (single call for all games)
        try {
          const widgetData = await cachedWidgetData();
          if (widgetData?.games) {
            for (const wg of widgetData.games) {
              for (let i = 0; i < 3; i++) {
                const ds = dates[i];
                const games = result[ds];
                if (!games) continue;
                const idx = games.findIndex((g) => g.gameId === wg.gameId);
                if (idx === -1) continue;

                let liveInning = games[idx].liveInning;
                let isTop = games[idx].isTop;
                if (wg.status === "live" && liveInning == null) {
                  const info = getInningInfo(wg.scoreBoard?.inn);
                  if (info) {
                    liveInning = info.inning;
                    isTop = info.isTop;
                  } else {
                    liveInning = 1;
                    isTop = true;
                  }
                }

                // Update homeScore/awayScore only when widget has live data
                // (wg.score is null for scheduled games — keep initial value)
                const scoreUpdate = wg.score
                  ? { homeScore: wg.score.home, awayScore: wg.score.away }
                  : {};

                games[idx] = {
                  ...games[idx],
                  ...scoreUpdate,
                  liveInning,
                  isTop,
                  relay: wg.relay,
                  awayPitcher: games[idx].awayPitcher || wg.awayStarter || undefined,
                  homePitcher: games[idx].homePitcher || wg.homeStarter || undefined,
                };
                break;
              }
            }
          }
        } catch {
          // Ignore — games render without detail enrichment
        }

        // Re-check cancelled after async detail enrichment
        if (cancelled) return;

        // TEMP: mock live + relay for finished games in dev
        if (__DEV__) {
          for (const ds of Object.keys(result)) {
            for (let i = 0; i < result[ds].length; i++) {
              const g = result[ds][i];
              if (g.status !== "finished" || g.relay) continue;
              result[ds][i] = {
                ...g,
                status: "live",
                liveInning: 1,
                isTop: true,
                relay: { strike: "1", ball: "2", out: "1", base1: "1", base2: "1", base3: "0", pitcher: { id: "p1", name: "헨리" }, batter: { id: "b1", name: "김하성" } },
              };
              break;
            }
          }
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

  // Load jikgwan records for DateStrip result indicators
  useEffect(() => {
    try {
      const records = getJikgwanRecords();
      const map: Record<string, number> = {};
      for (const r of records) {
        if (r.is_win == null) continue;
        const key = r.date.replace(/\./g, "-"); // YYYY.MM.DD → YYYY-MM-DD
        // Multiple records can exist for same date; keep the last one's result
        map[key] = r.is_win;
      }
      setResultByDate(map);
    } catch (e) { console.warn("home: load jikgwan records", e); }
  }, []);

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
      const allScoresData = await cachedAllDailyScores(calYear).catch(() => null);
      if (cancelled) return;
      const scoresRecord: Record<string, any[]> = {};
      if (allScoresData) {
        for (const game of gamesList) {
          if (allScoresData[game.date] && !scoresRecord[game.date]) scoresRecord[game.date] = allScoresData[game.date];
        }
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
            const adjScores = await cachedAllDailyScores(calYear).catch(() => null);
            const src: Record<string, any[]> = {};
            if (adjScores) {
              for (const game of gl) {
                if (adjScores[game.date] && !src[game.date]) src[game.date] = adjScores[game.date];
              }
            }
            calCache.current[adjKey] = resolveGamesForSchedule(gl, src);
            pruneCalCache(calCache.current);
          }).catch((e) => { console.warn('adjacent month preload failed', e); });
        }
      }
    }).catch((e) => { console.warn('calendar schedule fetch failed', e); });
    return () => { cancelled = true; };
  }, [calendarOpen, calMonth, calYear]);

  const runBadgeCheck = useCallback(async () => {
    try {
      await backfillLiveRecords();
      const { newlyUnlockedBadges, newlyUnlockedBackgrounds } = evaluateBadges();

      const rewards: { type: string; emotion?: string; label: string; key?: string }[] = [];
      for (let i = 0; i < newlyUnlockedBadges.length; i++) {
        const reward = grantRandomCharacter(newlyUnlockedBadges[i].badge_key);
        if (reward) rewards.push({ type: "character", ...reward });
      }
      for (const bg of newlyUnlockedBackgrounds) {
        rewards.push({ type: "background", key: bg.key, label: bg.label });
      }
      if (newlyUnlockedBadges.length > 0 || newlyUnlockedBackgrounds.length > 0) {
        setToastBadges(newlyUnlockedBadges);
        setToastRewards(rewards);
      }
    } catch {}
  }, []);

  // On mount: show coach mark first (if not seen), then run badge check after dismiss
  // On foreground: only run badge check (coach already handled on mount)
  useEffect(() => {
    try {
      if (!getHomeCoachSeen()) {
        setShowCoachMark(true);
      } else {
        InteractionManager.runAfterInteractions(() => {
          runBadgeCheck();
        });
      }
    } catch {
      InteractionManager.runAfterInteractions(() => {
        runBadgeCheck();
      });
    }
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        InteractionManager.runAfterInteractions(() => {
          prefetchOnAppInit();
          runBadgeCheck();
          try {
            const records = getJikgwanRecords();
            const map: Record<string, number> = {};
            for (const r of records) {
              if (r.is_win == null) continue;
              map[r.date.replace(/\./g, "-")] = r.is_win;
            }
            setResultByDate(map);
          } catch {}
          load();
        });
      }
    });
    return () => sub.remove();
  }, [load]);

  // Auto-refresh: re-check data periodically while screen is focused,
  // so stale cache is detected and refreshed without user navigation.
  // useFocusEffect ensures the interval is paused when user switches tabs.
  useFocusEffect(useCallback(() => {
    const interval = setInterval(() => {
      load();
    }, 30_000);
    return () => clearInterval(interval);
  }, [load]));

  useEffect(() => { showCoachMarkRef.current = showCoachMark; }, [showCoachMark]);

  const handleCoachDismiss = useCallback(() => {
    setShowCoachMark(false);
    setHomeCoachSeen();
    runBadgeCheck();
  }, [runBadgeCheck]);

  // Track: user left today → came back → show sticker coach mark (once, only if games exist today)
  useEffect(() => {
    if (isToday(selectedDate)) {
      const todayStr = formatDateStr(new Date());
      const todayGames = gamesByDate[todayStr];
      if (!todayGames) return;
      if (todayGames.length === 0) {
        todayBackChecked.current = true;
        return;
      }
      if (hasLeftTodayRef.current && !todayBackChecked.current) {
        if (showCoachMark) return;
        try {
          if (!getTodayBackCoachSeen()) {
            todayBackChecked.current = true;
            setShowTodayBackCoach(true);
          } else {
            todayBackChecked.current = true;
          }
        } catch (e) { console.warn("coach: todayBack", e); }
      }
    } else {
      hasLeftTodayRef.current = true;
    }
  }, [selectedDate, showCoachMark, gamesByDate]);

  // Home sticker coach: 1-time, after today-back coach was seen,
  // when viewing a day that has sticker-eligible games (finished/live today or yesterday before 14:00)
  useEffect(() => {
    if (showCoachMark || showTodayBackCoach || showHomeStickerCoach) return;
    if (homeStickerCoachCheckedRef.current) return;

    const viewedDateStr = formatDateStr(selectedDate);
    const games = gamesByDate[viewedDateStr];
    if (!games || games.length === 0) return;

    const todayStr = formatDateStr(new Date());
    const currentHour = new Date().getHours();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const gameDate = new Date(selectedDate); gameDate.setHours(0, 0, 0, 0);
    const daysSinceGame = Math.floor((todayStart.getTime() - gameDate.getTime()) / (1000 * 60 * 60 * 24));

    const hasStickerEligible = games.some((g) => {
      if (g.status !== "finished" && g.status !== "live") return false;
      if (viewedDateStr === todayStr) return true;
      if (daysSinceGame === 1 && currentHour < 14) return true;
      return false;
    });
    if (!hasStickerEligible) return;

    try {
      const todayBackSeen = getTodayBackCoachSeen();
      const homeStickerSeen = getHomeStickerCoachSeen();
      if (homeStickerSeen) {
        homeStickerCoachCheckedRef.current = true;
        return;
      }
      if (todayBackSeen && !homeStickerCoachCheckedRef.current) {
        homeStickerCoachCheckedRef.current = true;
        setShowHomeStickerCoach(true);
      }
    } catch (e) { console.warn("coach: homeSticker", e); }
  }, [selectedDate, gamesByDate, showCoachMark, showTodayBackCoach, showHomeStickerCoach]);


  // Shortcut: load setting on focus, auto-set diary_write for returning users
  useFocusEffect(useCallback(() => {
    try {
      const s = getShortcut();
      if (s === null) {
        const vc = getVisitCount();
        if (vc >= 2) {
          saveShortcut("diary_write");
          setShortcut("diary_write");
          return;
        }
      }
      setShortcut(s as ShortcutType | null);
    } catch {}
  }, []));

  const handleShortcutSelect = (type: ShortcutType) => {
    saveShortcut(type);
    setShortcut(type);
    setShowShortcutPicker(false);
  };

  const executeShortcut = async (type: ShortcutType) => {
    if (!myTeam) return;
    try {
      switch (type) {
        case "diary_write": {
          const targetDate = findTargetDate();
          const gameOpt = await getGameOptionForDate(targetDate, myTeam);
          if (gameOpt) {
            setShortcutGameOption(gameOpt);
            setShowDiaryEntryModal(true);
          } else {
            setShowNoGameAlert(true);
          }
          break;
        }
        case "sticker": {
          const result = await findRecentMyTeamGame(myTeam);
          if (result) {
            router.push(`/game/${result.gameId}?sc=1`);
          } else {
            setShowNoStickerAlert(true);
          }
          break;
        }
        case "diary_stats": {
          router.push("/(tabs)/diary?tab=stats&sub=jikgwan");
          break;
        }
        case "expense": {
          setShowExpenseModal(true);
          break;
        }
      }
    } catch (e) {
      setShowShortcutErrorAlert(true);
    }
  };

  const handleShortcutPress = () => {
    if (shortcut) {
      executeShortcut(shortcut);
    } else {
      setShowShortcutPicker(true);
    }
  };

  // Stable callbacks for CalendarContainer (prevents unnecessary re-renders)
  const handleCalSelectDate = useCallback((d: Date) => {
    setSelectedDate(d);
    setCalendarOpen(false);
  }, []);
  const handleCalMonthChange = useCallback((y: number, m: number) => {
    setCalYear(y);
    setCalMonth(m);
  }, []);
  const handleCalYearChange = useCallback((y: number) => {
    setCalYear(y);
  }, []);

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
        relay={item.relay}
        highlighted={isMyTeamGame ? teamPrimaryColor(myTeam, isDark) : undefined}
        dense={!isMyTeamGame}
        onClick={() => {
          setShowTodayBackCoach(false);
          setShowHomeStickerCoach(false);
          router.push(`/game/${item.gameId}?ap=${encodeURIComponent(item.awayPitcher || "")}&hp=${encodeURIComponent(item.homePitcher || "")}`);
        }}
      />
    );
  }, [myTeam, isDark, router, setShowTodayBackCoach, setShowHomeStickerCoach]);

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
        <ShortcutButton shortcut={shortcut} onPress={handleShortcutPress} color={myTeam ? teamPrimaryColor(myTeam, isDark) : undefined} />
        <View style={{ width: 8 }} />
        <MyButton color={myTeam ? teamPrimaryColor(myTeam, isDark) : undefined} />
      </View>

      <AchievementToast
        badges={toastBadges}
        rewards={toastRewards}
        teamId={myTeam ?? undefined}
        onDismiss={() => { setToastBadges([]); setToastRewards([]); }}
      />

      {/* Date strip */}
      <DateStrip
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        teamColor={myTeam ? teamPrimaryColor(myTeam, isDark) : undefined}
        resultByDate={resultByDate}
      />

      {/* Calendar toggle + content — pan wraps both for open/close swipe */}
      <View {...calendarPan.panHandlers}>
      <View style={[styles.toggleWrapper, calendarOpen ? styles.toggleOpen : styles.toggleHidden]}>
        <CalendarContainer
          year={calYear}
          month={calMonth}
          resolvedGames={calResolvedGames}
          loading={loading}
          myTeam={myTeam}
          onSelectDate={handleCalSelectDate}
          onMonthChange={handleCalMonthChange}
          onYearChange={handleCalYearChange}
        />
      </View>
      </View>

      {/* Toggle row */}
      <View style={{ flexDirection: "row", paddingHorizontal: 20 }}>
        <Pressable style={{ flex: 1, paddingVertical: 6 }} onPress={() => {
          setCalendarOpen(!calendarOpen);
        }}>
          <Text style={styles.calToggleText}>
            {calendarOpen ? "캘린더 접기 ▲" : "캘린더 보기 ▼"}
          </Text>
        </Pressable>
        <Text style={[styles.calToggleText, { paddingVertical: 6 }]}>|</Text>
        <Pressable style={{ flex: 1, paddingVertical: 6 }} onPress={() => {
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
      <View style={{ flex: 1, position: "relative" }}>
        {showCoachMark && (
          <View style={{ position: "absolute", top: 0, left: 16, right: 16, zIndex: 100, elevation: 5, shadowColor: "transparent" }}>
            <HomeCoachMark visible onDismiss={handleCoachDismiss} />
          </View>
        )}
        {showTodayBackCoach && (
          <View style={{ position: "absolute", top: 0, left: 16, right: 16, zIndex: 100, elevation: 5, shadowColor: "transparent" }}>
            <CoachMark visible showChevrons={false} text={(() => {
              const td = gamesByDate[formatDateStr(new Date())];
              const hasSticker = td?.some((g) => g.status === "finished" || g.status === "live");
              return hasSticker
                ? "경기 카드를 눌러 오늘 경기의 스티커를 만들어보세요."
                : "경기 카드를 눌러 경기 상세를 확인하고 일기를 적어보세요";
            })()} onDismiss={() => { setTodayBackCoachSeen(); setShowTodayBackCoach(false); }} />
          </View>
        )}
        {showHomeStickerCoach && (
          <View style={{ position: "absolute", top: 0, left: 16, right: 16, zIndex: 100, elevation: 5, shadowColor: "transparent" }}>
            <CoachMark visible showChevrons={false} text="카드를 눌러 경기 스티커를 생성해보세요"
              onDismiss={() => { setHomeStickerCoachSeen(); setShowHomeStickerCoach(false); }} />
          </View>
        )}
        <ScrollView
          ref={pageScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handlePageSwipe}
          onScrollBeginDrag={() => { lastActedPageRef.current = 1; if (showCoachMark) handleCoachDismiss(); setShowTodayBackCoach(false); setShowHomeStickerCoach(false); setShowShortcutPicker(false); }}
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
                    nestedScrollEnabled
                  />
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Shortcut modals */}
      <ShortcutPickerModal
        visible={showShortcutPicker}
        onClose={() => setShowShortcutPicker(false)}
        currentShortcut={shortcut}
        onSelect={handleShortcutSelect}
      />
      <DiaryEntryModal
        visible={showDiaryEntryModal}
        onClose={() => { setShowDiaryEntryModal(false); setShortcutGameOption(null); }}
        onSaved={() => { setShowDiaryEntryModal(false); setShortcutGameOption(null); }}
        presetGame={shortcutGameOption}
      />
      <ExpenseModal
        visible={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        onSaved={() => setShowExpenseModal(false)}
        presetDate={new Date()}
      />
      <SimpleAlert
        visible={showNoStickerAlert}
        title="알림"
        message={"스티커는 경기 시작부터\n다음날 14시까지 만들 수 있어요"}
        confirmText="확인"
        onClose={() => setShowNoStickerAlert(false)}
      />
      <SimpleAlert
        visible={showNoGameAlert}
        title="알림"
        message="해당 날짜에 응원팀 경기가 없습니다"
        confirmText="확인"
        onClose={() => setShowNoGameAlert(false)}
      />
      <SimpleAlert
        visible={showShortcutErrorAlert}
        title="오류"
        message="바로가기 실행 중 문제가 발생했습니다"
        confirmText="확인"
        onClose={() => setShowShortcutErrorAlert(false)}
      />
    </View>
  );
}

