import { useState, useMemo, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { TEAM_COLORS } from "@shared/teamColors";
import { EMOTION_CHARACTER } from "@/lib/emotions";
import { TeamBadge } from "@/components/TeamBadge";
import { useTheme, teamPrimaryColor } from "@/lib/ThemeContext";
import { computeDiaryStats, computeOpponentStats, computeHomeAwayStats, computeDayOfWeekStats, computeStreakStats, computeAttendanceScoring, type DiaryStats as Stats } from "@/lib/stats";
import { fetchScoreSummary } from "@/lib/api";
import { HISTORICAL_SCORING, scoringTeamName } from "@/lib/scoringData";
import { resolveIsWin } from "@/lib/expenseStats";
import { fetchStandingsJson } from "@/lib/api";
import { HISTORICAL_STANDINGS } from "@/lib/standingsData";
import type { JikgwanRecord } from "@/lib/db";
import { getAllTotemStats, type TotemWithStats } from "@/lib/db";

interface DiaryStatsProps {
  records: JikgwanRecord[];
  teamId: string | null;
  year: number;
}

function formatPct(v: number): string {
  return Math.round(v * 100) + "%";
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

export default function DiaryStats({ records, teamId, year }: DiaryStatsProps) {
  const { theme, isDark } = useTheme();
  const teamColor = teamId ? teamPrimaryColor(teamId, isDark) : theme.foreground;
  const [teamWinRate, setTeamWinRate] = useState<number | null>(null);

  useEffect(() => {
    if (!teamId) { setTeamWinRate(null); return; }
    const teamName = TEAM_COLORS[teamId]?.shortName;
    if (!teamName) { setTeamWinRate(null); return; }
    setTeamWinRate(null);
    if (year < 2026) {
      const rows = HISTORICAL_STANDINGS[year];
      if (rows) {
        const team = rows.find((r) => r.teamName === teamName);
        if (team) setTeamWinRate(team.winRate);
      }
    } else {
      fetchStandingsJson()
        .then((data) => {
          if (!data?.rows) return;
          const team = data.rows.find((r) => r.teamName === teamName);
          if (team) setTeamWinRate(team.winRate);
        })
        .catch(() => {});
    }
  }, [teamId, year]);

  const [teamAvgRuns, setTeamAvgRuns] = useState<number | null>(null);

  useEffect(() => {
    if (!teamId) { setTeamAvgRuns(null); return; }
    const teamName = TEAM_COLORS[teamId]?.shortName;
    if (!teamName) { setTeamAvgRuns(null); return; }
    setTeamAvgRuns(null);
    if (year < 2026) {
      const yearData = HISTORICAL_SCORING[year];
      if (yearData) {
        const key = scoringTeamName(teamName, year);
        const entry = yearData[key];
        if (entry) setTeamAvgRuns(entry.avgRuns);
      }
    } else {
      fetchScoreSummary(year).then((data) => {
        if (!data?.teams) return;
        const team = data.teams.find((t) => t.teamName === teamName);
        if (team) setTeamAvgRuns(team.avgRuns);
      }).catch(() => {});
    }
  }, [teamId, year]);

  // Filter records by selected year and optionally exclude exhibition games
  const [includeExhibition, setIncludeExhibition] = useState(true);
  const yearRecords = useMemo(() => {
    let filtered = records.filter((r) => r.date.startsWith(`${year}.`));
    if (!includeExhibition) {
      filtered = filtered.filter((r) => (r.game_type ?? null) !== "exhibition");
    }
    return filtered;
  }, [records, year, includeExhibition]);

  // Tier 1 — 직관 전용 (liveRecords), 토글 영향 없음
  const liveRecords = useMemo(() => yearRecords.filter((r) => Number(r.is_live) === 1), [yearRecords]);
  const liveStats = useMemo(() => computeDiaryStats(liveRecords, year), [liveRecords, year]);
  const allStats = useMemo(() => computeDiaryStats(yearRecords, year), [yearRecords, year]);
  const dayStatsLive = useMemo(() => computeDayOfWeekStats(liveRecords, year), [liveRecords, year]);
  const homeAwayLive = useMemo(() => teamId ? computeHomeAwayStats(liveRecords, teamId, year) : null, [liveRecords, teamId, year]);
  const stadiumStatsLive = useMemo(() => {
    const map = new Map<string, { wins: number; total: number }>();
    for (const r of liveRecords) {
      if (!r.stadium) continue;
      const entry = map.get(r.stadium) || { wins: 0, total: 0 };
      entry.total++;
      const iw = resolveIsWin(r);
      if (iw === 1) entry.wins++;
      map.set(r.stadium, entry);
    }
    return [...map.entries()]
      .map(([name, data]) => ({ name, count: data.total, winRate: data.total > 0 ? data.wins / data.total : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [liveRecords]);

  // Tier 2 — 토글 영향 받음 (하단 비교 섹션용)
  const [includeJipgwan, setIncludeJipgwan] = useState(false);
  const activeRecords = useMemo(() => includeJipgwan ? yearRecords : liveRecords, [includeJipgwan, yearRecords, liveRecords]);
  const teamRecords = useMemo(() => teamId ? activeRecords.filter((r) => r.cheered_team === teamId) : activeRecords, [activeRecords, teamId]);
  const activeStats = useMemo(() => computeDiaryStats(teamRecords, year), [teamRecords, year]);
  const opponentStats = useMemo(() => teamId ? computeOpponentStats(activeRecords, teamId, year) : [], [activeRecords, teamId, year]);
  const streakActive = useMemo(() => computeStreakStats(activeRecords, year), [activeRecords, year]);
  const activeScoring = useMemo(() => teamId ? computeAttendanceScoring(teamRecords, teamId, year) : null, [teamRecords, teamId, year]);
  const [totemStats, setTotemStats] = useState<TotemWithStats[]>([]);
  useEffect(() => { getAllTotemStats(activeRecords, true).then(setTotemStats).catch((e) => console.warn("getAllTotemStats failed", e)); }, [activeRecords]);

  const grayHex = isDark ? "#333" : "#e0e0e0";
  const streakColor = streakActive.currentType === "W" ? "#22c55e" : streakActive.currentType === "L" ? "#ef4444" : theme.mutedForeground;
  const streakBg = streakActive.currentType === "W" ? "#22c55e20" : streakActive.currentType === "L" ? "#ef444420" : theme.muted;

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
    stadiumGrid: {
      flexDirection: "row", gap: 4,
    },
    stadiumCell: {
      borderRadius: 8, paddingVertical: 8, paddingHorizontal: 4,
      alignItems: "center", gap: 2, minWidth: 40,
    },
    stadiumName: {
      fontSize: 13, fontWeight: "600",
    },
    stadiumMeta: {
      fontSize: 11, fontWeight: "500", opacity: 0.85,
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
    // 집관 포함 토글
    toggleTrack: {
      width: 40, height: 22, borderRadius: 11,
      backgroundColor: theme.muted,
      justifyContent: "center", paddingHorizontal: 2,
    },
    toggleThumb: {
      width: 18, height: 18, borderRadius: 9,
      backgroundColor: theme.foreground,
    },
    toggleThumbActive: {
      alignSelf: "flex-end", backgroundColor: "#fff",
    },
    toggleLabel: {
      fontSize: 12, fontWeight: "600", marginLeft: 8,
    },
    // Win rate contribution
    wrcRow: {
      flexDirection: "row", justifyContent: "space-around",
      marginBottom: 12,
    },
    wrcCol: { alignItems: "center", gap: 2 },
    wrcLabel: { fontSize: 12, color: theme.mutedForeground, marginBottom: 4 },
    wrcValue: { fontSize: 28, fontWeight: "800", color: theme.foreground },
    wrcSub: { fontSize: 11, color: theme.mutedForeground },
    wrcDiffRow: {
      flexDirection: "column", alignItems: "center", gap: 2,
      borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16,
    },
    wrcDiffLabel: { fontSize: 18, fontWeight: "800" },
    wrcDiffDesc: { fontSize: 12, fontWeight: "500" },
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
      flex: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 4,
      alignItems: "center", gap: 2,
    },
    dayLabel: { fontSize: 11, fontWeight: "600" },
    dayValue: { fontSize: 13, fontWeight: "700" },
    dayCount: { fontSize: 10, fontWeight: "500" },
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
    // Divider
    dividerSection: {
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingVertical: 8, marginTop: 8,
    },
    dividerLine: {
      flex: 1, height: 1, backgroundColor: theme.border,
    },
    dividerText: {
      fontSize: 12, color: theme.mutedForeground, fontWeight: "600",
    },
  }), [theme]);

  return (
    <View style={styles.container}>
      {/* 시범 제외 토글 — 모든 통계에 영향 */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end" }}>
        <Pressable
          style={[styles.toggleTrack, !includeExhibition && { backgroundColor: teamColor }]}
          onPress={() => setIncludeExhibition((v) => !v)}
        >
          <View style={[styles.toggleThumb, !includeExhibition && styles.toggleThumbActive]} />
        </Pressable>
        <Text style={[styles.toggleLabel, { color: !includeExhibition ? teamColor : theme.mutedForeground }]}>
          {!includeExhibition ? "시범 제외" : "시범 포함"}
        </Text>
      </View>

      {/* Win Rate Rings — always both */}
      <View style={styles.card}>
        <View style={styles.dualRingRow}>
          <RingSection stats={allStats} label="전체 승률" />
          <View style={styles.dualRingDivider} />
          <RingSection stats={liveStats} label="직관 승률" />
        </View>
      </View>

      {/* Home / Away (직관 only) */}
      {teamId && homeAwayLive && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>홈 / 원정</Text>
          <View style={styles.haRow}>
            <View style={styles.haCard}>
              <Text style={styles.haLabel}>홈</Text>
              <Text style={styles.haCounts}>{homeAwayLive.home.wins}승 {homeAwayLive.home.draws}무 {homeAwayLive.home.losses}패</Text>
              <Text style={[styles.haPct, { color: teamColor }]}>{formatPct(homeAwayLive.home.winRate)}</Text>
            </View>
            <View style={styles.haCard}>
              <Text style={styles.haLabel}>원정</Text>
              <Text style={styles.haCounts}>{homeAwayLive.away.wins}승 {homeAwayLive.away.draws}무 {homeAwayLive.away.losses}패</Text>
              <Text style={[styles.haPct, { color: teamColor }]}>{formatPct(homeAwayLive.away.winRate)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Day of week heatmap (직관 only) */}
      {teamId && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>요일별 승률</Text>
          <View style={styles.dayGrid}>
            {dayStatsLive.map((ds) => {
              const bg = ds.total === 0 ? grayHex : interpolateColor(grayHex, teamColor, ds.winRate);
              const fg = brightness(bg) > 150 ? "#000" : "#fff";
              return (
                <View key={ds.day} style={[styles.dayCell, { backgroundColor: bg }]}>
                  <Text style={[styles.dayLabel, { color: fg, opacity: 0.7 }]}>{ds.day}</Text>
                  <Text style={[styles.dayCount, { color: fg }]}>{ds.total}회</Text>
                  <Text style={[styles.dayValue, { color: fg }]}>
                    {ds.total > 0 ? formatPct(ds.winRate) : "-"}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Stadiums visited (직관 only) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>방문한 구장</Text>
        {stadiumStatsLive.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stadiumGrid}>
            {stadiumStatsLive.map((ss) => {
              const bg = interpolateColor(grayHex, teamColor, ss.winRate);
              const fg = brightness(bg) > 150 ? '#000' : '#fff';
              return (
                <View key={ss.name} style={[styles.stadiumCell, { backgroundColor: bg }]}>
                  <Text style={[styles.stadiumName, { color: fg }]} numberOfLines={1}>{ss.name}</Text>
                  <Text style={[styles.stadiumMeta, { color: fg }]}>{ss.count}회</Text>
                  <Text style={[styles.stadiumMeta, { color: fg }]}>
                    {ss.count > 0 ? formatPct(ss.winRate) : '-'}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={styles.noData}>아직 기록이 없어요</Text>
        )}
      </View>

      {/* Attendance Streak (직관 only) */}
      <View style={styles.streakCard}>
        <Text style={styles.cardTitle}>연속 직관</Text>
        <View style={styles.streakRow}>
          <View style={styles.streakItem}>
            <Text style={[styles.streakNum, { color: teamColor }]}>
              {liveStats.currentStreak}
            </Text>
            <Text style={styles.streakLabel}>현재 연속일</Text>
          </View>
          <View style={styles.streakDivider} />
          <View style={styles.streakItem}>
            <Text style={[styles.streakNum, { color: teamColor }]}>
              {liveStats.longestStreak}
            </Text>
            <Text style={styles.streakLabel}>최장 기록</Text>
          </View>
        </View>
      </View>

      {/* Season summary (직관 only) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{year}시즌</Text>
        <View style={styles.seasonRow}>
          <View style={styles.seasonItem}>
            <Text style={styles.seasonNum}>{liveStats.totalGames}</Text>
            <Text style={styles.seasonLabel}>경기 직관</Text>
          </View>
          <View style={styles.seasonItem}>
            <Text style={styles.seasonNum}>{liveStats.stadiums.length}</Text>
            <Text style={styles.seasonLabel}>방문 구장</Text>
          </View>
        </View>
      </View>

      {/* 집관 포함 토글 */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end" }}>
        <Pressable
          style={[styles.toggleTrack, includeJipgwan && { backgroundColor: teamColor }]}
          onPress={() => setIncludeJipgwan((v) => !v)}
        >
          <View style={[styles.toggleThumb, includeJipgwan && styles.toggleThumbActive]} />
        </Pressable>
        <Text style={[styles.toggleLabel, { color: includeJipgwan ? teamColor : theme.mutedForeground }]}>
          {includeJipgwan ? "집관 포함" : "집관 제외"}
        </Text>
      </View>

      {/* Totem stats (toggle-affected) */}
      {totemStats.some((t) => t.count > 0) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>토템 승률</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {totemStats.filter((t) => t.count > 0).map((t) => {
              const chipColor = t.color || theme.border;
              const wrPct = t.count > 0 ? Math.round(t.winRate * 100) : 0;
              return (
                <View key={t.id} style={{
                  borderRadius: 12, borderWidth: 1, borderColor: chipColor,
                  backgroundColor: chipColor + "10",
                  paddingVertical: 10, paddingHorizontal: 14,
                  alignItems: "center", gap: 2, minWidth: 70,
                }}>
                  <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: theme.foreground }} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: teamColor }}>
                    {wrPct}%
                  </Text>
                  <Text style={{ fontSize: 10, color: theme.mutedForeground }}>{t.count}회</Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Win rate contribution — 내 직관 승률 vs 팀 시즌 승률 */}
      {teamId && teamWinRate != null && teamRecords.length >= 5 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>승률 기여도</Text>
          <View style={styles.wrcRow}>
            <View style={styles.wrcCol}>
              <Text style={styles.wrcLabel}>내 승률</Text>
              <Text style={[styles.wrcValue, { color: teamColor }]}>
                {formatPct(activeStats.winRate)}
              </Text>
              <Text style={styles.wrcSub}>{activeStats.wins}승 {activeStats.draws}무 {activeStats.losses}패</Text>
            </View>
            <View style={styles.wrcCol}>
              <Text style={styles.wrcLabel}>팀 시즌</Text>
              <Text style={styles.wrcValue}>
                {formatPct(teamWinRate)}
              </Text>
              <Text style={styles.wrcSub}>{year}시즌</Text>
            </View>
          </View>
          {(() => {
            const diff = activeStats.winRate - teamWinRate;
            const absDiff = Math.abs(diff);
            const isPos = diff >= 0;
            return (
              <View style={[styles.wrcDiffRow, { backgroundColor: isPos ? "#22c55e20" : "#ef444420" }]}>
                <Text style={[styles.wrcDiffLabel, { color: isPos ? "#22c55e" : "#ef4444" }]}>
                  승률 기여도 {isPos ? "+" : "-"}{formatPct(absDiff)}
                </Text>
                <Text style={[styles.wrcDiffDesc, { color: isPos ? "#22c55e" : "#ef4444" }]}>
                  {isPos
                    ? (includeJipgwan ? "내가 함께 할 때 우리팀이 더 잘해요" : "내가 직관할 때 우리팀이 더 잘해요")
                    : (includeJipgwan ? "내가 함께 하면 우리팀이 못해요 😅" : "내가 직관할 때 우리팀이 못해요 😅")}
                </Text>
              </View>
            );
          })()}
        </View>
      )}

      {/* Scoring contribution (toggle-affected) */}
      {teamId && teamAvgRuns != null && activeScoring && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>득점 기여도</Text>
          <View style={styles.wrcRow}>
            <View style={styles.wrcCol}>
              <Text style={styles.wrcLabel}>내 평균</Text>
              <Text style={[styles.wrcValue, { color: teamColor }]}>
                {activeScoring.ourAvgRuns.toFixed(1)}점
              </Text>
              <Text style={styles.wrcSub}>{activeScoring.gameCount}경기</Text>
            </View>
            <View style={styles.wrcCol}>
              <Text style={styles.wrcLabel}>팀 시즌 평균</Text>
              <Text style={styles.wrcValue}>
                {teamAvgRuns.toFixed(1)}점
              </Text>
              <Text style={styles.wrcSub}>{year}시즌</Text>
            </View>
          </View>
          {(() => {
            const diff = activeScoring.ourAvgRuns - teamAvgRuns;
            const absDiff = Math.abs(diff);
            const isPos = diff >= 0;
            return (
              <View style={[styles.wrcDiffRow, { backgroundColor: isPos ? "#22c55e20" : "#ef444420" }]}>
                <Text style={[styles.wrcDiffLabel, { color: isPos ? "#22c55e" : "#ef4444" }]}>
                  득점 기여도 {isPos ? "+" : "-"}{absDiff.toFixed(1)}점
                </Text>
                <Text style={[styles.wrcDiffDesc, { color: isPos ? "#22c55e" : "#ef4444" }]}>
                  {isPos
                    ? (includeJipgwan ? "내가 함께 할 때 우리팀이 더 많은 점수를 내요" : "내가 직관할 때 우리팀이 더 많은 점수를 내요")
                    : (includeJipgwan ? "내가 함께 하면 우리팀이 점수를 못 내요 😅" : "내가 직관할 때 우리팀이 점수를 못 내요 😅")}
                </Text>
              </View>
            );
          })()}
        </View>
      )}

      {teamId && (
        <>
          {/* Win/Loss streak analysis (toggle-affected) */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>연승 / 연패</Text>
            <View style={styles.streakAnalysisRow}>
              {streakActive.currentCount > 0 && streakActive.currentType ? (
                <View style={[styles.streakBadge, { backgroundColor: streakBg }]}>
                  <Text style={[styles.streakBadgeText, { color: streakColor }]}>
                    {streakActive.currentCount}{streakActive.currentType === "W" ? "연승" : "연패"}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.streakBadgeText, { color: theme.mutedForeground, fontSize: 14 }]}>
                  기록 없음
                </Text>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.streakSub}>
                  최다 {streakActive.longestWin}연승 / {streakActive.longestLose}연패
                </Text>
              </View>
            </View>
          </View>

          {/* Opponent H2H (toggle-affected) */}
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
        </>
      )}

      {/* Emotion distribution (toggle-affected) */}
      {Object.keys(activeStats.emotionCounts).length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>감정 분포</Text>
          <View style={styles.emotionRow}>
            {Object.entries(activeStats.emotionCounts).map(([emotion, count]) => {
              const pct = activeStats.totalGames > 0
                ? ((count / activeStats.totalGames) * 100).toFixed(0)
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
    </View>
  );
}
