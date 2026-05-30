import { useState, useEffect, useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { TEAM_LIST } from "@shared/teamColors";
import { TeamBadge } from "@/components/TeamBadge";
import { useTheme } from "@/lib/ThemeContext";
import { teamPrimaryColor } from "@shared/teamColors";
import { useTeam } from "@/lib/TeamContext";
import { prefetchInitialData } from "@/lib/prefetch";

export default function OnboardingScreen() {
  const { theme, isDark } = useTheme();
  const { setMyTeam } = useTeam();
  const router = useRouter();
  const [selectedTeam, setSelectedTeam] = useState<string>("");

  useEffect(() => {
    prefetchInitialData();
  }, []);

  const handleStart = async () => {
    if (!selectedTeam) return;
    setMyTeam(selectedTeam);
    router.replace("/(tabs)/home");
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background, justifyContent: "center", alignItems: "center" },
    content: { alignItems: "center", padding: 32, width: "100%", maxWidth: 400 },
    emoji: { fontSize: 48, marginBottom: 12 },
    logo: { width: 80, height: 80, marginBottom: 12, borderRadius: 20 },
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
  }), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image source={require("../assets/icon.png")} style={styles.logo} />
        <Text style={styles.title}>응원팀을 선택해주세요</Text>
        <Text style={styles.sub}>선택한 팀 기준으로 콘텐츠를 맞춤 제공합니다</Text>

        <View style={styles.teamGrid}>
          {TEAM_LIST.map((team) => (
            <Pressable
              key={team.id}
              onPress={() => setSelectedTeam(team.id)}
              style={[
                styles.teamItem,
                { borderColor: selectedTeam === team.id ? teamPrimaryColor(team.id, isDark) : theme.border },
                selectedTeam === team.id && { backgroundColor: teamPrimaryColor(team.id, isDark) + "18" },
              ]}
            >
              <TeamBadge teamId={team.id} size="md" />
              <Text style={[styles.teamName, selectedTeam === team.id && { color: teamPrimaryColor(team.id, isDark), fontWeight: "700" }]}>
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
