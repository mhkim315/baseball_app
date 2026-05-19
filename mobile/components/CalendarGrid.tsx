import { useState, useMemo, useRef } from "react";
import { View, Text, Pressable, Modal, ScrollView, StyleSheet, ActivityIndicator, Animated } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { TEAM_COLORS, TEAM_LIST } from "@shared/teamColors";
import { TeamBadge } from "@/components/TeamBadge";
import { getDaysInMonth, getFirstDayOfMonth } from "@shared/constants";
import type { ScheduleGame } from "@/lib/api";
import { useTheme, teamPrimaryColor } from "@/lib/ThemeContext";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function teamShortName(teamId: string): string {
  return TEAM_LIST.find((t) => t.id === teamId)?.shortName || "";
}

interface CalendarScore {
  away: string; home: string;
  awayScore: number; homeScore: number;
  outcome?: string | null; cancelled?: boolean;
}

const WIN_SCORE = "#3b82d9";
const LOSS_SCORE = "#d94a4a";

export default function CalendarGrid({
  year: propYear, month: propMonth, games, scores, loading, selectedTeam, myTeam, onSelectDate, onMonthChange, onTeamChange,
}: {
  year: number; month: number;
  games: ScheduleGame[];
  scores: Record<string, CalendarScore[]>;
  loading: boolean;
  selectedTeam: string | null;
  myTeam?: string | null;
  onSelectDate: (d: Date) => void;
  onMonthChange: (year: number, month: number) => void;
  onTeamChange?: (teamId: string | null) => void;
}) {
  const { theme, isDark } = useTheme();
  const [teamPickerOpen, setTeamPickerOpen] = useState(false);
  const teamName = teamShortName(selectedTeam || "");
  const teamColor = TEAM_COLORS[selectedTeam || ""];

  const filteredGames = teamName
    ? games.filter((g) => g.away === teamName || g.home === teamName)
    : [];

  const gamesByDate = new Map<string, ScheduleGame[]>();
  for (const g of filteredGames) {
    const list = gamesByDate.get(g.date) || [];
    list.push(g);
    gamesByDate.set(g.date, list);
  }

  const daysInMonth = getDaysInMonth(propYear, propMonth);
  const firstDay = getFirstDayOfMonth(propYear, propMonth);
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;

  const goToPrev = () => {
    const m = propMonth - 1;
    if (m < 0) onMonthChange(propYear - 1, 11);
    else onMonthChange(propYear, m);
  };

  const goToNext = () => {
    const m = propMonth + 1;
    if (m > 11) onMonthChange(propYear + 1, 0);
    else onMonthChange(propYear, m);
  };

  const hasDH = filteredGames.some((g) => (gamesByDate.get(g.date)?.length ?? 0) > 1);

  const monthTranslateX = useRef(new Animated.Value(0)).current;

  const goToPrevRef = useRef(goToPrev);
  goToPrevRef.current = goToPrev;
  const goToNextRef = useRef(goToNext);
  goToNextRef.current = goToNext;

  const monthPanGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      monthTranslateX.setValue(Math.max(-40, Math.min(40, e.translationX)));
    })
    .onEnd((e) => {
      if (e.translationX > 60) {
        goToPrevRef.current();
      } else if (e.translationX < -60) {
        goToNextRef.current();
      }
      Animated.spring(monthTranslateX, { toValue: 0, useNativeDriver: true }).start();
    });

  const styles = useMemo(() => StyleSheet.create({
    container: {},
    loadingContainer: { paddingVertical: 24, alignItems: "center" },

    // Month nav
    monthRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingVertical: 6,
    },
    monthNav: {
      flexDirection: "row", alignItems: "center", gap: 20,
    },
    // Team selector
    teamSelector: {
      flexDirection: "row", alignItems: "center",
      gap: 4, paddingVertical: 4, paddingHorizontal: 10,
      borderRadius: 10, backgroundColor: theme.secondary,
    },
    teamSelectorName: { fontSize: 13, fontWeight: "600", color: theme.foreground },
    teamSelectorArrow: { fontSize: 8, color: theme.mutedForeground },
    overlay: {
      flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center", alignItems: "center", padding: 16,
    },
    pickerModal: {
      backgroundColor: theme.card, borderRadius: 20, padding: 14,
      width: "100%", maxWidth: 320, maxHeight: "60%",
    },
    pickerTitle: {
      fontSize: 14, fontWeight: "600", color: theme.foreground,
      textAlign: "center", marginBottom: 8,
    },
    pickerRow: {
      flexDirection: "row", alignItems: "center", gap: 10,
      paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10,
    },
    pickerRowActive: { backgroundColor: theme.secondary },
    pickerTeamName: { fontSize: 14, flex: 1 },
    myBadge: {
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    myBadgeText: {
      fontSize: 10,
      color: "#fff",
      fontWeight: "700",
    },
    monthBtn: { padding: 8, borderRadius: 20 },
    monthArrow: { fontSize: 22, color: theme.mutedForeground, fontWeight: "300", lineHeight: 24 },
    monthTitle: { fontSize: 18, fontWeight: "600", color: theme.secondaryForeground, minWidth: 130, textAlign: "center", letterSpacing: 1 },

    // Legend
    legend: { flexDirection: "row", justifyContent: "center", gap: 14, paddingVertical: 4, marginBottom: 4 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    legendDot: { width: 10, height: 10, borderRadius: 3 },
    legendText: { fontSize: 11, color: theme.mutedForeground },
    legendBadge: {
      backgroundColor: theme.muted, borderRadius: 4,
      paddingHorizontal: 6, paddingVertical: 1,
    },
    legendBadgeText: { fontSize: 10, fontWeight: "600", color: theme.mutedForeground },

    // Week header
    weekRow: { flexDirection: "row", marginBottom: 2 },
    dayHeader: { width: "14.28%", alignItems: "center", paddingVertical: 4 },
    dayHeaderText: { fontSize: 12, color: theme.mutedForeground, fontWeight: "500" },

    // Calendar card wrapper
    calCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 8,
    },

    // Calendar grid
    calGrid: { flexDirection: "row", flexWrap: "wrap" },
    calCell: {
      width: "14.28%",
      padding: 3,
      borderRadius: 8,
      minHeight: 52,
      borderWidth: 1,
      borderColor: theme.border,
    },
    calDayRow: {
      flexDirection: "row", alignItems: "center",
      marginBottom: 2,
      paddingHorizontal: 2,
    },
    calDayNum: { fontSize: 12, color: theme.mutedForeground, fontWeight: "500", flex: 1 },
    calTodayNum: { fontSize: 12, fontWeight: "700", color: theme.primary },
    calDayTags: { flexDirection: "row", alignItems: "center", gap: 2 },
    calDayDot: {
      width: 16, height: 16, borderRadius: 8,
      alignItems: "center", justifyContent: "center",
    },
    calDayDotText: { fontSize: 8, fontWeight: "700", color: "#fff" },
    dhTag: { fontSize: 8, fontWeight: "600", color: theme.mutedForeground, backgroundColor: theme.muted, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, overflow: "hidden" },

    // Game entry
    calGame: {
      flexDirection: "column",
      paddingHorizontal: 3,
      paddingVertical: 2,
    },
    calOpp: { fontSize: 11, lineHeight: 14, color: theme.secondaryForeground, fontWeight: "500" },
    scoreChip: {
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    calScore: { fontSize: 9, fontWeight: "700" },
    calScoreSm: { fontSize: 7, fontWeight: "700" },
    calCancelled: { fontSize: 8, color: theme.mutedForeground, fontWeight: "500" },
    calVenue: { fontSize: 9, color: theme.mutedForeground },
  }), [theme]);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={monthPanGesture}>
      <Animated.View style={{ transform: [{ translateX: monthTranslateX }] }}>
      {/* Month navigation + Team selector */}
      <View style={styles.monthRow}>
        <View style={styles.monthNav}>
          <Pressable onPress={goToPrev} style={styles.monthBtn} hitSlop={8}>
            <Text style={styles.monthArrow}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>{propYear}년 {propMonth + 1}월</Text>
          <Pressable onPress={goToNext} style={styles.monthBtn} hitSlop={8}>
            <Text style={styles.monthArrow}>›</Text>
          </Pressable>
        </View>

        <Pressable style={styles.teamSelector} onPress={() => setTeamPickerOpen(true)}>
          <Text style={[styles.teamSelectorName, selectedTeam && { color: teamPrimaryColor(selectedTeam, isDark) }]}>
            {selectedTeam ? TEAM_COLORS[selectedTeam]?.shortName : "전체"}
          </Text>
          <Text style={styles.teamSelectorArrow}>▼</Text>
        </Pressable>
      </View>

      {/* Legend */}
      {selectedTeam && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: teamPrimaryColor(selectedTeam, isDark) || theme.mutedForeground }]} />
            <Text style={styles.legendText}>홈경기</Text>
          </View>
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
          {hasDH && (
            <View style={styles.legendBadge}><Text style={styles.legendBadgeText}>DH</Text></View>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.mutedForeground} />
        </View>
      ) : (
        <View style={styles.calCard}>
          {/* Weekday header */}
          <View style={styles.weekRow}>
            {DAYS.map((d, i) => (
              <View key={d} style={styles.dayHeader}>
                <Text style={[styles.dayHeaderText, i === 0 && { color: "#f87171" }, i === 6 && { color: "#60a5fa" }]}>
                  {d}
                </Text>
              </View>
            ))}
          </View>

          {/* Day cells */}
          <View style={styles.calGrid}>
            {calendarDays.map((day, idx) => {
              if (!day) return <View key={`e-${idx}`} style={styles.calCell} />;

              const dateStr = `${propYear}-${String(propMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayGames = gamesByDate.get(dateStr) || [];
              const isToday = dateStr === todayStr;
              const dayScores = scores[dateStr] || [];
              const isFuture = dateStr > todayStr;
              const hasGames = dayGames.length > 0;
              const isDH = dayGames.length > 1;

              // Win/Loss/Draw summary
              let winCount = 0, lossCount = 0, drawCount = 0;
              for (const s of dayScores) {
                if (s.outcome == null || s.cancelled) continue;
                const isHm = s.home === teamName;
                const our = isHm ? s.homeScore : s.awayScore;
                const their = isHm ? s.awayScore : s.homeScore;
                if (our > their) winCount++;
                else if (our < their) lossCount++;
                else drawCount++;
              }

              const hasResult = winCount + lossCount + drawCount > 0;
              const cellBg = hasGames && !isFuture && hasResult ? theme.muted : undefined;
              const hasHome = dayGames.some((g) => g.home === teamName);

              // Result labels (승/패/무 dots like web)
              const dayLabels: string[] = dayGames.map((g) => {
                const s = dayScores.find((sc) => sc.away === g.away && sc.home === g.home);
                if (!s || s.cancelled || s.outcome == null || (s.awayScore === 0 && s.homeScore === 0)) return "";
                const homeWon = s.homeScore > s.awayScore;
                const tied = s.homeScore === s.awayScore;
                if (tied) return "무";
                const isHm = g.home === teamName;
                if ((isHm && homeWon) || (!isHm && !homeWon)) return "승";
                return "패";
              }).filter(Boolean);

              return (
                <Pressable
                  key={dateStr}
                  style={[styles.calCell, cellBg && { backgroundColor: cellBg }, hasHome && { borderLeftWidth: 3, borderLeftColor: teamPrimaryColor(selectedTeam, isDark) || theme.mutedForeground }]}
                  onPress={() => onSelectDate(new Date(propYear, propMonth, day))}
                >
                  {/* Day number + result dots row */}
                  <View style={styles.calDayRow}>
                    <Text style={[styles.calDayNum, isToday && styles.calTodayNum, !hasGames && { color: theme.mutedForeground }]}>
                      {day}
                    </Text>
                    <View style={styles.calDayTags}>
                      {dayLabels.map((label, li) => (
                        <View
                          key={li}
                          style={[styles.calDayDot, {
                            backgroundColor: label === "승" ? "#3b82f6" : label === "패" ? "#ef4444" : "#f59e0b",
                          }]}
                        >
                          <Text style={styles.calDayDotText}>{label}</Text>
                        </View>
                      ))}
                      {isDH && <Text style={styles.dhTag}>DH</Text>}
                    </View>
                  </View>

                  {/* Game entries */}
                  {dayGames.slice(0, 2).map((g, gi) => {
                    const isHome = g.home === teamName;
                    const score = dayScores.find((s) => s.away === g.away && s.home === g.home);
                    const oppName = isHome ? g.away : g.home;

                    let resultColor: string | undefined;
                    if (score && !isFuture && score.outcome != null && !score.cancelled) {
                      const our = isHome ? score.homeScore : score.awayScore;
                      const their = isHome ? score.awayScore : score.homeScore;
                      if (our > their) resultColor = WIN_SCORE;
                      else if (our < their) resultColor = LOSS_SCORE;
                      else resultColor = "#d97706";
                    }

                    const prefix = isDH ? `${gi + 1}차 ` : "";

                    return (
                      <View key={gi} style={styles.calGame}>
                        <View>
                          <Text style={styles.calOpp} numberOfLines={1}>
                            {prefix}{oppName}
                          </Text>
                        </View>
                        <View>
                          {score?.cancelled ? (
                            <Text style={styles.calCancelled}>취소</Text>
                          ) : score && !isFuture && score.outcome != null ? (
                            <View style={[styles.scoreChip, { backgroundColor: (resultColor || theme.mutedForeground) + "18" }]}>
                              <Text style={[
                                styles.calScore,
                                { color: resultColor || theme.mutedForeground },
                                (score.awayScore >= 10 || score.homeScore >= 10) && styles.calScoreSm,
                              ]}>
                                {score.awayScore}:{score.homeScore}
                              </Text>
                            </View>
                          ) : (
                            <Text style={styles.calVenue} numberOfLines={1}>{g.venue || g.time?.slice(0, 5) || ""}</Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Team picker modal */}
      </Animated.View>
      </GestureDetector>
      <Modal visible={teamPickerOpen} transparent animationType="fade" onRequestClose={() => setTeamPickerOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setTeamPickerOpen(false)}>
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>팀 선택</Text>
          <ScrollView>
            {TEAM_LIST.map((t) => (
              <Pressable
                key={t.id}
                style={[styles.pickerRow, t.id === selectedTeam && styles.pickerRowActive]}
                onPress={() => { onTeamChange?.(t.id); setTeamPickerOpen(false); }}
              >
                <TeamBadge teamId={t.id} size="md" />
                <Text style={[styles.pickerTeamName, { color: teamPrimaryColor(t.id, isDark) }]}>{t.name}</Text>
                {t.id === myTeam && (
                  <View style={[styles.myBadge, { backgroundColor: teamPrimaryColor(t.id, isDark) }]}>
                    <Text style={styles.myBadgeText}>MY</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

