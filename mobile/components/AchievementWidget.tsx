import { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { getBadges, type Badge } from "@/lib/db";
import { BADGE_DEFINITIONS, getVisibleBadgeDefinitions, computeLevel } from "@/lib/achievements";
import { useTheme } from "@/lib/ThemeContext";
import { useTeam } from "@/lib/TeamContext";

export default function AchievementWidget() {
  const { theme } = useTheme();
  const { myTeam } = useTeam();
  const router = useRouter();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBadges().then((data) => {
      setBadges(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const levelInfo = computeLevel(badges);
  const levelEmoji = levelInfo.level >= 7 ? "👑" : levelInfo.level >= 5 ? "🏆" : levelInfo.level >= 3 ? "🥇" : "🥚";
  const levelAccent = levelInfo.level >= 7 ? "#ffd700" : levelInfo.level >= 5 ? "#e07b3c" : undefined;
  const levelStar = levelInfo.level >= 5 ? " ⭐" : "";

  // 가장 진척도 높은 미해금 배지 1개 찾기
  const unlockedSet = new Set(badges.filter((b) => b.unlocked_date).map((b) => b.badge_key));
  const visibleDefs = getVisibleBadgeDefinitions(myTeam);
  const inProgress = visibleDefs
    .filter((def) => !unlockedSet.has(def.badgeKey))
    .map((def) => {
      const badge = badges.find((b) => b.badge_key === def.badgeKey);
      const current = badge?.progress_current ?? 0;
      const target = def.progressTarget;
      return { def, progress: target > 0 ? current / target : 0, current, target };
    })
    .filter((item) => item.current > 0)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 2);

  if (loading) return null;

  return (
    <Pressable
      onPress={() => router.push("/my?openAchievement=1")}
      style={[styles.card, { backgroundColor: theme.card, borderColor: levelAccent || theme.border }]}
    >
      {/* Level summary */}
      <View style={styles.levelRow}>
        <Text style={styles.levelEmoji}>{levelEmoji}</Text>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <Text style={[styles.levelTitle, { color: theme.foreground }]}>
              LV.{levelInfo.level} {levelInfo.title}{levelStar}
            </Text>
            <Text style={[styles.levelXp, { color: theme.mutedForeground }]}>
              {levelInfo.currentXP}/{levelInfo.requiredXP} XP
            </Text>
          </View>
          <View style={[styles.xpBar, { backgroundColor: theme.muted }]}>
            <View style={[styles.xpFill, { width: `${Math.min(levelInfo.progress * 100, 100)}%`, backgroundColor: levelAccent || "#e07b3c" }]} />
          </View>
        </View>
      </View>

      {/* In-progress badge */}
      {inProgress.length > 0 && (
        <View style={[styles.progressRow, { borderTopColor: theme.border }]}>
          {inProgress.map((item) => (
            <View key={item.def.id} style={{ flex: 1 }}>
              <Text style={[styles.progressLabel, { color: theme.mutedForeground }]}>
                {item.def.emoji} {item.def.category === "secret" ? "???" : item.def.title}
              </Text>
              <View style={[styles.miniBar, { backgroundColor: theme.muted }]}>
                <View style={[styles.miniFill, { width: `${Math.min(item.progress * 100, 100)}%` }]} />
              </View>
              <Text style={[styles.progressNum, { color: theme.mutedForeground }]}>
                {item.current}/{item.target}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.cta, { color: theme.mutedForeground }]}>도전과제 보기 →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  levelEmoji: {
    fontSize: 32,
    width: 40,
    textAlign: "center",
  },
  levelTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  levelXp: {
    fontSize: 12,
  },
  xpBar: {
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    overflow: "hidden",
  },
  xpFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#e07b3c",
  },
  progressRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 3,
  },
  miniBar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  miniFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: "#e07b3c",
  },
  progressNum: {
    fontSize: 10,
    marginTop: 1,
  },
  cta: {
    fontSize: 11,
    textAlign: "right",
    marginTop: 4,
  },
});
