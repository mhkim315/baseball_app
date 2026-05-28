import { useState, useEffect, useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/lib/ThemeContext";
import { useTeam } from "@/lib/TeamContext";
import { teamPrimaryColor } from "@shared/teamColors";
import { getJikgwanRecords, getBadges, getAllExpenses, type JikgwanRecord, type Badge } from "@/lib/db";
import { computeSeasonSummary, computeLevel, BADGE_DEFINITIONS, type SeasonSummary } from "@/lib/achievements";
import { TEAM_COLORS } from "@shared/teamColors";

interface YearInReviewProps {
  year: number;
  onClose: () => void;
}

const EMOTION_EMOJI: Record<string, string> = {
  joyful: "😊", sad: "😢", angry: "😤", furious: "🤬",
  shocked: "😲", neutral: "😐", determined: "💪",
};

export default function YearInReview({ year, onClose }: YearInReviewProps) {
  const { theme, isDark } = useTheme();
  const { myTeam } = useTeam();
  const teamColor = myTeam ? teamPrimaryColor(myTeam, isDark) : "#e07b3c";
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SeasonSummary | null>(null);
  const [levelTitle, setLevelTitle] = useState("");
  const [levelEmoji, setLevelEmoji] = useState("🥚");

  useEffect(() => {
    (async () => {
      try {
        const [records, badges, expenses] = await Promise.all([
          getJikgwanRecords(),
          getBadges(),
          getAllExpenses(),
        ]);
        const totalSpent = expenses
          .filter((e) => e.date?.startsWith(`${year}.`))
          .reduce((s, e) => s + e.amount, 0);
        const s = computeSeasonSummary(year, records, badges, totalSpent);
        setSummary(s);
        const li = computeLevel(badges);
        setLevelTitle(li.title);
        const emoji = li.level >= 7 ? "👑" : li.level >= 5 ? "🏆" : li.level >= 3 ? "🥇" : "🥚";
        setLevelEmoji(emoji);
      } catch {} finally { setLoading(false); }
    })();
  }, [year]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16,
      backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    headerTitle: { fontSize: 16, fontWeight: "700", color: theme.foreground },
    closeBtn: { fontSize: 14, color: theme.mutedForeground },
    content: { paddingHorizontal: 20, paddingBottom: 60, gap: 20, paddingTop: 20 },

    cover: {
      alignItems: "center", paddingVertical: 40, borderRadius: 20,
      backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
    },
    coverEmoji: { fontSize: 56, marginBottom: 12 },
    coverTitle: { fontSize: 26, fontWeight: "800", color: theme.foreground, textAlign: "center" },
    coverSub: { fontSize: 15, color: theme.mutedForeground, marginTop: 6 },

    section: {
      backgroundColor: theme.card, borderRadius: 16, borderWidth: 1,
      borderColor: theme.border, padding: 20,
    },
    sectionTitle: { fontSize: 18, fontWeight: "700", color: theme.foreground, marginBottom: 14 },

    statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 0 },
    statCell: { width: "50%", paddingVertical: 12, alignItems: "center" },
    statNum: { fontSize: 24, fontWeight: "800" },
    statLabel: { fontSize: 12, color: theme.mutedForeground, marginTop: 2 },

    stadiumChip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
      marginRight: 8, marginBottom: 8,
    },
    stadiumChipText: { fontSize: 14, fontWeight: "600", color: "#fff" },

    opponentRow: { flexDirection: "row", gap: 12, marginTop: 8 },
    opponentCard: {
      flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.border,
      alignItems: "center",
    },
    opponentName: { fontSize: 16, fontWeight: "700", color: theme.foreground, marginTop: 4 },

    emotionBar: { flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", marginTop: 8 },
    emotionRow: { flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 6 },
    emotionItem: { alignItems: "center", gap: 2 },
    emotionText: { fontSize: 18 },

    badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
    badgeChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    badgeChipText: { fontSize: 16 },

    closing: {
      alignItems: "center", paddingVertical: 32, borderRadius: 20,
      backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
    },
    closingEmoji: { fontSize: 40, marginBottom: 12 },
    closingTitle: { fontSize: 20, fontWeight: "800", color: theme.foreground },
    closingSub: { fontSize: 14, color: theme.mutedForeground, marginTop: 6, textAlign: "center" },
    shareBtn: {
      marginTop: 20, paddingHorizontal: 28, paddingVertical: 12,
      borderRadius: 24, backgroundColor: "#e07b3c",
    },
    shareBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  }), [theme]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{year} 시즌 리캡</Text>
          <Pressable onPress={onClose}><Text style={styles.closeBtn}>닫기</Text></Pressable>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: theme.mutedForeground, fontSize: 16 }}>데이터를 불러오는 중...</Text>
        </View>
      </View>
    );
  }

  if (!summary || summary.totalGames < 5) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{year} 시즌 리캡</Text>
          <Pressable onPress={onClose}><Text style={styles.closeBtn}>닫기</Text></Pressable>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 }}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>⚾</Text>
          <Text style={{ fontSize: 17, fontWeight: "700", color: theme.foreground, textAlign: "center" }}>
            {summary?.totalGames === 0
              ? `${year}년 직관 기록이 없습니다`
              : `아직 데이터가 부족해요\n(최소 5경기 필요)`}
          </Text>
          <Text style={{ fontSize: 14, color: theme.mutedForeground, marginTop: 8, textAlign: "center" }}>
            {year}년 기록을 쌓아가면{'\n'}시즌이 끝난 후 리캡을 확인할 수 있어요
          </Text>
        </View>
      </View>
    );
  }

  const s = summary;
  const winText = s.winRate >= 0.7 ? "압도적인" : s.winRate >= 0.6 ? "멋진" : s.winRate >= 0.5 ? "든든한" : "값진";

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{year} 시즌 리캡</Text>
        <Pressable onPress={onClose}><Text style={styles.closeBtn}>닫기</Text></Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Cover */}
        <View style={styles.cover}>
          <Text style={styles.coverEmoji}>{levelEmoji}</Text>
          <Text style={styles.coverTitle}>{year}, 당신의 야구</Text>
          <Text style={styles.coverSub}>
            LV.{computeLevel([{ id: "x", badge_key: "x", unlocked_date: null, progress_current: 0, progress_target: 0, is_notified: 0 }] as Badge[]).level} {levelTitle}
          </Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>이번 시즌 기록</Text>
          <View style={styles.statGrid}>
            <View style={styles.statCell}>
              <Text style={[styles.statNum, { color: teamColor }]}>{s.totalGames}</Text>
              <Text style={styles.statLabel}>직관 경기</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statNum, { color: teamColor }]}>{Math.round(s.winRate * 1000) / 10}%</Text>
              <Text style={styles.statLabel}>승률</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statNum, { color: teamColor }]}>{s.stadiums.length}</Text>
              <Text style={styles.statLabel}>방문 구장</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statNum, { color: teamColor }]}>₩{(s.totalSpent / 10000).toFixed(0)}만</Text>
              <Text style={styles.statLabel}>총 지출</Text>
            </View>
          </View>
        </View>

        {/* Win/Loss Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {winText} 시즌이었어요
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={[styles.opponentCard, { backgroundColor: isDark ? "#1a3a5c" : "#e3f2fd", borderColor: "#3b82f6" }]}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#3b82f6" }}>승</Text>
              <Text style={{ fontSize: 28, fontWeight: "800", color: "#3b82f6" }}>{s.wins}</Text>
            </View>
            <View style={[styles.opponentCard, { backgroundColor: isDark ? "#2a2a2a" : "#f5f5f5" }]}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: theme.mutedForeground }}>무</Text>
              <Text style={{ fontSize: 28, fontWeight: "800", color: theme.mutedForeground }}>{s.draws}</Text>
            </View>
            <View style={[styles.opponentCard, { backgroundColor: isDark ? "#3a1a1a" : "#ffebee", borderColor: "#ef4444" }]}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#ef4444" }}>패</Text>
              <Text style={{ fontSize: 28, fontWeight: "800", color: "#ef4444" }}>{s.losses}</Text>
            </View>
          </View>
          {s.longestWinStreak >= 3 && (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 14, gap: 6 }}>
              <Text style={{ fontSize: 18 }}>🔥</Text>
              <Text style={{ fontSize: 14, color: theme.foreground, fontWeight: "600" }}>
                최고 {s.longestWinStreak}연승을 달성했어요!
              </Text>
            </View>
          )}
        </View>

        {/* Stadiums */}
        {s.stadiums.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>방문한 구장</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {s.stadiums.map((name) => (
                <View key={name} style={[styles.stadiumChip, { backgroundColor: teamColor }]}>
                  <Text style={styles.stadiumChipText}>{name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Opponents */}
        {(s.topOpponentWins || s.topOpponentLosses) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>상대 전적</Text>
            <View style={styles.opponentRow}>
              {s.topOpponentWins && (
                <View style={[styles.opponentCard, { backgroundColor: isDark ? "#1a3a5c" : "#e3f2fd" }]}>
                  <Text style={{ fontSize: 22 }}>😊</Text>
                  <Text style={{ fontSize: 11, color: theme.mutedForeground, marginTop: 4 }}>가장 많이 이긴 팀</Text>
                  <Text style={styles.opponentName}>{s.topOpponentWins.shortName}</Text>
                  <Text style={{ fontSize: 22, fontWeight: "800", color: "#3b82f6", marginTop: 2 }}>{s.topOpponentWins.wins}승</Text>
                </View>
              )}
              {s.topOpponentLosses && (
                <View style={[styles.opponentCard, { backgroundColor: isDark ? "#3a1a1a" : "#ffebee" }]}>
                  <Text style={{ fontSize: 22 }}>😤</Text>
                  <Text style={{ fontSize: 11, color: theme.mutedForeground, marginTop: 4 }}>가장 많이 진 팀</Text>
                  <Text style={styles.opponentName}>{s.topOpponentLosses.shortName}</Text>
                  <Text style={{ fontSize: 22, fontWeight: "800", color: "#ef4444", marginTop: 2 }}>{s.topOpponentLosses.losses}패</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Emotions */}
        {s.topEmotion && s.totalGames > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>올해의 감정</Text>
            <View style={{ flexDirection: "row", gap: 0, height: 24, borderRadius: 12, overflow: "hidden" }}>
              {Object.entries(s.emotionCounts).map(([emotion, count]) => {
                const pct = count / s.totalGames;
                const colors: Record<string, string> = {
                  joyful: "#4ade80", sad: "#60a5fa", angry: "#f87171",
                  furious: "#ef4444", shocked: "#fbbf24", neutral: "#9ca3af", determined: "#a855f7",
                };
                return (
                  <View key={emotion} style={{ flex: pct, backgroundColor: colors[emotion] ?? theme.muted }} />
                );
              })}
            </View>
            <View style={styles.emotionRow}>
              {Object.entries(s.emotionCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([emotion, count]) => (
                  <View key={emotion} style={styles.emotionItem}>
                    <Text style={styles.emotionText}>{EMOTION_EMOJI[emotion] ?? "😐"}</Text>
                    <Text style={{ fontSize: 10, color: theme.mutedForeground }}>{count}회</Text>
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* Badges earned */}
        {s.badgesEarned > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              올해 획득한 배지 {s.badgesEarned}개
            </Text>
            <Text style={{ fontSize: 14, color: theme.mutedForeground }}>
              이번 시즌 {s.badgesEarned}개의 도전과제 배지를 획득했어요
            </Text>
          </View>
        )}

        {/* Closing */}
        <View style={styles.closing}>
          <Text style={styles.closingEmoji}>⚾</Text>
          <Text style={styles.closingTitle}>{year + 1} 시즌에도</Text>
          <Text style={styles.closingTitle}>함께해요</Text>
          <Text style={styles.closingSub}>
            내년에는 어떤 경기들이{'\n'}당신을 기다리고 있을까요?
          </Text>
          <Pressable style={styles.shareBtn} onPress={onClose}>
            <Text style={styles.shareBtnText}>닫기</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
