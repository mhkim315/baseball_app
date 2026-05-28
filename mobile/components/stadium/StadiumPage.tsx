import { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, ScrollView, Pressable, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { TEAM_COLORS, TEAM_LIST } from "@shared/teamColors";
import { DEFAULT_TEAM_ID } from "@shared/constants";
import { TeamBadge } from "@/components/TeamBadge";
import type { StadiumBrief, FoodPlace, SurroundingSpot, EatsSpot } from "@/lib/api";
import { STADIUM_BRIEFS, STADIUM_FOODS, STADIUM_PARKING, STADIUM_NEARBY, TEAM_STADIUM_MAP, STADIUM_COORDINATES, TRANSIT_STOPS } from "@/lib/stadiumData";
import { useTheme } from "@/lib/ThemeContext";
import { teamPrimaryColor } from "@shared/teamColors";
import { IMAGE_BASE, TABS, TabId } from "./stadiumHelpers";
import { useStadiumStyles } from "./stadiumStyles";
import InfoTab from "./InfoTab";
import FoodTab from "./FoodTab";
import ParkingTab from "./ParkingTab";
import TransportTab from "./TransportTab";
import NearbyTab from "./NearbyTab";

export default function StadiumPage({ teamId: propTeamId, accentColor }: { teamId?: string; accentColor?: string } = {}) {
  const { theme, isDark } = useTheme();
  const styles = useStadiumStyles();
  const [selectedTeam, setSelectedTeam] = useState(propTeamId || DEFAULT_TEAM_ID);
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const { width: screenWidth } = useWindowDimensions();
  const tabScrollRef = useRef<ScrollView>(null);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const tabInnerScrollRefs = useRef<Record<string, ScrollView | null>>({});
  const scrollLockUntilRef = useRef<number>(0);
  const outerScrollLockRef = useRef(0);
  const scrollLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const releaseScroll = useCallback(() => {
    outerScrollLockRef.current = 0;
    tabScrollRef.current?.setNativeProps({ scrollEnabled: true });
    if (scrollLockTimerRef.current) {
      clearTimeout(scrollLockTimerRef.current);
      scrollLockTimerRef.current = null;
    }
  }, []);

  const handleMapTouchStart = useCallback(() => {
    outerScrollLockRef.current += 1;
    tabScrollRef.current?.setNativeProps({ scrollEnabled: false });
    if (scrollLockTimerRef.current) clearTimeout(scrollLockTimerRef.current);
    scrollLockTimerRef.current = setTimeout(() => {
      releaseScroll();
    }, 3000);
  }, [releaseScroll]);

  const handleMapTouchEnd = useCallback(() => {
    outerScrollLockRef.current = Math.max(0, outerScrollLockRef.current - 1);
    if (outerScrollLockRef.current === 0) releaseScroll();
  }, [releaseScroll]);

  const handleMapTouchCancel = useCallback(() => {
    outerScrollLockRef.current = Math.max(0, outerScrollLockRef.current - 1);
    if (outerScrollLockRef.current === 0) releaseScroll();
  }, [releaseScroll]);

  const handleInnerScrollBeginDrag = useCallback(() => {
    outerScrollLockRef.current += 1;
    tabScrollRef.current?.setNativeProps({ scrollEnabled: false });
    if (scrollLockTimerRef.current) clearTimeout(scrollLockTimerRef.current);
    scrollLockTimerRef.current = setTimeout(() => {
      releaseScroll();
    }, 3000);
  }, [releaseScroll]);

  const handleInnerScrollEnd = useCallback(() => {
    outerScrollLockRef.current = Math.max(0, outerScrollLockRef.current - 1);
    if (outerScrollLockRef.current === 0) releaseScroll();
  }, [releaseScroll]);

  const handleSetFocusedSpot = useCallback((spotId: string | undefined) => {
    scrollLockUntilRef.current = Date.now() + 300;
    setFocusedSpot(spotId);
  }, []);

  const handleTabPress = useCallback((tabId: TabId) => {
    setActiveTab(tabId);
    const idx = TABS.findIndex(t => t.id === tabId);
    tabScrollRef.current?.scrollTo({ x: idx * screenWidth, animated: true });
  }, [screenWidth]);

  const handleMomentumScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (Date.now() < scrollLockUntilRef.current) return;
    if (outerScrollLockRef.current > 0) return;
    const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    if (idx >= 0 && idx < TABS.length) {
      const newTabId = TABS[idx].id;
      if (newTabId !== activeTabRef.current) setActiveTab(newTabId);
    }
  }, [screenWidth]);

  useEffect(() => {
    if (propTeamId) setSelectedTeam(propTeamId);
  }, [propTeamId]);

  const stadiumId = TEAM_STADIUM_MAP[selectedTeam];

  const [stadium, setStadium] = useState<StadiumBrief | null>(() => stadiumId ? STADIUM_BRIEFS[stadiumId] ?? null : null);
  const [foods, setFoods] = useState<FoodPlace[]>(() => stadiumId ? STADIUM_FOODS[stadiumId] || [] : []);
  const [parking, setParking] = useState<SurroundingSpot[]>([]);
  const [transitSpots, setTransitSpots] = useState<SurroundingSpot[]>([]);
  const [nearby, setNearby] = useState<EatsSpot[]>([]);
  const [stadiumSpot, setStadiumSpot] = useState<SurroundingSpot | null>(null);
  const [surroundingsCenter, setSurroundingsCenter] = useState<number[]>([127, 37.5]);
  const [surroundingsZoom, setSurroundingsZoom] = useState(14.5);
  const [eatsCenter, setEatsCenter] = useState<number[]>([127, 37.5]);
  const [focusedSpot, setFocusedSpot] = useState<string | undefined>(undefined);
  const [foodLayouts, setFoodLayouts] = useState<Record<string, any> | null>(null);

  const [foodFloor, setFoodFloor] = useState("");
  const [foodCategory, setFoodCategory] = useState("all");
  const [selectedShop, setSelectedShop] = useState("");

  const load = useCallback(() => {
    let cancelled = false;
    const sid = TEAM_STADIUM_MAP[selectedTeam];
    if (!sid) return;

    setStadium(STADIUM_BRIEFS[sid] || null);
    setFoods(STADIUM_FOODS[sid] || []);

    const coords = STADIUM_COORDINATES[sid];
    const localParking: SurroundingSpot[] = (STADIUM_PARKING[sid] || []).map((p, i) => ({
      id: `parking-${i}`, name: p.name, description: p.description, kind: "parking",
      lng: p.lng ?? 0, lat: p.lat ?? 0,
    }));
    setParking(localParking);

    const localNearby: EatsSpot[] = (STADIUM_NEARBY[sid] || []).map((r) => ({
      name: r.name, cat: r.category, category: r.category,
      address: r.address, phone: r.phone || "",
      lng: r.lng ?? 0, lat: r.lat ?? 0,
    }));
    setNearby(localNearby);

    setTransitSpots(TRANSIT_STOPS[sid] || []);

    if (coords) {
      setSurroundingsCenter([coords.lng, coords.lat]);
      setEatsCenter([coords.lng, coords.lat]);
      setSurroundingsZoom(14.5);
      setStadiumSpot({
        id: "stadium",
        name: STADIUM_BRIEFS[sid]?.name || "구장",
        description: "",
        kind: "stadium",
        lng: coords.lng,
        lat: coords.lat,
      });
    }

    fetch(`${IMAGE_BASE}/data/food-layouts.json`).then((r) => r.ok ? r.json() : null)
      .then((layouts) => { if (!cancelled && layouts) setFoodLayouts(layouts); })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [selectedTeam]);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  useEffect(() => { setFocusedSpot(undefined); }, [activeTab]);

  useEffect(() => {
    if (focusedSpot) {
      tabInnerScrollRefs.current[activeTab]?.scrollTo({ y: 0, animated: true });
    }
  }, [focusedSpot, activeTab]);

  useEffect(() => {
    return () => {
      if (scrollLockTimerRef.current) clearTimeout(scrollLockTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setActiveTab("info");
    tabScrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [selectedTeam]);

  const teamColor = TEAM_COLORS[selectedTeam];
  const accent = accentColor || teamPrimaryColor(selectedTeam, isDark) || theme.primary;

  return (
    <View style={styles.container}>
      {!propTeamId && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🏟️ 구장안내</Text>
        </View>
      )}

      {!propTeamId ? (
        <View style={styles.teamGrid}>
          {TEAM_LIST.map((team) => (
            <Pressable
              key={team.id}
              onPress={() => { setSelectedTeam(team.id); setActiveTab("info"); }}
              style={[
                styles.teamItem,
                selectedTeam === team.id && { backgroundColor: teamPrimaryColor(team.id, isDark) + "20", borderColor: teamPrimaryColor(team.id, isDark) },
              ]}
            >
              <TeamBadge teamId={team.id} size="sm" />
              <Text style={[styles.teamName, selectedTeam === team.id && { color: teamPrimaryColor(team.id, isDark), fontWeight: "700" }]}>
                {team.shortName}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.teamBar}>
          <TeamBadge teamId={selectedTeam} size="md" />
          <View style={styles.teamBarInfo}>
            <Text style={styles.teamBarName}>{teamColor?.name || selectedTeam}</Text>
            {stadium && <Text style={styles.teamBarStadium}>{stadium.name}</Text>}
          </View>
        </View>
      )}

      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => handleTabPress(tab.id)}
            style={[styles.tab, activeTab === tab.id && { borderBottomColor: accent, borderBottomWidth: 2 }]}
          >
            <Text style={[styles.tabText, activeTab === tab.id && { color: accent, fontWeight: "700" }]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
          ref={tabScrollRef}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          style={{ flex: 1 }}
        >
          {TABS.map((tab) => (
            <View key={tab.id} style={{ width: screenWidth }}>
              <ScrollView
                ref={(el) => { tabInnerScrollRefs.current[tab.id] = el; }}
                onScrollBeginDrag={handleInnerScrollBeginDrag}
                onScrollEndDrag={handleInnerScrollEnd}
                onMomentumScrollEnd={handleInnerScrollEnd}
              >
                {tab.id === "info" && (
                  <InfoTab stadiumId={stadiumId} brief={stadium} teamColor={teamColor} selectedTeam={selectedTeam} />
                )}
                {tab.id === "food" && (
                  <FoodTab
                    stadiumId={stadiumId}
                    foods={foods}
                    foodFloor={foodFloor}
                    setFoodFloor={setFoodFloor}
                    foodCategory={foodCategory}
                    setFoodCategory={setFoodCategory}
                    selectedShop={selectedShop}
                    setSelectedShop={setSelectedShop}
                    foodLayouts={foodLayouts}
                    accentColor={accent}
                  />
                )}
                {tab.id === "parking" && (
                  <ParkingTab
                    brief={stadium}
                    parkingSpots={parking}
                    focusedSpot={focusedSpot}
                    setFocusedSpot={handleSetFocusedSpot}
                    surroundingsCenter={surroundingsCenter}
                    surroundingsZoom={Math.max(surroundingsZoom - 1, 10)}
                    onMapTouchStart={handleMapTouchStart}
                    onMapTouchEnd={handleMapTouchEnd}
                    onMapTouchCancel={handleMapTouchCancel}
                  />
                )}
                {tab.id === "transport" && (
                  <TransportTab
                    brief={stadium}
                    transitSpots={transitSpots}
                    focusedSpot={focusedSpot}
                    setFocusedSpot={handleSetFocusedSpot}
                    surroundingsCenter={surroundingsCenter}
                    surroundingsZoom={Math.max(surroundingsZoom - 1, 10)}
                    onMapTouchStart={handleMapTouchStart}
                    onMapTouchEnd={handleMapTouchEnd}
                    onMapTouchCancel={handleMapTouchCancel}
                  />
                )}
                {tab.id === "nearby" && (
                  <NearbyTab
                    nearby={nearby}
                    stadiumSpot={stadiumSpot}
                    focusedSpot={focusedSpot}
                    setFocusedSpot={handleSetFocusedSpot}
                    eatsCenter={eatsCenter}
                    onMapTouchStart={handleMapTouchStart}
                    onMapTouchEnd={handleMapTouchEnd}
                    onMapTouchCancel={handleMapTouchCancel}
                  />
                )}
              </ScrollView>
            </View>
          ))}
        </ScrollView>
    </View>
  );
}
