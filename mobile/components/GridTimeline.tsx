import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { View, Text, Image, FlatList, Pressable, StyleSheet, RefreshControl, useWindowDimensions } from "react-native";
import ConfirmModal from "@/components/ConfirmModal";
import { useTheme } from "@/lib/ThemeContext";
import type { JikgwanRecord } from "@/lib/db";
import { deletePhoto } from "@/lib/camera";

interface GridTimelineProps {
  records: JikgwanRecord[];
  onDelete: (id: number) => void;
  onRefresh: () => void;
  refreshing: boolean;
  onPressRecord?: (record: JikgwanRecord) => void;
  scrollTargetDate?: string | null;
}

function parsePhotos(record: JikgwanRecord): string[] {
  if (record.photos) {
    try {
      const parsed = JSON.parse(record.photos);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  if (record.photo_path) return [record.photo_path];
  return [];
}

const NUM_COLUMNS = 3;

function chunkRows(items: JikgwanRecord[], cols: number): JikgwanRecord[][] {
  const rows: JikgwanRecord[][] = [];
  for (let i = 0; i < items.length; i += cols) {
    rows.push(items.slice(i, i + cols));
  }
  return rows;
}

export default function GridTimeline({ records, onDelete, onRefresh, refreshing, onPressRecord, scrollTargetDate }: GridTimelineProps) {
  const { theme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [deleteTarget, setDeleteTarget] = useState<JikgwanRecord | null>(null);
  const flatListRef = useRef<FlatList<JikgwanRecord[]>>(null);
  const cellSize = screenWidth / NUM_COLUMNS;
  const rows = useMemo(() => chunkRows(records, NUM_COLUMNS), [records]);

  useEffect(() => {
    if (!scrollTargetDate || records.length === 0) return;
    const idx = records.findIndex((r) => r.date === scrollTargetDate);
    if (idx >= 0) {
      const rowIndex = Math.floor(idx / NUM_COLUMNS);
      setTimeout(() => flatListRef.current?.scrollToOffset({ offset: rowIndex * cellSize, animated: true }), 100);
    }
  }, [scrollTargetDate, cellSize, records]);

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
    row: {
      flexDirection: "row",
    },
    cell: {
      width: cellSize,
      height: cellSize,
    },
    image: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    placeholder: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.muted,
    },
    photoBadge: {
      position: "absolute",
      top: 4,
      right: 4,
      backgroundColor: "rgba(0,0,0,0.65)",
      borderRadius: 8,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    photoBadgeText: {
      color: "#fff",
      fontSize: 9,
      fontWeight: "700",
    },
    empty: {
      alignItems: "center",
      paddingVertical: 80,
      width: screenWidth,
    },
    emptyIcon: { fontSize: 48, marginBottom: 16 },
    emptyText: { color: theme.mutedForeground, fontSize: 15 },
    emptySub: { color: theme.mutedForeground, fontSize: 12, marginTop: 6 },
  }), [theme, cellSize, screenWidth]);

  const renderRow = useCallback(({ item: row }: { item: JikgwanRecord[] }) => (
    <View style={styles.row}>
      {row.map((record) => {
        const photos = parsePhotos(record);
        return (
          <Pressable
            key={record.id}
            style={styles.cell}
            onPress={() => onPressRecord?.(record)}
            onLongPress={() => handleDelete(record)}
          >
            {photos[0] ? (
              <>
                <Image source={{ uri: photos[0] }} style={styles.image} />
                {photos.length > 1 && (
                  <View style={styles.photoBadge}>
                    <Text style={styles.photoBadgeText}>+{photos.length - 1}</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.placeholder}>
                <Text style={{ fontSize: 20 }}>📸</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  ), [styles, onPressRecord]);

  return (
    <>
      <FlatList
        ref={flatListRef}
        data={rows}
        renderItem={renderRow}
        keyExtractor={(row, index) => row[0] ? String(row[0].id) : `empty-${index}`}
        getItemLayout={(_data, index) => ({
          length: cellSize,
          offset: cellSize * index,
          index,
        })}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews
        windowSize={5}
        onScrollToIndexFailed={(info) => {
          flatListRef.current?.scrollToOffset({ offset: info.index * cellSize, animated: true });
        }}
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
