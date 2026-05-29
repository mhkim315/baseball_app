import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator } from "react-native";
import BottomSheet from "@/components/BottomSheet";
import StickerContent from "@/components/StickerContent";
import { captureRef } from "react-native-view-shot";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { computeTeamStreak, resolveHashtags } from "@/lib/sticker";
import { getTeamDiaryStats, getJikgwanRecords } from "@/lib/db";
import { computeStreakStats } from "@/lib/stats";
import { TEAM_COLORS } from "@shared/teamColors";
import { useTheme } from "@/lib/ThemeContext";

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
}

const BG_OPTIONS: { key: "transparent" | "masking" | "receipt"; label: string }[] = [
  { key: "transparent", label: "투명" },
  { key: "masking", label: "마스킹 테이프" },
  { key: "receipt", label: "찢어진 영수증" },
];

export default function StickerModal({
  visible, onClose, awayTeam, homeTeam, awayScore, homeScore,
  awayRank, homeRank, date, scoreBoard, rheb,
}: StickerModalProps) {
  const { theme } = useTheme();
  const viewRef = useRef<View>(null);

  // Editor controls
  const [background, setBackground] = useState<"transparent" | "masking" | "receipt">("transparent");
  const [stroke, setStroke] = useState(true);
  const [showBadge, setShowBadge] = useState(true);
  const [capturing, setCapturing] = useState(false);

  // Sticker data
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ winRate: number; wins: number; draws: number; losses: number } | null>(null);
  const [teamTag, setTeamTag] = useState("");
  const [myTag, setMyTag] = useState("");
  const [customTag, setCustomTag] = useState("");

  // Colors & display names
  const awayColor = TEAM_COLORS[awayTeam]?.primary ?? "#111";
  const homeColor = TEAM_COLORS[homeTeam]?.primary ?? "#111";
  const awayDisplay = TEAM_COLORS[awayTeam]?.shortName ?? awayTeam;
  const homeDisplay = TEAM_COLORS[homeTeam]?.shortName ?? homeTeam;

  // Determine actual game result from scores (home team perspective)
  const actualResult = useMemo((): "win" | "lose" | "draw" => {
    if (homeScore === awayScore) return "draw";
    return homeScore > awayScore ? "win" : "lose";
  }, [homeScore, awayScore]);

  // Load stats and compute hashtags on mount
  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    let cancelled = false;

    (async () => {
      try {
        const year = parseInt(date.slice(0, 4), 10);
        const [teamStats, teamStreak, allRecords] = await Promise.all([
          getTeamDiaryStats(homeTeam),
          computeTeamStreak(year, homeTeam),
          getJikgwanRecords(),
        ]);

        const teamRecords = allRecords.filter((r) => r.cheered_team === homeTeam);
        const myStreakResult = computeStreakStats(teamRecords, year);

        // 1. 올해 기준 직관 기록 (isFirstWin, isFirstGame 용도)
        const teamRecordsThisYear = teamRecords.filter(r => r.date.startsWith(String(year)));
        const winsThisYear = teamRecordsThisYear.filter(r => r.is_win).length;
        const isFirstGame = teamRecordsThisYear.length === 0;
        const isFirstWin = winsThisYear === 0 && !isFirstGame;

        // 2. 현재 경기 결과를 내 연승에 수동 반영 (DB 저장 전이므로)
        let myCurrentType = myStreakResult.currentType;
        let myCurrentCount = myStreakResult.currentCount;
        if (actualResult === "win") {
          if (myCurrentType === "W") myCurrentCount++;
          else { myCurrentType = "W"; myCurrentCount = 1; }
        } else if (actualResult === "lose") {
          if (myCurrentType === "L") myCurrentCount++;
          else { myCurrentType = "L"; myCurrentCount = 1; }
        }

        const hashtags = resolveHashtags(
          teamStreak,
          { type: myCurrentType as "W" | "L" | null, count: myCurrentCount },
          actualResult,
          { isHome: true, isFirstWin, isFirstGame },
        );

        if (!cancelled) {
          setStats({
            winRate: teamStats.overall.winRate,
            wins: teamStats.overall.wins,
            draws: teamStats.overall.draws,
            losses: teamStats.overall.losses,
          });
          setTeamTag(hashtags.teamTag);
          setMyTag(hashtags.myTag);
          setCustomTag("");
          setLoading(false);
        }
      } catch (e) {
        console.warn("StickerModal load failed", e);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [visible, homeTeam, date, actualResult]);

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    setCapturing(true);
    try {
      const base64 = await captureRef(viewRef.current, { format: "png", result: "base64" });
      try {
        await Clipboard.setImageAsync(`data:image/png;base64,${base64}`);
        Alert.alert("완료", "클립보드에 복사되었습니다.\n인스타그램 스토리에 붙여넣기 하세요.");
      } catch {
        console.warn("Clipboard.setImageAsync failed, falling back to share");
        try {
          const uri = await captureRef(viewRef.current, { format: "png", result: "tmpfile" });
          await Sharing.shareAsync(uri, { mimeType: "image/png" });
        } catch {
          Alert.alert("오류", "스티커 공유에 실패했습니다.");
        }
      }
    } catch {
      Alert.alert("오류", "스티커 생성에 실패했습니다.");
    } finally {
      setCapturing(false);
    }
  }, []);

  // Reset state on close
  const handleClose = useCallback(() => {
    setBackground("transparent");
    setStroke(true);
    setShowBadge(true);
    setCapturing(false);
    setCustomTag("");
    onClose();
  }, [onClose]);

  return (
    <BottomSheet visible={visible} onClose={handleClose} maxHeight="88%">
      <View style={{ flex: 1 }}>
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
                  awayScore={awayScore}
                  homeScore={homeScore}
                  awayRank={awayRank}
                  homeRank={homeRank}
                  date={date}
                  scoreBoard={scoreBoard ?? null}
                  rheb={rheb ?? null}
                  gameResult={actualResult}
                  background={background}
                  stroke={stroke}
                  showBadge={showBadge}
                  teamTag={teamTag}
                  myTag={myTag}
                  customTag={customTag}
                  stats={stats}
                />
              </View>
            )}
          </View>

          {/* ── Controls ── */}
          {/* Background selector */}
          <View style={s.controlSection}>
            <Text style={s.controlLabel}>배경</Text>
            <View style={s.chipRow}>
              {BG_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={[s.chip, background === opt.key && s.chipActive]}
                  onPress={() => setBackground(opt.key)}
                >
                  <Text style={[s.chipText, background === opt.key && s.chipTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Stroke toggle */}
          <View style={s.toggleRow}>
            <Text style={s.controlLabel}>외곽선</Text>
            <Pressable style={[s.toggle, stroke && s.toggleActive]} onPress={() => setStroke(!stroke)}>
              <Text style={[s.toggleText, stroke && s.toggleTextActive]}>
                {stroke ? "ON" : "OFF"}
              </Text>
            </Pressable>
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

          {/* Copy button */}
          <Pressable
            style={[s.copyBtn, (capturing || loading) && s.copyBtnDisabled]}
            onPress={handleCopy}
            disabled={capturing || loading}
          >
            {capturing ? (
              <View style={s.copyBtnInner}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={s.copyBtnText}> 생성 중...</Text>
              </View>
            ) : (
              <Text style={s.copyBtnText}>📋 인스타 스티커 복사</Text>
            )}
          </Pressable>

          <Text style={s.hint}>스티커가 클립보드에 복사됩니다. 인스타그램 스토리에 붙여넣기 하세요.</Text>
        </ScrollView>
      </View>
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
  copyBtnDisabled: { opacity: 0.6 },
  copyBtnInner: { flexDirection: "row", alignItems: "center" },
  copyBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  hint: { fontSize: 11, color: "#bbb", textAlign: "center" },
});
