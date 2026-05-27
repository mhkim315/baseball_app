import { View, Text, Pressable, Animated } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import YearSelector from "@/components/YearSelector";
import { DAYS } from "./useDiaryForm";

export default function DiaryCalendarStep({ calYear, setCalYear, calMonth, calPrev, calNext, calTranslateX, calMonthPanGesture, cells, handleDateSelect, styles }: {
  calYear: number;
  setCalYear: React.Dispatch<React.SetStateAction<number>>;
  calMonth: number;
  calPrev: () => void;
  calNext: () => void;
  calTranslateX: Animated.Value;
  calMonthPanGesture: any;
  cells: { day: number; isToday: boolean }[];
  handleDateSelect: (d: number) => void;
  styles: Record<string, any>;
}) {
  return (
    <GestureDetector gesture={calMonthPanGesture}>
      <Animated.View style={{ transform: [{ translateX: calTranslateX }] }}>
        <View style={styles.calHeader}>
          <Pressable onPress={calPrev} hitSlop={8}>
            <Text style={styles.calNav}>◀</Text>
          </Pressable>
          <YearSelector year={calYear} onYearChange={setCalYear} />
          <Text style={styles.calMonth}>{calMonth + 1}월</Text>
          <Pressable onPress={calNext} hitSlop={8}>
            <Text style={styles.calNav}>▶</Text>
          </Pressable>
        </View>

        <View style={styles.calDayRow}>
          {DAYS.map((d, i) => (
            <Text key={d} style={[styles.calDayHeader, (i === 0 || i === 6) && { color: styles.calDayHeader.color || undefined }]}>{d}</Text>
          ))}
        </View>

        <View style={styles.calGrid}>
          {cells.map((cell, idx) => {
            if (cell.day === 0) return <View key={`e-${idx}`} style={styles.calCell} />;
            return (
              <Pressable
                key={`d-${cell.day}`}
                style={styles.calCell}
                onPress={() => handleDateSelect(cell.day)}
              >
                <View style={[styles.calDayInner, cell.isToday && styles.calDayToday]}>
                  <Text style={styles.calDayNum}>
                    {cell.day}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
