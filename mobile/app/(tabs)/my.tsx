import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { TEAM_COLORS, TEAM_LIST } from "@shared/teamColors";
import { TeamBadge } from "@/components/TeamBadge";
import TeamSelector from "@/components/TeamSelector";
import JikgwanFeed from "@/components/JikgwanFeed";
import { theme } from "@/lib/theme";
import {
  getMyTeam,
  setMyTeam,
  getNickname,
  setNickname,
  getProfileImage,
  setProfileImage,
  getWinRate,
  getWinRates,
} from "@/lib/db";

const PROFILE_CHARACTERS = [
  "default", "determined", "joyful", "sad", "neutral",
];

export default function MyScreen() {
  const [myTeam, setMyTeamState] = useState<string | null>(null);
  const [nickname, setNicknameState] = useState<string>("");
  const [profileImage, setProfileImageState] = useState<{ type: string; value: string } | null>(null);
  const [myTeamWinRate, setMyTeamWinRate] = useState<{
    total: number;
    wins: number;
    draws: number;
    losses: number;
    winRate: number;
  } | null>(null);
  const [allWinRates, setAllWinRates] = useState<any[]>([]);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [showProfilePicker, setShowProfilePicker] = useState(false);
  const router = useRouter();

  const loadData = useCallback(async () => {
    const team = await getMyTeam();
    setMyTeamState(team);
    const nick = await getNickname();
    setNicknameState(nick ?? "");
    const profile = await getProfileImage();
    setProfileImageState(profile);

    if (team) {
      const wr = await getWinRate(team);
      setMyTeamWinRate(wr);
    }
    const all = await getWinRates();
    setAllWinRates(all);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTeamSelect = async (teamId: string) => {
    await setMyTeam(teamId);
    setMyTeamState(teamId);
    const wr = await getWinRate(teamId);
    setMyTeamWinRate(wr);
  };

  const handleSaveNickname = async () => {
    const trimmed = nicknameInput.trim();
    if (!trimmed) return;
    await setNickname(trimmed);
    setNicknameState(trimmed);
    setShowNicknameModal(false);
  };

  const handleSelectProfileChar = async (char: string) => {
    await setProfileImage("character", char);
    setProfileImageState({ type: "character", value: char });
    setShowProfilePicker(false);
  };

  const myTeamColor = myTeam ? TEAM_COLORS[myTeam]?.primary : "#888";

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MY</Text>
        <Text style={styles.headerSub}>응원팀 선택, 직관기록, 승률 통계</Text>
      </View>

      {/* My Team Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {myTeam ? "내 응원팀" : "응원팀을 선택해주세요"}
        </Text>
        {myTeam && (
          <View style={styles.myTeamHeader}>
            <TeamBadge teamId={myTeam} size="lg" />
            <Text style={[styles.myTeamName, { color: myTeamColor }]}>
              {TEAM_COLORS[myTeam]?.name}
            </Text>
          </View>
        )}
        <TeamSelector
          selectedTeam={myTeam}
          onSelect={handleTeamSelect}
        />
      </View>

      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>프로필</Text>
        <View style={styles.profileRow}>
          <Pressable onPress={() => setShowProfilePicker(true)} style={styles.profileImage}>
            <TeamBadge
              teamId={myTeam || "doosan"}
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
      </View>

      {/* Win Rate Section */}
      {myTeam && myTeamWinRate && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>직관 승률</Text>
          <View style={styles.winRateCard}>
            <View style={styles.winRateRow}>
              <Text style={styles.winRateLabel}>경기</Text>
              <Text style={styles.winRateValue}>{myTeamWinRate.total}경기</Text>
            </View>
            <View style={styles.winRateRow}>
              <Text style={styles.winRateLabel}>승</Text>
              <Text style={[styles.winRateValue, { color: "#22c55e" }]}>{myTeamWinRate.wins}승</Text>
            </View>
            <View style={styles.winRateRow}>
              <Text style={styles.winRateLabel}>무</Text>
              <Text style={styles.winRateValue}>{myTeamWinRate.draws}무</Text>
            </View>
            <View style={styles.winRateRow}>
              <Text style={styles.winRateLabel}>패</Text>
              <Text style={[styles.winRateValue, { color: "#ef4444" }]}>{myTeamWinRate.losses}패</Text>
            </View>
            <View style={[styles.winRateRow, styles.winRateTotal]}>
              <Text style={styles.winRateLabel}>승률</Text>
              <Text style={[styles.winRateValue, { color: myTeamColor, fontSize: 18 }]}>
                {(myTeamWinRate.winRate * 100).toFixed(1)}%
              </Text>
            </View>
          </View>

          {allWinRates.length > 0 && (
            <>
              <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>전체 구단 승률</Text>
              {allWinRates.map((wr) => {
                const teamColor = TEAM_COLORS[wr.teamId]?.primary || "#888";
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

      {/* Jikgwan Records */}
      <View style={styles.section}>
        <JikgwanFeed
          onTakePhoto={() => router.push("/jikgwan/camera")}
        />
      </View>

      {/* Community */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>커뮤니티</Text>
        <Pressable style={styles.settingRow} onPress={() => router.push("/community")}>
          <Text style={styles.settingLabel}>💬 커뮤니티 게시판</Text>
        </Pressable>
      </View>

      {/* Settings Placeholder */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>설정</Text>
        <Pressable style={styles.settingRow}>
          <Text style={styles.settingLabel}>개인정보처리방침</Text>
        </Pressable>
        <Pressable style={styles.settingRow}>
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

      {/* Profile Character Picker Modal */}
      <Modal visible={showProfilePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>프로필 이미지 선택</Text>
            <View style={styles.charGrid}>
              {PROFILE_CHARACTERS.map((char) => (
                <Pressable
                  key={char}
                  onPress={() => handleSelectProfileChar(char)}
                  style={[
                    styles.charItem,
                    profileImage?.value === char && { borderColor: myTeamColor },
                  ]}
                >
                  <TeamBadge
                    teamId={myTeam || "doosan"}
                    size="md"
                    emotion={char as any}
                  />
                  <Text style={styles.charName}>{char}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.modalCancel} onPress={() => setShowProfilePicker(false)}>
              <Text style={styles.modalCancelText}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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

  // Win rate
  winRateCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
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
});
