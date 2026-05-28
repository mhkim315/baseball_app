import { useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { TeamBadge } from "@/components/TeamBadge";
import { EMOTION_CHARACTER, type CharacterEmotion } from "@/lib/emotions";
import { TEAM_COLORS } from "@shared/teamColors";
import { parseGameTeamIds, getWinBadge } from "@shared/constants";
import { useTheme } from "@/lib/ThemeContext";
import { teamPrimaryColor } from "@shared/teamColors";
import type { JikgwanRecord, Expense } from "@/lib/db";
import { formatAmount, getCategoryIcons, resolveIsWin } from "@/lib/expenseStats";

interface WebzineCardProps {
  record: JikgwanRecord;
  teamId: string | null;
  expenses?: Expense[];
  onPress?: () => void;
  onLongPress?: () => void;
}

function parsePhotos(record: JikgwanRecord): string[] {
  if (record.photos) {
    try {
      const parsed = JSON.parse(record.photos);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  if (record.photo_path) return [record.photo_path];
  return [];
}

export default function WebzineCard({ record, teamId, expenses, onPress, onLongPress }: WebzineCardProps) {
  const { theme, isDark } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const photoW = screenWidth / 3;
  const photos = useMemo(() => parsePhotos(record), [record.photos, record.photo_path]);
  const gt = parseGameTeamIds(record.game_id || "");
  const profileTeamId = record.cheered_team || gt.awayId || gt.homeId || "";
  const liveTeamColor = profileTeamId ? teamPrimaryColor(profileTeamId, isDark) : "#3b82f6";
  const charKey = record.emotion ? (EMOTION_CHARACTER[record.emotion] || "neutral") : "neutral";
  const emChar = charKey as CharacterEmotion;

  const caption = record.memo
    ? record.memo
    : [record.three_line_1, record.three_line_2, record.three_line_3]
        .filter(Boolean)
        .join("\n");

  // Format date
  const dateStr = formatDateKR(record.date);
  const badge = getWinBadge(resolveIsWin(record));

  // Team text
  const teamText = useMemo(() => {
    if (!gt.awayId || !gt.homeId) return "";
    if (record.score_away != null && record.score_home != null) {
      return `${TEAM_COLORS[gt.awayId]?.shortName} ${record.score_away}:${record.score_home} ${TEAM_COLORS[gt.homeId]?.shortName}`;
    }
    return `${TEAM_COLORS[gt.awayId]?.shortName} vs ${TEAM_COLORS[gt.homeId]?.shortName}`;
  }, [gt, record.score_away, record.score_home, profileTeamId]);

  // Expense summary
  const totalExpense = useMemo(() => {
    if (!expenses || expenses.length === 0) return null;
    const sum = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const icons = getCategoryIcons(expenses);
    return { sum, icons: icons.slice(0, 3).map((i) => i.icon) };
  }, [expenses]);

  // Caption preview — one line
  const captionLine = caption.split("\n")[0] || "";

  return (
    <Pressable
      style={[styles.card, { backgroundColor: theme.card, borderBottomColor: theme.border }]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {/* Photo — left 1/3 */}
      <View style={[styles.photoWrap, { width: photoW, height: photoW }]}>
        {photos[0] ? (
          <Image source={{ uri: photos[0] }} style={styles.photo} />
        ) : (
          <View style={[styles.photoPlaceholder, { backgroundColor: theme.muted }]}>
            <Text style={{ fontSize: 24 }}>📸</Text>
          </View>
        )}
        {photos.length > 1 && (
          <View style={styles.photoBadge}>
            <Text style={styles.photoBadgeText}>+{photos.length - 1}</Text>
          </View>
        )}
      </View>

      {/* Info — right 2/3 */}
      <View style={[styles.info, { paddingLeft: 12 }]}>
        {/* Date + venue */}
        <Text style={[styles.dateText, { color: theme.mutedForeground }]} numberOfLines={1}>
          {record.stadium ? `${record.stadium} · ` : ""}{dateStr}
        </Text>

        {/* Team + emotion + result badge */}
        <View style={styles.teamRow}>
          {profileTeamId && <TeamBadge teamId={profileTeamId} size="sm" emotion={emChar} />}
          <View style={styles.teamTextCol}>
            {teamText ? (
              <Text style={[styles.teamText, { color: theme.foreground }]} numberOfLines={1}>{teamText}</Text>
            ) : null}
          </View>
          {badge ? (
            <View style={[styles.resultBadge, { backgroundColor: badge.color }]}>
              <Text style={styles.resultBadgeText}>{badge.label}</Text>
            </View>
          ) : record.is_cancelled ? (
            <View style={[styles.resultBadge, { backgroundColor: isDark ? "#fff" : "#000" }]}>
              <Text style={[styles.resultBadgeText, { color: isDark ? "#000" : "#fff" }]}>취</Text>
            </View>
          ) : null}
          {record.is_live !== null && (
            <View style={[styles.resultBadge, record.is_live === 1
              ? { backgroundColor: liveTeamColor }
              : { backgroundColor: "transparent", borderWidth: 1, borderColor: liveTeamColor }
            ]}>
              <Text style={[styles.resultBadgeText, record.is_live === 1 ? { color: "#fff" } : { color: liveTeamColor }]}>
                {record.is_live === 1 ? "직관" : "집관"}
              </Text>
            </View>
          )}
        </View>

        {/* Seat info */}
        {record.seat ? (
          <Text style={[styles.expenseText, { color: theme.mutedForeground }]} numberOfLines={1}>
            🎫 {record.seat}
          </Text>
        ) : null}

        {/* Expense */}
        {totalExpense && (
          <View style={styles.expenseRow}>
            <Text style={[styles.expenseText, { color: theme.mutedForeground }]} numberOfLines={1}>
              💸 {formatAmount(totalExpense.sum)}
              {totalExpense.icons.length > 0 && ` ${totalExpense.icons.join(" ")}`}
            </Text>
          </View>
        )}

        {/* Caption preview */}
        {captionLine ? (
          <Text style={[styles.captionText, { color: theme.mutedForeground }]} numberOfLines={1}>
            {captionLine}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function formatDateKR(dateStr: string): string {
  const p = dateStr.split(".");
  if (p.length === 3) {
    const d = new Date(+p[0], +p[1] - 1, +p[2]);
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    return `${+p[0]}.${+p[1]}.${+p[2]} (${dayNames[d.getDay()]})`;
  }
  return dateStr;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "stretch",
    borderBottomWidth: 1,
    overflow: "hidden",
  },
  photoWrap: {
    position: "relative",
    overflow: "hidden",
  },
  photo: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  photoBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  photoBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  info: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    paddingRight: 12,
  },
  dateText: {
    fontSize: 11,
    fontWeight: "500",
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  teamTextCol: {
    flex: 1,
  },
  teamText: {
    fontSize: 13,
    fontWeight: "600",
  },
  resultBadge: {
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  resultBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
  },
  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  expenseText: {
    fontSize: 12,
  },
  captionText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
