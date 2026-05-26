import { useMemo } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { TeamBadge } from "@/components/TeamBadge";
import { useTheme } from "@/lib/ThemeContext";
import { EMOTIONS, EMOTION_CHARACTER } from "@/lib/emotions";
export type { EmotionId } from "@/lib/emotions";
export { EMOTION_CHARACTER };

interface EmotionPickerProps {
  value: string | null;
  onChange: (emotion: string) => void;
  teamId: string;
}

export default function EmotionPicker({ value, onChange, teamId }: EmotionPickerProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    container: {
      alignItems: "center",
    },
    row: {
      flexDirection: "row",
      gap: 8,
    },
    item: {
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 14,
      backgroundColor: theme.muted,
      minWidth: 56,
      gap: 4,
    },
    label: {
      fontSize: 10,
      color: theme.mutedForeground,
      fontWeight: "500",
    },
    labelSelected: {
      color: theme.background,
    },
  }), [theme]);

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
        {EMOTIONS.map((e) => (
          <Pressable
            key={e.id}
            style={[
              styles.item,
              value === e.id && { backgroundColor: theme.foreground },
            ]}
            onPress={() => onChange(e.id)}
          >
            <TeamBadge
              teamId={teamId}
              size="sm"
              emotion={e.character}
            />
            <Text style={[styles.label, value === e.id && styles.labelSelected]}>
              {e.label}
            </Text>
          </Pressable>
        ))}
      </View>
      </ScrollView>
    </View>
  );
}
