import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { TEAM_COLORS } from "@shared/teamColors";
import { TeamBadge } from "@/components/TeamBadge";
import { useTheme } from "@/lib/ThemeContext";
import { teamPrimaryColor } from "@shared/teamColors";
import { gameEmotions } from "./useDiaryForm";
import type { GameOption } from "./useDiaryForm";

export default function DiaryGamesStep({ games, gamesLoading, dateStrShort, userTeam, showOtherGames, setShowOtherGames, handleGameSelect, styles }: {
  games: GameOption[];
  gamesLoading: boolean;
  dateStrShort: string;
  userTeam: string;
  showOtherGames: boolean;
  setShowOtherGames: React.Dispatch<React.SetStateAction<boolean>>;
  handleGameSelect: (game: GameOption) => void;
  styles: Record<string, any>;
}) {
  const { theme, isDark } = useTheme();

  return (
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
        </View>
      ) : (
        <>
        {(() => {
          const myGames = games.filter(g => userTeam && (g.homeTeam === userTeam || g.awayTeam === userTeam));
          const otherGames = games.filter(g => !(userTeam && (g.homeTeam === userTeam || g.awayTeam === userTeam)));

          return (
            <>
            {myGames.map((myGame, myIdx) => {
              const home = TEAM_COLORS[myGame.homeTeam];
              const away = TEAM_COLORS[myGame.awayTeam];
              const hasScore = myGame.homeScore != null && myGame.awayScore != null;
              const emotions = gameEmotions(myGame);
              const myTeamColor = teamPrimaryColor(userTeam, isDark);
              return (
                <View key={`my-${myGame.homeTeam}-${myGame.awayTeam}-${myIdx}`} style={styles.gameList}>
                  <Pressable
                    style={[styles.gameCard, myTeamColor && { borderColor: myTeamColor, borderWidth: 2 }]}
                    onPress={() => handleGameSelect(myGame)}
                  >
                    <View style={styles.gameCardTop}>
                      {userTeam === myGame.awayTeam && (
                        <View style={[styles.myBadgeEdge, { left: 0 }]}>
                          <Text style={[styles.myBadge, { backgroundColor: myTeamColor || theme.muted }]}>MY</Text>
                        </View>
                      )}
                      {userTeam === myGame.homeTeam && (
                        <View style={[styles.myBadgeEdge, { right: 0 }]}>
                          <Text style={[styles.myBadge, { backgroundColor: myTeamColor || theme.muted }]}>MY</Text>
                        </View>
                      )}

                      <View style={styles.gameTeamRow}>
                        <TeamBadge teamId={myGame.awayTeam} size="sm" emotion={emotions?.away ?? "default"} />
                        <Text style={[styles.gameTeamName, { color: teamPrimaryColor(myGame.awayTeam, isDark) }]}>
                          {away?.shortName || "?"}
                        </Text>
                        {hasScore && (
                          <Text style={styles.gameScore}>{myGame.awayScore}</Text>
                        )}
                      </View>

                      {myGame.cancelled ? (
                        <Text style={styles.gameVs}>취소</Text>
                      ) : (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Text style={styles.gameVs}>VS</Text>
                          <Text style={styles.gameMeta}>{myGame.time}</Text>
                          {myGame.isPostseason && (
                            <View style={[styles.exhibitionBadge, { backgroundColor: "#eab308" }]}>
                              <Text style={[styles.exhibitionBadgeText, { color: "#fff" }]}>PS</Text>
                            </View>
                          )}
                          {myGame.isExhibition && !myGame.isPostseason && (
                            <View style={styles.exhibitionBadge}>
                              <Text style={styles.exhibitionBadgeText}>시범</Text>
                            </View>
                          )}
                        </View>
                      )}

                      <View style={styles.gameTeamRow}>
                        {hasScore && (
                          <Text style={styles.gameScore}>{myGame.homeScore}</Text>
                        )}
                        <Text style={[styles.gameTeamName, { color: teamPrimaryColor(myGame.homeTeam, isDark) }]}>
                          {home?.shortName || "?"}
                        </Text>
                        <TeamBadge teamId={myGame.homeTeam} size="sm" emotion={emotions?.home ?? "default"} />
                      </View>
                    </View>
                  </Pressable>
                </View>
              );
            })}

            {myGames.length > 0 && otherGames.length > 0 && (
              <View style={styles.gameList}>
                <Pressable style={styles.otherGamesToggle} onPress={() => setShowOtherGames((v) => !v)}>
                  <Text style={styles.otherGamesToggleText}>
                    {showOtherGames ? "접기 ▲" : `그 외 ${otherGames.length}경기 ▼`}
                  </Text>
                </Pressable>
                {showOtherGames && otherGames.map((g, i) => {
                  const home = TEAM_COLORS[g.homeTeam];
                  const away = TEAM_COLORS[g.awayTeam];
                  const hasScore = g.homeScore != null && g.awayScore != null;
                  const emotions = gameEmotions(g);
                  return (
                    <Pressable
                      key={`other-${g.homeTeam}-${g.awayTeam}-${i}`}
                      style={styles.gameCard}
                      onPress={() => handleGameSelect(g)}
                    >
                      <View style={styles.gameCardTop}>
                        <View style={styles.gameTeamRow}>
                          <TeamBadge teamId={g.awayTeam} size="sm" emotion={emotions?.away ?? "default"} />
                          <Text style={[styles.gameTeamName, { color: teamPrimaryColor(g.awayTeam, isDark) }]}>
                            {away?.shortName || "?"}
                          </Text>
                          {hasScore && <Text style={styles.gameScore}>{g.awayScore}</Text>}
                        </View>

                        {g.cancelled ? (
                          <Text style={styles.gameVs}>취소</Text>
                        ) : (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <Text style={styles.gameVs}>VS</Text>
                              <Text style={styles.gameMeta}>{g.time}</Text>
                              {g.isPostseason && (
                                <View style={[styles.exhibitionBadge, { backgroundColor: "#eab308" }]}>
                                  <Text style={[styles.exhibitionBadgeText, { color: "#fff" }]}>PS</Text>
                                </View>
                              )}
                              {g.isExhibition && !g.isPostseason && (
                                <View style={styles.exhibitionBadge}>
                                  <Text style={styles.exhibitionBadgeText}>시범</Text>
                                </View>
                              )}
                            </View>
                          )}

                          <View style={styles.gameTeamRow}>
                            {hasScore && <Text style={styles.gameScore}>{g.homeScore}</Text>}
                            <Text style={[styles.gameTeamName, { color: teamPrimaryColor(g.homeTeam, isDark) }]}>
                              {home?.shortName || "?"}
                            </Text>
                            <TeamBadge teamId={g.homeTeam} size="sm" emotion={emotions?.home ?? "default"} />
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}

            {myGames.length === 0 && (
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
                          <Text style={[styles.gameTeamName, { color: teamPrimaryColor(g.awayTeam, isDark) }]}>
                            {away?.shortName || "?"}
                          </Text>
                          {hasScore && <Text style={styles.gameScore}>{g.awayScore}</Text>}
                        </View>

                        {g.cancelled ? (
                          <Text style={styles.gameVs}>취소</Text>
                        ) : (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Text style={styles.gameVs}>VS</Text>
                            <Text style={styles.gameMeta}>{g.time}</Text>
                          </View>
                        )}

                        <View style={styles.gameTeamRow}>
                          {hasScore && <Text style={styles.gameScore}>{g.homeScore}</Text>}
                          <Text style={[styles.gameTeamName, { color: teamPrimaryColor(g.homeTeam, isDark) }]}>
                            {home?.shortName || "?"}
                          </Text>
                          <TeamBadge teamId={g.homeTeam} size="sm" emotion={emotions?.home ?? "default"} />
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
            </>
          );
        })()}
        </>
      )}
    </View>
  );
}
