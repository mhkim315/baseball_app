import { useState, useCallback, useMemo } from "react";
import { View, Text, Image, Pressable, ScrollView, StyleSheet, NativeSyntheticEvent, NativeScrollEvent, useWindowDimensions } from "react-native";
import SimpleAlert from "@/components/SimpleAlert";
import { TeamBadge } from "@/components/TeamBadge";
import { EMOTION_CHARACTER, type CharacterEmotion } from "@/lib/emotions";
import { TEAM_COLORS } from "@shared/teamColors";
import { parseGameTeamIds, getWinBadge } from "@shared/constants";
import { parseDotDate } from "@/lib/dateUtils";
import { useTheme } from "@/lib/ThemeContext";
import { teamPrimaryColor } from "@shared/teamColors";
import type { JikgwanRecord, Expense } from "@/lib/db";
import { getCategoryIcons, formatAmount, resolveIsWin } from "@/lib/expenseStats";

interface DiaryCardProps {
  record: JikgwanRecord;
  teamId: string | null;
  onShare?: (uri: string) => void;
  onDelete?: (record: JikgwanRecord) => void;
  onEdit?: (record: JikgwanRecord) => void;
  expenses?: Expense[];
}

function formatDisplayDate(dateStr: string): string {
  const p = parseDotDate(dateStr);
  if (p) return `${p[0]}.${p[1]}.${p[2]}`;
  return dateStr;
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

function isUpcoming(dateStr: string, scoreAway: number | null, scoreHome: number | null): boolean {
  const p = parseDotDate(dateStr);
  if (!p) return false;
  const d = new Date(p[0], p[1] - 1, p[2]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d > today) return true;
  // Today but game hasn't ended yet (no scores / both zero)
  if (d.getTime() === today.getTime()) {
    return scoreAway == null || scoreHome == null || (scoreAway === 0 && scoreHome === 0);
  }
  return false;
}

export default function DiaryCard({ record, teamId, onShare, onDelete, onEdit, expenses }: DiaryCardProps) {
  const { theme, isDark } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const photoWidth = screenWidth;
  const photos = useMemo(() => parsePhotos(record), [record.photos, record.photo_path]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
    setPhotoIndex(idx);
  }, []);

  // Parse teams from game_id
  const gt = parseGameTeamIds(record.game_id || "");
  const profileTeamId = record.cheered_team || teamId || gt.awayId || gt.homeId || "";
  const liveTeamColor = profileTeamId ? teamPrimaryColor(profileTeamId, isDark) : "#3b82f6";
  const charKey = record.emotion ? (EMOTION_CHARACTER[record.emotion] || "neutral") : "neutral";
  const emChar = charKey as CharacterEmotion;

  // Caption text: memo first, fallback to three_line
  const caption = record.memo
    ? record.memo
    : [record.three_line_1, record.three_line_2, record.three_line_3]
        .filter(Boolean)
        .join("\n");

  const upcoming = isUpcoming(record.date, record.score_away, record.score_home);

  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: 0,
      overflow: "hidden",
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    // Instagram-style header
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
    },
    profileCol: {
      alignItems: "center",
      justifyContent: "center",
    },
    profileFallback: {
      fontSize: 28,
    },
    idCol: {
      flex: 1,
      gap: 3,
    },
    idRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    idDate: {
      fontSize: 12,
      color: theme.mutedForeground,
      fontWeight: "500",
    },
    idTeams: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.foreground,
    },
    winBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4,
    },
    winBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      color: "#fff",
    },
    // Photos
    photoContainer: {
      position: "relative",
    },
    photo: {
      height: 360,
      resizeMode: "cover",
    },
    dots: {
      position: "absolute",
      bottom: 10,
      left: 0,
      right: 0,
      flexDirection: "row",
      justifyContent: "center",
      gap: 6,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "rgba(255,255,255,0.5)",
    },
    dotActive: {
      backgroundColor: "#fff",
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    // Caption
    caption: {
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 4,
    },
    captionText: {
      fontSize: 14,
      color: theme.foreground,
      lineHeight: 20,
    },
    seatRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingTop: 6,
      gap: 4,
    },
    seatText: {
      fontSize: 13,
      color: theme.mutedForeground,
    },
    // Actions
    actions: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingBottom: 10,
      paddingTop: 6,
    },
    actionBtn: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 8,
    },
    actionText: {
      fontSize: 13,
      color: theme.mutedForeground,
      fontWeight: "500",
    },
  }), [theme]);

  return (
    <View style={styles.card}>
      {/* Header — Instagram style */}
      <View style={styles.header}>
        <View style={styles.profileCol}>
          {profileTeamId ? (
            <TeamBadge teamId={profileTeamId} size="md" emotion={emChar} />
          ) : (
            <Text style={styles.profileFallback}>⚾</Text>
          )}
        </View>

        <View style={styles.idCol}>
          {/* Row 1: date + stadium */}
          <View style={styles.idRow}>
            <Text style={styles.idDate} numberOfLines={1}>
              {formatDisplayDate(record.date)}
              {record.stadium ? ` · ${record.stadium}` : ""}
            </Text>
          </View>

          {/* Row 2: teams + score + badge */}
          <View style={styles.idRow}>
            {(gt.awayId || gt.homeId) && (
              <Text style={styles.idTeams} numberOfLines={1}>
                {gt.awayId && gt.homeId
                  ? upcoming
                    ? `${TEAM_COLORS[gt.awayId]?.shortName || "?"} vs ${TEAM_COLORS[gt.homeId]?.shortName || "?"} (예정)`
                    : record.score_away != null && record.score_home != null
                      ? `${TEAM_COLORS[gt.awayId]?.shortName || "?"} ${record.score_away} : ${record.score_home} ${TEAM_COLORS[gt.homeId]?.shortName || "?"}`
                      : `${TEAM_COLORS[gt.awayId]?.shortName || "?"} vs ${TEAM_COLORS[gt.homeId]?.shortName || "?"}`
                  : TEAM_COLORS[gt.awayId || gt.homeId]?.shortName}
              </Text>
            )}
            {(() => {
              const badge = getWinBadge(resolveIsWin(record));
              if (!badge || upcoming) {
                if (record.is_cancelled) return (
                  <View style={[styles.winBadge, { backgroundColor: isDark ? "#fff" : "#000" }]}>
                    <Text style={[styles.winBadgeText, { color: isDark ? "#000" : "#fff" }]}>취</Text>
                  </View>
                );
                return null;
              }
              return (
                <View style={[styles.winBadge, { backgroundColor: badge.color }]}>
                  <Text style={styles.winBadgeText}>{badge.label}</Text>
                </View>
              );
            })()}
            {record.is_live !== null && (
              <View style={[styles.winBadge, record.is_live === 1
                ? { backgroundColor: liveTeamColor }
                : { backgroundColor: "transparent", borderWidth: 1, borderColor: liveTeamColor }
              ]}>
                <Text style={[styles.winBadgeText, record.is_live === 1 ? { color: "#fff" } : { color: liveTeamColor }]}>
                  {record.is_live === 1 ? "직관" : "집관"}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Photos — swipeable */}
      {photos.length > 0 ? (
        <View style={styles.photoContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            nestedScrollEnabled
          >
            {photos.map((uri, i) => (
              <View key={i} style={{ position: "relative" }}>
                <Image source={{ uri }} style={[styles.photo, { width: photoWidth }]} />
                {(gt.awayId || gt.homeId) && !isUpcoming(record.date, record.score_away, record.score_home) && (
                  <View style={stampOverlay.container}>
                    <Text style={stampOverlay.text}>
                      {formatDisplayDate(record.date)}
                      {record.stadium ? ` · ${record.stadium}` : ""}
                    </Text>
                    {gt.awayId && gt.homeId && record.score_away != null && (
                      <Text style={[stampOverlay.text, stampOverlay.score]}>
                        {TEAM_COLORS[gt.awayId]?.shortName} {record.score_away} : {record.score_home} {TEAM_COLORS[gt.homeId]?.shortName}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
          {photos.length > 1 && (
            <View style={styles.dots}>
              {photos.map((_, i) => (
                <View key={i} style={[styles.dot, i === photoIndex && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>
      ) : null}

      {/* Caption — diary text */}
      {caption ? (
        <View style={styles.caption}>
          <Text style={styles.captionText}>{caption}</Text>
        </View>
      ) : null}

      {/* Seat info */}
      {record.seat ? (
        <View style={styles.seatRow}>
          <Text style={styles.seatText}>🎫 {record.seat}</Text>
        </View>
      ) : null}

      {/* Expense summary */}
      {expenses && expenses.length > 0 ? (
        <View style={styles.seatRow}>
          <Text style={styles.seatText}>
            💰 {formatAmount(expenses.reduce((s, e) => s + e.amount, 0))}
          </Text>
          {(() => {
            const icons = getCategoryIcons(expenses);
            const maxIcons = 4;
            return icons.slice(0, maxIcons).map((item, i) => (
              <Text key={i} style={{ fontSize: 13 }}>{item.icon}</Text>
            ));
          })()}
        </View>
      ) : null}

      {/* Actions — share / edit / delete */}
      <View style={styles.actions}>
        {onShare && photos[0] && (
          <Pressable onPress={() => onShare(photos[0])} style={styles.actionBtn}>
            <Text style={styles.actionText}>공유</Text>
          </Pressable>
        )}
        <Pressable onPress={() => onEdit?.(record)} style={styles.actionBtn}>
          <Text style={styles.actionText}>수정</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => setShowDeleteConfirm(true)} style={styles.actionBtn}>
          <Text style={[styles.actionText, { color: "#ef4444" }]}>삭제</Text>
        </Pressable>
      </View>
      <SimpleAlert
        visible={showDeleteConfirm}
        title="삭제"
        message="이 직관기록을 삭제할까요?"
        confirmText="삭제"
        confirmDestructive
        cancelText="취소"
        onConfirm={() => onDelete?.(record)}
        onCancel={() => setShowDeleteConfirm(false)}
        onClose={() => setShowDeleteConfirm(false)}
      />
    </View>
  );
}


const stampOverlay = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 8,
    right: 8,
    gap: 1,
    alignItems: "flex-end",
  },
  text: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
    fontFamily: "monospace",
    includeFontPadding: false,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  score: {
    fontSize: 14,
    fontWeight: "700",
  },
});
