import { useState, useEffect, useRef } from "react";
import { View, Text, Pressable, ScrollView, Modal, StyleSheet, useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent } from "react-native";
import { getBadges, getJikgwanRecords, type Badge, type JikgwanRecord } from "@/lib/db";
import { BADGE_DEFINITIONS, getVisibleBadgeDefinitions, computeLevel } from "@/lib/achievements";
import { useTheme } from "@/lib/ThemeContext";
import { useTeam } from "@/lib/TeamContext";
import AchievementList from "./AchievementList";

interface Props {
  visible: boolean;
  onClose: () => void;
}

type SubTab = "detail" | "collection";

export default function AchievementModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const { myTeam } = useTeam();
  const { width: screenWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [subTab, setSubTab] = useState<SubTab>("detail");
  const [badges, setBadges] = useState<Badge[]>([]);
  const [records, setRecords] = useState<JikgwanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      Promise.all([getBadges(), getJikgwanRecords()])
        .then(([b, r]) => { setBadges(b); setRecords(r); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [visible]);

  // Scroll to page when subTab button is pressed
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: subTab === "detail" ? 0 : screenWidth, animated: true });
  }, [subTab, screenWidth]);

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    setSubTab(page === 0 ? "detail" : "collection");
  };

  const levelInfo = computeLevel(badges);
  const levelEmoji = levelInfo.level >= 7 ? "👑" : levelInfo.level >= 5 ? "🏆" : levelInfo.level >= 3 ? "🥇" : "🥚";
  const visibleDefs = getVisibleBadgeDefinitions(myTeam);
  const unlockedSet = new Set(badges.filter((b) => b.unlocked_date).map((b) => b.badge_key));
  const badgeMap = new Map(badges.map((b) => [b.badge_key, b]));
  const unlockedCount = badges.filter((b) => b.unlocked_date).length;
  const levelStar = levelInfo.level >= 5 ? " ⭐" : "";
  const [detailBadgeKey, setDetailBadgeKey] = useState<string | null>(null);
  const detailDef = detailBadgeKey ? BADGE_DEFINITIONS.find((d) => d.badgeKey === detailBadgeKey) : null;
  const detailBadge = detailBadgeKey ? badgeMap.get(detailBadgeKey) : undefined;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <View>
            <Text style={[styles.headerTitle, { color: theme.foreground }]}>도전과제</Text>
            <Text style={[styles.headerSub, { color: theme.mutedForeground }]}>
              {unlockedCount}/{visibleDefs.length} 획득 · LV.{levelInfo.level} {levelInfo.title}{levelStar}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={[styles.closeBtn, { color: theme.mutedForeground }]}>닫기</Text>
          </Pressable>
        </View>

        {/* Sub-tabs */}
        <View style={[styles.subTabRow, { borderBottomColor: theme.border }]}>
          {(["detail", "collection"] as SubTab[]).map((tab) => (
            <Pressable
              key={tab}
              style={[styles.subTab, { borderBottomColor: subTab === tab ? theme.foreground : "transparent" }]}
              onPress={() => setSubTab(tab)}
            >
              <Text style={[styles.subTabText, { color: subTab === tab ? theme.foreground : theme.mutedForeground }]}>
                {tab === "detail" ? "상세" : "컬렉션"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Swipeable pages */}
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: theme.mutedForeground, fontSize: 14 }}>로딩 중...</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleMomentumEnd}
            style={{ flex: 1 }}
          >
            {/* Detail page */}
            <View style={{ width: screenWidth, flex: 1 }}>
              <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
                <AchievementList records={records} />
              </ScrollView>
            </View>

            {/* Collection page */}
            <View style={{ width: screenWidth, flex: 1 }}>
              <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                <View style={styles.grid}>
                  {visibleDefs.map((def) => {
                    const unlocked = unlockedSet.has(def.badgeKey);
                    const badge = badgeMap.get(def.badgeKey);
                    return (
                      <Pressable key={def.id} style={styles.gridCell} onPress={() => setDetailBadgeKey(def.badgeKey)}>
                        <View style={[styles.gridInner, { borderColor: theme.border }, unlocked && { backgroundColor: theme.muted }]}>
                          <Text style={styles.gridEmoji}>{unlocked ? def.emoji : "🔒"}</Text>
                          <Text style={[styles.gridTitle, { color: theme.foreground }]} numberOfLines={1}>
                            {def.category === "secret" && !unlocked ? "???" : def.title}
                          </Text>
                          {!unlocked && badge && badge.progress_current > 0 && (
                            <View style={styles.gridProgressOuter}>
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
              </ScrollView>
            </View>
          </ScrollView>
        )}

        {/* Badge detail popup — 인라인 오버레이 (iOS Modal 중첩 버그 방지) */}
        {detailDef && (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
            <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }} onPress={() => setDetailBadgeKey(null)}>
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
                <View style={{ width: "100%", maxWidth: 300, borderRadius: 20, borderWidth: 1, padding: 28, alignItems: "center", gap: 8, backgroundColor: theme.card, borderColor: theme.border }}>
                  <Text style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>{detailDef.emoji}</Text>
                  <Text style={{ fontSize: 20, fontWeight: "800", textAlign: "center", color: theme.foreground }}>
                    {detailDef.category === "secret" && !detailBadge?.unlocked_date ? "???" : detailDef.title}
                  </Text>
                  <Text style={{ fontSize: 13, textAlign: "center", lineHeight: 18, color: theme.mutedForeground }}>
                    {detailDef.category === "secret" && !detailBadge?.unlocked_date ? "???" : detailDef.description}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                    <View style={{ backgroundColor: theme.muted, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: "600", color: theme.mutedForeground }}>
                        {detailDef.category === "milestone" ? "🏆 마일스톤" : detailDef.category === "streak" ? "🔥 연승" : detailDef.category === "attendance" ? "📅 출석" : detailDef.category === "exploration" ? "🗺️ 탐험" : "🤫 시크릿"}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: theme.muted, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: "600", color: theme.mutedForeground }}>{levelInfo.title}</Text>
                    </View>
                  </View>
                  {detailBadge?.unlocked_date ? (
                    <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 4 }}>획득일: {detailBadge.unlocked_date}</Text>
                  ) : detailBadge ? (
                    <View style={{ marginTop: 12, gap: 4, width: "100%" }}>
                      <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.muted, overflow: "hidden" }}>
                        <View style={{ height: "100%", borderRadius: 3, backgroundColor: "#e07b3c", width: `${Math.min((detailBadge.progress_current / Math.max(detailBadge.progress_target, 1)) * 100, 100)}%` }} />
                      </View>
                      <Text style={{ fontSize: 11, color: theme.mutedForeground, textAlign: "center" }}>{detailBadge.progress_current}/{detailBadge.progress_target}</Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 13, textAlign: "center", color: theme.mutedForeground, marginTop: 8 }}>아직 발견되지 않음</Text>
                  )}
                  <Pressable style={{ marginTop: 16, paddingHorizontal: 32, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.secondary }} onPress={() => setDetailBadgeKey(null)}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: theme.foreground }}>확인</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerSub: { fontSize: 11, marginTop: 2 },
  closeBtn: { fontSize: 14, marginTop: 4 },

  subTabRow: { flexDirection: "row", borderBottomWidth: 1 },
  subTab: { flex: 1, alignItems: "center", paddingVertical: 10, borderBottomWidth: 2 },
  subTabText: { fontSize: 14, fontWeight: "600" },

  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12 },
  gridCell: { width: "33.33%", aspectRatio: 1, padding: 6 },
  gridInner: { flex: 1, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", padding: 4, gap: 2 },
  gridEmoji: { fontSize: 26 },
  gridTitle: { fontSize: 10, fontWeight: "600", textAlign: "center" },
  gridProgressOuter: { height: 3, borderRadius: 1.5, width: "80%", overflow: "hidden", backgroundColor: "#e0ddd5" },
  gridProgressFill: { height: "100%", backgroundColor: "#e07b3c", borderRadius: 1.5 },
  gridDate: { fontSize: 8 },
});
