import { useState, useMemo } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Linking } from "react-native";
import BottomSheet from "@/components/BottomSheet";
import { useTheme } from "@/lib/ThemeContext";
import { TICKET_PRICES } from "@/lib/ticketPrices";
import { TEAM_COLORS } from "@shared/teamColors";

const REPORT_URL = "https://report.prosports.or.kr/report/";

type Step = "team" | "seats";

interface TeamOption {
  teamId: string;
  teamName: string;
  hexColor: string;
}

const TEAMS: TeamOption[] = Object.entries(TICKET_PRICES).map(([id, data]) => ({
  teamId: id,
  teamName: data.teamName,
  hexColor: TEAM_COLORS[id]?.primary || "#666",
}));

export default function TicketReportModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const [step, setStep] = useState<Step>("team");
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  const teamData = selectedTeam ? TICKET_PRICES[selectedTeam] : null;

  const handleSelectTeam = (teamId: string) => {
    setSelectedTeam(teamId);
    setStep("seats");
  };

  const handleBack = () => {
    setStep("team");
    setSelectedTeam(null);
  };

  const handleReport = () => {
    Linking.openURL(REPORT_URL);
  };

  // Group seats by category
  const groupedSeats = useMemo(() => {
    if (!teamData) return [];
    const groups = new Map<string, typeof teamData.seats>();
    for (const seat of teamData.seats) {
      const existing = groups.get(seat.category) || [];
      existing.push(seat);
      groups.set(seat.category, existing);
    }
    return [...groups.entries()];
  }, [teamData]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      paddingBottom: 32,
      minHeight: 400,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    backBtn: {
      paddingVertical: 6,
      paddingRight: 12,
    },
    backText: {
      fontSize: 16,
      fontWeight: "600",
    },
    title: {
      fontSize: 18,
      fontWeight: "bold",
      textAlign: "center",
      flex: 1,
    },
    subtitle: {
      fontSize: 12,
      color: theme.mutedForeground,
      textAlign: "center",
      marginBottom: 20,
    },

    // Team list
    teamItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 8,
      backgroundColor: theme.card,
    },
    teamDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: 12,
    },
    teamName: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.foreground,
    },

    // Seats
    categoryGroup: {
      marginBottom: 20,
    },
    categoryTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.mutedForeground,
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    seatItem: {
      backgroundColor: theme.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 12,
      marginBottom: 6,
    },
    seatNameRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    seatName: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.foreground,
      flex: 1,
    },
    seatNote: {
      fontSize: 11,
      color: theme.mutedForeground,
    },
    priceRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 6,
      gap: 6,
    },
    priceTag: {
      fontSize: 12,
      color: theme.secondaryForeground,
      backgroundColor: theme.secondary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },

    // Report button
    reportBtn: {
      backgroundColor: theme.destructive || "#e53935",
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 8,
    },
    reportBtnText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
    },
  }), [theme]);

  const teamColor = selectedTeam ? (TEAM_COLORS[selectedTeam]?.primary || theme.primary) : theme.primary;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.container}>
        {step === "team" ? (
          <>
            <Text style={[styles.title, { color: theme.foreground }]}>암표 신고</Text>
            <Text style={styles.subtitle}>
              관람한 경기 구단을 선택한 후{'\n'}앉았던 좌석의 정가를 확인하세요
            </Text>
            <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
              {TEAMS.map((team) => (
                <Pressable
                  key={team.teamId}
                  style={styles.teamItem}
                  onPress={() => handleSelectTeam(team.teamId)}
                >
                  <View style={[styles.teamDot, { backgroundColor: team.hexColor }]} />
                  <Text style={styles.teamName}>{team.teamName}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : (
          <>
            <View style={styles.headerRow}>
              <Pressable onPress={handleBack} style={styles.backBtn}>
                <Text style={[styles.backText, { color: teamColor }]}>← 뒤로</Text>
              </Pressable>
              <Text style={[styles.title, { color: theme.foreground }]}>
                {teamData?.teamName || ""}
              </Text>
              <View style={{ width: 50 }} />
            </View>
            <Text style={styles.subtitle}>
              좌석 등급: {teamData?.tierNames.join(" / ")}
            </Text>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {groupedSeats.map(([category, seats]) => (
                <View key={category} style={styles.categoryGroup}>
                  <Text style={styles.categoryTitle}>{category}</Text>
                  {seats.map((seat, i) => (
                    <View key={i} style={styles.seatItem}>
                      <View style={styles.seatNameRow}>
                        <Text style={styles.seatName}>{seat.name}</Text>
                        {seat.note && <Text style={styles.seatNote}>{seat.note}</Text>}
                      </View>
                      <View style={styles.priceRow}>
                        {seat.prices.map((price, pi) => {
                          const tier = teamData?.tierNames[pi];
                          const priceStr = price > 0 ? `${price.toLocaleString()}원` : "무료";
                          return (
                            <Text key={pi} style={styles.priceTag}>
                              {tier ? `${tier} ` : ""}{priceStr}
                            </Text>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
            <Pressable style={styles.reportBtn} onPress={handleReport}>
              <Text style={styles.reportBtnText}>프로스포츠협회 신고 바로가기</Text>
            </Pressable>
          </>
        )}
      </View>
    </BottomSheet>
  );
}
