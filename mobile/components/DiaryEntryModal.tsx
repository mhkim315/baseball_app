import { useState, useEffect, useCallback } from "react";
import {
  View, Text, Pressable, TextInput, Modal, StyleSheet, Image,
  Alert, ActivityIndicator, ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { TEAM_COLORS, TEAM_LIST } from "@shared/teamColors";
import EmotionPicker from "@/components/EmotionPicker";
import { TeamBadge } from "@/components/TeamBadge";
import { theme } from "@/lib/theme";
import { addJikgwanRecord, getMyTeam } from "@/lib/db";
import { savePhoto, resizePhoto, generatePhotoName } from "@/lib/camera";
import { fetchScheduleByMonth, fetchDailyScores, type ScheduleGame, type ScoreEntry } from "@/lib/api";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}
function formatDate(d: Date): string {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}
function formatDateForApi(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function gameEmotions(game: GameOption): { away: "joyful" | "sad" | "neutral"; home: "joyful" | "sad" | "neutral" } | null {
  if (game.cancelled) return { away: "neutral", home: "neutral" };
  if (game.homeScore == null || game.awayScore == null) return null;
  if (game.homeScore === game.awayScore) return { away: "neutral", home: "neutral" };
  if (game.homeScore > game.awayScore) return { away: "sad", home: "joyful" };
  return { away: "joyful", home: "sad" };
}

// Game data for the selected date
interface GameOption {
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
}

export default function DiaryEntryModal({ visible, onClose, onSaved }: DiaryEntryModalProps) {
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
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [line3, setLine3] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [userTeam, setUserTeam] = useState("doosan");

  const dateStr = formatDate(selectedDate);
  const dateStrShort = `${String(selectedDate.getMonth() + 1)}월 ${selectedDate.getDate()}일`;

  // Reset on open
  useEffect(() => {
    if (visible) {
      setStep("calendar");
      setSelectedDate(new Date());
      setSelectedGame(null);
      setEmotion(null);
      setLine1("");
      setLine2("");
      setLine3("");
      setPhotoUri(null);
      setGames([]);
      getMyTeam().then((t) => { if (t) setUserTeam(t); });
    }
  }, [visible]);

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

      setGames(gameOpts.slice(0, 5));
    } catch {
      setGames([]);
    } finally {
      setGamesLoading(false);
    }
  }, []);

  const handleDateSelect = (d: number) => {
    const date = new Date(calYear, calMonth, d);
    setSelectedDate(date);
    loadGames(date);
    setStep("games");
  };

  const handleGameSelect = (game: GameOption) => {
    setSelectedGame(game);
    setStep("write");
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("권한 필요", "앨범 접근 권한이 필요합니다");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    if (!line1.trim() && !line2.trim() && !line3.trim()) {
      Alert.alert("알림", "내용을 입력해주세요");
      return;
    }
    setSaving(true);
    try {
      let savedPhotoUri: string | null = null;
      if (photoUri) {
        const resized = await resizePhoto(photoUri);
        const fileName = generatePhotoName();
        savedPhotoUri = await savePhoto(resized, fileName);
      }

      const myTeam = await getMyTeam();
      let isWin: number | null = null;
      if (selectedGame && myTeam && selectedGame.homeScore != null && selectedGame.awayScore != null) {
        if (selectedGame.homeTeam === myTeam) {
          isWin = selectedGame.homeScore > selectedGame.awayScore ? 1
            : selectedGame.homeScore < selectedGame.awayScore ? -1 : 0;
        } else if (selectedGame.awayTeam === myTeam) {
          isWin = selectedGame.awayScore > selectedGame.homeScore ? 1
            : selectedGame.awayScore < selectedGame.homeScore ? -1 : 0;
        }
      }

      await addJikgwanRecord({
        game_id: "",
        date: dateStr,
        photo_path: savedPhotoUri,
        memo: null,
        score_away: selectedGame?.awayScore ?? null,
        score_home: selectedGame?.homeScore ?? null,
        emotion,
        three_line_1: line1.trim() || null,
        three_line_2: line2.trim() || null,
        three_line_3: line3.trim() || null,
        frame_style: "classic",
        stadium: selectedGame?.venue || null,
        is_win: isWin,
      });

      Alert.alert("저장 완료", "직관 기록이 저장되었습니다");
      onSaved();
    } catch {
      Alert.alert("오류", "저장 중 문제가 발생했습니다");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

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
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handleRow}>
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
                <Pressable onPress={() => setStep("games")} hitSlop={8}>
                  <Text style={styles.backArrow}>◀</Text>
                </Pressable>
                <Text style={styles.stepTitle}>기록 작성</Text>
                <View style={{ width: 20 }} />
              </View>
            )}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
                      <Text style={styles.writeWithoutGameText}>기록만 남기기</Text>
                    </Pressable>
                  </View>
                ) : (
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
                              <Text style={[styles.gameTeamName, { color: away?.primary }]}>
                                {away?.shortName || "?"}
                              </Text>
                              {hasScore && (
                                <Text style={styles.gameScore}>{g.awayScore}</Text>
                              )}
                            </View>
                            {g.cancelled ? (
                              <Text style={styles.gameVs}>취소</Text>
                            ) : (
                              <Text style={styles.gameVs}>VS</Text>
                            )}
                            <View style={styles.gameTeamRow}>
                              {hasScore && (
                                <Text style={styles.gameScore}>{g.homeScore}</Text>
                              )}
                              <Text style={[styles.gameTeamName, { color: home?.primary }]}>
                                {home?.shortName || "?"}
                              </Text>
                              <TeamBadge teamId={g.homeTeam} size="sm" emotion={emotions?.home ?? "default"} />
                            </View>
                          </View>
                          <View style={styles.gameMetaRow}>
                            <Text style={styles.gameMeta}>{g.time}</Text>
                            {g.venue && <Text style={styles.gameMeta}>{g.venue}</Text>}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
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

                {/* Emotion */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>오늘의 기분</Text>
                  <EmotionPicker value={emotion} onChange={setEmotion} teamId={userTeam} />
                </View>

                {/* Photo */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>사진</Text>
                  {photoUri ? (
                    <View style={styles.photoPreview}>
                      <Image source={{ uri: photoUri }} style={styles.photo} />
                      <Pressable style={styles.removePhoto} onPress={() => setPhotoUri(null)}>
                        <Text style={styles.removePhotoText}>제거</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable style={styles.photoBtn} onPress={pickPhoto}>
                      <Text style={styles.photoBtnIcon}>🖼️</Text>
                      <Text style={styles.photoBtnText}>앨범에서 선택</Text>
                    </Pressable>
                  )}
                </View>

                {/* 3-line diary */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>세줄일기</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      value={line1}
                      onChangeText={setLine1}
                      placeholder="💭 오늘의 감정"
                      placeholderTextColor="#999"
                      maxLength={30}
                      multiline
                    />
                    <Text style={styles.charCount}>{line1.length}/30</Text>
                  </View>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      value={line2}
                      onChangeText={setLine2}
                      placeholder="📝 있었던 일"
                      placeholderTextColor="#999"
                      maxLength={50}
                      multiline
                    />
                    <Text style={styles.charCount}>{line2.length}/50</Text>
                  </View>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      value={line3}
                      onChangeText={setLine3}
                      placeholder="🌟 내일의 다짐"
                      placeholderTextColor="#999"
                      maxLength={30}
                      multiline
                    />
                    <Text style={styles.charCount}>{line3.length}/30</Text>
                  </View>
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: theme.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    paddingBottom: 32,
  },
  handleRow: { alignItems: "center", paddingVertical: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border },

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
  },
  writeWithoutGameText: { fontSize: 13, fontWeight: "600", color: theme.foreground },
  gameList: { gap: 10 },
  gameCard: {
    backgroundColor: theme.card, borderRadius: 14, borderWidth: 1,
    borderColor: theme.border, padding: 14,
  },
  gameCardTop: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
  },
  gameTeamRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  gameTeamName: { fontSize: 14, fontWeight: "600" },
  gameScore: { fontSize: 18, fontWeight: "700", color: theme.foreground },
  gameVs: { fontSize: 12, color: theme.mutedForeground, fontWeight: "600" },
  gameMetaRow: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 8,
  },
  gameMeta: { fontSize: 11, color: theme.mutedForeground },

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

  // Photo
  photoPreview: { position: "relative", borderRadius: 12, overflow: "hidden" },
  photo: { width: "100%", height: 200, resizeMode: "cover", borderRadius: 12 },
  removePhoto: {
    position: "absolute", top: 8, right: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  removePhotoText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  photoBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 24, borderRadius: 12,
    borderWidth: 1, borderColor: theme.border, borderStyle: "dashed",
    backgroundColor: theme.muted,
  },
  photoBtnIcon: { fontSize: 20 },
  photoBtnText: { fontSize: 13, color: theme.mutedForeground, fontWeight: "500" },

  // Input
  inputRow: { position: "relative", marginBottom: 10 },
  input: {
    backgroundColor: theme.card, borderRadius: 12,
    padding: 14, paddingRight: 50,
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
});
