import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { TEAM_COLORS } from "@shared/teamColors";
import { TEAM_ID_TO_CODE } from "@shared/constants";
import { TeamBadge } from "@/components/TeamBadge";
import { EMOTION_CHARACTER } from "@/components/EmotionPicker";
import { theme } from "@/lib/theme";
import type { JikgwanRecord } from "@/lib/db";

const FRAME_STYLES: Record<string, { borderColor: string; borderWidth: number }> = {
  classic: { borderColor: "#fff", borderWidth: 12 },
  retro: { borderColor: "#f0e6d3", borderWidth: 10 },
  rounded: { borderColor: "transparent", borderWidth: 0 },
  team: { borderColor: "#fff", borderWidth: 12 },
  ticket: { borderColor: "#fef3c7", borderWidth: 8 },
};

interface DiaryCardProps {
  record: JikgwanRecord;
  teamId: string | null;
  onShare?: (uri: string) => void;
  onDelete?: (record: JikgwanRecord) => void;
}

export default function DiaryCard({ record, teamId, onShare, onDelete }: DiaryCardProps) {
  const teams = parseGameId(record.game_id);
  const homeTeam = teams.homeId ? TEAM_COLORS[teams.homeId] : null;
  const awayTeam = teams.awayId ? TEAM_COLORS[teams.awayId] : null;
  const hasScore = record.score_away != null && record.score_home != null;
  const frame = FRAME_STYLES[record.frame_style ?? "classic"] ?? FRAME_STYLES.classic;
  const isWin = record.is_win;
  const emotionChar = record.emotion ? EMOTION_CHARACTER[record.emotion] ?? null : null;
  const emotionTeam = teams.homeId || teams.awayId;

  let teamBorderColor: string | undefined;
  if (record.frame_style === "team" && teamId) {
    teamBorderColor = TEAM_COLORS[teamId]?.primary;
  }

  return (
    <View style={styles.card}>
      {/* Photo with frame */}
      <View style={[styles.photoWrapper, { borderColor: teamBorderColor ?? frame.borderColor, borderWidth: frame.borderWidth }]}>
        {record.photo_path ? (
          <Image source={{ uri: record.photo_path }} style={styles.photo} />
        ) : (
          <View style={styles.noPhoto}>
            <Text style={styles.noPhotoIcon}>📸</Text>
          </View>
        )}

        {/* Emotion character overlay */}
        {emotionChar && emotionTeam && (
          <View style={styles.emotionBadge}>
            <TeamBadge teamId={emotionTeam} size="sm" emotion={emotionChar} />
          </View>
        )}

        {/* Win/Loss badge */}
        {isWin === 1 && (
          <View style={styles.winBadge}>
            <Text style={styles.winBadgeText}>승리!</Text>
          </View>
        )}
        {isWin === -1 && (
          <View style={styles.lossBadge}>
            <Text style={styles.lossBadgeText}>패</Text>
          </View>
        )}

        {/* Team color accent bar */}
        {teamId && TEAM_COLORS[teamId] && (
          <View style={[styles.accentBar, { backgroundColor: TEAM_COLORS[teamId].primary }]} />
        )}
      </View>

      {/* Info section */}
      <View style={styles.info}>
        {/* Teams + Score */}
        {(homeTeam || awayTeam) && (
          <View style={styles.matchupRow}>
            {awayTeam && <TeamBadge teamId={teams.awayId!} size="sm" />}
            <Text style={[styles.teamName, awayTeam && { color: awayTeam.primary }]}>
              {awayTeam?.shortName || ""}
            </Text>
            {hasScore ? (
              <Text style={styles.score}>{record.score_away}:{record.score_home}</Text>
            ) : (
              <Text style={styles.vsText}>VS</Text>
            )}
            <Text style={[styles.teamName, homeTeam && { color: homeTeam.primary }]}>
              {homeTeam?.shortName || ""}
            </Text>
            {homeTeam && <TeamBadge teamId={teams.homeId!} size="sm" />}
          </View>
        )}

        {/* Stadium + Date */}
        <View style={styles.metaRow}>
          {record.stadium && <Text style={styles.metaText}>{record.stadium}</Text>}
          <Text style={styles.metaText}>{record.date}</Text>
        </View>

        {/* Three-line diary */}
        {record.three_line_1 && (
          <View style={styles.diaryBox}>
            <Text style={styles.diaryLine}>
              <Text style={styles.diaryLabel}>💭 </Text>
              {record.three_line_1}
            </Text>
            {record.three_line_2 && (
              <Text style={styles.diaryLine}>
                <Text style={styles.diaryLabel}>📝 </Text>
                {record.three_line_2}
              </Text>
            )}
            {record.three_line_3 && (
              <Text style={styles.diaryLine}>
                <Text style={styles.diaryLabel}>🌟 </Text>
                {record.three_line_3}
              </Text>
            )}
          </View>
        )}

        {/* Legacy memo fallback */}
        {!record.three_line_1 && record.memo && (
          <Text style={styles.memoText}>{record.memo}</Text>
        )}

        {/* Actions */}
        {(onShare || onDelete) && (
          <View style={styles.actions}>
            {onShare && record.photo_path && (
              <Pressable onPress={() => onShare(record.photo_path!)} style={styles.actionBtn}>
                <Text style={styles.actionText}>공유</Text>
              </Pressable>
            )}
            {onDelete && (
              <Pressable onPress={() => onDelete(record)} style={styles.actionBtn}>
                <Text style={[styles.actionText, { color: "#ef4444" }]}>삭제</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function parseGameId(gameId: string): { awayId?: string; homeId?: string } {
  const match = gameId.match(/^\d+-(\w{4})-\d+$/);
  if (!match) return {};
  const code = match[1];
  const TEAM_CODE_TO_ID: Record<string, string> = {};
  for (const [id, c] of Object.entries(TEAM_ID_TO_CODE)) {
    TEAM_CODE_TO_ID[c] = id;
  }
  return {
    awayId: TEAM_CODE_TO_ID[code.slice(0, 2)],
    homeId: TEAM_CODE_TO_ID[code.slice(2, 4)],
  };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.border,
  },
  photoWrapper: {
    position: "relative",
    borderRadius: 16,
    overflow: "hidden",
  },
  photo: {
    width: "100%",
    height: 320,
    resizeMode: "cover",
  },
  noPhoto: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.muted,
  },
  noPhotoIcon: { fontSize: 40 },
  emotionBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  winBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "#22c55e",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  winBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  lossBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lossBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  accentBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  info: {
    padding: 16,
    gap: 8,
  },
  matchupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  teamName: { fontSize: 13, fontWeight: "600" },
  score: { fontSize: 20, fontWeight: "bold", color: theme.foreground },
  vsText: { fontSize: 13, fontWeight: "600", color: theme.mutedForeground },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaText: { fontSize: 11, color: theme.mutedForeground },
  diaryBox: {
    backgroundColor: theme.muted,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  diaryLine: {
    fontSize: 13,
    color: theme.foreground,
    lineHeight: 19,
  },
  diaryLabel: {
    fontSize: 12,
  },
  memoText: {
    fontSize: 13,
    color: theme.foreground,
    lineHeight: 19,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: theme.muted,
  },
  actionText: { fontSize: 12, color: theme.foreground, fontWeight: "500" },
});
