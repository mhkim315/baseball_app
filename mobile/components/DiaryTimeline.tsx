import { useMemo } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, Alert, RefreshControl } from "react-native";
import * as Sharing from "expo-sharing";
import DiaryCard from "@/components/DiaryCard";
import { EMOTION_CHARACTER } from "@/components/EmotionPicker";
import { theme } from "@/lib/theme";
import type { JikgwanRecord } from "@/lib/db";
import { TEAM_COLORS } from "@shared/teamColors";
import { TEAM_ID_TO_CODE } from "@shared/constants";
import { deletePhoto } from "@/lib/camera";

interface DiaryTimelineProps {
  records: JikgwanRecord[];
  teamId: string | null;
  onDelete: (id: number) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export default function DiaryTimeline({ records, teamId, onDelete, onRefresh, refreshing }: DiaryTimelineProps) {
  const onThisDayRecords = useMemo(() => {
    const now = new Date();
    const todayMD = `${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
    return records.filter((r) => {
      const parts = r.date.split(".");
      if (parts.length !== 3) return false;
      const md = `${parts[1]}.${parts[2]}`;
      return md === todayMD;
    }).slice(0, 5);
  }, [records]);

  const handleShare = async (uri: string) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    }
  };

  const handleDelete = (record: JikgwanRecord) => {
    Alert.alert("삭제", "이 기록을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          if (record.photo_path) await deletePhoto(record.photo_path);
          onDelete(record.id);
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: JikgwanRecord }) => (
    <DiaryCard
      record={item}
      teamId={teamId}
      onShare={handleShare}
      onDelete={handleDelete}
    />
  );

  const ListHeaderComponent = onThisDayRecords.length > 0 ? (
    <View style={styles.onThisDaySection}>
      <Text style={styles.onThisDayTitle}>📅 오늘의 추억</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={onThisDayRecords}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable style={styles.onThisDayCard}>
            <View style={styles.onThisDayHeader}>
              {item.emotion && (() => {
                const char = EMOTION_CHARACTER[item.emotion];
                const codeMap: Record<string, string> = {};
                for (const [id, c] of Object.entries(TEAM_ID_TO_CODE)) {
                  codeMap[c] = id;
                }
                const m = item.game_id.match(/^\d+-(\w{4})-\d+$/);
                const emTeam = m ? (codeMap[m[1].slice(0, 2)] || codeMap[m[1].slice(2, 4)]) : null;
                return emTeam && char ? (
                  <TeamBadge teamId={emTeam} size="sm" emotion={char} />
                ) : (
                  <Text style={styles.onThisDayEmoji}>⚾</Text>
                );
              })()}
              <Text style={styles.onThisDayYear}>
                {item.date.split(".")[0]}년
              </Text>
            </View>
            <Text style={styles.onThisDayTeams}>
              {(() => {
                const codeMap: Record<string, string> = {};
                for (const [id, c] of Object.entries(TEAM_ID_TO_CODE)) {
                  codeMap[c] = id;
                }
                const m = item.game_id.match(/^\d+-(\w{4})-\d+$/);
                if (!m) return "직관 기록";
                const awayId = codeMap[m[1].slice(0, 2)];
                const homeId = codeMap[m[1].slice(2, 4)];
                const away = awayId ? TEAM_COLORS[awayId]?.shortName : "";
                const home = homeId ? TEAM_COLORS[homeId]?.shortName : "";
                return `${away} vs ${home}`;
              })()}
            </Text>
            {item.three_line_1 && (
              <Text style={styles.onThisDayLine} numberOfLines={2}>
                {item.three_line_1}
              </Text>
            )}
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
      />
    </View>
  ) : null;

  return (
    <FlatList
      data={records}
      renderItem={renderItem}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={ListHeaderComponent}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.mutedForeground} />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📸</Text>
          <Text style={styles.emptyText}>아직 직관 기록이 없어요</Text>
          <Text style={styles.emptySub}>+ 버튼을 눌러 첫 기록을 남겨보세요</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 100,
  },
  // On This Day
  onThisDaySection: {
    marginBottom: 20,
  },
  onThisDayTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.foreground,
    marginBottom: 12,
  },
  onThisDayCard: {
    backgroundColor: theme.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    width: 180,
    gap: 6,
  },
  onThisDayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  onThisDayEmoji: {
    fontSize: 18,
  },
  onThisDayYear: {
    fontSize: 11,
    color: theme.mutedForeground,
    fontWeight: "600",
  },
  onThisDayTeams: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.foreground,
  },
  onThisDayLine: {
    fontSize: 11,
    color: theme.mutedForeground,
    lineHeight: 16,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 80,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: theme.mutedForeground, fontSize: 15 },
  emptySub: { color: theme.mutedForeground, fontSize: 12, marginTop: 6 },
});
