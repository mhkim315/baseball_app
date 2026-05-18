import { useEffect, useState, useMemo, useRef } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, PanResponder, Animated } from "react-native";
import { TEAM_COLORS, TEAM_LIST } from "@shared/teamColors";
import { parseGameTeamIds, getWinBadge, getDaysInMonth, getFirstDayOfMonth } from "@shared/constants";
import { EMOTION_CHARACTER } from "@/components/EmotionPicker";
import { TeamBadge } from "@/components/TeamBadge";
import { useTheme, teamPrimaryColor } from "@/lib/ThemeContext";
import { fetchScheduleByMonth, fetchAllDailyScores, type ScheduleGame, type ScoreEntry } from "@/lib/api";
import type { JikgwanRecord } from "@/lib/db";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

interface DiaryCalendarProps {
  year: number;
  month: number;
  records: JikgwanRecord[];
  teamId: string | null;
  onSelectDate: (date: Date) => void;
  onMonthChange: (year: number, month: number) => void;
}

export default function DiaryCalendar({
  year,
  month,
  records,
  teamId,
  onSelectDate,
  onMonthChange,
}: DiaryCalendarProps) {
  const { theme, isDark } = useTheme();
  const [games, setGames] = useState<ScheduleGame[]>([]);
  const [scoresByDate, setScoresByDate] = useState<Record<string, ScoreEntry[]>>({});
  const [loading, setLoading] = useState(false);

  const teamName = teamId ? TEAM_LIST.find((t) => t.id === teamId)?.shortName || "" : "";

  // Fetch schedule + scores for the month
  useEffect(() => {
    if (!teamName) return;
    setLoading(true);
    Promise.all([
      fetchScheduleByMonth(month + 1),
      fetchAllDailyScores(),
    ]).then(([schedule, scores]) => {
      if (schedule) setGames(schedule.games || []);
      if (scores) setScoresByDate(scores.dates || {});
    }).catch(() => {
      // silent
    }).finally(() => setLoading(false));
  }, [year, month, teamName]);

  // Build a map of date string -> records (YYYY.MM.DD format)
  const recordMap = new Map<string, JikgwanRecord[]>();
  for (const r of records) {
    const existing = recordMap.get(r.date) ?? [];
    existing.push(r);
    recordMap.set(r.date, existing);
  }

  // Filter games for user's team, grouped by date (YYYY-MM-DD format from schedule)
  const myGamesByDate = new Map<string, ScheduleGame[]>();
  for (const g of games) {
    if (teamName && (g.away === teamName || g.home === teamName)) {
      const list = myGamesByDate.get(g.date) || [];
      list.push(g);
      myGamesByDate.set(g.date, list);
    }
  }

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

  const monthPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 15,
    onPanResponderMove: (_, gs) => {
      monthTranslateX.setValue(Math.max(-40, Math.min(40, gs.dx)));
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dx > 60) {
        handlePrevRef.current();
      } else if (gs.dx < -60) {
        handleNextRef.current();
      }
      Animated.spring(monthTranslateX, { toValue: 0, useNativeDriver: true }).start();
    },
  })).current;

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
    },
    dayNum: {
      fontSize: 13,
      color: theme.foreground,
      fontWeight: "500",
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
    <View style={styles.container} {...monthPan.panHandlers}>
      <Animated.View style={{ transform: [{ translateX: monthTranslateX }] }}>
      {/* Month navigator */}
      <View style={styles.header}>
        <Pressable onPress={handlePrev} hitSlop={8}>
          <Text style={styles.navBtn}>◀</Text>
        </Pressable>
        <Text style={styles.monthTitle}>
          {year}년 {month + 1}월
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
          const isFuture = apiDateStr > `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

          const dayRecords = recordMap.get(dateStr);
          const dayGames = myGamesByDate.get(apiDateStr) || [];
          const dayScores = scoresByDate[apiDateStr] || [];

          // Game result from scores
          let gameOpponent: string | undefined;
          let gameResult: { label: string; color: string } | null = null;
          if (dayGames.length > 0 && !isFuture && dayScores.length > 0) {
            const g = dayGames[0];
            const score = dayScores.find((s) => s.away === g.away && s.home === g.home);
            if (score && !score.cancelled && score.outcome != null) {
              const isHome = g.home === teamName;
              const our = isHome ? score.homeScore : score.awayScore;
              const their = isHome ? score.awayScore : score.homeScore;
              gameOpponent = isHome ? g.away : g.home;
              if (our > their) gameResult = getWinBadge(1);
              else if (our < their) gameResult = getWinBadge(-1);
              else gameResult = getWinBadge(0);
            }
          } else if (dayGames.length > 0 && !isFuture && !teamName) {
            // No team filter — just show first game
            gameOpponent = `${dayGames[0].away} vs ${dayGames[0].home}`;
          }

          // Diary record info (overrides game result if exists)
          let cellBg: string | undefined;
          let emotionChar: string | undefined;
          let diaryOpponent: string | undefined;
          let diaryResultBadge: { label: string; color: string } | null = null;
          if (dayRecords && dayRecords.length > 0) {
            const latest = dayRecords[0];
            if (latest.is_win === 1) cellBg = isDark ? "#1a3a5c" : "#e3f2fd";
            else if (latest.is_win === -1) cellBg = isDark ? "#3a1a1a" : "#ffebee";
            else if (latest.is_win === 0) cellBg = isDark ? "#2a2a2a" : "#f5f5f5";
            else cellBg = theme.muted;

            if (latest.emotion) {
              emotionChar = EMOTION_CHARACTER[latest.emotion];
            }

            diaryResultBadge = getWinBadge(latest.is_win);
            if (latest.game_id && latest.cheered_team) {
              const gt = parseGameTeamIds(latest.game_id);
              const oppId = gt.awayId === latest.cheered_team ? gt.homeId : gt.awayId;
              diaryOpponent = oppId ? TEAM_COLORS[oppId]?.shortName : undefined;
            }
          }

          // Use diary data if available, otherwise fall back to game data
          const showOpponent = diaryOpponent || gameOpponent;
          const showResult = diaryResultBadge || gameResult;

          return (
            <Pressable
              key={`day-${cell.day}`}
              style={[
                styles.cell,
                cell.isToday && { borderWidth: 2, borderColor: teamId ? teamPrimaryColor(teamId, isDark) : theme.foreground },
              ]}
              onPress={() => onSelectDate(new Date(year, month, cell.day))}
            >
              <View style={[styles.cellInner, cellBg ? { backgroundColor: cellBg } : undefined]}>
                <Text style={[
                  styles.dayNum,
                  cell.isToday && { fontWeight: "700", color: teamId ? teamPrimaryColor(teamId, isDark) : theme.foreground },
                ]}>
                  {cell.day}
                </Text>
                {showOpponent && showResult ? (
                  <View style={styles.resultRow}>
                    <Text style={styles.oppName} numberOfLines={1}>{showOpponent}</Text>
                    <View style={[styles.resultBadge, { backgroundColor: showResult.color }]}>
                      <Text style={styles.resultBadgeText}>{showResult.label}</Text>
                    </View>
                  </View>
                ) : null}
                {emotionChar && dayRecords?.[0]?.cheered_team && (
                  <TeamBadge
                    teamId={dayRecords[0].cheered_team}
                    size="sm"
                    emotion={emotionChar as "joyful" | "determined" | "neutral" | "sad"}
                  />
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
  );
}

