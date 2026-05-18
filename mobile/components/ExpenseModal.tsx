import { useState, useEffect, useMemo } from "react";
import {
  View, Text, Pressable, TextInput, StyleSheet, ScrollView,
} from "react-native";
import { useTheme } from "@/lib/ThemeContext";
import BottomSheet from "@/components/BottomSheet";
import { EXPENSE_CATEGORIES, addExpense, type ExpenseCategory } from "@/lib/db";


interface ExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  presetDate?: Date | null;
}

export default function ExpenseModal({ visible, onClose, onSaved, presetDate }: ExpenseModalProps) {
  const { theme } = useTheme();

  const now = new Date();
  const [selectedDate, setSelectedDate] = useState(presetDate || now);
  const [category, setCategory] = useState<ExpenseCategory>("food");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  // Reset on open
  useEffect(() => {
    if (visible) {
      setSelectedDate(presetDate || new Date());
      setCategory("food");
      setAmount("");
      setMemo("");
    }
  }, [visible, presetDate]);

  const dateStr = `${selectedDate.getFullYear()}.${String(selectedDate.getMonth() + 1).padStart(2, "0")}.${String(selectedDate.getDate()).padStart(2, "0")}`;

  const handleSave = async () => {
    const amt = parseInt(amount.replace(/,/g, ""));
    if (!amt || amt <= 0) return;
    try {
      await addExpense({
        record_id: null,
        date: dateStr,
        category,
        amount: amt,
        memo: memo.trim() || null,
      });
      onSaved();
      onClose();
    } catch (e) {
      console.warn("ExpenseModal save error", e);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    header: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 20, marginBottom: 16,
    },
    headerBtn: {
      paddingVertical: 8, paddingHorizontal: 12,
      borderRadius: 10, minWidth: 52, alignItems: "center",
    },
    headerCancelBtn: {
      borderWidth: 1, borderColor: theme.border,
    },
    headerSaveBtn: {
      backgroundColor: theme.foreground,
    },
    headerBtnText: {
      fontSize: 14, fontWeight: "600",
    },
    headerCancelText: {
      color: theme.foreground,
    },
    headerSaveText: {
      fontWeight: "700", color: theme.background,
    },
    title: {
      flex: 1,
      fontSize: 17, fontWeight: "700", color: theme.foreground, textAlign: "center",
    },
    content: { padding: 20, paddingTop: 0 },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: theme.foreground, marginBottom: 10 },
    dateText: { fontSize: 15, color: theme.foreground, fontWeight: "600" },
    catRow: {
      flexDirection: "row", gap: 8, flexWrap: "wrap",
    },
    catBtn: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingVertical: 10, paddingHorizontal: 14,
      borderRadius: 12, backgroundColor: theme.card,
      borderWidth: 1, borderColor: theme.border,
    },
    catBtnActive: {
      borderColor: theme.foreground, backgroundColor: theme.muted,
    },
    catIcon: { fontSize: 16 },
    catLabel: { fontSize: 13, color: theme.foreground, fontWeight: "500" },
    input: {
      backgroundColor: theme.card, borderRadius: 12,
      padding: 14, fontSize: 16, color: theme.foreground,
      borderWidth: 1, borderColor: theme.border,
    },
    memoInput: {
      backgroundColor: theme.card, borderRadius: 12,
      padding: 14, fontSize: 14, color: theme.foreground,
      borderWidth: 1, borderColor: theme.border,
    },
    bottomRow: {
      flexDirection: "row", gap: 12,
      paddingHorizontal: 20, paddingTop: 8,
    },
    cancelBtn: {
      flex: 1, paddingVertical: 14, borderRadius: 14,
      borderWidth: 1, borderColor: theme.border, alignItems: "center",
    },
    cancelText: { fontSize: 14, color: theme.foreground, fontWeight: "600" },
    saveBtn: {
      flex: 1, paddingVertical: 14, borderRadius: 14,
      backgroundColor: theme.foreground, alignItems: "center",
    },
    saveText: { fontSize: 14, fontWeight: "700", color: theme.background },
  }), [theme]);

  return (
    <>
      <BottomSheet visible={visible} onClose={onClose}>
        <View style={styles.header}>
          <Pressable style={[styles.headerBtn, styles.headerCancelBtn]} onPress={onClose}>
              <Text style={[styles.headerBtnText, styles.headerCancelText]}>취소</Text>
            </Pressable>
            <Text style={styles.title}>지출 기록</Text>
            <Pressable style={[styles.headerBtn, styles.headerSaveBtn]} onPress={handleSave}>
              <Text style={[styles.headerBtnText, styles.headerSaveText]}>저장</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

            {/* Date */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>날짜</Text>
              <Text style={styles.dateText}>{dateStr}</Text>
            </View>

            {/* Category */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>카테고리</Text>
              <View style={styles.catRow}>
                {(Object.entries(EXPENSE_CATEGORIES) as [ExpenseCategory, { label: string; icon: string }][]).map(([key, info]) => (
                  <Pressable
                    key={key}
                    style={[styles.catBtn, category === key && styles.catBtnActive]}
                    onPress={() => setCategory(key)}
                  >
                    <Text style={styles.catIcon}>{info.icon}</Text>
                    <Text style={styles.catLabel}>{info.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Amount */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>금액</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={theme.mutedForeground}
                keyboardType="number-pad"
                autoFocus
              />
            </View>

            {/* Memo */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>메모 (선택)</Text>
              <TextInput
                style={styles.memoInput}
                value={memo}
                onChangeText={setMemo}
                placeholder="무엇을 샀나요?"
                placeholderTextColor={theme.mutedForeground}
              />
            </View>
          </ScrollView>
      </BottomSheet>
    </>
  );
}
