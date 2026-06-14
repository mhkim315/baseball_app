import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { TEAM_COLORS } from "@shared/teamColors";
import { TeamBadge } from "@/components/TeamBadge";
import { useTheme } from "@/lib/ThemeContext";
import { teamPrimaryColor } from "@shared/teamColors";
import type { RelayState } from "@shared/types";

interface GameCardProps {
  homeTeam: string;
  awayTeam: string;
  time: string;
  stadium: string;
  homePitcher?: string;
  awayPitcher?: string;
  status?: "scheduled" | "live" | "finished";
  homeScore?: number;
  awayScore?: number;
  winPitcher?: string | null;
  losePitcher?: string | null;
  cancelled?: boolean;
  compact?: boolean;
  highlighted?: string;
  dense?: boolean;
  onClick?: () => void;
  liveInning?: number;
  isTop?: boolean;
  relay?: RelayState | null;
}

export default function GameCard({
  homeTeam,
  awayTeam,
  time,
  stadium,
  homePitcher,
  awayPitcher,
  status = "scheduled",
  homeScore,
  awayScore,
  winPitcher,
  losePitcher,
  cancelled,
  liveInning,
  isTop,
  compact = false,
  highlighted,
  dense,
  relay,
  onClick,
}: GameCardProps) {
  const { theme, isDark } = useTheme();
  const home = TEAM_COLORS[homeTeam];
  const away = TEAM_COLORS[awayTeam];
  if (!home || !away) return null;

  const hasResult = status === "finished" && homeScore !== undefined && awayScore !== undefined && !cancelled;
  const homeWon = hasResult ? homeScore! > awayScore! : null;
  const awayWon = hasResult ? awayScore! > homeScore! : null;
  const isDraw = hasResult ? homeScore === awayScore : null;
  const showScore = homeScore !== undefined && awayScore !== undefined;

  const statusLabel = cancelled
    ? "취소"
    : status === "finished"
      ? "경기 종료"
      : status === "live"
        ? (liveInning != null ? `${liveInning}회${isTop ? "초" : "말"}` : "경기 중")
        : "경기 전";
  const statusColor = cancelled ? "#888" : status === "live" ? "#ef4444" : "#888";

  const awayEmotion = status === "scheduled" ? "determined" : awayWon === true ? "joyful" : isDraw || cancelled ? "neutral" : awayWon === false ? "sad" : "default" as const;
  const homeEmotion = status === "scheduled" ? "determined" : homeWon === true ? "joyful" : isDraw || cancelled ? "neutral" : homeWon === false ? "sad" : "default" as const;

  const styles = useMemo(() => StyleSheet.create({
    // Main card
    card: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      borderLeftWidth: 3,
      padding: 20,
    },
    cardDense: {
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    cardHeaderDense: {
      marginBottom: 8,
    },
    headerText: {
      fontSize: 12,
      color: theme.mutedForeground,
    },
    matchup: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    matchupDense: {
      alignItems: "center",
    },
    teamColumn: {
      flex: 1,
      alignItems: "center",
      gap: 8,
    },
    teamColumnDense: {
      gap: 4,
    },
    teamName: {
      fontSize: 12,
      fontWeight: "600",
    },
    pitcherText: {
      fontSize: 11,
      color: theme.mutedForeground,
    },
    scoreColumn: {
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 16,
    },
    statusBadge: {
      fontSize: 10,
      fontWeight: "600",
    },
    scoreRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    scoreNum: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.foreground,
    },
    scoreDim: {
      color: theme.mutedForeground,
    },
    scoreColon: {
      fontSize: 14,
      color: theme.mutedForeground,
    },
    vsText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.mutedForeground,
    },
    vsCancelled: {
      textDecorationLine: "line-through",
    },

    // Compact card
    compactCard: {
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      borderLeftWidth: 3,
      paddingVertical: 10,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    compactLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flex: 1,
    },
    compactTeam: {
      fontSize: 11,
      fontWeight: "600",
    },
    compactScore: {
      fontSize: 13,
      fontWeight: "bold",
      color: theme.foreground,
    },
    compactTime: {
      fontSize: 11,
      color: theme.mutedForeground,
    },
  }), [theme]);

  if (compact) {
    return (
      <Pressable onPress={onClick} style={[styles.compactCard, { borderLeftColor: teamPrimaryColor(home.id, isDark) }]}>
        <View style={styles.compactLeft}>
          <TeamBadge teamId={awayTeam} size="sm" variant="ball" />
          <Text style={[styles.compactTeam, { color: teamPrimaryColor(away.id, isDark) }]}>{away.shortName}</Text>
          {showScore ? (
            <Text style={styles.compactScore}>
              {awayScore}:{homeScore}
            </Text>
          ) : (
            <Text style={styles.compactTime}>{time}</Text>
          )}
          <TeamBadge teamId={homeTeam} size="sm" variant="ball" />
          <Text style={[styles.compactTeam, { color: teamPrimaryColor(home.id, isDark) }]}>{home.shortName}</Text>
        </View>
        <Text style={[styles.statusBadge, { color: statusColor }]}>{statusLabel}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onClick} style={[styles.card, { borderLeftColor: teamPrimaryColor(home.id, isDark) }, highlighted && { backgroundColor: highlighted + "12", borderColor: highlighted + "30" }, dense && styles.cardDense]}>
                  {/* Top: time / BSO+주루 / venue */}
      <View style={[styles.cardHeader, { alignItems: "center" }, dense && styles.cardHeaderDense]}>
        <Text style={[styles.headerText, { width: 60 }]}>{time}</Text>
        {status === "live" && relay && (
          <View style={{ flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Text style={{ fontSize: 9, fontWeight: "700", color: "#999", marginRight: 2 }}>B</Text>
              {[0, 1, 2].map(i => (
                <View key={i} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: i < parseInt(relay.ball) ? "#4caf50" : "transparent", borderWidth: 1, borderColor: i < parseInt(relay.ball) ? "#4caf50" : "#ccc" }} />
              ))}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Text style={{ fontSize: 9, fontWeight: "700", color: "#999", marginRight: 2 }}>S</Text>
              {[0, 1].map(i => (
                <View key={i} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: i < parseInt(relay.strike) ? "#f7d44a" : "transparent", borderWidth: 1, borderColor: i < parseInt(relay.strike) ? "#f7d44a" : "#ccc" }} />
              ))}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Text style={{ fontSize: 9, fontWeight: "700", color: "#999", marginRight: 2 }}>O</Text>
              {[0, 1].map(i => (
                <View key={i} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: i < parseInt(relay.out) ? "#f44336" : "transparent", borderWidth: 1, borderColor: i < parseInt(relay.out) ? "#f44336" : "#ccc" }} />
              ))}
            </View>
            <View style={{ width: 22, height: 18, justifyContent: "center", alignItems: "center" }}>
              <View style={{ position: "absolute", top: 0, left: 7 }}>
                <View style={{ width: 7, height: 7, backgroundColor: relay.base2 === "1" ? "#ff9800" : "transparent", borderWidth: 1, borderColor: relay.base2 === "1" ? "#ff9800" : "#ccc", transform: [{ rotate: "45deg" }] }} />
              </View>
              <View style={{ position: "absolute", top: 10, left: 14 }}>
                <View style={{ width: 7, height: 7, backgroundColor: relay.base1 === "1" ? "#ff9800" : "transparent", borderWidth: 1, borderColor: relay.base1 === "1" ? "#ff9800" : "#ccc", transform: [{ rotate: "45deg" }] }} />
              </View>
              <View style={{ position: "absolute", top: 10, left: 0 }}>
                <View style={{ width: 7, height: 7, backgroundColor: relay.base3 === "1" ? "#ff9800" : "transparent", borderWidth: 1, borderColor: relay.base3 === "1" ? "#ff9800" : "#ccc", transform: [{ rotate: "45deg" }] }} />
              </View>
            </View>
          </View>
        )}
        <Text style={[styles.headerText, { width: 60, textAlign: "right" }]}>{stadium}</Text>
      </View>
      {/* Matchup */}
      <View style={[styles.matchup, dense && styles.matchupDense]}>
        {/* Away */}
        <View style={[styles.teamColumn, dense && styles.teamColumnDense]}>
          <TeamBadge teamId={awayTeam} size="md" emotion={awayEmotion} />
          <Text style={[styles.teamName, { color: teamPrimaryColor(away.id, isDark) }]}>{away.shortName}</Text>
          {hasResult && winPitcher ? (
            <Text style={styles.pitcherText}>
              {isDraw ? `무: ${winPitcher}` : awayWon ? `승: ${winPitcher}` : `패: ${losePitcher ?? ""}`}
            </Text>
          ) : status === "live" && relay ? (
            <Text style={styles.pitcherText}>
              {isTop ? `B: ${relay.batter?.name ?? "-"}` : `P: ${relay.pitcher?.name ?? "-"}`}
            </Text>
          ) : awayPitcher ? (
            <Text style={styles.pitcherText}>{awayPitcher}</Text>
          ) : null}
        </View>

        {/* Score */}
        <View style={styles.scoreColumn}>
          <Text style={[styles.statusBadge, { color: statusColor }]}>{statusLabel}</Text>
          {showScore ? (
            <View style={styles.scoreRow}>
              <Text style={[styles.scoreNum, hasResult && !awayWon && !isDraw && styles.scoreDim]}>{awayScore}</Text>
              <Text style={styles.scoreColon}>:</Text>
              <Text style={[styles.scoreNum, hasResult && !homeWon && !isDraw && styles.scoreDim]}>{homeScore}</Text>
            </View>
          ) : (
            <Text style={[styles.vsText, cancelled && styles.vsCancelled]}>VS</Text>
          )}
        </View>

        {/* Home */}
        <View style={[styles.teamColumn, dense && styles.teamColumnDense]}>
          <TeamBadge teamId={homeTeam} size="md" emotion={homeEmotion} />
          <Text style={[styles.teamName, { color: teamPrimaryColor(home.id, isDark) }]}>{home.shortName}</Text>
          {hasResult && winPitcher ? (
            <Text style={styles.pitcherText}>
              {isDraw ? `무: ${winPitcher}` : homeWon ? `승: ${winPitcher}` : `패: ${losePitcher ?? ""}`}
            </Text>
          ) : status === "live" && relay ? (
            <Text style={styles.pitcherText}>
              {isTop ? `P: ${relay.pitcher?.name ?? "-"}` : `B: ${relay.batter?.name ?? "-"}`}
            </Text>
          ) : homePitcher ? (
            <Text style={styles.pitcherText}>{homePitcher}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}


