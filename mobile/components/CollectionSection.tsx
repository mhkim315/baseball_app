import { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { getAllCollections, parseCollectionPhotos, type Collection } from "@/lib/db";
import { useTheme } from "@/lib/ThemeContext";

interface Props {
  onPress: () => void;
}

export default function CollectionSection({ onPress }: Props) {
  const { theme } = useTheme();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllCollections().then(setCollections).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <Pressable
      style={{ borderRadius: 16, borderWidth: 1, padding: 16, backgroundColor: theme.card, borderColor: theme.border, marginTop: 12 }}
      onPress={onPress}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 28 }}>📦</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: theme.foreground }}>컬렉션</Text>
          <Text style={{ fontSize: 12, color: theme.mutedForeground }}>
            {collections.length > 0 ? `${collections.length}개 아이템` : "아직 등록된 아이템이 없어요"}
          </Text>
        </View>
        {collections.slice(0, 3).map((c) => {
          const photos = parseCollectionPhotos(c);
          return photos.length > 0 ? (
            <View key={c.id} style={{ width: 28, height: 28, borderRadius: 6, overflow: "hidden", backgroundColor: theme.muted }}>
              <Text style={{ fontSize: 10, textAlign: "center", lineHeight: 28 }}>📷</Text>
            </View>
          ) : (
            <View key={c.id} style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: theme.muted, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 12, color: theme.mutedForeground }}>+</Text>
            </View>
          );
        })}
        <Text style={{ fontSize: 22, color: theme.mutedForeground }}>›</Text>
      </View>
    </Pressable>
  );
}
