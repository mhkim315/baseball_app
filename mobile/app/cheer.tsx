import { useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { TEAM_LIST } from "@shared/teamColors";
import { DEFAULT_TEAM_ID } from "@shared/constants";
import CheerContent from "@/components/CheerContent";
import { useTheme, teamPrimaryColor } from "@/lib/ThemeContext";

type TabId = "songs" | "players" | "rules";

export default function CheerScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const [selectedTeam, setSelectedTeam] = useState(DEFAULT_TEAM_ID);
  const [activeTab, setActiveTab] = useState<TabId>("songs");
  const [expandedSection, setExpandedSection] = useState<number | null>(0);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingTop: 60, paddingHorizontal: 16, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    backBtn: { padding: 8, width: 60 },
    backText: { color: theme.foreground, fontSize: 20 },
    headerTitle: { fontSize: 17, fontWeight: "600", color: theme.foreground },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 40 },

    // Team grid
    teamGrid: {
      flexDirection: "row", flexWrap: "wrap", justifyContent: "center",
      gap: 6, paddingHorizontal: 12, paddingTop: 16, marginBottom: 12,
    },
    teamItem: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
      borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card,
    },
    teamItemText: { fontSize: 12, color: theme.mutedForeground, fontWeight: "500" },
    teamItemTextActive: { color: "#fff", fontWeight: "700" },

    // Team header
    teamHeader: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border,
      padding: 16, marginHorizontal: 16, marginBottom: 12,
    },
    teamDotLarge: { width: 40, height: 40, borderRadius: 20 },
    teamHeaderInfo: { flex: 1 },
    teamHeaderName: { fontSize: 15, fontWeight: "700", color: theme.foreground },

    // Sub-tabs
    subTabRow: {
      flexDirection: "row", marginHorizontal: 16, gap: 4,
      backgroundColor: theme.secondary, borderRadius: 12, padding: 3, marginBottom: 16,
    },
    subTab: {
      flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10,
    },
    subTabActive: { backgroundColor: theme.card },
    subTabText: { fontSize: 12, color: theme.mutedForeground, fontWeight: "500" },
    subTabTextActive: { color: theme.foreground, fontWeight: "600" },
  }), [theme]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🎵 응원가</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Team selector 2×5 */}
        <View style={styles.teamGrid}>
          {TEAM_LIST.map((teamItem) => (
            <Pressable
              key={teamItem.id}
              onPress={() => { setSelectedTeam(teamItem.id); setExpandedSection(0); }}
              style={[
                styles.teamItem,
                selectedTeam === teamItem.id && { backgroundColor: teamPrimaryColor(teamItem.id, isDark), borderColor: teamPrimaryColor(teamItem.id, isDark) },
              ]}
            >
              <Text style={[styles.teamItemText, selectedTeam === teamItem.id && styles.teamItemTextActive]}>
                {teamItem.shortName}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Team header */}
        {(() => {
          const team = TEAM_LIST.find((t) => t.id === selectedTeam);
          if (!team) return null;
          const totalSongs = expandedSection; // placeholder — actual count is internal to CheerContent
          return (
            <View style={styles.teamHeader}>
              <View style={[styles.teamDotLarge, { backgroundColor: teamPrimaryColor(team.id, isDark) }]} />
              <View style={styles.teamHeaderInfo}>
                <Text style={styles.teamHeaderName}>{team.name}</Text>
              </View>
            </View>
          );
        })()}

        {/* Sub-tabs */}
        <View style={styles.subTabRow}>
          {(["songs", "players", "rules"] as const).map((tab) => {
            const labels: Record<TabId, string> = { songs: "구단 응원가", players: "선수 응원가", rules: "야구 규칙" };
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[styles.subTab, activeTab === tab && styles.subTabActive]}
              >
                <Text style={[styles.subTabText, activeTab === tab && styles.subTabTextActive]}>
                  {labels[tab]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Content */}
        <CheerContent
          teamId={selectedTeam}
          activeTab={activeTab}
          expandedSection={expandedSection}
          onToggleSection={setExpandedSection}
        />
      </ScrollView>
    </View>
  );
}
