import { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { getBadges, type Badge } from "@/lib/db";
import { BADGE_DEFINITIONS, getVisibleBadgeDefinitions, computeLevel, type LevelInfo } from "@/lib/achievements";
import { useTheme } from "@/lib/ThemeContext";

interface BadgeCollectionModalProps {
  visible: boolean;
  onClose: () => void;
  myTeam: string | null;
}

type FilterKey = "all" | "milestone" | "streak" | "attendance" | "exploration" | "secret";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "milestone", label: "마일스톤" },
  { key: "streak", label: "연승" },
  { key: "attendance", label: "출석" },
  { key: "exploration", label: "탐험" },
  { key: "secret", label: "시크릿" },
];

const CATEGORY_TITLES: Record<string, string> = {
  milestone: "마일스톤 — 특정 횟수 달성",
  streak: "연승 — 연속 승리 직관",
  attendance: "출석 — 매일 방문",
  exploration: "탐험 — 새로운 구장 방문",
  secret: "시크릿 — 특별한 조건",
};

function BadgeDetailPopup({ badge, def, levelTitle, onClose }: {
  badge: Badge | undefined;
  def: (typeof BADGE_DEFINITIONS)[number];
  levelTitle: string;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
      <View style={[detailStyles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>{def.emoji}</Text>
        <Text style={[detailStyles.title, { color: theme.foreground }]}>{def.category === "secret" && !badge?.unlocked_date ? "???" : def.title}</Text>
        <Text style={[detailStyles.desc, { color: theme.mutedForeground }]}>{def.category === "secret" && !badge?.unlocked_date ? "???" : def.description}</Text>
        <View style={detailStyles.row}>
          <Text style={[detailStyles.tag, { backgroundColor: theme.muted, color: theme.mutedForeground }]}>
            {def.category === "milestone" ? "🏆 마일스톤" : def.category === "streak" ? "🔥 연승" : def.category === "attendance" ? "📅 출석" : def.category === "exploration" ? "🗺️ 탐험" : "🤫 시크릿"}
          </Text>
          <Text style={[detailStyles.level, { backgroundColor: theme.muted, color: theme.mutedForeground }]}>
            {levelTitle}
          </Text>
        </View>
        {badge?.unlocked_date ? (
          <Text style={[detailStyles.unlockedDate, { color: theme.mutedForeground }]}>
            획득일: {badge.unlocked_date}
          </Text>
        ) : badge ? (
          <View style={{ marginTop: 12, gap: 4 }}>
            <View style={[detailStyles.progressBar, { backgroundColor: theme.muted }]}>
              <View style={[detailStyles.progressFill, { width: `${Math.min((badge.progress_current / Math.max(badge.progress_target, 1)) * 100, 100)}%` }]} />
            </View>
            <Text style={{ fontSize: 11, color: theme.mutedForeground, textAlign: "center" }}>
              {badge.progress_current}/{badge.progress_target}
            </Text>
          </View>
        ) : (
          <Text style={[detailStyles.desc, { color: theme.mutedForeground, marginTop: 8 }]}>아직 발견되지 않음</Text>
        )}
        <Pressable style={[detailStyles.closeBtn, { backgroundColor: theme.secondary }]} onPress={onClose}>
          <Text style={[detailStyles.closeBtnText, { color: theme.foreground }]}>확인</Text>
        </Pressable>
      </View>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  card: {
    width: "100%", maxWidth: 300, borderRadius: 20, borderWidth: 1,
    padding: 28, alignItems: "center", gap: 8,
  },
  title: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  desc: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  row: { flexDirection: "row", gap: 6, marginTop: 4 },
  tag: { fontSize: 10, fontWeight: "600", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  level: { fontSize: 10, fontWeight: "600", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  unlockedDate: { fontSize: 12, marginTop: 4 },
  progressBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#e07b3c", borderRadius: 3 },
  closeBtn: { marginTop: 16, paddingHorizontal: 32, paddingVertical: 10, borderRadius: 12 },
  closeBtnText: { fontSize: 14, fontWeight: "600" },
});

export default function BadgeCollectionModal({ visible, onClose, myTeam }: BadgeCollectionModalProps) {
  const { theme, isDark } = useTheme();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [detailBadgeKey, setDetailBadgeKey] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    if (visible) {
      setLoading(true);
      getBadges().then(setBadges).catch(() => {}).finally(() => setLoading(false));
    }
  }, [visible]));

  const levelInfo = computeLevel(badges);
  const levelEmoji = levelInfo.level >= 7 ? "👑" : levelInfo.level >= 5 ? "🏆" : levelInfo.level >= 3 ? "🥇" : "🥚";
  const unlockedSet = new Set(badges.filter((b) => b.unlocked_date).map((b) => b.badge_key));
  const badgeMap = new Map(badges.map((b) => [b.badge_key, b]));

  const filteredDefs = getVisibleBadgeDefinitions(myTeam).filter((def) => filter === "all" || def.category === filter);
  const visibleDefs = getVisibleBadgeDefinitions(myTeam);


  // Level-based visual accents
  const levelAccent = levelInfo.level >= 7 ? "#ffd700" : levelInfo.level >= 5 ? "#e07b3c" : undefined;
  const levelStar = levelInfo.level >= 5 ? " ⭐" : "";

  const detailDef = detailBadgeKey ? BADGE_DEFINITIONS.find((d) => d.badgeKey === detailBadgeKey) : null;
  const detailBadge = detailBadgeKey ? badgeMap.get(detailBadgeKey) : undefined;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <Text style={[styles.headerTitle, { color: theme.foreground }]}>도전과제 컬렉션</Text>
          <Pressable onPress={onClose}><Text style={[styles.closeBtn, { color: theme.mutedForeground }]}>닫기</Text></Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
          {/* Level card */}
          <View style={[styles.levelCard, { backgroundColor: theme.card, borderColor: levelAccent || theme.border }]}>
            <Text style={styles.levelEmoji}>{levelEmoji}</Text>
            <Text style={[styles.levelTitle, { color: theme.foreground }]}>
              LV.{levelInfo.level} {levelInfo.title}{levelStar}
            </Text>
            <Text style={[styles.levelXp, { color: theme.mutedForeground }]}>
              {levelInfo.currentXP}/{levelInfo.requiredXP} XP
            </Text>
            <View style={[styles.xpBar, { backgroundColor: theme.muted }]}>
              <View style={[styles.xpFill, { width: `${Math.min(levelInfo.progress * 100, 100)}%`, backgroundColor: levelAccent || "#e07b3c" }]} />
            </View>
            <Text style={[styles.levelSub, { color: theme.mutedForeground }]}>
              {badges.filter((b) => b.unlocked_date).length}/{visibleDefs.length} 획득
            </Text>
          </View>

          {/* Category filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {FILTERS.map((f) => (
              <Pressable
                key={f.key}
                style={[styles.filterChip, filter === f.key && { backgroundColor: "#e07b3c" }]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.filterText, filter === f.key && { color: "#fff" }]}>{f.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {filter !== "all" && (
            <Text style={[styles.categoryLabel, { color: theme.mutedForeground }]}>
              {CATEGORY_TITLES[filter]}
            </Text>
          )}

          {/* Badge grid */}
          {loading ? (
            <Text style={[styles.loadingText, { color: theme.mutedForeground }]}>로딩 중...</Text>
          ) : (
            <View style={styles.grid}>
              {filteredDefs.map((def) => {
                const unlocked = unlockedSet.has(def.badgeKey);
                const badge = badgeMap.get(def.badgeKey);
                return (
                  <Pressable
                    key={def.id}
                    style={[styles.gridCell, { borderColor: theme.border }]}
                    onPress={() => setDetailBadgeKey(def.badgeKey)}
                  >
                    <View style={[styles.gridInner, unlocked ? styles.gridUnlocked : styles.gridLocked]}>
                      <Text style={styles.gridEmoji}>{unlocked ? def.emoji : "🔒"}</Text>
                      <Text style={[styles.gridTitle, { color: theme.foreground }]} numberOfLines={1}>{def.category === "secret" && !unlocked ? "???" : def.title}</Text>
                      {!unlocked && badge && badge.progress_current > 0 && (
                        <View style={[styles.gridProgress, { backgroundColor: theme.muted }]}>
                          <View style={[styles.gridProgressFill, { width: `${Math.min((badge.progress_current / Math.max(badge.progress_target, 1)) * 100, 100)}%` }]} />
                        </View>
                      )}
                      {badge?.unlocked_date && (
                        <Text style={[styles.gridDate, { color: theme.mutedForeground }]} numberOfLines={1}>
                          {badge.unlocked_date.slice(2)}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Badge detail popup */}
        {detailDef && (
          <Modal transparent animationType="fade" visible={!!detailDef} onRequestClose={() => setDetailBadgeKey(null)}>
            <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }} onPress={() => setDetailBadgeKey(null)}>
              <BadgeDetailPopup
                badge={detailBadge}
                def={detailDef}
                levelTitle={levelInfo.title}
                onClose={() => setDetailBadgeKey(null)}
              />
            </Pressable>
          </Modal>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  closeBtn: { fontSize: 14 },

  levelCard: {
    margin: 16, borderRadius: 16, borderWidth: 1,
    padding: 20, alignItems: "center", gap: 4,
  },
  levelEmoji: { fontSize: 40, marginBottom: 4 },
  levelTitle: { fontSize: 20, fontWeight: "800" },
  levelXp: { fontSize: 12 },
  xpBar: { height: 8, borderRadius: 4, width: "100%", maxWidth: 200, overflow: "hidden", marginTop: 4 },
  xpFill: { height: "100%", borderRadius: 4 },
  levelSub: { fontSize: 12, marginTop: 4 },

  filterRow: { paddingHorizontal: 16, gap: 8, paddingVertical: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#efede7" },
  filterText: { fontSize: 13, fontWeight: "600", color: "#50505a" },

  categoryLabel: { fontSize: 11, paddingHorizontal: 20, marginTop: 4, marginBottom: 4 },

  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12 },
  gridCell: {
    width: "33.33%", aspectRatio: 1, padding: 6, borderWidth: 0,
  },
  gridInner: {
    flex: 1, borderRadius: 12, borderWidth: 1, borderColor: "transparent",
    alignItems: "center", justifyContent: "center", padding: 6, gap: 2,
  },
  gridUnlocked: { opacity: 1 },
  gridLocked: { opacity: 0.35 },
  gridEmoji: { fontSize: 24 },
  gridTitle: { fontSize: 10, fontWeight: "600", textAlign: "center" },
  gridProgress: { height: 3, borderRadius: 1.5, width: "80%", overflow: "hidden" },
  gridProgressFill: { height: "100%", backgroundColor: "#e07b3c", borderRadius: 1.5 },
  gridDate: { fontSize: 8 },

  loadingText: { textAlign: "center", paddingVertical: 40, fontSize: 14 },
});
