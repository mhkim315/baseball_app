import { useState } from "react";
import { View, Text, Pressable, ScrollView, Linking } from "react-native";
import { useTheme } from "@/lib/ThemeContext";
import type { SurroundingSpot, EatsSpot } from "@/lib/api";
import StadiumMapView from "@/components/StadiumMapView";
import { NEARBY_CATEGORIES } from "./stadiumHelpers";
import { useStadiumStyles } from "./stadiumStyles";

export default function NearbyTab({ nearby, stadiumSpot, focusedSpot, setFocusedSpot, eatsCenter, onMapTouchStart, onMapTouchEnd, onMapTouchCancel }: {
  nearby: EatsSpot[];
  stadiumSpot: SurroundingSpot | null;
  focusedSpot: string | undefined; setFocusedSpot: (s: string | undefined) => void;
  eatsCenter: number[];
  onMapTouchStart?: () => void; onMapTouchEnd?: () => void; onMapTouchCancel?: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStadiumStyles();
  const [nearbyCategory, setNearbyCategory] = useState("all");
  const allCats = Array.from(new Set(nearby.map((r) => r.cat)));
  const currentCat = allCats.includes(nearbyCategory) ? nearbyCategory : "all";
  const visible = currentCat === "all" ? nearby : nearby.filter((r) => r.cat === currentCat);

  const mapSpots = [
    ...(stadiumSpot ? [stadiumSpot] : []),
    ...nearby.map((r, i) => ({
      id: String(i), lng: r.lng, lat: r.lat, name: r.name,
      description: `${r.cat} · ${r.address}`, kind: "parking",
      fillColor: NEARBY_CATEGORIES[r.cat]?.color,
    })),
  ];

  const handleItemPress = (name: string, address: string) => {
    const idx = nearby.findIndex((r) => r.name === name && r.address === address);
    if (idx >= 0) setFocusedSpot(String(idx));
  };

  const groups = allCats
    .filter((cat) => currentCat === "all" || cat === currentCat)
    .map((cat) => ({ category: cat, items: nearby.filter((r) => r.cat === cat) }))
    .filter((g) => g.items.length > 0);

  return (
    <View style={styles.tabContent}>
      {nearby.length > 0 && (
        <>
          {allCats.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              <Pressable
                key="all"
                onPress={() => setNearbyCategory("all")}
                style={[styles.catChip, currentCat === "all" ? { backgroundColor: theme.foreground } : styles.catChipInactive]}
              >
                <Text style={[styles.catChipText, currentCat === "all" ? styles.catChipTextActive : styles.catChipTextInactive]}>전체</Text>
              </Pressable>
              {allCats.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setNearbyCategory(cat)}
                  style={[styles.catChip, currentCat === cat ? { backgroundColor: NEARBY_CATEGORIES[cat]?.color || theme.foreground } : styles.catChipInactive]}
                >
                  <Text style={[styles.catChipText, currentCat === cat ? styles.catChipTextActive : styles.catChipTextInactive]}>
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <StadiumMapView
            spots={mapSpots}
            center={eatsCenter}
            zoom={13}
            focusedSpotId={focusedSpot}
            onPinClick={(spotId) => setFocusedSpot(spotId)}
            onTouchStart={onMapTouchStart}
            onTouchEnd={onMapTouchEnd}
            onTouchCancel={onMapTouchCancel}
          />

          {groups.map((group) => (
            <View key={group.category}>
              <Text style={styles.nearbySectionTitle}>
                {group.category} ({group.items.length})
              </Text>
              {group.items.map((r, i) => (
                <Pressable key={i} onPress={() => handleItemPress(r.name, r.address)}>
                  <View style={styles.infoCard}>
                    <View style={styles.nearbyHeader}>
                      <Text style={styles.spotName}>{r.name}</Text>
                      <View style={[styles.nearbyBadge, { backgroundColor: NEARBY_CATEGORIES[r.cat]?.color || "#6b7280" }]}>
                        <Text style={styles.nearbyBadgeText}>{r.cat}</Text>
                      </View>
                    </View>
                    <Text style={styles.spotDesc}>{r.address}</Text>
                    {r.phone && (
                      <Pressable onPress={() => Linking.openURL(`tel:${r.phone}`)}>
                        <Text style={styles.phoneText}>{r.phone}</Text>
                      </Pressable>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          ))}

          {allCats.length > 1 && (
            <View style={styles.foodChips}>
              {allCats.map((cat) => {
                const count = nearby.filter((r) => r.cat === cat).length;
                const catInfo = NEARBY_CATEGORIES[cat];
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setNearbyCategory(currentCat === cat ? "all" : cat)}
                    style={[styles.foodChip, currentCat === cat && { borderColor: catInfo?.color }]}
                  >
                    <View style={[styles.foodChipDot, { backgroundColor: catInfo?.color || "#6b7280" }]} />
                    <Text style={[styles.foodChipText, currentCat === cat && { color: catInfo?.color }]}>
                      {cat} {count}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}
      {nearby.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>아직 주변 맛집 정보가 없어요</Text>
        </View>
      )}
    </View>
  );
}
