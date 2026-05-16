import { View, Text, StyleSheet } from "react-native";
import { TEAM_COLORS } from "@shared/teamColors";
import { EMOTION_CHARACTER } from "@/components/EmotionPicker";
import { TeamBadge } from "@/components/TeamBadge";
import { theme } from "@/lib/theme";
import { computeDiaryStats, type DiaryStats as Stats } from "@/lib/stats";
import type { JikgwanRecord } from "@/lib/db";

interface DiaryStatsProps {
  records: JikgwanRecord[];
  teamId: string | null;
}

export default function DiaryStats({ records, teamId }: DiaryStatsProps) {
  const stats: Stats = computeDiaryStats(records);
  const teamColor = teamId ? TEAM_COLORS[teamId]?.primary : theme.foreground;

  const winRatePct = stats.totalGames > 0
    ? (stats.winRate * 100).toFixed(1)
    : "-";

  const fillAngle = stats.totalGames > 0 ? stats.winRate * 360 : 0;

  return (
    <View style={styles.container}>
      {/* Win Rate Ring */}
      <View style={styles.ringCard}>
        <Text style={styles.cardTitle}>직관 승률</Text>
        <View style={styles.ringContainer}>
          {/* Simple ring using border approach */}
          <View style={[styles.ringOuter, { borderColor: theme.border }]}>
            <View style={[styles.ringInner, { borderColor: teamColor }]}>
              <Text style={[styles.ringValue, { color: teamColor }]}>{winRatePct}%</Text>
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

      {/* Streak */}
      <View style={styles.streakCard}>
        <Text style={styles.cardTitle}>연속 직관</Text>
        <View style={styles.streakRow}>
          <View style={styles.streakItem}>
            <Text style={[styles.streakNum, { color: teamColor }]}>
              {stats.currentStreak}
            </Text>
            <Text style={styles.streakLabel}>현재 연속일</Text>
          </View>
          <View style={styles.streakDivider} />
          <View style={styles.streakItem}>
            <Text style={[styles.streakNum, { color: teamColor }]}>
              {stats.longestStreak}
            </Text>
            <Text style={styles.streakLabel}>최장 기록</Text>
          </View>
        </View>
      </View>

      {/* Stadiums visited */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>방문한 구장</Text>
        {stats.stadiums.length > 0 ? (
          <View style={styles.stadiumRow}>
            {stats.stadiums.map((s) => (
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
      {Object.keys(stats.emotionCounts).length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>감정 분포</Text>
          <View style={styles.emotionRow}>
            {Object.entries(stats.emotionCounts).map(([emotion, count]) => {
              const pct = stats.totalGames > 0
                ? ((count / stats.totalGames) * 100).toFixed(0)
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
            <Text style={styles.seasonNum}>{stats.totalGames}</Text>
            <Text style={styles.seasonLabel}>경기 직관</Text>
          </View>
          <View style={styles.seasonItem}>
            <Text style={styles.seasonNum}>{stats.stadiums.length}</Text>
            <Text style={styles.seasonLabel}>방문 구장</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    alignItems: "center",
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
});
