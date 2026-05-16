import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { TEAM_COLORS } from "@shared/teamColors";
import { EMOTION_CHARACTER } from "@/components/EmotionPicker";
import { theme } from "@/lib/theme";
import type { JikgwanRecord } from "@/lib/db";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

interface DiaryCalendarProps {
  year: number;
  month: number;
  records: JikgwanRecord[];
  teamId: string | null;
  onSelectDate: (date: Date) => void;
  onMonthChange: (year: number, month: number) => void;
}

function emotionDotColor(char: string): string {
  switch (char) {
    case "joyful": return "#22c55e";
    case "determined": return "#ef4444";
    case "sad": return "#3b82f6";
    default: return "#d4d4d4";
  }
}

export default function DiaryCalendar({
  year,
  month,
  records,
  teamId,
  onSelectDate,
  onMonthChange,
}: DiaryCalendarProps) {
  // Build a map of date string -> records
  const recordMap = new Map<string, JikgwanRecord[]>();
  for (const r of records) {
    const existing = recordMap.get(r.date) ?? [];
    existing.push(r);
    recordMap.set(r.date, existing);
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const cells: { day: number; isToday: boolean }[] = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: 0, isToday: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      isToday: isCurrentMonth && today.getDate() === d,
    });
  }

  const handlePrev = () => {
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    onMonthChange(y, m);
  };

  const handleNext = () => {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    onMonthChange(y, m);
  };

  return (
    <View style={styles.container}>
      {/* Month navigator */}
      <View style={styles.header}>
        <Pressable onPress={handlePrev} hitSlop={8}>
          <Text style={styles.navBtn}>◀</Text>
        </Pressable>
        <Text style={styles.monthTitle}>
          {year}년 {month + 1}월
        </Text>
        <Pressable onPress={handleNext} hitSlop={8}>
          <Text style={styles.navBtn}>▶</Text>
        </Pressable>
      </View>

      {/* Day-of-week headers */}
      <View style={styles.dayRow}>
        {DAYS.map((d, i) => (
          <Text
            key={d}
            style={[
              styles.dayHeader,
              (i === 0 || i === 6) && { color: theme.mutedForeground },
            ]}
          >
            {d}
          </Text>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {cells.map((cell, idx) => {
          if (cell.day === 0) {
            return <View key={`empty-${idx}`} style={styles.cell} />;
          }

          const dateStr = `${year}.${String(month + 1).padStart(2, "0")}.${String(cell.day).padStart(2, "0")}`;
          const dayRecords = recordMap.get(dateStr);

          // Determine cell color
          let cellBg: string | undefined;
          let emotionEmoji: string | undefined;
          if (dayRecords && dayRecords.length > 0) {
            const latest = dayRecords[0];
            if (latest.is_win === 1) cellBg = "#dcfce7";
            else if (latest.is_win === -1) cellBg = "#fee2e2";
            else if (latest.is_win === 0) cellBg = "#fef9c3";
            else cellBg = theme.muted;

            if (latest.emotion) {
              emotionEmoji = EMOTION_CHARACTER[latest.emotion];
            }
          }

          return (
            <Pressable
              key={`day-${cell.day}`}
              style={[
                styles.cell,
                cell.isToday && { borderWidth: 2, borderColor: teamId ? TEAM_COLORS[teamId]?.primary : theme.foreground },
              ]}
              onPress={() => onSelectDate(new Date(year, month, cell.day))}
            >
              <View style={[styles.cellInner, cellBg ? { backgroundColor: cellBg } : undefined]}>
                <Text style={[
                  styles.dayNum,
                  cell.isToday && { fontWeight: "700", color: teamId ? TEAM_COLORS[teamId]?.primary : theme.foreground },
                ]}>
                  {cell.day}
                </Text>
                {emotionEmoji && (
                  <View style={[styles.emotionDot, { backgroundColor: emotionDotColor(emotionEmoji) }]} />
                )}
                {dayRecords && dayRecords.length > 1 && (
                  <Text style={styles.multiDot}>+{dayRecords.length - 1}</Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#dcfce7" }]} />
          <Text style={styles.legendText}>승</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#fee2e2" }]} />
          <Text style={styles.legendText}>패</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#fef9c3" }]} />
          <Text style={styles.legendText}>무</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.muted }]} />
          <Text style={styles.legendText}>기록</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  navBtn: { fontSize: 14, color: theme.foreground, paddingHorizontal: 8 },
  monthTitle: { fontSize: 16, fontWeight: "700", color: theme.foreground },
  dayRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  dayHeader: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    color: theme.mutedForeground,
    fontWeight: "600",
    paddingVertical: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  cellInner: {
    width: "90%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  dayNum: {
    fontSize: 13,
    color: theme.foreground,
    fontWeight: "500",
  },
  emotionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  multiDot: {
    position: "absolute",
    top: 1,
    right: 1,
    fontSize: 8,
    color: theme.mutedForeground,
    fontWeight: "600",
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 10,
    color: theme.mutedForeground,
  },
});
