import { useEffect, useRef, useMemo } from "react";
import { View, Animated, StyleSheet, Dimensions } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CONFETTI_COUNT = 20;
const COLORS = ["#e07b3c", "#ff6b6b", "#4ecdc4", "#45b7d1", "#f9ca24", "#a855f7", "#2ecc71"];

interface ConfettiPiece {
  x: number;
  animX: Animated.Value;
  animY: Animated.Value;
  opacity: Animated.Value;
  rotate: Animated.Value;
  color: string;
  size: number;
}

interface ConfettiOverlayProps {
  visible: boolean;
  onFinish?: () => void;
}

export default function ConfettiOverlay({ visible, onFinish }: ConfettiOverlayProps) {
  const pieces = useRef<ConfettiPiece[]>([]).current;

  const anims = useMemo(() => {
    if (!visible) return null;
    const arr: ConfettiPiece[] = [];
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      arr.push({
        x: Math.random() * SCREEN_WIDTH,
        animX: new Animated.Value(0),
        animY: new Animated.Value(0),
        opacity: new Animated.Value(1),
        rotate: new Animated.Value(0),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 8,
      });
    }
    return arr;
  }, [visible]);

  useEffect(() => {
    if (!visible || !anims) return;
    const parallelAnims = anims.map((p) => {
      const tx = (Math.random() - 0.5) * SCREEN_WIDTH * 0.6;
      const ty = SCREEN_HEIGHT * (0.3 + Math.random() * 0.5);
      const duration = 1200 + Math.random() * 800;
      return Animated.parallel([
        Animated.timing(p.animX, { toValue: tx, duration, useNativeDriver: true }),
        Animated.timing(p.animY, { toValue: ty, duration, useNativeDriver: true }),
        Animated.timing(p.opacity, { toValue: 0, duration: duration * 0.7, delay: duration * 0.3, useNativeDriver: true }),
        Animated.timing(p.rotate, { toValue: Math.random() * 6 - 3, duration, useNativeDriver: true }),
      ]);
    });

    Animated.parallel(parallelAnims).start(() => {
      onFinish?.();
    });
  }, [visible, anims, onFinish]);

  if (!visible || !anims) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {anims.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.piece,
            {
              left: p.x - p.size / 2,
              top: SCREEN_HEIGHT * 0.15 + Math.random() * 20,
              width: p.size,
              height: p.size,
              borderRadius: Math.random() > 0.5 ? p.size / 2 : 2,
              backgroundColor: p.color,
              transform: [
                { translateX: p.animX },
                { translateY: p.animY },
                { rotate: p.rotate.interpolate({ inputRange: [-3, 3], outputRange: ["-180deg", "180deg"] }) },
              ],
              opacity: p.opacity,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  piece: {
    position: "absolute",
  },
});
