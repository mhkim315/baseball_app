import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { getMyTeam } from "@/lib/db";
import TeamExpander from "@/components/TeamExpander";
import SettingsButton from "@/components/SettingsButton";
import CheerContent from "@/components/CheerContent";
import { theme } from "@/lib/theme";
import { TEAM_COLORS } from "@shared/teamColors";

type TabId = "songs" | "players" | "rules";

const TAB_LABELS: Record<TabId, string> = { songs: "구단 응원가", players: "선수 응원가", rules: "야구 규칙" };

export default function CheerScreen() {
  const [myTeam, setMyTeam] = useState<string | null>(null);
  const [displayTeam, setDisplayTeam] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("songs");
  const [expanded, setExpanded] = useState<number | null>(0);

  useEffect(() => {
    getMyTeam().then(setMyTeam);
  }, []);

  const activeTeam = displayTeam || myTeam;
  const teamColor = activeTeam ? TEAM_COLORS[activeTeam] : null;

  if (!activeTeam) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>응원</Text>
          <View style={{ flex: 1 }} />
          <SettingsButton />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>⚾ 응원팀을 먼저 선택해주세요</Text>
          <Text style={styles.emptyDesc}>
            MY 페이지에서 응원팀을 설정하면{'\n'}해당 구단의 응원가와 선수 정보를 볼 수 있어요
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>응원</Text>
        <View style={{ flex: 1 }} />
        {myTeam && (
          <TeamExpander
            currentTeamId={activeTeam}
            onSelectTeam={setDisplayTeam}
          />
        )}
        {myTeam && <View style={{ width: 4 }} />}
        <SettingsButton color={teamColor?.primary} />
      </View>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        {(["songs", "players", "rules"] as const).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && { borderBottomColor: teamColor?.primary || theme.primary, borderBottomWidth: 2 }]}
          >
            <Text style={[styles.tabText, activeTab === tab && { color: teamColor?.primary || theme.primary, fontWeight: "700" }]}>
              {TAB_LABELS[tab]}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <CheerContent
          teamId={activeTeam}
          activeTab={activeTab}
          expandedSection={expanded}
          onToggleSection={setExpanded}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.foreground,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },

  // Tabs
  tabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: theme.border, marginHorizontal: 16 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10 },
  tabText: { fontSize: 12, color: theme.mutedForeground, fontWeight: "500" },

  // Empty state
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: theme.foreground, marginBottom: 8, textAlign: "center" },
  emptyDesc: { fontSize: 13, color: theme.mutedForeground, lineHeight: 20, textAlign: "center" },
});
