import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { StyleSheet, Animated, Platform, AppState } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import * as ImagePicker from "expo-image-picker";
import { TEAM_LIST } from "@shared/teamColors";
import { parseGameTeamIds, getDaysInMonth, getFirstDayOfMonth, formatDate, formatDateForApi, DEFAULT_TEAM_ID, buildGameId } from "@shared/constants";
import { useTheme } from "@/lib/ThemeContext";
import { parseDotDate } from "@/lib/dateUtils";
import { useKeyboardHeight } from "@/lib/hooks/useKeyboardHeight";
import { teamPrimaryColor } from "@shared/teamColors";
import { useTeam } from "@/lib/TeamContext";
import { getDb, addJikgwanRecord, updateJikgwanRecord, getUnlockedEmotions } from "@/lib/db";
import { addExpense, getExpensesByRecordId, deleteExpensesByRecordId, EXPENSE_CATEGORIES } from "@/lib/db";
import { getAllTotems, getDiaryTotems, setDiaryTotems } from "@/lib/db";
import type { ExpenseCategory, Totem, JikgwanRecord } from "@/lib/db";
import { savePhoto, resizePhoto, generatePhotoName, resolvePhotoUri } from "@/lib/camera";
import { cachedScheduleByMonth, cachedDailyScores } from "@/lib/gameCache";
import type { ScheduleGame, ScoreEntry } from "@/lib/api";
import { resolveVenue } from "@/lib/stadiumData";

export interface GameOption {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  cancelled: boolean;
  venue: string;
  time: string;
  isExhibition?: boolean;
  isPostseason?: boolean;
  gameStatus?: string;
  pairIdx?: number;
}

export const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function parseEditPhotos(record: { photos?: string | null; photo_path?: string | null }): string[] {
  if (record.photos) {
    try {
      const parsed = JSON.parse(record.photos);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(resolvePhotoUri);
    } catch {}
  }
  if (record.photo_path) return [resolvePhotoUri(record.photo_path)];
  return [];
}

export function gameEmotions(game: GameOption): { away: "joyful" | "sad" | "neutral"; home: "joyful" | "sad" | "neutral" } | null {
  if (game.cancelled) return { away: "neutral", home: "neutral" };
  if (game.homeScore == null || game.awayScore == null) return null;
  if (game.homeScore === game.awayScore) return { away: "neutral", home: "neutral" };
  if (game.homeScore > game.awayScore) return { away: "sad", home: "joyful" };
  return { away: "joyful", home: "sad" };
}

interface UseDiaryFormProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  editRecord?: JikgwanRecord | null;
  presetGame?: GameOption | null;
  presetDate?: Date | null;
}

export function useDiaryForm({ visible, onClose, onSaved, editRecord, presetGame, presetDate }: UseDiaryFormProps) {
  const { theme, isDark } = useTheme();
  const calTranslateX = useRef(new Animated.Value(0)).current;
  const now = new Date();

  const { myTeam: contextTeam } = useTeam();
  const userTeam = contextTeam || DEFAULT_TEAM_ID;

  const [step, setStep] = useState<"calendar" | "games" | "write">("calendar");
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(now);
  const [games, setGames] = useState<GameOption[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameOption | null>(null);
  const [emotion, setEmotion] = useState<string | null>(null);
  const [unlockedEmotions, setUnlockedEmotions] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const expensesLoadedRef = useRef(false);
  const [cheeredTeam, setCheeredTeam] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [seat, setSeat] = useState("");
  const [showOtherGames, setShowOtherGames] = useState(false);
  const [pendingExpenses, setPendingExpenses] = useState<{ category: ExpenseCategory; amount: string; memo: string }[]>([]);
  const [showExpenseInput, setShowExpenseInput] = useState(false);
  const [newExpenseCat, setNewExpenseCat] = useState<ExpenseCategory>("food");
  const [newExpenseAmt, setNewExpenseAmt] = useState("");
  const [newExpenseMemo, setNewExpenseMemo] = useState("");
  const [allTotems, setAllTotems] = useState<Totem[]>([]);
  const [selectedTotemIds, setSelectedTotemIds] = useState<number[]>([]);
  const [simpleAlert, setSimpleAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onOk?: () => void;
  }>({ visible: false, title: "", message: "" });
  const keyboardHeight = useKeyboardHeight();
  const [cropUri, setCropUri] = useState<string | null>(null);
  const cropQueueRef = useRef<string[]>([]);
  const cropQueueIndexRef = useRef(0);
  const croppedUrisRef = useRef<string[]>([]);

  const scrollRef = useRef<any>(null);
  const loadGamesRef = useRef<((date: Date) => Promise<void>) | null>(null);
  const gamesGenRef = useRef(0);
  const dateStr = formatDate(selectedDate);
  const dateStrShort = `${String(selectedDate.getMonth() + 1)}월 ${selectedDate.getDate()}일`;

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === calYear && today.getMonth() === calMonth;

  const cells: { day: number; isToday: boolean }[] = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: 0, isToday: false });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, isToday: isCurrentMonth && today.getDate() === d });
  }


  // Recover pending picker results when app returns to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        ImagePicker.getPendingResultAsync().then((pending) => {
          if (pending && "assets" in pending && pending.assets && (pending.assets as any[]).length > 0) {
            console.log("Recovered pending picker result on foreground");
            handlePhotoSelect((pending.assets as any[]).map((a: any) => a.uri));
          }
        }).catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (visible) {
      try { setUnlockedEmotions(getUnlockedEmotions()); } catch {}
      try { setAllTotems(getAllTotems()); } catch {}
      setSelectedTotemIds([]);
      setCheeredTeam(null);
      setPendingExpenses([]);
      setShowExpenseInput(false);
      setNewExpenseCat("food");
      setNewExpenseAmt("");
      setNewExpenseMemo("");
      if (editRecord) {
        setStep("write");
        const p = parseDotDate(editRecord.date);
        setSelectedDate(p ? new Date(p[0], p[1] - 1, p[2]) : new Date());
        setSelectedGame(null);
        setEmotion(editRecord.emotion || null);
        setContent(editRecord.memo || "");
        setPhotoUris(parseEditPhotos(editRecord));
        setCheeredTeam(editRecord.cheered_team || null);
        setIsLive(editRecord.is_live !== 0);
        setSeat(editRecord.seat || "");
        setGames([]);
        try {
          const exps = getExpensesByRecordId(editRecord.id);
          setPendingExpenses(exps.map((e) => ({ category: e.category as ExpenseCategory, amount: String(e.amount), memo: e.memo || "" })));
          expensesLoadedRef.current = true;
        } catch {
          expensesLoadedRef.current = false;
        }
        try {
          setSelectedTotemIds(getDiaryTotems(editRecord.id).map((t) => t.id));
        } catch {}
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
        if (contextTeam) {
          if (presetGame.homeTeam === contextTeam || presetGame.awayTeam === contextTeam) {
            setCheeredTeam(contextTeam);
          } else {
            setCheeredTeam(null);
          }
        }
        return;
      } else if (presetDate) {
        setStep("games");
        setSelectedDate(presetDate);
        setSelectedGame(null);
        setEmotion(null);
        setContent("");
        setPhotoUris([]);
        setIsLive(true);
        setSeat("");
        setGames([]);
        loadGamesRef.current?.(presetDate);
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
    }
  }, [visible, editRecord, presetGame, presetDate]);

  const loadGames = useCallback(async (date: Date) => {
    const gen = ++gamesGenRef.current;
    setGamesLoading(true);
    try {
      const month = date.getMonth() + 1;
      const apiDate = formatDateForApi(date);
      const [schedule, scores] = await Promise.all([
        cachedScheduleByMonth(month, date.getFullYear()),
        cachedDailyScores(apiDate),
      ]);

      if (gen !== gamesGenRef.current) return;

      const daySched = (schedule?.games ?? []).filter(
        (g: ScheduleGame) => g.date === apiDate
      );

      const scoreMap = new Map<string, ScoreEntry>();
      for (const s of scores?.games ?? []) {
        scoreMap.set(`${s.away} vs ${s.home}#${s.gameIdx ?? 0}`, s);
      }

      const schedulePairCount = new Map<string, number>();
      const gameOpts: GameOption[] = daySched.map((g: ScheduleGame) => {
        const pairKey = `${g.away} vs ${g.home}`;
        const pairIdx = schedulePairCount.get(pairKey) || 0;
        schedulePairCount.set(pairKey, pairIdx + 1);
        const score = scoreMap.get(`${g.away} vs ${g.home}#${pairIdx}`) || scoreMap.get(`${g.away} vs ${g.home}#0`);
        const homeTeamId = TEAM_LIST.find((t) => t.shortName === g.home)?.id || "";
        const awayTeamId = TEAM_LIST.find((t) => t.shortName === g.away)?.id || "";
        let gameStatus: string | undefined = g.status;
        if (score) {
          if (score.outcome != null) {
            gameStatus = "finished";
          } else if (score.awayScore != null || score.homeScore != null) {
            gameStatus = "live";
          }
        }
        return {
          gameId: "",
          homeTeam: homeTeamId,
          awayTeam: awayTeamId,
          homeScore: score?.outcome != null && !(score?.homeScore === 0 && score?.awayScore === 0) ? (score?.homeScore ?? null) : null,
          awayScore: score?.outcome != null && !(score?.homeScore === 0 && score?.awayScore === 0) ? (score?.awayScore ?? null) : null,
          cancelled: score?.cancelled ?? false,
          venue: resolveVenue(homeTeamId, g.venue),
          time: g.time || "",
          isExhibition: g.isExhibition,
          isPostseason: g.isPostseason,
          gameStatus,
          pairIdx,
        };
      });

      const sorted = [...gameOpts].sort((a, b) => {
        const aMy = userTeam && (a.homeTeam === userTeam || a.awayTeam === userTeam);
        const bMy = userTeam && (b.homeTeam === userTeam || b.awayTeam === userTeam);
        if (aMy && !bMy) return -1;
        if (!aMy && bMy) return 1;
        return 0;
      });

      setGames(sorted);
    } catch {
      setGames([]);
    } finally {
      setGamesLoading(false);
    }
  }, [userTeam, calYear]);
  loadGamesRef.current = loadGames;

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
    if (game.cancelled) {
      setCheeredTeam(null);
      setStep("write");
      return;
    }
    setCheeredTeam(null);
    setStep("write");
  };

  const handlePhotoSelect = (uris: string[]) => {
    cropQueueRef.current = [...uris];
    cropQueueIndexRef.current = 0;
    croppedUrisRef.current = [];
    if (uris.length > 0) {
      setCropUri(uris[0]);
    }
  };

  const handleFullGalleryPick = async () => {
    const launchPicker = () => ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });

    let result: ImagePicker.ImagePickerResult;
    try {
      result = await launchPicker();
    } catch (e: any) {
      console.error("handleFullGalleryPick attempt 1 failed", e?.message ?? e);
      // Stale Activity reference: wait 300ms for Android to settle new Activity
      await new Promise(r => setTimeout(r, 300));
      try {
        result = await launchPicker();
      } catch (e2: any) {
        console.error("handleFullGalleryPick attempt 2 failed", e2?.message ?? e2);
        try {
          const pending = await ImagePicker.getPendingResultAsync();
          if (pending && "assets" in pending && pending.assets && pending.assets.length > 0) {
            console.log("Recovered from Activity destruction via getPendingResultAsync");
            handlePhotoSelect(pending.assets.map((a) => a.uri));
            return;
          }
        } catch {}
        setSimpleAlert({ visible: true, title: "오류", message: "사진을 불러오지 못했습니다\n앱을 재시작해 주세요" });
        return;
      }
    }

    if (!result.canceled && result.assets.length > 0) {
      handlePhotoSelect(result.assets.map((a) => a.uri));
    }
  };

  const handleSave = async () => {
    if (saving || savingRef.current) return;
    savingRef.current = true;

    let expensesToSave = pendingExpenses;
    if (showExpenseInput) {
      const amt = parseInt(newExpenseAmt.replace(/,/g, ""));
      if (!amt || amt <= 0) {
        savingRef.current = false;
        setSimpleAlert({ visible: true, title: "알림", message: "올바른 금액을 입력해주세요" });
        return;
      }
      expensesToSave = [...pendingExpenses, { category: newExpenseCat, amount: String(amt), memo: newExpenseMemo }];
      setPendingExpenses(expensesToSave);
      setShowExpenseInput(false);
      setNewExpenseAmt("");
      setNewExpenseMemo("");
    }

    if (!emotion) {
      savingRef.current = false;
      setSimpleAlert({ visible: true, title: "알림", message: "감정표현을 선택해주세요" });
      return;
    }
    setSaving(true);
    try {
      let savedPhotoUris: string[] = [];
      if (photoUris.length > 0) {
        let failedCount = 0;
        for (const uri of photoUris) {
          // 이미 jikgwan/에 저장된 사진은 재처리 없이 URI만 재구성 (API 경로 변경 대응)
          if (uri.includes("jikgwan/")) {
            savedPhotoUris.push(resolvePhotoUri(uri));
            continue;
          }
          try {
            const resized = await resizePhoto(uri);
            const fileName = generatePhotoName();
            const savedUri = await savePhoto(resized, fileName);
            savedPhotoUris.push(savedUri);
          } catch (e) {
            failedCount++;
            console.warn("사진 저장 실패", uri, e);
          }
        }
        if (failedCount > 0 && savedPhotoUris.length === 0) {
          savingRef.current = false;
          setSaving(false);
          setSimpleAlert({ visible: true, title: "저장 오류", message: "사진을 저장하지 못했습니다" });
          return;
        }
      }
      const photosJson = savedPhotoUris.length > 0 ? JSON.stringify(savedPhotoUris) : null;

      // 타팀 경기 감지 — 유저팀이 아닌 경기에서는 cheeredTeam null을 유지
      const gameTeams = selectedGame
        ? { h: selectedGame.homeTeam, a: selectedGame.awayTeam }
        : editRecord?.game_id
          ? (() => { const r = parseGameTeamIds(editRecord.game_id); return { h: r.homeId, a: r.awayId }; })()
          : null;
      const isMyGame = !!gameTeams && (gameTeams.h === userTeam || gameTeams.a === userTeam);
      const targetTeam = cheeredTeam || (isMyGame ? userTeam : null);
      let isWin: number | null = null;

      const isFutureGame = (() => {
        const p2 = parseDotDate(dateStr);
        if (!p2) return false;
        const d = new Date(p2[0], p2[1] - 1, p2[2]);
        const today2 = new Date(); today2.setHours(0, 0, 0, 0);
        return d > today2;
      })();

      if (targetTeam && !isFutureGame) {
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
        }
      }

      const datePrefix = dateStr.replace(/\./g, "");
      let gameId = "";
      try {
        if (selectedGame?.awayTeam && selectedGame?.homeTeam) {
          gameId = buildGameId(selectedGame.awayTeam, selectedGame.homeTeam, datePrefix, String(selectedGame.pairIdx ?? 0));
        }
      } catch {}

      getDb().runSync("BEGIN IMMEDIATE");
      try {
        let recordId: number;
        if (editRecord) {
          recordId = editRecord.id;
          if (expensesLoadedRef.current) {
            try {
              deleteExpensesByRecordId(recordId);
            } catch (e) {
              console.warn("Failed to delete old expenses (non-critical)", e);
            }
          }
          for (const exp of expensesToSave) {
            const amt = parseInt(String(exp.amount).replace(/,/g, ""));
            if (!amt || amt <= 0) continue;
            addExpense({ record_id: recordId, date: dateStr, category: exp.category, amount: amt, memo: exp.memo || null });
          }
          updateJikgwanRecord(recordId, {
            memo: content.trim(),
            emotion: emotion || null,
            photos: photosJson,
            game_id: gameId || editRecord.game_id,
            score_away: selectedGame?.awayScore != null && !(selectedGame?.awayScore === 0 && selectedGame?.homeScore === 0) ? selectedGame.awayScore : (editRecord.score_away ?? null),
            score_home: selectedGame?.homeScore != null && !(selectedGame?.homeScore === 0 && selectedGame?.awayScore === 0) ? selectedGame.homeScore : (editRecord.score_home ?? null),
            is_win: isWin,
            cheered_team: (cheeredTeam || (isMyGame ? userTeam : null)) as string | null,
            is_live: isLive ? 1 : 0,
            seat: seat.trim() || null,
            stadium: selectedGame?.venue || editRecord.stadium || null,
            game_type: selectedGame?.isPostseason ? "postseason" : selectedGame?.isExhibition ? "exhibition" : (editRecord.game_type ?? null),
            game_status: selectedGame?.gameStatus || editRecord.game_status || null,
          });
        } else {
          recordId = addJikgwanRecord({
            game_id: gameId || "",
            date: dateStr,
            photo_path: savedPhotoUris[0] || null,
            photos: photosJson,
            memo: content.trim(),
            score_away: selectedGame?.awayScore != null && !(selectedGame?.awayScore === 0 && selectedGame?.homeScore === 0) ? selectedGame.awayScore : null,
            score_home: selectedGame?.homeScore != null && !(selectedGame?.homeScore === 0 && selectedGame?.awayScore === 0) ? selectedGame.homeScore : null,
            emotion: emotion || null,
            three_line_1: null,
            three_line_2: null,
            three_line_3: null,
            frame_style: "classic",
            stadium: selectedGame?.venue || null,
            is_win: isWin != null ? isWin : null,
            cheered_team: (cheeredTeam || (isMyGame ? userTeam : null)) as string | null,
            is_live: isLive ? 1 : 0,
            seat: seat.trim() || null,
            game_type: selectedGame?.isPostseason ? "postseason" : selectedGame?.isExhibition ? "exhibition" : null,
            game_status: selectedGame?.gameStatus || null,
          });
          for (const exp of expensesToSave) {
            const amt = parseInt(String(exp.amount).replace(/,/g, ""));
            if (!amt || amt <= 0) continue;
            addExpense({ record_id: recordId, date: dateStr, category: exp.category, amount: amt, memo: exp.memo || null });
          }
        }
        setDiaryTotems(recordId, selectedTotemIds);
        getDb().runSync("COMMIT");
      } catch (e) {
        getDb().runSync("ROLLBACK");
        throw e;
      }

      onSaved();
    } catch (e) {
      console.warn("DiaryEntryModal handleSave error", e);
      const msg = e instanceof Error ? e.message : String(e);
      setSimpleAlert({ visible: true, title: "저장 오류", message: msg });
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  };

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
  const calPrevRef = useRef(calPrev);
  calPrevRef.current = calPrev;
  const calNextRef = useRef(calNext);
  calNextRef.current = calNext;

  const calMonthPanGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onUpdate((e) => { calTranslateX.setValue(Math.max(-40, Math.min(40, e.translationX))); })
    .onEnd((e) => {
      if (e.translationX > 60) calPrevRef.current();
      else if (e.translationX < -60) calNextRef.current();
      Animated.spring(calTranslateX, { toValue: 0, useNativeDriver: true }).start();
    });

  const styles = useMemo(() => StyleSheet.create({
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
    headerSaveBtn: {
      paddingVertical: 8, paddingHorizontal: 16,
      borderRadius: 10, backgroundColor: theme.foreground,
      alignItems: "center", minWidth: 52,
    },
    headerSaveText: { fontSize: 14, fontWeight: "700", color: theme.background },
    headerCancelBtn: {
      paddingVertical: 8, paddingHorizontal: 16,
      borderRadius: 10, borderWidth: 1, borderColor: theme.border,
      alignItems: "center",
    },
    headerCancelText: { fontSize: 14, color: theme.foreground, fontWeight: "600" },

    scrollContent: { padding: 20, paddingTop: 0 },

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

    loadingBox: { alignItems: "center", paddingVertical: 40, gap: 12 },
    loadingText: { fontSize: 13, color: theme.mutedForeground },
    noGamesBox: { alignItems: "center", paddingVertical: 40, gap: 12 },
    noGamesIcon: { fontSize: 40 },
    noGamesText: { fontSize: 14, color: theme.mutedForeground },
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
    exhibitionBadge: {
      backgroundColor: theme.muted,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    exhibitionBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.mutedForeground,
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

    selectedGameBanner: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 10, marginBottom: 20,
      backgroundColor: theme.muted, borderRadius: 12, padding: 12,
    },
    selectedGameText: { fontSize: 14, fontWeight: "700", color: theme.foreground },

    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: theme.foreground, marginBottom: 10 },

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
    photoRepBadge: {
      position: "absolute", bottom: 2, left: 2,
      backgroundColor: "rgba(0,0,0,0.65)",
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    photoRepBadgeText: {
      color: "#fff", fontSize: 9, fontWeight: "700",
    },

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

    expenseSectionHeader: {
      flexDirection: "row", alignItems: "center",
      justifyContent: "space-between",
    },
    expenseTotal: {
      fontSize: 12, color: theme.mutedForeground, fontWeight: "600",
    },
    expenseCard: {
      backgroundColor: theme.card, borderRadius: 10,
      padding: 12, marginTop: 6,
      borderWidth: 1, borderColor: theme.border,
    },
    expenseCardMain: {
      flexDirection: "row", alignItems: "center", gap: 8,
    },
    expenseCardIcon: { fontSize: 15 },
    expenseCardLabel: { fontSize: 13, color: theme.foreground, fontWeight: "600", width: 50 },
    expenseCardAmount: {
      flex: 1, fontSize: 13, color: theme.foreground,
      fontWeight: "700", textAlign: "right",
    },
    expenseCardRemove: {
      fontSize: 14, color: theme.mutedForeground, paddingLeft: 4,
    },
    expenseCardMemo: {
      fontSize: 11, color: theme.mutedForeground,
      marginTop: 4, marginLeft: 22,
    },
    expenseAddLink: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
      paddingVertical: 12, marginTop: 6,
      borderRadius: 12, borderWidth: 1,
      borderColor: theme.border, borderStyle: "dashed",
    },
    expenseAddLinkText: {
      fontSize: 13, fontWeight: "600", color: theme.mutedForeground,
    },

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

    alertOverlay: {
      position: "absolute",
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
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
  }), [theme]);

  return {
    step, setStep,
    calYear, setCalYear,
    calMonth, setCalMonth,
    selectedDate,
    games, gamesLoading,
    selectedGame, setSelectedGame,
    emotion, setEmotion,
    unlockedEmotions,
    content, setContent,
    photoUris, setPhotoUris,
    saving,
    cheeredTeam, setCheeredTeam,
    isLive, setIsLive,
    seat, setSeat,
    showOtherGames, setShowOtherGames,
    pendingExpenses, setPendingExpenses,
    showExpenseInput, setShowExpenseInput,
    newExpenseCat, setNewExpenseCat,
    newExpenseAmt, setNewExpenseAmt,
    newExpenseMemo, setNewExpenseMemo,
    allTotems,
    selectedTotemIds, setSelectedTotemIds,
    simpleAlert, setSimpleAlert,
    keyboardHeight,
    cropUri, setCropUri, cropQueueRef, cropQueueIndexRef, croppedUrisRef,
    scrollRef,
    isDark,
    userTeam,
    contextTeam,
    theme,
    dateStr, dateStrShort,
    daysInMonth, firstDay,
    cells,
    calTranslateX, calPrev, calNext, calMonthPanGesture,
    handleDateSelect, handleGameSelect,
    handlePhotoSelect, handleFullGalleryPick,
    handleSave,
    styles,
    editRecord, presetGame, presetDate, onClose, onSaved,
  } as const;
}
