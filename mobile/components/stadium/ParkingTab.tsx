import { View, Text, Pressable } from "react-native";
import { useTheme } from "@/lib/ThemeContext";
import type { StadiumBrief, SurroundingSpot } from "@/lib/api";
import StadiumMapView from "@/components/StadiumMapView";
import { useStadiumStyles } from "./stadiumStyles";

export default function ParkingTab({ brief, parkingSpots, focusedSpot, setFocusedSpot, surroundingsCenter, surroundingsZoom, onMapTouchStart, onMapTouchEnd, onMapTouchCancel }: {
  brief: StadiumBrief | null; parkingSpots: SurroundingSpot[];
  focusedSpot: string | undefined; setFocusedSpot: (s: string | undefined) => void;
  surroundingsCenter: number[]; surroundingsZoom: number;
  onMapTouchStart?: () => void; onMapTouchEnd?: () => void; onMapTouchCancel?: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStadiumStyles();
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
          onTouchStart={onMapTouchStart}
          onTouchEnd={onMapTouchEnd}
          onTouchCancel={onMapTouchCancel}
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
