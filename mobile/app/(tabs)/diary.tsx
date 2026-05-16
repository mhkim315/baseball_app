import { useState, useCallback } from "react";
import { View, Text, FlatList, Image, Pressable, StyleSheet, Alert, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import { TEAM_COLORS } from "@shared/teamColors";
import { TEAM_ID_TO_CODE } from "@shared/constants";
import { TeamBadge } from "@/components/TeamBadge";
import { getJikgwanRecords, deleteJikgwanRecord, type JikgwanRecord } from "@/lib/db";
import { deletePhoto } from "@/lib/camera";
import { theme } from "@/lib/theme";

const TEAM_CODE_TO_ID: Record<string, string> = {};
for (const [id, code] of Object.entries(TEAM_ID_TO_CODE)) {
  TEAM_CODE_TO_ID[code] = id;
}

function parseGameId(gameId: string): { awayId?: string; homeId?: string } {
  const match = gameId.match(/^\d+-(\w{4})-\d+$/);
  if (!match) return {};
  return {
    awayId: TEAM_CODE_TO_ID[match[1].slice(0, 2)],
    homeId: TEAM_CODE_TO_ID[match[1].slice(2, 4)],
  };
}

export default function DiaryScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<JikgwanRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadRecords = useCallback(async () => {
    const data = await getJikgwanRecords();
    setRecords(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [loadRecords])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRecords();
    setRefreshing(false);
  };

  const handleDelete = (record: JikgwanRecord) => {
    Alert.alert("삭제", "이 기록을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          if (record.photo_path) await deletePhoto(record.photo_path);
          await deleteJikgwanRecord(record.id);
          loadRecords();
        },
      },
    ]);
  };

  const handleShare = async (uri: string) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    }
  };

  const renderItem = ({ item }: { item: JikgwanRecord }) => {
    const teams = parseGameId(item.game_id);
    const awayTeam = teams.awayId ? TEAM_COLORS[teams.awayId] : null;
    const homeTeam = teams.homeId ? TEAM_COLORS[teams.homeId] : null;
    const hasScore = item.score_away != null && item.score_home != null;

    return (
      <View style={styles.postCard}>
        {item.photo_path ? (
          <Image source={{ uri: item.photo_path }} style={styles.postPhoto} />
        ) : (
          <View style={styles.noPhoto}>
            <Text style={styles.noPhotoIcon}>📸</Text>
          </View>
        )}

        <View style={styles.postInfo}>
          {(awayTeam || homeTeam) && (
            <View style={styles.matchupRow}>
              {awayTeam && <TeamBadge teamId={teams.awayId!} size="sm" variant="ball" />}
              <Text style={[styles.teamName, awayTeam && { color: awayTeam.primary }]}>
                {awayTeam?.shortName || ""}
              </Text>
              {hasScore ? (
                <Text style={styles.score}>{item.score_away}:{item.score_home}</Text>
              ) : (
                <Text style={styles.vsText}>VS</Text>
              )}
              <Text style={[styles.teamName, homeTeam && { color: homeTeam.primary }]}>
                {homeTeam?.shortName || ""}
              </Text>
              {homeTeam && <TeamBadge teamId={teams.homeId!} size="sm" variant="ball" />}
            </View>
          )}

          <Text style={styles.date}>{item.date}</Text>
          {item.memo && <Text style={styles.memo}>{item.memo}</Text>}

          <View style={styles.actions}>
            <Pressable onPress={() => item.photo_path && handleShare(item.photo_path)} style={styles.actionBtn}>
              <Text style={styles.actionText}>공유</Text>
            </Pressable>
            <Pressable onPress={() => handleDelete(item)} style={styles.actionBtn}>
              <Text style={[styles.actionText, { color: "#ef4444" }]}>삭제</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📖 다이어리</Text>
        <Text style={styles.headerSub}>나의 직관 기록</Text>
      </View>

      <FlatList
        data={records}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.mutedForeground} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📸</Text>
            <Text style={styles.emptyText}>아직 직관 기록이 없어요</Text>
            <Text style={styles.emptySub}>+ 버튼을 눌러 첫 기록을 남겨보세요</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      />

      <Pressable style={styles.fab} onPress={() => router.push("/jikgwan/camera")}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: theme.foreground },
  headerSub: { fontSize: 13, color: theme.mutedForeground, marginTop: 4 },
  listContent: { padding: 16, paddingBottom: 100 },

  postCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.border,
  },
  postPhoto: { width: "100%", height: 320, resizeMode: "cover" },
  noPhoto: { height: 200, justifyContent: "center", alignItems: "center", backgroundColor: theme.muted },
  noPhotoIcon: { fontSize: 40 },

  postInfo: { padding: 16, gap: 8 },
  matchupRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  teamName: { fontSize: 13, fontWeight: "600" },
  score: { fontSize: 20, fontWeight: "bold", color: theme.foreground },
  vsText: { fontSize: 13, fontWeight: "600", color: theme.mutedForeground },
  date: { fontSize: 12, color: theme.mutedForeground, textAlign: "center" },
  memo: { fontSize: 13, color: theme.foreground, lineHeight: 19 },

  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, backgroundColor: theme.muted },
  actionText: { fontSize: 12, color: theme.foreground, fontWeight: "500" },

  empty: { alignItems: "center", paddingVertical: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: theme.mutedForeground, fontSize: 15 },
  emptySub: { color: theme.mutedForeground, fontSize: 12, marginTop: 6 },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.foreground,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  fabText: { fontSize: 28, color: theme.background, fontWeight: "300", lineHeight: 30 },
});
