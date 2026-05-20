import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { TEAM_COLORS } from "@shared/teamColors";
import {
  fetchGameDetail, fetchStandingsJson,
  type GameDetail, type ScoreEntry, type LineupPlayer,
} from "@/lib/api";
import { TeamBadge } from "@/components/TeamBadge";
import { cachedDailyScores, cachedScheduleByMonth } from "@/lib/gameCache";
import DiaryEntryModal, { type GameOption } from "@/components/DiaryEntryModal";
import { useTheme, teamPrimaryColor } from "@/lib/ThemeContext";

const POSITION_LABELS: Record<string, string> = {
  "1": "1B", "2": "2B", "3": "3B",
  "유": "SS", "포": "C", "중": "CF",
  "좌": "LF", "우": "RF", "지": "DH", "투": "P",
  "1루수": "1B", "2루수": "2B", "3루수": "3B",
  "유격수": "SS", "포수": "C", "중견수": "CF",
  "좌익수": "LF", "우익수": "RF", "지명타자": "DH", "투수": "P",
};

const WLS_LABELS: Record<string, string> = { W: "승", L: "패", S: "세", H: "홀" };
const WLS_COLORS: Record<string, { text: string; bg: string }> = {
  W: { text: "#1565c0", bg: "#e3f2fd" },
  L: { text: "#d32f2f", bg: "#ffebee" },
  S: { text: "#e65100", bg: "#fff3e0" },
  H: { text: "#2e7d32", bg: "#e8f5e9" },
};

export default function GameDetailScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { id: gameId, ap, hp } = useLocalSearchParams<{ id: string; ap?: string; hp?: string }>();
  const gid = gameId || "";

  const [detail, setDetail] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [scoreFallback, setScoreFallback] = useState<ScoreEntry | null>(null);
  const [previewData, setPreviewData] = useState<{
    homeRecord: string; awayRecord: string;
    homeRank: number; awayRank: number;
    homeRecent: ("승"|"패"|"무")[]; awayRecent: ("승"|"패"|"무")[];
  } | null>(null);
  const [showDiaryModal, setShowDiaryModal] = useState(false);
  const [diaryGamePreset, setDiaryGamePreset] = useState<GameOption | null>(null);
  const [diaryPresetDate, setDiaryPresetDate] = useState<Date | null>(null);

  const load = useCallback(() => {
    if (!gid) return;
    setLoading(true);
    setError(false);
    setScoreFallback(null);
    let cancelled = false;

    fetchGameDetail(gid).then((data) => {
      if (cancelled) return;
      if (data) {
        setDetail(data);
        const dateStr = `${gid.slice(0, 4)}-${gid.slice(4, 6)}-${gid.slice(6, 8)}`;
        cachedDailyScores(dateStr).then((scores) => {
          if (cancelled || !scores?.games) return;
          const homeName = TEAM_COLORS[data.homeTeam]?.shortName || "";
          const awayName = TEAM_COLORS[data.awayTeam]?.shortName || "";
          const match = scores.games.find(
            (s: ScoreEntry) => s.home === homeName && s.away === awayName
          );
          if (match) setScoreFallback(match);
        });
      } else {
        setError(true);
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) { setError(true); setLoading(false); }
    });

    return () => { cancelled = true; };
  }, [gid]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  // Fetch standings + recent games for preview card
  useEffect(() => {
    if (!detail) return;
    const homeName = TEAM_COLORS[detail.homeTeam]?.shortName;
    const awayName = TEAM_COLORS[detail.awayTeam]?.shortName;
    if (!homeName || !awayName) return;
    let cancelled = false;

    Promise.all([fetchStandingsJson()]).then(async ([standings]) => {
      if (cancelled || !standings?.rows) return;
      const homeStanding = standings.rows.find((r: any) => r.teamName === homeName);
      const awayStanding = standings.rows.find((r: any) => r.teamName === awayName);
      if (!homeStanding || !awayStanding) return;

      // Fetch recent game dates from schedules (current + past 2 months)
      const now = new Date();
      const months = [now.getMonth() + 1, now.getMonth(), now.getMonth() - 1];
      const schedules = await Promise.all(
        months.map((m) => cachedScheduleByMonth(m).catch(() => null))
      );
      if (cancelled) return;

      // Collect unique dates where either team played
      const dateSet = new Set<string>();
      for (const s of schedules) {
        if (!s?.games) continue;
        for (const g of s.games) {
          if ((g.away === homeName || g.home === homeName || g.away === awayName || g.home === awayName)) {
            dateSet.add(g.date);
          }
        }
      }
      const dates = [...dateSet].sort().reverse();

      // Fetch per-date scores
      const scoreResults = await Promise.all(
        dates.map((d) => cachedDailyScores(d).catch(() => null))
      );
      if (cancelled) return;

      const homeRecent: ("승"|"패"|"무")[] = [];
      const awayRecent: ("승"|"패"|"무")[] = [];

      for (let i = 0; i < dates.length; i++) {
        if (homeRecent.length >= 5 && awayRecent.length >= 5) break;
        const dayScores = scoreResults[i]?.games;
        if (!dayScores) continue;
        for (const g of dayScores) {
          if (g.cancelled || g.outcome == null) continue;
          if (homeRecent.length < 5 && g.away === homeName) {
            homeRecent.push(g.awayScore > g.homeScore ? "승" : g.awayScore < g.homeScore ? "패" : "무");
          }
          if (homeRecent.length < 5 && g.home === homeName) {
            homeRecent.push(g.homeScore > g.awayScore ? "승" : g.homeScore < g.awayScore ? "패" : "무");
          }
          if (awayRecent.length < 5 && g.away === awayName) {
            awayRecent.push(g.awayScore > g.homeScore ? "승" : g.awayScore < g.homeScore ? "패" : "무");
          }
          if (awayRecent.length < 5 && g.home === awayName) {
            awayRecent.push(g.homeScore > g.awayScore ? "승" : g.homeScore < g.awayScore ? "패" : "무");
          }
          if (homeRecent.length >= 5 && awayRecent.length >= 5) break;
        }
      }

      setPreviewData({
        homeRecord: homeStanding.wlt, awayRecord: awayStanding.wlt,
        homeRank: homeStanding.rank, awayRank: awayStanding.rank,
        homeRecent: homeRecent.slice(0, 5), awayRecent: awayRecent.slice(0, 5),
      });
    }).catch((e) => console.warn("game/[id] preview fetch failed", e));

    return () => { cancelled = true; };
  }, [detail]);

  const handleOpenDiary = useCallback(() => {
    if (!detail) return;
    const cancelled = detail.gameInfo?.status === "cancelled" ||
      detail.etcRecords?.some(r => r.how?.includes("취소") || r.result?.includes("취소")) === true;
    const gameOpt: GameOption = {
      gameId: detail.gameId || gid,
      homeTeam: detail.homeTeam,
      awayTeam: detail.awayTeam,
      homeScore: detail.score?.home ?? null,
      awayScore: detail.score?.away ?? null,
      cancelled,
      venue: detail.gameInfo?.venue || "",
      time: detail.gameInfo?.time || "",
    };
    const datePrefix = gid.slice(0, 8);
    const gameDate = new Date(
      parseInt(datePrefix.slice(0, 4)),
      parseInt(datePrefix.slice(4, 6)) - 1,
      parseInt(datePrefix.slice(6, 8)),
    );
    setDiaryGamePreset(gameOpt);
    setDiaryPresetDate(gameDate);
    setShowDiaryModal(true);
  }, [detail, gid]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    activityContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    errorText: { color: theme.mutedForeground, fontSize: 14, marginBottom: 16 },
    retryBtn: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: theme.foreground, borderRadius: 20 },
    retryText: { color: theme.background, fontSize: 14, fontWeight: "600" },
    scrollContent: { padding: 16, paddingBottom: 40 },

    // Header bar
    headerBar: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingTop: 60, paddingHorizontal: 16, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: theme.border,
      backgroundColor: theme.card,
    },
    headerBackBtn: { padding: 8, width: 60 },
    headerBackText: { color: theme.foreground, fontSize: 20 },
    headerBarTitle: { fontSize: 17, fontWeight: "600", color: theme.foreground },

    // Card
    card: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 20, marginTop: 12 },
    sectionTitle: { fontSize: 15, fontWeight: "700", color: theme.foreground, marginBottom: 12 },

    // Game header
    gameHeaderRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
    teamColumn: { flex: 1, alignItems: "center", gap: 6 },
    teamName: { fontSize: 14, fontWeight: "600" },
    pitcherName: { fontSize: 12, color: theme.mutedForeground },
    scoreColumn: { alignItems: "center", gap: 4, paddingHorizontal: 12 },
    gameTime: { fontSize: 11, color: theme.mutedForeground },
    scoreRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    scoreNum: { fontSize: 26, fontWeight: "bold", color: theme.foreground },
    scoreDim: { color: theme.mutedForeground, opacity: 0.5 },
    scoreColon: { fontSize: 14, color: theme.mutedForeground },
    vsText: { fontSize: 16, fontWeight: "700", color: theme.mutedForeground },
    cancelledText: { fontSize: 16, fontWeight: "700", color: theme.mutedForeground, textDecorationLine: "line-through" },
    statusBadge: { backgroundColor: theme.muted, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
    statusLive: { backgroundColor: theme.destructive + "18" },
    statusText: { fontSize: 10, fontWeight: "600", color: theme.mutedForeground },
    statusLiveText: { color: theme.destructive },
    venue: { textAlign: "center", fontSize: 11, color: theme.mutedForeground, marginTop: 12 },

    // Scoreboard table
    scoreboardTable: { gap: 0 },
    scoreboardRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
    scoreboardLabel: { fontSize: 12, fontWeight: "600", width: 28, color: theme.mutedForeground },
    scoreboardCell: { fontSize: 12, color: theme.foreground, textAlign: "center", flex: 1 },
    scoreboardBorderCell: { fontSize: 12, color: theme.foreground, fontWeight: "600", textAlign: "center", flex: 1, borderLeftWidth: 1, borderLeftColor: theme.border },

    // Preview
    previewRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    previewTeamCol: { flex: 1, alignItems: "center", gap: 2 },
    previewRank: { fontSize: 11, color: theme.mutedForeground },
    previewTeam: { fontSize: 14, fontWeight: "700" },
    previewRecord: { fontSize: 11, color: theme.mutedForeground },
    previewVsCol: { alignItems: "center", gap: 2, paddingHorizontal: 16 },
    previewVsLabel: { fontSize: 10, color: theme.mutedForeground },
    recentDivider: { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12 },
    recentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    recentDots: { flexDirection: "row", gap: 3 },
    recentDot: { width: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center" },
    recentWin: { backgroundColor: "#1565c0" },
    recentLose: { backgroundColor: "#d32f2f" },
    recentDraw: { backgroundColor: theme.muted },
    recentDotText: { fontSize: 10, fontWeight: "bold", color: "#fff" },
    recentLabel: { fontSize: 10, color: theme.mutedForeground },

    // Pitchers
    pitcherRow: { flexDirection: "row", gap: 8 },
    pitcherCard: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.secondary, borderRadius: 12, padding: 12 },
    pitcherNameBold: { fontSize: 14, fontWeight: "600", color: theme.foreground },
    pitcherTeam: { fontSize: 11 },

    // Pitching result
    pitchingList: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    pitchingRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.secondary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
    wlsBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
    wlsText: { fontSize: 10, fontWeight: "bold" },
    pitchingName: { fontSize: 14, fontWeight: "500", color: theme.foreground },
    pitchingStats: { fontSize: 12, color: theme.mutedForeground },

    // Lineups
    lineupSection: { marginTop: 12 },
    lineupStatusRow: { alignItems: "center", marginBottom: 8 },
    lineupStatusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
    lineupStatusBadgeText: { fontSize: 11, fontWeight: "600" },
    liveStatusBadge: { backgroundColor: theme.destructive + "18", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
    liveStatusText: { fontSize: 11, fontWeight: "600", color: theme.destructive },
    lineupConfirmed: { backgroundColor: "#e3f2fd" },
    lineupExpected: { backgroundColor: "#fff3e0" },
    lineupGrid: { flexDirection: "row", gap: 8 },
    lineupCard: { flex: 1, backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 12 },
    lineupHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: theme.border },
    lineupTeam: { fontSize: 13, fontWeight: "700" },
    lineupPlayer: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
    lineupOrder: { fontSize: 12, color: theme.mutedForeground, width: 14, textAlign: "right" },
    lineupPos: { fontSize: 11, color: theme.mutedForeground, backgroundColor: theme.muted, borderRadius: 4, paddingHorizontal: 6, textAlign: "center", minWidth: 22 },
    lineupName: { fontSize: 13, fontWeight: "500", color: theme.foreground },
    noLineupCard: { alignItems: "center", paddingVertical: 32 },
    noLineupText: { color: theme.mutedForeground, fontSize: 14, marginBottom: 4 },
    noLineupSub: { color: theme.mutedForeground, fontSize: 12 },

    // Highlights
    highlightsList: { gap: 8 },
    highlightRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    highlightBadge: { backgroundColor: theme.muted, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    highlightBadgeText: { fontSize: 11, fontWeight: "500", color: theme.mutedForeground },
    highlightDesc: { fontSize: 14, color: theme.foreground, flex: 1, lineHeight: 20 },

    // Diary record button
    diaryRecordBtn: {
      backgroundColor: theme.foreground,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 16,
    },
    diaryRecordText: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.background,
    },

    // Footer
    footer: { textAlign: "center", fontSize: 11, color: theme.mutedForeground, marginTop: 24, marginBottom: 16 },
  }), [theme]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.activityContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.back()} style={styles.headerBackBtn}>
            <Text style={styles.headerBackText}>←</Text>
          </Pressable>
          <Text style={styles.headerBarTitle}>경기 상세</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.activityContainer}>
          <Text style={styles.errorText}>
            {error ? "데이터를 불러올 수 없습니다" : "경기 정보를 준비 중이에요"}
          </Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>재시도</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const home = TEAM_COLORS[detail.homeTeam];
  const away = TEAM_COLORS[detail.awayTeam];
  const homeLineup = detail.lineup?.home || [];
  const awayLineup = detail.lineup?.away || [];
  const gameScore = detail.score ?? (scoreFallback ? { away: scoreFallback.awayScore, home: scoreFallback.homeScore } : null);

  // Only show expected pitchers/lineup for tomorrow (today+1); beyond that is undecided
  const gameDateStr = `${gid.slice(0, 4)}-${gid.slice(4, 6)}-${gid.slice(6, 8)}`;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  const isBeyondTomorrow = gameDateStr > tomorrowStr;
  const awayPitcherName = isBeyondTomorrow ? undefined : (ap || "") || detail.starters?.away?.name || undefined;
  const homePitcherName = isBeyondTomorrow ? undefined : (hp || "") || detail.starters?.home?.name || undefined;
  const hasLineup = !isBeyondTomorrow && homeLineup.length > 0 && awayLineup.length > 0;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const isFuture = detail.date > todayStr;
  const isToday = detail.date === todayStr;
  const isCancelled = detail.gameInfo?.status === "cancelled" || scoreFallback?.cancelled === true || detail.etcRecords?.some(r => r.how?.includes("취소") || r.result?.includes("취소")) === true;

  const hasScoreData = gameScore !== null;
  const hasFinishedSignals = !!detail.scoreBoard || (detail.pitchingResult && detail.pitchingResult.length > 0) || (detail.etcRecords && detail.etcRecords.length > 0);
  const isGameActive = hasScoreData || hasFinishedSignals;

  const [gh, gm] = (detail.gameInfo?.time || "18:30").split(":").map(Number);
  const startTime = new Date(detail.date);
  startTime.setHours(gh, gm, 0, 0);
  const gameHasStarted = new Date() >= startTime;

  const isFinished = !isCancelled && !isFuture && gameHasStarted && (
    detail.gameInfo?.status === "finished" || (isGameActive && !isToday)
  );
  const isLive = !isCancelled && !isFinished && gameHasStarted && (
    detail.gameInfo?.status === "live" || (isGameActive && isToday)
  );
  const isBeforeGame = !isFinished && !isLive && !isCancelled;
  const showLineupStatus = isBeforeGame;
  const lineupConfirmed = isFuture ? false : (detail.lineupConfirmed ?? false);
  const statusLabel = isCancelled ? "취소" : isFinished ? "경기 종료" : isLive ? "경기 중" : "경기 전";
  const gs = gameScore;
  const awayWin = isFinished && gs ? gs.away > gs.home : null;
  const homeWin = isFinished && gs ? gs.home > gs.away : null;
  const isDraw = isFinished && gs ? gs.away === gs.home : false;
  const awayEmotion: "default" | "determined" | "sad" | "joyful" | "neutral" = isCancelled ? "neutral" : isBeforeGame ? "determined" : awayWin ? "joyful" : isDraw ? "neutral" : isFinished ? "sad" : "default";
  const homeEmotion: "default" | "determined" | "sad" | "joyful" | "neutral" = isCancelled ? "neutral" : isBeforeGame ? "determined" : homeWin ? "joyful" : isDraw ? "neutral" : isFinished ? "sad" : "default";

  const scoreBoard = detail.scoreBoard;
  const rheb = scoreBoard?.rheb;
  const innData = scoreBoard?.inn;
  const maxInn = innData ? Math.max(innData.away.length, innData.home.length) : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.headerBackBtn}>
          <Text style={styles.headerBackText}>←</Text>
        </Pressable>
        <Text style={styles.headerBarTitle}>경기 상세</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Game header card */}
        <View style={styles.card}>
          <View style={styles.gameHeaderRow}>
            {/* Away team */}
            <View style={styles.teamColumn}>
              <TeamBadge teamId={detail.awayTeam} size="lg" emotion={awayEmotion} />
              <Text style={[styles.teamName, { color: teamPrimaryColor(detail.awayTeam, isDark) }]}>{away?.name}</Text>
              <Text style={styles.pitcherName}>{awayPitcherName || "-"}</Text>
            </View>

            {/* Score / VS */}
            <View style={styles.scoreColumn}>
              <Text style={styles.gameTime}>{detail.gameInfo?.time || "18:30"}</Text>
              {isCancelled ? (
                <Text style={styles.cancelledText}>취소</Text>
              ) : gameScore ? (
                <View style={styles.scoreRow}>
                  <Text style={[styles.scoreNum, isFinished && gameScore.away < gameScore.home && styles.scoreDim]}>
                    {gameScore.away}
                  </Text>
                  <Text style={styles.scoreColon}>:</Text>
                  <Text style={[styles.scoreNum, isFinished && gameScore.home < gameScore.away && styles.scoreDim]}>
                    {gameScore.home}
                  </Text>
                </View>
              ) : (
                <Text style={styles.vsText}>VS</Text>
              )}
              <View style={[styles.statusBadge, isLive && styles.statusLive]}>
                <Text style={[styles.statusText, isLive && styles.statusLiveText]}>
                  {isLive ? "경기 중" : statusLabel}
                </Text>
              </View>
            </View>

            {/* Home team */}
            <View style={styles.teamColumn}>
              <TeamBadge teamId={detail.homeTeam} size="lg" emotion={homeEmotion} />
              <Text style={[styles.teamName, { color: teamPrimaryColor(detail.homeTeam, isDark) }]}>{home?.name}</Text>
              <Text style={styles.pitcherName}>{homePitcherName || "-"}</Text>
            </View>
          </View>
          {detail.gameInfo?.venue && (
            <Text style={styles.venue}>{detail.gameInfo.venue}</Text>
          )}
        </View>

        {/* Scoreboard */}
        {innData && rheb && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>스코어보드</Text>
            <View style={styles.scoreboardTable}>
              {/* Header row */}
              <View style={styles.scoreboardRow}>
                <Text style={styles.scoreboardLabel}>팀</Text>
                {Array.from({ length: maxInn }).map((_, i) => (
                  <Text key={i} style={styles.scoreboardCell}>{i + 1}</Text>
                ))}
                <Text style={styles.scoreboardBorderCell}>R</Text>
                <Text style={styles.scoreboardCell}>H</Text>
                <Text style={styles.scoreboardCell}>E</Text>
              </View>
              {/* Away row */}
              <View style={styles.scoreboardRow}>
                <Text style={[styles.scoreboardLabel, { color: teamPrimaryColor(detail.awayTeam, isDark) }]}>{away?.shortName}</Text>
                {Array.from({ length: maxInn }).map((_, i) => (
                  <Text key={i} style={styles.scoreboardCell}>{innData.away[i] != null ? innData.away[i] : '-'}</Text>
                ))}
                <Text style={styles.scoreboardBorderCell}>{rheb.away.r ?? '-'}</Text>
                <Text style={styles.scoreboardCell}>{rheb.away.h ?? '-'}</Text>
                <Text style={styles.scoreboardCell}>{rheb.away.e ?? '-'}</Text>
              </View>
              {/* Home row */}
              <View style={styles.scoreboardRow}>
                <Text style={[styles.scoreboardLabel, { color: teamPrimaryColor(detail.homeTeam, isDark) }]}>{home?.shortName}</Text>
                {Array.from({ length: maxInn }).map((_, i) => (
                  <Text key={i} style={styles.scoreboardCell}>{innData.home[i] != null ? innData.home[i] : '-'}</Text>
                ))}
                <Text style={styles.scoreboardBorderCell}>{rheb.home.r ?? '-'}</Text>
                <Text style={styles.scoreboardCell}>{rheb.home.h ?? '-'}</Text>
                <Text style={styles.scoreboardCell}>{rheb.home.e ?? '-'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Preview card */}
        {!isFinished && previewData && (
          <View style={styles.card}>
            <View style={styles.previewRow}>
              <View style={styles.previewTeamCol}>
                <Text style={styles.previewRank}>{previewData.awayRank}위</Text>
                <Text style={[styles.previewTeam, { color: teamPrimaryColor(detail.awayTeam, isDark) }]}>{away?.shortName}</Text>
                <Text style={styles.previewRecord}>{previewData.awayRecord}</Text>
              </View>
              <View style={styles.previewVsCol}>
                <Text style={styles.previewVsLabel}>시즌 성적</Text>
                <Text style={styles.previewVsLabel}>VS</Text>
              </View>
              <View style={styles.previewTeamCol}>
                <Text style={styles.previewRank}>{previewData.homeRank}위</Text>
                <Text style={[styles.previewTeam, { color: teamPrimaryColor(detail.homeTeam, isDark) }]}>{home?.shortName}</Text>
                <Text style={styles.previewRecord}>{previewData.homeRecord}</Text>
              </View>
            </View>
            <View style={styles.recentDivider}>
              <View style={styles.recentRow}>
                <View style={styles.recentDots}>
                  {previewData.awayRecent.map((r, i) => (
                    <View key={i} style={[styles.recentDot, r === "승" ? styles.recentWin : r === "패" ? styles.recentLose : styles.recentDraw]}>
                      <Text style={styles.recentDotText}>{r === "무" ? "무" : r}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.recentLabel}>최근 5경기</Text>
                <View style={styles.recentDots}>
                  {previewData.homeRecent.map((r, i) => (
                    <View key={i} style={[styles.recentDot, r === "승" ? styles.recentWin : r === "패" ? styles.recentLose : styles.recentDraw]}>
                      <Text style={styles.recentDotText}>{r === "무" ? "무" : r}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Starting pitchers */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>선발투수</Text>
          <View style={styles.pitcherRow}>
            <View style={styles.pitcherCard}>
              <TeamBadge teamId={detail.awayTeam} size="sm" variant="ball" />
              <View>
                <Text style={styles.pitcherNameBold}>{awayPitcherName || "미정"}</Text>
                <Text style={[styles.pitcherTeam, { color: teamPrimaryColor(detail.awayTeam, isDark) }]}>{away?.shortName}</Text>
              </View>
            </View>
            <View style={styles.pitcherCard}>
              <TeamBadge teamId={detail.homeTeam} size="sm" variant="ball" />
              <View>
                <Text style={styles.pitcherNameBold}>{homePitcherName || "미정"}</Text>
                <Text style={[styles.pitcherTeam, { color: teamPrimaryColor(detail.homeTeam, isDark) }]}>{home?.shortName}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Pitching result */}
        {detail.pitchingResult && detail.pitchingResult.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>투수 기록</Text>
            <View style={styles.pitchingList}>
              {detail.pitchingResult.map((p, i) => {
                const wlsLabel = WLS_LABELS[p.wls] || p.wls;
                const wc = WLS_COLORS[p.wls] || { text: theme.mutedForeground, bg: theme.muted };
                return (
                  <View key={i} style={styles.pitchingRow}>
                    <View style={[styles.wlsBadge, { backgroundColor: wc.bg }]}>
                      <Text style={[styles.wlsText, { color: wc.text }]}>{wlsLabel}</Text>
                    </View>
                    <Text style={[styles.pitchingName, { fontSize: 13 }]}>{p.name}</Text>
                    <Text style={styles.pitchingStats}>
                      {p.ip && `${p.ip}이닝`}
                      {p.era ? ` ERA ${p.era}` : ""}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : scoreFallback?.winPitcher ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>투수 기록</Text>
            <View style={styles.pitchingList}>
              <View style={styles.pitchingRow}>
                <View style={[styles.wlsBadge, { backgroundColor: "#e3f2fd" }]}>
                  <Text style={[styles.wlsText, { color: "#1565c0" }]}>승</Text>
                </View>
                <Text style={[styles.pitchingName, { fontSize: 13 }]}>{scoreFallback.winPitcher || "-"}</Text>
              </View>
              <View style={styles.pitchingRow}>
                <View style={[styles.wlsBadge, { backgroundColor: "#ffebee" }]}>
                  <Text style={[styles.wlsText, { color: "#d32f2f" }]}>패</Text>
                </View>
                <Text style={[styles.pitchingName, { fontSize: 13 }]}>{scoreFallback.losePitcher || "-"}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Lineups */}
        {hasLineup ? (
          <View style={styles.lineupSection}>
            {isLive ? (
              <View style={styles.lineupStatusRow}>
                <View style={styles.liveStatusBadge}>
                  <Text style={styles.liveStatusText}>경기 중</Text>
                </View>
              </View>
            ) : showLineupStatus ? (
              <View style={styles.lineupStatusRow}>
                <View style={[styles.lineupStatusBadge, lineupConfirmed ? styles.lineupConfirmed : styles.lineupExpected]}>
                  <Text style={[styles.lineupStatusBadgeText, { color: lineupConfirmed ? "#1565c0" : "#e65100" }]}>
                    {lineupConfirmed ? "라인업 확정" : "예상 라인업"}
                  </Text>
                </View>
              </View>
            ) : null}
            <View style={styles.lineupGrid}>
              {/* Away lineup */}
              <View style={styles.lineupCard}>
                <View style={styles.lineupHeader}>
                  <TeamBadge teamId={detail.awayTeam} size="sm" variant="bat" />
                  <Text style={[styles.lineupTeam, { color: teamPrimaryColor(detail.awayTeam, isDark) }]}>{away?.shortName}</Text>
                </View>
                {awayLineup.map((player: LineupPlayer) => (
                  <View key={player.order} style={styles.lineupPlayer}>
                    <Text style={styles.lineupOrder}>{player.order}</Text>
                    <Text style={styles.lineupPos}>{POSITION_LABELS[player.position] || player.position}</Text>
                    <Text style={styles.lineupName}>{player.name}</Text>
                  </View>
                ))}
              </View>
              {/* Home lineup */}
              <View style={styles.lineupCard}>
                <View style={styles.lineupHeader}>
                  <TeamBadge teamId={detail.homeTeam} size="sm" variant="bat" />
                  <Text style={[styles.lineupTeam, { color: teamPrimaryColor(detail.homeTeam, isDark) }]}>{home?.shortName}</Text>
                </View>
                {homeLineup.map((player: LineupPlayer) => (
                  <View key={player.order} style={styles.lineupPlayer}>
                    <Text style={styles.lineupOrder}>{player.order}</Text>
                    <Text style={styles.lineupPos}>{POSITION_LABELS[player.position] || player.position}</Text>
                    <Text style={styles.lineupName}>{player.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.card, styles.noLineupCard]}>
            <Text style={styles.noLineupText}>아직 라인업이 공개되지 않았어요</Text>
            <Text style={styles.noLineupSub}>경기 시작 전에 확정 후 업데이트돼요</Text>
          </View>
        )}

        {/* Game highlights */}
        {detail.etcRecords && detail.etcRecords.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>경기 기록</Text>
            <View style={styles.highlightsList}>
              {detail.etcRecords.map((r, i) => (
                <View key={i} style={styles.highlightRow}>
                  <View style={styles.highlightBadge}>
                    <Text style={styles.highlightBadgeText}>{r.result}</Text>
                  </View>
                  <Text style={styles.highlightDesc}>
                    {r.how}{r.desc ? ` (${r.desc})` : ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Record in Diary button */}
        <Pressable style={styles.diaryRecordBtn} onPress={handleOpenDiary}>
          <Text style={styles.diaryRecordText}>직관 기록하기</Text>
        </Pressable>

        {/* Footer */}
        <Text style={styles.footer}>
          {hasLineup
            ? (lineupConfirmed ? "라인업은 경기 시작 전에 확정돼요" : "예상 라인업은 전날 경기 데이터를 기반으로 해요")
            : ""}
        </Text>
      </ScrollView>

      <DiaryEntryModal
        visible={showDiaryModal}
        onClose={() => setShowDiaryModal(false)}
        onSaved={() => { setShowDiaryModal(false); router.push("/(tabs)/diary"); }}
        presetGame={diaryGamePreset}
        presetDate={diaryPresetDate}
      />
    </View>
  );
}


