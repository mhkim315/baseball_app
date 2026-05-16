import { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { getMyTeam } from "@/lib/db";
import TeamExpander from "@/components/TeamExpander";
import StadiumPage from "@/components/StadiumPage";
import { TEAM_COLORS } from "@shared/teamColors";
import { theme } from "@/lib/theme";

export default function StadiumTab() {
  const [myTeam, setMyTeam] = useState<string | null>(null);
  const [displayTeam, setDisplayTeam] = useState<string | null>(null);

  useEffect(() => {
    getMyTeam().then(setMyTeam);
  }, []);

  const activeTeam = displayTeam || myTeam || "doosan";

  if (!myTeam) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>구장 안내</Text>
        </View>
        <StadiumPage teamId={activeTeam} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>구장 안내</Text>
        <TeamExpander
          currentTeamId={activeTeam}
          onSelectTeam={setDisplayTeam}
        />
      </View>
      <StadiumPage teamId={activeTeam} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    alignItems: "flex-start",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.foreground,
  },
});
