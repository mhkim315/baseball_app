import { useState, useMemo, useRef, memo } from "react";
import { View, Text, Pressable, Modal, ScrollView, StyleSheet, ActivityIndicator, Animated } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { TEAM_COLORS, TEAM_LIST, teamPrimaryColor } from "@shared/teamColors";
import { TeamBadge } from "@/components/TeamBadge";
import YearSelector from "@/components/YearSelector";
import { useTheme } from "@/lib/ThemeContext";
import { type ResolvedGame } from "@/lib/resolveGames";
import CalendarGridPure from "@/components/CalendarGridPure";

const CalendarContainer = memo(function CalendarContainer({
  year,
  month,
  resolvedGames,
  loading,
  myTeam,
  onMonthChange,
  onYearChange,
  onSelectDate,
  plannedRecords = [],
}: {
  year: number;
  month: number;
  resolvedGames: ResolvedGame[];
  loading: boolean;
  myTeam?: string | null;
  onMonthChange: (year: number, month: number) => void;
  onYearChange?: (year: number) => void;
  onSelectDate: (d: Date) => void;
  plannedRecords?: any[];
}) {
  const { theme, isDark } = useTheme();
  const [displayTeam, setDisplayTeam] = useState<string | null>(null);
  const [teamPickerOpen, setTeamPickerOpen] = useState(false);

  const selectedTeam = displayTeam ?? myTeam ?? null;

  const { filteredGames, gamesByDate, hasDH } = useMemo(() => {
    const filtered = selectedTeam
      ? resolvedGames.filter((g) => g.homeTeam === selectedTeam || g.awayTeam === selectedTeam)
      : [];

    const byDate = new Map<string, ResolvedGame[]>();
    for (const g of filtered) {
      const list = byDate.get(g.date) || [];
      list.push(g);
      byDate.set(g.date, list);
    }

    const dh = filtered.some((g) => g.isDoubleHeader);

    return { filteredGames: filtered, gamesByDate: byDate, hasDH: dh };
  }, [resolvedGames, selectedTeam]);

  const goToPrev = () => {
    const m = month - 1;
    if (m < 0) onMonthChange(year - 1, 11);
    else onMonthChange(year, m);
  };

  const goToNext = () => {
    const m = month + 1;
    if (m > 11) onMonthChange(year + 1, 0);
    else onMonthChange(year, m);
  };

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
    monthRow: {
      flexDirection: "row", alignItems: "center",
      paddingVertical: 6, paddingHorizontal: 16, minHeight: 36,
    },
    monthNav: {
      flexDirection: "row", alignItems: "center", gap: 20,
      marginRight: 80,
    },
    teamSelector: {
      position: "absolute", right: 16,
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
    legend: { flexDirection: "row", justifyContent: "center", gap: 14, paddingVertical: 4, marginBottom: 4 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    legendDot: { width: 10, height: 10, borderRadius: 3 },
    legendText: { fontSize: 11, color: theme.mutedForeground },
    legendBadge: {
      backgroundColor: "#1a1a1a", borderRadius: 4,
      paddingHorizontal: 6, paddingVertical: 1,
    },
    legendBadgeText: { fontSize: 10, fontWeight: "600", color: "#fff" },
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
            {onYearChange && <YearSelector year={year} onYearChange={onYearChange} />}
            <Text style={styles.monthTitle}>{month + 1}월</Text>
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
          <CalendarGridPure
            year={year}
            month={month}
            gamesByDate={gamesByDate}
            selectedTeam={selectedTeam}
            onSelectDate={onSelectDate}
            plannedRecords={plannedRecords}
          />
        )}
      </Animated.View>
      </GestureDetector>

      {/* Team picker modal */}
      <Modal visible={teamPickerOpen} transparent animationType="fade" onRequestClose={() => setTeamPickerOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setTeamPickerOpen(false)}>
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>팀 선택</Text>
          <ScrollView>
            {TEAM_LIST.map((t) => (
              <Pressable
                key={t.id}
                style={[styles.pickerRow, t.id === selectedTeam && styles.pickerRowActive]}
                onPress={() => { setDisplayTeam(t.id); setTeamPickerOpen(false); }}
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
});

export default CalendarContainer;
