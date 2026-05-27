import { View, Text, Pressable } from "react-native";
import type { Totem } from "@/lib/db";

export default function DiaryTotemPicker({ allTotems, selectedTotemIds, setSelectedTotemIds, theme }: {
  allTotems: Totem[];
  selectedTotemIds: number[];
  setSelectedTotemIds: React.Dispatch<React.SetStateAction<number[]>>;
  theme: Record<string, any>;
}) {
  return (
    <View>
      <Text style={{ fontSize: 14, fontWeight: "700", color: theme.foreground, marginBottom: 10 }}>나의 토템</Text>
      {allTotems.length === 0 ? (
        <Text style={{ fontSize: 12, color: theme.mutedForeground, lineHeight: 18 }}>
          MY탭에서 토템을 생성하고 선택할 수 있어요
        </Text>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
          {allTotems.map((totem) => {
            const selected = selectedTotemIds.includes(totem.id);
            const borderColor = totem.color || theme.border;
            return (
              <Pressable
                key={totem.id}
                onPress={() => {
                  setSelectedTotemIds((prev) =>
                    prev.includes(totem.id)
                      ? prev.filter((id) => id !== totem.id)
                      : [...prev, totem.id]
                  );
                }}
                style={[
                  {
                    flexDirection: "row", alignItems: "center", gap: 4,
                    paddingHorizontal: 12, paddingVertical: 8,
                    borderRadius: 20, borderWidth: 1.5,
                    borderColor: selected ? borderColor : theme.border,
                    backgroundColor: selected
                      ? (totem.color ? totem.color + "20" : theme.muted)
                      : "transparent",
                  },
                ]}
              >
                <Text style={{ fontSize: 16 }}>{totem.emoji}</Text>
                <Text style={{
                  fontSize: 13, fontWeight: "600",
                  color: selected ? theme.foreground : theme.mutedForeground,
                }}>
                  {totem.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
