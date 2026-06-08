import { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Linking, Image } from "react-native";
import { TEAM_COLORS } from "@shared/teamColors";
import { TEAM_NAME_TO_ID, buildGameId, formatDateForApi as formatDateStr } from "@shared/constants";
import { cachedCheeringSongs, cachedCheeringPlayers, cachedTodayGames, cachedGameDetail, cachedDailyScores } from "@/lib/gameCache";
import type { CheerSection, PlayerCheer, TodayGame, ScoreEntry } from "@/lib/api";
import { useTheme } from "@/lib/ThemeContext";
import { teamPrimaryColor } from "@shared/teamColors";

const IMAGE_BASE = "https://fullcount.kr";

const RULES = [
  { title: "이닝(회)", desc: "공격(초)·수비(말)가 한 바퀴 도는 단위예요. 공격측에서 아웃 세 개가 나오면 그 이닝은 끝나요." },
  { title: "아웃", desc: "삼진(스트라이크 세 번), 뜬공·땅볼로 잡히거나, 주자가 태그·포스로 잡히는 식으로 세 명이 나가면 공격 턴이 끝나요." },
  { title: "타순", desc: "정해진 순서대로 타석에 서고, 경기 내내 그 순서가 계속 돌아가요." },
  { title: "득점", desc: "주자가 1·2·3루를 거쳐 홈 플레이트를 밟으면 팀에 1점이 올라가요. 안타만이 아니라 볼넷·사구 등으로 출루한 뒤 진루해도 같아요." },
  { title: "사사구(사구·볼넷)", desc: "안타 없이 타자가 1루에 나가는 경우가 있어요. 공이 몸에 맞으면 사구(몸맞는 공), 볼이 네 번 쌓이면 볼넷으로 출루해요." },
];

const GALLERY = [
  { img: "field", alt: "야구장 전경", caption: "누가 어디 서 있는지, 전광판은 어디인지 한번 잡아 두면 경기가 훨씬 따라가기 쉬워요." },
  { img: "scoring", alt: "득점", caption: "화살표 방향대로 1·2·3루를 거쳐 홈 플레이트를 밟으면 그때 팀 점수가 1점 올라가요. 주자 여러 명이 있으면 홈을 밟은 만큼 점수가 쌓여요." },
  { img: "strike", alt: "스트라이크와 볼", caption: "스윙을 안 했을 때: 공이 스트라이크 존을 지나가면 스트라이크, 아니면 볼이에요. 스윙을 했으면(헛스윙) 존 안·밖이랑 상관없이 스트라이크." },
  { img: "check-swing", alt: "체크스윙", caption: '"진짜 스윙이었나?" 스윙도중 멈추게 되면 심판이 배트가 얼마나 나갔는지 봐요. 애매하면 비디오 판독이 나올 수 있어요.' },
  { img: "walk-hit-by-pitch", alt: "사구와 볼넷", caption: "사구(몸맞는 공)는 던진 공이 타자 몸에 맞으면 출루해요. 볼넷은 스트라이크 세 번 전에 볼이 네 번 쌓이면 걸어서 1루로 가요. 둘 다 안타 없이 1루에 나가는 대표적인 경우예요." },
  { img: "batted-ball", alt: "타구 종류", caption: "파울은 파울 라인 밖으로 나간 타구예요. 홈런은 타구가 담장을 넘겨 모든 주자가 홈으로 들어와요. 뜬공은 공이 높이 떠서 수비가 잡으면 아웃인 타구예요. 안타는 수비가 잡지 못하고 공이 페어 안에 떨어져 주자가 진루하는 경우를 말해요." },
  { img: "force-tag", alt: "포스아웃과 태그아웃", caption: "포스 아웃은 \"지금 꼭 가야 하는 베이스\"가 정해져 있을 때, 수비가 그 베이스만 밟아도 아웃이 나는 거예요. 그게 아닐 때에는 태그 아웃으로 주자 몸을 직접 건드려야 아웃이에요." },
  { img: "umpire", alt: "심판 수신호", caption: "멀리 앉아도 심판 손동작만 알아 두면 세이프·아웃·스트라이크·볼을 빠르게 구분할 수 있어요." },
];

interface CheerContentProps {
  teamId: string;
  activeTab: "songs" | "players" | "rules";
  expandedSection: number | null;
  onToggleSection: (idx: number | null) => void;
}

export default function CheerContent({ teamId, activeTab, expandedSection, onToggleSection }: CheerContentProps) {
  const { theme, isDark } = useTheme();
  const [sections, setSections] = useState<CheerSection[]>([]);
  const [players, setPlayers] = useState<PlayerCheer[]>([]);
  const [lineupPlayers, setLineupPlayers] = useState<string[]>([]);
  const [lineupSource, setLineupSource] = useState<"today" | "prev" | "dummy">("dummy");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setLineupPlayers([]);
    Promise.all([
      cachedCheeringSongs(teamId),
      cachedCheeringPlayers(teamId),
    ]).then(([songsData, playersData]) => {
      if (cancelled) return;
      if (songsData) {
        const enhanced = songsData.sections.map((section) => {
          if (teamId === "doosan" && section.title === "초반 분위기 올릴 때") {
            return { ...section, songs: [...section.songs, { name: "서울의 베어스", youtubeUrl: "https://www.youtube.com/watch?v=uhnm7qf9UBg" }] };
          }
          return section;
        });
        setSections(enhanced);
      }
      if (playersData) setPlayers(playersData.players);

      const tryTodayLineup = () =>
        cachedTodayGames().then((today) => {
          if (!today?.games) return null;
          const myGame = today.games.find(
            (g: TodayGame) => g.home?.id === teamId || g.away?.id === teamId
          );
          if (!myGame?.id) return null;
          return cachedGameDetail(myGame.id).then((detail) => {
            if (!detail?.lineup) return null;
            const side = detail.homeTeam === teamId ? "home" : "away";
            const batters = detail.lineup[side] || [];
            return batters.length > 0 ? batters.map((b) => b.name) : null;
          });
        });

      const tryPrevLineup = () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = formatDateStr(yesterday);
        return cachedDailyScores(yStr).then((scores) => {
          if (!scores?.games) return null;
          const teamKr = TEAM_COLORS[teamId]?.shortName || "";
          const game = scores.games.find(
            (g: ScoreEntry) => g.home === teamKr || g.away === teamKr
          );
          if (!game) return null;
          const awayId = TEAM_NAME_TO_ID[game.away] || "";
          const homeId = TEAM_NAME_TO_ID[game.home] || "";
          const gameId = buildGameId(awayId, homeId, yStr.replace(/-/g, ""));
          if (!gameId) return null;
          return cachedGameDetail(gameId).then((detail) => {
            if (!detail?.lineup) return null;
            const side = detail.homeTeam === teamId ? "home" : "away";
            const batters = detail.lineup[side] || [];
            return batters.length > 0 ? batters.map((b) => b.name) : null;
          });
        });
      };

      tryTodayLineup().then((names) => {
        if (cancelled) return;
        if (names) {
          setLineupPlayers(names);
          setLineupSource("today");
        } else {
          tryPrevLineup().then((prevNames) => {
            if (cancelled) return;
            if (prevNames) {
              setLineupPlayers(prevNames);
              setLineupSource("prev");
            }
          }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
          return;
        }
        setLoading(false);
      }).catch(() => { if (!cancelled) setLoading(false); });
    }).catch(() => { if (!cancelled) { setError(true); setLoading(false); } });

    return () => { cancelled = true; };
  }, [teamId]);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const teamColor = TEAM_COLORS[teamId];
  const displayPlayers = lineupPlayers.length > 0 ? lineupPlayers : players.map((p) => p.name);

  const styles = useMemo(() => StyleSheet.create({
    loadingContainer: { paddingVertical: 60, alignItems: "center" },
    errorText: { color: theme.mutedForeground, fontSize: 14, marginBottom: 16 },
    retryBtn: { paddingVertical: 8, paddingHorizontal: 20, backgroundColor: theme.foreground, borderRadius: 16 },
    retryText: { color: theme.background, fontSize: 13, fontWeight: "600" },

    // Songs
    section: {
      backgroundColor: theme.card, borderRadius: 16, marginBottom: 12,
      borderWidth: 1, borderColor: theme.border, overflow: "hidden",
    },
    sectionHeader: {
      flexDirection: "row", alignItems: "center", padding: 16, gap: 8,
    },
    sectionDot: { width: 8, height: 8, borderRadius: 4 },
    sectionTitle: { fontSize: 15, fontWeight: "600", color: theme.foreground, flex: 1 },
    sectionCount: { fontSize: 11, color: theme.mutedForeground },
    sectionArrow: { fontSize: 10, color: theme.mutedForeground },
    songItem: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingVertical: 12,
      borderTopWidth: 1, borderTopColor: theme.border,
    },
    songName: { fontSize: 14, fontWeight: "600", color: theme.foreground, flex: 1 },
    songLinkIcon: { fontSize: 14, color: theme.mutedForeground },

    // Players
    playersCard: {
      backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, overflow: "hidden",
    },
    playersHeader: {
      padding: 12, borderBottomWidth: 1, borderBottomColor: theme.border,
      backgroundColor: theme.secondary,
    },
    playersSource: { fontSize: 11, fontWeight: "600", color: theme.foreground, marginBottom: 2 },
    playersHint: { fontSize: 11, color: theme.mutedForeground },
    playersGrid: { flexDirection: "row", flexWrap: "wrap" },
    playerItem: {
      width: "33.33%", paddingVertical: 14, paddingHorizontal: 8,
      alignItems: "center", justifyContent: "center",
      borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: theme.border,
    },
    playerName: { fontSize: 13, fontWeight: "500", color: theme.foreground },

    // Rules
    rulesCard: {
      backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border,
      padding: 16, marginBottom: 16,
    },
    rulesIntro: { fontSize: 13, color: theme.mutedForeground, marginBottom: 16, lineHeight: 20 },
    ruleItem: { marginBottom: 12 },
    ruleTitle: { fontSize: 14, fontWeight: "700", color: theme.foreground, marginBottom: 2 },
    ruleDesc: { fontSize: 13, color: theme.secondaryForeground, lineHeight: 20 },

    // Gallery
    gallerySection: { gap: 12 },
    galleryCard: {
      backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, overflow: "hidden",
    },
    galleryImage: { width: "100%", aspectRatio: 16 / 9 },
    galleryImageTall: { width: "100%", height: 200 },
    galleryFallback: { width: "100%", aspectRatio: 16 / 9, alignItems: "center", justifyContent: "center", backgroundColor: theme.muted },
    galleryFallbackTall: { width: "100%", height: 200, alignItems: "center", justifyContent: "center", backgroundColor: theme.muted },
    galleryFallbackText: { fontSize: 14, color: theme.mutedForeground, fontWeight: "500" },
    galleryCaption: { fontSize: 12, color: theme.mutedForeground, lineHeight: 18, padding: 12 },

    // States
    emptyCard: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 32, alignItems: "center" },
    emptyText: { fontSize: 13, color: theme.mutedForeground },
  }), [theme]);

  return (
    <View>
      {activeTab === "songs" && (
        loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : error ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.errorText}>정보를 불러올 수 없습니다</Text>
            <Pressable onPress={load} style={styles.retryBtn}>
              <Text style={styles.retryText}>재시도</Text>
            </Pressable>
          </View>
        ) : (
        sections.length > 0 ? (
          sections.map((section, idx) => (
            <View key={idx} style={styles.section}>
              <Pressable
                style={styles.sectionHeader}
                onPress={() => onToggleSection(expandedSection === idx ? null : idx)}
              >
                <View style={[styles.sectionDot, { backgroundColor: teamPrimaryColor(teamId, isDark) || theme.primary }]} />
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionCount}>{section.songs.length}곡</Text>
                <Text style={styles.sectionArrow}>{expandedSection === idx ? "▲" : "▼"}</Text>
              </Pressable>
              {expandedSection === idx && section.songs.map((song, i) => (
                <Pressable
                  key={i}
                  style={styles.songItem}
                  onPress={() => song.youtubeUrl && Linking.openURL(song.youtubeUrl)}
                >
                  <Text style={styles.songName}>{song.name}</Text>
                  <Text style={styles.songLinkIcon}>↗</Text>
                </Pressable>
              ))}
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>아직 응원가 정보가 없어요</Text>
          </View>
        )
      )
      )}

      {activeTab === "players" && (
        loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : error ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.errorText}>정보를 불러올 수 없습니다</Text>
            <Pressable onPress={load} style={styles.retryBtn}>
              <Text style={styles.retryText}>재시도</Text>
            </Pressable>
          </View>
        ) : (
        <View style={styles.playersCard}>
          <View style={styles.playersHeader}>
            <Text style={styles.playersSource}>
              {lineupSource === "today" ? "오늘 라인업 기준" : lineupSource === "prev" ? "전경기 라인업 기준" : ""}
            </Text>
            <Text style={styles.playersHint}>선수 이름을 탭하면 YouTube에서 응원가를 검색합니다</Text>
          </View>
          {displayPlayers.length > 0 ? (
            <View style={styles.playersGrid}>
              {displayPlayers.map((name, i) => (
                <Pressable
                  key={i}
                  style={styles.playerItem}
                  onPress={() => Linking.openURL(
                    `https://www.youtube.com/results?search_query=${encodeURIComponent((teamColor?.name || "") + " " + name + " 응원가")}`
                  )}
                >
                  <Text style={styles.playerName}>{name}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>아직 라인업 정보가 없어요</Text>
            </View>
          )}
        </View>
        )
      )}

      {activeTab === "rules" && (
        <View>
          <View style={styles.rulesCard}>
            <Text style={styles.rulesIntro}>
              처음 직관할 때 꼭 알면 좋은 것만 골라 적었어요.
            </Text>
            {RULES.map((r, i) => (
              <View key={i} style={styles.ruleItem}>
                <Text style={styles.ruleTitle}>{r.title}</Text>
                <Text style={styles.ruleDesc}>{r.desc}</Text>
              </View>
            ))}
          </View>
          <View style={styles.gallerySection}>
            {GALLERY.map((item, i) => (
              <View key={i} style={styles.galleryCard}>
                {failedImages.has(i) ? (
                  <View style={i === 1 ? styles.galleryFallbackTall : styles.galleryFallback}>
                    <Text style={styles.galleryFallbackText}>{item.alt}</Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: `${IMAGE_BASE}/rules/${item.img}.jpg` }}
                    style={i === 1 ? styles.galleryImageTall : styles.galleryImage}
                    resizeMode={i === 1 ? "cover" : "contain"}
                    onError={() => setFailedImages((prev) => new Set(prev).add(i))}
                  />
                )}
                <Text style={styles.galleryCaption}>{item.caption}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}


