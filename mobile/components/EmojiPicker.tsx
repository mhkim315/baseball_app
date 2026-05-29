import { View, Text, Pressable, TextInput } from "react-native";
import { useTheme } from "@/lib/ThemeContext";

interface Props {
  selected: string;
  onSelect: (emoji: string) => void;
}

const EMOJIS = ["⚾","🏆","🍀","👦","👧","⭐","🧢","🎯","💎","🎉","👕","🪄"];

export default function EmojiPicker({ selected, onSelect }: Props) {
  const { theme } = useTheme();

  return (
    <>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {EMOJIS.map((e) => (
          <Pressable
            key={e}
            onPress={() => onSelect(selected === e ? "" : e)}
            style={{
              width: 36, height: 36, borderRadius: 10,
              alignItems: "center", justifyContent: "center",
              backgroundColor: selected === e ? theme.muted : "transparent",
              borderWidth: 1.5,
              borderColor: selected === e ? theme.foreground : theme.border,
            }}
          >
            <Text style={{ fontSize: 18 }}>{e}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={{
          backgroundColor: theme.muted, borderRadius: 12, padding: 14,
          width: 80, textAlign: "center", fontSize: 24, marginBottom: 8,
          color: theme.foreground,
        }}
        value={selected}
        onChangeText={onSelect}
        placeholder="🍀"
        placeholderTextColor="#666"
        maxLength={4}
      />
    </>
  );
}
