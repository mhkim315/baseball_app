import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/lib/ThemeContext";
import { formatDateForApi as formatDateStr } from "@shared/constants";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function getWeekDates(baseDate: Date): Date[] {
  const dates: Date[] = [];
  const day = baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - ((day + 6) % 7));
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

function getWeekOfMonth(date: Date): number {
  const monday = new Date(date);
  const day = date.getDay();
  monday.setDate(date.getDate() - ((day + 6) % 7));
  return Math.floor((monday.getDate() - 1) / 7) + 1;
}

interface DateStripProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  hasGameDates?: string[];
  teamColor?: string;
}

export default function DateStrip({ selectedDate, onDateChange, hasGameDates = [], teamColor }: DateStripProps) {
  const { theme } = useTheme();
  const goPrevWeek = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 7);
    onDateChange(d);
  };

  const goNextWeek = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 7);
    onDateChange(d);
  };

  const weekDates = getWeekDates(selectedDate);

  const goToday = () => onDateChange(new Date());

  const styles = useMemo(() => StyleSheet.create({
    container: {
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.card,
    },
    weekLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 6,
      paddingBottom: 0,
    },
    weekLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.mutedForeground,
    },
    todayLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.primary,
    },
    stripRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 56,
    },
    weekBtn: { paddingHorizontal: 12, paddingVertical: 8 },
    weekArrow: { fontSize: 22, color: theme.mutedForeground, fontWeight: "300", lineHeight: 24 },
    scrollArea: { flex: 1, position: "relative" },
    datesRow: {
      flexDirection: "row",
      paddingHorizontal: 4,
      paddingVertical: 10,
    },
    dateItem: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 2,
      borderRadius: 12,
      minHeight: 53,
    },
    dateItemSelected: {
      backgroundColor: theme.foreground,
    },
    dayText: {
      fontSize: 10,
      color: theme.mutedForeground,
      marginBottom: 4,
    },
    dayTextSelected: {
      color: "rgba(255,255,255,0.7)",
    },
    dateNum: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.foreground,
    },
    dateNumSelected: {
      color: theme.background,
    },
    dotRow: {
      height: 4,
      marginTop: 4,
      alignItems: "center",
      justifyContent: "center",
    },
    todayDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.destructive,
    },
    gameDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.primary,
    },
    sunday: {
      color: theme.destructive,
    },
    saturday: {
      color: theme.info,
    },
  }), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.weekLabelRow}>
        <Text style={styles.weekLabel}>
          {selectedDate.getMonth() + 1}월 {getWeekOfMonth(selectedDate)}주차
        </Text>
        {!isToday(selectedDate) && (
          <Pressable onPress={goToday} hitSlop={8}>
            <Text style={styles.todayLabel}>오늘</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.stripRow}>
        <Pressable onPress={goPrevWeek} style={styles.weekBtn} hitSlop={8}>
          <Text style={styles.weekArrow}>‹</Text>
        </Pressable>

        <View style={styles.scrollArea}>
          <View style={styles.datesRow}>
            {weekDates.map((date) => {
              const sel = isSameDay(date, selectedDate);
              const today = isToday(date);
              const dayIndex = date.getDay();
              const ds = formatDateStr(date);
              const hasGame = hasGameDates.includes(ds);

              return (
                <Pressable
                  key={ds}
                  onPress={() => onDateChange(date)}
                  style={[styles.dateItem, sel && { backgroundColor: teamColor || theme.foreground }]}
                >
                  <Text style={[styles.dayText, sel && styles.dayTextSelected, dayIndex === 0 && !sel && styles.sunday, dayIndex === 6 && !sel && styles.saturday]}>
                    {DAYS[dayIndex]}
                  </Text>
                  <Text style={[styles.dateNum, sel && styles.dateNumSelected]}>
                    {date.getDate()}
                  </Text>
                  <View style={styles.dotRow}>
                    {today && !sel && <View style={styles.todayDot} />}
                    {hasGame && !sel && !today && <View style={styles.gameDot} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable onPress={goNextWeek} style={styles.weekBtn} hitSlop={8}>
          <Text style={styles.weekArrow}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

