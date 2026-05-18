import { useState, useCallback, useMemo, useRef } from "react";
import { View, Text, Pressable, StyleSheet, RefreshControl, ScrollView, Alert, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { useFocusEffect } from "expo-router";
import { TEAM_COLORS } from "@shared/teamColors";
import DiaryTimeline from "@/components/DiaryTimeline";
import DiaryCalendar from "@/components/DiaryCalendar";
import DiaryStats from "@/components/DiaryStats";
import DiaryEntryModal from "@/components/DiaryEntryModal";
import ExpenseCalendar from "@/components/ExpenseCalendar";
import ExpenseBottomSheet from "@/components/ExpenseBottomSheet";
import ExpenseStats from "@/components/ExpenseStats";
import ExpenseModal from "@/components/ExpenseModal";
import { getJikgwanRecords, deleteJikgwanRecord, getAllExpenses, getExpensesByDate, type JikgwanRecord, type Expense } from "@/lib/db";
import SettingsButton from "@/components/SettingsButton";
import { useTheme, teamPrimaryColor } from "@/lib/ThemeContext";
import { useTeam } from "@/lib/TeamContext";

type DiaryTab = "timeline" | "calendar" | "stats";
type SubTab = "jikgwan" | "expense";

const TABS: { key: DiaryTab; label: string }[] = [
  { key: "timeline", label: "타임라인" },
  { key: "calendar", label: "캘린더" },
  { key: "stats", label: "통계" },
];

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "jikgwan", label: "직관" },
  { key: "expense", label: "지출" },
];

export default function DiaryScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      paddingTop: 60,
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.foreground,
    },
    headerSub: {
      fontSize: 13,
      color: theme.mutedForeground,
      marginTop: 4,
    },
    // Main tabs
    segmentRow: {
      flexDirection: "row",
      marginHorizontal: 20,
      marginBottom: 8,
      gap: 0,
    },
    segment: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 10,
    },
    segmentText: {
      fontSize: 14,
      color: theme.mutedForeground,
      fontWeight: "500",
    },
    // Sub tabs
    subRow: {
      flexDirection: "row",
      marginHorizontal: 20,
      marginBottom: 4,
      gap: 0,
      justifyContent: "center",
    },
    subSegment: {
      paddingVertical: 6,
      paddingHorizontal: 20,
    },
    subSegmentText: {
      fontSize: 13,
      color: theme.mutedForeground,
    },
    // Tab content
    tabContent: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 100,
    },
    // FAB
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
    fabText: {
      fontSize: 28,
      color: theme.background,
      fontWeight: "300",
      lineHeight: 30,
    },
  }), [theme]);
  const [activeTab, setActiveTab] = useState<DiaryTab>("timeline");
  const [subTab, setSubTab] = useState<SubTab>("jikgwan");
  const [records, setRecords] = useState<JikgwanRecord[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const { myTeam } = useTeam();
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<JikgwanRecord | null>(null);
  const [presetDate, setPresetDate] = useState<Date | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseSheetDate, setExpenseSheetDate] = useState<Date | null>(null);
  const [sheetExpenses, setSheetExpenses] = useState<Expense[]>([]);

  // Horizontal tab scroll
  const tabScrollRef = useRef<ScrollView>(null);
  const { width: screenWidth } = useWindowDimensions();

  // Build expense map for timeline (record_id → expenses[])
  const expenseMap = useMemo(() => {
    const map = new Map<number, Expense[]>();
    for (const exp of expenses) {
      if (exp.record_id != null) {
        const list = map.get(exp.record_id) || [];
        list.push(exp);
        map.set(exp.record_id, list);
      }
    }
    return map;
  }, [expenses]);

  const handleTabPress = (tabKey: DiaryTab, index: number) => {
    tabScrollRef.current?.scrollTo({ x: screenWidth * index, animated: true });
    if (tabKey !== "timeline") setSelectedDate(null);
  };

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
      const tab = TABS[page];
      if (tab) setActiveTab(tab.key);
    },
    [screenWidth]
  );

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Expense calendar state
  const [expCalYear, setExpCalYear] = useState(now.getFullYear());
  const [expCalMonth, setExpCalMonth] = useState(now.getMonth());

  const loadData = useCallback(async () => {
    try {
      const [data, exps] = await Promise.all([
        getJikgwanRecords(),
        getAllExpenses(),
      ]);
      setRecords(data);
      setExpenses(exps);
    } catch (e) {
      console.warn("diary.tsx loadData failed", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = async () => {
    setSelectedDate(null);
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteJikgwanRecord(id);
      loadData();
    } catch {
      Alert.alert("삭제 오류", "기록을 삭제하지 못했습니다");
    }
  };

  const handleEdit = (record: JikgwanRecord) => {
    setEditingRecord(record);
  };

  const handleCloseModal = () => {
    setShowEntryModal(false);
    setEditingRecord(null);
    setPresetDate(null);
  };

  const handleSaved = () => {
    setShowEntryModal(false);
    setEditingRecord(null);
    setPresetDate(null);
    loadData();
  };

  const handleExpenseSaved = () => {
    setShowExpenseModal(false);
    loadData();
  };

  const handleExpenseSheetRefresh = async () => {
    try {
      if (expenseSheetDate) {
        const dateStr = `${expenseSheetDate.getFullYear()}.${String(expenseSheetDate.getMonth() + 1).padStart(2, "0")}.${String(expenseSheetDate.getDate()).padStart(2, "0")}`;
        const exps = await getExpensesByDate(dateStr);
        setSheetExpenses(exps);
      }
      await loadData();
    } catch (e) {
      console.warn("diary.tsx handleExpenseSheetRefresh failed", e);
    }
  };

  const filteredRecords = selectedDate
    ? records.filter((r) => {
        const parts = r.date.split(".");
        if (parts.length !== 3) return false;
        const d = `${parseInt(parts[0])}-${parseInt(parts[1])}-${parseInt(parts[2])}`;
        const sd = `${selectedDate.getFullYear()}-${selectedDate.getMonth() + 1}-${selectedDate.getDate()}`;
        return d === sd;
      })
    : records;

  const handleSelectDate = (date: Date) => {
    setCalYear(date.getFullYear());
    setCalMonth(date.getMonth());
    setSelectedDate(date);
    const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
    const hasRecord = records.some((r) => r.date === dateStr);
    if (hasRecord) {
      setActiveTab("timeline");
      tabScrollRef.current?.scrollTo({ x: 0, animated: true });
    } else {
      setPresetDate(date);
      setShowEntryModal(true);
    }
  };

  const handleSelectExpenseDate = async (date: Date) => {
    try {
      const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
      const exps = await getExpensesByDate(dateStr);
      setExpenseSheetDate(date);
      setSheetExpenses(exps);
    } catch (e) {
      console.warn("diary.tsx handleSelectExpenseDate failed", e);
    }
  };

  const handleFabPress = () => {
    if (subTab === "expense") {
      setShowExpenseModal(true);
    } else {
      setShowEntryModal(true);
    }
  };

  const showSubTabs = activeTab === "calendar" || activeTab === "stats";

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={styles.headerTitle}>다이어리</Text>
          <View style={{ flex: 1 }} />
          <SettingsButton color={myTeam ? teamPrimaryColor(myTeam, isDark) : undefined} />
        </View>
        <Text style={styles.headerSub}>나의 직관 기록</Text>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmentRow}>
        {TABS.map((tab, idx) => (
          <Pressable
            key={tab.key}
            style={[
              styles.segment,
              activeTab === tab.key && { borderBottomWidth: 2, borderBottomColor: myTeam ? teamPrimaryColor(myTeam, isDark) : theme.foreground },
            ]}
            onPress={() => handleTabPress(tab.key, idx)}
          >
            <Text style={[
              styles.segmentText,
              activeTab === tab.key && { color: myTeam ? teamPrimaryColor(myTeam, isDark) : theme.foreground, fontWeight: "700" },
            ]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Sub-tabs: 직관 / 지출 (only for calendar & stats) */}
      {showSubTabs && (
        <View style={styles.subRow}>
          {SUB_TABS.map((st) => (
            <Pressable
              key={st.key}
              style={styles.subSegment}
              onPress={() => setSubTab(st.key)}
            >
              <Text style={[
                styles.subSegmentText,
                subTab === st.key && { color: myTeam ? teamPrimaryColor(myTeam, isDark) : theme.foreground, fontWeight: "700" },
              ]}>
                {st.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Tab content — horizontal paging scroll */}
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={tabScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
        >
          {/* Tab 1: Timeline */}
          <View style={{ width: screenWidth }}>
            <DiaryTimeline
              records={filteredRecords}
              teamId={myTeam}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              expensesByRecordId={expenseMap}
            />
          </View>

          {/* Tab 2: Calendar (직관/지출 sub-tabs) */}
          <View style={{ width: screenWidth, position: "relative" }}>
            <ScrollView
              style={styles.tabContent}
              contentContainerStyle={styles.scrollContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.mutedForeground} />
              }
            >
              {subTab === "jikgwan" ? (
                <DiaryCalendar
                  year={calYear}
                  month={calMonth}
                  records={records}
                  teamId={myTeam}
                  onSelectDate={handleSelectDate}
                  onMonthChange={(y, m) => { setCalYear(y); setCalMonth(m); }}
                />
              ) : (
                <ExpenseCalendar
                  year={expCalYear}
                  month={expCalMonth}
                  expenses={expenses}
                  records={records}
                  onSelectDate={handleSelectExpenseDate}
                  onMonthChange={(y, m) => { setExpCalYear(y); setExpCalMonth(m); }}
                />
              )}
            </ScrollView>
            {subTab === "expense" && (
              <ExpenseBottomSheet
                date={expenseSheetDate}
                expenses={sheetExpenses}
                onClose={() => { setExpenseSheetDate(null); setSheetExpenses([]); }}
                onRefresh={handleExpenseSheetRefresh}
              />
            )}
          </View>

          {/* Tab 3: Stats (직관/지출 sub-tabs) */}
          <View style={{ width: screenWidth }}>
            <ScrollView
              style={styles.tabContent}
              contentContainerStyle={styles.scrollContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.mutedForeground} />
              }
            >
              {subTab === "jikgwan" ? (
                <DiaryStats
                  records={records}
                  teamId={myTeam}
                />
              ) : (
                <ExpenseStats expenses={expenses} />
              )}
            </ScrollView>
          </View>
        </ScrollView>
      </View>

      {/* FAB — context-aware */}
      <Pressable style={[styles.fab, subTab === "expense" && { backgroundColor: theme.mutedForeground }]} onPress={handleFabPress}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      {/* Entry Modal */}
      <DiaryEntryModal
        visible={showEntryModal || !!editingRecord}
        onClose={handleCloseModal}
        onSaved={handleSaved}
        editRecord={editingRecord}
        presetDate={presetDate}
      />

      {/* Expense Modal */}
      <ExpenseModal
        visible={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        onSaved={handleExpenseSaved}
      />
    </View>
  );
}
