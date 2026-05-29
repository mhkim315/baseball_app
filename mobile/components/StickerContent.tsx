import { View, Text, StyleSheet } from "react-native";

interface ScoreBoardInn {
  away: (number | null)[];
  home: (number | null)[];
}

interface Stats {
  winRate: number;
  wins: number;
  draws: number;
  losses: number;
}

interface Props {
  awayTeam: string;
  homeTeam: string;
  awayTeamColor: string;
  homeTeamColor: string;
  awayScore: number;
  homeScore: number;
  awayRank?: string;
  homeRank?: string;
  awayRecord?: string;
  homeRecord?: string;
  date: string;
  scoreBoard?: ScoreBoardInn | null;
  rheb?: { away: { r: number; h: number; e: number }; home: { r: number; h: number; e: number } } | null;
  gameResult: "win" | "lose" | "draw";
  background: "transparent" | "masking" | "receipt";
  stroke: boolean;
  showBadge: boolean;
  teamTag: string;
  myTag: string;
  customTag: string;
  stats: Stats | null;
}

const COLORS = {
  win: "#111",
  lose: "#999",
  watermark: "#bbb",
  divider: "#eee",
};

function MaskingOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={{ flex: 1, backgroundColor: "#fff" }} />
      <View style={StyleSheet.absoluteFill}>
        {Array.from({ length: 200 }).map((_, i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              left: i * 14 - 80,
              top: 0,
              width: 50,
              height: 600,
              backgroundColor: "rgba(200,200,200,0.12)",
              transform: [{ rotate: "45deg" }],
            }}
          />
        ))}
      </View>
    </View>
  );
}

function ReceiptOverlay() {
  return (
    <View
      style={[StyleSheet.absoluteFill, {
        borderWidth: 2,
        borderColor: "#d4d4d4",
        borderStyle: "dashed",
        borderRadius: 14,
        margin: 6,
      }]}
      pointerEvents="none"
    />
  );
}

export default function StickerContent(props: Props) {
  const {
    awayTeam, homeTeam, awayTeamColor, homeTeamColor,
    awayScore, homeScore, awayRank, homeRank,
    awayRecord, homeRecord, date, scoreBoard, rheb,
    gameResult, background, stroke, showBadge,
    teamTag, myTag, customTag, stats,
  } = props;

  const isHomeWin = homeScore > awayScore;
  const isAwayWin = awayScore > homeScore;
  const winnerColor = COLORS.win;
  const loserColor = COLORS.lose;
  const homeScoreColor = isHomeWin ? winnerColor : isAwayWin ? loserColor : COLORS.win;
  const awayScoreColor = isAwayWin ? winnerColor : isHomeWin ? loserColor : COLORS.win;
  const teamColor = isHomeWin ? homeTeamColor : homeTeamColor;
  const maxInnings = Math.max(scoreBoard?.away.length ?? 0, scoreBoard?.home.length ?? 0);

  const strokeStyle = stroke
    ? { textShadowColor: "#fff", textShadowOffset: { width: 0, height: 0 } as const, textShadowRadius: 1 }
    : {};
  const thickStroke = stroke
    ? { textShadowColor: "#fff", textShadowOffset: { width: 0, height: 0 } as const, textShadowRadius: 2 }
    : {};

  return (
    <View
      collapsable={false}
      style={{
        width: 300,
        backgroundColor: background === "transparent" ? "transparent"
          : background === "masking" ? "#fff"
          : "#fffbf0",
        borderRadius: 16,
        overflow: "hidden",
        elevation: background === "transparent" ? 0 : 8,
        shadowColor: background === "transparent" ? undefined : "#000",
        shadowOpacity: background === "transparent" ? 0 : 0.15,
        shadowOffset: background === "transparent" ? undefined : { width: 0, height: 4 },
        shadowRadius: background === "transparent" ? 0 : 20,
      }}
    >
      {background === "masking" && <MaskingOverlay />}
      {background === "receipt" && <ReceiptOverlay />}

      <View style={{ padding: 24, paddingBottom: 20 }}>
        {/* ── Header: Date + Watermark ── */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Text style={[{ fontSize: 11, color: "#999", fontWeight: "500" }, strokeStyle]}>{date}</Text>
          <Text style={[{ fontSize: 10, color: COLORS.watermark, fontWeight: "500" }, strokeStyle]}>@fullcount.kr</Text>
        </View>

        {/* ── Scoreboard ── */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          {/* Away team */}
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[{ fontSize: 18, fontWeight: "900", color: awayTeamColor, letterSpacing: -0.5 }, thickStroke]}>
              {awayTeam}
            </Text>
            {awayRank && <Text style={[{ fontSize: 10, color: "#999", fontWeight: "500" }, strokeStyle]}>{awayRank}</Text>}
          </View>

          {/* Score */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={[{ fontSize: 36, fontWeight: "900", lineHeight: 40, color: awayScoreColor }, thickStroke]}>
              {awayScore}
            </Text>
            <Text style={{ fontSize: 24, fontWeight: "300", color: "#ccc" }}>:</Text>
            <Text style={[{ fontSize: 36, fontWeight: "900", lineHeight: 40, color: homeScoreColor }, thickStroke]}>
              {homeScore}
            </Text>
          </View>

          {/* Home team */}
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[{ fontSize: 18, fontWeight: "900", color: homeTeamColor, letterSpacing: -0.5 }, thickStroke]}>
              {homeTeam}
            </Text>
            {homeRank && <Text style={[{ fontSize: 10, color: "#999", fontWeight: "500" }, strokeStyle]}>{homeRank}</Text>}
          </View>
        </View>

        {/* ── Innings Scoreboard ── */}
        {scoreBoard && (
          <View style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {/* Team label column */}
              <View style={{ width: 36, paddingRight: 8 }}>
                <Text style={[{ fontSize: 9, color: "#999", fontWeight: "600" }, strokeStyle]}></Text>
              </View>
              {/* Inning headers 1-9 */}
              {Array.from({ length: maxInnings }, (_, i) => (
                <Text key={`h-${i}`} style={[s.innCell, s.innHeader, strokeStyle]}>{i + 1}</Text>
              ))}
              {/* R, H, E */}
              <Text style={[s.innCell, s.innHeader, s.rCol, strokeStyle]}>R</Text>
              <Text style={[s.innCell, s.innHeader, s.heCol, strokeStyle]}>H</Text>
              <Text style={[s.innCell, s.innHeader, s.heCol, strokeStyle]}>E</Text>
            </View>

            {/* Away row */}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={[s.teamCol, { color: awayTeamColor }, thickStroke]}>{awayTeam}</Text>
              {Array.from({ length: maxInnings }, (_, i) => {
                const val = scoreBoard.away[i];
                return (
                  <Text key={`a-${i}`} style={[s.innCell, s.innVal, strokeStyle]}>
                    {val != null ? val : ""}
                  </Text>
                );
              })}
              <Text style={[s.innCell, s.innVal, s.rCol, { color: awayScoreColor }, thickStroke]}>
                {rheb?.away.r ?? awayScore}
              </Text>
              <Text style={[s.innCell, s.heVal, strokeStyle]}>{rheb?.away.h ?? ""}</Text>
              <Text style={[s.innCell, s.heVal, strokeStyle]}>{rheb?.away.e ?? ""}</Text>
            </View>

            {/* Home row */}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={[s.teamCol, { color: homeTeamColor }, thickStroke]}>{homeTeam}</Text>
              {Array.from({ length: maxInnings }, (_, i) => {
                const val = scoreBoard.home[i];
                const isEmpty = val == null && i >= (scoreBoard.away.length ?? 0);
                return (
                  <Text key={`h-${i}`} style={[s.innCell, s.innVal, strokeStyle]}>
                    {val != null ? val : isEmpty ? "" : ""}
                  </Text>
                );
              })}
              <Text style={[s.innCell, s.innVal, s.rCol, { color: homeScoreColor }, thickStroke]}>
                {rheb?.home.r ?? homeScore}
              </Text>
              <Text style={[s.innCell, s.heVal, strokeStyle]}>{rheb?.home.h ?? ""}</Text>
              <Text style={[s.innCell, s.heVal, strokeStyle]}>{rheb?.home.e ?? ""}</Text>
            </View>
          </View>
        )}

        {/* ── User Stats Badge ── */}
        {showBadge && stats && (
          <View style={{
            marginTop: 12, padding: 10, borderRadius: 10,
            backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0",
            flexDirection: "row", alignItems: "center", gap: 6,
          }}>
            <Text style={[{ fontSize: 16 }, strokeStyle]}>🏆</Text>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap" }}>
                <Text style={[{ fontSize: 11, color: "#666" }, strokeStyle]}>직관 승률 </Text>
                <Text style={[{ fontSize: 14, fontWeight: "900", color: "#111" }, thickStroke]}>
                  {Math.round(stats.winRate * 100)}%
                </Text>
                <Text style={[{ fontSize: 11, color: "#999", marginLeft: 6 }, strokeStyle]}>
                  ({stats.wins}승 {stats.losses}패{stats.draws > 0 ? ` ${stats.draws}무` : ""})
                </Text>
              </View>
              {/* Hashtags */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                {teamTag ? (
                  <Text style={[{ fontSize: 11, color: "#dc2626", fontWeight: "700" }, strokeStyle]}>#{teamTag}</Text>
                ) : null}
                {myTag ? (
                  <Text style={[{ fontSize: 11, color: "#2563eb", fontWeight: "700" }, strokeStyle]}>#{myTag}</Text>
                ) : null}
                {customTag ? (
                  <Text style={[{ fontSize: 11, color: "#7e57c2", fontWeight: "700" }, strokeStyle]}>#{customTag}</Text>
                ) : null}
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  innCell: { textAlign: "center", paddingHorizontal: 3, paddingVertical: 3, fontSize: 10, fontWeight: "600" },
  innHeader: { color: "#999", fontSize: 9, fontWeight: "600", borderBottomWidth: 1, borderBottomColor: "#eee" },
  innVal: { fontSize: 11, fontWeight: "600" },
  teamCol: { textAlign: "left", fontWeight: "900", fontSize: 12, paddingRight: 8, minWidth: 36 },
  rCol: { fontWeight: "900", fontSize: 12 },
  heCol: { color: "#ccc", fontSize: 9 },
  heVal: { color: "#bbb", fontSize: 9, fontWeight: "500" },
});
