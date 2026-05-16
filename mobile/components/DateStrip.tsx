import { useRef } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { theme } from "@/lib/theme";

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

function formatDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

interface DateStripProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  hasGameDates?: string[];
}

export default function DateStrip({ selectedDate, onDateChange, hasGameDates = [] }: DateStripProps) {
  const scrollRef = useRef<ScrollView>(null);
  const weekDates = getWeekDates(selectedDate);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
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
              style={[styles.dateItem, sel && styles.dateItemSelected]}
            >
              <Text style={[styles.dayText, sel && styles.dayTextSelected, dayIndex === 0 && !sel && styles.sunday, dayIndex === 6 && !sel && styles.saturday]}>
                {DAYS[dayIndex]}
              </Text>
              <Text style={[styles.dateNum, sel && styles.dateNumSelected]}>
                {date.getDate()}
              </Text>
              {today && !sel && <View style={styles.todayDot} />}
              {hasGame && !sel && !today && <View style={styles.gameDot} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.card,
  },
  scrollContent: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 4,
  },
  dateItem: {
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    minWidth: 48,
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
    color: theme.mutedForeground,
  },
  dateNum: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.foreground,
  },
  dateNumSelected: {
    color: theme.background,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.destructive,
    marginTop: 4,
  },
  gameDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.primary,
    marginTop: 4,
  },
  sunday: {
    color: theme.destructive,
  },
  saturday: {
    color: theme.info,
  },
});
