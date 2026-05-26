import { useState, useMemo, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useTheme } from "@/lib/ThemeContext";
import { getBadges, type Badge, type JikgwanRecord } from "@/lib/db";
import { BADGE_DEFINITIONS, getVisibleBadgeDefinitions, computeLevel, type BadgeDefinition, type LevelInfo } from "@/lib/achievements";
import { useTeam } from "@/lib/TeamContext";

interface AchievementListProps {
  records: JikgwanRecord[];
}

const CATEGORIES = [
  { key: "all", label: "전체" },
  { key: "milestone" as const, label: "마일스톤" },
  { key: "streak" as const, label: "연승" },
  { key: "attendance" as const, label: "출석" },
  { key: "exploration" as const, label: "탐험" },
  { key: "secret" as const, label: "시크릿" },
];

type CatKey = typeof CATEGORIES[number]["key"];

export default function AchievementList({ records }: AchievementListProps) {
  const { theme, isDark } = useTheme();
  const { myTeam } = useTeam();

  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<CatKey>("all");

  // Load badges on mount
  useEffect(() => {
    getBadges().then((data) => {
      setBadges(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const levelInfo = useMemo(() => computeLevel(badges), [badges]);
  const unlockedCount = useMemo(() => badges.filter((b) => b.unlocked_date).length, [badges]);

  // Build badge display list with unlocked state
  const badgeDisplayList = useMemo(() => {
    const unlockedMap = new Map(badges.filter((b) => b.unlocked_date).map((b) => [b.badge_key, b]));
    const progressMap = new Map(badges.filter((b) => !b.unlocked_date && b.progress_current > 0).map((b) => [b.badge_key, b]));

    let list = getVisibleBadgeDefinitions(myTeam).filter((def) => {
      if (catFilter === "all") return true;
      return def.category === catFilter;
    }).map((def) => ({
      def,
      badge: unlockedMap.get(def.badgeKey) ?? progressMap.get(def.badgeKey) ?? null,
      unlocked: unlockedMap.has(def.badgeKey),
    }));

    // Sort: unlocked first, then by progress, then by id
    list.sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      const pa = a.badge?.progress_current ?? 0;
      const pb = b.badge?.progress_current ?? 0;
      if (pa !== pb) return pb - pa;
      return a.def.id.localeCompare(b.def.id);
    });

    return list;
  }, [badges, catFilter]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      gap: 16,
      paddingBottom: 100,
    },
    levelCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 20,
      alignItems: "center",
    },
    levelEmoji: {
      fontSize: 40,
      marginBottom: 8,
    },
    levelTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.foreground,
    },
    levelSubtitle: {
      fontSize: 14,
      color: theme.mutedForeground,
      marginTop: 2,
    },
    xpBarOuter: {
      width: "100%",
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.muted,
      marginTop: 14,
      overflow: "hidden",
    },
    xpBarInner: {
      height: "100%",
      borderRadius: 5,
      backgroundColor: "#e07b3c",
    },
    xpLabel: {
      fontSize: 11,
      color: theme.mutedForeground,
      marginTop: 4,
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 24,
      marginTop: 12,
    },
    statItem: {
      alignItems: "center",
      gap: 2,
    },
    statNum: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.foreground,
    },
    statLabel: {
      fontSize: 11,
      color: theme.mutedForeground,
    },
    filterRow: {
      flexDirection: "row",
      gap: 6,
    },
    filterBtn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: theme.muted,
    },
    filterBtnActive: {
      backgroundColor: "#e07b3c",
    },
    filterBtnText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.mutedForeground,
    },
    filterBtnTextActive: {
      color: "#fff",
    },
    gridContent: {
      gap: 10,
    },
    badgeCard: {
      backgroundColor: theme.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    badgeCardLocked: {
      opacity: 0.45,
    },
    badgeEmoji: {
      fontSize: 28,
      width: 44,
      textAlign: "center",
    },
    badgeInfo: {
      flex: 1,
    },
    badgeTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.foreground,
    },
    badgeDesc: {
      fontSize: 12,
      color: theme.mutedForeground,
      marginTop: 1,
    },
    badgeDate: {
      fontSize: 11,
      color: theme.mutedForeground,
      marginTop: 1,
    },
    progressBarOuter: {
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.muted,
      marginTop: 6,
      overflow: "hidden",
    },
    progressBarInner: {
      height: "100%",
      borderRadius: 3,
      backgroundColor: "#e07b3c",
    },
    progressLabel: {
      fontSize: 10,
      color: theme.mutedForeground,
      marginTop: 1,
    },
  }), [theme]);

  if (loading) {
    return (
      <View style={{ padding: 40, alignItems: "center" }}>
        <Text style={{ color: theme.mutedForeground }}>로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Level Card */}
      <View style={styles.levelCard}>
        <Text style={styles.levelEmoji}>{levelEmoji(levelInfo.level)}</Text>
        <Text style={styles.levelTitle}>LV.{levelInfo.level} {levelInfo.title}</Text>
        <Text style={styles.levelSubtitle}>획득 XP {levelInfo.currentXP} / {levelInfo.requiredXP}</Text>
        <View style={styles.xpBarOuter}>
          <View style={[styles.xpBarInner, { width: `${Math.min(levelInfo.progress * 100, 100)}%` }]} />
        </View>
        <Text style={styles.xpLabel}>다음 레벨까지 {levelInfo.requiredXP - levelInfo.currentXP} XP</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{badgeDisplayList.length}</Text>
            <Text style={styles.statLabel}>전체 배지</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{unlockedCount}</Text>
            <Text style={styles.statLabel}>획득</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{badgeDisplayList.length - unlockedCount}</Text>
            <Text style={styles.statLabel}>남음</Text>
          </View>
        </View>
      </View>

      {/* Category Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.key}
            style={[styles.filterBtn, catFilter === cat.key && styles.filterBtnActive]}
            onPress={() => setCatFilter(cat.key)}
          >
            <Text style={[styles.filterBtnText, catFilter === cat.key && styles.filterBtnTextActive]}>
              {cat.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Badge Grid */}
      <View style={{ gap: 10 }}>
        {badgeDisplayList.map((item) => {
          const { def, unlocked } = item;
          const progressCurrent = item.badge?.progress_current ?? 0;
          const progressTarget = def.progressTarget;
          const progress = progressTarget > 0 ? progressCurrent / progressTarget : 0;

          return (
            <View key={def.id} style={[styles.badgeCard, !unlocked && styles.badgeCardLocked]}>
              <Text style={styles.badgeEmoji}>{def.emoji}</Text>
              <View style={styles.badgeInfo}>
                <Text style={styles.badgeTitle}>{def.title}</Text>
                <Text style={styles.badgeDesc}>{def.category === "secret" && !unlocked ? "???" : def.description}</Text>
                {unlocked && item.badge?.unlocked_date && (
                  <Text style={styles.badgeDate}>획득일: {item.badge.unlocked_date}</Text>
                )}
                {!unlocked && (
                  <>
                    <View style={styles.progressBarOuter}>
                      <View style={[styles.progressBarInner, { width: `${Math.min(progress * 100, 100)}%` }]} />
                    </View>
                    <Text style={styles.progressLabel}>{progressCurrent}/{progressTarget}</Text>
                  </>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function levelEmoji(level: number): string {
  if (level >= 7) return "👑";
  if (level >= 5) return "🏆";
  if (level >= 3) return "🥇";
  return "🥚";
}
