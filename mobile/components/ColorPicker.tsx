import { View, Text, Pressable } from "react-native";
import { useTheme } from "@/lib/ThemeContext";

interface Props {
  selected: string;
  onSelect: (color: string) => void;
  showDefault?: boolean;
  defaultLabel?: string;
  defaultActive?: boolean;
}

const COLORS = [
  "#ff6b6b","#ffa726","#ffd54f","#66bb6a","#26c6da","#42a5f5",
  "#7e57c2","#ec407a","#8d6e63","#78909c","#37474f","#000000","#ffffff",
];

export default function ColorPicker({ selected, onSelect, showDefault, defaultLabel, defaultActive }: Props) {
  const { theme } = useTheme();
  const isDefaultActive = defaultActive !== undefined ? defaultActive : !selected;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
      {COLORS.map((c) => (
        <Pressable
          key={c}
          onPress={() => onSelect(selected === c ? "" : c)}
          style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: c,
            borderWidth: 2.5,
            borderColor: selected === c ? theme.foreground : (c === "#000000" || c === "#ffffff" ? theme.border : "transparent"),
          }}
        />
      ))}
      {showDefault && (
        <Pressable
          onPress={() => onSelect("")}
          style={{
            height: 32, paddingHorizontal: 12, borderRadius: 16,
            borderWidth: 2, borderColor: isDefaultActive ? theme.foreground : theme.border,
            alignItems: "center", justifyContent: "center",
            backgroundColor: isDefaultActive ? theme.muted : "transparent",
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: isDefaultActive ? "700" : "400", color: isDefaultActive ? theme.foreground : theme.mutedForeground }}>{defaultLabel || "기본"}</Text>
        </Pressable>
      )}
    </View>
  );
}
