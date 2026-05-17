import { useState, useCallback, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, RefreshControl, ScrollView, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { TEAM_COLORS } from "@shared/teamColors";
import DiaryTimeline from "@/components/DiaryTimeline";
import DiaryCalendar from "@/components/DiaryCalendar";
import DiaryStats from "@/components/DiaryStats";
import DiaryEntryModal from "@/components/DiaryEntryModal";
import { getJikgwanRecords, deleteJikgwanRecord, type JikgwanRecord } from "@/lib/db";
import { getMyTeam } from "@/lib/db";
import SettingsButton from "@/components/SettingsButton";
import { useTheme, teamPrimaryColor } from "@/lib/ThemeContext";

type DiaryTab = "timeline" | "calendar" | "stats";

const TABS: { key: DiaryTab; label: string }[] = [
  { key: "timeline", label: "타임라인" },
  { key: "calendar", label: "캘린더" },
  { key: "stats", label: "통계" },
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
    // Segmented Control
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
      color: theme.background,
      fontWeight: "300",
      lineHeight: 30,
    },
  }), [theme]);
  const [activeTab, setActiveTab] = useState<DiaryTab>("timeline");
  const [records, setRecords] = useState<JikgwanRecord[]>([]);
  const [myTeam, setMyTeam] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<JikgwanRecord | null>(null);
  const [presetDate, setPresetDate] = useState<Date | null>(null);

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const loadRecords = useCallback(async () => {
    try {
      const data = await getJikgwanRecords();
      setRecords(data);
    } catch {}
  }, []);

  const loadMyTeam = useCallback(async () => {
    try {
      const team = await getMyTeam();
      setMyTeam(team);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecords();
      loadMyTeam();
    }, [loadRecords, loadMyTeam])
  );

  const handleRefresh = async () => {
    setSelectedDate(null);
    setRefreshing(true);
    await loadRecords();
    setRefreshing(false);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteJikgwanRecord(id);
      loadRecords();
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
    loadRecords();
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
    } else {
      setPresetDate(date);
      setShowEntryModal(true);
    }
  };

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
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.segment,
              activeTab === tab.key && { borderBottomWidth: 2, borderBottomColor: myTeam ? teamPrimaryColor(myTeam, isDark) : theme.foreground },
            ]}
            onPress={() => { setActiveTab(tab.key); if (tab.key !== "timeline") setSelectedDate(null); }}
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

      {/* Tab content */}
      {activeTab === "timeline" && (
        <DiaryTimeline
          records={filteredRecords}
          teamId={myTeam}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      )}

      {activeTab === "calendar" && (
        <ScrollView
          style={styles.tabContent}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.mutedForeground} />
          }
        >
          <DiaryCalendar
            year={calYear}
            month={calMonth}
            records={records}
            teamId={myTeam}
            onSelectDate={handleSelectDate}
            onMonthChange={(y, m) => { setCalYear(y); setCalMonth(m); }}
          />
        </ScrollView>
      )}

      {activeTab === "stats" && (
        <ScrollView
          style={styles.tabContent}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.mutedForeground} />
          }
        >
          <DiaryStats
            records={records}
            teamId={myTeam}
          />
        </ScrollView>
      )}

      {/* FAB */}
      <Pressable style={styles.fab} onPress={() => setShowEntryModal(true)}>
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
    </View>
  );
}

