import { useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import TeamExpander from "@/components/TeamExpander";
import StadiumPage from "@/components/StadiumPage";
import MyButton from "@/components/MyButton";
import { TEAM_COLORS } from "@shared/teamColors";
import { useTheme, teamPrimaryColor } from "@/lib/ThemeContext";
import { useTeam } from "@/lib/TeamContext";

export default function StadiumTab() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      paddingTop: 60,
      paddingHorizontal: 20,
      paddingBottom: 8,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.foreground,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
      paddingTop: 80,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.foreground,
      marginBottom: 8,
      textAlign: "center",
    },
    emptyDesc: {
      fontSize: 13,
      color: theme.mutedForeground,
      lineHeight: 20,
      textAlign: "center",
    },
  }), [theme]);
  const [displayTeam, setDisplayTeam] = useState<string | null>(null);

  const { myTeam, loading } = useTeam();

  const myTeamColor = myTeam ? teamPrimaryColor(myTeam, isDark) : undefined;

  if (loading) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>구장 안내</Text>
          <View style={{ flex: 1 }} />
          <MyButton />
        </View>
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.foreground} />
        </View>
      </ScrollView>
    );
  }

  if (!myTeam) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>구장 안내</Text>
          <View style={{ flex: 1 }} />
          <MyButton />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>⚾ 응원팀을 먼저 선택해주세요</Text>
          <Text style={styles.emptyDesc}>
            MY 페이지에서 응원팀을 설정하면{'\n'}해당 구단의 구장 정보를 볼 수 있어요
          </Text>
        </View>
      </ScrollView>
    );
  }

  const activeTeam = displayTeam || myTeam;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>구장 안내</Text>
        <View style={{ flex: 1 }} />
        <TeamExpander
          currentTeamId={activeTeam}
          myTeam={myTeam}
          onSelectTeam={setDisplayTeam}
        />
        <View style={{ width: 4 }} />
        <MyButton color={myTeamColor} />
      </View>
      <StadiumPage teamId={activeTeam} accentColor={myTeamColor} />
    </View>
  );
}
