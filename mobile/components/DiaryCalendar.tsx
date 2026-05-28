import { useEffect, useState, useMemo, useRef } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Animated } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { TEAM_COLORS, teamPrimaryColor } from "@shared/teamColors";
import { parseGameTeamIds, getWinBadge, getDaysInMonth, getFirstDayOfMonth } from "@shared/constants";
import { EMOTION_CHARACTER, type CharacterEmotion } from "@/lib/emotions";
import { TeamBadge } from "@/components/TeamBadge";
import { useTheme } from "@/lib/ThemeContext";
import { cachedScheduleByMonth, cachedDailyScores } from "@/lib/gameCache";
import { resolveGamesForSchedule, type ResolvedGame } from "@/lib/resolveGames";
import type { JikgwanRecord, Expense } from "@/lib/db";
import { getBadges } from "@/lib/db";
import { BADGE_DEFINITIONS } from "@/lib/achievements";
import { resolveIsWin, getDailyTotals, formatAmount } from "@/lib/expenseStats";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

export type CalendarMode = "jikgwan" | "expense" | "achievement";

interface DiaryCalendarProps {
  year: number;
  month: number;
  records: JikgwanRecord[];
  teamId: string | null;
  onSelectDate: (date: Date) => void;
  onMonthChange: (year: number, month: number) => void;
  mode?: CalendarMode;
  expenses?: Expense[];
}

export default function DiaryCalendar({
  year,
  month,
  records,
  teamId,
  onSelectDate,
  onMonthChange,
  mode = "jikgwan",
  expenses,
}: DiaryCalendarProps) {
  const { theme, isDark } = useTheme();
  const [resolvedGames, setResolvedGames] = useState<ResolvedGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [badgeMap, setBadgeMap] = useState<Map<string, string[]>>(new Map());

  const isExpense = mode === "expense";
  const isAchievement = mode === "achievement";

  // Load badge data for achievement mode
  useEffect(() => {
    if (!isAchievement) { setBadgeMap(new Map()); return; }
    const emojiByKey = new Map(BADGE_DEFINITIONS.map((d) => [d.badgeKey, d.emoji]));
    getBadges().then((badges) => {
      const map = new Map<string, string[]>();
      for (const b of badges) {
        if (!b.unlocked_date) continue;
        const emoji = emojiByKey.get(b.badge_key) ?? "🏅";
        const list = map.get(b.unlocked_date) ?? [];
        list.push(emoji);
        map.set(b.unlocked_date, list);
      }
      setBadgeMap(map);
    }).catch(() => {});
  }, [year, month, isAchievement]);

  // Fetch schedule + scores for the month
  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    setLoading(true);
    cachedScheduleByMonth(month + 1, year).then(async (schedule) => {
      if (cancelled) return;
      const gamesList = schedule?.games || [];
      const allDates = [...new Set(gamesList.map((g) => g.date))];
      const scoreResults = await Promise.all(
        allDates.map((d) => cachedDailyScores(d).catch(() => null))
      );
      if (cancelled) return;
      const scoresByDate: Record<string, any[]> = {};
      for (let i = 0; i < allDates.length; i++) {
        if (scoreResults[i]?.games) {
          scoresByDate[allDates[i]] = scoreResults[i]!.games;
        }
      }
      const resolved = resolveGamesForSchedule(gamesList, scoresByDate);
      if (!cancelled) {
        setResolvedGames(resolved);
        setLoading(false);
      }
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [year, month, teamId]);

  // Filter games for user's team (null teamId = show all)
  const myGamesByDate = new Map<string, ResolvedGame[]>();
  for (const g of resolvedGames) {
    if (!teamId || g.homeTeam === teamId || g.awayTeam === teamId) {
      const list = myGamesByDate.get(g.date) || [];
      list.push(g);
      myGamesByDate.set(g.date, list);
    }
  }

  // Record map (used by all modes)
  const recordMap = new Map<string, JikgwanRecord[]>();
  for (const r of records) {
    const existing = recordMap.get(r.date) ?? [];
    existing.push(r);
    recordMap.set(r.date, existing);
  }

  // Expense data (expense mode only)
  const dailyTotals = useMemo(() => getDailyTotals(expenses ?? [], year, month), [expenses, year, month]);
  const recordDates = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) {
      set.add(r.date);
    }
    return set;
  }, [records]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const cells: { day: number; isToday: boolean }[] = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: 0, isToday: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      isToday: isCurrentMonth && today.getDate() === d,
    });
  }

  const handlePrev = () => {
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    onMonthChange(y, m);
  };

  const handleNext = () => {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    onMonthChange(y, m);
  };

  const monthTranslateX = useRef(new Animated.Value(0)).current;

  const handlePrevRef = useRef(handlePrev);
  handlePrevRef.current = handlePrev;
  const handleNextRef = useRef(handleNext);
  handleNextRef.current = handleNext;

  const monthPanGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      monthTranslateX.setValue(Math.max(-40, Math.min(40, e.translationX)));
    })
    .onEnd((e) => {
      if (e.translationX > 60) {
        handlePrevRef.current();
      } else if (e.translationX < -60) {
        handleNextRef.current();
      }
      Animated.spring(monthTranslateX, { toValue: 0, useNativeDriver: true }).start();
    });

  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 12,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    navBtn: { fontSize: 14, color: theme.foreground, paddingHorizontal: 8 },
    monthTitle: { fontSize: 16, fontWeight: "700", color: theme.foreground },
    dayRow: {
      flexDirection: "row",
      marginBottom: 4,
    },
    dayHeader: {
      flex: 1,
      textAlign: "center",
      fontSize: 11,
      color: theme.mutedForeground,
      fontWeight: "600",
      paddingVertical: 4,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    loadingBox: {
      paddingVertical: 40,
      alignItems: "center",
    },
    cell: {
      width: "14.28%",
      height: 72,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 8,
    },
    cellInner: {
      width: "100%",
      height: "100%",
      justifyContent: "flex-start",
      alignItems: "center",
      paddingTop: 6,
      borderRadius: 8,
      gap: 2,
      position: "relative",
    },
    dayNum: {
      fontSize: 13,
      color: theme.foreground,
      fontWeight: "500",
    },
    expenseAmt: {
      fontSize: 10,
      color: theme.mutedForeground,
      fontWeight: "600",
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.foreground,
      marginTop: 1,
    },
    resultRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },
    oppName: {
      fontSize: 9,
      color: theme.foreground,
      fontWeight: "500",
      maxWidth: 36,
    },
    resultBadge: {
      borderRadius: 3,
      paddingHorizontal: 3,
      paddingVertical: 1,
    },
    resultBadgeText: {
      fontSize: 7,
      fontWeight: "700",
      color: "#fff",
    },
    legend: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 16,
      marginTop: 12,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendText: {
      fontSize: 10,
      color: theme.mutedForeground,
    },
  }), [theme]);

  return (
    <GestureDetector gesture={monthPanGesture}>
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ translateX: monthTranslateX }] }}>
      {/* Month navigator */}
      <View style={styles.header}>
        <Pressable onPress={handlePrev} hitSlop={8}>
          <Text style={styles.navBtn}>◀</Text>
        </Pressable>
        <Text style={styles.monthTitle}>
          {month + 1}월
        </Text>
        <Pressable onPress={handleNext} hitSlop={8}>
          <Text style={styles.navBtn}>▶</Text>
        </Pressable>
      </View>

      {/* Day-of-week headers */}
      <View style={styles.dayRow}>
        {DAYS.map((d, i) => (
          <Text
            key={d}
            style={[
              styles.dayHeader,
              (i === 0 || i === 6) && { color: theme.mutedForeground },
            ]}
          >
            {d}
          </Text>
        ))}
      </View>

      {/* Grid */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={theme.mutedForeground} />
        </View>
      ) : (
      <View style={styles.grid}>
        {cells.map((cell, idx) => {
          if (cell.day === 0) {
            return <View key={`empty-${idx}`} style={styles.cell} />;
          }

          const dateStr = `${year}.${String(month + 1).padStart(2, "0")}.${String(cell.day).padStart(2, "0")}`;
          const apiDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`;
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
          const isFuture = apiDateStr > todayStr;
          const isToday = apiDateStr === todayStr;

          const dayRecords = recordMap.get(dateStr);
          const dayGames = myGamesByDate.get(apiDateStr) || [];

          // Game result from ResolvedGame (handles DH automatically)
          interface GameResult { opponent: string; result: { label: string; color: string; textColor?: string } | null; }
          let gameResults: GameResult[] = [];
          const isDH = dayGames.length > 1;
          if (dayGames.length > 0 && !isFuture) {
            for (const rg of dayGames) {
              const isHome = rg.homeTeam === teamId;
              const oppTeamId = isHome ? rg.awayTeam : rg.homeTeam;
              const opponent = TEAM_COLORS[oppTeamId]?.shortName || oppTeamId;
              if (rg.status === "cancelled") {
                gameResults.push({ opponent, result: { label: "취", color: "#888" } });
              } else if (rg.outcome != null && rg.homeScore != null && rg.awayScore != null) {
                const our = isHome ? rg.homeScore : rg.awayScore;
                const their = isHome ? rg.awayScore : rg.homeScore;
                const result = our > their ? getWinBadge(1) : our < their ? getWinBadge(-1) : getWinBadge(0);
                gameResults.push({ opponent, result });
              } else if (!teamId) {
                const oppName = `${rg._raw.schedule?.away || ""} vs ${rg._raw.schedule?.home || ""}`;
                if (!gameResults.some((gr) => gr.opponent === oppName)) {
                  gameResults.push({ opponent: oppName, result: null });
                }
              }
            }
          }
          const gameOpponent = gameResults[0]?.opponent;
          const gameResult = gameResults[0]?.result || null;

          // Diary record info (overrides game result if exists)
          let cellBg: string | undefined;
          let emotionChar: string | undefined;
          let diaryOpponent: string | undefined;
          let diaryResultBadge: { label: string; color: string; textColor?: string } | null = null;
          if (dayRecords && dayRecords.length > 0) {
            const latest = dayRecords[0];
            const isTodayUnplayed = isToday && (latest.score_home == null || latest.score_home === 0) && (latest.score_away == null || latest.score_away === 0);
            const skipResult = isFuture || isTodayUnplayed;
            if (!skipResult) {
              const iw = resolveIsWin(latest);
              if (iw === 1) cellBg = isDark ? "#1a3a5c" : "#e3f2fd";
              else if (iw === -1) cellBg = isDark ? "#3a1a1a" : "#ffebee";
              else if (iw === 0) cellBg = isDark ? "#2a2a2a" : "#f5f5f5";
              else cellBg = theme.muted;
            } else {
              cellBg = theme.muted;
            }

            if (latest.emotion) {
              emotionChar = EMOTION_CHARACTER[latest.emotion];
            }

            diaryResultBadge = skipResult ? null : getWinBadge(resolveIsWin(latest));
            if (latest.game_id && latest.cheered_team) {
              const gt = parseGameTeamIds(latest.game_id);
              const oppId = gt.awayId === latest.cheered_team ? gt.homeId : gt.awayId;
              diaryOpponent = oppId ? TEAM_COLORS[oppId]?.shortName : undefined;
            }
          }

          // Use diary data if available, otherwise fall back to game data
          const showOpponent = diaryOpponent || gameOpponent;
          const showResult = diaryResultBadge || gameResult;

          // Expense data
          const total = isExpense ? (dailyTotals.get(cell.day) || 0) : 0;
          const hasRecord = isExpense && recordDates.has(dateStr);
          const amtStr = formatAmount(total);
          const amtFontSize = amtStr.length > 6 ? 8 : amtStr.length > 4 ? 9 : 10;

          // Today highlight: expense mode uses plain border, others use team color
          const todayBorder = isToday
            ? (isExpense || isAchievement ? theme.foreground : teamId ? teamPrimaryColor(teamId, isDark) : theme.foreground)
            : undefined;

          return (
            <Pressable
              key={`day-${cell.day}`}
              style={[
                styles.cell,
                isToday && { borderWidth: 2, borderColor: todayBorder },
              ]}
              onPress={() => onSelectDate(new Date(year, month, cell.day))}
            >
              <View style={[
                styles.cellInner,
                !isExpense && !isAchievement && cellBg ? { backgroundColor: cellBg } : undefined,
              ]}>
                <Text style={[
                  styles.dayNum,
                  isToday && { fontWeight: "700", color: todayBorder },
                ]}>
                  {cell.day}
                </Text>
                {/* Expense mode: show amount + dot */}
                {isExpense && total > 0 && (
                  <Text style={[styles.expenseAmt, { fontSize: amtFontSize }]} numberOfLines={1}>{amtStr}</Text>
                )}
                {isExpense && hasRecord && <View style={styles.dot} />}

                {/* Jikgwan only: result row (opponent + 승/무/패 + DH) */}
                {!isExpense && !isAchievement && showOpponent && showResult ? (
                  <View style={styles.resultRow}>
                    <Text style={styles.oppName} numberOfLines={1}>{showOpponent}</Text>
                    <View style={[styles.resultBadge, { backgroundColor: showResult.color }]}>
                      <Text style={[styles.resultBadgeText, showResult.textColor ? { color: showResult.textColor } : undefined]}>{showResult.label}</Text>
                    </View>
                    {!diaryResultBadge && isDH && gameResults.slice(1).map((gr, i) => gr.result ? (
                      <View key={i} style={[styles.resultBadge, { backgroundColor: gr.result.color }]}>
                        <Text style={[styles.resultBadgeText, gr.result.textColor ? { color: gr.result.textColor } : undefined]}>{gr.result.label}</Text>
                      </View>
                    ) : null)}
                  </View>
                ) : null}

                {/* Jikgwan only: emotion team badge */}
                {!isExpense && !isAchievement && emotionChar && dayRecords?.[0]?.cheered_team && (
                  <TeamBadge
                    teamId={dayRecords[0].cheered_team}
                    size="sm"
                    emotion={emotionChar as CharacterEmotion}
                  />
                )}

                {/* Achievement only: badge emoji */}
                {isAchievement && badgeMap.has(dateStr) && (
                  <Text style={{ fontSize: 10, position: "absolute", bottom: 4, right: 4 }}>
                    {badgeMap.get(dateStr)![0]}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#3b82f6" }]} />
          <Text style={styles.legendText}>승</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#ef4444" }]} />
          <Text style={styles.legendText}>패</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#f59e0b" }]} />
          <Text style={styles.legendText}>무</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#d4d4d4" }]} />
          <Text style={styles.legendText}>기록</Text>
        </View>
      </View>
      </Animated.View>
    </View>
    </GestureDetector>
  );
}
