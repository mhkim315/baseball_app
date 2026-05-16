import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Image, StyleSheet, Linking, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { TEAM_COLORS, TEAM_LIST } from "@shared/teamColors";
import { TEAM_NAME_TO_ID, TEAM_ID_TO_CODE } from "@shared/constants";
import { fetchCheeringSongs, fetchCheeringPlayers, fetchTodayGames, fetchGameDetail, fetchDailyScores } from "@/lib/api";
import type { CheerSection, PlayerCheer } from "@/lib/api";
import { theme } from "@/lib/theme";

const API_BASE = "https://api.fullcount.kr";
const WEB_BASE = "https://fullcount.kr";

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
  { img: "field", alt: "야구장 전경", caption: "누가 어디 서 있는지, 전광판은 어디인지 한번 잡아 두면 경기가 훨씬 따라가기 쉬워요." },
  { img: "scoring", alt: "득점", caption: "화살표 방향대로 1·2·3루를 거쳐 홈 플레이트를 밟으면 그때 팀 점수가 1점 올라가요. 주자 여러 명이 있으면 홈을 밟은 만큼 점수가 쌓여요." },
  { img: "strike", alt: "스트라이크와 볼", caption: "스윙을 안 했을 때: 공이 스트라이크 존을 지나가면 스트라이크, 아니면 볼이에요. 스윙을 했으면(헛스윙) 존 안·밖이랑 상관없이 스트라이크." },
  { img: "check-swing", alt: "체크스윙", caption: '"진짜 스윙이었나?" 스윙도중 멈추게 되면 심판이 배트가 얼마나 나갔는지 봐요. 애매하면 비디오 판독이 나올 수 있어요.' },
  { img: "walk-hit-by-pitch", alt: "사구와 볼넷", caption: "사구(몸맞는 공)는 던진 공이 타자 몸에 맞으면 출루해요. 볼넷은 스트라이크 세 번 전에 볼이 네 번 쌓이면 걸어서 1루로 가요. 둘 다 안타 없이 1루에 나가는 대표적인 경우예요." },
  { img: "batted-ball", alt: "타구 종류", caption: "파울은 파울 라인 밖으로 나간 타구예요. 홈런은 타구가 담장을 넘겨 모든 주자가 홈으로 들어와요. 뜬공은 공이 높게 떠서 수비가 잡으면 아웃인 타구예요. 안타는 수비가 잡지 못하고 공이 페어 안에 떨어져 주자가 진루하는 경우를 말해요." },
  { img: "force-tag", alt: "포스아웃과 태그아웃", caption: "포스 아웃은 \"지금 꼭 가야 하는 베이스\"가 정해져 있을 때, 수비가 그 베이스만 밟아도 아웃이 나는 거예요. 그게 아닐 때에는 태그 아웃으로 주자 몸을 직접 건드려야 아웃이에요." },
  { img: "umpire", alt: "심판 수신호", caption: "멀리 앉아도 심판 손동작만 알아 두면 세이프·아웃·스트라이크·볼을 빠르게 구분할 수 있어요." },
];

export default function CheerScreen() {
  const router = useRouter();
  const [selectedTeam, setSelectedTeam] = useState("doosan");
  const [activeTab, setActiveTab] = useState<"songs" | "players" | "rules">("songs");
  const [expandedSection, setExpandedSection] = useState<number | null>(0);

  const [sections, setSections] = useState<CheerSection[]>([]);
  const [players, setPlayers] = useState<PlayerCheer[]>([]);
  const [lineupPlayers, setLineupPlayers] = useState<string[]>([]);
  const [lineupSource, setLineupSource] = useState<"today" | "prev" | "dummy">("dummy");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setLineupPlayers([]);
    Promise.all([
      fetchCheeringSongs(selectedTeam),
      fetchCheeringPlayers(selectedTeam),
    ]).then(([songsData, playersData]) => {
      if (cancelled) return;
      if (songsData) setSections(songsData.sections);
      if (playersData) setPlayers(playersData.players);

      const tryTodayLineup = () =>
        fetchTodayGames().then((today) => {
          if (!today?.games) return null;
          const myGame = today.games.find(
            (g: any) => g.home?.id === selectedTeam || g.away?.id === selectedTeam
          );
          if (!myGame?.id) return null;
          return fetchGameDetail(myGame.id).then((detail) => {
            if (!detail?.lineup) return null;
            const side = detail.homeTeam === selectedTeam ? "home" : "away";
            const batters = detail.lineup[side] || [];
            return batters.length > 0 ? batters.map((b: any) => b.name) : null;
          });
        });

      const tryPrevLineup = () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = formatDateStr(yesterday);
        return fetchDailyScores(yStr).then((scores: any) => {
          if (!scores?.games) return null;
          const teamKr = TEAM_COLORS[selectedTeam]?.shortName || "";
          const game = scores.games.find(
            (g: any) => g.home === teamKr || g.away === teamKr
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
            const side = detail.homeTeam === selectedTeam ? "home" : "away";
            const batters = detail.lineup[side] || [];
            return batters.length > 0 ? batters.map((b: any) => b.name) : null;
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
  }, [selectedTeam]);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  const displayPlayers = lineupPlayers.length > 0 ? lineupPlayers : players.map((p) => p.name);
  const team = TEAM_COLORS[selectedTeam];
  const totalSongs = sections.reduce((a, s) => a + s.songs.length, 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🎵 응원가</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll}>
        {/* Team selector 2×5 */}
        <View style={styles.teamGrid}>
          {TEAM_LIST.map((teamItem) => (
            <Pressable
              key={teamItem.id}
              onPress={() => { setSelectedTeam(teamItem.id); setExpandedSection(0); }}
              style={[
                styles.teamItem,
                selectedTeam === teamItem.id && { backgroundColor: teamItem.primary, borderColor: teamItem.primary },
              ]}
            >
              <Text style={[styles.teamItemText, selectedTeam === teamItem.id && styles.teamItemTextActive]}>
                {teamItem.shortName}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Team header */}
        {team && (
          <View style={styles.teamHeader}>
            <View style={[styles.teamDotLarge, { backgroundColor: team.primary }]} />
            <View style={styles.teamHeaderInfo}>
              <Text style={styles.teamHeaderName}>{team.name}</Text>
              <Text style={styles.teamHeaderSub}>
                응원가 {totalSongs}곡 · 선수 {displayPlayers.length}명
              </Text>
            </View>
          </View>
        )}

        {/* Sub-tabs */}
        <View style={styles.subTabRow}>
          <Pressable
            onPress={() => setActiveTab("songs")}
            style={[styles.subTab, activeTab === "songs" && styles.subTabActive]}
          >
            <Text style={[styles.subTabText, activeTab === "songs" && styles.subTabTextActive]}>
              구단 응원가
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("players")}
            style={[styles.subTab, activeTab === "players" && styles.subTabActive]}
          >
            <Text style={[styles.subTabText, activeTab === "players" && styles.subTabTextActive]}>
              선수 응원가
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("rules")}
            style={[styles.subTab, activeTab === "rules" && styles.subTabActive]}
          >
            <Text style={[styles.subTabText, activeTab === "rules" && styles.subTabTextActive]}>
              야구 규칙
            </Text>
          </Pressable>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : error ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.errorText}>정보를 불러올 수 없습니다</Text>
              <Pressable onPress={() => { setLoading(true); setError(false); load(); }} style={styles.retryBtn}>
                <Text style={styles.retryText}>재시도</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {activeTab === "songs" && (
                <View style={styles.songList}>
                  {sections.length > 0 ? (
                    sections.map((section, sIdx) => (
                      <View key={sIdx} style={styles.sectionCard}>
                        <Pressable
                          onPress={() => setExpandedSection(expandedSection === sIdx ? null : sIdx)}
                          style={styles.sectionHeader}
                        >
                          <View style={styles.sectionHeaderLeft}>
                            <View style={[styles.sectionDot, { backgroundColor: team?.primary }]} />
                            <Text style={styles.sectionTitle}>{section.title}</Text>
                            <Text style={styles.sectionCount}>{section.songs.length}곡</Text>
                          </View>
                          <Text style={styles.sectionArrow}>
                            {expandedSection === sIdx ? "▲" : "▼"}
                          </Text>
                        </Pressable>
                        {expandedSection === sIdx && (
                          <View style={styles.songItems}>
                            {section.songs.map((song, songIdx) => (
                              <Pressable
                                key={songIdx}
                                style={styles.songItem}
                                onPress={() => Linking.openURL(song.youtubeUrl)}
                              >
                                <View style={styles.songItemLeft}>
                                  <View style={[styles.songIcon, { backgroundColor: (team?.primary || "#000") + "20" }]}>
                                    <Text style={[styles.songIconText, { color: team?.primary }]}>♪</Text>
                                  </View>
                                  <Text style={styles.songName}>{song.name}</Text>
                                </View>
                                <Text style={styles.externalIcon}>↗</Text>
                              </Pressable>
                            ))}
                          </View>
                        )}
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyText}>아직 응원가 정보가 없어요</Text>
                    </View>
                  )}
                </View>
              )}

              {activeTab === "players" && (
                <View style={styles.playerCard}>
                  <View style={styles.playerHintBar}>
                    <Text style={styles.playerHint}>
                      {lineupSource === "today" ? "오늘 라인업 기준 · " : lineupSource === "prev" ? "전경기 라인업 기준 · " : ""}
                      선수 이름을 탭하면 YouTube에서 응원가를 검색합니다
                    </Text>
                  </View>
                  {displayPlayers.length > 0 ? (
                    <View style={styles.playerGrid}>
                      {displayPlayers.map((name, i) => (
                        <Pressable
                          key={i}
                          style={styles.playerItem}
                          onPress={() => Linking.openURL(
                            `https://www.youtube.com/results?search_query=${encodeURIComponent(team?.name + " " + name + " 응원가")}`
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
              )}

              {activeTab === "rules" && (
                <View>
                  <View style={styles.rulesCard}>
                    <Text style={styles.rulesIntro}>
                      처음 직관할 때 꼭 알면 좋은 것만 골라 적었어요. 더 자세한 규정은 아래 내용을 확인하면 돼요.
                    </Text>
                    <View style={styles.rulesList}>
                      {RULES.map((r, i) => (
                        <Text key={i} style={styles.ruleItem}>
                          <Text style={styles.ruleTitle}>{r.title}</Text>
                          <Text style={styles.ruleDesc}>: {r.desc}</Text>
                        </Text>
                      ))}
                    </View>
                  </View>
                  <View style={styles.gallerySection}>
                    <Text style={styles.galleryHint}>
                      아래는 그림 순서대로, 경기장 전체 → 득점(홈에서 1점) → 스트라이크·볼 → 체크스윙 → 사사구(몸맞는 공·볼넷) → 타구 → 포스·태그 → 심판 수신호 흐름이에요.
                    </Text>
                    {GALLERY.map((item, i) => (
                      <View key={i} style={styles.galleryCard}>
                        <Image
                          source={{ uri: `${WEB_BASE}/rules/${item.img}.jpg` }}
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
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: 60, paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  backBtn: { padding: 8, width: 60 },
  backText: { color: theme.foreground, fontSize: 20 },
  headerTitle: { fontSize: 17, fontWeight: "600", color: theme.foreground },
  scroll: { flex: 1 },

  // Team grid
  teamGrid: {
    flexDirection: "row", flexWrap: "wrap", justifyContent: "center",
    gap: 6, paddingHorizontal: 12, paddingTop: 16, marginBottom: 12,
  },
  teamItem: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card,
  },
  teamItemText: { fontSize: 12, color: theme.mutedForeground, fontWeight: "500" },
  teamItemTextActive: { color: "#fff", fontWeight: "700" },

  // Team header
  teamHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border,
    padding: 16, marginHorizontal: 16, marginBottom: 12,
  },
  teamDotLarge: { width: 40, height: 40, borderRadius: 20 },
  teamHeaderInfo: { flex: 1 },
  teamHeaderName: { fontSize: 15, fontWeight: "700", color: theme.foreground },
  teamHeaderSub: { fontSize: 11, color: theme.mutedForeground, marginTop: 2 },

  // Sub-tabs
  subTabRow: {
    flexDirection: "row", marginHorizontal: 16, gap: 4,
    backgroundColor: theme.secondary, borderRadius: 12, padding: 3,
  },
  subTab: {
    flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10,
  },
  subTabActive: { backgroundColor: theme.card },
  subTabText: { fontSize: 12, color: theme.mutedForeground, fontWeight: "500" },
  subTabTextActive: { color: theme.foreground, fontWeight: "600" },

  // Content
  content: { padding: 16, paddingBottom: 40 },
  loadingContainer: { paddingVertical: 60, alignItems: "center" },
  errorText: { color: theme.mutedForeground, fontSize: 14, marginBottom: 16 },
  retryBtn: { paddingVertical: 8, paddingHorizontal: 20, backgroundColor: theme.foreground, borderRadius: 16 },
  retryText: { color: theme.background, fontSize: 13, fontWeight: "600" },

  // Songs tab
  songList: { gap: 8 },
  sectionCard: {
    backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16,
  },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: theme.foreground },
  sectionCount: { fontSize: 11, color: theme.mutedForeground },
  sectionArrow: { fontSize: 10, color: theme.mutedForeground },
  songItems: { borderTopWidth: 1, borderTopColor: theme.border },
  songItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  songItemLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  songIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  songIconText: { fontSize: 16, fontWeight: "700" },
  songName: { fontSize: 13, fontWeight: "500", color: theme.foreground, flex: 1 },
  externalIcon: { fontSize: 14, color: theme.mutedForeground },
  emptyCard: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 32, alignItems: "center" },
  emptyText: { fontSize: 13, color: theme.mutedForeground },

  // Players tab
  playerCard: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, overflow: "hidden" },
  playerHintBar: { padding: 12, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.secondary },
  playerHint: { fontSize: 11, color: theme.mutedForeground },
  playerGrid: { flexDirection: "row", flexWrap: "wrap" },
  playerItem: {
    width: "33.33%", alignItems: "center", justifyContent: "center",
    paddingVertical: 14, paddingHorizontal: 8,
    borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: theme.border,
  },
  playerName: { fontSize: 13, fontWeight: "500", color: theme.foreground },

  // Rules tab
  rulesCard: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 16, marginBottom: 16 },
  rulesIntro: { fontSize: 13, color: theme.mutedForeground, lineHeight: 20, marginBottom: 16 },
  rulesList: { gap: 10 },
  ruleItem: { fontSize: 13, lineHeight: 20 },
  ruleTitle: { fontWeight: "700", color: theme.foreground },
  ruleDesc: { color: theme.secondaryForeground },
  gallerySection: { gap: 16 },
  galleryHint: { fontSize: 12, color: theme.mutedForeground, lineHeight: 18, paddingHorizontal: 2 },
  galleryCard: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, overflow: "hidden" },
  galleryImage: { width: "100%", height: 200 },
  galleryCaption: { fontSize: 12, color: theme.secondaryForeground, lineHeight: 18, padding: 16 },
});
