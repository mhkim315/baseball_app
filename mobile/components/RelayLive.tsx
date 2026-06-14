import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { RelayState } from "@shared/types";
import { useTheme } from "@/lib/ThemeContext";

interface RelayLiveProps {
  relay: RelayState | null | undefined;
  isLive: boolean;
  inline?: boolean;
  hidePlayers?: boolean;
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

function BaseDiamond({ filled }: { filled: boolean }) {
  return (
    <View
      style={{
        width: 8,
        height: 8,
        backgroundColor: filled ? "#ff9800" : "transparent",
        borderWidth: 1.5,
        borderColor: filled ? "#ff9800" : "#999",
        transform: [{ rotate: "45deg" }],
      }}
    />
  );
}

export default function RelayLive({ relay, isLive, inline, hidePlayers }: RelayLiveProps) {
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
    containerInline: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    bsoGroup: {
      flexDirection: "column",
      gap: 1,
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
      width: 18,
      height: 18,
      justifyContent: "center",
      alignItems: "center",
    },
    playerSection: {
      flexShrink: 1,
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
    <View style={inline ? styles.containerInline : styles.container}>
      {/* B-S-O (세로) */}
      <View style={styles.bsoGroup}>
        <View style={styles.bsoCol}>
          <Text style={styles.bsoLabel}>B</Text>
          {[0, 1, 2].map((i) => <Dot key={i} filled={i < b} color="#4caf50" />)}
        </View>
        <View style={styles.bsoCol}>
          <Text style={styles.bsoLabel}>S</Text>
          {[0, 1].map((i) => <Dot key={i} filled={i < s} color="#2196f3" />)}
        </View>
        <View style={styles.bsoCol}>
          <Text style={styles.bsoLabel}>O</Text>
          {[0, 1].map((i) => <Dot key={i} filled={i < o} color="#f44336" />)}
        </View>
      </View>

      {/* Bases — 3 diamonds in triangle formation */}
      <View style={styles.diamondArea}>
        <View style={{ position: "absolute", top: 0, left: 5 }}>
          <BaseDiamond filled={base2} />
        </View>
        <View style={{ position: "absolute", top: 10, left: 10 }}>
          <BaseDiamond filled={base1} />
        </View>
        <View style={{ position: "absolute", top: 10, left: 0 }}>
          <BaseDiamond filled={base3} />
        </View>
      </View>

      {/* Pitcher / Batter */}
      {!hidePlayers && (
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
      )}
    </View>
  );
}
