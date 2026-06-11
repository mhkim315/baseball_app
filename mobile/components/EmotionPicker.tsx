import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Modal } from "react-native";
import { TeamBadge } from "@/components/TeamBadge";
import { useTheme } from "@/lib/ThemeContext";
import { ALL_CHARACTERS, EMOTION_CHARACTER } from "@/lib/emotions";

interface EmotionPickerProps {
  value: string | null;
  onChange: (emotion: string) => void;
  teamId: string;
  unlockedEmotions: string[];
}

export default function EmotionPicker({ value, onChange, teamId, unlockedEmotions }: EmotionPickerProps) {
  const { theme } = useTheme();
  const [lockedAlert, setLockedAlert] = useState(false);
  const unlockedSet = useMemo(() => new Set(unlockedEmotions), [unlockedEmotions]);

  // Sort: basic (always unlocked) → unlocked non-basic → locked
  const sortedCharacters = useMemo(() =>
    [...ALL_CHARACTERS].sort((a, b) => {
      const aGroup = a.basic ? 0 : unlockedSet.has(a.id) ? 1 : 2;
      const bGroup = b.basic ? 0 : unlockedSet.has(b.id) ? 1 : 2;
      return aGroup - bGroup;
    }),
    [unlockedSet],
  );

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
    badgeWrap: {
      position: "relative",
    },
    lockBadge: {
      position: "absolute",
      top: -2,
      right: -2,
      backgroundColor: "rgba(0,0,0,0.6)",
      borderRadius: 8,
      width: 16,
      height: 16,
      justifyContent: "center",
      alignItems: "center",
    },
    lockIcon: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "700",
    },
  }), [theme]);

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
        {sortedCharacters.map((c) => {
          const isUnlocked = unlockedSet.has(c.id);
          const isSelected = value === c.id;
          return (
            <Pressable
              key={c.id}
              style={[
                styles.item,
                isSelected && isUnlocked && { backgroundColor: theme.foreground },
              ]}
              onPress={() => {
                if (isUnlocked) onChange(c.id);
                else setLockedAlert(true);
              }}
            >
              <View style={styles.badgeWrap}>
                <View style={!isUnlocked && { opacity: 0.35 }}>
                  <TeamBadge
                    teamId={teamId}
                    size="sm"
                    emotion={c.id}
                  />
                </View>
                {!isUnlocked && (
                  <View style={styles.lockBadge}>
                    <Text style={styles.lockIcon}>🔒</Text>
                  </View>
                )}
              </View>
              <Text style={[
                styles.label,
                isSelected && isUnlocked && styles.labelSelected,
              ]}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      </ScrollView>
      {lockedAlert && (
        <Modal transparent animationType="fade" onRequestClose={() => setLockedAlert(false)}>
          <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" }} onPress={() => setLockedAlert(false)}>
            <Pressable onPress={() => {}} style={{ borderRadius: 18, overflow: "hidden", padding: 28, minWidth: 280, maxWidth: 320, alignItems: "center", backgroundColor: theme.card }}>
              <Text style={{ fontSize: 17, fontWeight: "700", marginBottom: 8, color: theme.foreground }}>잠금 해제 필요</Text>
              <Text style={{ fontSize: 14, textAlign: "center", marginBottom: 20, lineHeight: 20, color: theme.mutedForeground }}>도전과제 달성 시 랜덤으로 해금됩니다.{'\n'}도전과제를 달성해서 감정표현을 모아보세요!</Text>
              <Pressable style={{ alignSelf: "stretch", paddingVertical: 12, borderRadius: 12, alignItems: "center", backgroundColor: theme.foreground }} onPress={() => setLockedAlert(false)}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: theme.background }}>확인</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}
