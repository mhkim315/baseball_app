import { useState, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter, useLocalSearchParams } from "expo-router";

export default function JikgwanCameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const params = useLocalSearchParams<{ gameId?: string; homeTeam?: string; awayTeam?: string; homeScore?: string; awayScore?: string; stadium?: string }>();

  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo) {
        // Navigate to preview with the photo and game data
        router.push({
          pathname: "/jikgwan/preview",
          params: {
            photoUri: photo.uri,
            gameId: params.gameId ?? "",
            homeTeam: params.homeTeam ?? "",
            awayTeam: params.awayTeam ?? "",
            homeScore: params.homeScore ?? "",
            awayScore: params.awayScore ?? "",
            stadium: params.stadium ?? "",
          },
        });
      }
    } catch (e) {
      console.warn("takePicture failed", e);
      Alert.alert("촬영 오류", "사진을 촬영하지 못했습니다");
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>카메라 권한을 확인 중...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>직관 기록을 위해 카메라 권한이 필요합니다</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>권한 허용하기</Text>
        </Pressable>
        <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelText}>취소</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable style={styles.closeBtn} onPress={() => router.back()}>
            <Text style={styles.closeText}>← 취소</Text>
          </Pressable>
          {params.stadium && (
            <Text style={styles.stadiumLabel}>{params.stadium}</Text>
          )}
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomBar}>
          <View style={styles.captureBtnOuter}>
            <Pressable style={styles.captureBtn} onPress={takePicture} />
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  text: { color: "#fff", fontSize: 16, textAlign: "center", padding: 20 },
  button: {
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignSelf: "center",
    marginTop: 16,
  },
  buttonText: { fontSize: 14, fontWeight: "600", color: "#000" },
  cancelBtn: { alignSelf: "center", marginTop: 16 },
  cancelText: { color: "#888", fontSize: 14 },
  topBar: {
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  closeBtn: {
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  closeText: { color: "#fff", fontSize: 14 },
  stadiumLabel: { color: "#fff", fontSize: 13, textAlign: "center", marginTop: 8, opacity: 0.7 },
  bottomBar: {
    paddingBottom: 60,
    paddingTop: 24,
    alignItems: "center",
  },
  captureBtnOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  captureBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
  },
});
