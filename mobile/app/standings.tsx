import { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { TEAM_COLORS } from "@shared/teamColors";
import { TEAM_NAME_TO_ID } from "@shared/constants";
import { fetchStandingsJson, type StandingRow } from "@/lib/api";
import { useTheme, teamPrimaryColor } from "@/lib/ThemeContext";

export default function StandingsScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [fetchedAt, setFetchedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchStandingsJson().then((data) => {
      if (data) {
        setStandings(data.rows);
        setFetchedAt(data.fetchedAt);
      } else {
        setError(true);
      }
      setLoading(false);
    }).catch(() => {
      setError(true);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const getStreakColor = (streak: string) => {
    if (streak.includes("패")) return { color: "#d32f2f" };
    if (streak.includes("승")) return { color: "#1565c0" };
    return { color: theme.mutedForeground };
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },

    // Header
    headerBar: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingTop: 60, paddingHorizontal: 16, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    backBtn: { padding: 8, width: 60 },
    backText: { color: theme.foreground, fontSize: 20 },
    headerTitle: { fontSize: 17, fontWeight: "600", color: theme.foreground },

    // Table scroll
    tableScroll: { flex: 1 },

    // Table
    tableHeader: { flexDirection: "row", backgroundColor: theme.muted, borderBottomWidth: 1, borderBottomColor: theme.border },
    headerCell: { fontSize: 11, fontWeight: "700", color: theme.mutedForeground, paddingVertical: 10 },
    tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: theme.border },
    cell: { paddingVertical: 10, paddingHorizontal: 6, fontSize: 12, color: theme.foreground },
    rankCell: { width: 36, textAlign: "center" },
    teamCellH: { width: 70 },
    teamCell: { width: 70, flexDirection: "row", alignItems: "center", gap: 4 },
    teamDot: { width: 8, height: 8, borderRadius: 4 },
    teamName: { fontSize: 12, color: theme.foreground, fontWeight: "500" },
    statCell: { width: 48, textAlign: "center" },

    // Loading / Error
    loadingRow: { paddingVertical: 60, alignItems: "center" },
    errorText: { color: theme.mutedForeground, fontSize: 14, marginBottom: 16 },
    retryBtn: { paddingVertical: 8, paddingHorizontal: 20, backgroundColor: theme.foreground, borderRadius: 16 },
    retryText: { color: theme.background, fontSize: 13, fontWeight: "600" },

    // Footer
    footer: { padding: 12, alignItems: "center" },
    footerText: { fontSize: 11, color: theme.mutedForeground },
  }), [theme]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>📊 순위</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
        <View>
          {/* Table header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.cell, styles.rankCell, styles.headerCell]}>순위</Text>
            <Text style={[styles.cell, styles.teamCellH, styles.headerCell]}>팀</Text>
            <Text style={[styles.cell, styles.statCell, styles.headerCell]}>경기</Text>
            <Text style={[styles.cell, styles.statCell, styles.headerCell]}>승</Text>
            <Text style={[styles.cell, styles.statCell, styles.headerCell]}>무</Text>
            <Text style={[styles.cell, styles.statCell, styles.headerCell]}>패</Text>
            <Text style={[styles.cell, styles.statCell, styles.headerCell]}>승률</Text>
            <Text style={[styles.cell, styles.statCell, styles.headerCell]}>게임차</Text>
            <Text style={[styles.cell, styles.statCell, styles.headerCell]}>연속</Text>
          </View>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : error ? (
            <View style={styles.loadingRow}>
              <Text style={styles.errorText}>순위를 불러올 수 없습니다</Text>
              <Pressable onPress={load} style={styles.retryBtn}>
                <Text style={styles.retryText}>재시도</Text>
              </Pressable>
            </View>
          ) : (
            standings.map((row, i) => {
              const teamId = TEAM_NAME_TO_ID[row.teamName] || "";
              const teamColor = TEAM_COLORS[teamId];
              const wlt = row.wlt.match(/(\d+)승(\d+)무(\d+)패/);
              const wins = wlt ? parseInt(wlt[1]) : 0;
              const draws = wlt ? parseInt(wlt[2]) : 0;
              const losses = wlt ? parseInt(wlt[3]) : 0;
              const total = wins + draws + losses;

              return (
                <View key={i} style={[styles.tableRow, i % 2 === 1 && { backgroundColor: theme.secondary }]}>
                  <Text style={[styles.cell, styles.rankCell]}>{row.rank}</Text>
                  <View style={[styles.cell, styles.teamCell]}>
                    {teamColor && <View style={[styles.teamDot, { backgroundColor: teamPrimaryColor(teamId, isDark) }]} />}
                    <Text style={styles.teamName} numberOfLines={1}>{row.teamName}</Text>
                  </View>
                  <Text style={[styles.cell, styles.statCell]}>{total}</Text>
                  <Text style={[styles.cell, styles.statCell, { color: "#1565c0" }]}>{wins}</Text>
                  <Text style={[styles.cell, styles.statCell]}>{draws}</Text>
                  <Text style={[styles.cell, styles.statCell, { color: "#d32f2f" }]}>{losses}</Text>
                  <Text style={[styles.cell, styles.statCell, { fontWeight: "700" }]}>
                    {(row.winRate * 100).toFixed(3).slice(0, -1)}
                  </Text>
                  <Text style={[styles.cell, styles.statCell]}>
                    {row.gamesBehind === 0 ? "-" : row.gamesBehind.toFixed(1)}
                  </Text>
                  <Text style={[styles.cell, styles.statCell, getStreakColor(row.streak)]}>
                    {row.streak}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {fetchedAt && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>마지막 업데이트: {formatDate(fetchedAt)}</Text>
        </View>
      )}
    </View>
  );
}

function formatDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return isoStr;
  }
}
