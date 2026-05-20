import { useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/lib/ThemeContext";
import { EXPENSE_CATEGORIES, type Expense, type JikgwanRecord } from "@/lib/db";
import { computeExpenseStats, computeHomeAwayExpenses, computeWinLossExpenses, computeStadiumExpenses, computeResultCategoryExpenses, formatAmount } from "@/lib/expenseStats";

interface ExpenseStatsProps {
  expenses: Expense[];
  records: JikgwanRecord[];
}

function avgFmt(n: number): string {
  return n >= 10000 ? `${Math.round(n / 10000)}만` : n.toLocaleString();
}

export default function ExpenseStats({ expenses, records }: ExpenseStatsProps) {
  const { theme, isDark } = useTheme();
  const stats = useMemo(() => computeExpenseStats(expenses), [expenses]);
  const maxCatAmount = stats.categoryTotals.length > 0 ? stats.categoryTotals[0].amount : 1;
  const liveRecords = useMemo(() => records.filter((r) => r.is_live === 1), [records]);
  const ha = useMemo(() => computeHomeAwayExpenses(expenses, liveRecords), [expenses, liveRecords]);
  const [includeBroadcast, setIncludeBroadcast] = useState(false);
  const wlRecords = includeBroadcast ? records : liveRecords;
  const wl = useMemo(() => computeWinLossExpenses(expenses, wlRecords), [expenses, wlRecords]);
  const stadiums = useMemo(() => computeStadiumExpenses(expenses, liveRecords), [expenses, liveRecords]);
  const rc = useMemo(() => computeResultCategoryExpenses(expenses, wlRecords), [expenses, wlRecords]);

  const styles = useMemo(() => StyleSheet.create({
    container: { gap: 16, paddingBottom: 100 },
    card: {
      backgroundColor: theme.card, borderRadius: 16,
      borderWidth: 1, borderColor: theme.border, padding: 16,
    },
    cardTitle: { fontSize: 14, fontWeight: "700", color: theme.foreground, marginBottom: 12 },
    // Season total
    totalRow: {
      flexDirection: "row", justifyContent: "center", alignItems: "baseline", gap: 4,
      paddingVertical: 16,
    },
    totalLabel: { fontSize: 13, color: theme.mutedForeground },
    totalAmount: { fontSize: 32, fontWeight: "800", color: theme.foreground },
    totalUnit: { fontSize: 14, color: theme.mutedForeground, fontWeight: "600" },
    // Category bar
    catRow: {
      flexDirection: "row", alignItems: "center",
      marginBottom: 12, gap: 8,
    },
    catIcon: { fontSize: 16, width: 24 },
    catLabel: { fontSize: 12, color: theme.foreground, fontWeight: "600", width: 50 },
    barBg: {
      flex: 1, height: 20, borderRadius: 10,
      backgroundColor: theme.muted, overflow: "hidden",
    },
    barFill: { height: "100%", borderRadius: 10 },
    catAmount: {
      fontSize: 12, color: theme.foreground, fontWeight: "700",
      width: 80, textAlign: "right",
    },
    // Monthly
    monthRow: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    monthLabel: { fontSize: 14, color: theme.foreground, fontWeight: "600" },
    monthAmount: { fontSize: 14, color: theme.foreground, fontWeight: "700" },
    monthLast: { borderBottomWidth: 0 },
    noData: {
      fontSize: 13, color: theme.mutedForeground,
      textAlign: "center", paddingVertical: 24,
    },
    // Home/Away, Win/Loss, Stadium
    duoRow: { flexDirection: "row", gap: 12 },
    duoCard: {
      flex: 1, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: theme.border,
    },
    duoLabel: { fontSize: 12, fontWeight: "600", color: theme.mutedForeground, marginBottom: 4 },
    duoGameCount: { fontSize: 11, color: theme.mutedForeground, marginBottom: 4 },
    duoTotal: { fontSize: 15, fontWeight: "700", color: theme.foreground, marginBottom: 2 },
    duoAvg: { fontSize: 12, color: theme.mutedForeground },
    // Stadium list
    stadiumRow: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    stadiumName: { fontSize: 14, color: theme.foreground, fontWeight: "600" },
    stadiumRight: { alignItems: "flex-end" },
    stadiumTotal: { fontSize: 14, color: theme.foreground, fontWeight: "700" },
    stadiumAvg: { fontSize: 11, color: theme.mutedForeground },
    // Result x category
    rcCol: { flex: 1 },
    rcHeader: { fontSize: 13, fontWeight: "700", textAlign: "center", marginBottom: 8 },
    rcRow: {
      flexDirection: "row", alignItems: "center",
      paddingVertical: 4, gap: 6,
    },
    rcIcon: { fontSize: 14, width: 20 },
    rcLabel: { fontSize: 11, color: theme.foreground, fontWeight: "500", width: 42 },
    rcBarBg: { flex: 1, height: 14, borderRadius: 7, backgroundColor: theme.muted, overflow: "hidden" },
    rcBarFill: { height: "100%", borderRadius: 7 },
    rcAmount: { fontSize: 11, color: theme.foreground, fontWeight: "600", width: 52, textAlign: "right" },
  }), [theme]);

  if (expenses.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.noData}>아직 지출 기록이 없어요</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Season Total */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>2026시즌 총 지출</Text>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>총</Text>
          <Text style={styles.totalAmount}>{stats.seasonTotal.toLocaleString()}</Text>
        </View>
      </View>

      {/* Category breakdown */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>카테고리별 지출</Text>
        {stats.categoryTotals.map((cat) => {
          const pct = Math.round((cat.amount / maxCatAmount) * 100);
          const color = cat.category === "ticket" ? "#3b82f6"
            : cat.category === "food" ? "#22c55e"
            : cat.category === "transport" ? "#f59e0b"
            : cat.category === "goods" ? "#a855f7"
            : cat.category === "uniform" ? "#ec4899"
            : "#6b7280";
          return (
            <View key={cat.category} style={styles.catRow}>
              <Text style={styles.catIcon}>{cat.icon}</Text>
              <Text style={styles.catLabel}>{cat.label}</Text>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
              </View>
              <Text style={styles.catAmount}>{formatAmount(cat.amount)}</Text>
            </View>
          );
        })}
      </View>

      {/* Monthly trend */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>월별 지출</Text>
        {stats.monthlyTotals.map((m, i) => (
          <View key={`${m.year}-${m.month}`} style={[styles.monthRow, i === stats.monthlyTotals.length - 1 && styles.monthLast]}>
            <Text style={styles.monthLabel}>{m.month}월</Text>
            <Text style={styles.monthAmount}>{formatAmount(m.amount)}</Text>
          </View>
        ))}
      </View>

      {/* Home vs Away */}
      {ha && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>홈 vs 원정 지출</Text>
          <View style={styles.duoRow}>
            {(["home", "away"] as const).map((key) => {
              const d = ha[key];
              const color = key === "home" ? "#3b82f6" : "#f59e0b";
              return (
                <View key={key} style={[styles.duoCard, { borderColor: color }]}>
                  <Text style={[styles.duoLabel, { color }]}>{key === "home" ? "홈" : "원정"}</Text>
                  <Text style={styles.duoGameCount}>{d.gameCount}경기</Text>
                  <Text style={styles.duoTotal}>{formatAmount(d.total)}</Text>
                  <Text style={styles.duoAvg}>경기당 {avgFmt(d.avgPerGame)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Win vs Loss */}
      {wl && (
        <View style={styles.card}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={styles.cardTitle}>승리 vs 패배 지출</Text>
            <Pressable
              onPress={() => setIncludeBroadcast((v) => !v)}
              style={{
                flexDirection: "row", alignItems: "center", gap: 6,
                paddingVertical: 4, paddingHorizontal: 10,
                borderRadius: 12,
                backgroundColor: includeBroadcast ? theme.foreground : theme.muted,
              }}
            >
              <View style={{
                width: 14, height: 14, borderRadius: 7,
                backgroundColor: includeBroadcast ? theme.background : theme.mutedForeground,
                alignItems: "center", justifyContent: "center",
              }}>
                {includeBroadcast && (
                  <Text style={{ fontSize: 10, color: theme.foreground, fontWeight: "700" }}>✓</Text>
                )}
              </View>
              <Text style={{
                fontSize: 12, fontWeight: "600",
                color: includeBroadcast ? theme.background : theme.mutedForeground,
              }}>
                집관 포함
              </Text>
            </Pressable>
          </View>
          <View style={styles.duoRow}>
            {(["win", "loss"] as const).map((key) => {
              const d = wl[key];
              const color = key === "win" ? "#22c55e" : "#ef4444";
              return (
                <View key={key} style={[styles.duoCard, { borderColor: color }]}>
                  <Text style={[styles.duoLabel, { color }]}>{key === "win" ? "승리" : "패배"}</Text>
                  <Text style={styles.duoGameCount}>{d.gameCount}경기</Text>
                  <Text style={styles.duoTotal}>{formatAmount(d.total)}</Text>
                  <Text style={styles.duoAvg}>경기당 {avgFmt(d.avgPerGame)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Per-stadium */}
      {stadiums && stadiums.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>구장별 지출</Text>
          {stadiums.map((s, i) => (
            <View key={s.stadium} style={[styles.stadiumRow, i === stadiums.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={styles.stadiumName}>{s.stadium}</Text>
              <View style={styles.stadiumRight}>
                <Text style={styles.stadiumTotal}>{formatAmount(s.total)}</Text>
                <Text style={styles.stadiumAvg}>{s.gameCount}경기 · 경기당 {avgFmt(s.avgPerGame)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Win/Loss x Category */}
      {rc && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>승패별 카테고리</Text>
          <View style={styles.duoRow}>
            {(["win", "loss"] as const).map((key) => {
              const map = rc[key];
              const color = key === "win" ? "#22c55e" : "#ef4444";
              const entries = Array.from(map.entries())
                .map(([cat, amt]) => ({ cat, amt, info: EXPENSE_CATEGORIES[cat as keyof typeof EXPENSE_CATEGORIES] || EXPENSE_CATEGORIES.other }))
                .sort((a, b) => b.amt - a.amt);
              const maxAmt = entries.length > 0 ? entries[0].amt : 1;
              return (
                <View key={key} style={styles.rcCol}>
                  <Text style={[styles.rcHeader, { color }]}>{key === "win" ? "승리" : "패배"}</Text>
                  {entries.length === 0 ? (
                    <Text style={styles.noData}>기록 없음</Text>
                  ) : (
                    entries.map((e) => {
                      const pct = Math.round((e.amt / maxAmt) * 100);
                      const c = e.cat === "ticket" ? "#3b82f6"
                        : e.cat === "food" ? "#22c55e"
                        : e.cat === "transport" ? "#f59e0b"
                        : e.cat === "goods" ? "#a855f7"
                        : e.cat === "uniform" ? "#ec4899"
                        : "#6b7280";
                      return (
                        <View key={e.cat} style={styles.rcRow}>
                          <Text style={styles.rcIcon}>{e.info.icon}</Text>
                          <Text style={styles.rcLabel}>{e.info.label}</Text>
                          <View style={styles.rcBarBg}>
                            <View style={[styles.rcBarFill, { width: `${pct}%`, backgroundColor: c }]} />
                          </View>
                          <Text style={styles.rcAmount}>{formatAmount(e.amt)}</Text>
                        </View>
                      );
                    })
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}
