import { FlexWidget, TextWidget, ImageWidget } from "react-native-android-widget";
import { LOCAL_CHARACTERS } from "@/lib/characterAssets";
import type { CharacterEmotion } from "@/lib/emotions";

const WIDGET_BUILD = "OTA-v35-2x2-char";

interface WidgetGameData {
  homeTeam: string;
  awayTeam: string;
  homeScore: string;
  awayScore: string;
  inning: string;
  isTop: string;
  status: string;
  time: string;
  homeIsMyTeam: boolean;
  stadium?: string;
  weather?: string;
  awayPitcher?: string;
  homePitcher?: string;
  ball?: string;
  strike?: string;
  out?: string;
  base1?: string;
  base2?: string;
  base3?: string;
}

/** Team primary colors for team name text */
const TEAM_NAME_COLOR: Record<string, string> = {
  doosan: "#131230", lg: "#C0334A", kiwoom: "#820024", ssg: "#CE0E2D",
  kt: "#231F20", hanwha: "#FF6600", samsung: "#074CA1", kia: "#EA0029",
  lotte: "#1E467C", nc: "#1D467C",
};

/** Dark gray text color for contrast on pastel backgrounds */
const DARK_FG = "#2a2a32";

function alpha(hex: string, a: string): string {
  return "#" + a + hex.slice(1);
}

const NAME_TO_TEAM_ID: Record<string, string> = {
  두산: "doosan", LG: "lg", 키움: "kiwoom", SSG: "ssg",
  KT: "kt", 한화: "hanwha", 삼성: "samsung", KIA: "kia",
  롯데: "lotte", NC: "nc",
  OB: "doosan", WO: "kiwoom", SK: "ssg",
  HH: "hanwha", SS: "samsung", HT: "kia", LT: "lotte",
};

function computeWidgetEmotion(
  data: WidgetGameData,
  isMyHome: boolean,
): CharacterEmotion {
  if (data.status === "cancelled") return "rain_cancellation";
  if (data.status === "scheduled") return "default";
  const myScore = parseInt(isMyHome ? data.homeScore : data.awayScore, 10);
  const oppScore = parseInt(isMyHome ? data.awayScore : data.homeScore, 10);
  const diff = myScore - oppScore;
  if (data.status === "finished") {
    if (diff > 0) return "joyful";
    if (diff === 0) return "neutral";
    return "sad";
  }
  if (diff >= 3) return "joyful";
  if (diff >= 1) return "joyful";
  if (diff === 0) return "determined";
  if (diff >= -3) return "sad";
  return "angry";
}

/* ─────────── Component ─────────── */

interface WidgetProps {
  width: number;
  height: number;
  data: WidgetGameData | null;
  myTeam: string;
}

export function GameStatusWidget({ width, height, data, myTeam }: WidgetProps) {
  try {
    if (!data) return noGameView();
    if (height < 80 && width >= 230) return view3x1Compact(data, myTeam);
    if (height < 80) return view2x1(data);
    if (width < 130) return view1x2(data);
    if (height < 170 && width < 230) return view2x2(data, myTeam);
    return main4x2View(data, myTeam);
  } catch (e) {
    console.warn("GameStatusWidget render error", e);
    return (
      <FlexWidget style={{ width: "match_parent", height: "match_parent", backgroundColor: "#000000", justifyContent: "center", alignItems: "center" }} clickAction="OPEN_APP">
        <TextWidget text="!" style={{ fontSize: 20, color: "#FFFFFF" }} />
      </FlexWidget>
    );
  }
}

function ColorBg({ bg, borderRadius = 16, children }: { bg: string; borderRadius?: number; children: any }) {
  return (
    <FlexWidget style={{ width: "match_parent", height: "match_parent", backgroundColor: bg, borderRadius }} clickAction="OPEN_APP">
      {children}
    </FlexWidget>
  );
}

/* ─────────── No Game ─────────── */

function noGameView() {
  const bg = "#f5f0eb";
  return (
    <FlexWidget style={{ width: "match_parent", height: "match_parent", justifyContent: "center", alignItems: "center", backgroundColor: bg, borderRadius: 16 }} clickAction="OPEN_APP">
      <TextWidget text="오늘의 경기 없음" style={{ fontSize: 13, color: DARK_FG }} />
      <TextWidget text={WIDGET_BUILD} style={{ fontSize: 6, color: alpha(DARK_FG, "44") }} />
    </FlexWidget>
  );
}

/* ─────────── 2x1 narrow compact (width < 230, height < 80) ─────────── */

function view2x1(data: WidgetGameData) {
  const isMyHome = data.homeIsMyTeam;
  const myScore = isMyHome ? data.homeScore : data.awayScore;
  const oppScore = isMyHome ? data.awayScore : data.homeScore;
  const oppTeam = isMyHome ? data.awayTeam : data.homeTeam;
  const bg = "#f5f0eb";

  return (
    <FlexWidget style={{ width: "match_parent", height: "match_parent", flexDirection: "row", alignItems: "center", backgroundColor: bg, borderRadius: 12, paddingHorizontal: 8 }} clickAction="OPEN_APP">
      <FlexWidget style={{ flex: 1, alignItems: "flex-end" }}>
        <TextWidget text={myScore} style={{ fontSize: 24, fontWeight: "700", color: DARK_FG }} />
      </FlexWidget>
      <TextWidget text=" : " style={{ fontSize: 16, color: alpha(DARK_FG, "44") }} />
      <FlexWidget style={{ flex: 1 }}>
        <TextWidget text={oppScore} style={{ fontSize: 24, fontWeight: "700", color: alpha(DARK_FG, "77") }} />
      </FlexWidget>
      <TextWidget text={` ${oppTeam} `} style={{ fontSize: 14, color: alpha(DARK_FG, "77") }} />
      <TextWidget text="↻" clickAction="REFRESH" style={{ fontSize: 14, color: "#e07b3c" }} />
    </FlexWidget>
  );
}

/* ─────────── 3x1+ wide compact (width >= 230, height < 80) ─────────── */

function view3x1Compact(data: WidgetGameData, myTeam: string) {
  const isMyHome = data.homeIsMyTeam;
  const awayTeamId = NAME_TO_TEAM_ID[data.awayTeam] || data.awayTeam.toLowerCase();
  const homeTeamId = NAME_TO_TEAM_ID[data.homeTeam] || data.homeTeam.toLowerCase();
  const bg = "#f5f0eb";

  const isLive = data.status === "live";
  const isFinished = data.status === "finished";
  const showScore = isLive || isFinished;

  const statusText = data.status === "cancelled" ? "취소"
    : isLive ? `LIVE ${data.inning}회${data.isTop === "1" ? "초" : "말"}`
      : isFinished ? "경기 종료" : "경기 전";

  const awayEmotion = computeWidgetEmotion(data, !isMyHome);
  const homeEmotion = computeWidgetEmotion(data, isMyHome);
  const awayCharKey = `${awayTeamId}_${awayEmotion}`;
  const homeCharKey = `${homeTeamId}_${homeEmotion}`;
  const awayCharImage = LOCAL_CHARACTERS[awayCharKey] || LOCAL_CHARACTERS[`${awayTeamId}_default`];
  const homeCharImage = LOCAL_CHARACTERS[homeCharKey] || LOCAL_CHARACTERS[`${homeTeamId}_default`];

  const awayNameColor = NAME_TO_TEAM_ID[data.awayTeam]
    ? TEAM_NAME_COLOR[NAME_TO_TEAM_ID[data.awayTeam]] || DARK_FG
    : DARK_FG;
  const homeNameColor = NAME_TO_TEAM_ID[data.homeTeam]
    ? TEAM_NAME_COLOR[NAME_TO_TEAM_ID[data.homeTeam]] || DARK_FG
    : DARK_FG;

  const bCnt = Math.min(parseInt(data.ball || "0", 10), 3);
  const sCnt = Math.min(parseInt(data.strike || "0", 10), 2);
  const oCnt = Math.min(parseInt(data.out || "0", 10), 2);

  const dot = (cnt: number, max: number, color: string) => {
    const filled = "●".repeat(cnt) + "○".repeat(max - cnt);
    return <TextWidget text={filled} style={{ fontSize: 7, color }} />;
  };

  const baseDiamond = (occupied: string) => {
    const occ = occupied && occupied !== "0";
    return <TextWidget text={occ ? "◆" : "◇"} style={{ fontSize: 7, color: occ ? "#e07b3c" : alpha(DARK_FG, "33") }} />;
  };

  return (
    <FlexWidget style={{ width: "match_parent", height: "match_parent", flexDirection: "row", alignItems: "center", backgroundColor: bg, borderRadius: 12, paddingHorizontal: 8 }} clickAction="OPEN_APP">
      {/* Left: away side */}
      <FlexWidget style={{ flex: 1, alignItems: "center" }}>
        <ImageWidget image={awayCharImage} imageWidth={28} imageHeight={28} />
        <FlexWidget style={{ height: 1 }} />
        <TextWidget text={data.awayTeam} style={{ fontSize: 10, fontWeight: "700", color: awayNameColor }} />
        <FlexWidget style={{ height: 1 }} />
        <TextWidget text={data.awayPitcher || ""} style={{ fontSize: 7, color: DARK_FG }} />
      </FlexWidget>

      {/* Center: score (항상 표시) */}
      <FlexWidget style={{ width: 64, alignItems: "center" }}>
          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            <TextWidget text={data.awayScore} style={{ fontSize: 22, fontWeight: "700", color: DARK_FG }} />
            <TextWidget text=":" style={{ fontSize: 14, fontWeight: "700", color: alpha(DARK_FG, "33") }} />
            <TextWidget text={data.homeScore} style={{ fontSize: 22, fontWeight: "700", color: DARK_FG }} />
          </FlexWidget>
        <TextWidget text={statusText} style={{ fontSize: 8, fontWeight: "600", color: isLive ? "#e07b3c" : alpha(DARK_FG, "66") }} />
      </FlexWidget>

      {/* Right: BSO vertical + bases triangle + refresh */}
      <FlexWidget style={{ width: 44, alignItems: "center" }}>
        {/* BSO vertical */}
        <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
          <TextWidget text="B" style={{ fontSize: 7, fontWeight: "700", color: "#43a047" }} />
          <FlexWidget style={{ width: 2 }} />
          {dot(bCnt, 3, "#43a047")}
        </FlexWidget>
        <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
          <TextWidget text="S" style={{ fontSize: 7, fontWeight: "700", color: "#f9a825" }} />
          <FlexWidget style={{ width: 2 }} />
          {dot(sCnt, 2, "#f9a825")}
        </FlexWidget>
        <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
          <TextWidget text="O" style={{ fontSize: 7, fontWeight: "700", color: "#e53935" }} />
          <FlexWidget style={{ width: 2 }} />
          {dot(oCnt, 2, "#e53935")}
        </FlexWidget>

        {/* Bases triangle: 3B top center, 2B left, 1B right */}
        <FlexWidget style={{ height: 2 }} />
        <FlexWidget style={{ alignItems: "center" }}>
          {baseDiamond(data.base3)}
        </FlexWidget>
        <FlexWidget style={{ flexDirection: "row", justifyContent: "center" }}>
          <FlexWidget style={{ width: 14, alignItems: "center" }}>
            {baseDiamond(data.base2)}
          </FlexWidget>
          <FlexWidget style={{ width: 14, alignItems: "center" }}>
            {baseDiamond(data.base1)}
          </FlexWidget>
        </FlexWidget>

        {/* Refresh */}
        <FlexWidget style={{ height: 1 }} />
        <TextWidget text="↻" clickAction="REFRESH" style={{ fontSize: 12, color: "#e07b3c" }} />
      </FlexWidget>

      {/* Right-most: home side */}
      <FlexWidget style={{ flex: 1, alignItems: "center" }}>
        <ImageWidget image={homeCharImage} imageWidth={28} imageHeight={28} />
        <FlexWidget style={{ height: 1 }} />
        <TextWidget text={data.homeTeam} style={{ fontSize: 10, fontWeight: "700", color: homeNameColor }} />
        <FlexWidget style={{ height: 1 }} />
        <TextWidget text={data.homePitcher || ""} style={{ fontSize: 7, color: DARK_FG }} />
      </FlexWidget>
    </FlexWidget>
  );
}

/* ─────────── 1x2 narrow ─────────── */

function view1x2(data: WidgetGameData) {
  const bg = "#f5f0eb";
  const statusText = data.status === "live"
    ? `LIVE ${data.inning}회${data.isTop === "1" ? "초" : "말"}`
    : data.status === "finished" ? "경기 종료"
      : data.status === "cancelled" ? "취소"
        : data.time || "경기 전";

  return (
    <ColorBg bg={bg} borderRadius={16}>
      <FlexWidget style={{ flex: 1, flexDirection: "column", justifyContent: "center", padding: 10 }}>
        <FlexWidget style={{ alignItems: "center", flexDirection: "row", justifyContent: "center" }}>
          <TextWidget text={statusText} style={{ fontSize: 10, fontWeight: "700", color: data.status === "live" ? "#e07b3c" : alpha(DARK_FG, "77") }} />
          <FlexWidget style={{ width: 4 }} />
          <TextWidget text="↻" clickAction="REFRESH" style={{ fontSize: 12, color: "#e07b3c" }} />
        </FlexWidget>
        <FlexWidget style={{ height: 6 }} />
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
          <FlexWidget style={{ alignItems: "center", flex: 1 }}>
            <TextWidget text={data.awayTeam} style={{ fontSize: 12, fontWeight: "600", color: alpha(DARK_FG, "77") }} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={data.awayScore} style={{ fontSize: 28, fontWeight: "700", color: DARK_FG }} />
          </FlexWidget>
          <FlexWidget style={{ width: 4 }} />
          <TextWidget text=":" style={{ fontSize: 16, fontWeight: "700", color: alpha(DARK_FG, "44") }} />
          <FlexWidget style={{ width: 4 }} />
          <FlexWidget style={{ alignItems: "center", flex: 1 }}>
            <TextWidget text={data.homeTeam} style={{ fontSize: 12, fontWeight: "600", color: alpha(DARK_FG, "77") }} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={data.homeScore} style={{ fontSize: 28, fontWeight: "700", color: DARK_FG }} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </ColorBg>
  );
}

/* ─────────── 2x2 Compact Scoreboard ─────────── */

function view2x2(data: WidgetGameData, myTeam: string) {
  const bg = "#f5f0eb";
  const isLive = data.status === "live";
  const isFinished = data.status === "finished";
  const isMyHome = data.homeIsMyTeam;

  const awayTeamId = NAME_TO_TEAM_ID[data.awayTeam] || data.awayTeam.toLowerCase();
  const homeTeamId = NAME_TO_TEAM_ID[data.homeTeam] || data.homeTeam.toLowerCase();
  const awayEmotion = computeWidgetEmotion(data, !isMyHome);
  const homeEmotion = computeWidgetEmotion(data, isMyHome);
  const awayCharImage = LOCAL_CHARACTERS[`${awayTeamId}_${awayEmotion}`] || LOCAL_CHARACTERS[`${awayTeamId}_default`];
  const homeCharImage = LOCAL_CHARACTERS[`${homeTeamId}_${homeEmotion}`] || LOCAL_CHARACTERS[`${homeTeamId}_default`];

  const statusText = data.status === "cancelled" ? "취소"
    : isLive ? `LIVE ${data.inning}회${data.isTop === "1" ? "초" : "말"}`
      : isFinished ? "종료" : "경기 전";

  return (
    <ColorBg bg={bg} borderRadius={16}>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 8 }}>
        {/* Header: 고정폭 컬럼 (좌 90 / 우 60) */}
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
          <FlexWidget style={{ width: 90, alignItems: "flex-start" }}>
            <TextWidget text={`${data.stadium || ""} ${data.time || ""}`} style={{ fontSize: 8, color: alpha(DARK_FG, "66") }} />
          </FlexWidget>
          <FlexWidget style={{ width: 60, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" }}>
            <TextWidget text={data.weather || ""} style={{ fontSize: 8, color: alpha(DARK_FG, "66") }} />
            <FlexWidget style={{ width: 4 }} />
            <TextWidget text="↻" clickAction="REFRESH" style={{ fontSize: 12, color: "#e07b3c" }} />
          </FlexWidget>
        </FlexWidget>

        {/* 중앙: 캐릭터 + 점수 + 팀명 */}
        <FlexWidget style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
            <ImageWidget image={awayCharImage} imageWidth={24} imageHeight={24} />
            <FlexWidget style={{ width: 4 }} />
            <TextWidget text={data.awayTeam} style={{ fontSize: 11, fontWeight: "700", color: alpha(DARK_FG, "77") }} />
            <FlexWidget style={{ width: 6 }} />
            <TextWidget text={data.awayScore} style={{ fontSize: 24, fontWeight: "700", color: DARK_FG }} />
            <TextWidget text=":" style={{ fontSize: 14, color: alpha(DARK_FG, "44") }} />
            <TextWidget text={data.homeScore} style={{ fontSize: 24, fontWeight: "700", color: DARK_FG }} />
            <FlexWidget style={{ width: 6 }} />
            <TextWidget text={data.homeTeam} style={{ fontSize: 11, fontWeight: "700", color: alpha(DARK_FG, "77") }} />
            <FlexWidget style={{ width: 4 }} />
            <ImageWidget image={homeCharImage} imageWidth={24} imageHeight={24} />
          </FlexWidget>
        </FlexWidget>

        {/* 하단: 상태 */}
        <FlexWidget style={{ alignItems: "center" }}>
          <TextWidget text={statusText} style={{ fontSize: 9, fontWeight: "600", color: isLive ? "#e07b3c" : alpha(DARK_FG, "66") }} />
        </FlexWidget>
      </FlexWidget>
    </ColorBg>
  );
}

/* ─────────── 4x2+ Full Scoreboard ─────────── */

function main4x2View(data: WidgetGameData, myTeam: string) {
  const isMyHome = data.homeIsMyTeam;
  const awayTeamId = NAME_TO_TEAM_ID[data.awayTeam] || data.awayTeam.toLowerCase();
  const homeTeamId = NAME_TO_TEAM_ID[data.homeTeam] || data.homeTeam.toLowerCase();
  const bg = "#f5f0eb";

  const isLive = data.status === "live";
  const isFinished = data.status === "finished";
  const showScore = isLive || isFinished;

  const statusText = data.status === "cancelled" ? "취소"
    : isLive ? `LIVE ${data.inning}회${data.isTop === "1" ? "초" : "말"}`
      : isFinished ? "경기 종료" : "경기 전";

  const awayEmotion = computeWidgetEmotion(data, !isMyHome);
  const homeEmotion = computeWidgetEmotion(data, isMyHome);
  const awayCharKey = `${awayTeamId}_${awayEmotion}`;
  const homeCharKey = `${homeTeamId}_${homeEmotion}`;
  const awayCharImage = LOCAL_CHARACTERS[awayCharKey] || LOCAL_CHARACTERS[`${awayTeamId}_default`];
  const homeCharImage = LOCAL_CHARACTERS[homeCharKey] || LOCAL_CHARACTERS[`${homeTeamId}_default`];

  // Team name colors (use team primary)
  const awayNameColor = NAME_TO_TEAM_ID[data.awayTeam]
    ? TEAM_NAME_COLOR[NAME_TO_TEAM_ID[data.awayTeam]] || DARK_FG
    : DARK_FG;
  const homeNameColor = NAME_TO_TEAM_ID[data.homeTeam]
    ? TEAM_NAME_COLOR[NAME_TO_TEAM_ID[data.homeTeam]] || DARK_FG
    : DARK_FG;

  // BSO
  const bCnt = Math.min(parseInt(data.ball || "0", 10), 3);
  const sCnt = Math.min(parseInt(data.strike || "0", 10), 2);
  const oCnt = Math.min(parseInt(data.out || "0", 10), 2);

  return (
    <ColorBg bg={bg}>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 8 }}>
        {/* ── Header: 고정폭 컬럼 (좌 180 / 우 100) ── */}
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
          <FlexWidget style={{ width: 180, alignItems: "flex-start" }}>
            <TextWidget text={`${data.stadium || ""} ${data.time || ""}`} style={{ fontSize: 9, color: alpha(DARK_FG, "66") }} />
          </FlexWidget>
          <FlexWidget style={{ width: 100, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" }}>
            <TextWidget text={data.weather || ""} style={{ fontSize: 9, color: alpha(DARK_FG, "66") }} />
            <FlexWidget style={{ width: 6 }} />
            <TextWidget text="↻" clickAction="REFRESH" style={{ fontSize: 16, color: "#e07b3c" }} />
          </FlexWidget>
        </FlexWidget>
        <FlexWidget style={{ height: 6 }} />

        {/* ── Main row (fixed-width columns, justifyContent center) ── */}
        <FlexWidget style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
          {/* Away side */}
          <FlexWidget style={{ width: 64, alignItems: "center" }}>
            <ImageWidget image={awayCharImage} imageWidth={36} imageHeight={36} />
            <FlexWidget style={{ height: 3 }} />
            <TextWidget text={data.awayTeam} style={{ fontSize: 13, fontWeight: "700", color: awayNameColor }} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={data.awayPitcher || ""} style={{ fontSize: 9, color: DARK_FG }} />
          </FlexWidget>

          <FlexWidget style={{ width: 16 }} />

          {/* Center: score | BSO | bases | status */}
          <FlexWidget style={{ width: 88, alignItems: "center" }}>
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <TextWidget text={data.awayScore} style={{ fontSize: 26, fontWeight: "700", color: DARK_FG }} />
              <TextWidget text=":" style={{ fontSize: 16, fontWeight: "700", color: alpha(DARK_FG, "44") }} />
              <TextWidget text={data.homeScore} style={{ fontSize: 26, fontWeight: "700", color: DARK_FG }} />
            </FlexWidget>

            {/* BSO */}
            <FlexWidget style={{ height: 5 }} />
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <TextWidget text={"●".repeat(bCnt) + "○".repeat(3 - bCnt)} style={{ fontSize: 9, color: "#43a047" }} />
              <TextWidget text=" " style={{ fontSize: 9 }} />
              <TextWidget text={"●".repeat(sCnt) + "○".repeat(2 - sCnt)} style={{ fontSize: 9, color: "#f9a825" }} />
              <TextWidget text=" " style={{ fontSize: 9 }} />
              <TextWidget text={"●".repeat(oCnt) + "○".repeat(2 - oCnt)} style={{ fontSize: 9, color: "#e53935" }} />
            </FlexWidget>

            {/* Bases triangle: 3B top center, 2B left, 1B right */}
            <FlexWidget style={{ height: 3 }} />
            <FlexWidget style={{ alignItems: "center" }}>
              <TextWidget text={data.base3 && data.base3 !== "0" ? "◆" : "◇"} style={{ fontSize: 9, color: data.base3 && data.base3 !== "0" ? "#e07b3c" : alpha(DARK_FG, "33") }} />
            </FlexWidget>
            <FlexWidget style={{ flexDirection: "row", justifyContent: "center" }}>
              <FlexWidget style={{ width: 16, alignItems: "center" }}>
                <TextWidget text={data.base2 && data.base2 !== "0" ? "◆" : "◇"} style={{ fontSize: 9, color: data.base2 && data.base2 !== "0" ? "#e07b3c" : alpha(DARK_FG, "33") }} />
              </FlexWidget>
              <FlexWidget style={{ width: 16, alignItems: "center" }}>
                <TextWidget text={data.base1 && data.base1 !== "0" ? "◆" : "◇"} style={{ fontSize: 9, color: data.base1 && data.base1 !== "0" ? "#e07b3c" : alpha(DARK_FG, "33") }} />
              </FlexWidget>
            </FlexWidget>

            {/* Status */}
            <FlexWidget style={{ height: 3 }} />
            <TextWidget text={statusText} style={{ fontSize: 10, fontWeight: "600", color: isLive ? "#e07b3c" : alpha(DARK_FG, "66") }} />
          </FlexWidget>

          <FlexWidget style={{ width: 16 }} />

          {/* Home side */}
          <FlexWidget style={{ width: 64, alignItems: "center" }}>
            <ImageWidget image={homeCharImage} imageWidth={36} imageHeight={36} />
            <FlexWidget style={{ height: 3 }} />
            <TextWidget text={data.homeTeam} style={{ fontSize: 13, fontWeight: "700", color: homeNameColor }} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={data.homePitcher || ""} style={{ fontSize: 9, color: DARK_FG }} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </ColorBg>
  );
}
