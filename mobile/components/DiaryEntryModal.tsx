import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View, Text, Pressable, TextInput, StyleSheet, Image,
  ActivityIndicator, ScrollView, PanResponder,
  Animated, KeyboardAvoidingView, BackHandler, Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { TEAM_COLORS, TEAM_LIST } from "@shared/teamColors";
import { parseGameTeamIds, getDaysInMonth, getFirstDayOfMonth, formatDate, formatDateForApi, DEFAULT_TEAM_ID, buildGameId } from "@shared/constants";
import EmotionPicker from "@/components/EmotionPicker";
import { TeamBadge } from "@/components/TeamBadge";
import { useTheme, teamPrimaryColor } from "@/lib/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { addJikgwanRecord, updateJikgwanRecord, getMyTeam, type JikgwanRecord } from "@/lib/db";
import { savePhoto, resizePhoto, generatePhotoName } from "@/lib/camera";
import { fetchScheduleByMonth, fetchDailyScores, type ScheduleGame, type ScoreEntry } from "@/lib/api";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function parseEditPhotos(record: JikgwanRecord): string[] {
  if (record.photos) {
    try {
      const parsed = JSON.parse(record.photos);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  if (record.photo_path) return [record.photo_path];
  return [];
}


function gameEmotions(game: GameOption): { away: "joyful" | "sad" | "neutral"; home: "joyful" | "sad" | "neutral" } | null {
  if (game.cancelled) return { away: "neutral", home: "neutral" };
  if (game.homeScore == null || game.awayScore == null) return null;
  if (game.homeScore === game.awayScore) return { away: "neutral", home: "neutral" };
  if (game.homeScore > game.awayScore) return { away: "sad", home: "joyful" };
  return { away: "joyful", home: "sad" };
}

// Game data for the selected date
export interface GameOption {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  cancelled: boolean;
  venue: string;
  time: string;
}

interface DiaryEntryModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  editRecord?: JikgwanRecord | null;
  presetGame?: GameOption | null;
  presetDate?: Date | null;
}

export default function DiaryEntryModal({ visible, onClose, onSaved, editRecord, presetGame, presetDate }: DiaryEntryModalProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const sheetTranslateY = useRef(new Animated.Value(500)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [shouldRender, setShouldRender] = useState(false);
  const now = new Date();
  const [step, setStep] = useState<"calendar" | "games" | "write">("calendar");

  // Calendar state
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(now);

  // Games state
  const [games, setGames] = useState<GameOption[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameOption | null>(null);

  // Write state
  const [emotion, setEmotion] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [userTeam, setUserTeam] = useState(DEFAULT_TEAM_ID);
  const [cheeredTeam, setCheeredTeam] = useState<string | null>(null);
  const [isLive, setIsLive] = useState<boolean>(true);
  const [seat, setSeat] = useState("");
  const [showOtherGames, setShowOtherGames] = useState(false);

  // Custom alert state
  const [simpleAlert, setSimpleAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onOk?: () => void;
  }>({ visible: false, title: "", message: "" });

  const [teamPickerGame, setTeamPickerGame] = useState<GameOption | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  // Animate open when visible
  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      sheetTranslateY.setValue(500);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 9,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const dateStr = formatDate(selectedDate);
  const dateStrShort = `${String(selectedDate.getMonth() + 1)}월 ${selectedDate.getDate()}일`;

  // Reset on open
  useEffect(() => {
    if (visible) {
      setCheeredTeam(null);
      if (editRecord) {
        setStep("write");
        setSelectedDate(new Date());
        setSelectedGame(null);
        setEmotion(editRecord.emotion || null);
        setContent(editRecord.memo || "");
        setPhotoUris(parseEditPhotos(editRecord));
        setCheeredTeam(editRecord.cheered_team || null);
        setIsLive(editRecord.is_live !== 0);
        setSeat(editRecord.seat || "");
        setGames([]);
      } else if (presetGame) {
        setStep("write");
        setSelectedDate(presetDate || new Date());
        setSelectedGame(presetGame);
        setEmotion(null);
        setContent("");
        setPhotoUris([]);
        setIsLive(true);
        setSeat("");
        setGames([]);
        setShowOtherGames(false);
        getMyTeam().then((t) => {
          if (t) {
            setUserTeam(t);
            if (presetGame.homeTeam === t || presetGame.awayTeam === t) {
              setCheeredTeam(t);
            } else if (!presetGame.cancelled) {
              setTeamPickerGame(presetGame);
            }
          }
        });
        return;
      } else {
        setStep("calendar");
        setSelectedDate(new Date());
        setSelectedGame(null);
        setEmotion(null);
        setContent("");
        setPhotoUris([]);
        setIsLive(true);
        setSeat("");
        setGames([]);
      }
      getMyTeam().then((t) => { if (t) setUserTeam(t); });
    }
  }, [visible, editRecord, presetGame, presetDate]);

  // Fetch games when date is selected
  const loadGames = useCallback(async (date: Date) => {
    setGamesLoading(true);
    try {
      const month = date.getMonth() + 1;
      const apiDate = formatDateForApi(date);
      const [schedule, scores] = await Promise.all([
        fetchScheduleByMonth(month),
        fetchDailyScores(apiDate),
      ]);

      const daySched = (schedule?.games ?? []).filter(
        (g: ScheduleGame) => g.date === apiDate
      );

      const scoreMap = new Map<string, ScoreEntry>();
      for (const s of scores?.games ?? []) {
        scoreMap.set(`${s.away} vs ${s.home}`, s);
      }

      const gameOpts: GameOption[] = daySched.map((g: ScheduleGame) => {
        const score = scoreMap.get(`${g.away} vs ${g.home}`);
        return {
          gameId: "",
          homeTeam: TEAM_LIST.find((t) => t.shortName === g.home)?.id || "",
          awayTeam: TEAM_LIST.find((t) => t.shortName === g.away)?.id || "",
          homeScore: score?.homeScore ?? null,
          awayScore: score?.awayScore ?? null,
          cancelled: score?.cancelled ?? false,
          venue: g.venue || "",
          time: g.time || "",
        };
      });

      // Sort: my team's game first
      const sorted = [...gameOpts].sort((a, b) => {
        const aMy = userTeam && (a.homeTeam === userTeam || a.awayTeam === userTeam);
        const bMy = userTeam && (b.homeTeam === userTeam || b.awayTeam === userTeam);
        if (aMy && !bMy) return -1;
        if (!aMy && bMy) return 1;
        return 0;
      });

      setGames(sorted.slice(0, 5));
    } catch {
      setGames([]);
    } finally {
      setGamesLoading(false);
    }
  }, [userTeam]);

  const handleDateSelect = (d: number) => {
    const date = new Date(calYear, calMonth, d);
    setSelectedDate(date);
    loadGames(date);
    setStep("games");
    setShowOtherGames(false);
  };

  const handleGameSelect = (game: GameOption) => {
    setSelectedGame(game);
    const isMyGame = userTeam && (game.homeTeam === userTeam || game.awayTeam === userTeam);
    if (isMyGame) {
      setCheeredTeam(userTeam);
      setStep("write");
      return;
    }
    // Cancelled game: skip team picker
    if (game.cancelled) {
      setCheeredTeam(null);
      setStep("write");
      return;
    }
    setTeamPickerGame(game);
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setSimpleAlert({ visible: true, title: "권한 필요", message: "앨범 접근 권한이 필요합니다" });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotoUris((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    if (!content.trim()) {
      setSimpleAlert({ visible: true, title: "알림", message: "내용을 입력해주세요" });
      return;
    }
    setSaving(true);
    try {
      let savedPhotoUris: string[] = [];
      if (photoUris.length > 0) {
        for (const uri of photoUris) {
          try {
            const resized = await resizePhoto(uri);
            const fileName = generatePhotoName();
            const savedUri = await savePhoto(resized, fileName);
            savedPhotoUris.push(savedUri);
          } catch (e) {
            console.warn("사진 저장 실패, 건너뜁니다", uri, e);
          }
        }
      }
      const photosJson = savedPhotoUris.length > 0 ? JSON.stringify(savedPhotoUris) : null;

      const myTeam = await getMyTeam();
      const targetTeam = cheeredTeam || myTeam;
      let isWin: number | null = null;
      if (targetTeam) {
        const hScore = selectedGame?.homeScore ?? editRecord?.score_home ?? null;
        const aScore = selectedGame?.awayScore ?? editRecord?.score_away ?? null;
        if (hScore != null && aScore != null) {
          let isAway = false, isHome = false;
          if (selectedGame) {
            isAway = selectedGame.awayTeam === targetTeam;
            isHome = selectedGame.homeTeam === targetTeam;
          } else if (editRecord) {
            const gt = parseGameTeamIds(editRecord.game_id);
            isAway = gt.awayId === targetTeam;
            isHome = gt.homeId === targetTeam;
          }
          if (isHome) {
            isWin = hScore > aScore ? 1 : hScore < aScore ? -1 : 0;
          } else if (isAway) {
            isWin = aScore > hScore ? 1 : aScore < hScore ? -1 : 0;
          }
          // targetTeam not in game → isWin stays null
        }
      }

      const datePrefix = dateStr.replace(/\./g, "");
      let gameId = "";
      try {
        if (selectedGame?.awayTeam && selectedGame?.homeTeam) {
          gameId = buildGameId(selectedGame.awayTeam, selectedGame.homeTeam, datePrefix);
        }
      } catch {}

      if (editRecord) {
        await updateJikgwanRecord(editRecord.id, {
          memo: content.trim(),
          emotion: emotion || null,
          photos: photosJson,
          is_win: isWin,
          cheered_team: (cheeredTeam || myTeam || null) as string | null,
          is_live: isLive ? 1 : 0,
          seat: seat.trim() || null,
        });
      } else {
        await addJikgwanRecord({
          game_id: gameId || "",
          date: dateStr,
          photo_path: savedPhotoUris[0] || null,
          photos: photosJson,
          memo: content.trim(),
          score_away: selectedGame?.awayScore != null ? selectedGame.awayScore : null,
          score_home: selectedGame?.homeScore != null ? selectedGame.homeScore : null,
          emotion: emotion || null,
          three_line_1: null,
          three_line_2: null,
          three_line_3: null,
          frame_style: "classic",
          stadium: selectedGame?.venue || null,
          is_win: isWin != null ? isWin : null,
          cheered_team: (cheeredTeam || myTeam || null) as string | null,
          is_live: isLive ? 1 : 0,
          seat: seat.trim() || null,
        });
      }

      setSimpleAlert({ visible: true, title: "저장 완료", message: editRecord ? "기록이 수정되었습니다" : "직관 기록이 저장되었습니다", onOk: onSaved });
    } catch (e) {
      console.warn("DiaryEntryModal handleSave error", e);
      const msg = e instanceof Error ? e.message : String(e);
      setSimpleAlert({ visible: true, title: "저장 오류", message: msg });
    } finally {
      setSaving(false);
    }
  };

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(sheetTranslateY, {
        toValue: 500,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShouldRender(false);
      onCloseRef.current();
    });
  }, [sheetTranslateY, backdropOpacity]);

  useEffect(() => {
    if (!shouldRender) return;
    const handler = () => {
      handleClose();
      return true;
    };
    const subscription = BackHandler.addEventListener("hardwareBackPress", handler);
    return () => subscription.remove();
  }, [shouldRender, handleClose]);

  const sheetPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 10,
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 80) {
        handleClose();
      }
    },
  }), [handleClose]);

  // --- Calendar helpers ---
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === calYear && today.getMonth() === calMonth;

  const cells: { day: number; isToday: boolean }[] = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: 0, isToday: false });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, isToday: isCurrentMonth && today.getDate() === d });
  }

  const calPrev = () => {
    const m = calMonth === 0 ? 11 : calMonth - 1;
    setCalYear(calMonth === 0 ? calYear - 1 : calYear);
    setCalMonth(m);
  };
  const calNext = () => {
    const m = calMonth === 11 ? 0 : calMonth + 1;
    setCalYear(calMonth === 11 ? calYear + 1 : calYear);
    setCalMonth(m);
  };
  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      position: "absolute",
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 999,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: "92%",
      paddingBottom: Math.max(insets.bottom, 8),
    },
    handleRow: { alignItems: "center", paddingVertical: 16 },
    handle: { width: 48, height: 5, borderRadius: 3, backgroundColor: theme.border },

    // Step header
    stepHeader: {
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    stepTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.foreground,
      textAlign: "center",
    },
    stepBackRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backArrow: { fontSize: 16, color: theme.foreground },

    scrollContent: { padding: 20, paddingTop: 0 },

    // Calendar
    calHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    calNav: { fontSize: 14, color: theme.foreground, paddingHorizontal: 8 },
    calMonth: { fontSize: 16, fontWeight: "700", color: theme.foreground },
    calDayRow: { flexDirection: "row", marginBottom: 4 },
    calDayHeader: {
      flex: 1, textAlign: "center", fontSize: 11,
      color: theme.mutedForeground, fontWeight: "600", paddingVertical: 4,
    },
    calGrid: { flexDirection: "row", flexWrap: "wrap" },
    calCell: {
      width: "14.28%", aspectRatio: 1,
      justifyContent: "center", alignItems: "center",
    },
    calDayInner: {
      width: 28, height: 28,
      justifyContent: "center", alignItems: "center",
      borderRadius: 14,
    },
    calDayToday: {
      backgroundColor: theme.muted,
    },
    calDayNum: { fontSize: 14, color: theme.foreground, fontWeight: "500" },

    // Games
    loadingBox: { alignItems: "center", paddingVertical: 40, gap: 12 },
    loadingText: { fontSize: 13, color: theme.mutedForeground },
    noGamesBox: { alignItems: "center", paddingVertical: 40, gap: 12 },
    noGamesIcon: { fontSize: 40 },
    noGamesText: { fontSize: 14, color: theme.mutedForeground },
    writeWithoutGame: {
      paddingVertical: 10, paddingHorizontal: 20,
      borderRadius: 12, backgroundColor: theme.muted,
      alignSelf: "center", marginTop: 8,
    },
    writeWithoutGameText: { fontSize: 13, fontWeight: "600", color: theme.foreground },
    gameList: { gap: 10 },
    gameCard: {
      backgroundColor: theme.card, borderRadius: 14, borderWidth: 1,
      borderColor: theme.border, paddingVertical: 10, paddingHorizontal: 14,
    },
    gameCardTop: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    },
    gameTeamRow: {
      flexDirection: "row", alignItems: "center", gap: 6,
    },
    gameTeamName: { fontSize: 14, fontWeight: "600" },
    gameScore: { fontSize: 18, fontWeight: "700", color: theme.foreground },
    myBadge: {
      fontSize: 10, fontWeight: "800", color: "#fff",
      backgroundColor: theme.muted, paddingHorizontal: 5, paddingVertical: 1,
      borderRadius: 4, overflow: "hidden",
    },
    myBadgeEdge: {
      position: "absolute", top: 0, bottom: 0, justifyContent: "center", zIndex: 1,
    },
    gameVs: { fontSize: 12, color: theme.mutedForeground, fontWeight: "600" },
    gameMeta: { fontSize: 11, color: theme.mutedForeground },
    otherGamesToggle: {
      paddingVertical: 10,
      alignItems: "center",
      borderRadius: 10,
      backgroundColor: theme.muted,
    },
    otherGamesToggleText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.mutedForeground,
    },

    // Selected game banner
    selectedGameBanner: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 10, marginBottom: 20,
      backgroundColor: theme.muted, borderRadius: 12, padding: 12,
    },
    selectedGameText: { fontSize: 14, fontWeight: "700", color: theme.foreground },

    // Section
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: theme.foreground, marginBottom: 10 },

    // Photo grid
    photoGrid: {
      flexDirection: "row", flexWrap: "wrap", gap: 8,
    },
    photoThumbWrap: {
      position: "relative", borderRadius: 10, overflow: "hidden",
    },
    photoThumb: {
      width: 80, height: 80, borderRadius: 10,
    },
    photoRemove: {
      position: "absolute", top: 2, right: 2,
      width: 20, height: 20, borderRadius: 10,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center", alignItems: "center",
    },
    photoRemoveText: { color: "#fff", fontSize: 14, fontWeight: "700", lineHeight: 16 },
    photoAddBtn: {
      width: 80, height: 80, borderRadius: 10,
      borderWidth: 1, borderColor: theme.border, borderStyle: "dashed",
      justifyContent: "center", alignItems: "center",
      backgroundColor: theme.muted,
    },
    photoAddIcon: { fontSize: 24, color: theme.mutedForeground },

    // Input
    inputRow: { position: "relative", marginBottom: 10 },
    input: {
      backgroundColor: theme.card, borderRadius: 12,
      padding: 14, paddingRight: 50,
      fontSize: 14, color: theme.foreground,
      borderWidth: 1, borderColor: theme.border,
      lineHeight: 20, minHeight: 44,
    },
    diaryInput: {
      backgroundColor: theme.card, borderRadius: 14,
      padding: 16,
      fontSize: 15, color: theme.foreground,
      borderWidth: 1, borderColor: theme.border,
      lineHeight: 24, minHeight: 160,
    },
    seatInput: {
      backgroundColor: theme.card, borderRadius: 12,
      padding: 14,
      fontSize: 14, color: theme.foreground,
      borderWidth: 1, borderColor: theme.border,
      lineHeight: 20, minHeight: 44,
    },
    charCount: {
      position: "absolute", bottom: 8, right: 12,
      fontSize: 10, color: theme.mutedForeground,
    },

    // Bottom
    bottomRow: {
      flexDirection: "row", gap: 12,
      paddingHorizontal: 20, paddingTop: 8,
    },
    cancelBtn: {
      flex: 1, paddingVertical: 14, borderRadius: 14,
      borderWidth: 1, borderColor: theme.border, alignItems: "center",
    },
    cancelBtnFull: {
      flex: 1, paddingVertical: 14, borderRadius: 14,
      backgroundColor: theme.muted, alignItems: "center",
    },
    cancelText: { fontSize: 14, color: theme.foreground, fontWeight: "600" },
    saveBtn: {
      flex: 1, paddingVertical: 14, borderRadius: 14,
      backgroundColor: theme.foreground, alignItems: "center",
    },
    saveText: { fontSize: 14, fontWeight: "700", color: theme.background },
    editGameRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    },
    cheerTeamCard: {
      alignItems: "center", gap: 6,
      backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border,
      paddingVertical: 12, paddingHorizontal: 20, minWidth: 100,
    },
    cheerTeamName: { fontSize: 13, fontWeight: "600", marginTop: 4 },
    cheerTeamScore: { fontSize: 18, fontWeight: "700", color: theme.foreground },
    cheerTeamBadge: {
      position: "absolute", top: -6, right: -6,
      fontSize: 12, fontWeight: "800", color: "#fff",
      backgroundColor: theme.foreground,
      width: 20, height: 20, borderRadius: 10, textAlign: "center", lineHeight: 20,
      overflow: "hidden",
    },
    winResultText: {
      fontSize: 14, fontWeight: "700", color: theme.foreground,
      textAlign: "center", marginTop: 8,
    },
    liveToggleRow: {
      flexDirection: "row",
      gap: 10,
    },
    liveToggleBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: theme.muted,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    liveToggleText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.foreground,
    },

    // Custom alert
    alertOverlay: {
      position: "absolute",
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 100,
    },
    alertCard: {
      backgroundColor: theme.card,
      borderRadius: 18,
      padding: 28,
      minWidth: 280,
      maxWidth: 320,
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    alertTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.foreground,
      marginBottom: 8,
    },
    alertMessage: {
      fontSize: 14,
      color: theme.mutedForeground,
      textAlign: "center",
      marginBottom: 20,
      lineHeight: 20,
    },
    alertOkBtn: {
      backgroundColor: theme.foreground,
      paddingVertical: 12,
      paddingHorizontal: 48,
      borderRadius: 12,
      minWidth: 120,
      alignItems: "center",
    },
    alertOkText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.background,
    },
    // Team picker
    teamPickerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 16,
    },
    teamPickerCard: {
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.muted,
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: 20,
      minWidth: 100,
    },
    teamPickerName: {
      fontSize: 13,
      fontWeight: "600",
    },
    teamPickerVs: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.mutedForeground,
    },
    alertCancelBtn: {
      paddingVertical: 8,
      paddingHorizontal: 24,
    },
    alertCancelText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.mutedForeground,
    },
  }), [theme, insets.bottom]);

  if (!shouldRender) return null;

  return (
    <View style={styles.overlay}>
      {/* Backdrop — tap to close */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity, backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <Pressable style={{ flex: 1 }} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ justifyContent: "flex-end" }}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <View style={styles.handleRow} {...sheetPan.panHandlers}>
            <View style={styles.handle} />
          </View>

          {/* Header with step */}
          <View style={styles.stepHeader}>
            {step === "calendar" && <Text style={styles.stepTitle}>날짜 선택</Text>}
            {step === "games" && (
              <View style={styles.stepBackRow}>
                <Pressable onPress={() => setStep("calendar")} hitSlop={8}>
                  <Text style={styles.backArrow}>◀</Text>
                </Pressable>
                <Text style={styles.stepTitle}>{dateStrShort} 경기</Text>
                <View style={{ width: 20 }} />
              </View>
            )}
            {step === "write" && (
              <View style={styles.stepBackRow}>
                <Pressable onPress={() => presetGame ? handleClose() : setStep("games")} hitSlop={8}>
                  <Text style={styles.backArrow}>◀</Text>
                </Pressable>
                <Text style={styles.stepTitle}>{editRecord ? "기록 수정" : "기록 작성"}</Text>
                <View style={{ width: 20 }} />
              </View>
            )}
          </View>

          <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Step 1: Calendar */}
            {step === "calendar" && (
              <View>
                {/* Month nav */}
                <View style={styles.calHeader}>
                  <Pressable onPress={calPrev} hitSlop={8}>
                    <Text style={styles.calNav}>◀</Text>
                  </Pressable>
                  <Text style={styles.calMonth}>{calYear}년 {calMonth + 1}월</Text>
                  <Pressable onPress={calNext} hitSlop={8}>
                    <Text style={styles.calNav}>▶</Text>
                  </Pressable>
                </View>

                {/* Day headers */}
                <View style={styles.calDayRow}>
                  {DAYS.map((d, i) => (
                    <Text key={d} style={[styles.calDayHeader, (i === 0 || i === 6) && { color: theme.mutedForeground }]}>{d}</Text>
                  ))}
                </View>

                {/* Grid */}
                <View style={styles.calGrid}>
                  {cells.map((cell, idx) => {
                    if (cell.day === 0) return <View key={`e-${idx}`} style={styles.calCell} />;
                    return (
                      <Pressable
                        key={`d-${cell.day}`}
                        style={styles.calCell}
                        onPress={() => handleDateSelect(cell.day)}
                      >
                        <View style={[styles.calDayInner, cell.isToday && styles.calDayToday]}>
                          <Text style={styles.calDayNum}>
                            {cell.day}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

              </View>
            )}

            {/* Step 2: Game list */}
            {step === "games" && (
              <View>
                {gamesLoading ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={styles.loadingText}>경기 불러오는 중...</Text>
                  </View>
                ) : games.length === 0 ? (
                  <View style={styles.noGamesBox}>
                    <Text style={styles.noGamesIcon}>⚾</Text>
                    <Text style={styles.noGamesText}>{dateStrShort}에는 경기가 없어요</Text>
                    <Pressable style={styles.writeWithoutGame} onPress={() => { setSelectedGame(null); setStep("write"); }}>
                      <Text style={styles.writeWithoutGameText}>경기정보 없이 쓰기</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                  {(() => {
                    const myGame = games.find(g => userTeam && (g.homeTeam === userTeam || g.awayTeam === userTeam));
                    const otherGames = games.filter(g => !(userTeam && (g.homeTeam === userTeam || g.awayTeam === userTeam)));

                    return (
                      <>
                      {/* MY team game — prominent */}
                      {myGame && (() => {
                        const home = TEAM_COLORS[myGame.homeTeam];
                        const away = TEAM_COLORS[myGame.awayTeam];
                        const hasScore = myGame.homeScore != null && myGame.awayScore != null;
                        const emotions = gameEmotions(myGame);
                        const myTeamColor = teamPrimaryColor(userTeam, isDark);
                        return (
                          <View style={styles.gameList}>
                            <Pressable
                              key={`my-${myGame.homeTeam}-${myGame.awayTeam}`}
                              style={[styles.gameCard, myTeamColor && { borderColor: myTeamColor, borderWidth: 2 }]}
                              onPress={() => handleGameSelect(myGame)}
                            >
                              <View style={styles.gameCardTop}>
                                {userTeam === myGame.awayTeam && (
                                  <View style={[styles.myBadgeEdge, { left: 0 }]}>
                                    <Text style={[styles.myBadge, { backgroundColor: myTeamColor || theme.muted }]}>MY</Text>
                                  </View>
                                )}
                                {userTeam === myGame.homeTeam && (
                                  <View style={[styles.myBadgeEdge, { right: 0 }]}>
                                    <Text style={[styles.myBadge, { backgroundColor: myTeamColor || theme.muted }]}>MY</Text>
                                  </View>
                                )}

                                <View style={styles.gameTeamRow}>
                                  <TeamBadge teamId={myGame.awayTeam} size="sm" emotion={emotions?.away ?? "default"} />
                                  <Text style={[styles.gameTeamName, { color: teamPrimaryColor(myGame.awayTeam, isDark) }]}>
                                    {away?.shortName || "?"}
                                  </Text>
                                  {hasScore && (
                                    <Text style={styles.gameScore}>{myGame.awayScore}</Text>
                                  )}
                                </View>

                                {myGame.cancelled ? (
                                  <Text style={styles.gameVs}>취소</Text>
                                ) : (
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                    <Text style={styles.gameVs}>VS</Text>
                                    <Text style={styles.gameMeta}>{myGame.time}</Text>
                                  </View>
                                )}

                                <View style={styles.gameTeamRow}>
                                  {hasScore && (
                                    <Text style={styles.gameScore}>{myGame.homeScore}</Text>
                                  )}
                                  <Text style={[styles.gameTeamName, { color: teamPrimaryColor(myGame.homeTeam, isDark) }]}>
                                    {home?.shortName || "?"}
                                  </Text>
                                  <TeamBadge teamId={myGame.homeTeam} size="sm" emotion={emotions?.home ?? "default"} />
                                </View>
                              </View>
                            </Pressable>

                            {/* Other games toggle */}
                            {otherGames.length > 0 && (
                              <Pressable style={styles.otherGamesToggle} onPress={() => setShowOtherGames((v) => !v)}>
                                <Text style={styles.otherGamesToggleText}>
                                  {showOtherGames ? "접기 ▲" : `그 외 ${otherGames.length}경기 ▼`}
                                </Text>
                              </Pressable>
                            )}

                            {/* Other games (expanded) */}
                            {showOtherGames && otherGames.map((g, i) => {
                              const home = TEAM_COLORS[g.homeTeam];
                              const away = TEAM_COLORS[g.awayTeam];
                              const hasScore = g.homeScore != null && g.awayScore != null;
                              const emotions = gameEmotions(g);
                              return (
                                <Pressable
                                  key={`other-${g.homeTeam}-${g.awayTeam}-${i}`}
                                  style={styles.gameCard}
                                  onPress={() => handleGameSelect(g)}
                                >
                                  <View style={styles.gameCardTop}>
                                    <View style={styles.gameTeamRow}>
                                      <TeamBadge teamId={g.awayTeam} size="sm" emotion={emotions?.away ?? "default"} />
                                      <Text style={[styles.gameTeamName, { color: teamPrimaryColor(g.awayTeam, isDark) }]}>
                                        {away?.shortName || "?"}
                                      </Text>
                                      {hasScore && <Text style={styles.gameScore}>{g.awayScore}</Text>}
                                    </View>

                                    {g.cancelled ? (
                                      <Text style={styles.gameVs}>취소</Text>
                                    ) : (
                                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                        <Text style={styles.gameVs}>VS</Text>
                                        <Text style={styles.gameMeta}>{g.time}</Text>
                                      </View>
                                    )}

                                    <View style={styles.gameTeamRow}>
                                      {hasScore && <Text style={styles.gameScore}>{g.homeScore}</Text>}
                                      <Text style={[styles.gameTeamName, { color: teamPrimaryColor(g.homeTeam, isDark) }]}>
                                        {home?.shortName || "?"}
                                      </Text>
                                      <TeamBadge teamId={g.homeTeam} size="sm" emotion={emotions?.home ?? "default"} />
                                    </View>
                                  </View>
                                </Pressable>
                              );
                            })}
                          </View>
                        );
                      })()}

                      {/* No MY team game: show all games in a flat list */}
                      {!myGame && (
                        <View style={styles.gameList}>
                          {games.map((g, i) => {
                            const home = TEAM_COLORS[g.homeTeam];
                            const away = TEAM_COLORS[g.awayTeam];
                            const hasScore = g.homeScore != null && g.awayScore != null;
                            const emotions = gameEmotions(g);
                            return (
                              <Pressable
                                key={`${g.homeTeam}-${g.awayTeam}-${i}`}
                                style={styles.gameCard}
                                onPress={() => handleGameSelect(g)}
                              >
                                <View style={styles.gameCardTop}>
                                  <View style={styles.gameTeamRow}>
                                    <TeamBadge teamId={g.awayTeam} size="sm" emotion={emotions?.away ?? "default"} />
                                    <Text style={[styles.gameTeamName, { color: teamPrimaryColor(g.awayTeam, isDark) }]}>
                                      {away?.shortName || "?"}
                                    </Text>
                                    {hasScore && <Text style={styles.gameScore}>{g.awayScore}</Text>}
                                  </View>

                                  {g.cancelled ? (
                                    <Text style={styles.gameVs}>취소</Text>
                                  ) : (
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                      <Text style={styles.gameVs}>VS</Text>
                                      <Text style={styles.gameMeta}>{g.time}</Text>
                                    </View>
                                  )}

                                  <View style={styles.gameTeamRow}>
                                    {hasScore && <Text style={styles.gameScore}>{g.homeScore}</Text>}
                                    <Text style={[styles.gameTeamName, { color: teamPrimaryColor(g.homeTeam, isDark) }]}>
                                      {home?.shortName || "?"}
                                    </Text>
                                    <TeamBadge teamId={g.homeTeam} size="sm" emotion={emotions?.home ?? "default"} />
                                  </View>
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                      </>
                    );
                  })()}
                  <Pressable style={styles.writeWithoutGame} onPress={() => { setSelectedGame(null); setStep("write"); }}>
                    <Text style={styles.writeWithoutGameText}>경기정보 없이 쓰기</Text>
                  </Pressable>
                  </>
                )}
              </View>
            )}

            {/* Step 3: Write */}
            {step === "write" && (
              <View>
                {/* Selected game summary */}
                {selectedGame && (
                  <View style={styles.selectedGameBanner}>
                    <TeamBadge teamId={selectedGame.awayTeam} size="sm" />
                    <Text style={styles.selectedGameText}>
                      {TEAM_COLORS[selectedGame.awayTeam]?.shortName} VS {TEAM_COLORS[selectedGame.homeTeam]?.shortName}
                    </Text>
                    <TeamBadge teamId={selectedGame.homeTeam} size="sm" />
                  </View>
                )}

                {/* Cheered team selector — new & edit */}
                {(() => {
                  // Determine teams from either selectedGame or editRecord
                  let awayId = selectedGame?.awayTeam || "";
                  let homeId = selectedGame?.homeTeam || "";
                  if (!awayId && !homeId && editRecord?.game_id) {
                    const gt = parseGameTeamIds(editRecord.game_id);
                    awayId = gt.awayId;
                    homeId = gt.homeId;
                  }
                  if (!awayId || !homeId) return null;

                  const ac = TEAM_COLORS[awayId];
                  const hc = TEAM_COLORS[homeId];
                  return (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>응원팀</Text>
                      <View style={styles.editGameRow}>
                        <Pressable
                          style={[styles.cheerTeamCard, cheeredTeam === awayId && { borderColor: teamPrimaryColor(awayId, isDark) || theme.muted, borderWidth: 2 }]}
                          onPress={() => setCheeredTeam(cheeredTeam === awayId ? null : awayId)}
                        >
                          <TeamBadge teamId={awayId} size="sm" />
                          <Text style={[styles.cheerTeamName, { color: teamPrimaryColor(awayId, isDark) }]}>{ac?.shortName || "?"}</Text>
                          {cheeredTeam === awayId && <Text style={styles.cheerTeamBadge}>✓</Text>}
                        </Pressable>
                        <Text style={styles.gameVs}>VS</Text>
                        <Pressable
                          style={[styles.cheerTeamCard, cheeredTeam === homeId && { borderColor: teamPrimaryColor(homeId, isDark) || "#333", borderWidth: 2 }]}
                          onPress={() => setCheeredTeam(cheeredTeam === homeId ? null : homeId)}
                        >
                          <TeamBadge teamId={homeId} size="sm" />
                          <Text style={[styles.cheerTeamName, { color: teamPrimaryColor(homeId, isDark) }]}>{hc?.shortName || "?"}</Text>
                          {cheeredTeam === homeId && <Text style={styles.cheerTeamBadge}>✓</Text>}
                        </Pressable>
                      </View>
                    </View>
                  );
                })()}

                {/* Emotion */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>오늘의 기분</Text>
                  <EmotionPicker value={emotion} onChange={setEmotion} teamId={cheeredTeam || userTeam} />
                </View>

                {/* 직관/집관 toggle */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>시청 방식</Text>
                  <View style={styles.liveToggleRow}>
                    <Pressable
                      style={[styles.liveToggleBtn, isLive && { backgroundColor: teamPrimaryColor(userTeam, isDark) || theme.foreground }]}
                      onPress={() => setIsLive(true)}
                    >
                      <Text style={[styles.liveToggleText, isLive && { color: "#fff" }]}>직관</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.liveToggleBtn, !isLive && { backgroundColor: "#888" }]}
                      onPress={() => setIsLive(false)}
                    >
                      <Text style={[styles.liveToggleText, !isLive && { color: "#fff" }]}>집관</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Seat info — only when live */}
                {isLive && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>좌석 (선택)</Text>
                    <TextInput
                      style={styles.seatInput}
                      value={seat}
                      onChangeText={setSeat}
                      placeholder="예: 1루 5열 12번"
                      placeholderTextColor="#999"
                    />
                  </View>
                )}

                {/* Photos */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>사진 ({photoUris.length}장)</Text>
                  <View style={styles.photoGrid}>
                    {photoUris.map((uri, i) => (
                      <View key={i} style={styles.photoThumbWrap}>
                        <Image source={{ uri }} style={styles.photoThumb} />
                        <Pressable style={styles.photoRemove} onPress={() => setPhotoUris((prev) => prev.filter((_, idx) => idx !== i))}>
                          <Text style={styles.photoRemoveText}>×</Text>
                        </Pressable>
                      </View>
                    ))}
                    <Pressable style={styles.photoAddBtn} onPress={pickPhoto}>
                      <Text style={styles.photoAddIcon}>+</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Free-form diary */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>직관일기</Text>
                  <TextInput
                    style={styles.diaryInput}
                    value={content}
                    onChangeText={setContent}
                    placeholder={`${dateStrShort}의 직관 이야기를 자유롭게 적어보세요 :)`}
                    placeholderTextColor="#999"
                    multiline
                    textAlignVertical="top"
                    onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200)}
                  />
                </View>
              </View>
            )}
          </ScrollView>

          {/* Bottom button */}
          <View style={styles.bottomRow}>
            {step === "write" ? (
              <>
                <Pressable style={styles.cancelBtn} onPress={handleClose}>
                  <Text style={styles.cancelText}>취소</Text>
                </Pressable>
                <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator color={theme.background} size="small" />
                  ) : (
                    <Text style={styles.saveText}>저장</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.cancelBtnFull} onPress={handleClose}>
                <Text style={styles.cancelText}>취소</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Custom simple alert */}
      {simpleAlert.visible && (
        <View style={styles.alertOverlay}>
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>{simpleAlert.title}</Text>
            <Text style={styles.alertMessage}>{simpleAlert.message}</Text>
            <Pressable style={styles.alertOkBtn} onPress={() => {
              setSimpleAlert({ visible: false, title: "", message: "" });
              simpleAlert.onOk?.();
            }}>
              <Text style={styles.alertOkText}>확인</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Custom team picker */}
      {teamPickerGame && (() => {
        const home = TEAM_COLORS[teamPickerGame.homeTeam];
        const away = TEAM_COLORS[teamPickerGame.awayTeam];
        return (
          <View style={styles.alertOverlay}>
            <View style={styles.alertCard}>
              <Text style={styles.alertTitle}>응원 팀 선택</Text>
              <Text style={styles.alertMessage}>어느 팀을 응원했나요?</Text>
              <View style={styles.teamPickerRow}>
                <Pressable style={styles.teamPickerCard} onPress={() => {
                  setCheeredTeam(teamPickerGame.awayTeam);
                  setTeamPickerGame(null);
                  setStep("write");
                }}>
                  <TeamBadge teamId={teamPickerGame.awayTeam} size="md" />
                  <Text style={[styles.teamPickerName, { color: teamPrimaryColor(teamPickerGame.awayTeam, isDark) }]}>
                    {away?.shortName || "원정팀"}
                  </Text>
                </Pressable>
                <Text style={styles.teamPickerVs}>VS</Text>
                <Pressable style={styles.teamPickerCard} onPress={() => {
                  setCheeredTeam(teamPickerGame.homeTeam);
                  setTeamPickerGame(null);
                  setStep("write");
                }}>
                  <TeamBadge teamId={teamPickerGame.homeTeam} size="md" />
                  <Text style={[styles.teamPickerName, { color: teamPrimaryColor(teamPickerGame.homeTeam, isDark) }]}>
                    {home?.shortName || "홈팀"}
                  </Text>
                </Pressable>
              </View>
              <Pressable style={styles.alertCancelBtn} onPress={() => { setCheeredTeam(null); setTeamPickerGame(null); setStep("write"); }}>
                <Text style={styles.alertCancelText}>선택안함</Text>
              </Pressable>
            </View>
          </View>
        );
      })()}
    </View>
  );
}


