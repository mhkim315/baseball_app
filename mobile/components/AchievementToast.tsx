import { useEffect, useRef, useState } from "react";
import { Animated, Text, Pressable, StyleSheet } from "react-native";
import { BADGE_DEFINITIONS } from "@/lib/achievements";
import type { Badge } from "@/lib/db";

interface AchievementToastProps {
  badges: Badge[];
  onDismiss: () => void;
  onPress?: () => void;
}

export default function AchievementToast({ badges, onDismiss, onPress }: AchievementToastProps) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (badges.length === 0) return;
    setVisible(true);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(translateY, {
        toValue: -120,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
        onDismiss();
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [badges]);

  if (!visible || badges.length === 0) return null;

  const def = BADGE_DEFINITIONS.find((d) => d.badgeKey === badges[0].badge_key);

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY }] }]}
    >
      <Pressable onPress={onPress ?? onDismiss} style={styles.inner}>
        <Text style={styles.emoji}>{def?.emoji ?? "🏅"}</Text>
        <Text style={styles.title}>{def?.title ?? badges[0].badge_key} 달성!</Text>
        {badges.length > 1 && (
          <Text style={styles.more}>외 {badges.length - 1}개</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1a1a2e",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  emoji: {
    fontSize: 28,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
  },
  more: {
    fontSize: 12,
    color: "#aaa",
  },
});
