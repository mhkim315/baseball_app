import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  StyleSheet,
} from "react-native";
import * as Sharing from "expo-sharing";
import ConfirmModal from "@/components/ConfirmModal";
import { JikgwanRecord, getJikgwanRecords, deleteJikgwanRecord } from "@/lib/db";
import { deletePhoto } from "@/lib/camera";
import { TEAM_COLORS } from "@shared/teamColors";
import { useTheme } from "@/lib/ThemeContext";

interface Props {
  onTakePhoto: () => void;
}

export default function JikgwanFeed({ onTakePhoto }: Props) {
  const { theme } = useTheme();
  const [records, setRecords] = useState<(JikgwanRecord & { uri: string })[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<(JikgwanRecord & { uri: string }) | null>(null);

  const loadRecords = useCallback(async () => {
    const data = await getJikgwanRecords();
    setRecords(
      data.map((r) => ({
        ...r,
        uri: r.photo_path || "",
      }))
    );
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleDelete = (record: JikgwanRecord & { uri: string }) => {
    setDeleteTarget(record);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.photo_path) await deletePhoto(deleteTarget.photo_path);
    await deleteJikgwanRecord(deleteTarget.id);
    setDeleteTarget(null);
    loadRecords();
  };

  const handleShare = async (uri: string) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    }
  };

  const renderItem = ({ item }: { item: JikgwanRecord & { uri: string } }) => {
    const date = item.date;
    const hasScore = item.score_away != null && item.score_home != null;
    const homeColor = "#888";
    const awayColor = "#888";

    return (
      <View style={styles.card}>
        {item.uri ? (
          <Image source={{ uri: item.uri }} style={styles.photo} />
        ) : (
          <View style={styles.noPhoto}>
            <Text style={styles.noPhotoText}>No Photo</Text>
          </View>
        )}
        <View style={styles.meta}>
          <Text style={styles.date}>{date}</Text>
          {hasScore && (
            <Text style={styles.score}>
              {item.score_away} : {item.score_home}
            </Text>
          )}
          {item.memo && <Text style={styles.memo}>{item.memo}</Text>}
          <View style={styles.actions}>
            <Pressable onPress={() => handleShare(item.uri)} style={styles.actionBtn}>
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

  const styles = useMemo(() => StyleSheet.create({
    container: { marginTop: 8 },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    title: { fontSize: 16, fontWeight: "bold", color: theme.foreground },
    cameraBtn: {
      backgroundColor: theme.foreground,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
    },
    cameraBtnText: { fontSize: 12, fontWeight: "600", color: theme.background },
    card: {
      backgroundColor: theme.card,
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.border,
    },
    photo: { width: "100%", height: 300 },
    noPhoto: {
      height: 200,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.muted,
    },
    noPhotoText: { color: theme.mutedForeground, fontSize: 14 },
    meta: { padding: 14, gap: 6 },
    date: { color: theme.mutedForeground, fontSize: 12 },
    score: { color: theme.foreground, fontSize: 18, fontWeight: "bold" },
    memo: { color: theme.foreground, fontSize: 13 },
    actions: { flexDirection: "row", gap: 12, marginTop: 8 },
    actionBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: theme.muted,
    },
    actionText: { color: theme.foreground, fontSize: 12 },
    empty: { alignItems: "center", paddingVertical: 32 },
    emptyText: { color: theme.mutedForeground, fontSize: 14 },
    emptySub: { color: theme.mutedForeground, fontSize: 12, marginTop: 4 },
  }), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>직관 기록</Text>
        <Pressable style={styles.cameraBtn} onPress={onTakePhoto}>
          <Text style={styles.cameraBtnText}>+ 사진 찍기</Text>
        </Pressable>
      </View>

      {records.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>아직 직관 기록이 없어요</Text>
          <Text style={styles.emptySub}>카메라로 사진을 찍어 기록해보세요</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
      <ConfirmModal
        visible={!!deleteTarget}
        title="삭제"
        message="이 직관 기록을 삭제할까요?"
        confirmLabel="삭제"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}


