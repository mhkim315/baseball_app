import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Linking, Image } from "react-native";
import { getMyTeam } from "@/lib/db";
import TeamExpander from "@/components/TeamExpander";
import { theme } from "@/lib/theme";
import { TEAM_COLORS } from "@shared/teamColors";
import {
  fetchCheeringSongs,
  fetchCheeringPlayers,
  fetchTodayGames,
  fetchGameDetail,
  fetchDailyScores,
  type CheerSection,
  type PlayerCheer,
  type TodayGame,
  type ScoreEntry,
} from "@/lib/api";
import { TEAM_NAME_TO_ID, TEAM_ID_TO_CODE } from "@shared/constants";

const IMAGE_BASE = "https://fullcount.kr";

function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const RULES = [
  { title: "이닝(회)", desc: "공격(초)·수비(말)가 한 바퀴 도는 단위예요. 공격측에서 아웃 세 개가 나오면 그 이닝은 끝나요." },
  { title: "아웃", desc: "삼진(스트라이크 세 번), 뜬공·땅볼로 잡히거나, 주자가 태그·포스로 잡히는 식으로 세 명이 나가면 공격 턴이 끝나요." },
  { title: "타순", desc: "정해진 순서대로 타석에 서고, 경기 내내 그 순서가 계속 돌아가요." },
  { title: "득점", desc: "주자가 1·2·3루를 거쳐 홈 플레이트를 밟으면 팀에 1점이 올라가요. 안타만이 아니라 볼넷·사구 등으로 출루한 뒤 진루해도 같아요." },
  { title: "사사구(사구·볼넷)", desc: "안타 없이 타자가 1루에 나가는 경우가 있어요. 공이 몸에 맞으면 사구(몸맞는 공), 볼이 네 번 쌓이면 볼넷으로 출루해요." },
];

const GALLERY = [
  { img: "field", alt: "야구장 전경 — 수비 포지션과 전광판 등이 표시된 안내 그림", caption: "누가 어디 서 있는지, 전광판은 어디인지 한번 잡아 두면 경기가 훨씬 따라가기 쉬워요." },
  { img: "scoring", alt: "야구장 탑다운 뷰 — 주자가 베이스를 돌아 홈을 밟을 때 득점이 1점 올라가는 모습", caption: "화살표 방향대로 1·2·3루를 거쳐 홈 플레이트를 밟으면 그때 팀 점수가 1점 올라가요. 주자 여러 명이 있으면 홈을 밟은 만큼 점수가 쌓여요." },
  { img: "strike", alt: "스트라이크와 볼 — 노스윙과 스윙 시 비교", caption: "스윙을 안 했을 때: 공이 스트라이크 존을 지나가면 스트라이크, 아니면 볼이에요. 스윙을 했으면(헛스윙) 존 안·밖이랑 상관없이 스트라이크." },
  { img: "check-swing", alt: "볼·스트라이크 판정과 체크스윙 여부를 설명하는 그림", caption: '"진짜 스윙이었나?" 스윙도중 멈추게 되면 심판이 배트가 얼마나 나갔는지 봐요. 애매하면 비디오 판독이 나올 수 있어요.' },
  { img: "walk-hit-by-pitch", alt: "사구와 볼넷 — 안타 없이 타자가 출루하는 두 가지 예", caption: "사구(몸맞는 공)는 던진 공이 타자 몸에 맞으면 출루해요. 볼넷은 스트라이크 세 번 전에 볼이 네 번 쌓이면 걸어서 1루로 가요. 둘 다 안타 없이 1루에 나가는 대표적인 경우예요." },
  { img: "batted-ball", alt: "파울볼, 홈런, 플라이볼, 안타 네 가지 타구 예시", caption: "파울은 파울 라인 밖으로 나간 타구예요. 홈런은 타구가 담장을 넘겨 모든 주자가 홈으로 들어와요. 뜬공은 공이 높이 떠서 수비가 잡으면 아웃인 타구예요. 안타는 수비가 잡지 못하고 공이 페어 안에 떨어져 주자가 진루하는 경우를 말해요." },
  { img: "force-tag", alt: "포스아웃과 태그아웃의 차이를 보여주는 그림", caption: "포스 아웃은 \"지금 꼭 가야 하는 베이스\"가 정해져 있을 때, 수비가 그 베이스만 밟아도 아웃이 나는 거예요(뒤에 주자가 생겨 밀려나는 상황 등). 그게 아닐 때에는 태그 아웃으로 주자 몸을 직접 건드려야 아웃이에요." },
  { img: "umpire", alt: "세이프, 아웃, 스트라이크, 볼 — 심판 수신호 안내", caption: "멀리 앉아도 심판 손동작만 알아 두면 세이프·아웃·스트라이크·볼을 빠르게 구분할 수 있어요." },
];

type TabId = "songs" | "players" | "rules";

export default function CheerScreen() {
  const [myTeam, setMyTeam] = useState<string | null>(null);
  const [displayTeam, setDisplayTeam] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("songs");

  const [sections, setSections] = useState<CheerSection[]>([]);
  const [players, setPlayers] = useState<PlayerCheer[]>([]);
  const [lineupPlayers, setLineupPlayers] = useState<string[]>([]);
  const [lineupSource, setLineupSource] = useState<"today" | "prev" | "dummy">("dummy");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(0);

  useEffect(() => {
    getMyTeam().then(setMyTeam);
  }, []);

  const activeTeam = displayTeam || myTeam || "doosan";

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setLineupPlayers([]);
    Promise.all([
      fetchCheeringSongs(activeTeam),
      fetchCheeringPlayers(activeTeam),
    ]).then(([songsData, playersData]) => {
      if (cancelled) return;
      if (songsData) setSections(songsData.sections);
      if (playersData) setPlayers(playersData.players);

      const tryTodayLineup = () =>
        fetchTodayGames().then((today) => {
          if (!today?.games) return null;
          const myGame = today.games.find(
            (g: TodayGame) => g.home?.id === activeTeam || g.away?.id === activeTeam
          );
          if (!myGame?.id) return null;
          return fetchGameDetail(myGame.id).then((detail) => {
            if (!detail?.lineup) return null;
            const side = detail.homeTeam === activeTeam ? "home" : "away";
            const batters = detail.lineup[side] || [];
            return batters.length > 0 ? batters.map((b) => b.name) : null;
          });
        });

      const tryPrevLineup = () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = formatDateStr(yesterday);
        return fetchDailyScores(yStr).then((scores) => {
          if (!scores?.games) return null;
          const teamKr = TEAM_COLORS[activeTeam]?.shortName || "";
          const game = scores.games.find(
            (g: ScoreEntry) => g.home === teamKr || g.away === teamKr
          );
          if (!game) return null;
          const awayId = TEAM_NAME_TO_ID[game.away] || "";
          const homeId = TEAM_NAME_TO_ID[game.home] || "";
          const awayCode = TEAM_ID_TO_CODE[awayId] || "";
          const homeCode = TEAM_ID_TO_CODE[homeId] || "";
          if (!awayCode || !homeCode) return null;
          const gameId = `${yStr.replace(/-/g, "")}-${awayCode}${homeCode}-0`;
          return fetchGameDetail(gameId).then((detail) => {
            if (!detail?.lineup) return null;
            const side = detail.homeTeam === activeTeam ? "home" : "away";
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
    }).catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [activeTeam]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  const displayPlayers = lineupPlayers.length > 0 ? lineupPlayers : players.map((p) => p.name);
  const teamColor = TEAM_COLORS[activeTeam];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>응원</Text>
        {myTeam && (
          <TeamExpander
            currentTeamId={activeTeam}
            onSelectTeam={setDisplayTeam}
          />
        )}
      </View>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        {(["songs", "players", "rules"] as const).map((tab) => {
          const labels: Record<TabId, string> = { songs: "구단 응원가", players: "선수 응원가", rules: "야구 규칙" };
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && { borderBottomColor: teamColor?.primary || theme.primary, borderBottomWidth: 2 }]}
            >
              <Text style={[styles.tabText, activeTab === tab && { color: teamColor?.primary || theme.primary, fontWeight: "700" }]}>
                {labels[tab]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 48 }} />
        ) : (
          <>
            {/* 구단 응원가 */}
            {activeTab === "songs" && (
              sections.length > 0 ? (
                sections.map((section, idx) => {
                  const isOpen = expanded === idx;
                  return (
                    <View key={idx} style={styles.section}>
                      <Pressable
                        style={styles.sectionHeader}
                        onPress={() => setExpanded(isOpen ? null : idx)}
                      >
                        <View style={[styles.sectionDot, { backgroundColor: teamColor?.primary || theme.primary }]} />
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        <Text style={styles.sectionCount}>{section.songs.length}곡</Text>
                        <Text style={styles.sectionArrow}>{isOpen ? "▲" : "▼"}</Text>
                      </Pressable>
                      {isOpen && section.songs.map((song, i) => (
                        <Pressable
                          key={i}
                          style={styles.songItem}
                          onPress={() => song.youtubeUrl && Linking.openURL(song.youtubeUrl)}
                        >
                          <Text style={styles.songName}>{song.name}</Text>
                          <Text style={styles.songLinkIcon}>🔗</Text>
                        </Pressable>
                      ))}
                    </View>
                  );
                })
              ) : (
                <Text style={styles.empty}>응원가 정보가 없습니다</Text>
              )
            )}

            {/* 선수 응원가 */}
            {activeTab === "players" && (
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
                  <Text style={styles.empty}>아직 라인업 정보가 없어요</Text>
                )}
              </View>
            )}

            {/* 야구 규칙 */}
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
                      <Image
                        source={{ uri: `${IMAGE_BASE}/rules/${item.img}.jpg` }}
                        style={styles.galleryImage}
                        resizeMode="contain"
                      />
                      <Text style={styles.galleryCaption}>{item.caption}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.foreground,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },

  // Tabs
  tabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: theme.border, marginHorizontal: 16 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10 },
  tabText: { fontSize: 12, color: theme.mutedForeground, fontWeight: "500" },

  // Song sections
  section: {
    backgroundColor: theme.card,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 8,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: theme.foreground, flex: 1 },
  sectionCount: { fontSize: 11, color: theme.mutedForeground },
  sectionArrow: { fontSize: 10, color: theme.mutedForeground },
  songItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  songName: { fontSize: 14, fontWeight: "600", color: theme.foreground },
  songLinkIcon: { fontSize: 14 },

  // Players
  playersCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: "hidden",
  },
  playersHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.muted,
  },
  playersSource: { fontSize: 11, fontWeight: "600", color: theme.foreground, marginBottom: 2 },
  playersHint: { fontSize: 10, color: theme.mutedForeground },
  playersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  playerItem: {
    width: "33.33%",
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: theme.border,
  },
  playerName: { fontSize: 13, fontWeight: "500", color: theme.foreground },

  // Rules
  rulesCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    marginBottom: 16,
  },
  rulesIntro: {
    fontSize: 13,
    color: theme.mutedForeground,
    marginBottom: 16,
    lineHeight: 20,
  },
  ruleItem: {
    marginBottom: 12,
  },
  ruleTitle: { fontSize: 14, fontWeight: "700", color: theme.foreground, marginBottom: 2 },
  ruleDesc: { fontSize: 13, color: theme.secondaryForeground, lineHeight: 20 },

  // Gallery
  gallerySection: { gap: 12 },
  galleryCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: "hidden",
  },
  galleryImage: { width: "100%", height: 200 },
  galleryCaption: {
    fontSize: 12,
    color: theme.mutedForeground,
    lineHeight: 18,
    padding: 12,
  },

  // States
  empty: {
    textAlign: "center",
    color: theme.mutedForeground,
    marginTop: 48,
    fontSize: 14,
  },
});
