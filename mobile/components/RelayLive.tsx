import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { RelayState } from "@shared/types";
import { useTheme } from "@/lib/ThemeContext";

interface RelayLiveProps {
  relay: RelayState | null | undefined;
  isLive: boolean;
}

function Dot({ filled, color }: { filled: boolean; color: string }) {
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: filled ? color : "transparent",
        borderWidth: 1.5,
        borderColor: filled ? color : "#999",
      }}
    />
  );
}

export default function RelayLive({ relay, isLive }: RelayLiveProps) {
  const { theme } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginTop: 12,
      gap: 14,
    },
    bsoGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    bsoCol: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    bsoLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.mutedForeground,
      marginRight: 1,
    },
    diamondArea: {
      width: 32,
      height: 32,
      justifyContent: "center",
      alignItems: "center",
    },
    diamondRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
    },
    baseLabel: {
      fontSize: 8,
      fontWeight: "600",
      color: theme.mutedForeground,
    },
    playerSection: {
      flex: 1,
      gap: 3,
    },
    playerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    playerRole: {
      fontSize: 10,
      fontWeight: "600",
      color: theme.mutedForeground,
      width: 14,
    },
    playerName: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.foreground,
    },
  }), [theme]);

  if (!relay || !isLive) return null;

  const s = parseInt(relay.strike, 10) || 0;
  const b = parseInt(relay.ball, 10) || 0;
  const o = parseInt(relay.out, 10) || 0;
  const base1 = relay.base1 !== "0";
  const base2 = relay.base2 !== "0";
  const base3 = relay.base3 !== "0";

  return (
    <View style={styles.container}>
      {/* B-S-O */}
      <View style={styles.bsoGroup}>
        <View style={styles.bsoCol}>
          <Text style={styles.bsoLabel}>S</Text>
          {[0, 1].map((i) => <Dot key={i} filled={i < s} color="#2196f3" />)}
        </View>
        <View style={styles.bsoCol}>
          <Text style={styles.bsoLabel}>B</Text>
          {[0, 1, 2].map((i) => <Dot key={i} filled={i < b} color="#4caf50" />)}
        </View>
        <View style={styles.bsoCol}>
          <Text style={styles.bsoLabel}>O</Text>
          {[0, 1, 2].map((i) => <Dot key={i} filled={i < o} color="#f44336" />)}
        </View>
      </View>

      {/* Base diamond — 3 dots in triangle: 2B top, 1B/3B bottom */}
      <View style={styles.diamondArea}>
        {/* 2B */}
        <View style={{ marginBottom: 2 }}>
          <Dot filled={base2} color="#ff9800" />
        </View>
        {/* 1B + 3B */}
        <View style={styles.diamondRow}>
          <View style={{ alignItems: "center" }}>
            <Dot filled={base3} color="#ff9800" />
            <Text style={styles.baseLabel}>3</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Dot filled={base1} color="#ff9800" />
            <Text style={styles.baseLabel}>1</Text>
          </View>
        </View>
      </View>

      {/* Pitcher / Batter */}
      <View style={styles.playerSection}>
        <View style={styles.playerRow}>
          <Text style={styles.playerRole}>P</Text>
          <Text style={styles.playerName} numberOfLines={1}>
            {relay.pitcher?.name || "-"}
          </Text>
        </View>
        <View style={styles.playerRow}>
          <Text style={styles.playerRole}>B</Text>
          <Text style={styles.playerName} numberOfLines={1}>
            {relay.batter?.name || "-"}
          </Text>
        </View>
      </View>
    </View>
  );
}
