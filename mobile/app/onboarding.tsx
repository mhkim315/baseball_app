import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { TEAM_LIST } from "@shared/teamColors";
import { TeamBadge } from "@/components/TeamBadge";
import { setMyTeam } from "@/lib/db";
import { theme } from "@/lib/theme";

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<"welcome" | "team">("welcome");
  const [selectedTeam, setSelectedTeam] = useState<string>("");

  const handleStart = async () => {
    if (!selectedTeam) return;
    await setMyTeam(selectedTeam);
    router.replace("/(tabs)");
  };

  if (step === "team") {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.emoji}>⚾</Text>
          <Text style={styles.title}>응원팀을 선택해주세요</Text>
          <Text style={styles.sub}>선택한 팀 기준으로 콘텐츠를 맞춤 제공합니다</Text>

          <View style={styles.teamGrid}>
            {TEAM_LIST.map((team) => (
              <Pressable
                key={team.id}
                onPress={() => setSelectedTeam(team.id)}
                style={[
                  styles.teamItem,
                  { borderColor: selectedTeam === team.id ? team.primary : theme.border },
                  selectedTeam === team.id && { backgroundColor: team.primary + "18" },
                ]}
              >
                <TeamBadge teamId={team.id} size="md" />
                <Text style={[styles.teamName, selectedTeam === team.id && { color: team.primary, fontWeight: "700" }]}>
                  {team.shortName}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.startBtn, !selectedTeam && styles.startBtnDisabled]}
            onPress={handleStart}
            disabled={!selectedTeam}
          >
            <Text style={[styles.startBtnText, !selectedTeam && styles.startBtnTextDisabled]}>
              시작하기
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>⚾</Text>
        <Text style={styles.appName}>fullcount.kr</Text>
        <Text style={styles.desc}>KBO 직관 기록 앱</Text>

        <View style={styles.gap} />

        <Pressable style={styles.loginBtn} onPress={() => router.push("/login")}>
          <Text style={styles.loginBtnText}>소셜 로그인</Text>
        </Pressable>

        <Pressable style={styles.browseBtn} onPress={() => setStep("team")}>
          <Text style={styles.browseBtnText}>둘러보기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background, justifyContent: "center", alignItems: "center" },
  content: { alignItems: "center", padding: 32, width: "100%", maxWidth: 400 },

  logo: { fontSize: 64, marginBottom: 8 },
  appName: { fontSize: 28, fontWeight: "bold", color: theme.foreground, marginBottom: 8 },
  desc: { fontSize: 15, color: theme.mutedForeground, marginBottom: 8 },
  gap: { height: 48 },

  loginBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  loginBtnText: { fontSize: 17, fontWeight: "700", color: theme.primaryForeground },

  browseBtn: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    width: "100%",
    alignItems: "center",
  },
  browseBtnText: { fontSize: 15, color: theme.mutedForeground },

  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: "bold", color: theme.foreground, marginBottom: 8 },
  sub: { fontSize: 13, color: theme.mutedForeground, marginBottom: 28, textAlign: "center" },

  teamGrid: {
    flexDirection: "row", flexWrap: "wrap", justifyContent: "center",
    gap: 12, marginBottom: 32,
  },
  teamItem: {
    width: 80, height: 94, justifyContent: "center", alignItems: "center",
    borderRadius: 14, borderWidth: 2, backgroundColor: theme.card, gap: 6,
  },
  teamName: { fontSize: 11, fontWeight: "600", color: theme.mutedForeground },

  startBtn: {
    backgroundColor: theme.foreground, paddingVertical: 16, borderRadius: 16,
    width: "100%", alignItems: "center",
  },
  startBtnDisabled: { opacity: 0.35 },
  startBtnText: { fontSize: 17, fontWeight: "700", color: theme.background },
  startBtnTextDisabled: { color: theme.background },
});
