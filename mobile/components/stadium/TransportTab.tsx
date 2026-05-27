import { View, Text, Pressable } from "react-native";
import { useTheme } from "@/lib/ThemeContext";
import type { StadiumBrief, SurroundingSpot } from "@/lib/api";
import StadiumMapView from "@/components/StadiumMapView";
import { useStadiumStyles } from "./stadiumStyles";

export default function TransportTab({ brief, transitSpots, focusedSpot, setFocusedSpot, surroundingsCenter, surroundingsZoom, onMapTouchStart, onMapTouchEnd, onMapTouchCancel }: {
  brief: StadiumBrief | null; transitSpots: SurroundingSpot[];
  focusedSpot: string | undefined; setFocusedSpot: (s: string | undefined) => void;
  surroundingsCenter: number[]; surroundingsZoom: number;
  onMapTouchStart?: () => void; onMapTouchEnd?: () => void; onMapTouchCancel?: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStadiumStyles();
  return (
    <View style={styles.tabContent}>
      {transitSpots.length > 0 && (
        <StadiumMapView
          spots={transitSpots}
          center={surroundingsCenter}
          zoom={surroundingsZoom}
          focusedSpotId={focusedSpot}
          onPinClick={(spotId) => setFocusedSpot(spotId)}
          onTouchStart={onMapTouchStart}
          onTouchEnd={onMapTouchEnd}
          onTouchCancel={onMapTouchCancel}
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
