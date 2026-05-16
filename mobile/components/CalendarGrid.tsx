import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { TEAM_COLORS, TEAM_LIST } from "@shared/teamColors";
import type { ScheduleGame } from "@/lib/api";
import { theme } from "@/lib/theme";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function teamShortName(teamId: string): string {
  return TEAM_LIST.find((t) => t.id === teamId)?.shortName || "";
}

interface CalendarScore {
  away: string; home: string;
  awayScore: number; homeScore: number;
  outcome?: string | null; cancelled?: boolean;
}

const WIN_BG = "#e8f4fd";
const LOSS_BG = "#fde8e8";
const DRAW_BG = "#f5f5f5";
const WIN_SCORE = "#3b82d9";
const LOSS_SCORE = "#d94a4a";

function getCellBg(win: number, loss: number, draw: number): string | undefined {
  if (win > 0 && loss === 0 && draw === 0) return WIN_BG;
  if (loss > 0 && win === 0 && draw === 0) return LOSS_BG;
  if (draw > 0 && win === 0 && loss === 0) return DRAW_BG;
  return undefined;
}

export default function CalendarGrid({
  year: propYear, month: propMonth, games, scores, loading, selectedTeam, onSelectDate, onMonthChange,
}: {
  year: number; month: number;
  games: ScheduleGame[];
  scores: Record<string, CalendarScore[]>;
  loading: boolean;
  selectedTeam: string | null;
  onSelectDate: (d: Date) => void;
  onMonthChange: (year: number, month: number) => void;
}) {
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

  return (
    <View style={styles.container}>
      {/* Month navigation */}
      <View style={styles.monthNav}>
        <Pressable onPress={goToPrev} style={styles.monthBtn} hitSlop={8}>
          <Text style={styles.monthArrow}>‹</Text>
        </Pressable>
        <Text style={styles.monthTitle}>{propYear}년 {propMonth + 1}월</Text>
        <Pressable onPress={goToNext} style={styles.monthBtn} hitSlop={8}>
          <Text style={styles.monthArrow}>›</Text>
        </Pressable>
      </View>

      {/* Legend */}
      {selectedTeam && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: teamColor?.primary || "#888" }]} />
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

              const cellBg = hasGames && !isFuture ? getCellBg(winCount, lossCount, drawCount) : undefined;
              const hasResult = winCount + lossCount + drawCount > 0;
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
                  style={[styles.calCell, cellBg && { backgroundColor: cellBg }]}
                  onPress={() => onSelectDate(new Date(propYear, propMonth, day))}
                >
                  {/* Inner card with home border */}
                  <View style={[styles.calInner, hasHome && { borderLeftWidth: 3, borderLeftColor: teamColor?.primary || "#888" }]}>
                    {/* Day number + result dots row */}
                    <View style={styles.calDayRow}>
                      <Text style={[styles.calDayNum, isToday && styles.calTodayNum, !hasGames && { color: "#d0d0d0" }]}>
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
                      let resultLabel = "";
                      if (score && !isFuture && score.outcome != null && !score.cancelled) {
                        const our = isHome ? score.homeScore : score.awayScore;
                        const their = isHome ? score.awayScore : score.homeScore;
                        if (our > their) { resultColor = WIN_SCORE; resultLabel = "승"; }
                        else if (our < their) { resultColor = LOSS_SCORE; resultLabel = "패"; }
                        else { resultColor = "#d97706"; resultLabel = "무"; }
                      }

                      const prefix = isDH ? `${gi + 1}차 ` : "";

                      return (
                        <View key={gi} style={styles.calGame}>
                          <Text style={[styles.calOpp, score && { color: "#444" }, !score && { color: "#bbb" }]} numberOfLines={1}>
                            {prefix}{oppName}
                          </Text>
                          <View style={styles.calGameResult}>
                            {score && !isFuture && score.outcome != null ? (
                              <View style={[styles.scoreChip, { backgroundColor: (resultColor || "#999") + "18" }]}>
                                <Text style={[styles.calScore, { color: resultColor || "#555" }, score.cancelled && { textDecorationLine: "line-through", color: "#ccc" }]}>
                                  {score.awayScore}:{score.homeScore}
                                </Text>
                              </View>
                            ) : (
                              <Text style={styles.calTime} numberOfLines={1}>{g.time?.slice(0, 5) || g.venue?.slice(0, 2) || ""}</Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  loadingContainer: { paddingVertical: 24, alignItems: "center" },

  // Month nav
  monthNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 6, gap: 24,
  },
  monthBtn: { padding: 8, borderRadius: 20 },
  monthArrow: { fontSize: 22, color: "#888", fontWeight: "300", lineHeight: 24 },
  monthTitle: { fontSize: 18, fontWeight: "600", color: "#444", minWidth: 130, textAlign: "center", letterSpacing: 1 },

  // Legend
  legend: { flexDirection: "row", justifyContent: "center", gap: 14, paddingVertical: 4, marginBottom: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 11, color: "#999" },
  legendBadge: {
    backgroundColor: "#f0eeea", borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  legendBadgeText: { fontSize: 10, fontWeight: "600", color: "#999" },

  // Week header
  weekRow: { flexDirection: "row", marginBottom: 2 },
  dayHeader: { width: "14.28%", alignItems: "center", paddingVertical: 4 },
  dayHeaderText: { fontSize: 12, color: "#bbb", fontWeight: "500" },

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
  },
  calInner: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#f0eeea",
    padding: 3,
    minHeight: 64,
  },
  calDayRow: {
    flexDirection: "row", alignItems: "center",
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  calDayNum: { fontSize: 12, color: "#666", fontWeight: "500", flex: 1 },
  calTodayNum: { fontSize: 12, fontWeight: "700", color: theme.primary },
  calDayTags: { flexDirection: "row", alignItems: "center", gap: 2 },
  calDayDot: {
    width: 16, height: 16, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  calDayDotText: { fontSize: 8, fontWeight: "700", color: "#fff" },
  dhTag: { fontSize: 8, fontWeight: "600", color: "#bbb", backgroundColor: "#f5f3f0", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, overflow: "hidden" },

  // Game entry
  calGame: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  calOpp: { fontSize: 10, lineHeight: 13, flex: 1, color: "#999" },
  calGameResult: { flexShrink: 0 },
  scoreChip: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  calScore: { fontSize: 10, fontWeight: "700" },
  calTime: { fontSize: 9, color: "#ccc" },
});
