import { useState, useEffect, useMemo, useRef } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, Platform, Animated,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useTheme } from "@/lib/ThemeContext";
import { useKeyboardHeight } from "@/lib/hooks/useKeyboardHeight";
import BottomSheet from "@/components/BottomSheet";
import ExpenseForm from "@/components/ExpenseForm";
import { getDaysInMonth, getFirstDayOfMonth, formatDate } from "@shared/constants";
import { addExpense, type ExpenseCategory } from "@/lib/db";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

type Step = "calendar" | "input";

interface ExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  presetDate?: Date | null;
}

export default function ExpenseModal({ visible, onClose, onSaved, presetDate }: ExpenseModalProps) {
  const { theme } = useTheme();

  const now = new Date();
  const [step, setStep] = useState<Step>("calendar");
  const [selectedDate, setSelectedDate] = useState(presetDate || now);
  const [calYear, setCalYear] = useState((presetDate || now).getFullYear());
  const [calMonth, setCalMonth] = useState((presetDate || now).getMonth());
  const [category, setCategory] = useState<ExpenseCategory>("food");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const keyboardHeight = useKeyboardHeight();
  const scrollRef = useRef<ScrollView>(null);

  // Reset on open
  useEffect(() => {
    if (visible) {
      const d = presetDate || new Date();
      setSelectedDate(d);
      setCalYear(d.getFullYear());
      setCalMonth(d.getMonth());
      setStep(presetDate ? "input" : "calendar");
      setCategory("food");
      setAmount("");
      setMemo("");
    }
  }, [visible, presetDate]);

  const dateStr = formatDate(selectedDate);

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

  const handleDateSelect = (day: number) => {
    setSelectedDate(new Date(calYear, calMonth, day));
    setStep("input");
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  // Calendar
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === calYear && today.getMonth() === calMonth;
  const cells: { day: number; isToday: boolean }[] = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: 0, isToday: false });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, isToday: isCurrentMonth && today.getDate() === d });
  }
  const isSelectedToday = selectedDate.getFullYear() === calYear && selectedDate.getMonth() === calMonth;

  const calPrev = () => {
    const m = calMonth === 0 ? 11 : calMonth - 1;
    setCalYear(calMonth === 0 ? calYear - 1 : calYear);
    setCalMonth(m);
  };
  const calNext = () => {
    const m = calMonth === 11 ? 0 : calMonth + 1;
    setCalYear(calMonth === 11 ? calYear + 1 : calYear);
    setCalMonth(m);
  };
  const calPrevRef = useRef(calPrev);
  calPrevRef.current = calPrev;
  const calNextRef = useRef(calNext);
  calNextRef.current = calNext;
  const calTranslateX = useRef(new Animated.Value(0)).current;
  const calMonthPanGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onUpdate((e) => { calTranslateX.setValue(Math.max(-40, Math.min(40, e.translationX))); })
    .onEnd((e) => {
      if (e.translationX > 60) calPrevRef.current();
      else if (e.translationX < -60) calNextRef.current();
      Animated.spring(calTranslateX, { toValue: 0, useNativeDriver: true }).start();
    });

  const styles = useMemo(() => StyleSheet.create({
    header: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 20, marginBottom: 12,
    },
    headerBtn: {
      paddingVertical: 8, paddingHorizontal: 12,
      borderRadius: 10, minWidth: 52, alignItems: "center",
    },
    headerCancelBtn: {
      borderWidth: 1, borderColor: theme.border,
    },
    headerBackBtn: {
      paddingVertical: 8, paddingHorizontal: 12,
      borderRadius: 10, alignItems: "center",
    },
    headerBackText: { fontSize: 14, color: theme.mutedForeground, fontWeight: "600" },
    headerBtnText: {
      fontSize: 14, fontWeight: "600",
    },
    headerCancelText: {
      color: theme.foreground,
    },
    title: {
      flex: 1,
      fontSize: 17, fontWeight: "700", color: theme.foreground, textAlign: "center",
    },
    // Calendar
    calHeader: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      marginBottom: 8,
    },
    calNav: { fontSize: 14, color: theme.foreground, paddingHorizontal: 8 },
    calMonth: { fontSize: 15, fontWeight: "700", color: theme.foreground },
    calDayRow: { flexDirection: "row", marginBottom: 2 },
    calDayHeader: {
      flex: 1, textAlign: "center", fontSize: 11,
      color: theme.mutedForeground, fontWeight: "600", paddingVertical: 4,
    },
    calGrid: { flexDirection: "row", flexWrap: "wrap" },
    calCell: {
      width: "14.28%", aspectRatio: 1,
      justifyContent: "center", alignItems: "center",
    },
    calDayInner: {
      width: 30, height: 30, justifyContent: "center", alignItems: "center", borderRadius: 15,
    },
    calDayToday: { backgroundColor: theme.muted },
    calDaySelected: { backgroundColor: theme.foreground },
    calDayNum: { fontSize: 13, color: theme.foreground, fontWeight: "500" },
    calDayNumSelected: { color: theme.background, fontWeight: "700" },
    // Input step
    dateLabel: {
      fontSize: 15, color: theme.foreground, fontWeight: "600", marginBottom: 16,
      paddingHorizontal: 20,
    },
    formWrapper: {
      paddingHorizontal: 20, paddingBottom: 20,
    },
  }), [theme]);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 0, paddingBottom: 20 + keyboardHeight }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {step === "calendar" ? (
          <>
            <View style={styles.header}>
              <Pressable style={[styles.headerBtn, styles.headerCancelBtn]} onPress={onClose} hitSlop={8}>
                <Text style={[styles.headerBtnText, styles.headerCancelText]}>취소</Text>
              </Pressable>
              <Text style={styles.title}>날짜 선택</Text>
              <View style={{ minWidth: 52 }} />
            </View>

            <GestureDetector gesture={calMonthPanGesture}>
              <Animated.View style={{ paddingHorizontal: 20, transform: [{ translateX: calTranslateX }] }}>
                <View style={styles.calHeader}>
                  <Pressable onPress={calPrev} hitSlop={8}>
                    <Text style={styles.calNav}>◀</Text>
                  </Pressable>
                  <Text style={styles.calMonth}>{calYear}년 {calMonth + 1}월</Text>
                  <Pressable onPress={calNext} hitSlop={8}>
                    <Text style={styles.calNav}>▶</Text>
                  </Pressable>
                </View>
                <View style={styles.calDayRow}>
                  {DAYS.map((d, i) => (
                    <Text key={d} style={[styles.calDayHeader, (i === 0 || i === 6) && { color: theme.mutedForeground }]}>{d}</Text>
                  ))}
                </View>
                <View style={styles.calGrid}>
                  {cells.map((cell, idx) => {
                    if (cell.day === 0) return <View key={`e-${idx}`} style={styles.calCell} />;
                    const sel = isSelectedToday && selectedDate.getDate() === cell.day;
                    return (
                      <Pressable key={`d-${cell.day}`} style={styles.calCell} onPress={() => handleDateSelect(cell.day)}>
                        <View style={[styles.calDayInner, cell.isToday && styles.calDayToday, sel && styles.calDaySelected]}>
                          <Text style={[styles.calDayNum, sel && styles.calDayNumSelected]}>{cell.day}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </Animated.View>
            </GestureDetector>
          </>
        ) : (
          <>
            <View style={styles.header}>
              <Pressable style={styles.headerBackBtn} onPress={() => {
                setStep("calendar");
              }} hitSlop={8}>
                <Text style={styles.headerBackText}>← 뒤로</Text>
              </Pressable>
              <Text style={styles.title}>지출 기록</Text>
              <View style={{ minWidth: 52 }} />
            </View>

            <Text style={styles.dateLabel}>{dateStr}</Text>

            <View style={styles.formWrapper}>
              <ExpenseForm
                category={category}
                onCategoryChange={setCategory}
                amount={amount}
                onAmountChange={setAmount}
                memo={memo}
                onMemoChange={setMemo}
                onSave={handleSave}
                onCancel={() => { setStep("calendar"); }}
                saveLabel="저장"
                cancelLabel="취소"
                autoFocusAmount
              />
            </View>
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}
