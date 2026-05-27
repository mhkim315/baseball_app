import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Animated, Text, Pressable, StyleSheet, View, LayoutAnimation, Easing } from "react-native";
import { useTheme } from "@/lib/ThemeContext";
import { BADGE_DEFINITIONS } from "@/lib/achievements";
import { TeamBadge } from "@/components/TeamBadge";
import type { Badge } from "@/lib/db";

interface AchievementToastProps {
  badges: Badge[];
  rewards?: { emotion: string; label: string }[];
  teamId?: string;
  onDismiss: () => void;
  onPress?: () => void;
}

interface ToastItemData {
  id: string;
  type: "badge" | "character";
  badgeKey?: string;
  emotion?: string;
  label?: string;
}

interface ItemAnimations {
  translateY: Animated.Value;
  opacity: Animated.Value;
}

const STAGGER_DELAY = 400;
const ENTER_DURATION = 400;
const EXIT_DURATION = 250;
const SHOW_DURATION = 4000;

export default function AchievementToast({ badges, rewards, teamId, onDismiss, onPress }: AchievementToastProps) {
  const { theme } = useTheme();
  const [items, setItems] = useState<ToastItemData[]>([]);
  const anims = useRef<Record<string, ItemAnimations>>({});
  const dismissed = useRef<Set<string>>(new Set());
  const prevLen = useRef(0);

  const dynamicStyles = useMemo(() => ({
    inner: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    title: { color: theme.foreground },
    muted: { color: theme.mutedForeground },
  }), [theme]);

  // Call onDismiss only when items goes from >0 to 0
  useEffect(() => {
    if (prevLen.current > 0 && items.length === 0) {
      onDismiss();
    }
    prevLen.current = items.length;
  }, [items.length, onDismiss]);

  const dismissItem = useCallback((id: string) => {
    if (dismissed.current.has(id)) return;
    dismissed.current.add(id);

    const a = anims.current[id];
    if (!a) return;

    // Fade out
    Animated.timing(a.opacity, {
      toValue: 0,
      duration: EXIT_DURATION,
      useNativeDriver: true,
    }).start();

    // Collapse gap simultaneously (LayoutAnimation captures before/after)
    LayoutAnimation.configureNext({
      duration: EXIT_DURATION,
      update: { type: "easeInEaseOut" },
    });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  useEffect(() => {
    if (badges.length === 0 && !rewards?.length) return;

    dismissed.current.clear();

    const newItems: ToastItemData[] = [
      ...badges.map((b) => ({ id: `b-${b.badge_key}`, type: "badge" as const, badgeKey: b.badge_key })),
      ...(rewards ?? []).map((r) => ({ id: `c-${r.emotion}`, type: "character" as const, emotion: r.emotion, label: r.label })),
    ];

    for (const item of newItems) {
      const existing = anims.current[item.id];
      if (existing) {
        existing.translateY.setValue(-100);
        existing.opacity.setValue(0);
      } else {
        anims.current[item.id] = {
          translateY: new Animated.Value(-100),
          opacity: new Animated.Value(0),
        };
      }
    }

    setItems(newItems);

    // Staggered entry: slide in + fade in
    newItems.forEach((item, i) => {
      const a = anims.current[item.id];
      if (!a) return;
      Animated.parallel([
        Animated.spring(a.translateY, {
          toValue: 0,
          friction: 9,
          tension: 65,
          useNativeDriver: true,
          delay: i * STAGGER_DELAY,
        }),
        Animated.timing(a.opacity, {
          toValue: 1,
          duration: ENTER_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
          delay: i * STAGGER_DELAY,
        }),
      ]).start();
    });

    // All dismiss at the same time after show duration
    const allEnteredDelay = newItems.length * STAGGER_DELAY + 200;
    const dismissTimer = setTimeout(() => {
      newItems.forEach((item) => dismissItem(item.id));
    }, allEnteredDelay + SHOW_DURATION);
  }, [badges, rewards]);

  if (items.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {items.map((item) => {
        const a = anims.current[item.id];
        if (!a) return null;

        const def = item.type === "badge" && item.badgeKey
          ? BADGE_DEFINITIONS.find((d) => d.badgeKey === item.badgeKey)
          : null;

        return (
          <Animated.View
            key={item.id}
            style={[
              styles.item,
              {
                transform: [{ translateY: a.translateY }],
                opacity: a.opacity,
              },
            ]}
          >
            <Pressable
              onPress={onPress ?? onDismiss}
              style={[styles.inner, dynamicStyles.inner]}
            >
              {item.type === "badge" ? (
                <>
                  <Text style={styles.emoji}>{def?.emoji ?? "🏅"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, dynamicStyles.title]} numberOfLines={1}>
                      {def?.title ?? item.badgeKey} 달성!
                    </Text>
                    {def?.xp ? <Text style={[styles.xp, dynamicStyles.muted]}>+{def.xp} XP</Text> : null}
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.charBox}>
                    {teamId ? (
                      <TeamBadge teamId={teamId} size="sm" emotion={item.emotion as any} />
                    ) : (
                      <Text style={{ fontSize: 24 }}>🎭</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, dynamicStyles.title]}>새 캐릭터</Text>
                    <Text style={[styles.charLabel, dynamicStyles.muted]}>{item.label}</Text>
                  </View>
                </>
              )}
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
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
  item: {
    marginBottom: 8,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  emoji: {
    fontSize: 24,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  xp: {
    fontSize: 11,
    marginTop: 1,
  },
  charBox: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  charLabel: {
    fontSize: 11,
    marginTop: 1,
  },
});
