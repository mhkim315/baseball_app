import { Pressable, Text, View, StyleSheet } from "react-native";
import BottomSheet from "@/components/BottomSheet";
import { useTheme } from "@/lib/ThemeContext";
import { SHORTCUT_LABELS, type ShortcutType } from "@/lib/shortcutHelper";

interface Props {
  visible: boolean;
  onClose: () => void;
  currentShortcut: ShortcutType | null;
  onSelect: (type: ShortcutType) => void;
}

const OPTIONS: ShortcutType[] = ["diary_write", "sticker", "diary_stats", "expense"];

const OPTION_ICONS: Record<string, string> = {
  diary_write: "✏️",
  sticker: "📸",
  diary_stats: "📊",
  expense: "💰",
};

export default function ShortcutPickerModal({ visible, onClose, currentShortcut, onSelect }: Props) {
  const { theme } = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.foreground }]}>바로가기 선택</Text>
        <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
          홈 화면에 표시할 바로가기를 선택해주세요
        </Text>

        {OPTIONS.map((type) => {
          const isSelected = currentShortcut === type;
          return (
            <Pressable
              key={type}
              style={[styles.option, { backgroundColor: theme.card, borderColor: isSelected ? theme.foreground : theme.border }]}
              onPress={() => onSelect(type)}
            >
              <Text style={styles.optionIcon}>{OPTION_ICONS[type]}</Text>
              <Text style={[styles.optionLabel, { color: theme.foreground }]}>{SHORTCUT_LABELS[type]}</Text>
              {isSelected && <Text style={[styles.checkmark, { color: theme.foreground }]}>✓</Text>}
            </Pressable>
          );
        })}

        {currentShortcut !== "" && currentShortcut !== null && (
          <Pressable
            style={[styles.disableBtn, { borderColor: theme.border }]}
            onPress={() => onSelect("")}
          >
            <Text style={[styles.disableText, { color: theme.mutedForeground }]}>사용 안 함</Text>
          </Pressable>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 20,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  optionIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  checkmark: {
    fontSize: 18,
    fontWeight: "bold",
  },
  disableBtn: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  disableText: {
    fontSize: 14,
  },
});
