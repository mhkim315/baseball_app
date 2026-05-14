import { useState, useEffect, useCallback } from "react";
import { TEAM_COLORS, TEAM_LIST } from "@/lib/teamColors";
import { fetchCheeringSongs, fetchCheeringPlayers, fetchTodayGames, fetchGameDetail, fetchDailyScores, type CheerSection, type PlayerCheer, type TodayGame, type ScoreEntry } from "@/lib/api";
import { Music, ExternalLink, User, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { config } from "@/lib/config";
import { TeamBadge } from "@/components/TeamBadge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorRetry } from "@/components/ErrorRetry";
import { TEAM_NAME_TO_ID, TEAM_ID_TO_CODE as TEAM_TO_CODE } from "@shared/constants";

function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const BASE = config.baseUrl;

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

export default function Cheer() {
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
            (g: TodayGame) => g.home?.id === selectedTeam || g.away?.id === selectedTeam
          );
          if (!myGame?.id) return null;
          return fetchGameDetail(myGame.id).then((detail) => {
            if (!detail?.lineup) return null;
            const side = detail.homeTeam === selectedTeam ? "home" : "away";
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
          const teamKr = TEAM_COLORS[selectedTeam]?.shortName || "";
          const game = scores.games.find(
            (g: ScoreEntry) => g.home === teamKr || g.away === teamKr
          );
          if (!game) return null;
          const awayId = TEAM_NAME_TO_ID[game.away] || "";
          const homeId = TEAM_NAME_TO_ID[game.home] || "";
          const awayCode = TEAM_TO_CODE[awayId] || "";
          const homeCode = TEAM_TO_CODE[homeId] || "";
          if (!awayCode || !homeCode) return null;
          const gameId = `${yStr.replace(/-/g, "")}-${awayCode}${homeCode}-0`;
          return fetchGameDetail(gameId).then((detail) => {
            if (!detail?.lineup) return null;
            const side = detail.homeTeam === selectedTeam ? "home" : "away";
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
  }, [selectedTeam]);

  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);

  // Use lineup players if available, otherwise fall back to dummy players
  const displayPlayers = lineupPlayers.length > 0 ? lineupPlayers : players.map((p) => p.name);

  const team = TEAM_COLORS[selectedTeam];
  const totalSongs = sections.reduce((a, s) => a + s.songs.length, 0);

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      {/* 모바일 헤더 */}
      <div className="md:hidden px-5 pt-6 pb-4">
        <h1 className="text-xl font-bold">응원가</h1>
        <p className="text-sm text-muted-foreground mt-0.5">구단별 응원가와 선수 응원가를 모아봤어요</p>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-2 md:mt-6">
        {/* 팀 선택 2×5 그리드 */}
        <div className="grid grid-cols-5 gap-2">
          {TEAM_LIST.map((t) => (
            <button
              key={t.id}
              onClick={() => { setSelectedTeam(t.id); setExpandedSection(0); }}
              className={`px-2 py-2 rounded-lg text-sm font-medium transition-all border text-center ${
                selectedTeam === t.id
                  ? "text-white border-transparent shadow-sm"
                  : "text-foreground border-border bg-card hover:bg-accent"
              }`}
              style={
                selectedTeam === t.id
                  ? { backgroundColor: t.primary, borderColor: t.primary }
                  : undefined
              }
            >
              {t.shortName}
            </button>
          ))}
        </div>

        {/* 팀 헤더 */}
        {team && (
          <div className="bg-card rounded-2xl border border-border p-5 mt-3">
            <div className="flex items-center gap-3">
              <TeamBadge teamId={selectedTeam} size="md" />
              <div>
                <h3 className="font-semibold text-base">{team.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  응원가 {totalSongs}곡 · 선수 {displayPlayers.length}명
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 탭 전환 */}
        <div className="flex gap-1 mt-4 bg-accent/50 rounded-xl p-1">
          <button
            onClick={() => setActiveTab("songs")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm transition-all ${
              activeTab === "songs"
                ? "bg-card shadow-sm font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Music size={16} />
            <span>구단 응원가</span>
          </button>
          <button
            onClick={() => setActiveTab("players")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm transition-all ${
              activeTab === "players"
                ? "bg-card shadow-sm font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <User size={16} />
            <span>선수 응원가</span>
          </button>
          <button
            onClick={() => setActiveTab("rules")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm transition-all ${
              activeTab === "rules"
                ? "bg-card shadow-sm font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen size={16} />
            <span>야구 규칙</span>
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="mt-3 pb-4">
          {loading ? (
            <LoadingSpinner />
          ) : error ? (
            <ErrorRetry onRetry={load} />
          ) : (
            <>
              {/* 팀 응원가 */}
              {activeTab === "songs" && (
                <div className="flex flex-col gap-2">
                  {sections.length > 0 ? (
                    sections.map((section, sIdx) => (
                      <div key={sIdx} className="bg-card rounded-2xl border border-border overflow-hidden">
                        {/* 섹션 헤더 */}
                        <button
                          onClick={() => setExpandedSection(expandedSection === sIdx ? null : sIdx)}
                          className="w-full flex items-center justify-between p-4 hover:bg-accent/20 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: team?.primary }}
                            />
                            <span className="text-sm font-semibold">{section.title}</span>
                            <span className="text-xs text-muted-foreground">{section.songs.length}곡</span>
                          </div>
                          {expandedSection === sIdx ? (
                            <ChevronUp size={16} className="text-muted-foreground" />
                          ) : (
                            <ChevronDown size={16} className="text-muted-foreground" />
                          )}
                        </button>

                        {/* 곡 목록 */}
                        {expandedSection === sIdx && (
                          <div className="border-t border-border">
                            {section.songs.map((song, songIdx) => (
                              <a
                                key={songIdx}
                                href={song.youtubeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between px-4 py-3 hover:bg-accent/20 transition-colors border-b border-border last:border-b-0"
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: (team?.primary || "#000") + "15" }}
                                  >
                                    <Music size={14} style={{ color: team?.primary }} />
                                  </div>
                                  <span className="text-sm font-medium">{song.name}</span>
                                </div>
                                <ExternalLink size={14} className="text-muted-foreground flex-shrink-0" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="bg-card rounded-2xl border border-border p-8 text-center">
                      <p className="text-muted-foreground text-sm">아직 응원가 정보가 없어요</p>
                    </div>
                  )}
                </div>
              )}

              {/* 선수 응원가 (라인업 기준) */}
              {activeTab === "players" && (
                <div className="bg-card rounded-2xl border border-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-accent/30">
                    <p className="text-xs text-muted-foreground">
                      {lineupSource === "today" ? "오늘 라인업 기준 · " : lineupSource === "prev" ? "전경기 라인업 기준 · " : ""}
                      선수 이름을 탭하면 YouTube에서 응원가를 검색합니다
                    </p>
                  </div>
                  {displayPlayers.length > 0 ? (
                    <div className="grid grid-cols-3 gap-px bg-border">
                      {displayPlayers.map((name, i) => (
                        <a
                          key={i}
                          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(team?.name + " " + name + " 응원가")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-card flex items-center justify-center py-4 px-2 hover:bg-accent/20 transition-colors"
                        >
                          <span className="text-sm font-medium">{name}</span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <p className="text-muted-foreground text-sm">아직 라인업 정보가 없어요</p>
                    </div>
                  )}
                </div>
              )}

              {/* 야구 규칙 */}
              {activeTab === "rules" && (
                <div>
                  <div className="bg-card rounded-2xl border border-border p-5">
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                      처음 직관할 때 꼭 알면 좋은 것만 골라 적었어요. 더 자세한 규정은 아래 내용을 확인하면 돼요.
                    </p>
                    <ul className="flex flex-col gap-3">
                      {RULES.map((r, i) => (
                        <li key={i} className="text-sm leading-relaxed">
                          <strong className="text-foreground">{r.title}</strong>
                          <span className="text-muted-foreground">: {r.desc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-4 flex flex-col gap-4">
                    {GALLERY.map((item, i) => (
                      <figure key={i} className="bg-card rounded-2xl border border-border overflow-hidden">
                        <img
                          src={`${BASE}rules/${item.img}.jpg`}
                          alt={item.alt}
                          className="w-full h-auto"
                          loading="lazy"
                        />
                        <figcaption className="text-xs text-muted-foreground leading-relaxed p-4">
                          {item.caption}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
