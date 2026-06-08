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
  const [selectedTier, setSelectedTier] = useState(0);

  const teamData = selectedTeam ? TICKET_PRICES[selectedTeam] : null;

  const handleSelectTeam = (teamId: string) => {
    setSelectedTeam(teamId);
    setSelectedTier(0);
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
      flex: 1,
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
    },
    headerTitle: {
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

    // Tier tabs
    tierRow: {
      flexDirection: "row",
      gap: 6,
    },
    tierTab: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    tierTabText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.mutedForeground,
      lineHeight: 18,
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
    <BottomSheet visible={visible} onClose={onClose} maxHeight="92%" fillHeight>
      <View style={styles.container}>
        {step === "team" ? (
          <>
            <Text style={[styles.title, { color: theme.foreground }]}>암표 신고</Text>
            <Text style={styles.subtitle}>
              관람한 경기 구단을 선택한 후{'\n'}앉았던 좌석의 정가를 확인하세요
            </Text>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
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
              <Text style={[styles.headerTitle, { color: theme.foreground }]}>
                {teamData?.teamName || ""}
              </Text>
              <View style={{ width: 50 }} />
            </View>
            {/* Tier tabs */}
            {teamData && teamData.tierNames.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.tierRow}>
                    {teamData.tierNames.map((tier, ti) => (
                      <Pressable
                        key={ti}
                        onPress={() => setSelectedTier(ti)}
                        style={[
                          styles.tierTab,
                          selectedTier === ti && {
                            borderColor: teamColor,
                            backgroundColor: teamColor + "18",
                          },
                        ]}
                      >
                        <Text style={[
                          styles.tierTabText,
                          selectedTier === ti && { color: teamColor },
                        ]}>
                          {tier}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {groupedSeats.map(([category, seats]) => (
                <View key={category} style={styles.categoryGroup}>
                  <Text style={styles.categoryTitle}>{category}</Text>
                  {seats.map((seat, i) => {
                    const price = seat.prices[selectedTier];
                    const priceStr = price > 0 ? `${price.toLocaleString()}원` : "무료";
                    return (
                      <View key={i} style={styles.seatItem}>
                        <View style={styles.seatNameRow}>
                          <Text style={styles.seatName}>{seat.name}</Text>
                          {seat.note && <Text style={styles.seatNote}>{seat.note}</Text>}
                        </View>
                        <Text style={{
                          fontSize: 16,
                          fontWeight: "700",
                          color: teamColor,
                          marginTop: 4,
                        }}>
                          {priceStr}
                        </Text>
                      </View>
                    );
                  })}
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
