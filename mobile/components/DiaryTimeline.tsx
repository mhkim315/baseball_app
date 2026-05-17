import { useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import * as Sharing from "expo-sharing";
import DiaryCard from "@/components/DiaryCard";
import { TeamBadge } from "@/components/TeamBadge";
import { EMOTION_CHARACTER } from "@/components/EmotionPicker";
import ConfirmModal from "@/components/ConfirmModal";
import { useTheme } from "@/lib/ThemeContext";
import type { JikgwanRecord } from "@/lib/db";
import { TEAM_COLORS } from "@shared/teamColors";
import { parseGameTeamIds } from "@shared/constants";
import { deletePhoto } from "@/lib/camera";

interface DiaryTimelineProps {
  records: JikgwanRecord[];
  teamId: string | null;
  onDelete: (id: number) => void;
  onEdit: (record: JikgwanRecord) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export default function DiaryTimeline({ records, teamId, onDelete, onEdit, onRefresh, refreshing }: DiaryTimelineProps) {
  const { theme } = useTheme();
  const [deleteTarget, setDeleteTarget] = useState<JikgwanRecord | null>(null);

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
    setDeleteTarget(record);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.photo_path) await deletePhoto(deleteTarget.photo_path);
    onDelete(deleteTarget.id);
    setDeleteTarget(null);
  };

  const styles = useMemo(() => StyleSheet.create({
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
      fontSize: 20,
    },
    onThisDayYear: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.mutedForeground,
    },
    onThisDayTeams: {
      fontSize: 11,
      color: theme.mutedForeground,
    },
    onThisDayLine: {
      fontSize: 12,
      color: theme.foreground,
      lineHeight: 16,
    },
    empty: {
      alignItems: "center",
      paddingVertical: 80,
    },
    emptyIcon: { fontSize: 48, marginBottom: 16 },
    emptyText: { color: theme.mutedForeground, fontSize: 15 },
    emptySub: { color: theme.mutedForeground, fontSize: 12, marginTop: 6 },
  }), [theme]);

  const renderItem = ({ item }: { item: JikgwanRecord }) => (
    <DiaryCard
      record={item}
      teamId={teamId}
      onShare={handleShare}
      onDelete={handleDelete}
      onEdit={onEdit}
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
                const { awayId, homeId } = parseGameTeamIds(item.game_id);
                const emTeam = awayId || homeId;
                const char = EMOTION_CHARACTER[item.emotion];
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
                const { awayId, homeId } = parseGameTeamIds(item.game_id);
                if (!awayId) return "직관 기록";
                const away = TEAM_COLORS[awayId]?.shortName || "";
                const home = TEAM_COLORS[homeId]?.shortName || "";
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
    <>
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
      <ConfirmModal
        visible={!!deleteTarget}
        title="삭제"
        message="이 기록을 삭제할까요?"
        confirmLabel="삭제"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
