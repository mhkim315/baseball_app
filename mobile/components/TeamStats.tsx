import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { TEAM_COLORS, TEAM_LIST } from "@shared/teamColors";
import { TeamBadge } from "@/components/TeamBadge";
import type { JikgwanRecord } from "@/lib/db";
import { computeOpponentStats, computeHomeAwayStats, computeDayOfWeekStats, computeStreakStats } from "@/lib/stats";
import type { OpponentStat, HomeAwayStat, DayOfWeekStat, StreakStat } from "@/lib/stats";
import { useTheme, teamPrimaryColor } from "@/lib/ThemeContext";

interface TeamStatsProps {
  records: JikgwanRecord[];
  teamId: string;
}

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

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

export default function TeamStats({ records, teamId }: TeamStatsProps) {
  const { theme, isDark } = useTheme();

  const opponentStats = useMemo(() => computeOpponentStats(records, teamId), [records, teamId]);
  const homeAway = useMemo(() => computeHomeAwayStats(records, teamId), [records, teamId]);
  const dayStats = useMemo(() => computeDayOfWeekStats(records), [records]);
  const streak = useMemo(() => computeStreakStats(records), [records]);

  const teamColor = teamPrimaryColor(teamId, isDark) || theme.foreground;
  const grayHex = isDark ? "#333" : "#e0e0e0";

  const styles = useMemo(() => StyleSheet.create({
    section: { marginTop: 24, paddingHorizontal: 20 },
    sectionTitle: { fontSize: 16, fontWeight: "bold", color: theme.foreground, marginBottom: 12 },
    card: {
      backgroundColor: theme.card, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: theme.border,
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

    // Opponent rows
    oppRow: {
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    oppTeam: { fontSize: 13, fontWeight: "600", color: theme.foreground, width: 50 },
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

    // Streak
    streakRow: {
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingVertical: 8,
    },
    streakBadge: {
      borderRadius: 12, paddingVertical: 6, paddingHorizontal: 16,
    },
    streakBadgeText: { fontSize: 18, fontWeight: "800" },
    streakSub: { fontSize: 12, color: theme.mutedForeground, marginTop: 2 },
  }), [theme, teamColor, grayHex]);

  const streakColor = streak.currentType === "W" ? "#22c55e" : streak.currentType === "L" ? "#ef4444" : theme.mutedForeground;
  const streakBg = streak.currentType === "W" ? "#22c55e20" : streak.currentType === "L" ? "#ef444420" : theme.muted;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>직관 분석</Text>

      {/* A) Home/Away */}
      <View style={[styles.card, { marginBottom: 12 }]}>
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

      {/* B) Opponent stats */}
      {opponentStats.length > 0 && (
        <View style={[styles.card, { marginBottom: 12 }]}>
          {opponentStats.map((opp) => {
            const oppColor = teamPrimaryColor(opp.opponentId, isDark) || theme.foreground;
            const oppName = TEAM_COLORS[opp.opponentId]?.shortName || opp.opponentId;
            return (
              <View key={opp.opponentId} style={styles.oppRow}>
                <TeamBadge teamId={opp.opponentId} size="sm" variant="ball" />
                <Text style={[styles.oppTeam, { color: oppColor }]}>{oppName}</Text>
                <Text style={styles.oppDetail}>{opp.wins}승 {opp.draws}무 {opp.losses}패</Text>
                <Text style={[styles.oppPct, { color: oppColor }]}>{formatPct(opp.winRate)}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* C) Day of week heatmap */}
      <View style={[styles.card, { marginBottom: 12 }]}>
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

      {/* D) Streak */}
      <View style={styles.card}>
        <View style={styles.streakRow}>
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
    </View>
  );
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
