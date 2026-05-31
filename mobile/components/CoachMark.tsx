import { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, StyleSheet } from "react-native";
import { useTheme } from "@/lib/ThemeContext";

interface Props {
  visible: boolean;
  text: string;
  onDismiss: () => void;
  arrowDirection?: "down" | "up";
  showChevrons?: boolean;
  arrowAlign?: "center" | "right";
}

export default function CoachMark({ visible, text, onDismiss, arrowDirection = "down", showChevrons = true, arrowAlign = "center" }: Props) {
  const { theme } = useTheme();
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [visible, bounceAnim]);

  const leftTranslate = bounceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -14],
  });
  const rightTranslate = bounceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 14],
  });

  if (!visible) return null;

  const isUp = arrowDirection === "up";

  const card = (
    <Pressable onPress={onDismiss} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.swipeRow, !showChevrons && { justifyContent: "center" }]}>
        {showChevrons && <Animated.Text style={[styles.chevron, { transform: [{ translateX: leftTranslate }] }]}>◀</Animated.Text>}
        <Text style={[styles.title, { color: theme.foreground, marginHorizontal: showChevrons ? 8 : 0 }]}>{text}</Text>
        {showChevrons && <Animated.Text style={[styles.chevron, { transform: [{ translateX: rightTranslate }] }]}>▶</Animated.Text>}
      </View>
      <View style={[
        styles.arrow,
        isUp ? { top: -10, bottom: undefined, borderBottomWidth: 12, borderBottomColor: theme.card, borderTopWidth: 0 } : { bottom: -10, top: undefined, borderTopWidth: 12, borderTopColor: theme.card, borderBottomWidth: 0 },
        arrowAlign === "right" && { alignSelf: "flex-end", marginRight: 16 },
      ]} />
    </Pressable>
  );

  return card;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  swipeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chevron: {
    fontSize: 18,
    color: "#888",
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    textAlign: "center",
    marginHorizontal: 8,
  },
  arrow: {
    position: "absolute",
    alignSelf: "center",
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
});
