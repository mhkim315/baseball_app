import { Pressable, Text, View, StyleSheet } from "react-native";
import { useTheme } from "@/lib/ThemeContext";
import { SHORTCUT_LABELS, type ShortcutType } from "@/lib/shortcutHelper";

interface Props {
  shortcut: ShortcutType | null;
  onPress: () => void;
  color?: string;
}

const SHORTCUT_ICONS: Record<ShortcutType, string> = {
  diary_write: "✏️",
  sticker: "📸",
  diary_stats: "📊",
  expense: "💰",
  "": "⚡",
};

export default function ShortcutButton({ shortcut, onPress, color }: Props) {
  const { theme } = useTheme();

  if (shortcut === "") {
    // Disabled state: completely hidden
    return null;
  }

  if (shortcut === null) {
    // Unset state: show ⚡ + "바로가기 만들기" setup button
    return (
      <Pressable
        onPress={onPress}
        hitSlop={8}
        style={[styles.setupBtn, { borderColor: theme.mutedForeground }]}
      >
        <Text style={styles.setupIcon}>⚡</Text>
        <Text style={[styles.setupLabel, { color: theme.mutedForeground }]}>바로가기 만들기</Text>
      </Pressable>
    );
  }

  // Active state: show icon + label
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={[styles.activeBtn, { backgroundColor: color || theme.mutedForeground }]}
    >
      <Text style={styles.activeIcon}>{SHORTCUT_ICONS[shortcut]}</Text>
      <Text style={styles.activeLabel}>{SHORTCUT_LABELS[shortcut]}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  setupBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 4,
  },
  setupIcon: {
    fontSize: 13,
  },
  setupLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  activeBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  activeIcon: {
    fontSize: 13,
  },
  activeLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
});
