import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { TEAM_COLORS } from "@shared/teamColors";
import { TEAM_NAME_TO_ID, formatDate } from "@shared/constants";
import { type StandingRow } from "@/lib/api";
import { cachedStandings } from "@/lib/gameCache";
import { HISTORICAL_STANDINGS } from "@/lib/standingsData";
import YearSelector from "@/components/YearSelector";
import MyButton from "@/components/MyButton";
import CoachMark from "@/components/CoachMark";
import { useTheme } from "@/lib/ThemeContext";
import { teamPrimaryColor } from "@shared/teamColors";
import { useTeam } from "@/lib/TeamContext";
import { useNavigation } from "expo-router";
import { getVisitCount, getRankYearCoachSeen, setRankYearCoachSeen } from "@/lib/db";

function parseWLT(wlt: string | undefined | null): { wins: number; draws: number; losses: number } {
  const m = wlt?.match(/(\d+)승(\d+)무(\d+)패/);
  if (!m) return { wins: 0, draws: 0, losses: 0 };
  return { wins: parseInt(m[1]), draws: parseInt(m[2]), losses: parseInt(m[3]) };
}


function streakColor(streak: string | undefined | null): string {
  if (streak?.includes("승")) return "#2563eb";
  if (streak?.includes("무")) return "#d97706";
  return "#ef4444";
}

function formatLast10(last10?: string): string {
  if (!last10) return "-";
  const parts = last10.split("-");
  if (parts.length === 2) return `${parts[0]}승${parts[1]}패`;
  if (parts.length === 3) return `${parts[0]}승${parts[2]}무${parts[1]}패`;
  return last10;
}

export default function RankScreen() {
  const { theme, isDark } = useTheme();
  const [year, setYear] = useState(new Date().getFullYear());
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [fetchedAt, setFetchedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { myTeam } = useTeam();

  const load = useCallback(() => {
    // For past seasons (2021–2025), use local data
    if (year < 2026) {
      const data = HISTORICAL_STANDINGS[year];
      if (data) {
        setStandings(data);
        setFetchedAt("");
      } else {
        setStandings([]);
      }
      setLoading(false);
      setError(false);
      return;
    }

    // Current season (2026+) — fetch from API (via cache layer)
    setLoading(true);
    setError(false);
    cachedStandings().then((data) => {
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
  }, [year]);

  useEffect(() => { load(); }, [load]);

  // Rank YearSelector coach mark (visit 2+)
  const [showRankYearCoach, setShowRankYearCoach] = useState(false);
  const rankYearCoachChecked = useRef(false);

	  useEffect(() => {
	    if (loading || error || rankYearCoachChecked.current) return;
	    try {
	      if (!getRankYearCoachSeen()) {
	        rankYearCoachChecked.current = true;
	        setShowRankYearCoach(true);
	      } else {
	        rankYearCoachChecked.current = true;
	      }
	    } catch (e) { console.warn("coach: rankYear", e); }
	  }, [loading, error]);

  const navigationRank = useNavigation();
  useEffect(() => {
    const unsubscribe = navigationRank.addListener("blur", () => setShowRankYearCoach(false));
    return unsubscribe;
  }, [navigationRank]);

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
    headerTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.foreground,
    },
    headerSub: {
      fontSize: 13,
      color: theme.mutedForeground,
      marginTop: 4,
    },

    // States
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    errorText: {
      color: theme.mutedForeground,
      fontSize: 14,
      marginBottom: 16,
    },
    retryBtn: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      backgroundColor: theme.foreground,
      borderRadius: 20,
    },
    retryText: {
      color: theme.background,
      fontSize: 14,
      fontWeight: "600",
    },

    // Scroll
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },

    // Table
    table: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },
    tableHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: theme.muted,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tableRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },

    // Cells
    cell: {
      fontSize: 13.5,
      color: theme.foreground,
    },
    colRank: {
      width: 36,
      textAlign: "center",
    },
    colTeam: {
      flex: 1,
      marginRight: 4,
    },
    colNum: {
      width: 40,
      textAlign: "center",
    },
    colRate: {
      width: 54,
      textAlign: "center",
    },
    colGb: {
      width: 44,
      textAlign: "center",
    },
    colStreak: {
      width: 52,
      textAlign: "center",
      fontSize: 13,
      fontWeight: "600",
    },
    colGames: {
      width: 40,
      textAlign: "center",
    },
    colLast10: {
      width: 74,
      textAlign: "center",
      fontSize: 13,
    },

    // Rank styles
    rankBold: {
      fontWeight: "700",
      color: theme.foreground,
    },
    rankMuted: {
      color: theme.mutedForeground,
    },

    // Team cell
    teamCell: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    teamName: {
      fontSize: 13.5,
      fontWeight: "500",
      color: theme.foreground,
    },

    // Rate
    rateText: {
      fontWeight: "600",
    },

    // GB
    gbText: {
      fontSize: 12.5,
      color: theme.mutedForeground,
    },

    // Footer
    footer: {
      textAlign: "center",
      fontSize: 12.5,
      color: theme.mutedForeground,
      marginTop: 16,
    },
  }), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={styles.headerTitle}>순위</Text>
          <View style={{ flex: 1 }} />
          <YearSelector year={year} onYearChange={setYear} />
          <View style={{ width: 8 }} />
          <MyButton color={myTeam ? teamPrimaryColor(myTeam, isDark) : undefined} />
        </View>
        <Text style={styles.headerSub}>{year} KBO 리그</Text>
        {showRankYearCoach && (
          <View style={{ marginTop: 8 }}>
            <CoachMark
              visible showChevrons={false} arrowDirection="up" arrowAlign="right"
              text="연도를 변경하여 지난 시즌 순위를 확인해보세요"
              onDismiss={() => { setRankYearCoachSeen(); setShowRankYearCoach(false); }}
            />
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>데이터를 불러올 수 없습니다</Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>재시도</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.table}>
            {/* Header row */}
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.colRank]}>#</Text>
              <Text style={[styles.cell, styles.colTeam]}>팀</Text>
              <Text style={[styles.cell, styles.colGames]}>경기수</Text>
              <Text style={[styles.cell, styles.colNum]}>승</Text>
              <Text style={[styles.cell, styles.colNum]}>무</Text>
              <Text style={[styles.cell, styles.colNum]}>패</Text>
              <Text style={[styles.cell, styles.colRate]}>승률</Text>
              <Text style={[styles.cell, styles.colGb]}>차</Text>
              <Text style={[styles.cell, styles.colStreak]}>연속</Text>
              <Text style={[styles.cell, styles.colLast10]}>최근10경기</Text>
            </View>

            {/* Data rows */}
            {standings.map((row, idx) => {
              const teamId = TEAM_NAME_TO_ID[row.teamName];
              const team = teamId ? TEAM_COLORS[teamId] : null;
              const { wins, draws, losses } = parseWLT(row.wlt);
              const top5 = idx < 5;
              const isMyTeam = myTeam && teamId === myTeam;

              return (
                <View key={`${row.teamName}-${idx}`} style={[styles.tableRow, isMyTeam && teamId && { backgroundColor: teamPrimaryColor(teamId, isDark) + "20" }]}>
                  <Text style={[styles.cell, styles.colRank, idx === 0 ? { color: "#FFD700", fontWeight: "800" } : idx === 1 ? { color: "#C0C0C0", fontWeight: "800" } : idx === 2 ? { color: "#CD7F32", fontWeight: "800" } : top5 ? styles.rankBold : styles.rankMuted]}>
                    {row.rank}
                  </Text>
                  <View style={[styles.colTeam, styles.teamCell]}>
                    <Text style={styles.teamName} numberOfLines={1}>
                      {team?.shortName || row.teamName}
                    </Text>
                  </View>
                  <Text style={[styles.cell, styles.colGames]}>{row.gamesPlayed ?? "-"}</Text>
                  <Text style={[styles.cell, styles.colNum]}>{wins}</Text>
                  <Text style={[styles.cell, styles.colNum]}>{draws}</Text>
                  <Text style={[styles.cell, styles.colNum]}>{losses}</Text>
                  <Text style={[styles.cell, styles.colRate, styles.rateText]}>
                    {row.winRate != null ? Number(row.winRate) >= 1 ? "1.000" : Number(row.winRate).toFixed(3).slice(1) : "-"}
                  </Text>
                  <Text style={[styles.cell, styles.colGb, styles.gbText]}>
                    {row.gamesBehind == null || Number(row.gamesBehind) === 0 ? "-" : Number(row.gamesBehind).toFixed(1)}
                  </Text>
                  <Text style={[styles.cell, styles.colStreak, { color: row.streak ? streakColor(row.streak) : theme.mutedForeground }]}>
                    {row.streak || "-"}
                  </Text>
                  <Text style={[styles.cell, styles.colLast10, { color: theme.mutedForeground }]}>{formatLast10(row.last10)}</Text>
                </View>
              );
            })}
          </View>
          </ScrollView>

          {fetchedAt && (
            <Text style={styles.footer}>{formatDate(new Date(fetchedAt))} 기준</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}
