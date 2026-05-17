import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { TEAM_COLORS } from "@shared/teamColors";
import { EMOTION_CHARACTER } from "@/components/EmotionPicker";
import { TeamBadge } from "@/components/TeamBadge";
import { useTheme, teamPrimaryColor } from "@/lib/ThemeContext";
import { computeDiaryStats, type DiaryStats as Stats } from "@/lib/stats";
import type { JikgwanRecord } from "@/lib/db";

interface DiaryStatsProps {
  records: JikgwanRecord[];
  teamId: string | null;
}

export default function DiaryStats({ records, teamId }: DiaryStatsProps) {
  const { theme, isDark } = useTheme();
  const overallStats: Stats = computeDiaryStats(records);
  const liveRecords = records.filter((r) => r.is_live === 1);
  const liveStats: Stats | null = liveRecords.length > 0 ? computeDiaryStats(liveRecords) : null;
  const teamColor = teamId ? teamPrimaryColor(teamId, isDark) : theme.foreground;

  function RingSection({ stats, label }: { stats: Stats; label: string }) {
    const wrPct = stats.totalGames > 0 ? (stats.winRate * 100).toFixed(1) : "-";
    return (
      <View style={styles.dualRingCol}>
        <Text style={styles.cardTitle}>{label}</Text>
        <View style={styles.ringContainer}>
          <View style={[styles.ringOuter, { borderColor: theme.border }]}>
            <View style={[styles.ringInner, { borderColor: teamColor }]}>
              <Text style={[styles.ringValue, { color: teamColor }]}>{wrPct}%</Text>
              <Text style={styles.ringLabel}>승률</Text>
            </View>
          </View>
        </View>
        <View style={styles.recordRow}>
          <View style={styles.recordItem}>
            <Text style={styles.recordNum}>{stats.totalGames}</Text>
            <Text style={styles.recordLabel}>경기</Text>
          </View>
          <View style={styles.recordItem}>
            <Text style={[styles.recordNum, { color: "#22c55e" }]}>{stats.wins}</Text>
            <Text style={styles.recordLabel}>승</Text>
          </View>
          <View style={styles.recordItem}>
            <Text style={[styles.recordNum, { color: "#d97706" }]}>{stats.draws}</Text>
            <Text style={styles.recordLabel}>무</Text>
          </View>
          <View style={styles.recordItem}>
            <Text style={[styles.recordNum, { color: "#ef4444" }]}>{stats.losses}</Text>
            <Text style={styles.recordLabel}>패</Text>
          </View>
        </View>
      </View>
    );
  }

  const styles = useMemo(() => StyleSheet.create({
    container: {
      gap: 16,
      paddingBottom: 100,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.foreground,
      marginBottom: 12,
    },
    // Win rate ring card
    ringCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
    },
    dualRingRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "flex-start",
    },
    dualRingCol: {
      flex: 1,
      alignItems: "center",
    },
    dualRingDivider: {
      width: 1,
      height: 140,
      backgroundColor: theme.border,
      marginHorizontal: 8,
    },
    ringContainer: {
      alignItems: "center",
      marginBottom: 16,
    },
    ringOuter: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 8,
      justifyContent: "center",
      alignItems: "center",
    },
    ringInner: {
      width: 96,
      height: 96,
      borderRadius: 48,
      borderWidth: 6,
      justifyContent: "center",
      alignItems: "center",
    },
    ringValue: {
      fontSize: 22,
      fontWeight: "700",
    },
    ringLabel: {
      fontSize: 10,
      color: theme.mutedForeground,
      marginTop: 1,
    },
    recordRow: {
      flexDirection: "row",
      gap: 24,
    },
    recordItem: {
      alignItems: "center",
      gap: 2,
    },
    recordNum: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.foreground,
    },
    recordLabel: {
      fontSize: 10,
      color: theme.mutedForeground,
    },
    // Streak
    streakCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
    },
    streakRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    streakItem: {
      flex: 1,
      alignItems: "center",
      gap: 4,
    },
    streakNum: {
      fontSize: 36,
      fontWeight: "700",
    },
    streakLabel: {
      fontSize: 11,
      color: theme.mutedForeground,
    },
    streakDivider: {
      width: 1,
      height: 40,
      backgroundColor: theme.border,
    },
    // Stadiums
    stadiumRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    stadiumBadge: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    stadiumText: {
      fontSize: 12,
      fontWeight: "500",
    },
    // Emotion
    emotionRow: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
    emotionItem: {
      alignItems: "center",
      gap: 4,
    },
    emotionEmoji: {
      fontSize: 24,
    },
    emotionPct: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.foreground,
    },
    // Season
    seasonRow: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
    seasonItem: {
      alignItems: "center",
      gap: 4,
    },
    seasonNum: {
      fontSize: 28,
      fontWeight: "700",
      color: theme.foreground,
    },
    seasonLabel: {
      fontSize: 11,
      color: theme.mutedForeground,
    },
    noData: {
      fontSize: 13,
      color: theme.mutedForeground,
      textAlign: "center",
      paddingVertical: 16,
    },
  }), [theme]);

  return (
    <View style={styles.container}>
      {/* Win Rate Rings */}
      <View style={styles.ringCard}>
        <View style={styles.dualRingRow}>
          <RingSection stats={overallStats} label="전체 승률" />
          {liveStats && <View style={styles.dualRingDivider} />}
          {liveStats && <RingSection stats={liveStats} label="직관 승률" />}
        </View>
      </View>

      {/* Streak */}
      <View style={styles.streakCard}>
        <Text style={styles.cardTitle}>연속 직관</Text>
        <View style={styles.streakRow}>
          <View style={styles.streakItem}>
            <Text style={[styles.streakNum, { color: teamColor }]}>
              {overallStats.currentStreak}
            </Text>
            <Text style={styles.streakLabel}>현재 연속일</Text>
          </View>
          <View style={styles.streakDivider} />
          <View style={styles.streakItem}>
            <Text style={[styles.streakNum, { color: teamColor }]}>
              {overallStats.longestStreak}
            </Text>
            <Text style={styles.streakLabel}>최장 기록</Text>
          </View>
        </View>
      </View>

      {/* Stadiums visited */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>방문한 구장</Text>
        {overallStats.stadiums.length > 0 ? (
          <View style={styles.stadiumRow}>
            {overallStats.stadiums.map((s) => (
              <View key={s} style={[styles.stadiumBadge, { borderColor: teamColor }]}>
                <Text style={[styles.stadiumText, { color: teamColor }]}>{s}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noData}>아직 기록이 없어요</Text>
        )}
      </View>

      {/* Emotion distribution */}
      {Object.keys(overallStats.emotionCounts).length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>감정 분포</Text>
          <View style={styles.emotionRow}>
            {Object.entries(overallStats.emotionCounts).map(([emotion, count]) => {
              const pct = overallStats.totalGames > 0
                ? ((count / overallStats.totalGames) * 100).toFixed(0)
                : "0";
              const char = EMOTION_CHARACTER[emotion];
              return (
                <View key={emotion} style={styles.emotionItem}>
                  {teamId && char ? (
                    <TeamBadge teamId={teamId} size="sm" emotion={char} />
                  ) : (
                    <Text style={styles.emotionEmoji}>⚾</Text>
                  )}
                  <Text style={styles.emotionPct}>{pct}%</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Season progress */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>2026시즌</Text>
        <View style={styles.seasonRow}>
          <View style={styles.seasonItem}>
            <Text style={styles.seasonNum}>{overallStats.totalGames}</Text>
            <Text style={styles.seasonLabel}>경기 직관</Text>
          </View>
          <View style={styles.seasonItem}>
            <Text style={styles.seasonNum}>{overallStats.stadiums.length}</Text>
            <Text style={styles.seasonLabel}>방문 구장</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

