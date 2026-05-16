import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Image, StyleSheet, ActivityIndicator, Linking } from "react-native";
import Svg, { Line } from "react-native-svg";
import { TEAM_COLORS, TEAM_LIST } from "@shared/teamColors";
import { TeamBadge } from "@/components/TeamBadge";
import StadiumMapView from "@/components/StadiumMapView";
import {
  fetchStadiumBrief, fetchStadiumFoods, fetchStadiumEats, fetchStadiumSurroundings,
} from "@/lib/api";
import type { StadiumBrief, FoodPlace, SurroundingSpot, EatsSpot } from "@/lib/api";
import { STADIUM_BRIEFS, TEAM_STADIUM_MAP, FOOD_CATEGORIES } from "@/lib/stadiumData";
import { getTicketPolicy } from "@/lib/ticketPolicy";
import { theme } from "@/lib/theme";

const IMAGE_BASE = "https://fullcount.kr";

function convertStadiumBrief(brief: StadiumBrief | null, local: StadiumBrief | undefined): StadiumBrief {
  if (!brief) return local!;
  if (!local) return brief;
  return { ...brief, name: local.name, capacity: local.capacity, location: local.location };
}

const TABS = [
  { id: "info", label: "기본정보" },
  { id: "food", label: "먹거리" },
  { id: "parking", label: "주차" },
  { id: "transport", label: "교통" },
  { id: "nearby", label: "주변맛집" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const SEAT_IMAGES: Record<string, string> = {
  "1": "jamsil", "2": "gochuck", "3": "incheon", "4": "suwon",
  "5": "daejeon", "6": "daegu", "7": "gwangju", "8": "sajik", "9": "changwon",
};

const FOOD_MAP_IMAGES: Record<string, string> = {
  "1": "jamsil", "2": "gochuck", "3": "incheon", "4": "suwon",
  "5": "daejeon", "6": "daegu", "7": "gwangju", "8": "busan", "9": "changwon",
};

const CATEGORY_ORDER = ["all", "chicken", "korean", "western", "cafe"];

// 8-direction label offsets (percentage points from pin position)
const DIRECTION_OFFSETS: Record<string, { dx: number; dy: number }> = {
  NW: { dx: -5.5, dy: -5.5 }, N: { dx: 0, dy: -6.5 }, NE: { dx: 5.5, dy: -5.5 },
  W: { dx: -6.5, dy: 0 },                                     E: { dx: 6.5, dy: 0 },
  SW: { dx: -5.5, dy: 5.5 },  S: { dx: 0, dy: 6.5 },  SE: { dx: 5.5, dy: 5.5 },
};

// Direction → label anchor transform (aligns label relative to its position point)
const DIRECTION_ANCHOR: Record<string, { x: number; y: number }> = {
  E: { x: 0, y: -0.5 }, W: { x: -1, y: -0.5 }, N: { x: -0.5, y: -1 }, S: { x: -0.5, y: 0 },
  NE: { x: 0, y: -1 }, NW: { x: -1, y: -1 }, SE: { x: 0, y: 0 }, SW: { x: -1, y: 0 },
};

function getLabelPositionStyle(direction: string, labelLeft: number, labelTop: number, text?: string): Record<string, any> {
  switch (direction) {
    case "E":
      return { left: `${labelLeft}%`, top: `${labelTop}%`, transform: [{ translateY: -7 }] };
    case "W":
      return { right: `${100 - labelLeft}%`, top: `${labelTop}%`, transform: [{ translateY: -7 }] };
    case "N":
      return { left: `${labelLeft}%`, bottom: `${100 - labelTop}%`, transform: [{ translateX: estimateHalfWidth(text) }] };
    case "S":
      return { left: `${labelLeft}%`, top: `${labelTop}%`, transform: [{ translateX: estimateHalfWidth(text) }] };
    case "NE":  return { left: `${labelLeft}%`, bottom: `${100 - labelTop}%` };
    case "NW":  return { right: `${100 - labelLeft}%`, bottom: `${100 - labelTop}%` };
    case "SE":  return { left: `${labelLeft}%`, top: `${labelTop}%` };
    case "SW":  return { right: `${100 - labelLeft}%`, top: `${labelTop}%` };
    default:    return { left: `${labelLeft}%`, top: `${labelTop}%` };
  }
}

function estimateHalfWidth(text?: string): number {
  if (!text) return 0;
  let w = 4; // paddingHorizontal 2px each side
  for (const ch of text) {
    w += ch.charCodeAt(0) > 127 ? 9 : 5.5;
  }
  return -Math.round(w / 2);
}

function isRightAnchor(direction: string): boolean {
  return direction === "W" || direction === "NW" || direction === "SW";
}

function getLabelCoords(
  leftPct: number, topPct: number,
  direction = "E",
  layouts?: Record<string, any> | null,
  stadiumId?: string, floor?: string, category?: string, idx?: number,
) {
  if (layouts && stadiumId && idx != null) {
    const floorKey = String(floor || "기타").trim();
    const bucket = layouts.stadiums?.[stadiumId]?.floors?.[floorKey];
    if (bucket) {
      const catKey = category && category !== "all" ? category : "all";
      const entry = bucket[catKey]?.[String(idx)] || bucket.all?.[String(idx)];
      if (entry?.labelDirection) {
        direction = entry.labelDirection;
      }
    }
  }
  const offset = DIRECTION_OFFSETS[direction] || DIRECTION_OFFSETS.E;
  return {
    left: leftPct,
    top: topPct,
    labelLeft: Math.min(100, Math.max(0, leftPct + offset.dx)),
    labelTop: Math.min(100, Math.max(0, topPct + offset.dy)),
    direction,
    anchor: DIRECTION_ANCHOR[direction] || DIRECTION_ANCHOR.E,
  };
}

// Hardcoded aspect ratios matching actual image dimensions (width/height)
// Pin coordinates are percentages tied to these exact ratios
const SEAT_ASPECT_RATIOS: Record<string, number> = {
  "1": 1008 / 1007, "2": 931 / 1125, "3": 1208 / 1125, "4": 958 / 1125,
  "5": 956 / 1125, "6": 1112 / 1125, "7": 1127 / 1125, "8": 927 / 1096, "9": 1005 / 1125,
};
const FOOD_MAP_ASPECT_RATIOS: Record<string, number> = {
  "1": 1182 / 1117, "2": 861 / 1117, "3": 1192 / 1117, "4": 919 / 1008,
  "5": 891 / 1117, "6": 1117 / 1117, "7": 1096 / 1098, "8": 830 / 975, "9": 979 / 1047,
};

function uniqueFloors(stores: FoodPlace[]): string[] {
  const set = new Set(stores.map((s) => s.floor || "기타"));
  return Array.from(set).sort((a, b) => {
    const na = parseFloat(a.replace(/[^0-9.]/g, "")) || 0;
    const nb = parseFloat(b.replace(/[^0-9.]/g, "")) || 0;
    if (na === nb) return a.localeCompare(b, "ko");
    return na - nb;
  });
}

function categoryKey(store: FoodPlace): string {
  const raw = (store.category || "cafe").trim();
  return raw in FOOD_CATEGORIES ? raw : "cafe";
}

export default function StadiumPage({ teamId: propTeamId, accentColor }: { teamId?: string; accentColor?: string } = {}) {
  const [selectedTeam, setSelectedTeam] = useState(propTeamId || "doosan");
  const [activeTab, setActiveTab] = useState<TabId>("info");

  // Sync internal state when parent changes the prop
  useEffect(() => {
    if (propTeamId) setSelectedTeam(propTeamId);
  }, [propTeamId]);

  const [stadium, setStadium] = useState<StadiumBrief | null>(null);
  const [foods, setFoods] = useState<FoodPlace[]>([]);
  const [parking, setParking] = useState<SurroundingSpot[]>([]);
  const [transitSpots, setTransitSpots] = useState<SurroundingSpot[]>([]);
  const [nearby, setNearby] = useState<EatsSpot[]>([]);
  const [stadiumSpot, setStadiumSpot] = useState<SurroundingSpot | null>(null);
  const [surroundingsCenter, setSurroundingsCenter] = useState<number[]>([127, 37.5]);
  const [surroundingsZoom, setSurroundingsZoom] = useState(14.5);
  const [eatsCenter, setEatsCenter] = useState<number[]>([127, 37.5]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [focusedSpot, setFocusedSpot] = useState<string | undefined>(undefined);
  const [foodLayouts, setFoodLayouts] = useState<Record<string, any> | null>(null);

  const [foodFloor, setFoodFloor] = useState("");
  const [foodCategory, setFoodCategory] = useState("all");
  const [selectedShop, setSelectedShop] = useState("");

  const load = useCallback(() => {
    let cancelled = false;
    const stadiumId = TEAM_STADIUM_MAP[selectedTeam];
    if (!stadiumId) return;

    setLoading(true);
    setError(false);

    Promise.all([
      fetchStadiumBrief(stadiumId),
      fetchStadiumFoods(stadiumId),
      fetchStadiumEats(stadiumId),
      fetchStadiumSurroundings(stadiumId),
      fetch(`${IMAGE_BASE}/data/food-layouts.json`).then((r) => r.ok ? r.json() : null),
    ]).then(([brief, foodData, eatsData, surroundings, layouts]) => {
      if (cancelled) return;
      const local = STADIUM_BRIEFS[stadiumId];
      setStadium(convertStadiumBrief(brief, local));
      if (foodData) {
        setFoods(foodData);
        const floors = uniqueFloors(foodData);
        if (floors.length > 0 && !floors.includes(foodFloor)) setFoodFloor(floors[0]);
      }
      if (eatsData) {
        setNearby(eatsData.spots.filter((s) => s.address));
        if (eatsData.center) setEatsCenter(eatsData.center);
      }
      if (surroundings) {
        const stadium = surroundings.spots.find((s) => s.kind === "stadium" || s.kind === "ballpark") || null;
        setStadiumSpot(stadium);
        setParking(surroundings.spots.filter((s) => s.kind === "parking" || s.kind === "stadium"));
        setTransitSpots(surroundings.spots.filter((s) => s.kind === "transit" || s.kind === "bus" || s.kind === "stadium"));
        if (surroundings.center) setSurroundingsCenter(surroundings.center);
        if (surroundings.zoom) setSurroundingsZoom(surroundings.zoom);
      }
      if (layouts) setFoodLayouts(layouts);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      const sid = TEAM_STADIUM_MAP[selectedTeam];
      setStadium(STADIUM_BRIEFS[sid] || null);
      setFoods([]);
      setNearby([]);
      setParking([]);
      setTransitSpots([]);
      setError(false);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedTeam]);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  useEffect(() => { setFocusedSpot(undefined); }, [activeTab]);

  const stadiumId = TEAM_STADIUM_MAP[selectedTeam];
  const teamColor = TEAM_COLORS[selectedTeam];
  const accent = accentColor || teamColor?.primary || theme.primary;

  return (
    <View style={styles.container}>
      {/* Page header — only when standalone (no parent tab) */}
      {!propTeamId && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🏟️ 구장안내</Text>
        </View>
      )}

      <ScrollView>
        {/* Team selector — grid when standalone, badge bar when controlled by parent */}
        {!propTeamId ? (
          <View style={styles.teamGrid}>
            {TEAM_LIST.map((team) => (
              <Pressable
                key={team.id}
                onPress={() => { setSelectedTeam(team.id); setActiveTab("info"); }}
                style={[
                  styles.teamItem,
                  selectedTeam === team.id && { backgroundColor: team.primary + "20", borderColor: team.primary },
                ]}
              >
                <TeamBadge teamId={team.id} size="sm" />
                <Text style={[styles.teamName, selectedTeam === team.id && { color: team.primary, fontWeight: "700" }]}>
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

        {/* Sub-tabs */}
        <View style={styles.tabRow}>
          {TABS.map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tab, activeTab === tab.id && { borderBottomColor: accent, borderBottomWidth: 2 }]}
            >
              <Text style={[styles.tabText, activeTab === tab.id && { color: accent, fontWeight: "700" }]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="large" color={accent} />
          </View>
        ) : error ? (
          <View style={styles.loadingRow}>
            <Text style={styles.errorText}>정보를 불러올 수 없습니다</Text>
            <Pressable onPress={load} style={styles.retryBtn}><Text style={styles.retryText}>재시도</Text></Pressable>
          </View>
        ) : (
          <>
            {activeTab === "info" && (
              <InfoTab stadiumId={stadiumId} brief={stadium} teamColor={teamColor} selectedTeam={selectedTeam} />
            )}
            {activeTab === "food" && (
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
            {activeTab === "parking" && (
              <ParkingTab
                brief={stadium}
                parkingSpots={parking}
                focusedSpot={focusedSpot}
                setFocusedSpot={setFocusedSpot}
                surroundingsCenter={surroundingsCenter}
                surroundingsZoom={Math.max(surroundingsZoom - 1, 10)}
              />
            )}
            {activeTab === "transport" && (
              <TransportTab
                brief={stadium}
                transitSpots={transitSpots}
                focusedSpot={focusedSpot}
                setFocusedSpot={setFocusedSpot}
                surroundingsCenter={surroundingsCenter}
                surroundingsZoom={Math.max(surroundingsZoom - 1, 10)}
              />
            )}
            {activeTab === "nearby" && (
              <NearbyTab
                nearby={nearby}
                stadiumSpot={stadiumSpot}
                focusedSpot={focusedSpot}
                setFocusedSpot={setFocusedSpot}
                eatsCenter={eatsCenter}
              />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* ====== Info Tab ====== */
function InfoTab({ stadiumId, brief, teamColor, selectedTeam }: {
  stadiumId: string; brief: StadiumBrief | null; teamColor: typeof TEAM_COLORS[string] | undefined; selectedTeam: string;
}) {
  const [ticketExpanded, setTicketExpanded] = useState(false);
  const ticketPolicy = getTicketPolicy(selectedTeam);
  const seatSlug = SEAT_IMAGES[stadiumId];

  if (!brief) return null;

  return (
    <View style={styles.tabContent}>
      {/* Stadium header */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>📍 구장명</Text>
          <Text style={styles.infoValue}>{brief.name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>📌 위치</Text>
          <Text style={styles.infoValue}>{brief.location}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>👥 수용인원</Text>
          <Text style={styles.infoValue}>{brief.capacity}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>🏠 홈팀</Text>
          <Text style={[styles.infoValue, { color: teamColor?.primary }]}>{brief.homeTeams}</Text>
        </View>
      </View>

      {/* Ticket info */}
      <View style={styles.infoCard}>
        <Text style={styles.sectionTitle}>🎫 예매 정보</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>구매처</Text>
          <Text style={styles.infoValue}>{brief.ticket.purchase}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>가격</Text>
          <Text style={styles.infoValue}>{brief.ticket.price}</Text>
        </View>
      </View>

      {/* Seat map image - exact aspect ratio */}
      {seatSlug && (
        <View style={styles.imageCard}>
          <Text style={styles.imageCardTitle}>좌석 배치도</Text>
          <View style={{ width: "100%", aspectRatio: SEAT_ASPECT_RATIOS[stadiumId] || 1 }}>
            <Image
              source={{ uri: `${IMAGE_BASE}/stadium-seats/${SEAT_IMAGES[stadiumId] || "jamsil"}.jpg` }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="stretch"
            />
          </View>
        </View>
      )}

      {/* Ticket policy */}
      {ticketPolicy && (
        <View style={styles.infoCard}>
          <Pressable onPress={() => setTicketExpanded(!ticketExpanded)} style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📋 예매 일정 ({ticketPolicy.name})</Text>
            <Text style={styles.sectionArrow}>{ticketExpanded ? "▲" : "▼"}</Text>
          </Pressable>
          {ticketExpanded && (
            <>
              {ticketPolicy.tiers.map((tier, i) => (
                <View key={i} style={styles.tierBlock}>
                  <View style={styles.tierRow}>
                    <Text style={styles.tierName}>{tier.name}</Text>
                    <Text style={styles.tierDetail}>
                      {tier.dDay != null ? `D-${Math.abs(tier.dDay)}` : "현장판매"}
                      {tier.time ? ` ${tier.time}` : ""}
                    </Text>
                  </View>
                  <View style={styles.tierMeta}>
                    {tier.seats && <Text style={styles.tierMetaText}>좌석: {tier.seats}</Text>}
                    {tier.maxTickets != null && <Text style={styles.tierMetaText}>최대 {tier.maxTickets}매</Text>}
                  </View>
                  {tier.note && <Text style={styles.tierNote}>{tier.note}</Text>}
                </View>
              ))}
              {ticketPolicy.platform && (
                <Text style={styles.ticketNote}>예매처: {ticketPolicy.platform}</Text>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

/* ====== Food Tab ====== */
function FoodTab({ stadiumId, foods, foodFloor, setFoodFloor, foodCategory, setFoodCategory, selectedShop, setSelectedShop, foodLayouts, accentColor }: {
  stadiumId: string; foods: FoodPlace[];
  foodFloor: string; setFoodFloor: (f: string) => void;
  foodCategory: string; setFoodCategory: (c: string) => void;
  selectedShop: string; setSelectedShop: (s: string) => void;
  foodLayouts: Record<string, any> | null;
  accentColor?: string;
}) {
  const floors = uniqueFloors(foods);
  const currentFloor = floors.includes(foodFloor) ? foodFloor : floors[0] || "";
  const filteredByFloor = foods.filter((s) => (s.floor || "기타") === currentFloor);
  const presentCats = new Set(filteredByFloor.map(categoryKey));
  const cats = CATEGORY_ORDER.filter((id) => id === "all" || presentCats.has(id));
  const currentCat = cats.includes(foodCategory) ? foodCategory : "all";
  const visible = currentCat === "all"
    ? filteredByFloor
    : filteredByFloor.filter((s) => categoryKey(s) === currentCat);

  const foodMapSlug = FOOD_MAP_IMAGES[stadiumId] || "jamsil";

  return (
    <View style={styles.tabContent}>
      {foods.length > 0 ? (
        <>
          {/* Floor tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {floors.map((f) => (
              <Pressable
                key={f}
                onPress={() => { setFoodFloor(f); setFoodCategory("all"); setSelectedShop(""); }}
                style={[styles.floorChip, f === currentFloor && { borderColor: accentColor || theme.primary, borderWidth: 2 }]}
              >
                <Text style={[styles.floorChipText, f === currentFloor && { color: theme.foreground, fontWeight: "600" }]}>
                  {f}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Category tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {cats.map((cat) => {
              const catInfo = cat === "all" ? { label: "전체", color: "" } : FOOD_CATEGORIES[cat];
              const isActive = cat === currentCat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => { setFoodCategory(cat); setSelectedShop(""); }}
                  style={[styles.catChip, isActive ? { backgroundColor: catInfo?.color || theme.foreground } : styles.catChipInactive]}
                >
                  <Text style={[styles.catChipText, isActive ? styles.catChipTextActive : styles.catChipTextInactive]}>
                    {catInfo?.label || cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Food map with SVG overlay - exact aspect ratio + 8-direction pin/labels */}
          {visible.length > 0 && (
            <View style={styles.foodMapOuter}>
              <View style={[styles.foodMapImgWrap, { aspectRatio: FOOD_MAP_ASPECT_RATIOS[stadiumId] || 1 }]}>
                <Image
                  source={{ uri: `${IMAGE_BASE}/food-maps/${foodMapSlug}.webp` }}
                  style={{ width: "100%", height: "100%", position: "absolute" }}
                  resizeMode="stretch"
                />
                <Svg style={{ width: "100%", height: "100%", position: "absolute" }} viewBox="0 0 100 100" preserveAspectRatio="none">
                  {visible.map((food, i) => {
                    if (food.leftPct == null || food.topPct == null) return null;
                    const cat = categoryKey(food);
                    const coords = getLabelCoords(food.leftPct, food.topPct, food.labelDirection, foodLayouts, stadiumId, currentFloor, cat, food._i);
                    const catColor = FOOD_CATEGORIES[cat]?.color || "#6b7280";
                    return (
                      <Line
                        key={`line-${i}`}
                        x1={`${coords.left}`} y1={`${coords.top}`}
                        x2={`${coords.labelLeft}`} y2={`${coords.labelTop}`}
                        stroke={catColor}
                        strokeWidth="0.3"
                        strokeLinecap="round"
                      />
                    );
                  })}
                </Svg>
                {visible.map((food, i) => {
                  if (food.leftPct == null || food.topPct == null) return null;
                  const cat = categoryKey(food);
                  const coords = getLabelCoords(food.leftPct, food.topPct, food.labelDirection, foodLayouts, stadiumId, currentFloor, cat, food._i);
                  const catColor = FOOD_CATEGORIES[cat]?.color || "#6b7280";
                  const isSelected = selectedShop === food.shop;
                  return (
                    <View key={`pin-${i}`} style={StyleSheet.absoluteFill} pointerEvents="box-none">
                      {/* Pin dot */}
                      <Pressable
                        onPress={() => setSelectedShop(isSelected ? "" : food.shop)}
                        style={{
                          position: "absolute", left: `${coords.left}%`, top: `${coords.top}%`,
                          width: 10, height: 10, borderRadius: 5,
                          backgroundColor: catColor,
                          borderWidth: 1.5, borderColor: "#fff",
                          transform: [{ translateX: -5 }, { translateY: -5 }],
                          zIndex: isSelected ? 20 : 10,
                        }}
                      />
                      {/* Label */}
                      <Pressable
                        onPress={() => setSelectedShop(isSelected ? "" : food.shop)}
                        style={{
                          position: "absolute",
                          ...getLabelPositionStyle(coords.direction, coords.labelLeft, coords.labelTop, food.shop),
                          paddingHorizontal: 2, paddingVertical: 0,
                          borderRadius: 4,
                          backgroundColor: isSelected ? catColor : "rgba(255,255,255,0.92)",
                          borderWidth: isSelected ? 1.5 : 0.5,
                          borderColor: isSelected ? catColor : catColor + "30",
                          zIndex: isSelected ? 20 : 10,
                        }}
                      >
                        <Text style={{ fontSize: 9, fontWeight: "500", color: isSelected ? "#fff" : "#222", textAlign: isRightAnchor(coords.direction) ? "right" : "left" }} numberOfLines={1}>
                          {food.shop}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Selected shop detail */}
          {selectedShop && (() => {
            const shopStores = visible.filter((s) => s.shop === selectedShop);
            if (!shopStores.length) return null;
            const store = shopStores[0];
            const cat = categoryKey(store);
            const catLabel = FOOD_CATEGORIES[cat]?.label || cat;
            const menus = Array.from(new Set(shopStores.map((s) => s.menu).filter(Boolean))).join(" / ");
            return (
              <View style={styles.shopDetail}>
                <View style={styles.shopDetailHeader}>
                  <Text style={styles.shopDetailName}>{selectedShop}</Text>
                  <View style={[styles.shopDetailBadge, { backgroundColor: FOOD_CATEGORIES[cat]?.color || "#6b7280" }]}>
                    <Text style={styles.shopDetailBadgeText}>{catLabel}</Text>
                  </View>
                </View>
                {menus ? <Text style={styles.shopDetailMenu}>{menus}</Text> : null}
                {shopStores.map((s, i) => (
                  <Text key={i} style={styles.shopDetailLoc}>{s.floor} · {s.zone}{s.standZone ? ` · ${s.standZone}` : ""}</Text>
                ))}
              </View>
            );
          })()}

          {/* Food shop chips */}
          <View style={styles.foodChips}>
            {(() => {
              const seen = new Set<string>();
              return visible.map((store) => {
                if (seen.has(store.shop)) return null;
                seen.add(store.shop);
                const cat = categoryKey(store);
                const catColor = FOOD_CATEGORIES[cat]?.color || "#6b7280";
                const isActive = selectedShop === store.shop;
                return (
                  <Pressable
                    key={store.shop}
                    onPress={() => setSelectedShop(isActive ? "" : store.shop)}
                    style={[styles.foodChip, isActive && { borderColor: catColor }]}
                  >
                    <View style={[styles.foodChipDot, { backgroundColor: catColor }]} />
                    <Text style={[styles.foodChipText, isActive && { color: catColor }]}>{store.shop}</Text>
                  </Pressable>
                );
              });
            })()}
          </View>
        </>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>아직 먹거리 정보가 없어요</Text>
        </View>
      )}
    </View>
  );
}

/* ====== Parking Tab ====== */
function ParkingTab({ brief, parkingSpots, focusedSpot, setFocusedSpot, surroundingsCenter, surroundingsZoom }: {
  brief: StadiumBrief | null; parkingSpots: SurroundingSpot[];
  focusedSpot: string | undefined; setFocusedSpot: (s: string | undefined) => void;
  surroundingsCenter: number[]; surroundingsZoom: number;
}) {
  return (
    <View style={styles.tabContent}>
      {brief && (
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>🅿️ 주차 안내</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>요금</Text>
            <Text style={styles.infoValue}>{brief.parking.fee}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>참고</Text>
            <Text style={styles.infoValue}>{brief.parking.note}</Text>
          </View>
        </View>
      )}
      {parkingSpots.length > 0 && (
        <StadiumMapView
          spots={parkingSpots}
          center={surroundingsCenter}
          zoom={surroundingsZoom}
          focusedSpotId={focusedSpot}
          onPinClick={(spotId) => setFocusedSpot(spotId)}
        />
      )}
      {parkingSpots.length > 0 ? (
        parkingSpots.map((spot, i) => (
          <Pressable key={i} onPress={() => setFocusedSpot(spot.id || String(i))}>
            <View style={styles.infoCard}>
              <Text style={styles.spotName}>{spot.name}</Text>
              {spot.description && <Text style={styles.spotDesc}>{spot.description}</Text>}
            </View>
          </Pressable>
        ))
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>아직 주차 정보가 없어요</Text>
        </View>
      )}
    </View>
  );
}

/* ====== Transport Tab ====== */
function TransportTab({ brief, transitSpots, focusedSpot, setFocusedSpot, surroundingsCenter, surroundingsZoom }: {
  brief: StadiumBrief | null; transitSpots: SurroundingSpot[];
  focusedSpot: string | undefined; setFocusedSpot: (s: string | undefined) => void;
  surroundingsCenter: number[]; surroundingsZoom: number;
}) {
  return (
    <View style={styles.tabContent}>
      {transitSpots.length > 0 && (
        <StadiumMapView
          spots={transitSpots}
          center={surroundingsCenter}
          zoom={surroundingsZoom}
          focusedSpotId={focusedSpot}
          onPinClick={(spotId) => setFocusedSpot(spotId)}
        />
      )}
      {transitSpots.length > 0 ? (
        transitSpots.map((spot, i) => (
          <Pressable key={i} onPress={() => setFocusedSpot(spot.id || String(i))}>
            <View style={styles.infoCard}>
              <Text style={styles.spotName}>{spot.name}</Text>
              {spot.description && <Text style={styles.spotDesc}>{spot.description}</Text>}
            </View>
          </Pressable>
        ))
      ) : (
        brief && (
          <View style={styles.infoCard}>
            <View style={styles.transitBlock}>
              <Text style={styles.transitIcon}>🚇</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.transitLabel}>지하철</Text>
                <Text style={styles.transitValue}>{brief.transit.subway}</Text>
              </View>
            </View>
            <View style={[styles.transitBlock, { marginTop: 12 }]}>
              <Text style={styles.transitIcon}>🚌</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.transitLabel}>버스</Text>
                <Text style={styles.transitValue}>{brief.transit.bus}</Text>
              </View>
            </View>
          </View>
        )
      )}
    </View>
  );
}

/* ====== Nearby Tab ====== */
function NearbyTab({ nearby, stadiumSpot, focusedSpot, setFocusedSpot, eatsCenter }: {
  nearby: EatsSpot[];
  stadiumSpot: SurroundingSpot | null;
  focusedSpot: string | undefined; setFocusedSpot: (s: string | undefined) => void;
  eatsCenter: number[];
}) {
  const mapSpots = [
    ...(stadiumSpot ? [stadiumSpot] : []),
    ...nearby.map((r, i) => ({
      id: String(i), lng: r.lng, lat: r.lat, name: r.name,
      description: `${r.cat} · ${r.address}`, kind: "parking",
    })),
  ];
  return (
    <View style={styles.tabContent}>
      {nearby.length > 0 && (
        <StadiumMapView
          spots={mapSpots}
          center={eatsCenter}
          zoom={13}
          focusedSpotId={focusedSpot}
          onPinClick={(spotId) => setFocusedSpot(spotId)}
        />
      )}
      {nearby.length > 0 ? (
        nearby.map((r, i) => (
          <Pressable key={i} onPress={() => setFocusedSpot(String(i))}>
            <View style={styles.infoCard}>
              <View style={styles.nearbyHeader}>
                <Text style={styles.spotName}>{r.name}</Text>
                <Text style={styles.nearbyCat}>{r.cat}</Text>
              </View>
              <Text style={styles.spotDesc}>{r.address}</Text>
              {r.phone && (
                <Pressable onPress={() => Linking.openURL(`tel:${r.phone}`)}>
                  <Text style={styles.phoneText}>{r.phone}</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        ))
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>아직 주변 맛집 정보가 없어요</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: theme.foreground },
  loadingRow: { paddingVertical: 60, alignItems: "center" },
  errorText: { color: theme.mutedForeground, fontSize: 14, marginBottom: 16 },
  retryBtn: { paddingVertical: 8, paddingHorizontal: 20, backgroundColor: theme.foreground, borderRadius: 16 },
  retryText: { color: theme.background, fontSize: 13, fontWeight: "600" },

  // Team selector
  teamGrid: {
    flexDirection: "row", flexWrap: "wrap", justifyContent: "center",
    paddingHorizontal: 12, gap: 8, marginBottom: 8,
  },
  teamItem: {
    width: 68, height: 80, justifyContent: "center", alignItems: "center",
    borderRadius: 14, borderWidth: 2, borderColor: theme.border,
    backgroundColor: theme.card, gap: 6,
  },
  teamName: { fontSize: 11, fontWeight: "600", color: theme.mutedForeground },

  // Team bar (controlled mode)
  teamBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: theme.card, borderRadius: 16,
    borderWidth: 1, borderColor: theme.border,
  },
  teamBarInfo: { flex: 1 },
  teamBarName: { fontSize: 16, fontWeight: "700", color: theme.foreground },
  teamBarStadium: { fontSize: 12, color: theme.mutedForeground, marginTop: 2 },

  // Sub-tabs
  tabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: theme.border, marginBottom: 8 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10 },
  tabText: { fontSize: 12, color: theme.mutedForeground, fontWeight: "500" },
  tabContent: { padding: 16, gap: 12, paddingBottom: 40 },

  // Info card
  infoCard: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 16 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, alignItems: "flex-start" },
  infoLabel: { fontSize: 13, color: theme.mutedForeground, width: 70 },
  infoValue: { fontSize: 13, color: theme.foreground, flex: 1, textAlign: "right" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: theme.foreground, flex: 1 },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  sectionArrow: { fontSize: 10, color: theme.mutedForeground, marginLeft: 8 },

  // Image card
  imageCard: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, overflow: "hidden" },
  imageCardTitle: { fontSize: 14, fontWeight: "600", color: theme.foreground, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  seatImage: { width: "100%", height: 200 },

  // Ticket tiers
  tierBlock: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border },
  tierRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tierName: { fontSize: 13, color: theme.foreground, fontWeight: "500", flex: 1 },
  tierDetail: { fontSize: 12, color: theme.mutedForeground },
  tierMeta: { flexDirection: "row", gap: 8, marginTop: 4 },
  tierMetaText: { fontSize: 11, color: theme.secondaryForeground },
  tierNote: { fontSize: 11, color: theme.mutedForeground, marginTop: 4, lineHeight: 15 },
  ticketNote: { fontSize: 11, color: theme.mutedForeground, marginTop: 8, lineHeight: 16 },

  // Food
  filterRow: { marginVertical: 2 },
  floorChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, marginRight: 8 },
  floorChipText: { fontSize: 12, color: theme.mutedForeground },
  catChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, marginRight: 8 },
  catChipInactive: { backgroundColor: theme.muted },
  catChipText: { fontSize: 12, fontWeight: "500" },
  catChipTextActive: { color: "#fff", fontWeight: "700" },
  catChipTextInactive: { color: theme.mutedForeground },

  // Food map
  foodMapOuter: {
    backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border,
    overflow: "hidden",
  },
  foodMapImgWrap: {
    width: "100%", position: "relative",
    overflow: "hidden",
  },

  // Shop detail
  shopDetail: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 16 },
  shopDetailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  shopDetailName: { fontSize: 14, fontWeight: "700", color: theme.foreground },
  shopDetailBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  shopDetailBadgeText: { fontSize: 10, color: "#fff", fontWeight: "600" },
  shopDetailMenu: { fontSize: 12, color: theme.secondaryForeground, marginBottom: 4, lineHeight: 18 },
  shopDetailLoc: { fontSize: 11, color: theme.mutedForeground, marginTop: 2 },

  // Food chips
  foodChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  foodChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
    backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
  },
  foodChipDot: { width: 8, height: 8, borderRadius: 4 },
  foodChipText: { fontSize: 11, fontWeight: "500", color: theme.foreground },

  // Parking / Nearby
  spotName: { fontSize: 14, fontWeight: "600", color: theme.foreground },
  spotDesc: { fontSize: 13, color: theme.secondaryForeground, marginTop: 4, lineHeight: 18 },
  mapLink: { marginTop: 8 },
  mapLinkText: { fontSize: 13, color: theme.info, fontWeight: "500" },

  // Transport
  transitBlock: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  transitIcon: { fontSize: 20 },
  transitLabel: { fontSize: 12, fontWeight: "600", color: theme.foreground, marginBottom: 2 },
  transitValue: { fontSize: 13, color: theme.secondaryForeground, lineHeight: 18 },

  // Nearby
  nearbyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nearbyCat: { fontSize: 11, color: theme.mutedForeground },
  phoneText: { fontSize: 13, color: theme.info, marginTop: 4 },

  // Empty
  emptyCard: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 32, alignItems: "center" },
  emptyText: { fontSize: 13, color: theme.mutedForeground },
});
