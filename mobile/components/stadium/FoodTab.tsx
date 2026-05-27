import { View, Text, Pressable, Image, ScrollView, StyleSheet } from "react-native";
import Svg, { Line } from "react-native-svg";
import { FOOD_CATEGORIES } from "@/lib/stadiumData";
import type { FoodPlace } from "@/lib/api";
import { useTheme } from "@/lib/ThemeContext";
import { FOOD_MAP_IMAGES, FOOD_MAP_ASPECT_RATIOS, IMAGE_BASE, uniqueFloors, categoryKey, CATEGORY_ORDER, getLabelCoords, getLabelPositionStyle, isRightAnchor } from "./stadiumHelpers";
import { useStadiumStyles } from "./stadiumStyles";

export default function FoodTab({ stadiumId, foods, foodFloor, setFoodFloor, foodCategory, setFoodCategory, selectedShop, setSelectedShop, foodLayouts, accentColor }: {
  stadiumId: string; foods: FoodPlace[];
  foodFloor: string; setFoodFloor: (f: string) => void;
  foodCategory: string; setFoodCategory: (c: string) => void;
  selectedShop: string; setSelectedShop: (s: string) => void;
  foodLayouts: Record<string, any> | null;
  accentColor?: string;
}) {
  const { theme } = useTheme();
  const styles = useStadiumStyles();
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

  const resolvePos = (food: FoodPlace, idx: number) => {
    if (food.leftPct != null && food.topPct != null) {
      return { leftPct: food.leftPct, topPct: food.topPct, labelDirection: food.labelDirection, _i: food._i };
    }
    if (!foodLayouts) return null;
    const floorKey = String(food.floor || "기타").trim();
    const catKey = categoryKey(food);
    const i = food._i ?? idx;
    const bucket = foodLayouts.stadiums?.[stadiumId]?.floors?.[floorKey];
    if (!bucket) return null;
    const entry = bucket[catKey]?.[String(i)] || bucket.all?.[String(i)];
    if (entry?.leftPct != null && entry?.topPct != null) {
      return { leftPct: entry.leftPct, topPct: entry.topPct, labelDirection: entry.labelDirection, _i: i };
    }
    return null;
  };

  return (
    <View style={styles.tabContent}>
      {foods.length > 0 ? (
        <>
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
                    const pos = resolvePos(food, i);
                    if (!pos) return null;
                    const cat = categoryKey(food);
                    const coords = getLabelCoords(pos.leftPct, pos.topPct, pos.labelDirection, foodLayouts, stadiumId, currentFloor, cat, pos._i);
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
                  const pos = resolvePos(food, i);
                  if (!pos) return null;
                  const cat = categoryKey(food);
                  const coords = getLabelCoords(pos.leftPct, pos.topPct, pos.labelDirection, foodLayouts, stadiumId, currentFloor, cat, pos._i);
                  const catColor = FOOD_CATEGORIES[cat]?.color || "#6b7280";
                  const isSelected = selectedShop === food.shop;
                  return (
                    <View key={`pin-${i}`} style={StyleSheet.absoluteFill} pointerEvents="box-none">
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
