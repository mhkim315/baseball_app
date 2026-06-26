import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Switch,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated,
} from "react-native";
import { useRouter, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { Linking } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TEAM_COLORS, TEAM_LIST } from "@shared/teamColors";
import { DEFAULT_TEAM_ID } from "@shared/constants";
import { TeamBadge } from "@/components/TeamBadge";

import { useTheme } from "@/lib/ThemeContext";
import { teamPrimaryColor } from "@shared/teamColors";
import { useTeam } from "@/lib/TeamContext";
import {
  getNickname,
  setNickname,
  getProfileImage,
  setProfileImage,
  getUnlockedEmotions,
  resetAllData,
  getAllTotems,
  addTotem,
  updateTotem,
  deleteTotem,
  getJikgwanRecords,
  getAllTotemStats,
  type Totem,
  type TotemWithStats,
} from "@/lib/db";
import { ALL_CHARACTERS } from "@/lib/emotions";
import type { CharacterEmotion } from "@/lib/emotions";
import YearInReview from "@/components/YearInReview";
import AchievementSection from "@/components/AchievementSection";
import AchievementModal from "@/components/AchievementModal";
import CollectionSection from "@/components/CollectionSection";
import CollectionModal from "@/components/CollectionModal";
import TotemSection from "@/components/TotemSection";
import EmojiPicker from "@/components/EmojiPicker";
import ColorPicker from "@/components/ColorPicker";
import CoachMark from "@/components/CoachMark";
import ShortcutPickerModal from "@/components/ShortcutPickerModal";
import SimpleAlert from "@/components/SimpleAlert";
import TicketReportModal from "@/components/TicketReportModal";
import { useKeyboardHeight } from "@/lib/hooks/useKeyboardHeight";
import { getMyCoachSeen, setMyCoachSeen, getVisitCount, getShortcut, setShortcut as saveShortcut } from "@/lib/db";
import { SHORTCUT_LABELS, type ShortcutType } from "@/lib/shortcutHelper";
import { updateWidgetPeriodic } from "@/widgets/updateWidget";

export default function MyScreen() {
  const insets = useSafeAreaInsets();
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
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [showProfilePicker, setShowProfilePicker] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showResetComplete, setShowResetComplete] = useState(false);
  const [showResetErrorAlert, setShowResetErrorAlert] = useState(false);
  const [showYearInReview, setShowYearInReview] = useState(false);
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [unlockedEmotions, setUnlockedEmotions] = useState<string[]>([]);
  const [widgetShowPreGame, setWidgetShowPreGame] = useState(true);
  const [widgetShowPostGame, setWidgetShowPostGame] = useState(true);
  const [widgetShowBackground, setWidgetShowBackground] = useState(true);
  const [lockScreenEnabled, setLockScreenEnabled] = useState(false);

  // Totem state
  const [totems, setTotems] = useState<TotemWithStats[]>([]);
  const [showTotemModal, setShowTotemModal] = useState(false);
  const [showTotemList, setShowTotemList] = useState(false);
  const [editingTotem, setEditingTotem] = useState<Totem | null>(null);
  const [totemName, setTotemName] = useState("");
  const [totemEmoji, setTotemEmoji] = useState("");
  const [totemDesc, setTotemDesc] = useState("");
  const [totemColor, setTotemColor] = useState("");
  const [showTotemDeleteConfirm, setShowTotemDeleteConfirm] = useState<Totem | null>(null);
  const [showTicketReport, setShowTicketReport] = useState(false);

  // ── Totem list spring animation ──
  const [totemRender, setTotemRender] = useState(false);
  const totemSlide = useRef(new Animated.Value(500)).current;
  const totemBackdrop = useRef(new Animated.Value(0)).current;

  const animateTotemIn = useCallback(() => {
    totemSlide.setValue(500); totemBackdrop.setValue(0);
    Animated.parallel([
      Animated.spring(totemSlide, { toValue: 0, useNativeDriver: true, tension: 50, friction: 9 }),
      Animated.timing(totemBackdrop, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [totemSlide, totemBackdrop]);

  const animateTotemOut = useCallback((cb?: () => void) => {
    Animated.parallel([
      Animated.timing(totemSlide, { toValue: 500, duration: 280, useNativeDriver: true }),
      Animated.timing(totemBackdrop, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => { setTotemRender(false); cb?.(); });
  }, [totemSlide, totemBackdrop]);

  useEffect(() => {
    if (showTotemList) { if (!totemRender) setTotemRender(true); else animateTotemIn(); }
    else if (totemRender) animateTotemOut();
  }, [showTotemList, totemRender, animateTotemIn, animateTotemOut]);

  const closeTotem = useCallback(() => animateTotemOut(() => setShowTotemList(false)), [animateTotemOut]);

  // ── Year in Review spring animation ──
  const [yrRender, setYrRender] = useState(false);
  const yrSlide = useRef(new Animated.Value(500)).current;
  const yrBackdrop = useRef(new Animated.Value(0)).current;

  const animateYrIn = useCallback(() => {
    yrSlide.setValue(500); yrBackdrop.setValue(0);
    Animated.parallel([
      Animated.spring(yrSlide, { toValue: 0, useNativeDriver: true, tension: 50, friction: 9 }),
      Animated.timing(yrBackdrop, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [yrSlide, yrBackdrop]);

  const animateYrOut = useCallback((cb?: () => void) => {
    Animated.parallel([
      Animated.timing(yrSlide, { toValue: 500, duration: 280, useNativeDriver: true }),
      Animated.timing(yrBackdrop, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => { setYrRender(false); cb?.(); });
  }, [yrSlide, yrBackdrop]);

  useEffect(() => {
    if (showYearInReview) { if (!yrRender) setYrRender(true); else animateYrIn(); }
    else if (yrRender) animateYrOut();
  }, [showYearInReview, yrRender, animateYrIn, animateYrOut]);

  const closeYr = useCallback(() => animateYrOut(() => setShowYearInReview(false)), [animateYrOut]);

  const { openAchievement } = useLocalSearchParams<{ openAchievement?: string }>();
  const reviewYear = new Date().getFullYear();
  const router = useRouter();

  useEffect(() => {
    if (openAchievement === "1") {
      setShowAchievementModal(true);
      router.replace("/my");
    }
  }, [openAchievement, router]);

  const loadData = useCallback(() => {
    try { const nick = getNickname(); setNicknameState(nick ?? ""); } catch (e) { console.warn("getNickname failed", e); }
    try { const profile = getProfileImage(); setProfileImageState(profile); } catch (e) { console.warn("getProfileImage failed", e); }
    try { const unlocked = getUnlockedEmotions(); setUnlockedEmotions(unlocked); } catch (e) { console.warn("getUnlockedEmotions failed", e); }
    try {
      const allRecords = getJikgwanRecords();
      const totemStats = getAllTotemStats(allRecords);
      setTotems(totemStats);
    } catch (e) {
      console.warn("getJikgwanRecords/getAllTotemStats failed", e);
    }
    AsyncStorage.getItem('widget_prefs').then(val => {
      if (val) {
        try {
          const p = JSON.parse(val);
          if (typeof p.showPreGame === 'boolean') setWidgetShowPreGame(p.showPreGame);
          if (typeof p.showPostGame === 'boolean') setWidgetShowPostGame(p.showPostGame);
          if (typeof p.showBackground === 'boolean') setWidgetShowBackground(p.showBackground);
        } catch {}
      }
    });
    AsyncStorage.getItem('lock_screen_notification_enabled').then(val => {
      setLockScreenEnabled(val === 'true');
    });
  }, []);

  const [shortcut, setShortcut] = useState<ShortcutType | null>(null);
  const [showShortcutPicker, setShowShortcutPicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
      try { setShortcut(getShortcut() as ShortcutType | null); } catch {}
      return () => { };
    }, [loadData])
  );

  // My tab coach mark: show once when first loaded with no totems
  const [showMyCoach, setShowMyCoach] = useState(false);
  const myCoachChecked = useRef(false);

  useEffect(() => {
    if (myCoachChecked.current) return;
    if (totems.length !== 0) return;
    try {
      if (!getMyCoachSeen()) {
        myCoachChecked.current = true;
        setShowMyCoach(true);
      } else {
        myCoachChecked.current = true;
      }
    } catch (e) { console.warn("coach: my", e); }
  }, [totems]);

  const handleShortcutSelect = (type: ShortcutType) => {
    saveShortcut(type);
    setShortcut(type);
    setShowShortcutPicker(false);
  };

  // Dismiss on navigation away
  const navigationMy = useNavigation();
  useEffect(() => {
    const unsubscribe = navigationMy.addListener("blur", () => {
      setShowMyCoach(false);
    });
    return unsubscribe;
  }, [navigationMy]);

  const handleTeamSelect = async (teamId: string) => {
    try {
      setMyTeam(teamId);
    } catch (e) {
      console.warn("my.tsx handleTeamSelect failed", e);
    }
  };

  const handleSaveNickname = () => {
    const trimmed = nicknameInput.trim();
    if (!trimmed) return;
    try {
      setNickname(trimmed);
      setNicknameState(trimmed);
      setShowNicknameModal(false);
    } catch (e) {
      console.warn("my.tsx handleSaveNickname failed", e);
    }
  };

  const handleSelectProfileChar = (char: string) => {
    try {
      setProfileImage("character", char);
      setProfileImageState({ type: "character", value: char });
      setShowProfilePicker(false);
    } catch (e) {
      console.warn("my.tsx handleSelectProfileChar failed", e);
    }
  };

  const saveWidgetPrefs = async (key: string, value: boolean) => {
    let current = { showPreGame: true, showPostGame: true, showBackground: true };
    try {
      const raw = await AsyncStorage.getItem('widget_prefs');
      if (raw) current = JSON.parse(raw);
    } catch {}
    const next = { ...current, [key]: value };
    if (key === 'showPreGame') setWidgetShowPreGame(value);
    else if (key === 'showPostGame') setWidgetShowPostGame(value);
    else if (key === 'showBackground') setWidgetShowBackground(value);
    await AsyncStorage.setItem('widget_prefs', JSON.stringify(next));
    try { updateWidgetPeriodic(); } catch {}
  };

  const toggleLockScreenNotification = async (val: boolean) => {
    setLockScreenEnabled(val);
    await AsyncStorage.setItem('lock_screen_notification_enabled', val ? 'true' : 'false');
  };

  const keyboardHeight = useKeyboardHeight();
  const myTeamColor = myTeam ? teamPrimaryColor(myTeam, isDark) : "#888";

  // Sort: basic (always unlocked) → unlocked non-basic → locked
  const sortedProfileChars = useMemo(() =>
    [...ALL_CHARACTERS].sort((a, b) => {
      const aGroup = a.basic ? 0 : unlockedEmotions.includes(a.id) ? 1 : 2;
      const bGroup = b.basic ? 0 : unlockedEmotions.includes(b.id) ? 1 : 2;
      return aGroup - bGroup;
    }),
    [unlockedEmotions],
  );

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MY</Text>
        <Text style={styles.headerSub}>프로필, 응원팀, 직관기록, 통계</Text>
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
          <>
          <View style={styles.profileRow}>
            <Pressable onPress={() => { setShowProfilePicker(true); }} style={styles.profileImage}>
              <TeamBadge
                teamId={myTeam}
                size="lg"
                emotion={(profileImage?.value as CharacterEmotion) || "default"}
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
          </>
        ) : (
          <View style={styles.noTeamProfile}>
            <Text style={styles.noTeamProfileTitle}>⚾ 응원팀을 먼저 선택해주세요</Text>
            <Text style={styles.noTeamProfileDesc}>
              응원팀을 설정하면 나만의 프로필과{'\n'}통계를 확인할 수 있어요
            </Text>
          </View>
        )}
      </View>

      {/* Display Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>설정</Text>
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
        <View style={styles.settingRow}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>실시간 점수 알림</Text>
              <Text style={{ fontSize: 11, color: theme.mutedForeground, marginTop: 2 }}>
                득점, 이닝 변경시
              </Text>
            </View>
            <Switch
              value={lockScreenEnabled}
              onValueChange={toggleLockScreenNotification}
              trackColor={{ false: "#ddd", true: "#666" }}
              thumbColor={lockScreenEnabled ? theme.foreground : "#f4f3f4"}
            />
          </View>
        </View>

        {Platform.OS === 'android' && (<View style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 12, color: theme.mutedForeground, marginBottom: 8 }}>
            위젯 · 경기중은 항상 표시됩니다
          </Text>
          <View style={styles.settingRow}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={styles.settingLabel}>경기전 표시</Text>
              <Switch
                value={widgetShowPreGame}
                onValueChange={v => saveWidgetPrefs('showPreGame', v)}
                trackColor={{ false: "#ddd", true: "#666" }}
                thumbColor={widgetShowPreGame ? theme.foreground : "#f4f3f4"}
              />
            </View>
          </View>
          <View style={styles.settingRow}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={styles.settingLabel}>경기후 표시</Text>
              <Switch
                value={widgetShowPostGame}
                onValueChange={v => saveWidgetPrefs('showPostGame', v)}
                trackColor={{ false: "#ddd", true: "#666" }}
                thumbColor={widgetShowPostGame ? theme.foreground : "#f4f3f4"}
              />
            </View>
          </View>
          <View style={styles.settingRow}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={styles.settingLabel}>배경 표시</Text>
              <Switch
                value={widgetShowBackground}
                onValueChange={v => saveWidgetPrefs('showBackground', v)}
                trackColor={{ false: "#ddd", true: "#666" }}
                thumbColor={widgetShowBackground ? theme.foreground : "#f4f3f4"}
              />
            </View>
          </View>
        </View>)}
      </View>

      {/* Year in Review */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>모아보기</Text>
        <Pressable
          style={[styles.myTeamRow, { gap: 12, marginBottom: 12 }]}
          onPress={() => { setShowYearInReview(true); }}
        >
          <Text style={{ fontSize: 28 }}>⚾</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: theme.foreground }}>
              {reviewYear} 시즌 리캡
            </Text>
            <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 2 }}>
              나의 야구 시즌을 돌아보기
            </Text>
          </View>
          <Text style={styles.myTeamArrow}>›</Text>
        </Pressable>

        <Pressable
          style={[styles.myTeamRow, { gap: 12, marginBottom: 12 }]}
          onPress={() => setShowTicketReport(true)}
        >
          <Text style={{ fontSize: 28 }}>🚫</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: theme.destructive || "#e53935" }}>
              암표 신고하기
            </Text>
            <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 2 }}>
              좌석 정가 확인 후 신고
            </Text>
          </View>
          <Text style={styles.myTeamArrow}>›</Text>
        </Pressable>

        <AchievementSection onPress={() => { setShowAchievementModal(true); }} />

        <CollectionSection onPress={() => { setShowCollectionModal(true); }} />

        <TotemSection onPress={() => { setShowMyCoach(false); setShowTotemList(true); }} totems={totems} />
        {showMyCoach && (
          <View style={{ marginTop: 8 }}>
            <CoachMark
              visible showChevrons={false} arrowDirection="up"
              text="나만의 승리 토템을 만들어보세요"
              onDismiss={() => { setMyCoachSeen(); setShowMyCoach(false); }}
            />
          </View>
        )}

        {/* Shortcut section */}
        <Pressable
          style={[styles.myTeamRow, { gap: 12, marginTop: 12 }]}
          onPress={() => { setShowShortcutPicker(true); }}
        >
          <Text style={{ fontSize: 28 }}>⚡</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: theme.foreground }}>나의 바로가기</Text>
            <Text style={{ fontSize: 12, color: theme.mutedForeground, marginTop: 2 }}>
              {shortcut !== null ? SHORTCUT_LABELS[shortcut] : "설정 안 함"}
            </Text>
          </View>
          <Text style={styles.myTeamArrow}>›</Text>
        </Pressable>
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
        <Pressable style={styles.settingRow} onPress={() => Linking.openURL("mailto:info@fullcount.kr?subject=풀카운트 문의")}>
          <Text style={styles.settingLabel}>문의하기</Text>
        </Pressable>
        <Text style={styles.version}>v{Constants.expoConfig?.version ?? "1.0.0"}</Text>
      </View>

      {/* Data Management */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>데이터 관리</Text>
        <Pressable style={styles.settingRow} onPress={() => setShowResetConfirm(true)}>
          <Text style={[styles.settingLabel, { color: "#e74c3c" }]}>모든 데이터 초기화</Text>
        </Pressable>
      </View>

      <View style={{ height: 40 }} />

      {/* Nickname Modal */}
      <Modal visible={showNicknameModal} transparent animationType="fade">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
        >
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
                <Pressable style={styles.modalCancel} onPress={() => setShowNicknameModal(false)} hitSlop={8}>
                  <Text style={styles.modalCancelText}>취소</Text>
                </Pressable>
                <Pressable style={styles.modalSave} onPress={handleSaveNickname}>
                  <Text style={styles.modalSaveText}>저장</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
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

      {/* Reset confirmation modal */}
      <Modal visible={showResetConfirm} transparent animationType="fade" onRequestClose={() => setShowResetConfirm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>데이터 초기화</Text>
            <Text style={{ fontSize: 14, color: theme.mutedForeground, marginBottom: 16, lineHeight: 20, textAlign: "center" }}>
              모든 직관기록, 사진, 지출내역, 설정이{'\n'}영구적으로 삭제됩니다.{'\n\n'}계속하시겠습니까?
            </Text>
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalCancel} onPress={() => setShowResetConfirm(false)} hitSlop={8}>
                <Text style={styles.modalCancelText}>취소</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSave, { backgroundColor: "#e74c3c" }]}
                onPress={async () => {
                  setShowResetConfirm(false);
                  try {
                    await resetAllData();
                    const { deleteAllPhotos } = await import("@/lib/camera");
                    await deleteAllPhotos();
                    setMyTeam(null);
                    setShowResetComplete(true);
                  } catch (e) {
                    console.warn("resetAllData failed", e);
                    setShowResetErrorAlert(true);
                  }
                }}
              >
                <Text style={styles.modalSaveText}>초기화</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reset complete modal */}
      <SimpleAlert
        visible={showResetComplete}
        title="완료"
        message="모든 데이터가 초기화되었습니다."
        confirmText="확인"
        onConfirm={() => { setShowResetComplete(false); router.replace("/onboarding"); }}
        onClose={() => { setShowResetComplete(false); router.replace("/onboarding"); }}
      />

      {/* Totem List Modal (create/edit/delete는 인라인 오버레이 — iOS Modal 중첩 버그 방지) */}
      <Modal visible={totemRender} transparent animationType="none" onRequestClose={closeTotem}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: totemBackdrop, backgroundColor: "rgba(0,0,0,0.7)" }]} />
          <Animated.View style={{ height: Dimensions.get("window").height * 0.85, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, borderColor: theme.border, padding: 24, paddingBottom: 40, backgroundColor: theme.card, transform: [{ translateY: totemSlide }] }}>
            {showTotemModal ? (
              <View style={{ flex: 1 }}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 + keyboardHeight }}>
                  <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.foreground, marginBottom: 8, textAlign: "center" }}>
                    {editingTotem ? "토템 수정" : "토템 추가"}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.mutedForeground, marginBottom: 16, textAlign: "center" }}>
                    {editingTotem ? "토템 정보를 수정하세요" : "나만의 승리 토템을 만들어보세요!"}
                  </Text>

                  <Text style={{ fontSize: 12, fontWeight: "600", color: theme.mutedForeground, marginBottom: 4 }}>이름 *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.muted, borderRadius: 12, padding: 14, fontSize: 16, color: theme.foreground, marginBottom: 16 }]}
                    value={totemName}
                    onChangeText={setTotemName}
                    placeholder="토템 이름"
                    placeholderTextColor="#666"
                    maxLength={30}
                  />

                  <Text style={{ fontSize: 12, fontWeight: "600", color: theme.mutedForeground, marginBottom: 4 }}>이모지</Text>
                  <EmojiPicker selected={totemEmoji} onSelect={setTotemEmoji} />

                  <Text style={{ fontSize: 12, fontWeight: "600", color: theme.mutedForeground, marginBottom: 4 }}>설명</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.muted, borderRadius: 12, padding: 14, fontSize: 16, color: theme.foreground, marginBottom: 16 }]}
                    value={totemDesc}
                    onChangeText={setTotemDesc}
                    placeholder="이 토템은... (선택사항)"
                    placeholderTextColor="#666"
                    maxLength={100}
                  />

                  <Text style={{ fontSize: 12, fontWeight: "600", color: theme.mutedForeground, marginBottom: 4 }}>색상</Text>
                  <ColorPicker selected={totemColor} onSelect={setTotemColor} />

                  <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
                    <Pressable style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: theme.secondary }} onPress={() => { setShowTotemModal(false); }} hitSlop={8}>
                      <Text style={{ fontSize: 14, color: theme.mutedForeground }}>취소</Text>
                    </Pressable>
                    <Pressable style={[{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: theme.foreground }, !totemName.trim() && { opacity: 0.4 }]} disabled={!totemName.trim()} onPress={() => {
                      if (!totemName.trim()) return;
                      try {
                        if (editingTotem) {
                          updateTotem(editingTotem.id, {
                            name: totemName.trim(),
                            emoji: totemEmoji || "🍀",
                            description: totemDesc.trim() || null,
                            color: totemColor.trim() || null,
                          });
                        } else {
                          addTotem(totemName.trim(), totemEmoji || "🍀", totemDesc.trim() || undefined, totemColor.trim() || undefined);
                        }
                        setShowTotemModal(false);
                        loadData();
                      } catch (e) {
                        console.warn("totem save failed", e);
                      }
                    }}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: theme.background }}>{editingTotem ? "수정" : "추가"}</Text>
                    </Pressable>
                  </View>
                </ScrollView>
              </View>
            ) : showTotemDeleteConfirm ? (
              <View style={{ flex: 1, justifyContent: "center" }}>
                <View style={{ backgroundColor: theme.card, borderRadius: 20, padding: 24, width: "100%", maxWidth: 340, alignSelf: "center" }}>
                  <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.foreground, marginBottom: 16, textAlign: "center" }}>"{showTotemDeleteConfirm.name}" 삭제</Text>
                  <Text style={{ fontSize: 14, color: theme.mutedForeground, marginBottom: 16, lineHeight: 20, textAlign: "center" }}>
                    토템을 삭제할 때 연결된 기록을{'\n'}어떻게 처리할까요?
                  </Text>
                  <View style={{ gap: 8 }}>
                    <Pressable style={{ alignItems: "center", paddingVertical: 14, borderRadius: 12, backgroundColor: myTeamColor }} onPress={() => {
                      try {
                        deleteTotem(showTotemDeleteConfirm.id, true);
                        setShowTotemDeleteConfirm(null);
                        loadData();
                      } catch (e) {
                        console.warn("totem delete failed", e);
                      }
                    }}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>기록 유지 (토템만 제거)</Text>
                    </Pressable>
                    <Pressable style={{ alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: theme.muted }} onPress={() => {
                      try {
                        deleteTotem(showTotemDeleteConfirm.id, false);
                        setShowTotemDeleteConfirm(null);
                        loadData();
                      } catch (e) {
                        console.warn("totem delete failed", e);
                      }
                    }}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: "#ef4444" }}>기록에서도 제거</Text>
                    </Pressable>
                    <Pressable style={{ alignItems: "center", paddingVertical: 10, borderRadius: 12, marginTop: 4 }} onPress={() => setShowTotemDeleteConfirm(null)} hitSlop={8}>
                      <Text style={{ fontSize: 14, color: theme.mutedForeground }}>취소</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.foreground }}>나의 토템</Text>
                  <View style={{ flexDirection: "row", gap: 20 }}>
                    <Pressable onPress={() => {
                      setEditingTotem(null);
                      setTotemName("");
                      setTotemEmoji("");
                      setTotemDesc("");
                      setTotemColor("");
                      setShowTotemModal(true);
                    }} style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, backgroundColor: theme.muted }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: theme.foreground }}>+ 추가</Text>
                    </Pressable>
                    <Pressable onPress={closeTotem} hitSlop={12}>
                      <Text style={{ fontSize: 22, color: theme.mutedForeground }}>✕</Text>
                    </Pressable>
                  </View>
                </View>
                {totems.length === 0 ? (
                  <Text style={{ fontSize: 13, color: theme.mutedForeground, paddingVertical: 32, textAlign: "center" }}>
                    아직 등록된 토템이 없어요.{'\n'}토템을 추가해보세요!
                  </Text>
                ) : (
                  <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                      {totems.map((t) => {
                        const chipColor = t.color || theme.border;
                        const wrPct = t.count > 0 ? Math.round(t.winRate * 100) : 0;
                        const teamColor_ = myTeam ? teamPrimaryColor(myTeam, isDark) : theme.foreground;
                        return (
                          <Pressable
                            key={t.id}
                            onPress={() => {
                              setEditingTotem(t);
                              setTotemName(t.name);
                              setTotemEmoji(t.emoji);
                              setTotemDesc(t.description || "");
                              setTotemColor(t.color || "");
                              setShowTotemModal(true);
                            }}
                            style={{
                              width: "47%", borderRadius: 16, borderWidth: 1,
                              borderColor: chipColor,
                              backgroundColor: chipColor + "10",
                              padding: 14, paddingTop: 8, gap: 6,
                            }}
                          >
                            <View style={{ position: "relative", alignItems: "center" }}>
                              <Pressable
                                hitSlop={6}
                                onPress={(e) => { e.stopPropagation?.(); setShowTotemDeleteConfirm(t); }}
                                style={{ position: "absolute", right: -4, top: -2, zIndex: 1, width: 22, height: 22, borderRadius: 11, backgroundColor: theme.muted, alignItems: "center", justifyContent: "center" }}
                              >
                                <Text style={{ fontSize: 13, color: theme.mutedForeground }}>✕</Text>
                              </Pressable>
                              <Text style={{ fontSize: 28 }}>{t.emoji}</Text>
                            </View>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: theme.foreground, textAlign: "center" }} numberOfLines={1}>
                              {t.name}
                            </Text>
                            <View style={{ flexDirection: "row", justifyContent: "center", gap: 12 }}>
                              <Text style={{ fontSize: 12, color: theme.mutedForeground }}>{t.count}회</Text>
                              <Text style={{ fontSize: 12, fontWeight: "600", color: teamColor_ }}>
                                {wrPct}%
                              </Text>
                              {t.currentStreak > 1 && (
                                <Text style={{ fontSize: 12, color: t.currentStreak > 0 ? "#22c55e" : "#ef4444" }}>
                                  {t.currentStreak}{t.currentStreak > 0 ? "연승" : "연패"}
                                </Text>
                              )}
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                )}
              </>
            )}
            </Animated.View>
          </View>
        </Modal>

      {/* Profile Character Picker Modal */}
      <Modal visible={showProfilePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>프로필 이미지 선택</Text>
            <Text style={{ fontSize: 12, color: theme.mutedForeground, textAlign: "center", marginBottom: 12 }}>
              {unlockedEmotions.length}/{ALL_CHARACTERS.length} 캐릭터 보유 중
            </Text>
            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={styles.charGrid}>
              {sortedProfileChars.map((c) => {
                const isUnlocked = unlockedEmotions.includes(c.id);
                return (
                  <Pressable
                    key={c.id}
                    onPress={isUnlocked ? () => handleSelectProfileChar(c.id) : undefined}
                    style={[
                      styles.charItem,
                      profileImage?.value === c.id && { borderColor: myTeamColor },
                    ]}
                  >
                    <View style={{ position: "relative" }}>
                      <View style={!isUnlocked && { opacity: 0.35 }}>
                        <TeamBadge
                          teamId={myTeam || DEFAULT_TEAM_ID}
                          size="md"
                          emotion={c.id}
                        />
                      </View>
                      {!isUnlocked && (
                        <View style={{ position: "absolute", top: 0, right: 0, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 8, width: 16, height: 16, justifyContent: "center", alignItems: "center" }}>
                          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>🔒</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.charName}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable style={[styles.modalSave, { flex: 0, alignSelf: "center", paddingHorizontal: 40 }]} onPress={() => setShowProfilePicker(false)} hitSlop={8}>
              <Text style={styles.modalSaveText}>확인</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Year in Review Modal */}
      <Modal visible={yrRender} transparent animationType="none" onRequestClose={closeYr}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: yrBackdrop, backgroundColor: "rgba(0,0,0,0.7)" }]} />
          <Animated.View style={{ flex: 1, maxHeight: Dimensions.get("window").height * 0.9, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: theme.background, overflow: "hidden", transform: [{ translateY: yrSlide }] }}>
            <YearInReview year={reviewYear} onClose={closeYr} />
          </Animated.View>
        </View>
      </Modal>

      {/* Achievement Modal */}
      <AchievementModal visible={showAchievementModal} onClose={() => setShowAchievementModal(false)} />

      {/* Collection Modal */}
      <CollectionModal visible={showCollectionModal} onClose={() => setShowCollectionModal(false)} onSave={loadData} />

      {/* Shortcut picker modal */}
      <ShortcutPickerModal
        visible={showShortcutPicker}
        onClose={() => setShowShortcutPicker(false)}
        currentShortcut={shortcut}
        onSelect={handleShortcutSelect}
      />
      <SimpleAlert
        visible={showResetErrorAlert}
        title="오류"
        message="데이터 초기화에 실패했습니다.\n다시 시도해주세요."
        confirmText="확인"
        onClose={() => setShowResetErrorAlert(false)}
      />
      <TicketReportModal
        visible={showTicketReport}
        onClose={() => setShowTicketReport(false)}
      />
    </ScrollView>
  );
}

