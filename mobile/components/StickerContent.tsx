import { View, Text, StyleSheet } from "react-native";
import type { BgKey } from "@/lib/backgrounds";

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
  date: string;
  scoreBoard?: ScoreBoardInn | null;
  rheb?: { away: { r: number; h: number; e: number }; home: { r: number; h: number; e: number } } | null;
  gameResult: "win" | "lose" | "draw" | null;
  liveInningLabel?: string;
  liveTimestamp?: string;
  background: BgKey;
  stroke: boolean;
  showBadge: boolean;
  showScoreboard?: boolean;
  textColor?: string;
  strokeColor?: string;
  badgeBackgroundColor?: string;
  teamTag: string;
  myTag: string;
  customTag: string;
  stats: Stats | null;
  statsMode?: "live" | "broadcast";
  venue?: string;
}

const COLORS = {
  win: "#111",
  lose: "#999",
};

function toRgba(hex: string, a: number): string {
  const h = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function SketchbookOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
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
  );
}

function RetroOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Warm paper base tone */}
      <View style={{ flex: 1, backgroundColor: "#f8efd9" }} />
      {/* Aged paper grain dots — heavier texture */}
      <View style={StyleSheet.absoluteFill}>
        {Array.from({ length: 16 }).map((_, r) => (
          <View key={r} style={{ flexDirection: "row" }}>
            {Array.from({ length: 16 }).map((_, c) => (
              <View
                key={c}
                style={{
                  width: 19, height: 19,
                  opacity: (r + c) % 2 === 0 ? 0.05 : 0.02,
                  backgroundColor: (r + c) % 2 === 0 ? "#8b6914" : "#a0782c",
                }}
              />
            ))}
          </View>
        ))}
      </View>
      {/* Paper fiber texture — uneven strands */}
      <View style={StyleSheet.absoluteFill}>
        {[7,23,41,59,73,91,107,121,139,157,173,191,209,227,241,259,277,
          14,31,52,67,86,98,118,134,153,169,188,204,223,239,258,274,
          5,29,47,64,82,103,125,142,161,179,197,215,233,251,269,283,
        ].map((x, i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: 8 + 11.5 * i,
              width: (i % 4) + 1,
              height: 1.5,
              backgroundColor: "rgba(80,50,20,0.04)",
              transform: [{ rotate: `${(i * 47 + 13) % 360}deg` }],
            }}
          />
        ))}
      </View>
      {/* Speckles — tiny darker spots */}
      <View style={StyleSheet.absoluteFill}>
        {[33,68,105,142,178,215,252,19,56,93,130,167,204,241,278,8,45,82,119,156,193,230,267].map((x, i) => (
          <View key={i} style={{
            position: "absolute", left: x, top: 10 + 17.5 * i,
            width: 1.5, height: 1.5, borderRadius: 1,
            backgroundColor: "rgba(60,40,10,0.06)",
          }} />
        ))}
      </View>
      {/* Faded border */}
      <View
        style={[StyleSheet.absoluteFill, {
          borderWidth: 1.5,
          borderColor: "#c4a882",
          borderRadius: 14,
          margin: 6,
        }]}
      />
    </View>
  );
}

function PostitOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Adhesive strip at top */}
      <View style={{
        position: "absolute", top: 0, left: 0, right: 0,
        height: 14,
        backgroundColor: "rgba(200,180,100,0.25)",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
      }} />
      {/* Subtle adhesive line */}
      <View style={{
        position: "absolute", top: 14, left: 8, right: 8,
        height: 1,
        backgroundColor: "rgba(180,160,80,0.2)",
      }} />
      {/* Fold shadow at bottom-right */}
      <View style={{
        position: "absolute", bottom: 0, right: 0,
        width: 0, height: 0,
        borderLeftWidth: 28, borderBottomWidth: 28,
        borderLeftColor: "transparent",
        borderBottomColor: "rgba(0,0,0,0.06)",
        zIndex: 1,
      }} />
    </View>
  );
}


function NeonOverlay() {
  const frame = { borderRadius: 12, margin: 8 };
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Ambient glow on surface — large faint colored circles at corners */}
      <View style={{ position: "absolute", top: -10, left: -10, width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,20,147,0.06)" }} />
      <View style={{ position: "absolute", top: -10, right: -10, width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,20,147,0.06)" }} />
      <View style={{ position: "absolute", bottom: -10, left: -10, width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(0,229,255,0.06)" }} />
      <View style={{ position: "absolute", bottom: -10, right: -10, width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(0,229,255,0.06)" }} />

      {/* Neon tube frame — outer glow layer */}
      <View style={[StyleSheet.absoluteFill, frame, { borderWidth: 6, borderColor: "rgba(255,20,147,0.12)" }]} />
      {/* Neon tube frame — inner glow layer */}
      <View style={[StyleSheet.absoluteFill, frame, { borderWidth: 3, borderColor: "rgba(255,20,147,0.3)" }]} />
      {/* Neon tube frame — bright core (pink top/right, cyan bottom/left) */}
      <View style={[StyleSheet.absoluteFill, frame, {
        borderWidth: 1.5,
        borderColor: "#ff1493",
        borderBottomColor: "#00e5ff",
        borderLeftColor: "#00e5ff",
        shadowColor: "#ff1493",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
      }]} />
      {/* Inner ambient light — subtle gradient-like fill */}
      <View style={[StyleSheet.absoluteFill, frame, { backgroundColor: "rgba(255,20,147,0.02)", borderWidth: 0 }]} />
    </View>
  );
}

function GrassOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Grass base — vivid green */}
      <View style={{ flex: 1, backgroundColor: "#2d5a27" }} />
      {/* Mowed grass stripes */}
      {Array.from({ length: 10 }).map((_, i) => (
        <View key={i} style={{
          position: "absolute", top: i * 30, left: 0, right: 0,
          height: 15, backgroundColor: i % 2 === 0 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
        }} />
      ))}
      {/* Infield diamond — brown dirt rotated square */}
      <View style={{
        position: "absolute", top: 120, left: 70,
        width: 160, height: 160,
        backgroundColor: "rgba(139,90,43,0.12)",
        transform: [{ rotate: "45deg" }],
        borderRadius: 8,
      }} />
      {/* Infill dirt — center circle (pitcher's mound) */}
      <View style={{
        position: "absolute", top: 170, left: 120,
        width: 60, height: 60, borderRadius: 30,
        backgroundColor: "rgba(120,80,40,0.1)",
      }} />
      {/* Home plate area — slightly wider dirt */}
      <View style={{
        position: "absolute", bottom: -10, left: 80, right: 80,
        height: 60, backgroundColor: "rgba(139,90,43,0.15)",
        borderTopLeftRadius: 60, borderTopRightRadius: 60,
      }} />
      {/* Foul lines */}
      <View style={{ position: "absolute", bottom: 20, left: 30, width: 1, height: 180, backgroundColor: "rgba(255,255,255,0.06)", transform: [{ rotate: "-45deg" }] }} />
      <View style={{ position: "absolute", bottom: 20, right: 30, width: 1, height: 180, backgroundColor: "rgba(255,255,255,0.06)", transform: [{ rotate: "45deg" }] }} />
      {/* Outfield grass darker arc */}
      <View style={{
        position: "absolute", top: -30, left: 20, right: 20,
        height: 100, backgroundColor: "rgba(0,0,0,0.05)",
        borderBottomLeftRadius: 200, borderBottomRightRadius: 200,
      }} />
    </View>
  );
}

function GroundOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Brown dirt base */}
      <View style={{ flex: 1, backgroundColor: "#8B6914" }} />
      {/* Dirt texture — subtle grain */}
      {Array.from({ length: 60 }).map((_, i) => (
        <View key={i} style={{
          position: "absolute",
          left: (i * 37 + 13) % 280,
          top: (i * 23 + 7) % 380,
          width: 2, height: 2, borderRadius: 1,
          backgroundColor: "rgba(60,40,10,0.08)",
        }} />
      ))}
      {/* Pitcher's mound — raised circle */}
      <View style={{
        position: "absolute", top: 60, left: 90,
        width: 120, height: 120, borderRadius: 60,
        backgroundColor: "rgba(160,120,60,0.15)",
      }} />
      {/* Mound plateau — slightly lighter center */}
      <View style={{
        position: "absolute", top: 90, left: 115,
        width: 70, height: 70, borderRadius: 35,
        backgroundColor: "rgba(180,140,80,0.1)",
      }} />
      {/* Home plate area — dark arc at bottom */}
      <View style={{
        position: "absolute", bottom: -10, left: 60, right: 60,
        height: 80, backgroundColor: "rgba(100,70,30,0.2)",
        borderTopLeftRadius: 80, borderTopRightRadius: 80,
      }} />
      {/* Home plate — pentagon shape (approximated) */}
      <View style={{
        position: "absolute", bottom: 12, left: 135,
        width: 30, height: 24,
        backgroundColor: "rgba(255,255,255,0.12)",
        borderTopLeftRadius: 4, borderTopRightRadius: 4,
      }} />
      {/* Foul lines — left */}
      <View style={{
        position: "absolute", bottom: 30, left: 50,
        width: 1.5, height: 240,
        backgroundColor: "rgba(255,255,255,0.1)",
        transform: [{ rotate: "-40deg" }],
      }} />
      {/* Foul lines — right */}
      <View style={{
        position: "absolute", bottom: 30, right: 50,
        width: 1.5, height: 240,
        backgroundColor: "rgba(255,255,255,0.1)",
        transform: [{ rotate: "40deg" }],
      }} />
      {/* Base paths — subtle diamond lines */}
      <View style={{
        position: "absolute", bottom: 35, left: 140,
        width: 1, height: 100, backgroundColor: "rgba(255,255,255,0.04)",
        transform: [{ rotate: "45deg" }],
      }} />
      <View style={{
        position: "absolute", bottom: 35, left: 140,
        width: 1, height: 100, backgroundColor: "rgba(255,255,255,0.04)",
        transform: [{ rotate: "-45deg" }],
      }} />
    </View>
  );
}

function GridOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Vertical lines */}
      {Array.from({ length: 10 }).map((_, i) => (
        <View key={`v-${i}`} style={{
          position: "absolute", left: i * 30, top: 0, bottom: 0,
          width: 0.5, backgroundColor: "rgba(100,150,255,0.15)",
        }} />
      ))}
      {/* Horizontal lines */}
      {Array.from({ length: 20 }).map((_, i) => (
        <View key={`h-${i}`} style={{
          position: "absolute", top: i * 15, left: 0, right: 0,
          height: 0.5, backgroundColor: "rgba(100,150,255,0.15)",
        }} />
      ))}
      {/* Thicker margin lines */}
      {Array.from({ length: 3 }).map((_, i) => (
        <View key={`vm-${i}`} style={{
          position: "absolute", left: (i + 1) * 90, top: 0, bottom: 0,
          width: 0.5, backgroundColor: "rgba(200,50,50,0.2)",
        }} />
      ))}
    </View>
  );
}

export default function StickerContent(props: Props) {
  const {
    awayTeam, homeTeam, awayTeamColor, homeTeamColor,
    awayScore, homeScore, awayRank, homeRank,
    date, scoreBoard, rheb,
    gameResult, background, stroke, showBadge, showScoreboard, textColor, strokeColor,
    teamTag, myTag, customTag, stats, badgeBackgroundColor, statsMode, venue,
  } = props;

  const tc = textColor || "#333";
  const isCustomColor = !!textColor;

  const isHomeWin = homeScore > awayScore;
  const isAwayWin = awayScore > homeScore;
  const showCrown = gameResult !== null && gameResult !== "draw" && homeScore !== awayScore;
  const isWinnerAway = showCrown && isAwayWin;
  const isWinnerHome = showCrown && isHomeWin;
  // When textColor is set, ALL text uses that color (no team-specific colors)
  const winColor = isCustomColor ? textColor : COLORS.win;
  const loseColor = isCustomColor ? textColor : COLORS.lose;
  const homeScoreColor = gameResult === null ? winColor : (isHomeWin ? winColor : isAwayWin ? loseColor : winColor);
  const awayScoreColor = gameResult === null ? winColor : (isAwayWin ? winColor : isHomeWin ? loseColor : winColor);
  const awayTeamColor_ = isCustomColor ? textColor : awayTeamColor;
  const homeTeamColor_ = isCustomColor ? textColor : homeTeamColor;
  const tagColor = isCustomColor ? tc : "#dc2626";
  const myTagColor = isCustomColor ? tc : "#2563eb";
  const customTagColor = isCustomColor ? tc : "#7e57c2";
  const badgeTextColor = isCustomColor ? tc : "#666";
  const badgeValueColor = isCustomColor ? tc : "#111";
  const badgeRecordColor = isCustomColor ? tc : "#999";
  const maxInnings = Math.max(scoreBoard?.away.length ?? 0, scoreBoard?.home.length ?? 0);

  const hasStroke = stroke && strokeColor;
  const sc = strokeColor || "#ffffff";

  const strokeStyle = hasStroke
    ? { textShadowColor: sc, textShadowOffset: { width: 0, height: 0 } as const, textShadowRadius: 1 }
    : {};
  const thickStroke = hasStroke
    ? { textShadowColor: sc, textShadowOffset: { width: 0, height: 0 } as const, textShadowRadius: 2 }
    : {};

  return (
    <View
      collapsable={false}
      style={{
        width: 300,
        backgroundColor: background === "transparent" ? "transparent"
          : background === "grid" ? "#f5f0e8"
          : background === "neon" ? "#1a1a1a"
          : background === "retro" ? "#faf3e8"
          : background === "postit" ? "#fff9c4"
          : background === "grass" ? "#2d5a27"
          : background === "ground" ? "#8B6914"
          : "#fff",
        borderRadius: 16,
        elevation: background === "transparent" ? 0 : 8,
        shadowColor: background === "transparent" ? undefined : "#000",
        shadowOpacity: background === "transparent" ? 0 : 0.15,
        shadowOffset: background === "transparent" ? undefined : { width: 0, height: 4 },
        shadowRadius: background === "transparent" ? 0 : 20,
      }}
    >
      <View style={{ borderRadius: 16, overflow: "hidden" }}>
      {background === "sketchbook" && <SketchbookOverlay />}
      {background === "retro" && <RetroOverlay />}
      {background === "postit" && <PostitOverlay />}
      {background === "grid" && <GridOverlay />}
      {background === "neon" && <NeonOverlay />}
      {background === "grass" && <GrassOverlay />}
      {background === "ground" && <GroundOverlay />}

      <View style={{ padding: 24, paddingBottom: 20 }}>
        {/* ── Header: Date + Watermark ── */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={[{ fontSize: 11, color: tc, fontWeight: "700" }, strokeStyle]}>{date}</Text>
            {props.liveTimestamp && (
              <Text style={[{ fontSize: 11, color: tc, fontWeight: "700" }, strokeStyle]}>{props.liveTimestamp}</Text>
            )}
            {props.liveInningLabel && (
              <View style={{ backgroundColor: "#dc2626", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ fontSize: 9, color: "#fff", fontWeight: "900" }}>{props.liveInningLabel}</Text>
              </View>
            )}
          </View>
          <Text style={[{ fontSize: 10, color: toRgba(tc, 0.4), fontWeight: "700" }, strokeStyle]}>@fullcount.kr</Text>
        </View>

        {/* ── Scoreboard ── */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          {/* Away team */}
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[{ fontSize: 18, fontWeight: "900", color: awayTeamColor_, letterSpacing: -0.5 }, thickStroke]}>
              {awayTeam}
            </Text>
            {awayRank && <Text style={[{ fontSize: 10, color: toRgba(tc, 0.6), fontWeight: "700" }, strokeStyle]}>{awayRank}위</Text>}
          </View>

          {/* Score */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <Text style={[{ fontSize: 36, fontWeight: "900", lineHeight: 40, color: awayScoreColor }, thickStroke]}>
                {awayScore}
              </Text>
              {isWinnerAway && <Text style={{ fontSize: 14, marginTop: -8, marginLeft: -4 }}>🏆</Text>}
            </View>
            <Text style={{ fontSize: 24, fontWeight: "700", color: toRgba(tc, 0.3) }}>:</Text>
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              {isWinnerHome && <Text style={{ fontSize: 14, marginTop: -8, marginRight: -4 }}>🏆</Text>}
              <Text style={[{ fontSize: 36, fontWeight: "900", lineHeight: 40, color: homeScoreColor }, thickStroke]}>
                {homeScore}
              </Text>
            </View>
          </View>

          {/* Home team */}
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[{ fontSize: 18, fontWeight: "900", color: homeTeamColor_, letterSpacing: -0.5 }, thickStroke]}>
              {homeTeam}
            </Text>
            {homeRank && <Text style={[{ fontSize: 10, color: toRgba(tc, 0.6), fontWeight: "700" }, strokeStyle]}>{homeRank}위</Text>}
          </View>
        </View>

        {/* ── Innings Scoreboard ── */}
        {scoreBoard && showScoreboard !== false && (
          <View style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {/* Team label column */}
              <View style={{ width: 36, paddingRight: 8 }}>
                <Text style={[{ fontSize: 9, color: "#999", fontWeight: "700" }, strokeStyle]}></Text>
              </View>
              {/* Inning headers 1-9 */}
              {Array.from({ length: maxInnings }, (_, i) => (
                <Text key={`h-${i}`} style={[s.innCell, s.innHeader, { color: tc, borderBottomColor: toRgba(tc, 0.2) }, strokeStyle]}>{i + 1}</Text>
              ))}
              {/* R, H, E */}
              <Text style={[s.innCell, s.innHeader, s.rCol, { color: tc, borderBottomColor: toRgba(tc, 0.2) }, strokeStyle]}>R</Text>
              <Text style={[s.innCell, s.innHeader, s.heCol, { color: tc, borderBottomColor: toRgba(tc, 0.2) }, strokeStyle]}>H</Text>
              <Text style={[s.innCell, s.innHeader, s.heCol, { color: tc, borderBottomColor: toRgba(tc, 0.2) }, strokeStyle]}>E</Text>
            </View>

            {/* Away row */}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={[s.teamCol, { color: awayTeamColor_ }, thickStroke]}>{awayTeam}</Text>
              {Array.from({ length: maxInnings }, (_, i) => {
                const val = scoreBoard.away[i];
                return (
                  <Text key={`a-${i}`} style={[s.innCell, s.innVal, { color: tc }, strokeStyle]}>
                    {val != null ? val : ""}
                  </Text>
                );
              })}
              <Text style={[s.innCell, s.innVal, s.rCol, { color: awayScoreColor }, thickStroke]}>
                {rheb?.away.r ?? awayScore}
              </Text>
              <Text style={[s.innCell, s.heVal, { color: tc }, strokeStyle]}>{rheb?.away.h ?? ""}</Text>
              <Text style={[s.innCell, s.heVal, { color: tc }, strokeStyle]}>{rheb?.away.e ?? ""}</Text>
            </View>

            {/* Home row */}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={[s.teamCol, { color: homeTeamColor_ }, thickStroke]}>{homeTeam}</Text>
              {Array.from({ length: maxInnings }, (_, i) => {
                const val = scoreBoard.home[i];
                return (
                  <Text key={`h-${i}`} style={[s.innCell, s.innVal, { color: tc }, strokeStyle]}>
                    {val != null ? val : ""}
                  </Text>
                );
              })}
              <Text style={[s.innCell, s.innVal, s.rCol, { color: homeScoreColor }, thickStroke]}>
                {rheb?.home.r ?? homeScore}
              </Text>
              <Text style={[s.innCell, s.heVal, { color: tc }, strokeStyle]}>{rheb?.home.h ?? ""}</Text>
              <Text style={[s.innCell, s.heVal, { color: tc }, strokeStyle]}>{rheb?.home.e ?? ""}</Text>
            </View>
          </View>
        )}

        {/* ── User Stats Badge ── */}
        {showBadge && (stats || venue) && (
          <View style={{
            marginTop: 12, padding: 10, borderRadius: 10,
            backgroundColor: badgeBackgroundColor === "" ? "transparent" : (badgeBackgroundColor || "#f8fafc"),
            borderWidth: badgeBackgroundColor ? 0 : 1,
            borderColor: badgeBackgroundColor ? "transparent" : "#e2e8f0",
            flexDirection: "row", alignItems: "flex-start", gap: 6,
          }}>
            {gameResult !== null && stats ? (
              <Text style={[{ fontSize: 16, marginTop: 2 }]}>🔥</Text>
            ) : venue && statsMode !== "broadcast" ? (
              <Text style={[{ fontSize: 16, marginTop: 1, color: badgeTextColor }]}>📍</Text>
            ) : null}
            <View style={{ flex: 1 }}>
              {gameResult !== null && stats ? (
                <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap" }}>
                  <Text style={[{ fontSize: 11, color: badgeTextColor, fontWeight: "700" }]}>{statsMode === "broadcast" ? "집관 승률 " : "직관 승률 "}</Text>
                  <Text style={[{ fontSize: 14, fontWeight: "900", color: badgeValueColor }]}>
                    {Math.round(stats.winRate * 100)}%
                  </Text>
                  <Text style={[{ fontSize: 11, color: badgeRecordColor, marginLeft: 6, fontWeight: "700" }]}>
                    ({stats.wins}승 {stats.losses}패{stats.draws > 0 ? ` ${stats.draws}무` : ""})
                  </Text>
                </View>
              ) : venue && statsMode !== "broadcast" ? (
                <Text style={[{ fontSize: 12, color: badgeTextColor, fontWeight: "700" }]}>{venue}</Text>
              ) : null}
              {/* Hashtags */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: gameResult !== null ? 2 : 0 }}>
                {teamTag ? (
                  <Text style={[{ fontSize: 11, color: tagColor, fontWeight: "700" }]}>#{teamTag}</Text>
                ) : null}
                {myTag ? (
                  <Text style={[{ fontSize: 11, color: myTagColor, fontWeight: "700" }]}>#{myTag}</Text>
                ) : null}
                {customTag ? (
                  <Text style={[{ fontSize: 11, color: customTagColor, fontWeight: "700" }]}>#{customTag}</Text>
                ) : null}
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
    </View>
  );
}

const s = StyleSheet.create({
  innCell: { flex: 1, textAlign: "center", paddingVertical: 3, fontSize: 10, fontWeight: "700" },
  innHeader: { color: "#999", fontSize: 10, fontWeight: "700", borderBottomWidth: 1, borderBottomColor: "#eee" },
  innVal: { fontSize: 10, fontWeight: "700" },
  teamCol: { textAlign: "left", fontWeight: "900", fontSize: 12, paddingRight: 8, width: 36 },
  rCol: { fontWeight: "900", fontSize: 10 },
  heCol: { color: "#ccc", fontSize: 10, fontWeight: "700" },
  heVal: { color: "#bbb", fontSize: 10, fontWeight: "700" },
});
