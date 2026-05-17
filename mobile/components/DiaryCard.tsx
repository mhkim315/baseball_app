import { useState, useCallback } from "react";
import { View, Text, Image, Pressable, ScrollView, StyleSheet, NativeSyntheticEvent, NativeScrollEvent, useWindowDimensions } from "react-native";
import { TeamBadge } from "@/components/TeamBadge";
import { EMOTION_CHARACTER } from "@/components/EmotionPicker";
import { TEAM_COLORS } from "@shared/teamColors";
import { TEAM_ID_TO_CODE } from "@shared/constants";
import { theme } from "@/lib/theme";
import type { JikgwanRecord } from "@/lib/db";

interface DiaryCardProps {
  record: JikgwanRecord;
  teamId: string | null;
  onShare?: (uri: string) => void;
  onDelete?: (record: JikgwanRecord) => void;
  onEdit?: (record: JikgwanRecord) => void;
}

/** game_id "0000-ABCD-0" → { awayId, homeId } */
function parseGameTeamIds(gameId: string): { awayId: string; homeId: string } {
  const codeToId: Record<string, string> = {};
  for (const [id, code] of Object.entries(TEAM_ID_TO_CODE)) {
    codeToId[code] = id;
  }
  const m = gameId.match(/^\d+-(\w{4})-\d+$/);
  if (m) {
    return {
      awayId: codeToId[m[1].slice(0, 2)] || "",
      homeId: codeToId[m[1].slice(2, 4)] || "",
    };
  }
  return { awayId: "", homeId: "" };
}

function getWinBadge(isWin: number | null): { label: string; color: string } | null {
  if (isWin === 1) return { label: "승", color: "#16a34a" };
  if (isWin === 0) return { label: "무", color: "#ca8a04" };
  if (isWin === -1) return { label: "패", color: "#dc2626" };
  return null;
}

function formatDisplayDate(dateStr: string): string {
  const p = dateStr.split(".");
  if (p.length === 3) return `${parseInt(p[0])}.${parseInt(p[1])}.${parseInt(p[2])}`;
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

export default function DiaryCard({ record, teamId, onShare, onDelete, onEdit }: DiaryCardProps) {
  const { width: screenWidth } = useWindowDimensions();
  const photoWidth = screenWidth;
  const photos = parsePhotos(record);
  const [photoIndex, setPhotoIndex] = useState(0);
  const liveTeamColor = teamId ? TEAM_COLORS[teamId]?.primary : "#3b82f6";

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
    setPhotoIndex(idx);
  }, []);

  // Parse teams from game_id
  const gt = parseGameTeamIds(record.game_id || "");
  const profileTeamId = record.cheered_team || gt.awayId || gt.homeId || "";
  const charKey = record.emotion ? (EMOTION_CHARACTER[record.emotion] || "neutral") : "neutral";
  const emChar = charKey as "joyful" | "determined" | "neutral" | "sad";

  // Caption text: memo first, fallback to three_line
  const caption = record.memo
    ? record.memo
    : [record.three_line_1, record.three_line_2, record.three_line_3]
        .filter(Boolean)
        .join("\n");

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
                  ? `${TEAM_COLORS[gt.awayId]?.shortName || "?"} ${record.score_away != null ? record.score_away : ""} : ${record.score_home != null ? record.score_home : ""} ${TEAM_COLORS[gt.homeId]?.shortName || "?"}`
                  : TEAM_COLORS[gt.awayId || gt.homeId]?.shortName}
              </Text>
            )}
            {(() => {
              const badge = getWinBadge(record.is_win);
              if (!badge) return null;
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
          >
            {photos.map((uri, i) => (
              <View key={i} style={{ position: "relative" }}>
                <Image source={{ uri }} style={[styles.photo, { width: photoWidth }]} />
                {(gt.awayId || gt.homeId) && (
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
      ) : (
        <View style={styles.noPhoto}>
          <Text style={styles.noPhotoIcon}>⚾</Text>
        </View>
      )}

      {/* Caption — diary text */}
      {caption ? (
        <View style={styles.caption}>
          <Text style={styles.captionText}>{caption}</Text>
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
        <Pressable onPress={() => onDelete?.(record)} style={styles.actionBtn}>
          <Text style={[styles.actionText, { color: "#ef4444" }]}>삭제</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  noPhoto: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.muted,
  },
  noPhotoIcon: { fontSize: 40 },
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
});

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
