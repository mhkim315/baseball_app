import { useState, useRef } from "react";
import { View, Text, Image, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import ViewShot, { captureRef } from "react-native-view-shot";
import { TEAM_COLORS } from "@shared/teamColors";
import { savePhoto, resizePhoto, generatePhotoName } from "@/lib/camera";
import { theme } from "@/lib/theme";

const FRAMES = [
  { id: "classic", label: "기본", bg: "#fff" },
  { id: "retro", label: "레트로", bg: "#f0e6d3" },
  { id: "rounded", label: "라운드", bg: theme.card },
  { id: "team", label: "팀컬러", bg: "#fff" },
  { id: "ticket", label: "티켓", bg: "#fef3c7" },
];

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
  const shotRef = useRef<ViewShot>(null);
  const [frameStyle, setFrameStyle] = useState("classic");
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;

  const handleNext = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Capture photo + film stamp + frame as composite image
      if (!shotRef.current) throw new Error("capture reference not ready");
      const shotUri = await captureRef(shotRef, { format: "jpg", quality: 0.92 });
      if (!shotUri) throw new Error("capture failed");

      const resized = await resizePhoto(shotUri);
      const fileName = generatePhotoName();
      const savedUri = await savePhoto(resized, fileName);

      // Navigate to write.tsx with saved photo and game data
      router.push({
        pathname: "/jikgwan/write",
        params: {
          photoUri: savedUri,
          gameId: params.gameId ?? "",
          homeTeam: params.homeTeam ?? "",
          awayTeam: params.awayTeam ?? "",
          homeScore: params.homeScore ?? "",
          awayScore: params.awayScore ?? "",
          stadium: params.stadium ?? "",
          dateStr,
          frameStyle,
        },
      });
    } catch (e) {
      console.warn("preview handleNext error", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Photo preview */}
      <View style={styles.photoContainer}>
        <ViewShot ref={shotRef} options={{ format: "jpg", quality: 0.92 }}>
          <View style={[
            { backgroundColor: FRAMES.find((f) => f.id === frameStyle)?.bg || "#fff", overflow: "hidden", position: "relative" },
            frameStyle === "rounded" ? { borderRadius: 16 } : { borderRadius: 20 },
            frameStyle !== "rounded" && { borderWidth: 10, borderColor: FRAMES.find((f) => f.id === frameStyle)?.bg || "#fff" },
          ]}>
            <Image source={{ uri: params.photoUri }} style={styles.photo} />

            {/* Film camera stamp — embedded into saved photo */}
            <View style={stampStyles.container}>
              <View style={stampStyles.bg}>
                {params.awayTeam && params.homeTeam && (
                  <Text style={stampStyles.text} numberOfLines={1}>
                    {TEAM_COLORS[params.awayTeam]?.shortName} vs {TEAM_COLORS[params.homeTeam]?.shortName}
                  </Text>
                )}
                {params.homeScore ? (
                  <Text style={[stampStyles.text, stampStyles.score]}>{params.awayScore}:{params.homeScore}</Text>
                ) : null}
                {params.stadium ? (
                  <Text style={stampStyles.text} numberOfLines={1}>{params.stadium}</Text>
                ) : null}
                <Text style={stampStyles.text}>{dateStr}</Text>
              </View>
            </View>
          </View>
        </ViewShot>
      </View>

      {/* Frame selector */}
      <View style={frameStyles.frameSelector}>
        <Text style={frameStyles.frameTitle}>프레임 선택</Text>
        <View style={frameStyles.frameRow}>
          {FRAMES.map((f) => (
            <Pressable
              key={f.id}
              style={[
                frameStyles.frameItem,
                { backgroundColor: f.bg },
                frameStyle === f.id && frameStyles.frameItemActive,
              ]}
              onPress={() => setFrameStyle(f.id)}
            >
              <Text style={[
                frameStyles.frameLabel,
                f.id === "ticket" && { color: "#92400e" },
              ]}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Action buttons */}
      <View style={frameStyles.actions}>
        <Pressable style={frameStyles.retakeBtn} onPress={() => router.back()}>
          <Text style={frameStyles.retakeText}>다시 찍기</Text>
        </Pressable>
        <Pressable style={frameStyles.nextBtn} onPress={handleNext} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={frameStyles.nextText}>다음</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  photoContainer: {
    margin: 20,
    marginTop: 60,
  },
  photo: {
    width: "100%",
    aspectRatio: 3 / 4,
    resizeMode: "cover",
  },
});

const stampStyles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    right: 0,
    padding: 10,
  },
  bg: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 1,
    alignItems: "flex-end",
  },
  text: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
    fontFamily: "monospace",
    includeFontPadding: false,
  },
  score: {
    fontSize: 14,
    fontWeight: "700",
  },
});

const frameStyles = StyleSheet.create({
  // Frame selector
  frameSelector: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  frameTitle: {
    color: "#ccc",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
  },
  frameRow: {
    flexDirection: "row",
    gap: 8,
  },
  frameItem: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#444",
  },
  frameItemActive: {
    borderColor: "#fff",
    borderWidth: 2,
  },
  frameLabel: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "600",
  },
  // Actions
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 16,
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
  nextBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  nextText: { color: "#000", fontSize: 14, fontWeight: "600" },
});
