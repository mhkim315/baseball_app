import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, RefreshControl, ScrollView, Alert, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, Modal } from "react-native";
import { useFocusEffect } from "expo-router";
import DiaryTimeline from "@/components/DiaryTimeline";
import WebzineTimeline from "@/components/WebzineTimeline";
import GridTimeline from "@/components/GridTimeline";
import DiaryCard from "@/components/DiaryCard";
import DiaryCalendar from "@/components/DiaryCalendar";
import YearSelector from "@/components/YearSelector";
import DiaryStats from "@/components/DiaryStats";
import DiaryEntryModal from "@/components/DiaryEntryModal";
import ExpenseBottomSheet from "@/components/ExpenseBottomSheet";
import ExpenseStats from "@/components/ExpenseStats";

import AchievementToast from "@/components/AchievementToast";
import AchievementModal from "@/components/AchievementModal";
import ConfettiOverlay from "@/components/ConfettiOverlay";
import ExpenseModal from "@/components/ExpenseModal";
import { getJikgwanRecords, deleteJikgwanRecord, getAllExpenses, getExpensesByDate, type JikgwanRecord, type Expense, type Badge } from "@/lib/db";
import { cachedDailyScores } from "@/lib/gameCache";

import { parseGameTeamIds } from "@shared/constants";
import { TEAM_COLORS } from "@shared/teamColors";
import MyButton from "@/components/MyButton";
import { useTheme } from "@/lib/ThemeContext";
import { teamPrimaryColor } from "@shared/teamColors";
import { useTeam } from "@/lib/TeamContext";



type DiaryTab = "timeline" | "calendar" | "stats";
type SubTab = "jikgwan" | "expense";
type TimelineViewMode = "list" | "webzine" | "grid";

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
      color: "#fff",
      fontWeight: "300",
      lineHeight: 30,
    },
    // View mode toggle
    viewModeBtn: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 12,
      backgroundColor: theme.muted,
    },
    viewModeBtnText: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.mutedForeground,
    },
    viewModeBtnTextActive: {
      color: "#fff",
    },
    // Webzine detail header
    webzineDetailHeader: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    webzineDetailBack: {
      fontSize: 15,
      fontWeight: "600",
    },
  }), [theme]);
  const [activeTab, setActiveTab] = useState<DiaryTab>("timeline");
  const [subTab, setSubTab] = useState<SubTab>("jikgwan");
  const [records, setRecords] = useState<JikgwanRecord[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [timelineViewMode, setTimelineViewMode] = useState<TimelineViewMode>("list");
  const [webzineDetailRecord, setWebzineDetailRecord] = useState<JikgwanRecord | null>(null);
  const [scrollTargetDate, setScrollTargetDate] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { myTeam } = useTeam();
  const teamColor = myTeam ? teamPrimaryColor(myTeam, isDark) : theme.foreground;
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<JikgwanRecord | null>(null);
  const [presetDate, setPresetDate] = useState<Date | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseSheetDate, setExpenseSheetDate] = useState<Date | null>(null);
  const [sheetExpenses, setSheetExpenses] = useState<Expense[]>([]);

  const [toastBadges, setToastBadges] = useState<Badge[]>([]);
  const [toastRewards, setToastRewards] = useState<{ emotion: string; label: string }[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showAchievementModal, setShowAchievementModal] = useState(false);



  // Horizontal tab scroll
  const tabScrollRef = useRef<ScrollView>(null);
  const { width: screenWidth } = useWindowDimensions();

  const checkBadges = async () => {
    try {
      const { backfillLiveRecords, evaluateBadges, grantRandomCharacter } = await import("@/lib/achievements");
      await backfillLiveRecords();
      const newBadges = await evaluateBadges();
      if (newBadges.length > 0) {
        // Grant random character reward for each new badge
        const rewards: { emotion: string; label: string }[] = [];
        for (let i = 0; i < newBadges.length; i++) {
          const reward = await grantRandomCharacter(newBadges[i].badge_key);
          if (reward) rewards.push(reward);
        }
        // Show confetti + toasts simultaneously
        setToastBadges(newBadges);
        setToastRewards(rewards);
        setShowConfetti(true);
      }
    } catch {}
  };
  const handleConfettiFinish = useCallback(() => {
    setShowConfetti(false);
  }, []);

  // Filter records by search query
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.trim().toLowerCase();
    return records.filter((r) => {
      const fields = [r.memo, r.stadium, r.seat, r.three_line_1, r.three_line_2, r.three_line_3];
      if (fields.some((f) => f?.toLowerCase().includes(q))) return true;
      // Search opponent team name
      const { awayId, homeId } = parseGameTeamIds(r.game_id || "");
      const cheered = r.cheered_team;
      const oppId = cheered ? (cheered === awayId ? homeId : awayId) : null;
      if (oppId && TEAM_COLORS[oppId]?.shortName?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [searchQuery, records]);

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
    handleTabChange(tabKey);
    tabScrollRef.current?.scrollTo({ x: screenWidth * index, animated: true });
  };

  const handleTabChange = useCallback((tab: DiaryTab) => {
    setActiveTab(tab);
    setShowSearch(false);
    setSearchQuery("");
  }, []);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
      const tab = TABS[page];
      if (tab) handleTabChange(tab.key);
    },
    [screenWidth, handleTabChange]
  );

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  // Expense calendar state
  const [expCalYear, setExpCalYear] = useState(now.getFullYear());
  const [expCalMonth, setExpCalMonth] = useState(now.getMonth());

  // Shared year state for calendar + stats
  const [diaryYear, setDiaryYear] = useState(now.getFullYear());
  const [loadState, setLoadState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [loadError, setLoadError] = useState<string | null>(null);

  const generationRef = useRef(0);

  const loadData = useCallback(async () => {
    const gen = ++generationRef.current;
    setLoadState("loading");
    setLoadError(null);
    try {
      const [data, exps] = await Promise.all([
        getJikgwanRecords(),
        getAllExpenses(),
      ]);
      // Merge scores into records in-memory (no DB write needed)
      const merge = (records: JikgwanRecord[], scoresList: { away: string; home: string; awayScore: number; homeScore: number; cancelled: boolean }[]) => {
        for (const r of records) {
          if (r.score_away != null && r.score_home != null && !(r.score_away === 0 && r.score_home === 0)) continue;
          const { awayId, homeId } = parseGameTeamIds(r.game_id);
          if (!awayId || !homeId) continue;
          const awayShort = TEAM_COLORS[awayId]?.shortName;
          const homeShort = TEAM_COLORS[homeId]?.shortName;
          if (!awayShort || !homeShort) continue;
          const match = scoresList.find((s) => s.away === awayShort && s.home === homeShort);
          if (!match) continue;
          if (match.cancelled) { r.is_cancelled = 1; continue; }
          if (match.awayScore == null || match.homeScore == null) continue;
          if (match.awayScore === 0 && match.homeScore === 0) continue;
          r.score_away = match.awayScore;
          r.score_home = match.homeScore;
          if (r.cheered_team) {
            if (r.cheered_team === homeId) r.is_win = match.homeScore > match.awayScore ? 1 : match.homeScore < match.awayScore ? -1 : 0;
            else if (r.cheered_team === awayId) r.is_win = match.awayScore > match.homeScore ? 1 : match.awayScore < match.homeScore ? -1 : 0;
          }
        }
      };
      // Per-date score lookup: only fetch dates for records without scores
      const dateSet = new Set<string>();
      for (const r of data) {
        if (r.score_away != null && r.score_home != null && !(r.score_away === 0 && r.score_home === 0)) continue;
        dateSet.add(r.date.split(".").join("-"));
      }
      const scoresResults = await Promise.all(
        Array.from(dateSet).map((date) =>
          cachedDailyScores(date).catch(() => null)
        )
      );
      let i = 0;
      for (const apiDate of dateSet) {
        const dayScores = scoresResults[i++];
        if (!dayScores?.games) continue;
        const dayRecords = data.filter((r) => r.date.split(".").join("-") === apiDate);
        if (dayRecords.length > 0) merge(dayRecords, dayScores.games);
      }
      if (gen !== generationRef.current) return; // discard stale

      setRecords(data);
      setExpenses(exps);
      setScrollTargetDate(null);
      setLoadState("success");
    } catch (e) {
      console.warn("diary.tsx loadData failed", e);
      setLoadState("error");
      setLoadError(e instanceof Error ? e.message : "데이터를 불러오지 못했습니다");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      checkBadges();
    }, [loadData])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteJikgwanRecord(id);
      if (expenseSheetDate) {
        const dateStr = `${expenseSheetDate.getFullYear()}.${String(expenseSheetDate.getMonth() + 1).padStart(2, "0")}.${String(expenseSheetDate.getDate()).padStart(2, "0")}`;
        try {
          const exps = await getExpensesByDate(dateStr);
          setSheetExpenses(exps);
        } catch {}
      }
      await loadData();
      await checkBadges();
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

  const handleSaved = async () => {
    setShowEntryModal(false);
    setEditingRecord(null);
    setPresetDate(null);
    if (expenseSheetDate) {
      const dateStr = `${expenseSheetDate.getFullYear()}.${String(expenseSheetDate.getMonth() + 1).padStart(2, "0")}.${String(expenseSheetDate.getDate()).padStart(2, "0")}`;
      try {
        const exps = await getExpensesByDate(dateStr);
        setSheetExpenses(exps);
      } catch {}
    }
    await loadData();
    await checkBadges();
  };

  const handleExpenseSaved = async () => {
    setShowExpenseModal(false);
    setExpensePresetDate(null);
    if (expenseSheetDate) {
      const dateStr = `${expenseSheetDate.getFullYear()}.${String(expenseSheetDate.getMonth() + 1).padStart(2, "0")}.${String(expenseSheetDate.getDate()).padStart(2, "0")}`;
      try {
        const exps = await getExpensesByDate(dateStr);
        setSheetExpenses(exps);
      } catch {}
    }
    await loadData();
  };

  const [expensePresetDate, setExpensePresetDate] = useState<Date | null>(null);

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

  const handleSelectDate = (date: Date) => {
    setCalYear(date.getFullYear());
    setCalMonth(date.getMonth());
    const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
    const hasRecord = records.some((r) => r.date === dateStr);
    if (hasRecord) {
      handleTabChange("timeline");
      tabScrollRef.current?.scrollTo({ x: 0, animated: true });
      setScrollTargetDate(dateStr);
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



  const showSubTabs = activeTab === "calendar" || activeTab === "stats";
  const isExpenseFab = showSubTabs && subTab === "expense";

  const handleFabPress = () => {
    if (isExpenseFab) {
      setExpensePresetDate(null);
      setShowExpenseModal(true);
    } else {
      setShowEntryModal(true);
    }
  };

  return (
    <View style={styles.container}>
      {/* Badge unlock confetti + toast */}
      <ConfettiOverlay visible={showConfetti} onFinish={handleConfettiFinish} />
      <AchievementToast
        badges={toastBadges}
        rewards={toastRewards}
        teamId={myTeam ?? undefined}
        onDismiss={() => { setToastBadges([]); setToastRewards([]); }}
        onPress={() => { setToastBadges([]); setToastRewards([]); setShowAchievementModal(true); }}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={styles.headerTitle}>다이어리</Text>
          <View style={{ flex: 1 }} />
          {(activeTab === "timeline") && (
            <View style={{ flexDirection: "row", gap: 3, marginRight: 8 }}>
              <Pressable
                style={[styles.viewModeBtn, timelineViewMode === "list" && { backgroundColor: myTeam ? teamPrimaryColor(myTeam, isDark) : theme.foreground }]}
                onPress={() => setTimelineViewMode("list")}
              >
                <Text style={[styles.viewModeBtnText, timelineViewMode === "list" && styles.viewModeBtnTextActive]}>▣ 카드</Text>
              </Pressable>
              <Pressable
                style={[styles.viewModeBtn, timelineViewMode === "webzine" && { backgroundColor: myTeam ? teamPrimaryColor(myTeam, isDark) : theme.foreground }]}
                onPress={() => setTimelineViewMode("webzine")}
              >
                <Text style={[styles.viewModeBtnText, timelineViewMode === "webzine" && styles.viewModeBtnTextActive]}>☰ 리스트</Text>
              </Pressable>
              <Pressable
                style={[styles.viewModeBtn, timelineViewMode === "grid" && { backgroundColor: myTeam ? teamPrimaryColor(myTeam, isDark) : theme.foreground }]}
                onPress={() => setTimelineViewMode("grid")}
              >
                <Text style={[styles.viewModeBtnText, timelineViewMode === "grid" && styles.viewModeBtnTextActive]}>⊞ 그리드</Text>
              </Pressable>
            </View>
          )}
          {(activeTab === "calendar" || activeTab === "stats") && (
            <View style={{ flexDirection: "row", gap: 4, marginRight: 10 }}>
              {SUB_TABS.map((st) => (
                <Pressable
                  key={st.key}
                  style={[styles.viewModeBtn, subTab === st.key && { backgroundColor: myTeam ? teamPrimaryColor(myTeam, isDark) : theme.foreground }]}
                  onPress={() => {
                    setSubTab(st.key);
                    if (st.key === "jikgwan") { setCalYear(expCalYear); setCalMonth(expCalMonth); }
                    else if (st.key === "expense") { setExpCalYear(calYear); setExpCalMonth(calMonth); }
                  }}
                >
                  <Text style={[styles.viewModeBtnText, subTab === st.key && styles.viewModeBtnTextActive]}>{st.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <MyButton color={myTeam ? teamPrimaryColor(myTeam, isDark) : undefined} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 8 }}>
          <Text style={styles.headerSub}>나의 직관 기록</Text>
          <View style={{ flex: 1 }} />
          {activeTab === "timeline" && (
          <Pressable
            style={[styles.viewModeBtn, { marginRight: 6 }, showSearch && { backgroundColor: myTeam ? teamPrimaryColor(myTeam, isDark) : theme.foreground }]}
            onPress={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(""); }}
          >
            <Text style={[styles.viewModeBtnText, showSearch && styles.viewModeBtnTextActive, { fontSize: 15 }]}>⌕</Text>
          </Pressable>
          )}
          <YearSelector year={diaryYear} onYearChange={(y) => {
            setDiaryYear(y);
            setCalYear(y);
            setExpCalYear(y);
          }} />
        </View>
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

      {/* Search bar */}
      {showSearch && (
        <View style={{ marginHorizontal: 20, marginBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.muted, borderRadius: 10, paddingHorizontal: 12, height: 36 }}>
            <Text style={{ fontSize: 14, marginRight: 6, color: theme.mutedForeground }}>⌕</Text>
            <TextInput
              style={{ flex: 1, fontSize: 14, color: theme.foreground, paddingVertical: 0 }}
              placeholder="메모, 구장, 상대팀, 좌석 검색"
              placeholderTextColor={theme.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <Text style={{ fontSize: 16, color: theme.mutedForeground }}>×</Text>
              </Pressable>
            ) : null}
          </View>
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
            {filteredRecords.length === 0 ? (
              loadState === "error" ? (
                <View style={{ paddingVertical: 60, alignItems: "center", paddingHorizontal: 32, gap: 16 }}>
                  <Text style={{ fontSize: 16, color: theme.mutedForeground, textAlign: "center", lineHeight: 24 }}>
                    데이터를 불러오지 못했습니다{loadError ? `\n(${loadError})` : ""}
                  </Text>
                  <Pressable
                    style={{ paddingHorizontal: 28, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
                    onPress={loadData}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "600", color: theme.foreground }}>다시 시도</Text>
                  </Pressable>
                </View>
              ) : (
              <View style={{ paddingVertical: 60, alignItems: "center", paddingHorizontal: 32 }}>
                <Text style={{ fontSize: 16, color: theme.mutedForeground, textAlign: "center", lineHeight: 24 }}>
                  {records.length === 0
                    ? "아직 직관 기록이 없어요"
                    : (searchQuery ? "검색 결과가 없어요" : "해당 조건의 기록이 없어요")}
                </Text>
              </View>
              )
            ) : timelineViewMode === "list" ? (
              <DiaryTimeline
                records={filteredRecords}
                teamId={myTeam}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onRefresh={handleRefresh}
                refreshing={refreshing}
                expensesByRecordId={expenseMap}
                scrollTargetDate={scrollTargetDate}
              />
            ) : timelineViewMode === "webzine" ? (
              <WebzineTimeline
                records={filteredRecords}
                teamId={myTeam}
                onDelete={handleDelete}
                onRefresh={handleRefresh}
                refreshing={refreshing}
                expensesByRecordId={expenseMap}
                onPressRecord={setWebzineDetailRecord}
                scrollTargetDate={scrollTargetDate}
              />
            ) : (
              <GridTimeline
                records={filteredRecords}
                onDelete={handleDelete}
                onRefresh={handleRefresh}
                refreshing={refreshing}
                onPressRecord={setWebzineDetailRecord}
                scrollTargetDate={scrollTargetDate}
              />
            )}
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
              <DiaryCalendar
                year={subTab === "expense" ? expCalYear : calYear}
                month={subTab === "expense" ? expCalMonth : calMonth}
                records={records}
                teamId={myTeam}
                onSelectDate={subTab === "expense" ? handleSelectExpenseDate : handleSelectDate}
                onMonthChange={(y, m) => {
                  if (subTab === "expense") { setExpCalYear(y); setExpCalMonth(m); }
                  else { setCalYear(y); setCalMonth(m); }
                  setDiaryYear(y);
                }}
                mode={subTab}
                expenses={subTab === "expense" ? expenses : undefined}
              />
            </ScrollView>
            {subTab === "expense" && (
              <ExpenseBottomSheet
                date={expenseSheetDate}
                expenses={sheetExpenses}
                onClose={() => { setExpenseSheetDate(null); setSheetExpenses([]); }}
                onRefresh={handleExpenseSheetRefresh}
                onAdd={() => {
                  setExpensePresetDate(expenseSheetDate);
                  setShowExpenseModal(true);
                }}
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
                  year={diaryYear}
                />
              ) : (
                <ExpenseStats expenses={expenses} records={records} teamId={myTeam} year={diaryYear} />
              )}
            </ScrollView>
          </View>
        </ScrollView>
      </View>

      {/* Webzine detail modal */}
      <Modal
        visible={!!webzineDetailRecord}
        animationType="slide"
        onRequestClose={() => setWebzineDetailRecord(null)}
      >
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={[styles.webzineDetailHeader, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <Pressable onPress={() => setWebzineDetailRecord(null)} hitSlop={12}>
              <Text style={[styles.webzineDetailBack, { color: theme.foreground }]}>← 웹진</Text>
            </Pressable>
          </View>
          <ScrollView>
            {webzineDetailRecord && (
              <DiaryCard
                record={webzineDetailRecord}
                teamId={myTeam}
                onDelete={(record) => {
                  handleDelete(record.id);
                  setWebzineDetailRecord(null);
                }}
                onEdit={(record) => {
                  setWebzineDetailRecord(null);
                  handleEdit(record);
                }}
                expenses={expenseMap.get(webzineDetailRecord.id)}
              />
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* FAB */}
      <Pressable
        style={[styles.fab, { backgroundColor: isExpenseFab ? "gray" : teamColor }]}
        onPress={handleFabPress}
      >
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
        onClose={() => { setShowExpenseModal(false); setExpensePresetDate(null); }}
        onSaved={handleExpenseSaved}
        presetDate={expensePresetDate}
      />

      {/* Achievement Modal (from toast press) */}
      <AchievementModal
        visible={showAchievementModal}
        onClose={() => setShowAchievementModal(false)}
      />

    </View>
  );
}
