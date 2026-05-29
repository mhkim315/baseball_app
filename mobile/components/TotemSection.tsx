import { View, Text, Pressable } from "react-native";
import type { Totem } from "@/lib/db";
import { useTheme } from "@/lib/ThemeContext";

interface Props {
  onPress: () => void;
  totems: Totem[];
}

export default function TotemSection({ onPress, totems }: Props) {
  const { theme } = useTheme();

  return (
    <Pressable
      style={{ borderRadius: 16, borderWidth: 1, padding: 16, backgroundColor: theme.card, borderColor: theme.border, marginTop: 12 }}
      onPress={onPress}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 28 }}>🍀</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: theme.foreground }}>나의 토템</Text>
          <Text style={{ fontSize: 12, color: theme.mutedForeground }}>
            {totems.length > 0 ? `${totems.length}개` : "아직 등록된 토템이 없어요"}
          </Text>
        </View>
        {totems.slice(0, 5).map((t) => (
          <Text key={t.id} style={{ fontSize: 20 }}>{t.emoji}</Text>
        ))}
        <Text style={{ fontSize: 22, color: theme.mutedForeground }}>›</Text>
      </View>
    </Pressable>
  );
}
