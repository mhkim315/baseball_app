import { useState, useEffect, useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { TEAM_COLORS, TEAM_LIST } from "@shared/teamColors";
import { getDaysInMonth, getFirstDayOfMonth, DEFAULT_TEAM_ID, formatDateForApi } from "@shared/constants";
import { cachedScheduleByMonth, cachedAllDailyScores } from "@/lib/gameCache";
import { resolveGamesForSchedule, type ResolvedGame } from "@/lib/resolveGames";
import { useTheme } from "@/lib/ThemeContext";
import { teamPrimaryColor } from "@shared/teamColors";
import YearSelector from "@/components/YearSelector";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function CalendarPage() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTeam, setSelectedTeam] = useState(DEFAULT_TEAM_ID);
  const [resolvedGames, setResolvedGames] = useState<ResolvedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setResolvedGames([]);
    cachedScheduleByMonth(month + 1, year).then(async (schedule) => {
      if (cancelled) return;
      const gamesList = schedule?.games || [];
      if (cancelled) return;
      const allScores = await cachedAllDailyScores(year);
      if (cancelled || !allScores) {
        if (!cancelled) setLoading(false);
        return;
      }
      const scoresByDate: Record<string, ResolvedGame[]> = {};
      // Build scoresByDate from allScores for dates in this month
      for (const [date, games] of Object.entries(allScores)) {
        if (date.startsWith(`${year}-`)) {
          scoresByDate[date] = games as any;
        }
      }
      if (!cancelled) {
        const resolved = resolveGamesForSchedule(gamesList, allScores as Record<string, any[]>);
        setResolvedGames(resolved);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setError(true);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [month, year, retryKey]);

  const retry = () => setRetryKey((k) => k + 1);

  const filteredGames = selectedTeam
    ? resolvedGames.filter((g) => g.homeTeam === selectedTeam || g.awayTeam === selectedTeam)
    : [];

  const gamesByDate = new Map<string, ResolvedGame[]>();
  for (const g of filteredGames) {
    const list = gamesByDate.get(g.date) || [];
    list.push(g);
    gamesByDate.set(g.date, list);
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const todayStr = formatDateForApi(new Date());

  const goToPrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToYear = (y: number) => setCurrentDate(new Date(y, month, 1));

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12 },
    headerTitle: { fontSize: 24, fontWeight: "bold", color: theme.foreground },
    loadingContainer: { paddingVertical: 60, alignItems: "center" },
    errorText: { color: theme.mutedForeground, fontSize: 14, marginBottom: 16 },
    retryBtn: { paddingVertical: 8, paddingHorizontal: 20, backgroundColor: theme.foreground, borderRadius: 16 },
    retryText: { color: theme.background, fontSize: 13, fontWeight: "600" },

    // Month nav
    monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, gap: 24 },
    monthBtn: { padding: 8 },
    monthArrow: { fontSize: 14, color: theme.foreground },
    monthTitle: { fontSize: 18, fontWeight: "700", color: theme.foreground, minWidth: 120, textAlign: "center" },

    // Team filter
    teamGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, paddingHorizontal: 12, marginBottom: 8 },
    teamItem: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card },
    teamItemText: { fontSize: 12, color: theme.mutedForeground, fontWeight: "500" },
    teamItemTextActive: { color: "#fff", fontWeight: "700" },

    // Legend
    legend: { flexDirection: "row", justifyContent: "center", gap: 16, paddingVertical: 8, marginBottom: 4 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontSize: 10, color: theme.mutedForeground },
    dhBadge: { backgroundColor: theme.muted, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
    dhBadgeText: { fontSize: 8, fontWeight: "700", color: theme.mutedForeground },

    // Calendar
    calendar: { paddingHorizontal: 8 },
    weekRow: { flexDirection: "row" },
    dayHeader: { width: "14.28%", alignItems: "center", paddingVertical: 6 },
    dayHeaderText: { fontSize: 11, color: theme.mutedForeground, fontWeight: "600" },
    calGrid: { flexDirection: "row", flexWrap: "wrap" },
    calCell: { width: "14.28%", minHeight: 72, padding: 2, borderWidth: 0.5, borderColor: theme.border },
    calDayRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
    calDayNum: { fontSize: 11, color: theme.foreground, fontWeight: "500" },
    calTodayNum: { fontSize: 12, fontWeight: "700", color: theme.primary },
    dhTag: { fontSize: 8, fontWeight: "700", color: theme.mutedForeground, backgroundColor: theme.muted, borderRadius: 3, paddingHorizontal: 3 },
    calGame: { marginBottom: 1, paddingLeft: 2 },
    calOpp: { fontSize: 9, lineHeight: 12 },
    calScore: { fontSize: 9, fontWeight: "600" },
    calVenue: { fontSize: 8, color: theme.mutedForeground },
  }), [theme]);

  const homeTeamName = TEAM_LIST.find((t) => t.id === selectedTeam)?.shortName || "";

  function resultLabel(rg: ResolvedGame): string | null {
    if (rg.status === "cancelled") return null;
    if (rg.outcome == null || rg.homeScore == null || rg.awayScore == null) return null;
    const isHome = rg.homeTeam === selectedTeam;
    const our = isHome ? rg.homeScore : rg.awayScore;
    const their = isHome ? rg.awayScore : rg.homeScore;
    if (our > their) return "승";
    if (our < their) return "패";
    return "무";
  }

  function outcomeColor(label: string | null): string {
    if (label === "승") return "#1565c0";
    if (label === "패") return "#d32f2f";
    if (label === "무") return theme.mutedForeground;
    return theme.mutedForeground;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📅 일정</Text>
      </View>

      <ScrollView>
        {/* Month navigation */}
        <View style={styles.monthNav}>
          <Pressable onPress={goToPrevMonth} style={styles.monthBtn}>
            <Text style={styles.monthArrow}>◀</Text>
          </Pressable>
          <YearSelector year={year} onYearChange={goToYear} />
          <Text style={styles.monthTitle}>{month + 1}월</Text>
          <Pressable onPress={goToNextMonth} style={styles.monthBtn}>
            <Text style={styles.monthArrow}>▶</Text>
          </Pressable>
        </View>

        {/* Team filter */}
        <View style={styles.teamGrid}>
          {TEAM_LIST.map((team) => (
            <Pressable
              key={team.id}
              onPress={() => setSelectedTeam(team.id)}
              style={[
                styles.teamItem,
                selectedTeam === team.id && { backgroundColor: teamPrimaryColor(team.id, isDark), borderColor: teamPrimaryColor(team.id, isDark) },
              ]}
            >
              <Text style={[styles.teamItemText, selectedTeam === team.id && styles.teamItemTextActive]}>
                {team.shortName}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: teamPrimaryColor(selectedTeam, isDark) || "#888" }]} /><Text style={styles.legendText}>홈</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#1565c0" }]} /><Text style={styles.legendText}>승</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#d32f2f" }]} /><Text style={styles.legendText}>패</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: theme.muted }]} /><Text style={styles.legendText}>무</Text></View>
          <View style={styles.legendItem}><View style={styles.dhBadge}><Text style={styles.dhBadgeText}>DH</Text></View></View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : error ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.errorText}>일정을 불러올 수 없습니다</Text>
            <Pressable onPress={retry} style={styles.retryBtn}><Text style={styles.retryText}>재시도</Text></Pressable>
          </View>
        ) : (
          /* Calendar grid */
          <View style={styles.calendar}>
            {/* Weekday header */}
            <View style={styles.weekRow}>
              {DAYS.map((d, i) => (
                <View key={d} style={styles.dayHeader}>
                  <Text style={[styles.dayHeaderText, i === 0 && { color: theme.destructive }, i === 6 && { color: theme.info }]}>
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
                const isDH = dayGames.length > 1 && !isFuture;

                // Compute win/loss colors
                let cellBg = "transparent";
                if (!isDH) {
                  let hasWin = false, hasLoss = false;
                  for (const rg of dayGames) {
                    if (rg.status === "cancelled" || rg.outcome == null) continue;
                    const isHome = rg.homeTeam === selectedTeam;
                    const won = isHome ? (rg.homeScore ?? 0) > (rg.awayScore ?? 0) : (rg.awayScore ?? 0) > (rg.homeScore ?? 0);
                    if (won) hasWin = true; else hasLoss = true;
                  }
                  if (hasWin && !hasLoss) cellBg = "#e3f2fd";
                  else if (hasLoss && !hasWin) cellBg = "#ffebee";
                }

                const handlePress = () => {
                  if (isFuture || dayGames.length === 0 || isDH) return;
                  if (dayGames[0].gameId) router.push(`/game/${dayGames[0].gameId}`);
                };

                return (
                  <Pressable
                    key={dateStr}
                    style={[styles.calCell, dayGames.length > 0 && !isFuture && !isDH && { backgroundColor: cellBg }]}
                    onPress={handlePress}
                    disabled={isFuture || dayGames.length === 0}
                  >
                    <View style={styles.calDayRow}>
                      <Text style={[styles.calDayNum, isToday && styles.calTodayNum]}>{day}</Text>
                      {isDH && <Text style={styles.dhTag}>DH</Text>}
                    </View>

                    {isDH ? (
                      (() => {
                        const g0 = dayGames[0];
                        const isHome = g0.homeTeam === selectedTeam;
                        const oppName = isHome
                          ? TEAM_COLORS[g0.awayTeam]?.shortName || g0.awayTeam
                          : TEAM_COLORS[g0.homeTeam]?.shortName || g0.homeTeam;
                        const col = teamPrimaryColor(selectedTeam, isDark);
                        return (
                          <View style={[styles.calGame, isHome && { borderLeftWidth: 2, borderLeftColor: col }]}>
                            <Text style={[styles.calOpp, { color: theme.foreground }]} numberOfLines={1}>{oppName}</Text>
                            <View style={{ flexDirection: "row", gap: 2, flexWrap: "wrap" }}>
                              {dayGames.slice(0, 2).map((rg, i) => {
                                const label = resultLabel(rg);
                                return (
                                  <Pressable key={i} onPress={() => {
                                    if (rg.gameId) router.push(`/game/${rg.gameId}`);
                                  }}>
                                    <View style={{
                                      backgroundColor: label ? outcomeColor(label) : "#888",
                                      borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1,
                                    }}>
                                      <Text style={{ fontSize: 9, fontWeight: "700", color: "#fff" }}>
                                        {i + 1}차{rg.status === "cancelled" ? "취" : label || ""}
                                      </Text>
                                    </View>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        );
                      })()
                    ) : (
                      dayGames.slice(0, 2).map((rg, i) => {
                        const isHome = rg.homeTeam === selectedTeam;
                        const oppName = isHome
                          ? TEAM_COLORS[rg.awayTeam]?.shortName || rg.awayTeam
                          : TEAM_COLORS[rg.homeTeam]?.shortName || rg.homeTeam;
                        const col = teamPrimaryColor(selectedTeam, isDark);
                        const label = resultLabel(rg);

                        return (
                          <View key={i} style={[styles.calGame, isHome && { borderLeftWidth: 2, borderLeftColor: col }]}>
                            <Text style={[styles.calOpp, { color: rg.outcome != null ? theme.foreground : theme.mutedForeground }]} numberOfLines={1}>
                              {oppName}
                            </Text>
                            {rg.homeScore != null && rg.awayScore != null && !isFuture && rg.outcome != null ? (
                              <Text style={[
                                styles.calScore,
                                { color: rg.status === "cancelled" ? theme.mutedForeground : outcomeColor(label) },
                                rg.status === "cancelled" && { textDecorationLine: "line-through" },
                              ]}>
                                {rg.awayScore}:{rg.homeScore}
                              </Text>
                            ) : (
                              <Text style={styles.calVenue} numberOfLines={1}>{rg.venue?.slice(0, 2) || ""}</Text>
                            )}
                          </View>
                        );
                      })
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
