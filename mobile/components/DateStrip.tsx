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

function resultColor(isWin: number): string {
  if (isWin === 1) return "rgba(59, 130, 246, 0.35)";
  if (isWin === -1) return "rgba(239, 68, 68, 0.35)";
  return "rgba(234, 179, 8, 0.35)";
}

interface DateStripProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  teamColor?: string;
  /** Date string (YYYY-MM-DD) → is_win (1=win, -1=loss, 0=draw) */
  resultByDate?: Record<string, number>;
}

export default function DateStrip({ selectedDate, onDateChange, teamColor, resultByDate }: DateStripProps) {
  const { theme } = useTheme();
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

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
    datesRow: {
      flex: 1,
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

        <View style={styles.datesRow}>
          {weekDates.map((date) => {
            const sel = isSameDay(date, selectedDate);
            const today = isToday(date);
            const dayIndex = date.getDay();

            return (
              <Pressable
                key={formatDateStr(date)}
                onPress={() => onDateChange(date)}
                style={[styles.dateItem, sel && { backgroundColor: teamColor || theme.foreground }]}
              >
                <Text style={[styles.dayText, sel && styles.dayTextSelected, dayIndex === 0 && !sel && styles.sunday, dayIndex === 6 && !sel && styles.saturday]}>
                  {DAYS[dayIndex]}
                </Text>
                <View style={{ position: "relative", alignItems: "center", justifyContent: "center" }}>
                  {!sel && resultByDate?.[formatDateStr(date)] !== undefined && (
                    <View style={{
                      position: "absolute",
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      backgroundColor: resultColor(resultByDate[formatDateStr(date)]),
                    }} />
                  )}
                  <Text style={[styles.dateNum, sel && styles.dateNumSelected]}>
                    {date.getDate()}
                  </Text>
                </View>
                <View style={styles.dotRow}>
                  {today && !sel && <View style={styles.todayDot} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={goNextWeek} style={styles.weekBtn} hitSlop={8}>
          <Text style={styles.weekArrow}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}
