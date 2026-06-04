import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, ActivityIndicator } from "react-native";
import TeamExpander from "@/components/TeamExpander";
import MyButton from "@/components/MyButton";
import CheerContent from "@/components/CheerContent";
import CoachMark from "@/components/CoachMark";
import { useTheme } from "@/lib/ThemeContext";
import { teamPrimaryColor } from "@shared/teamColors";
import { useTeam } from "@/lib/TeamContext";
import { TEAM_COLORS } from "@shared/teamColors";
import { useNavigation } from "expo-router";
import { getVisitCount, getCheerTeamCoachSeen, setCheerTeamCoachSeen } from "@/lib/db";

type TabId = "songs" | "players" | "rules";

const TAB_LABELS: Record<TabId, string> = { songs: "구단 응원가", players: "선수 응원가", rules: "야구 규칙" };

export default function CheerScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
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
  }), [theme]);
  const [displayTeam, setDisplayTeam] = useState<string | null>(null);
  const { myTeam, loading } = useTeam();
  const [activeTab, setActiveTab] = useState<TabId>("songs");
  const [expanded, setExpanded] = useState<number | null>(0);
  const { width: screenWidth } = useWindowDimensions();
  const tabScrollRef = useRef<ScrollView>(null);
  const TABS_ORDER = useMemo(() => ["songs", "players", "rules"] as const, []);

  // Cheer team expander coach mark (visit 1)
  const [showCheerTeamCoach, setShowCheerTeamCoach] = useState(false);
  const cheerTeamCoachChecked = useRef(false);

	  useEffect(() => {
	    if (!myTeam || loading || cheerTeamCoachChecked.current) return;
	    cheerTeamCoachChecked.current = true;
	    getCheerTeamCoachSeen().then(async (seen) => {
	      if (!seen) {
	        await setCheerTeamCoachSeen();
	        setShowCheerTeamCoach(true);
	      }
	    }).catch(() => {});
	  }, [myTeam, loading]);

  // Dismiss on navigation away
  const navigation = useNavigation();
  useEffect(() => {
    const unsubscribe = navigation.addListener("blur", () => {
      setShowCheerTeamCoach(false);
    });
    return unsubscribe;
  }, [navigation]);

  const handleTabPress = useCallback((tab: TabId) => {
    setActiveTab(tab);
    tabScrollRef.current?.scrollTo({ x: TABS_ORDER.indexOf(tab) * screenWidth, animated: true });
  }, [screenWidth]);

  const handleMomentumScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    const ids = ["songs", "players", "rules"] as const;
    if (idx >= 0 && idx < ids.length) setActiveTab(ids[idx]);
  }, [screenWidth]);

  const activeTeam = displayTeam || myTeam;
  const teamColor = activeTeam ? TEAM_COLORS[activeTeam] : null;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>응원</Text>
          <View style={{ flex: 1 }} />
          <MyButton />
        </View>
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.foreground} />
        </View>
      </View>
    );
  }

  if (!activeTeam) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>응원</Text>
          <View style={{ flex: 1 }} />
          <MyButton />
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
            myTeam={myTeam}
            onSelectTeam={setDisplayTeam}
            onPress={() => setShowCheerTeamCoach(false)}
          />
        )}
        {myTeam && <View style={{ width: 4 }} />}
        <MyButton color={teamPrimaryColor(activeTeam, isDark)} />
      </View>

      {showCheerTeamCoach && (
        <View style={{ paddingHorizontal: 20, marginTop: 4 }}>
          <CoachMark
            visible showChevrons={false} arrowDirection="up" arrowAlign="right"
            text="다른팀 응원가 정보를 보려면 여기를 눌러주세요"
            onDismiss={() => setShowCheerTeamCoach(false)}
          />
        </View>
      )}

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        {(["songs", "players", "rules"] as const).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => handleTabPress(tab)}
            style={[styles.tab, activeTab === tab && { borderBottomColor: teamPrimaryColor(activeTeam, isDark) || theme.primary, borderBottomWidth: 2 }]}
          >
            <Text style={[styles.tabText, activeTab === tab && { color: teamPrimaryColor(activeTeam, isDark) || theme.primary, fontWeight: "700" }]}>
              {TAB_LABELS[tab]}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        ref={tabScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={{ flex: 1 }}
      >
        {(["songs", "players", "rules"] as const).map((tab) => (
          <View key={tab} style={{ width: screenWidth, flex: 1 }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
              {tab === activeTab && (
                <CheerContent
                  teamId={activeTeam}
                  activeTab={tab}
                  expandedSection={expanded}
                  onToggleSection={setExpanded}
                />
              )}
            </ScrollView>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

