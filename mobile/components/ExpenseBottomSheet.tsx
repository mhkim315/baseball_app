import { useMemo, useCallback } from "react";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { useTheme } from "@/lib/ThemeContext";
import { EXPENSE_CATEGORIES, deleteExpense, type Expense } from "@/lib/db";
import { formatAmount } from "@/lib/expenseStats";

interface ExpenseBottomSheetProps {
  date: Date | null;
  expenses: Expense[];
  onClose: () => void;
  onRefresh: () => void;
  onAdd?: () => void;
}

export default function ExpenseBottomSheet({ date, expenses, onClose, onRefresh, onAdd }: ExpenseBottomSheetProps) {
  const { theme } = useTheme();

  const total = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await deleteExpense(id);
      onRefresh();
    } catch (e) {
      console.warn("ExpenseBottomSheet delete failed", e);
    }
  }, [onRefresh]);

  const renderItem = useCallback(({ item }: { item: Expense }) => {
    const cat = EXPENSE_CATEGORIES[item.category as keyof typeof EXPENSE_CATEGORIES] || EXPENSE_CATEGORIES.other;
    return (
      <View style={styles.row}>
        <Text style={styles.icon}>{cat.icon}</Text>
        <Text style={styles.catLabel}>{cat.label}</Text>
        <Text style={styles.memoText} numberOfLines={1}>{item.memo || ""}</Text>
        <Text style={styles.amountText}>{formatAmount(item.amount)}</Text>
        <Pressable style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
          <Text style={styles.deleteText}>삭제</Text>
        </Pressable>
      </View>
    );
  }, [handleDelete]);

  const dateStr = useMemo(() => date
    ? `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`
    : "", [date]);

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "flex-end",
      zIndex: 50,
    },
    sheet: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "70%",
      paddingBottom: 40,
    },
    handleRow: { alignItems: "center", paddingVertical: 12 },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border },
    header: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingHorizontal: 20, marginBottom: 12,
    },
    title: { fontSize: 17, fontWeight: "700", color: theme.foreground },
    totalText: { fontSize: 18, fontWeight: "700", color: theme.foreground },
    closeBtn: { padding: 4 },
    closeText: { fontSize: 16, color: theme.mutedForeground },
    list: { paddingHorizontal: 20, paddingBottom: 90 },
    row: {
      flexDirection: "row", alignItems: "center",
      paddingVertical: 12, gap: 10,
      borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    icon: { fontSize: 18 },
    catLabel: { fontSize: 13, color: theme.foreground, fontWeight: "600", width: 55 },
    memoText: { fontSize: 12, color: theme.mutedForeground, flex: 1 },
    amountText: { fontSize: 14, color: theme.foreground, fontWeight: "700" },
    deleteBtn: { paddingLeft: 8 },
    deleteText: { fontSize: 14, color: "#ef4444" },
    emptyText: {
      fontSize: 14, color: theme.mutedForeground, textAlign: "center",
      paddingVertical: 40,
    },
  }), [theme]);

  if (!date) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>{dateStr}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {onAdd && (
              <Pressable style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, backgroundColor: theme.muted }} onPress={onAdd}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: theme.foreground }}>+ 추가</Text>
              </Pressable>
            )}
            <Text style={styles.totalText}>{formatAmount(total)}</Text>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
        </View>

        {expenses.length === 0 ? (
          <Text style={styles.emptyText}>지출 내역이 없어요</Text>
        ) : (
          <FlatList
            data={expenses}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            renderItem={renderItem}
          />
        )}
      </View>
    </View>
  );
}
