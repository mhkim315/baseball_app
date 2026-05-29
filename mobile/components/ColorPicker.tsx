import { View, Text, Pressable } from "react-native";
import { useTheme } from "@/lib/ThemeContext";

interface Props {
  selected: string;
  onSelect: (color: string) => void;
}

const COLORS = [
  "#ff6b6b","#ffa726","#ffd54f","#66bb6a","#26c6da","#42a5f5",
  "#7e57c2","#ec407a","#8d6e63","#78909c","#37474f","#000000",
];

export default function ColorPicker({ selected, onSelect }: Props) {
  const { theme } = useTheme();

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
            borderColor: selected === c ? theme.foreground : (c === "#000000" ? theme.border : "transparent"),
          }}
        />
      ))}
      <Pressable
        onPress={() => onSelect("")}
        style={{
          width: 32, height: 32, borderRadius: 16,
          borderWidth: 2, borderColor: theme.border,
          alignItems: "center", justifyContent: "center",
          backgroundColor: !selected ? theme.muted : "transparent",
        }}
      >
        <Text style={{ fontSize: 12, color: theme.mutedForeground }}>X</Text>
      </Pressable>
    </View>
  );
}
