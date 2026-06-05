import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams, useNavigation } from "expo-router";
import { TEAM_COLORS } from "@shared/teamColors";
import { parseGameTeamIds, formatDateForApi } from "@shared/constants";
import { getInningInfo } from "@shared/gameStatus";
import {
  type GameDetail, type ScoreEntry, type LineupPlayer, type StandingRow,
} from "@/lib/api";
import { TeamBadge } from "@/components/TeamBadge";
import { cachedDailyScores, cachedAllDailyScores, cachedScheduleByMonth, cachedGameDetail, cachedStandings } from "@/lib/gameCache";
import { resolveGames } from "@/lib/resolveGames";
import SimpleAlert from "@/components/SimpleAlert";
import DiaryEntryModal, { type GameOption } from "@/components/DiaryEntryModal";
import StickerModal from "@/components/StickerModal";
import CoachMark from "@/components/CoachMark";
import { useTheme } from "@/lib/ThemeContext";
import { teamPrimaryColor } from "@shared/teamColors";
import { resolveVenue } from "@/lib/stadiumData";
import { getGameStickerCoachSeen, setGameStickerCoachSeen } from "@/lib/db";


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
  const { id: gameId, ap, hp, sc } = useLocalSearchParams<{ id: string; ap?: string; hp?: string; sc?: string }>();
  const gid = gameId || "";

  const [detail, setDetail] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [scoreFallback, setScoreFallback] = useState<ScoreEntry | null>(null);
  const [isExhibition, setIsExhibition] = useState(false);
  const [previewData, setPreviewData] = useState<{
    homeRecord: string; awayRecord: string;
    homeRank: number; awayRank: number;
    homeRecent: ("승"|"패"|"무")[]; awayRecent: ("승"|"패"|"무")[];
  } | null>(null);
  const [showDiaryModal, setShowDiaryModal] = useState(false);
  const [diaryGamePreset, setDiaryGamePreset] = useState<GameOption | null>(null);
  const [diaryPresetDate, setDiaryPresetDate] = useState<Date | null>(null);
  const [showStickerModal, setShowStickerModal] = useState(false);
  const [showStickerCoach, setShowStickerCoach] = useState(false);
  const [showStickerTimeAlert, setShowStickerTimeAlert] = useState(false);
  const stickerCoachChecked = useRef(false);
  const scheduleTimeRef = useRef<string | null>(null);
  const resolvedStatusRef = useRef<string | undefined>(undefined);

  const load = useCallback(() => {
    if (!gid) return;
    setLoading(true);
    setError(false);
    setScoreFallback(null);
    setIsExhibition(false);
    let cancelled = false;

    const tryExhibitionFallback = async () => {
      if (cancelled) return;
      try {
        const dateStr = `${gid.slice(0, 4)}-${gid.slice(4, 6)}-${gid.slice(6, 8)}`;
        const month = parseInt(gid.slice(4, 6), 10);
        const year = parseInt(gid.slice(0, 4), 10);
        const [scores, schedule] = await Promise.all([
          cachedDailyScores(dateStr).catch(() => null),
          cachedScheduleByMonth(month, year).catch(() => null),
        ]);
        if (cancelled) return;


        const { awayId, homeId } = parseGameTeamIds(gid);
        const parts = gid.split("-");
        const suffix = parts[parts.length - 1];
        const gameSeq = parseInt(suffix, 10);

        // Use resolveGames for correct DH matching
        const allResolved = resolveGames(schedule?.games || [], scores?.games || [], dateStr);
        const myEntry = allResolved[gameSeq];
        const scoreEntry = myEntry?._raw.score ?? null;
        const scheduleEntry = myEntry?._raw.schedule ?? null;

        if (scoreEntry) {
          if (scoreEntry.cancelled) {
            setDetail({
              gameId: gid,
              date: dateStr,
              homeTeam: homeId,
              awayTeam: awayId,
              starters: { home: null, away: null },
              lineup: { home: [], away: [] },
              gameInfo: {
                time: scheduleEntry?.time || "13:00",
                venue: resolveVenue(homeId, scheduleEntry?.venue || ""),
                status: "cancelled",
              },
            });
            setLoading(false);
            return;
          }
          const score: { away: number; home: number } = {
            away: scoreEntry.awayScore ?? 0,
            home: scoreEntry.homeScore ?? 0,
          };
          setDetail({
            gameId: gid,
            date: dateStr,
            homeTeam: homeId,
            awayTeam: awayId,
            starters: { home: null, away: null },
            lineup: { home: [], away: [] },
            gameInfo: {
              time: scheduleEntry?.time || "13:00",
              venue: resolveVenue(homeId, scheduleEntry?.venue || ""),
              status: "finished",
            },
            score,
            pitchingResult: scoreEntry.winPitcher || scoreEntry.losePitcher
              ? [
                  ...(scoreEntry.winPitcher ? [{ name: scoreEntry.winPitcher, wls: "W" as const }] : []),
                  ...(scoreEntry.losePitcher ? [{ name: scoreEntry.losePitcher, wls: "L" as const }] : []),
                ]
              : undefined,
          });
          setLoading(false);
        } else if (scheduleEntry) {
          // Exhibition game without score data — show minimal game info
          setDetail({
            gameId: gid,
            date: dateStr,
            homeTeam: homeId,
            awayTeam: awayId,
            starters: { home: null, away: null },
            lineup: { home: [], away: [] },
            gameInfo: {
              time: scheduleEntry.time || "13:00",
              venue: resolveVenue(homeId, scheduleEntry.venue || ""),
              status: "finished",
            },
          });
          setLoading(false);
        } else {
          setError(true);
          setLoading(false);
        }
      } catch {
        if (!cancelled) { setError(true); setLoading(false); }
      }
    };

    const gameYear = parseInt(gid.slice(0, 4), 10);
    if (gameYear <= 2025) {
      tryExhibitionFallback();
      return () => { cancelled = true; };
    }

    cachedGameDetail(gid).then(async (data) => {
      if (cancelled) return;
      if (data) {
        setDetail(data);
        const dateStr = `${gid.slice(0, 4)}-${gid.slice(4, 6)}-${gid.slice(6, 8)}`;
        const [schedule, scores] = await Promise.all([
          cachedScheduleByMonth(parseInt(gid.slice(4, 6), 10), parseInt(gid.slice(0, 4), 10)).catch(() => null),
          cachedDailyScores(dateStr).catch(() => null),
        ]);
        if (cancelled) return;

        // resolveGames는 scores가 null이어도 schedule 데이터로 isExhibition 판정 가능
        const resolved = resolveGames(schedule?.games || [], scores?.games || [], dateStr);
        const parts = gid.split("-");
        const suffix = parts[parts.length - 1];
        const gameSeq = parseInt(suffix, 10);
        const myGame = !isNaN(gameSeq) ? resolved[gameSeq] : undefined;
        if (myGame?.isExhibition) setIsExhibition(true);
        if (myGame?.time) scheduleTimeRef.current = myGame.time;
        resolvedStatusRef.current = myGame?.status;

        if (scores?.games) {
          if (myGame?._raw.score) {
            const score = myGame._raw.score;
            setScoreFallback(score);
            // For DH2+ games, override API detail with correct scores/pitchers
            // starters는 서버가 _dh2.json을 올바르게 반환하므로 유지
            if (gameSeq > 0) {
              setDetail({
                ...data,
                score: { away: score.awayScore, home: score.homeScore },
                pitchingResult: [
                  ...(score.winPitcher ? [{ name: score.winPitcher, wls: "W" as const }] : []),
                  ...(score.losePitcher ? [{ name: score.losePitcher, wls: "L" as const }] : []),
                ],
              });
            }
          } else if (myGame && myGame.awayScore != null && myGame.homeScore != null) {
            setScoreFallback({
              away: myGame.awayTeam,
              home: myGame.homeTeam,
              awayScore: myGame.awayScore,
              homeScore: myGame.homeScore,
              outcome: myGame.outcome ?? null,
              cancelled: myGame.status === "cancelled",
              winPitcher: myGame.winPitcher ?? null,
              losePitcher: myGame.losePitcher ?? null,
            });
          }
        }
        setLoading(false);
      } else {
        tryExhibitionFallback();
        // Background retry: full detail API가 3초 후 자동 재시도 → 성공 시 UI 업데이트
        const retryTimer = setTimeout(async () => {
          if (cancelled) return;
          const retry = await cachedGameDetail(gid).catch(() => null);
          if (cancelled || !retry) return;
          setDetail(retry);
          const dateStr = `${gid.slice(0, 4)}-${gid.slice(4, 6)}-${gid.slice(6, 8)}`;
          const [schedule, scores] = await Promise.all([
            cachedScheduleByMonth(parseInt(gid.slice(4, 6), 10), parseInt(gid.slice(0, 4), 10)).catch(() => null),
            cachedDailyScores(dateStr).catch(() => null),
          ]);
          if (cancelled) return;
          const resolved = resolveGames(schedule?.games || [], scores?.games || [], dateStr);
          const gameSeq = parseInt(gid.split("-").pop() ?? "0", 10);
          const myGame = !isNaN(gameSeq) ? resolved[gameSeq] : undefined;
          if (myGame?.isExhibition) setIsExhibition(true);
          if (myGame?.time) scheduleTimeRef.current = myGame.time;
          resolvedStatusRef.current = myGame?.status;
          if (scores?.games && myGame?._raw.score) {
            setScoreFallback(myGame._raw.score);
          }
          setLoading(false);
        }, 3000);
      }
    }).catch(() => {
      if (!cancelled) {
        tryExhibitionFallback();
      }
    });

    return () => { cancelled = true; };
  }, [gid]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  // Fetch standings + recent games for preview card
  useEffect(() => {
    if (!detail || isExhibition) return;
    const homeName = TEAM_COLORS[detail.homeTeam]?.shortName;
    const awayName = TEAM_COLORS[detail.awayTeam]?.shortName;
    if (!homeName || !awayName) return;
    let cancelled = false;

    Promise.all([cachedStandings()]).then(async ([standings]) => {
      if (cancelled || !standings?.rows) return;
      const homeStanding = standings.rows.find((r: StandingRow) => r.teamName === homeName);
      const awayStanding = standings.rows.find((r: StandingRow) => r.teamName === awayName);
      if (!homeStanding || !awayStanding) return;

      // Fetch recent game dates from schedules (current + past 2 months)
      const gameYear = parseInt(gid.slice(0, 4) || "2026");
      const now = new Date();
      const months = [now.getMonth() + 1, now.getMonth(), now.getMonth() - 1];
      const schedules = await Promise.all(
        months.map((m) => cachedScheduleByMonth(m, gameYear).catch(() => null))
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

      // Bulk fetch all scores for the year (avoids N concurrent per-date calls)
      const allYearScores = await cachedAllDailyScores(gameYear).catch(() => null);
      if (cancelled) return;

      const homeRecent: ("승"|"패"|"무")[] = [];
      const awayRecent: ("승"|"패"|"무")[] = [];

      for (let i = 0; i < dates.length; i++) {
        if (homeRecent.length >= 5 && awayRecent.length >= 5) break;
        const dayScores = allYearScores?.[dates[i]];
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
  }, [detail, isExhibition]);

  // Sticker coach mark: show once when game detail loads (explains timing)
  useEffect(() => {
    if (!detail || stickerCoachChecked.current) return;
    if (detail.gameInfo?.status === "cancelled") return;
    if (sc === "1") return;
    try {
      if (!getGameStickerCoachSeen()) {
        stickerCoachChecked.current = true;
        setShowStickerCoach(true);
      } else {
        stickerCoachChecked.current = true;
      }
    } catch (e) { console.warn("coach: gameSticker", e); }
  }, [detail, sc]);

  // Detail sticker coach & auto-open modal for sc=1
  useEffect(() => {
    if (sc !== "1") return;
    if (!detail || detail.gameInfo?.status === "cancelled") return;
    setShowStickerCoach(false);

    const isFinishedOrLive = detail.gameInfo?.status === "finished" || detail.gameInfo?.status === "live";
    const hasScore = !!detail.score;
    const gameDateStr = detail.date;
    const now = new Date();
    const todayStr = formatDateForApi(now);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDateForApi(yesterday);
    const isToday = gameDateStr === todayStr;
    const isYesterday = gameDateStr === yesterdayStr;
    const isBefore1400 = now.getHours() < 14;
    const canMake = isFinishedOrLive && hasScore && (isToday || (isYesterday && isBefore1400));

    if (canMake) {
      setShowStickerModal(true);
    } else {
      setShowStickerTimeAlert(true);
    }
  }, [detail, sc]);

  // Dismiss sticker coach marks on navigation away
  const navigation = useNavigation();
  useEffect(() => {
    const unsubscribe = navigation.addListener("blur", () => {
      setShowStickerCoach(false);
    });
    return unsubscribe;
  }, [navigation]);

  const handleOpenDiary = useCallback(() => {
    if (!detail) return;
    setShowStickerCoach(false);
    const cancelled = detail.gameInfo?.status === "cancelled" ||
      detail.etcRecords?.some(r => r.how?.includes("취소") || r.result?.includes("취소")) === true;
    const gidParts = gid.split("-");
    const gameIdxSuffix = gidParts.length > 2 ? parseInt(gidParts[gidParts.length - 1], 10) : 0;
    const gameOpt: GameOption = {
      gameId: detail.gameId || gid,
      homeTeam: detail.homeTeam,
      awayTeam: detail.awayTeam,
      homeScore: detail.score?.home ?? null,
      awayScore: detail.score?.away ?? null,
      cancelled,
      venue: resolveVenue(detail.homeTeam, detail.gameInfo?.venue),
      time: detail.gameInfo?.time || "",
      gameStatus: detail.gameInfo?.status,
      pairIdx: isNaN(gameIdxSuffix) ? undefined : gameIdxSuffix,
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

  const handleOpenSticker = useCallback(() => {
    if (!detail) return;
    setShowStickerCoach(false);
    setShowStickerModal(true);
  }, [detail]);

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

    // Sticker button
    stickerBtn: {
      backgroundColor: theme.muted,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 8,
    },
    stickerBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.foreground,
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
          <Pressable onPress={() => router.back()} style={styles.headerBackBtn} hitSlop={8}>
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
  const gameScore = detail.score ?? (scoreFallback ? { away: scoreFallback.awayScore, home: scoreFallback.homeScore } : null)
    ?? (detail.scoreBoard?.rheb ? { away: detail.scoreBoard.rheb.away.r, home: detail.scoreBoard.rheb.home.r } : null);

  // Only show expected pitchers/lineup for tomorrow (today+1); beyond that is undecided
  const gameDateStr = `${gid.slice(0, 4)}-${gid.slice(4, 6)}-${gid.slice(6, 8)}`;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDateForApi(tomorrow);
  const isBeyondTomorrow = gameDateStr > tomorrowStr;
  const awayPitcherName = isBeyondTomorrow ? undefined : (ap || "") || detail.starters?.away?.name || undefined;
  const homePitcherName = isBeyondTomorrow ? undefined : (hp || "") || detail.starters?.home?.name || undefined;

  const now = new Date();
  const todayStr = formatDateForApi(now);
  const isFuture = detail.date > todayStr;
  const isToday = detail.date === todayStr;
  const isCancelled = detail.gameInfo?.status === "cancelled" || scoreFallback?.cancelled === true || detail.etcRecords?.some(r => r.how?.includes("취소") || r.result?.includes("취소")) === true;

  const hasScoreData = gameScore !== null;
  const hasFinishedSignals = !!detail.scoreBoard || (detail.pitchingResult && detail.pitchingResult.length > 0) || (detail.etcRecords && detail.etcRecords.length > 0);
  const isGameActive = hasScoreData || hasFinishedSignals;

  const [gh, gm] = (detail.gameInfo?.time || scheduleTimeRef.current || "18:30").split(":").map(Number);
  const [y, m, d] = detail.date.split("-").map(Number);
  const startTime = new Date(y, m - 1, d, gh, gm, 0, 0);
  const gameHasStarted = new Date() >= startTime;
  const hasInningData = !!detail.scoreBoard?.inn;

  // ── 이중 방어: resolveGames(daily-scores.json) + 서버(gameInfo) 상태를 모두 고려 ──
  const hasOutcome = scoreFallback && scoreFallback.outcome !== null && !scoreFallback.cancelled;
  const currentStatus = resolvedStatusRef.current || detail.gameInfo?.status;

  const isFinished = !isCancelled && !isFuture && (
    hasOutcome ||
    currentStatus === "finished" ||
    (isGameActive && !isToday && gameHasStarted)
  );
  const isLive = !isCancelled && !isFinished && (
    detail.gameInfo?.status === "live" && !isFuture ||
    (isToday && gameHasStarted) ||
    (isToday && hasInningData)
  );
  const isBeforeGame = !isFinished && !isLive && !isCancelled;
  const hasLineup = !isBeyondTomorrow && homeLineup.length > 0 && awayLineup.length > 0;
  const showLineupStatus = isBeforeGame;
  const lineupConfirmed = isFuture ? false : (detail.lineupConfirmed ?? false);
  const statusLabel = isCancelled ? "취소" : isFinished ? "경기 종료" : isLive ? "경기 중" : "경기 전";
  const inningInfo = getInningInfo(detail.scoreBoard?.inn) || (isLive ? { inning: 1, isTop: true as const } : null);
  const liveLabel = inningInfo ? `${inningInfo.inning}회${inningInfo.isTop ? "초" : "말"}` : "경기 중";
  const gs = gameScore;
  const awayWin = isFinished && gs ? gs.away > gs.home : null;
  const homeWin = isFinished && gs ? gs.home > gs.away : null;
  const isDraw = isFinished && gs ? gs.away === gs.home : false;
  const gameDateOnly = new Date(y, m - 1, d);
  const daysSinceGame = Math.floor((Date.now() - gameDateOnly.getTime()) / (1000 * 60 * 60 * 24));
  const canMakeSticker = (isFinished || isLive) && !!gs && (
    isToday || (daysSinceGame === 1 && new Date().getHours() < 14)
  );
  const awayEmotion: "default" | "determined" | "sad" | "joyful" | "neutral" = isCancelled ? "neutral" : isBeforeGame ? "determined" : awayWin ? "joyful" : isDraw ? "neutral" : isFinished ? "sad" : "default";
  const homeEmotion: "default" | "determined" | "sad" | "joyful" | "neutral" = isCancelled ? "neutral" : isBeforeGame ? "determined" : homeWin ? "joyful" : isDraw ? "neutral" : isFinished ? "sad" : "default";

  const scoreBoard = detail.scoreBoard;
  const innData = scoreBoard?.inn || (isLive ? { away: [0], home: [] } : null);
  const rheb = scoreBoard?.rheb || (isLive ? { away: { r: 0, h: 0, e: 0 }, home: { r: 0, h: 0, e: 0 } } : null);
  const maxInn = innData ? Math.max(innData.away.length, innData.home.length) : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.headerBackBtn} hitSlop={8}>
          <Text style={styles.headerBackText}>←</Text>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={styles.headerBarTitle}>경기 상세</Text>
          {isExhibition && (
            <View style={{ backgroundColor: "#888", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>시범</Text>
            </View>
          )}
        </View>
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
              <Text style={styles.gameTime}>{detail.gameInfo?.time || scheduleTimeRef.current || "18:30"}</Text>
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
                  {isLive ? liveLabel : statusLabel}
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
        ) : (isExhibition || isFinished) ? null : (
          <View style={[styles.card, styles.noLineupCard]}>
            <Text style={styles.noLineupText}>{isFuture ? "아직 라인업이 공개되지 않았어요" : "라인업 정보가 없어요"}</Text>
            <Text style={styles.noLineupSub}>{isFuture ? "경기 시작 전에 확정 후 업데이트돼요" : ""}</Text>
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

        {showStickerCoach && (
          <View style={{ marginTop: 12, marginBottom: 8 }}>
            <CoachMark
              visible
              showChevrons={false}
              arrowDirection={canMakeSticker ? "down" : "up"}
              text={canMakeSticker ? "경기가 시작되면 스티커 생성이 활성화되고,\n다음날 14시까지 만들 수 있어요" : "직관 기록하기 버튼을 눌러\n경기 기록을 남겨보세요"}
              onDismiss={() => { setGameStickerCoachSeen(); setShowStickerCoach(false); }}
            />
          </View>
        )}

        {canMakeSticker && (
          <Pressable style={styles.stickerBtn} onPress={handleOpenSticker}>
            <Text style={styles.stickerBtnText}>스티커 만들기</Text>
          </Pressable>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          {isFinished && canMakeSticker
            ? "스티커를 만들어 공유해보세요"
            : isFinished
              ? "경기가 종료되었습니다"
              : hasLineup
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

      <StickerModal
        visible={showStickerModal}
        onClose={() => setShowStickerModal(false)}
        awayTeam={detail?.awayTeam ?? ""}
        homeTeam={detail?.homeTeam ?? ""}
        awayScore={gs?.away ?? 0}
        homeScore={gs?.home ?? 0}
        awayRank={previewData ? String(previewData.awayRank) : undefined}
        homeRank={previewData ? String(previewData.homeRank) : undefined}
        date={detail?.date ?? ""}
        scoreBoard={detail?.scoreBoard?.inn ? { away: detail.scoreBoard.inn.away, home: detail.scoreBoard.inn.home } : (isLive ? { away: [0], home: [] } : null)}
        rheb={detail?.scoreBoard?.rheb ?? null}
        isLive={isLive}
        isFinished={isFinished}
        liveInning={inningInfo ?? null}
        gameId={gid}
        venue={detail?.gameInfo?.venue}
      />

      <SimpleAlert
        visible={showStickerTimeAlert}
        title="알림"
        message="스티커는 경기 시작부터 다음날 14시까지 만들 수 있어요"
        onConfirm={() => setShowStickerTimeAlert(false)}
        onClose={() => setShowStickerTimeAlert(false)}
      />
    </View>
  );
}


