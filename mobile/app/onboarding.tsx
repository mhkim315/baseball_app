import { useState, useEffect, useRef, useMemo } from "react";
import { View, Text, Image, Pressable, ScrollView, StyleSheet, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { useRouter } from "expo-router";
import { TEAM_LIST } from "@shared/teamColors";
import { TeamBadge } from "@/components/TeamBadge";
import { useTheme } from "@/lib/ThemeContext";
import { teamPrimaryColor } from "@shared/teamColors";
import { useTeam } from "@/lib/TeamContext";
import { prefetchOnboardingData } from "@/lib/prefetch";

export default function OnboardingScreen() {
  const { theme, isDark } = useTheme();
  const { setMyTeam } = useTeam();
  const router = useRouter();
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const { width: screenWidth } = useWindowDimensions();

  useEffect(() => {
    prefetchOnboardingData();
  }, []);

  const handleStart = async () => {
    if (!selectedTeam) return;
    setMyTeam(selectedTeam);
    router.replace("/(tabs)/home");
  };

  const goToTeamSelect = () => {
    scrollRef.current?.scrollTo({ x: screenWidth, animated: true });
  };

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    setCurrentPage(page);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContainer: {
      flex: 1,
    },
    slide: {
      width: screenWidth,
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    },
    // Intro slide
    introContent: {
      alignItems: "center",
      maxWidth: 360,
    },
    logo: {
      width: 80,
      height: 80,
      marginBottom: 16,
      borderRadius: 20,
    },
    introTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.foreground,
      textAlign: "center",
      marginBottom: 12,
      lineHeight: 34,
    },
    introSub: {
      fontSize: 14,
      color: theme.mutedForeground,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 40,
    },
    ctaBtn: {
      backgroundColor: theme.foreground,
      paddingVertical: 16,
      paddingHorizontal: 40,
      borderRadius: 16,
    },
    ctaBtnText: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.background,
    },
    // Team selection
    teamContent: {
      alignItems: "center",
      width: "100%",
      maxWidth: 400,
    },
    teamTitle: {
      fontSize: 22,
      fontWeight: "bold",
      color: theme.foreground,
      marginBottom: 8,
    },
    teamSub: {
      fontSize: 13,
      color: theme.mutedForeground,
      marginBottom: 28,
      textAlign: "center",
    },
    teamGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 12,
      marginBottom: 32,
    },
    teamItem: {
      width: 80,
      height: 94,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 2,
      backgroundColor: theme.card,
      gap: 6,
    },
    teamName: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.mutedForeground,
    },
    startBtn: {
      backgroundColor: theme.foreground,
      paddingVertical: 16,
      borderRadius: 16,
      width: "100%",
      alignItems: "center",
    },
    startBtnDisabled: {
      opacity: 0.35,
    },
    startBtnText: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.background,
    },
    // Skip button
    topBar: {
      position: "absolute",
      top: 60,
      left: 0,
      right: 0,
      flexDirection: "row",
      justifyContent: "flex-end",
      paddingHorizontal: 20,
      zIndex: 10,
    },
    skipBtn: {
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    skipText: {
      fontSize: 15,
      color: theme.mutedForeground,
      fontWeight: "500",
    },
    // Page dots
    dotsRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      paddingBottom: 48,
      gap: 8,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.border,
    },
    dotActive: {
      width: 24,
      backgroundColor: theme.foreground,
    },
  }), [theme, screenWidth]);

  return (
    <View style={styles.container}>
      {/* Skip button — only on intro page */}
      {currentPage === 0 && (
        <View style={styles.topBar}>
          <Pressable style={styles.skipBtn} onPress={goToTeamSelect}>
            <Text style={styles.skipText}>건너뛰기</Text>
          </Pressable>
        </View>
      )}

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        style={styles.scrollContainer}
      >
        {/* Step 0: Intro */}
        <View style={styles.slide}>
          <View style={styles.introContent}>
            <Image source={require("../assets/icon.png")} style={styles.logo} />
            <Text style={styles.introTitle}>
              내 직관 승률,{"\n"}궁금하지 않으세요?
            </Text>
            <Text style={styles.introSub}>
              직관 경기 승률, 관람 패턴,{"\n"}나만의 기록을 한눈에 확인하세요
            </Text>
            <Pressable style={styles.ctaBtn} onPress={goToTeamSelect}>
              <Text style={styles.ctaBtnText}>궁금해요!</Text>
            </Pressable>
          </View>
        </View>

        {/* Step 1: Team Selection */}
        <View style={styles.slide}>
          <View style={styles.teamContent}>
            <Image source={require("../assets/icon.png")} style={styles.logo} />
            <Text style={styles.teamTitle}>응원팀을 선택해주세요</Text>
            <Text style={styles.teamSub}>선택한 팀 기준으로 콘텐츠를 맞춤 제공합니다</Text>

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
              <Text style={styles.startBtnText}>시작하기</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Page indicator dots */}
      <View style={styles.dotsRow}>
        <View style={[styles.dot, currentPage === 0 && styles.dotActive]} />
        <View style={[styles.dot, currentPage === 1 && styles.dotActive]} />
      </View>
    </View>
  );
}
