import { useMemo, memo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { TEAM_COLORS, teamPrimaryColor } from "@shared/teamColors";
import { getDaysInMonth, getFirstDayOfMonth, formatDateForApi } from "@shared/constants";
import { useTheme } from "@/lib/ThemeContext";
import { type ResolvedGame, getResultLabel, getResultColor } from "@/lib/resolveGames";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function CalendarGridPure({
  year,
  month,
  gamesByDate,
  selectedTeam,
  onSelectDate,
  plannedRecords = [],
}: {
  year: number;
  month: number;
  gamesByDate: Map<string, ResolvedGame[]>;
  selectedTeam: string | null;
  onSelectDate: (d: Date) => void;
  plannedRecords?: any[];
}) {
  const { theme, isDark } = useTheme();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const todayStr = formatDateForApi(new Date());

  const styles = useMemo(() => StyleSheet.create({
    calCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 8,
    },
    calGrid: { flexDirection: "row", flexWrap: "wrap" },
    weekRow: { flexDirection: "row", marginBottom: 2 },
    dayHeader: { width: "14.28%", alignItems: "center", paddingVertical: 4 },
    dayHeaderText: { fontSize: 12, color: theme.mutedForeground, fontWeight: "500" },
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
    eventPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      marginTop: 2,
      width: "100%",
    },
    eventPillText: {
      fontSize: 8,
      fontWeight: "700",
      color: "#fff",
      marginLeft: 2,
    },
  }), [theme]);

  return (
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

          const dateStr = formatDateForApi(new Date(year, month, day));
          const dayGames = gamesByDate.get(dateStr) || [];
          const isToday = dateStr === todayStr;
          const isFuture = dateStr > todayStr;
          const hasGames = dayGames.length > 0;
          const isDH = hasGames && dayGames.length > 1;

          const dayPlans = plannedRecords.filter((r) => r.date === dateStr);
          const hasPlan = dayPlans.length > 0;

          let winCount = 0, lossCount = 0, drawCount = 0;
          for (const rg of dayGames) {
            if (rg.status === "cancelled" || rg.outcome == null) continue;
            const isHome = rg.homeTeam === selectedTeam;
            const our = isHome ? (rg.homeScore ?? 0) : (rg.awayScore ?? 0);
            const their = isHome ? (rg.awayScore ?? 0) : (rg.homeScore ?? 0);
            if (our > their) winCount++;
            else if (our < their) lossCount++;
            else drawCount++;
          }

          const hasResult = winCount + lossCount + drawCount > 0;
          const cellBg = hasGames && !isFuture && hasResult ? theme.muted : undefined;
          const hasHome = dayGames.some((rg) => rg.homeTeam === selectedTeam);

          const dayLabels = dayGames.map((rg) => getResultLabel(rg, selectedTeam)).filter(Boolean);

          return (
            <Pressable
              key={dateStr}
              style={[styles.calCell, cellBg && { backgroundColor: cellBg }, hasHome && { borderLeftWidth: 3, borderLeftColor: teamPrimaryColor(selectedTeam, isDark) || theme.mutedForeground }]}
              onPress={() => onSelectDate(new Date(year, month, day))}
            >
              <View style={styles.calDayRow}>
                <Text style={[styles.calDayNum, isToday && styles.calTodayNum, !hasGames && { color: theme.mutedForeground }]}>
                  {day}
                </Text>
                <View style={styles.calDayTags}>
                  {isDH ? (
                    <Text style={[styles.dhTag, { backgroundColor: "#1a1a1a", color: "#fff" }]}>DH</Text>
                  ) : (
                    dayLabels.map((label, li) => (
                      <View
                        key={li}
                        style={[styles.calDayDot, { backgroundColor: getResultColor(label) }]}
                      >
                        <Text style={styles.calDayDotText}>{label}</Text>
                      </View>
                    ))
                  )}
                </View>
              </View>

              {isDH ? (
                (() => {
                  const g0 = dayGames[0];
                  const oppName = g0.homeTeam === selectedTeam
                    ? TEAM_COLORS[g0.awayTeam]?.shortName || g0.awayTeam
                    : TEAM_COLORS[g0.homeTeam]?.shortName || g0.homeTeam;
                  return (
                    <View style={styles.calGame}>
                      <Text style={styles.calOpp} numberOfLines={1}>{oppName}</Text>
                      <View style={{ flexDirection: "row", gap: 4, marginTop: 1 }}>
                        {dayGames.slice(0, 2).map((rg, i) => {
                          const label = getResultLabel(rg, selectedTeam);
                          if (label) {
                            return (
                              <View key={i} style={{
                                backgroundColor: getResultColor(label),
                                width: 16, height: 16, borderRadius: 8,
                                alignItems: "center", justifyContent: "center",
                              }}>
                                <Text style={{ fontSize: 8, fontWeight: "700", color: "#fff" }}>
                                  {rg.status === "cancelled" ? "취" : label}
                                </Text>
                              </View>
                            );
                          }
                          if (rg.isExhibition && !isFuture) {
                            return (
                              <View key={i} style={{
                                backgroundColor: "#888",
                                width: 16, height: 16, borderRadius: 8,
                                alignItems: "center", justifyContent: "center",
                              }}>
                                <Text style={{ fontSize: 8, fontWeight: "700", color: "#fff" }}>종</Text>
                              </View>
                            );
                          }
                          return <View key={i} style={{ width: 16, height: 16 }} />;
                        })}
                      </View>
                    </View>
                  );
                })()
              ) : (
                dayGames.slice(0, 2).map((rg, gi) => {
                  const isHome = rg.homeTeam === selectedTeam;
                  const oppName = isHome
                    ? TEAM_COLORS[rg.awayTeam]?.shortName || rg.awayTeam
                    : TEAM_COLORS[rg.homeTeam]?.shortName || rg.homeTeam;
                  const label = getResultLabel(rg, selectedTeam);
                  const color = getResultColor(label);

                  return (
                    <View key={gi} style={styles.calGame}>
                      <View>
                        <Text style={styles.calOpp} numberOfLines={1}>{oppName}</Text>
                      </View>
                      <View>
                        {rg.status === "cancelled" ? (
                          <Text style={styles.calCancelled}>취소</Text>
                        ) : rg.homeScore != null && rg.awayScore != null && !isFuture && rg.outcome != null ? (
                          <View style={[styles.scoreChip, { backgroundColor: (label ? color : theme.mutedForeground) + "18" }]}>
                            <Text style={[
                              styles.calScore,
                              { color: label ? color : theme.mutedForeground },
                              (rg.awayScore >= 10 || rg.homeScore >= 10) && styles.calScoreSm,
                            ]}>
                              {rg.awayScore}:{rg.homeScore}
                            </Text>
                          </View>
                        ) : rg.isExhibition && !isFuture ? (
                          <Text style={styles.calCancelled}>종료</Text>
                        ) : (
                          <Text style={styles.calVenue} numberOfLines={1}>
                            {rg.venue || rg.time.slice(0, 5) || ""}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
              {hasPlan && dayPlans.map((plan, pi) => {
                const planColor = plan.cheered_team ? (teamPrimaryColor(plan.cheered_team, isDark) || theme.primary) : theme.primary;
                return (
                  <View key={`plan-${pi}`} style={[styles.eventPill, { backgroundColor: planColor }]}>
                    <Text style={styles.eventPillText} numberOfLines={1}>✓ 예매</Text>
                  </View>
                );
              })}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default memo(CalendarGridPure);
