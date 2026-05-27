import { useState } from "react";
import { View, Text, Pressable, Image } from "react-native";
import { teamPrimaryColor, useTheme } from "@/lib/ThemeContext";
import { getTicketPolicy } from "@/lib/ticketPolicy";
import type { StadiumBrief } from "@/lib/api";
import { IMAGE_BASE, SEAT_IMAGES, SEAT_ASPECT_RATIOS } from "./stadiumHelpers";
import { useStadiumStyles } from "./stadiumStyles";

export default function InfoTab({ stadiumId, brief, teamColor, selectedTeam }: {
  stadiumId: string; brief: StadiumBrief | null; teamColor: { name: string } | undefined; selectedTeam: string;
}) {
  const { theme, isDark } = useTheme();
  const styles = useStadiumStyles();
  const [ticketExpanded, setTicketExpanded] = useState(false);
  const ticketPolicy = getTicketPolicy(selectedTeam);
  const seatSlug = SEAT_IMAGES[stadiumId];

  if (!brief) return null;

  return (
    <View style={styles.tabContent}>
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
          <Text style={[styles.infoValue, { color: teamPrimaryColor(selectedTeam, isDark) }]}>{brief.homeTeams}</Text>
        </View>
      </View>

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
