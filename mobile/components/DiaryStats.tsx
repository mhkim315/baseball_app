import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { TEAM_COLORS } from "@shared/teamColors";
import { EMOTION_CHARACTER } from "@/components/EmotionPicker";
import { TeamBadge } from "@/components/TeamBadge";
import { useTheme, teamPrimaryColor } from "@/lib/ThemeContext";
import { computeDiaryStats, computeOpponentStats, computeHomeAwayStats, computeDayOfWeekStats, computeStreakStats, type DiaryStats as Stats } from "@/lib/stats";
import type { JikgwanRecord } from "@/lib/db";

interface DiaryStatsProps {
  records: JikgwanRecord[];
  teamId: string | null;
}

function formatPct(v: number): string {
  return (v * 100).toFixed(1) + "%";
}

function brightness(hex: string): number {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16) || 0;
  const g = parseInt(c.slice(2, 4), 16) || 0;
  const b = parseInt(c.slice(4, 6), 16) || 0;
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function interpolateColor(from: string, to: string, t: number): string {
  const fr = parseInt(from.slice(1, 3), 16) || 0;
  const fg = parseInt(from.slice(3, 5), 16) || 0;
  const fb = parseInt(from.slice(5, 7), 16) || 0;
  const tr = parseInt(to.slice(1, 3), 16) || 0;
  const tg = parseInt(to.slice(3, 5), 16) || 0;
  const tb = parseInt(to.slice(5, 7), 16) || 0;
  const r = Math.round(fr + (tr - fr) * t);
  const g = Math.round(fg + (tg - fg) * t);
  const b = Math.round(fb + (tb - fb) * t);
  return `rgb(${r},${g},${b})`;
}

export default function DiaryStats({ records, teamId }: DiaryStatsProps) {
  const { theme, isDark } = useTheme();
  const overallStats: Stats = computeDiaryStats(records);
  const liveRecords = records.filter((r) => r.is_live === 1);
  const liveStats: Stats | null = liveRecords.length > 0 ? computeDiaryStats(liveRecords) : null;
  const teamColor = teamId ? teamPrimaryColor(teamId, isDark) : theme.foreground;
  const opponentStats = useMemo(() => teamId ? computeOpponentStats(records, teamId) : [], [records, teamId]);
  const homeAway = useMemo(() => teamId ? computeHomeAwayStats(records, teamId) : null, [records, teamId]);
  const dayStats = useMemo(() => computeDayOfWeekStats(records), [records]);
  const streak = useMemo(() => computeStreakStats(records), [records]);

  const grayHex = isDark ? "#333" : "#e0e0e0";
  const streakColor = streak.currentType === "W" ? "#22c55e" : streak.currentType === "L" ? "#ef4444" : theme.mutedForeground;
  const streakBg = streak.currentType === "W" ? "#22c55e20" : streak.currentType === "L" ? "#ef444420" : theme.muted;

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
    // Home/Away
    haRow: { flexDirection: "row", gap: 12 },
    haCard: {
      flex: 1, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: theme.border,
    },
    haLabel: { fontSize: 13, fontWeight: "600", color: theme.mutedForeground, marginBottom: 4 },
    haCounts: { fontSize: 14, color: theme.foreground, fontWeight: "500", marginBottom: 2 },
    haPct: { fontSize: 20, fontWeight: "700" },
    // Opponent H2H
    oppRow: {
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    oppTeamName: { fontSize: 13, fontWeight: "600", color: theme.foreground, width: 50 },
    oppDetail: { fontSize: 12, color: theme.mutedForeground, flex: 1 },
    oppPct: { fontSize: 14, fontWeight: "700", textAlign: "right" },
    // Day heatmap
    dayGrid: { flexDirection: "row", gap: 4 },
    dayCell: {
      flex: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 2,
      alignItems: "center",
    },
    dayLabel: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
    dayValue: { fontSize: 13, fontWeight: "700" },
    // Streak analysis
    streakAnalysisRow: {
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingVertical: 8,
    },
    streakBadge: {
      borderRadius: 12, paddingVertical: 6, paddingHorizontal: 16,
    },
    streakBadgeText: { fontSize: 18, fontWeight: "800" },
    streakSub: { fontSize: 12, color: theme.mutedForeground, marginTop: 2 },
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

      {teamId && homeAway && (
        <>
          {/* Home/Away */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>홈 / 원정</Text>
            <View style={styles.haRow}>
              <View style={styles.haCard}>
                <Text style={styles.haLabel}>홈</Text>
                <Text style={styles.haCounts}>{homeAway.home.wins}승 {homeAway.home.draws}무 {homeAway.home.losses}패</Text>
                <Text style={[styles.haPct, { color: teamColor }]}>{formatPct(homeAway.home.winRate)}</Text>
              </View>
              <View style={styles.haCard}>
                <Text style={styles.haLabel}>원정</Text>
                <Text style={styles.haCounts}>{homeAway.away.wins}승 {homeAway.away.draws}무 {homeAway.away.losses}패</Text>
                <Text style={[styles.haPct, { color: teamColor }]}>{formatPct(homeAway.away.winRate)}</Text>
              </View>
            </View>
          </View>

          {/* Opponent H2H */}
          {opponentStats.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>상대전적</Text>
              {opponentStats.map((opp) => {
                const oppColor = teamPrimaryColor(opp.opponentId, isDark) || theme.foreground;
                const oppName = TEAM_COLORS[opp.opponentId]?.shortName || opp.opponentId;
                return (
                  <View key={opp.opponentId} style={styles.oppRow}>
                    <TeamBadge teamId={opp.opponentId} size="sm" variant="ball" />
                    <Text style={[styles.oppTeamName, { color: oppColor }]}>{oppName}</Text>
                    <Text style={styles.oppDetail}>{opp.wins}승 {opp.draws}무 {opp.losses}패</Text>
                    <Text style={[styles.oppPct, { color: oppColor }]}>{formatPct(opp.winRate)}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Day of week heatmap */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>요일별 승률</Text>
            <View style={styles.dayGrid}>
              {dayStats.map((ds) => {
                const bg = ds.total === 0 ? grayHex : interpolateColor(grayHex, teamColor, ds.winRate);
                const fg = brightness(bg) > 150 ? "#000" : "#fff";
                return (
                  <View key={ds.day} style={[styles.dayCell, { backgroundColor: bg }]}>
                    <Text style={[styles.dayLabel, { color: fg, opacity: 0.7 }]}>{ds.day}</Text>
                    <Text style={[styles.dayValue, { color: fg }]}>
                      {ds.total > 0 ? formatPct(ds.winRate) : "-"}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Win/Loss streak */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>연승 / 연패</Text>
            <View style={styles.streakAnalysisRow}>
              {streak.currentCount > 0 && streak.currentType ? (
                <View style={[styles.streakBadge, { backgroundColor: streakBg }]}>
                  <Text style={[styles.streakBadgeText, { color: streakColor }]}>
                    {streak.currentCount}{streak.currentType === "W" ? "연승" : "연패"}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.streakBadgeText, { color: theme.mutedForeground, fontSize: 14 }]}>
                  기록 없음
                </Text>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.streakSub}>
                  최다 {streak.longestWin}연승 / {streak.longestLose}연패
                </Text>
              </View>
            </View>
          </View>
        </>
      )}

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

