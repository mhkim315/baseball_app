import { useState, useRef } from "react";
import { View, Text, Image, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import ViewShot from "react-native-view-shot";
import { TEAM_COLORS } from "@shared/teamColors";
import { TeamBadge } from "@/components/TeamBadge";
import { savePhoto, resizePhoto, generatePhotoName } from "@/lib/camera";
import { addJikgwanRecord, getMyTeam } from "@/lib/db";

export default function JikgwanPreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    photoUri: string;
    gameId: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: string;
    awayScore: string;
    stadium: string;
  }>();
  const viewShotRef = useRef<any>(null);
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const handleSave = async () => {
    if (!viewShotRef.current || saving) return;
    setSaving(true);
    try {
      // Capture the view (photo + overlay) as a single image
      const uri = await viewShotRef.current.capture?.();
      if (!uri) throw new Error("capture failed");

      // Resize to reasonable size
      const resized = await resizePhoto(uri);
      const fileName = generatePhotoName();
      const savedUri = await savePhoto(resized, fileName);

      // Save record to SQLite
      const myTeam = await getMyTeam();
      await addJikgwanRecord({
        game_id: params.gameId || "",
        date: dateStr,
        photo_path: savedUri,
        memo: null,
        score_away: params.awayScore ? parseInt(params.awayScore) : null,
        score_home: params.homeScore ? parseInt(params.homeScore) : null,
      });

      Alert.alert("저장 완료", "직관 기록이 저장되었습니다", [
        { text: "확인", onPress: () => router.dismissAll() },
      ]);
    } catch (e) {
      Alert.alert("오류", "저장 중 문제가 발생했습니다");
    } finally {
      setSaving(false);
    }
  };

  const homeColor = TEAM_COLORS[params.homeTeam]?.primary || "#fff";
  const awayColor = TEAM_COLORS[params.awayTeam]?.primary || "#fff";

  return (
    <View style={styles.container}>
      {/* ViewShot target: the composite image */}
      <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 0.9 }}>
        <View style={styles.composite}>
          <Image source={{ uri: params.photoUri }} style={styles.photo} />

          {/* Overlay */}
          <View style={styles.overlay}>
            {/* Top right: app logo */}
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>⚾ fullcount.kr</Text>
            </View>

            {/* Spacer */}
            <View style={{ flex: 1 }} />

            {/* Bottom: game info + timestamp */}
            <View style={styles.infoContainer}>
              {/* Teams & Score */}
              {(params.homeTeam || params.awayTeam) && (
                <View style={styles.matchupRow}>
                  <View style={styles.teamInfo}>
                    {params.awayTeam && <TeamBadge teamId={params.awayTeam} size="sm" variant="ball" />}
                    <Text style={[styles.teamLabel, { color: awayColor }]}>
                      {params.awayTeam ? TEAM_COLORS[params.awayTeam]?.shortName : ""}
                    </Text>
                  </View>
                  {params.homeScore ? (
                    <Text style={styles.scoreText}>{params.awayScore}:{params.homeScore}</Text>
                  ) : null}
                  <View style={styles.teamInfo}>
                    {params.homeTeam && <TeamBadge teamId={params.homeTeam} size="sm" variant="ball" />}
                    <Text style={[styles.teamLabel, { color: homeColor }]}>
                      {params.homeTeam ? TEAM_COLORS[params.homeTeam]?.shortName : ""}
                    </Text>
                  </View>
                </View>
              )}

              {/* Stadium & timestamp */}
              <View style={styles.metaRow}>
                {params.stadium && <Text style={styles.metaText}>{params.stadium}</Text>}
                <Text style={styles.metaText}>{dateStr} {timeStr}</Text>
              </View>
            </View>
          </View>
        </View>
      </ViewShot>

      {/* Action buttons */}
      <View style={styles.actions}>
        <Pressable style={styles.retakeBtn} onPress={() => router.back()}>
          <Text style={styles.retakeText}>다시 찍기</Text>
        </Pressable>
        <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.saveText}>저장하기</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  composite: {
    width: "100%",
    aspectRatio: 3 / 4,
    position: "relative",
  },
  photo: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  overlay: {
    flex: 1,
    padding: 16,
  },
  logoContainer: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  logoText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  infoContainer: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  matchupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  teamInfo: {
    alignItems: "center",
    gap: 4,
  },
  teamLabel: {
    fontSize: 12,
    fontWeight: "bold",
  },
  scoreText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  retakeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#444",
    alignItems: "center",
  },
  retakeText: { color: "#fff", fontSize: 14 },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  saveText: { color: "#000", fontSize: 14, fontWeight: "600" },
});
