import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Switch,
  StyleSheet,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Linking } from "react-native";
import { TEAM_COLORS, TEAM_LIST } from "@shared/teamColors";
import { DEFAULT_TEAM_ID } from "@shared/constants";
import { TeamBadge } from "@/components/TeamBadge";

import { useTheme, teamPrimaryColor } from "@/lib/ThemeContext";
import { useTeam } from "@/lib/TeamContext";
import {
  getNickname,
  setNickname,
  getProfileImage,
  setProfileImage,
  getTeamDiaryStats,
  getWinRates,
} from "@/lib/db";

const PROFILE_CHARACTERS: { key: string; label: string }[] = [
  { key: "default", label: "기본" },
  { key: "neutral", label: "보통" },
  { key: "joyful", label: "기쁨" },
  { key: "sad", label: "슬픔" },
  { key: "angry", label: "화남" },
  { key: "furious", label: "대노" },
  { key: "shocked", label: "놀람" },
  { key: "determined", label: "불굴" },
];

export default function MyScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      paddingTop: 60,
      paddingHorizontal: 20,
      paddingBottom: 12,
    },

    // Tabs
    tabRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      marginHorizontal: 20,
      marginBottom: 8,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 10,
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: theme.foreground,
    },
    tabText: {
      fontSize: 14,
      color: theme.mutedForeground,
      fontWeight: "500",
    },
    tabTextActive: {
      color: theme.foreground,
      fontWeight: "700",
    },
    comingSoon: {
      color: theme.mutedForeground,
      fontSize: 14,
      textAlign: "center",
      paddingVertical: 32,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.foreground,
    },
    headerSub: {
      fontSize: 13,
      color: theme.mutedForeground,
      marginTop: 4,
    },
    section: {
      marginTop: 24,
      paddingHorizontal: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.foreground,
      marginBottom: 12,
    },
    subSectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.mutedForeground,
      marginBottom: 8,
    },
    myTeamHeader: {
      alignItems: "center",
      marginBottom: 16,
      gap: 8,
    },
    myTeamRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 12,
    },
    myTeamArrow: {
      fontSize: 22,
      color: theme.mutedForeground,
    },
    myTeamName: {
      fontSize: 18,
      fontWeight: "bold",
    },

    // Profile
    profileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    profileImage: {
      alignItems: "center",
      gap: 4,
    },
    changeText: {
      fontSize: 10,
      color: theme.mutedForeground,
    },
    profileInfo: {
      flex: 1,
    },
    nickname: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.foreground,
    },
    changeHint: {
      fontSize: 12,
      color: theme.mutedForeground,
      marginTop: 2,
    },
    noTeamProfile: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      borderStyle: "dashed",
      padding: 24,
      alignItems: "center",
    },
    noTeamProfileTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.foreground,
      marginBottom: 6,
    },
    noTeamProfileDesc: {
      fontSize: 12,
      color: theme.mutedForeground,
      lineHeight: 18,
      textAlign: "center",
    },

    // Win rate
    winRateCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    wrSubTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.mutedForeground,
      marginBottom: 8,
    },
    winRateRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    winRateTotal: {
      borderBottomWidth: 0,
      paddingTop: 12,
    },
    winRateLabel: {
      fontSize: 15,
      color: theme.mutedForeground,
    },
    winRateValue: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.foreground,
    },
    allWinRateRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 8,
    },
    allWinRateLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
    },
    allWinRateTeam: {
      fontSize: 13,
      color: theme.secondaryForeground,
    },
    allWinRatePct: {
      fontSize: 14,
      fontWeight: "700",
      width: 55,
      textAlign: "right",
    },
    allWinRateDetail: {
      fontSize: 11,
      color: theme.mutedForeground,
      width: 80,
      textAlign: "right",
    },

    // Placeholder
    placeholder: {
      color: theme.mutedForeground,
      fontSize: 13,
      textAlign: "center",
      paddingVertical: 32,
    },

    // Settings
    settingRow: {
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    settingLabel: {
      fontSize: 14,
      color: theme.foreground,
    },
    version: {
      color: theme.mutedForeground,
      fontSize: 12,
      textAlign: "center",
      marginTop: 24,
    },

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },
    modalContent: {
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 24,
      width: "100%",
      maxWidth: 340,
    },
    teamPickerModal: {
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 20,
      width: "100%",
      maxWidth: 340,
    },
    teamPickerGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 10,
    },
    teamPickerItem: {
      width: 72,
      height: 88,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 16,
      borderWidth: 2,
      borderColor: theme.border,
      gap: 6,
    },
    teamPickerName: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.mutedForeground,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.foreground,
      marginBottom: 16,
      textAlign: "center",
    },
    input: {
      backgroundColor: theme.muted,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      color: theme.foreground,
      marginBottom: 16,
    },
    modalButtons: {
      flexDirection: "row",
      gap: 12,
    },
    modalCancel: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: theme.secondary,
    },
    modalCancelText: {
      fontSize: 14,
      color: theme.mutedForeground,
    },
    modalSave: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: theme.foreground,
    },
    modalSaveText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.background,
    },
    charGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 12,
      marginBottom: 16,
    },
    charItem: {
      alignItems: "center",
      padding: 8,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.border,
      width: 70,
    },
    charName: {
      fontSize: 10,
      color: theme.mutedForeground,
      marginTop: 4,
    },
  }), [theme]);
  const { myTeam, setMyTeam } = useTeam();
  const [nickname, setNicknameState] = useState<string>("");
  const [profileImage, setProfileImageState] = useState<{ type: string; value: string } | null>(null);
  const [teamDiaryStats, setTeamDiaryStats] = useState<{
    overall: { total: number; wins: number; draws: number; losses: number; winRate: number };
    live: { total: number; wins: number; draws: number; losses: number; winRate: number } | null;
  } | null>(null);
  const [allWinRates, setAllWinRates] = useState<any[]>([]);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [showProfilePicker, setShowProfilePicker] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const router = useRouter();

  const loadData = useCallback(async () => {
    try {
      const nick = await getNickname();
      setNicknameState(nick ?? "");
      const profile = await getProfileImage();
      setProfileImageState(profile);

      if (myTeam) {
        const stats = await getTeamDiaryStats(myTeam);
        setTeamDiaryStats(stats);
      }
      const all = await getWinRates();
      setAllWinRates(all);
    } catch (e) {
      console.warn("my.tsx loadData failed", e);
    }
  }, [myTeam]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleTeamSelect = async (teamId: string) => {
    try {
      setMyTeam(teamId);
      const stats = await getTeamDiaryStats(teamId);
      setTeamDiaryStats(stats);
    } catch (e) {
      console.warn("my.tsx handleTeamSelect failed", e);
    }
  };

  const handleSaveNickname = async () => {
    const trimmed = nicknameInput.trim();
    if (!trimmed) return;
    try {
      await setNickname(trimmed);
      setNicknameState(trimmed);
      setShowNicknameModal(false);
    } catch (e) {
      console.warn("my.tsx handleSaveNickname failed", e);
    }
  };

  const handleSelectProfileChar = async (char: string) => {
    try {
      await setProfileImage("character", char);
      setProfileImageState({ type: "character", value: char });
      setShowProfilePicker(false);
    } catch (e) {
      console.warn("my.tsx handleSelectProfileChar failed", e);
    }
  };

  const myTeamColor = myTeam ? teamPrimaryColor(myTeam, isDark) : "#888";

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>설정</Text>
        <Text style={styles.headerSub}>응원팀 선택, 직관기록, 승률 통계</Text>
      </View>

      {/* My Team Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>내 응원팀</Text>
        <Pressable style={styles.myTeamRow} onPress={() => setShowTeamPicker(true)}>
          {myTeam ? (
            <>
              <TeamBadge teamId={myTeam} size="md" />
              <Text style={[styles.myTeamName, { color: myTeamColor, flex: 1 }]}>
                {TEAM_COLORS[myTeam]?.name}
              </Text>
            </>
          ) : (
            <Text style={[styles.myTeamName, { color: theme.mutedForeground, flex: 1 }]}>
              응원팀을 선택해주세요
            </Text>
          )}
          <Text style={styles.myTeamArrow}>›</Text>
        </Pressable>
      </View>

      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>프로필</Text>
        {myTeam ? (
          <View style={styles.profileRow}>
            <Pressable onPress={() => setShowProfilePicker(true)} style={styles.profileImage}>
              <TeamBadge
                teamId={myTeam}
                size="lg"
                emotion={(profileImage?.value as any) || "default"}
              />
              <Text style={styles.changeText}>변경</Text>
            </Pressable>
            <View style={styles.profileInfo}>
              <Pressable onPress={() => { setNicknameInput(nickname); setShowNicknameModal(true); }}>
                <Text style={styles.nickname}>{nickname || "닉네임 설정"}</Text>
                <Text style={styles.changeHint}>탭하여 변경</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.noTeamProfile}>
            <Text style={styles.noTeamProfileTitle}>⚾ 응원팀을 먼저 선택해주세요</Text>
            <Text style={styles.noTeamProfileDesc}>
              응원팀을 설정하면 나만의 프로필과{'\n'}직관 승률을 확인할 수 있어요
            </Text>
          </View>
        )}
      </View>

      {/* Win Rate Section */}
      {myTeam && teamDiaryStats && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>직관 승률</Text>

          {/* Overall */}
          <View style={styles.winRateCard}>
            <Text style={styles.wrSubTitle}>전체</Text>
            <View style={styles.winRateRow}>
              <Text style={styles.winRateLabel}>경기</Text>
              <Text style={styles.winRateValue}>{teamDiaryStats.overall.total}경기</Text>
            </View>
            <View style={styles.winRateRow}>
              <Text style={styles.winRateLabel}>승</Text>
              <Text style={[styles.winRateValue, { color: "#22c55e" }]}>{teamDiaryStats.overall.wins}승</Text>
            </View>
            <View style={styles.winRateRow}>
              <Text style={styles.winRateLabel}>무</Text>
              <Text style={styles.winRateValue}>{teamDiaryStats.overall.draws}무</Text>
            </View>
            <View style={styles.winRateRow}>
              <Text style={styles.winRateLabel}>패</Text>
              <Text style={[styles.winRateValue, { color: "#ef4444" }]}>{teamDiaryStats.overall.losses}패</Text>
            </View>
            <View style={[styles.winRateRow, styles.winRateTotal]}>
              <Text style={styles.winRateLabel}>승률</Text>
              <Text style={[styles.winRateValue, { color: myTeamColor, fontSize: 18 }]}>
                {(teamDiaryStats.overall.winRate * 100).toFixed(1)}%
              </Text>
            </View>
          </View>

          {/* Live only */}
          {teamDiaryStats.live && (
            <View style={[styles.winRateCard, { marginTop: 12 }]}>
              <Text style={styles.wrSubTitle}>직관</Text>
              <View style={styles.winRateRow}>
                <Text style={styles.winRateLabel}>경기</Text>
                <Text style={styles.winRateValue}>{teamDiaryStats.live.total}경기</Text>
              </View>
              <View style={styles.winRateRow}>
                <Text style={styles.winRateLabel}>승</Text>
                <Text style={[styles.winRateValue, { color: "#22c55e" }]}>{teamDiaryStats.live.wins}승</Text>
              </View>
              <View style={styles.winRateRow}>
                <Text style={styles.winRateLabel}>무</Text>
                <Text style={styles.winRateValue}>{teamDiaryStats.live.draws}무</Text>
              </View>
              <View style={styles.winRateRow}>
                <Text style={styles.winRateLabel}>패</Text>
                <Text style={[styles.winRateValue, { color: "#ef4444" }]}>{teamDiaryStats.live.losses}패</Text>
              </View>
              <View style={[styles.winRateRow, styles.winRateTotal]}>
                <Text style={styles.winRateLabel}>승률</Text>
                <Text style={[styles.winRateValue, { color: myTeamColor, fontSize: 18 }]}>
                  {(teamDiaryStats.live.winRate * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          )}

          {allWinRates.length > 0 && (
            <>
              <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>전체 구단 승률</Text>
              {allWinRates.map((wr) => {
                const teamColor = teamPrimaryColor(wr.teamId, isDark) || "#888";
                return (
                  <View key={wr.teamId} style={styles.allWinRateRow}>
                    <View style={styles.allWinRateLeft}>
                      <TeamBadge teamId={wr.teamId} size="sm" variant="ball" />
                      <Text style={styles.allWinRateTeam}>{TEAM_COLORS[wr.teamId]?.shortName}</Text>
                    </View>
                    <Text style={[styles.allWinRatePct, { color: teamColor }]}>
                      {(wr.winRate * 100).toFixed(1)}%
                    </Text>
                    <Text style={styles.allWinRateDetail}>
                      {wr.wins}승 {wr.draws}무 {wr.losses}패
                    </Text>
                  </View>
                );
              })}
            </>
          )}
        </View>
      )}

      {/* Display Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>화면 설정</Text>
        <View style={styles.settingRow}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={styles.settingLabel}>다크 모드</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: "#ddd", true: "#666" }}
              thumbColor={isDark ? theme.foreground : "#f4f3f4"}
            />
          </View>
        </View>
      </View>

      {/* App Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>정보</Text>
        <Pressable style={styles.settingRow} onPress={() => Linking.openURL("https://fullcount.kr/privacy")}>
          <Text style={styles.settingLabel}>개인정보처리방침</Text>
        </Pressable>
        <Pressable style={styles.settingRow} onPress={() => Linking.openURL("https://fullcount.kr/terms")}>
          <Text style={styles.settingLabel}>이용약관</Text>
        </Pressable>
        <Text style={styles.version}>v1.0.0</Text>
      </View>

      <View style={{ height: 40 }} />

      {/* Nickname Modal */}
      <Modal visible={showNicknameModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>닉네임 설정</Text>
            <TextInput
              style={styles.input}
              value={nicknameInput}
              onChangeText={setNicknameInput}
              placeholder="닉네임을 입력하세요"
              placeholderTextColor="#666"
              maxLength={20}
            />
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalCancel} onPress={() => setShowNicknameModal(false)}>
                <Text style={styles.modalCancelText}>취소</Text>
              </Pressable>
              <Pressable style={styles.modalSave} onPress={handleSaveNickname}>
                <Text style={styles.modalSaveText}>저장</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Team Picker Modal */}
      <Modal visible={showTeamPicker} transparent animationType="fade" onRequestClose={() => setShowTeamPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowTeamPicker(false)}>
          <View style={styles.teamPickerModal}>
            <Text style={styles.modalTitle}>응원팀 선택</Text>
            <View style={styles.teamPickerGrid}>
              {TEAM_LIST.map((team) => {
                const isSelected = myTeam === team.id;
                return (
                  <Pressable
                    key={team.id}
                    onPress={() => { handleTeamSelect(team.id); setShowTeamPicker(false); }}
                    style={[
                      styles.teamPickerItem,
                      isSelected && { backgroundColor: teamPrimaryColor(team.id, isDark) + "20", borderColor: teamPrimaryColor(team.id, isDark) },
                    ]}
                  >
                    <TeamBadge teamId={team.id} size="md" />
                    <Text style={[styles.teamPickerName, isSelected && { color: teamPrimaryColor(team.id, isDark), fontWeight: "700" }]}>
                      {team.shortName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Profile Character Picker Modal */}
      <Modal visible={showProfilePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>프로필 이미지 선택</Text>
            <View style={styles.charGrid}>
              {PROFILE_CHARACTERS.map((c) => (
                <Pressable
                  key={c.key}
                  onPress={() => handleSelectProfileChar(c.key)}
                  style={[
                    styles.charItem,
                    profileImage?.value === c.key && { borderColor: myTeamColor },
                  ]}
                >
                  <TeamBadge
                    teamId={myTeam || DEFAULT_TEAM_ID}
                    size="md"
                    emotion={c.key as any}
                  />
                  <Text style={styles.charName}>{c.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={[styles.modalSave, { flex: 0, alignSelf: "center", paddingHorizontal: 40 }]} onPress={() => setShowProfilePicker(false)}>
              <Text style={styles.modalSaveText}>확인</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

