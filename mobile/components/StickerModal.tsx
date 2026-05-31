import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import BottomSheet from "@/components/BottomSheet";
import StickerContent from "@/components/StickerContent";
import { captureRef } from "react-native-view-shot";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { computeTeamStreak, resolveHashtags, type TeamStreakInfo } from "@/lib/sticker";
import { getJikgwanRecords, getUnlockedBackgrounds } from "@/lib/db";
import { getInningInfo } from "@shared/gameStatus";
import type { JikgwanRecord } from "@/lib/db";
import { computeStreakStats, computeDiaryStats } from "@/lib/stats";
import { resolveIsWin } from "@/lib/expenseStats";
import { TEAM_COLORS } from "@shared/teamColors";
import { STADIUM_BRIEFS, TEAM_STADIUM_MAP } from "@/lib/stadiumData";
import { BgKey, BG_OPTIONS } from "@/lib/backgrounds";
import { useTheme } from "@/lib/ThemeContext";
import { useTeam } from "@/lib/TeamContext";
import ColorPicker from "@/components/ColorPicker";
import SimpleAlert from "@/components/SimpleAlert";

interface ScoreBoardInn {
  away: (number | null)[];
  home: (number | null)[];
}

interface RHEB {
  away: { r: number; h: number; e: number };
  home: { r: number; h: number; e: number };
}

interface StickerModalProps {
  visible: boolean;
  onClose: () => void;
  awayTeam: string;
  homeTeam: string;
  awayScore: number;
  homeScore: number;
  awayRank?: string;
  homeRank?: string;
  date: string;
  scoreBoard?: ScoreBoardInn | null;
  rheb?: RHEB | null;
  isLive?: boolean;
  isFinished?: boolean;
  liveInning?: { inning: number; isTop: boolean } | null;
  gameId?: string;
  venue?: string;
}



export default function StickerModal({
  visible, onClose, awayTeam, homeTeam, awayScore, homeScore,
  awayRank, homeRank, date, scoreBoard, rheb,
  isLive, isFinished, liveInning, gameId, venue,
}: StickerModalProps) {
  const { theme } = useTheme();
  const { myTeam } = useTeam();
  const viewRef = useRef<View>(null);

  // Live Score Controls
  const [localScoreBoard, setLocalScoreBoard] = useState<ScoreBoardInn | null>(null);
  const [localAwayScore, setLocalAwayScore] = useState(0);
  const [localHomeScore, setLocalHomeScore] = useState(0);
  const [liveTimestamp, setLiveTimestamp] = useState("");

  useEffect(() => {
    if (scoreBoard) {
      setLocalScoreBoard(JSON.parse(JSON.stringify(scoreBoard)));
      setLocalAwayScore(awayScore);
      setLocalHomeScore(homeScore);
    } else {
      setLocalScoreBoard(null);
      setLocalAwayScore(awayScore);
      setLocalHomeScore(homeScore);
    }
  }, [scoreBoard, awayScore, homeScore]);

  const adjustScore = useCallback((team: "away" | "home") => {
    setLocalScoreBoard((prev) => {
      if (!prev) return prev;
      const info = getInningInfo(prev);
      if (!info) return prev;

      const battingSide = info.isTop ? "away" : "home";
      const next = JSON.parse(JSON.stringify(prev)) as ScoreBoardInn;

      if (team === battingSide) {
        // Case 1: 공격팀 득점 -> 같은 이닝 유지
        const arr = next[team];
        const currentScore = arr[arr.length - 1] ?? 0;
        arr[arr.length - 1] = currentScore + 1;
      } else {
        // Case 2: 수비팀 득점 -> 공수교대
        next[team].push(1);
      }
      return next;
    });

    if (team === "away") setLocalAwayScore((prev) => prev + 1);
    if (team === "home") setLocalHomeScore((prev) => prev + 1);
  }, []);

  const handleResetScore = useCallback(() => {
    if (scoreBoard) {
      setLocalScoreBoard(JSON.parse(JSON.stringify(scoreBoard)));
      setLocalAwayScore(awayScore);
      setLocalHomeScore(homeScore);
    }
  }, [scoreBoard, awayScore, homeScore]);

  // Editor controls
  const [background, setBackground] = useState<BgKey>("transparent");
  const [stroke, setStroke] = useState(true);
  const [strokeColor, setStrokeColor] = useState("#ffffff");
  const [showBadge, setShowBadge] = useState(true);
  const [showScoreboard, setShowScoreboard] = useState(true);
  const [statsMode, setStatsMode] = useState<"live" | "broadcast">("live");
  const [capturing, setCapturing] = useState(false);
  const [textColor, setTextColor] = useState("");
  const [badgeColor, setBadgeColor] = useState<string | null>(null);
  const [unlockedBg, setUnlockedBg] = useState<Set<string> | null>(null);

  // Sticker data
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ winRate: number; wins: number; draws: number; losses: number } | null>(null);
  const [teamTag, setTeamTag] = useState("");
  const [myTag, setMyTag] = useState("");
  const [customTag, setCustomTag] = useState("");
  const [rawTeamStreak, setRawTeamStreak] = useState<TeamStreakInfo | null>(null);
  const [allRecords, setAllRecords] = useState<JikgwanRecord[]>([]);
  const [alert, setAlert] = useState<{ visible: boolean; title: string; message: string }>({ visible: false, title: "", message: "" });

  // Sorted backgrounds: defaults → unlocked → locked
  const sortedBgOptions = useMemo(() => {
    if (!unlockedBg) return BG_OPTIONS;
    return [...BG_OPTIONS].sort((a, b) => {
      const aLocked = !unlockedBg.has(a.key);
      const bLocked = !unlockedBg.has(b.key);
      if (aLocked && !bLocked) return 1;
      if (!aLocked && bLocked) return -1;
      return 0;
    });
  }, [unlockedBg]);

  // Colors & display names
  const awayColor = TEAM_COLORS[awayTeam]?.primary ?? "#111";
  const homeColor = TEAM_COLORS[homeTeam]?.primary ?? "#111";
  const awayDisplay = TEAM_COLORS[awayTeam]?.shortName ?? awayTeam;
  const homeDisplay = TEAM_COLORS[homeTeam]?.shortName ?? homeTeam;
  const STADIUM_DISPLAY: Record<string, string> = {
    doosan: "서울 잠실야구장", lg: "서울 잠실야구장",
    kiwoom: "서울 고척스카이돔",
    ssg: "인천 SSG랜더스필드",
    kt: "수원 KT위즈파크",
    hanwha: "대전 한화생명볼파크",
    samsung: "대구 삼성라이온즈파크",
    kia: "광주 기아챔피언스필드",
    lotte: "부산 사직야구장",
    nc: "창원 NC파크",
  };
  const stadiumName = STADIUM_DISPLAY[homeTeam] || venue || "";

  // Target team: myTeam if playing in this game, otherwise homeTeam
  const targetTeam = useMemo(() => {
    if (myTeam && (myTeam === homeTeam || myTeam === awayTeam)) return myTeam;
    return homeTeam;
  }, [myTeam, homeTeam, awayTeam]);

  // Determine actual game result from target team's perspective
  const isTargetHome = targetTeam === homeTeam;
  const actualResult = useMemo((): "win" | "lose" | "draw" | null => {
    if (isLive) return null;
    if (homeScore === awayScore) return "draw";
    const homeWon = homeScore > awayScore;
    if (isTargetHome) return homeWon ? "win" : "lose";
    return homeWon ? "lose" : "win";
  }, [homeScore, awayScore, isLive, isTargetHome]);

  // ─── Load unlocked backgrounds ───
  useEffect(() => {
    if (!visible) return;
    getUnlockedBackgrounds().then((list) => setUnlockedBg(new Set(list)));
  }, [visible]);

  // ─── Effect 1: Load raw data ───
  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    const now = new Date();
    setLiveTimestamp(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    let cancelled = false;

    (async () => {
      try {
        const year = parseInt(date.slice(0, 4), 10);
        const [teamStreakData, records] = await Promise.all([
          computeTeamStreak(year, targetTeam),
          getJikgwanRecords(),
        ]);
        if (!cancelled) {
          setRawTeamStreak(teamStreakData);
          setAllRecords(records);
          setLoading(false);
        }
      } catch (e) {
        console.warn("StickerModal load failed", e);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [visible, targetTeam, date]);

  // ─── Effect 2: Derive stats, streak & hashtags (runs on toggle too) ───
  useEffect(() => {
    if (loading || !rawTeamStreak) return;

    const year = parseInt(date.slice(0, 4), 10);

    // Filter by target team & viewing mode
    const teamRecords = allRecords.filter((r) => r.cheered_team === targetTeam);
    const modeRecords = statsMode === "live"
      ? teamRecords.filter((r) => Number(r.is_live) === 1)
      : teamRecords.filter((r) => Number(r.is_live) === 0);

    // isFirstWin / isFirstGame: 가상 레코드 추가 전에 판단
    const modeRecordsThisYear = modeRecords.filter((r) => r.date.startsWith(String(year)));
    const winsThisYear = modeRecordsThisYear.filter((r) => resolveIsWin(r) === 1).length;
    const isFirstGame = modeRecordsThisYear.length === 0;
    const isFirstWin = winsThisYear === 0 && !isFirstGame;

    // 현재 경기를 가상 레코드로 추가 → 기존 통계 함수에 그대로 전달
    // date는 DB 형식(YYYY.MM.DD)으로 통일 (filterByYear 등 호환)
    const virtualRecord: JikgwanRecord = {
      id: 0,
      game_id: gameId ?? "",
      date: date.replace(/-/g, "."),
      photo_path: null,
      photos: null,
      memo: null,
      score_away: null,
      score_home: null,
      created_at: "",
      emotion: null,
      three_line_1: null,
      three_line_2: null,
      three_line_3: null,
      frame_style: "",
      stadium: null,
      is_win: actualResult === "win" ? 1 : actualResult === "draw" ? 0 : actualResult === "lose" ? -1 : null,
      cheered_team: targetTeam,
      is_live: statsMode === "live" ? 1 : 0,
      seat: null,
      game_type: null,
      game_status: null,
    };
    // 오늘 경기의 기존 다이어리 기록 제외 → virtualRecord로만 반영 (중복 방지)
    const filteredRecords = gameId ? modeRecords.filter((r) => r.game_id !== gameId) : modeRecords;
    const augmentedRecords = [...filteredRecords, virtualRecord];

    // 승률 = computeDiaryStats (가상 레코드 포함)
    const diaryStats = computeDiaryStats(augmentedRecords, year);
    setStats({
      winRate: diaryStats.winRate,
      wins: diaryStats.wins,
      draws: diaryStats.draws,
      losses: diaryStats.losses,
    });

    // 개인 연승 = computeStreakStats (가상 레코드 포함, 별도 보정 불필요)
    const myStreakResult = computeStreakStats(augmentedRecords, year);

    // 해시태그
    const hashtags = resolveHashtags(
      rawTeamStreak,
      { type: myStreakResult.currentType as "W" | "L" | null, count: myStreakResult.currentCount },
      actualResult,
      { isHome: true, isFirstWin, isFirstGame, statsMode },
    );

    const isOtherGame = myTeam && homeTeam !== myTeam && awayTeam !== myTeam;
    if (isOtherGame) {
      setTeamTag("책임없는쾌락");
      setMyTag("아무나이겨라");
    } else {
      const modeLiveLabel = statsMode === "broadcast" ? "집관중" : "직관중";
      const modeFallback = statsMode === "broadcast" ? "집관" : "야구장";
      setTeamTag(hashtags.teamTag || (isLive ? modeLiveLabel : ""));
      setMyTag(hashtags.myTag || (isLive ? modeFallback : ""));
    }
    setCustomTag("");
  }, [loading, allRecords, statsMode, actualResult, rawTeamStreak, targetTeam, homeTeam, myTeam, awayTeam, date]);

  // Handle copy to clipboard
  const handleCopyClipboard = useCallback(async () => {
    setCapturing(true);
    try {
      const base64 = await captureRef(viewRef.current, { format: "png", result: "base64" });
      await Clipboard.setImageAsync(base64);
      setAlert({ visible: true, title: "완료", message: "클립보드에 복사되었습니다.\n인스타그램 스토리에 붙여넣기 하세요." });
    } catch {
      setAlert({ visible: true, title: "오류", message: "클립보드 복사에 실패했습니다." });
    } finally {
      setCapturing(false);
    }
  }, []);

  // Handle share
  const handleShare = useCallback(async () => {
    setCapturing(true);
    try {
      const uri = await captureRef(viewRef.current, { format: "png", result: "tmpfile" });
      await Sharing.shareAsync(uri, { mimeType: "image/png" });
    } catch {
      setAlert({ visible: true, title: "오류", message: "스티커 공유에 실패했습니다." });
    } finally {
      setCapturing(false);
    }
  }, []);

  // Reset state on close
  const handleClose = useCallback(() => {
    setBackground("transparent");
    setStroke(true);
    setStrokeColor("#ffffff");
    setShowBadge(true);
    setShowScoreboard(true);
    setStatsMode("live");
    setTextColor("");
    setBadgeColor(null);
    setCapturing(false);
    setCustomTag("");
    onClose();
  }, [onClose]);

  return (
    <BottomSheet visible={visible} onClose={handleClose} maxHeight="88%">
      {/* Header */}
      <View style={s.header}>
          <Text style={s.headerTitle}>스티커 만들기</Text>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Text style={s.closeBtn}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {/* ── Sticker Preview ── */}
          <View style={[s.previewArea, { backgroundColor: theme.muted }]}>
            {loading ? (
              <View style={s.loadingWrap}>
                <ActivityIndicator color={theme.mutedForeground} />
              </View>
            ) : (
              <View ref={viewRef} collapsable={false}>
                <StickerContent
                  awayTeam={awayDisplay}
                  homeTeam={homeDisplay}
                  awayTeamColor={awayColor}
                  homeTeamColor={homeColor}
                  awayScore={localAwayScore}
                  homeScore={localHomeScore}
                  awayRank={awayRank}
                  homeRank={homeRank}
                  date={date}
                  scoreBoard={localScoreBoard ?? null}
                  rheb={rheb ?? null}
                  gameResult={actualResult}
                  liveInningLabel={isLive && localScoreBoard ? (() => {
                    const i = getInningInfo(localScoreBoard);
                    return i ? `${i.inning}회${i.isTop ? "초" : "말"}` : undefined;
                  })() : undefined}
                  liveTimestamp={isLive ? liveTimestamp : undefined}
                  background={background}
                  stroke={stroke}
                  strokeColor={strokeColor}
                  showBadge={showBadge}
                  showScoreboard={showScoreboard}
                  textColor={textColor || undefined}
                  badgeBackgroundColor={badgeColor === null ? undefined : (badgeColor || "")}
                  teamTag={teamTag}
                  myTag={myTag}
                  customTag={customTag}
                  statsMode={statsMode}
                  stats={stats}
                  venue={stadiumName}
                />
              </View>
            )}
          </View>

          {/* ── Live Score Control ── */}
          {isLive && localScoreBoard && (
            <View style={{ marginBottom: 24, padding: 16, backgroundColor: theme.muted, borderRadius: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: theme.foreground }}>라이브 스코어 조정</Text>
                  {(() => {
                    const info = getInningInfo(localScoreBoard);
                    if (!info) return null;
                    const label = `${info.inning}회${info.isTop ? "초" : "말"}`;
                    return (
                      <View style={{ backgroundColor: "#e53935", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 }}>
                        <Text style={{ fontSize: 12, fontWeight: "800", color: "#fff" }}>{label}</Text>
                      </View>
                    );
                  })()}
                </View>
                <Pressable onPress={handleResetScore} hitSlop={12}>
                  <Text style={{ fontSize: 12, color: theme.mutedForeground, fontWeight: "600" }}>↺ 리셋</Text>
                </Pressable>
              </View>

              <View style={{ flexDirection: "row", gap: 16 }}>
                {/* Away Control */}
                <View style={{ flex: 1, backgroundColor: theme.background, borderRadius: 8, padding: 12, alignItems: "center" }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: awayColor, marginBottom: 8 }}>
                    {awayDisplay}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Text style={{ fontSize: 18, fontWeight: "900", color: theme.foreground, width: 24, textAlign: "center" }}>{localAwayScore}</Text>
                    <Pressable onPress={() => adjustScore("away")} style={s.scoreBtn}>
                      <Text style={s.scoreBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Home Control */}
                <View style={{ flex: 1, backgroundColor: theme.background, borderRadius: 8, padding: 12, alignItems: "center" }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: homeColor, marginBottom: 8 }}>
                    {homeDisplay}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Text style={{ fontSize: 18, fontWeight: "900", color: theme.foreground, width: 24, textAlign: "center" }}>{localHomeScore}</Text>
                    <Pressable onPress={() => adjustScore("home")} style={s.scoreBtn}>
                      <Text style={s.scoreBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ── Controls ── */}
          <View style={s.controlSection}>
            <Text style={s.controlLabel}>배경</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
              {sortedBgOptions.map((opt) => {
                const locked = unlockedBg !== null && !unlockedBg.has(opt.key);
                return (
                  <Pressable
                    key={opt.key}
                    style={[s.bgChip, background === opt.key && s.chipActive]}
                    onPress={() => {
                      if (locked) {
                        setAlert({ visible: true, title: "잠금 해제 필요", message: "도전과제 레벨업 시 랜덤으로 해금됩니다.\n도전과제를 달성해서 배경을 모아보세요!" });
                      } else {
                        setBackground(opt.key);
                      }
                    }}
                  >
                    <Text style={[s.bgChipText, background === opt.key && s.chipTextActive, locked && { opacity: 0.4 }]}>
                      {opt.label}
                    </Text>
                    {locked && <Text style={s.bgLockIcon}>🔒</Text>}
                  </Pressable>
                );
              })}
              </View>
            </ScrollView>
          </View>

          {/* Stats mode toggle */}
          <View style={s.controlSection}>
            <Text style={s.controlLabel}>응원 유형</Text>
            <View style={s.chipRow}>
              {(["live", "broadcast"] as const).map((mode) => (
                <Pressable
                  key={mode}
                  style={[s.chip, statsMode === mode && s.chipActive]}
                  onPress={() => setStatsMode(mode)}
                >
                  <Text style={[s.chipText, statsMode === mode && s.chipTextActive]}>
                    {mode === "live" ? "직관" : "집관"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Scoreboard toggle */}
          <View style={[s.toggleRow]}>
            <Text style={s.controlLabel}>스코어보드</Text>
            <Pressable style={[s.toggle, showScoreboard && s.toggleActive]} onPress={() => setShowScoreboard(!showScoreboard)}>
              <Text style={[s.toggleText, showScoreboard && s.toggleTextActive]}>
                {showScoreboard ? "ON" : "OFF"}
              </Text>
            </Pressable>
          </View>

          {/* Text color */}
          <View style={s.controlSection}>
            <Text style={s.controlLabel}>글자 색상</Text>
            <ColorPicker selected={textColor} onSelect={setTextColor} showDefault />
          </View>

          {/* Badge toggle */}
          <View style={[s.toggleRow, { marginBottom: 16 }]}>
            <Text style={s.controlLabel}>승률 · 해시태그</Text>
            <Pressable style={[s.toggle, showBadge && s.toggleActive]} onPress={() => setShowBadge(!showBadge)}>
              <Text style={[s.toggleText, showBadge && s.toggleTextActive]}>
                {showBadge ? "ON" : "OFF"}
              </Text>
            </Pressable>
          </View>

          {/* Badge background color */}
          {showBadge && (
            <View style={{ marginBottom: 16 }}>
              <ColorPicker selected={badgeColor ?? ""} onSelect={setBadgeColor} showDefault defaultLabel="없음" defaultActive={badgeColor === ""} />
            </View>
          )}

          {/* Stroke toggle */}
          <View style={s.toggleRow}>
            <Text style={s.controlLabel}>외곽선</Text>
            <Pressable style={[s.toggle, stroke && s.toggleActive]} onPress={() => setStroke(!stroke)}>
              <Text style={[s.toggleText, stroke && s.toggleTextActive]}>
                {stroke ? "ON" : "OFF"}
              </Text>
            </Pressable>
          </View>

          {stroke && (
            <View style={[s.chipRow, { marginBottom: 20, paddingLeft: 2 }]}>
              {(["#ffffff", "#999999", "#111111"] as const).map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setStrokeColor(c)}
                  style={{
                    width: 28, height: 28, borderRadius: 14,
                    backgroundColor: c,
                    borderWidth: 2.5,
                    borderColor: strokeColor === c ? theme.foreground : (c === "#ffffff" ? "#ddd" : "transparent"),
                  }}
                />
              ))}
              <Pressable
                onPress={() => setStrokeColor("")}
                style={{
                  width: 28, height: 28, borderRadius: 14,
                  borderWidth: 2, borderColor: !strokeColor ? theme.foreground : theme.border,
                  alignItems: "center", justifyContent: "center",
                  backgroundColor: !strokeColor ? theme.muted : "transparent",
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: theme.mutedForeground }}>X</Text>
              </Pressable>
            </View>
          )}

          {/* Hashtag edit inputs */}
          {showBadge && (
            <View style={s.hashSection}>
              <Text style={s.hashLabel}>해시태그 직접 입력</Text>
              <View style={s.hashInputRow}>
                <Text style={s.hashPrefix}>#</Text>
                <TextInput
                  style={s.hashInput}
                  value={teamTag}
                  onChangeText={setTeamTag}
                  placeholder="팀 태그 (자동)"
                  placeholderTextColor="#ccc"
                  maxLength={15}
                />
              </View>
              <View style={s.hashInputRow}>
                <Text style={s.hashPrefix}>#</Text>
                <TextInput
                  style={s.hashInput}
                  value={myTag}
                  onChangeText={setMyTag}
                  placeholder="내 태그 (자동)"
                  placeholderTextColor="#ccc"
                  maxLength={15}
                />
              </View>
              <View style={s.hashInputRow}>
                <Text style={s.hashPrefix}>#</Text>
                <TextInput
                  style={s.hashInput}
                  value={customTag}
                  onChangeText={setCustomTag}
                  placeholder="태그입력"
                  placeholderTextColor="#ccc"
                  maxLength={15}
                />
              </View>
            </View>
          )}

          {/* Action buttons */}
          {capturing ? (
            <View style={s.copyBtn}>
              <ActivityIndicator color="#fff" size="small" />
            </View>
          ) : (
            <View style={s.actionRow}>
              <Pressable
                style={[s.actionBtn, s.clipboardBtn]}
                onPress={handleCopyClipboard}
                disabled={loading}
              >
                <Text style={s.actionBtnText}>📋 클립보드 복사</Text>
              </Pressable>
              <Pressable
                style={[s.actionBtn, s.shareBtn]}
                onPress={handleShare}
                disabled={loading}
              >
                <Text style={s.actionBtnText}>📤 공유하기</Text>
              </Pressable>
            </View>
          )}

          <Text style={s.hint}>스티커를 클립보드에 복사해서 인스타그램 스토리에 붙여넣기 하세요.</Text>
        </ScrollView>
    <SimpleAlert
      visible={alert.visible}
      title={alert.title}
      message={alert.message}
      onClose={() => setAlert({ ...alert, visible: false })}
    />
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  closeBtn: { fontSize: 20, color: "#999" },
  previewArea: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    paddingVertical: 24,
    marginHorizontal: 0,
    marginBottom: 24,
  },
  loadingWrap: { height: 300, justifyContent: "center" },
  controlSection: { marginBottom: 20 },
  controlLabel: { fontSize: 14, fontWeight: "500", color: "#666", marginBottom: 8 },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  chipActive: { backgroundColor: "#111" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#555" },
  chipTextActive: { color: "#fff" },
  scoreBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  toggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
  },
  toggleActive: { backgroundColor: "#111" },
  toggleText: { fontSize: 13, fontWeight: "600", color: "#999" },
  toggleTextActive: { color: "#fff" },
  hashSection: { marginBottom: 24 },
  hashLabel: { fontSize: 12, color: "#999", marginBottom: 8, fontWeight: "500" },
  hashInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  hashPrefix: { fontSize: 16, fontWeight: "700", color: "#111", marginRight: 4 },
  hashInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    color: "#111",
  },
  copyBtn: {
    backgroundColor: "#111",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  clipboardBtn: {
    backgroundColor: "#111",
  },
  shareBtn: {
    backgroundColor: "#555",
  },
  actionBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  hint: { fontSize: 11, color: "#bbb", textAlign: "center" },
  bgChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bgChipText: { fontSize: 13, fontWeight: "600", color: "#555" },
  bgLockIcon: { fontSize: 11 },
});
