import { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { getBadges, type Badge } from "@/lib/db";
import { BADGE_DEFINITIONS, getVisibleBadgeDefinitions, computeLevel } from "@/lib/achievements";
import { useTheme } from "@/lib/ThemeContext";
import { useTeam } from "@/lib/TeamContext";

interface Props {
  onPress: () => void;
}

export default function AchievementSection({ onPress }: Props) {
  const { theme } = useTheme();
  const { myTeam } = useTeam();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      setBadges(getBadges());
    } catch {} finally { setLoading(false); }
  }, []);

  if (loading) return null;

  const levelInfo = computeLevel(badges);
  const levelEmoji = levelInfo.level >= 7 ? "👑" : levelInfo.level >= 5 ? "🏆" : levelInfo.level >= 3 ? "🥇" : "🥚";
  const visibleDefs = getVisibleBadgeDefinitions(myTeam);
  const unlockedCount = badges.filter((b) => b.unlocked_date).length;
  const unlockedBadges = badges
    .filter((b) => b.unlocked_date)
    .map((b) => BADGE_DEFINITIONS.find((d) => d.badgeKey === b.badge_key))
    .filter(Boolean);

  return (
    <Pressable
      style={{ borderRadius: 16, borderWidth: 1, padding: 16, backgroundColor: theme.card, borderColor: theme.border }}
      onPress={onPress}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 28 }}>{levelEmoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: theme.foreground }}>도전과제</Text>
          <Text style={{ fontSize: 12, color: theme.mutedForeground }}>
            {unlockedCount}/{visibleDefs.length} 획득 · LV.{levelInfo.level}
          </Text>
        </View>
        {unlockedBadges.slice(0, 5).map((def) => (
          <Text key={def!.badgeKey} style={{ fontSize: 20 }}>{def!.emoji}</Text>
        ))}
        <Text style={{ fontSize: 22, color: theme.mutedForeground }}>›</Text>
      </View>
    </Pressable>
  );
}
