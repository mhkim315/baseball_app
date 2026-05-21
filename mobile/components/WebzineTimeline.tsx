import { useMemo, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import WebzineCard from "@/components/WebzineCard";
import ConfirmModal from "@/components/ConfirmModal";
import { useTheme } from "@/lib/ThemeContext";
import type { JikgwanRecord, Expense } from "@/lib/db";
import { deletePhoto } from "@/lib/camera";

interface WebzineTimelineProps {
  records: JikgwanRecord[];
  teamId: string | null;
  onDelete: (id: number) => void;
  onRefresh: () => void;
  refreshing: boolean;
  expensesByRecordId?: Map<number, Expense[]>;
  onPressRecord?: (record: JikgwanRecord) => void;
}

export default function WebzineTimeline({ records, teamId, onDelete, onRefresh, refreshing, expensesByRecordId, onPressRecord }: WebzineTimelineProps) {
  const { theme } = useTheme();
  const [deleteTarget, setDeleteTarget] = useState<JikgwanRecord | null>(null);

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
    empty: {
      alignItems: "center",
      paddingVertical: 80,
    },
    emptyIcon: { fontSize: 48, marginBottom: 16 },
    emptyText: { color: theme.mutedForeground, fontSize: 15 },
    emptySub: { color: theme.mutedForeground, fontSize: 12, marginTop: 6 },
  }), [theme]);

  const renderItem = useCallback(({ item }: { item: JikgwanRecord }) => (
    <WebzineCard
      record={item}
      teamId={teamId}
      expenses={expensesByRecordId?.get(item.id)}
      onPress={() => onPressRecord?.(item)}
      onLongPress={() => handleDelete(item)}
    />
  ), [teamId, expensesByRecordId, onPressRecord]);

  return (
    <>
      <FlatList
        data={records}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews
        windowSize={5}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
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
