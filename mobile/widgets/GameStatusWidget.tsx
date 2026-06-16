import { FlexWidget, TextWidget, ImageWidget } from "react-native-android-widget";
import { LOCAL_CHARACTERS } from "@/lib/characterAssets";
import type { CharacterEmotion } from "@/lib/emotions";

const WIDGET_BUILD = "OTA-v37-header-unify";

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
  currentPitcher?: string;
  currentBatter?: string;
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
  // 강제 테스트용 MOCK 데이터 삽입 (경기 종료 후에도 레이아웃 테스트 가능)
  data = {
    homeTeam: "LG",
    awayTeam: "KIA",
    homeScore: "3",
    awayScore: "12",
    inning: "7",
    isTop: "1",
    status: "live",
    time: "18:30",
    homeIsMyTeam: true,
    stadium: "잠실",
    weather: "맑음",
    awayPitcher: "네일",
    homePitcher: "임찬규",
    ball: "2",
    strike: "2",
    out: "1",
    base1: "1",
    base2: "0",
    base3: "1",
    currentPitcher: "임찬규",
    currentBatter: "김도영",
  };

  try {
    if (!data) return noGameView();
    if (height < 80) {
      if (width < 130) return view1x2(data);
      if (width < 230) return view2x1(data);
      return view3x1Compact(data, myTeam);
    }
    
    // 세로형 및 일반형 분기 (너비 기준)
    if (width < 130) return view1x2(data); // 1x2, 1x3, 1x4...
    if (width < 230) return view2x2(data, myTeam); // 2x2, 2x3, 2x4...
    
    // 3x2 이상 (가로로 넓은 형태)은 모두 반응형 뷰 사용
    return mainResponsiveView(data, myTeam);
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

function BaseSituation({ b1, b2, b3, size = 8 }: { b1?: string, b2?: string, b3?: string, size?: number }) {
  const activeColor = "#e07b3c";
  const inactiveColor = alpha(DARK_FG, "66"); // 테두리 확실히 보이도록 진한 색
  const getBase = (occ?: string) => occ && occ !== "0" ? "◆" : "◇";
  const getColor = (occ?: string) => occ && occ !== "0" ? activeColor : inactiveColor;
  
  const topMargin = Math.round(size * 0.2) || 1;
  const bottomWidth = Math.round(size * 2.6);

  return (
    <FlexWidget style={{ alignItems: "center", justifyContent: "center" }}>
      {/* 2nd Base (Top) */}
      <FlexWidget style={{ alignItems: "center", height: size }}>
        <TextWidget text={getBase(b2)} style={{ fontSize: size, color: getColor(b2), fontWeight: "700" }} />
      </FlexWidget>
      <FlexWidget style={{ height: topMargin }} />
      {/* 3rd Base (Left), 1st Base (Right) */}
      <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", width: bottomWidth }}>
        <TextWidget text={getBase(b3)} style={{ fontSize: size, color: getColor(b3), fontWeight: "700" }} />
        <TextWidget text={getBase(b1)} style={{ fontSize: size, color: getColor(b1), fontWeight: "700" }} />
      </FlexWidget>
    </FlexWidget>
  );
}

function GameStatusHeader({ data }: { data: WidgetGameData }) {
  const isLive = data.status === "live";
  const statusText = data.status === "cancelled" ? "취소"
    : isLive ? `${data.inning}회${data.isTop === "1" ? "초" : "말"}`
      : data.status === "finished" ? "경기 종료" : "경기 전";

  const bCnt = Math.min(parseInt(data.ball || "0", 10), 3);
  const sCnt = Math.min(parseInt(data.strike || "0", 10), 2);
  const oCnt = Math.min(parseInt(data.out || "0", 10), 2);

  return (
    <FlexWidget style={{ flexDirection: "row", alignItems: "center", width: "match_parent" }}>
      {/* 1. 이닝 / 상태 */}
      <TextWidget text={statusText} style={{ fontSize: 11, fontWeight: "700", color: isLive ? "#e07b3c" : alpha(DARK_FG, "88") }} />
      
      {isLive && (
        <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
          <FlexWidget style={{ width: 8 }} />
          {/* 2. BSO */}
          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            <TextWidget text={"●".repeat(bCnt) + "○".repeat(3 - bCnt)} style={{ fontSize: 8, color: "#43a047" }} />
            <FlexWidget style={{ width: 3 }} />
            <TextWidget text={"●".repeat(sCnt) + "○".repeat(2 - sCnt)} style={{ fontSize: 8, color: "#f9a825" }} />
            <FlexWidget style={{ width: 3 }} />
            <TextWidget text={"●".repeat(oCnt) + "○".repeat(2 - oCnt)} style={{ fontSize: 8, color: "#e53935" }} />
          </FlexWidget>

          <FlexWidget style={{ width: 8 }} />
          {/* 3. Bases */}
          <BaseSituation b1={data.base1} b2={data.base2} b3={data.base3} size={5} />
        </FlexWidget>
      )}

      {/* Spacer to push Refresh to the right */}
      <FlexWidget style={{ flex: 1 }} />
      
      {/* Refresh Button */}
      <FlexWidget clickAction="REFRESH" style={{ padding: 4, paddingHorizontal: 8, justifyContent: "center", alignItems: "center" }}>
        <TextWidget text="↻" style={{ fontSize: 18, color: "#e07b3c", fontWeight: "700" }} />
      </FlexWidget>
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
      <FlexWidget clickAction="REFRESH" style={{ padding: 4, paddingHorizontal: 8, justifyContent: "center", alignItems: "center" }}>
        <TextWidget text="↻" style={{ fontSize: 20, color: "#e07b3c", fontWeight: "700" }} />
      </FlexWidget>
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

  return (
    <ColorBg bg={bg} borderRadius={12}>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 8, paddingHorizontal: 12, width: "match_parent" }}>
        <GameStatusHeader data={data} />
        <FlexWidget style={{ height: 4 }} />
        <FlexWidget style={{ flex: 1, flexDirection: "row", alignItems: "center", width: "match_parent" }}>
          {/* Away side */}
          <FlexWidget style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <ImageWidget image={awayCharImage} imageWidth={20} imageHeight={20} />
            <FlexWidget style={{ width: 4 }} />
            <FlexWidget style={{ alignItems: "flex-start" }}>
              <TextWidget text={data.awayTeam} style={{ fontSize: 11, fontWeight: "700", color: awayNameColor }} />
              {isLive && (data.isTop === "1" ? data.currentBatter : data.currentPitcher) ? (
                <TextWidget text={data.isTop === "1" ? `B:${data.currentBatter}` : `P:${data.currentPitcher}`} style={{ fontSize: 8, color: DARK_FG }} />
              ) : (
                <TextWidget text={data.awayPitcher || ""} style={{ fontSize: 8, color: DARK_FG }} />
              )}
            </FlexWidget>
          </FlexWidget>

          {/* Center Score */}
          <FlexWidget style={{ width: 80, alignItems: "center" }}>
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <TextWidget text={data.awayScore} style={{ fontSize: 24, fontWeight: "700", color: DARK_FG }} />
              <FlexWidget style={{ width: 6 }} />
              <TextWidget text=":" style={{ fontSize: 14, fontWeight: "700", color: alpha(DARK_FG, "44") }} />
              <FlexWidget style={{ width: 6 }} />
              <TextWidget text={data.homeScore} style={{ fontSize: 24, fontWeight: "700", color: DARK_FG }} />
            </FlexWidget>
          </FlexWidget>

          {/* Home side */}
          <FlexWidget style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" }}>
            <FlexWidget style={{ alignItems: "flex-end" }}>
              <TextWidget text={data.homeTeam} style={{ fontSize: 11, fontWeight: "700", color: homeNameColor }} />
              {isLive && (data.isTop === "1" ? data.currentPitcher : data.currentBatter) ? (
                <TextWidget text={data.isTop === "1" ? `P:${data.currentPitcher}` : `B:${data.currentBatter}`} style={{ fontSize: 8, color: DARK_FG }} />
              ) : (
                <TextWidget text={data.homePitcher || ""} style={{ fontSize: 8, color: DARK_FG }} />
              )}
            </FlexWidget>
            <FlexWidget style={{ width: 4 }} />
            <ImageWidget image={homeCharImage} imageWidth={20} imageHeight={20} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </ColorBg>
  );
}

/* ─────────── 1x2 narrow ─────────── */

function view1x2(data: WidgetGameData) {
  const bg = "#f5f0eb";
  const statusText = data.status === "live"
    ? `${data.inning}회${data.isTop === "1" ? "초" : "말"}`
    : data.status === "finished" ? "경기 종료"
      : data.status === "cancelled" ? "취소"
        : data.time || "경기 전";

  return (
    <ColorBg bg={bg} borderRadius={16}>
      <FlexWidget style={{ flex: 1, flexDirection: "column", justifyContent: "center", padding: 10 }}>
        <FlexWidget style={{ alignItems: "center", flexDirection: "row", justifyContent: "center" }}>
          <TextWidget text={statusText} style={{ fontSize: 10, fontWeight: "700", color: data.status === "live" ? "#e07b3c" : alpha(DARK_FG, "77") }} />
          <FlexWidget style={{ width: 4 }} />
          <FlexWidget clickAction="REFRESH" style={{ padding: 4, paddingHorizontal: 8 }}>
            <TextWidget text="↻" style={{ fontSize: 16, color: "#e07b3c", fontWeight: "700" }} />
          </FlexWidget>
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
  const isMyHome = data.homeIsMyTeam;

  const awayTeamId = NAME_TO_TEAM_ID[data.awayTeam] || data.awayTeam.toLowerCase();
  const homeTeamId = NAME_TO_TEAM_ID[data.homeTeam] || data.homeTeam.toLowerCase();
  const awayEmotion = computeWidgetEmotion(data, !isMyHome);
  const homeEmotion = computeWidgetEmotion(data, isMyHome);
  const awayCharImage = LOCAL_CHARACTERS[`${awayTeamId}_${awayEmotion}`] || LOCAL_CHARACTERS[`${awayTeamId}_default`];
  const homeCharImage = LOCAL_CHARACTERS[`${homeTeamId}_${homeEmotion}`] || LOCAL_CHARACTERS[`${homeTeamId}_default`];

  const awayNameColor = NAME_TO_TEAM_ID[data.awayTeam]
    ? TEAM_NAME_COLOR[NAME_TO_TEAM_ID[data.awayTeam]] || DARK_FG
    : DARK_FG;
  const homeNameColor = NAME_TO_TEAM_ID[data.homeTeam]
    ? TEAM_NAME_COLOR[NAME_TO_TEAM_ID[data.homeTeam]] || DARK_FG
    : DARK_FG;

  return (
    <ColorBg bg={bg} borderRadius={16}>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 8, width: "match_parent" }}>
        <GameStatusHeader data={data} />
        
        {/* 중앙: 4x2와 동일한 수직 구조 (캐릭터 -> 팀명 -> 선발/타자) */}
        <FlexWidget style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", width: "match_parent" }}>
          {/* Away side */}
          <FlexWidget style={{ flex: 1, alignItems: "center" }}>
            <ImageWidget image={awayCharImage} imageWidth={32} imageHeight={32} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={data.awayTeam} style={{ fontSize: 11, fontWeight: "700", color: awayNameColor }} />
            {isLive && (data.isTop === "1" ? data.currentBatter : data.currentPitcher) ? (
              <FlexWidget>
                <FlexWidget style={{ height: 2 }} />
                <TextWidget text={data.isTop === "1" ? `B:${data.currentBatter}` : `P:${data.currentPitcher}`} style={{ fontSize: 8, color: DARK_FG }} />
              </FlexWidget>
            ) : (
              <FlexWidget>
                <FlexWidget style={{ height: 2 }} />
                <TextWidget text={data.awayPitcher || ""} style={{ fontSize: 8, color: DARK_FG }} />
              </FlexWidget>
            )}
          </FlexWidget>

          {/* Center Score */}
          <FlexWidget style={{ width: 80, alignItems: "center" }}>
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <TextWidget text={data.awayScore} style={{ fontSize: 24, fontWeight: "700", color: DARK_FG }} />
              <FlexWidget style={{ width: 6 }} />
              <TextWidget text=":" style={{ fontSize: 14, fontWeight: "700", color: alpha(DARK_FG, "44") }} />
              <FlexWidget style={{ width: 6 }} />
              <TextWidget text={data.homeScore} style={{ fontSize: 24, fontWeight: "700", color: DARK_FG }} />
            </FlexWidget>
          </FlexWidget>

          {/* Home side */}
          <FlexWidget style={{ flex: 1, alignItems: "center" }}>
            <ImageWidget image={homeCharImage} imageWidth={32} imageHeight={32} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={data.homeTeam} style={{ fontSize: 11, fontWeight: "700", color: homeNameColor }} />
            {isLive && (data.isTop === "1" ? data.currentPitcher : data.currentBatter) ? (
              <FlexWidget>
                <FlexWidget style={{ height: 2 }} />
                <TextWidget text={data.isTop === "1" ? `P:${data.currentPitcher}` : `B:${data.currentBatter}`} style={{ fontSize: 8, color: DARK_FG }} />
              </FlexWidget>
            ) : (
              <FlexWidget>
                <FlexWidget style={{ height: 2 }} />
                <TextWidget text={data.homePitcher || ""} style={{ fontSize: 8, color: DARK_FG }} />
              </FlexWidget>
            )}
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </ColorBg>
  );
}

/* ─────────── 3x2+ Responsive Scoreboard ─────────── */

function mainResponsiveView(data: WidgetGameData, myTeam: string) {
  const bg = "#f5f0eb";
  const isLive = data.status === "live";
  const isMyHome = data.homeIsMyTeam;

  const awayTeamId = NAME_TO_TEAM_ID[data.awayTeam] || data.awayTeam.toLowerCase();
  const homeTeamId = NAME_TO_TEAM_ID[data.homeTeam] || data.homeTeam.toLowerCase();
  const awayEmotion = computeWidgetEmotion(data, !isMyHome);
  const homeEmotion = computeWidgetEmotion(data, isMyHome);
  const awayCharImage = LOCAL_CHARACTERS[`${awayTeamId}_${awayEmotion}`] || LOCAL_CHARACTERS[`${awayTeamId}_default`];
  const homeCharImage = LOCAL_CHARACTERS[`${homeTeamId}_${homeEmotion}`] || LOCAL_CHARACTERS[`${homeTeamId}_default`];

  const awayNameColor = NAME_TO_TEAM_ID[data.awayTeam]
    ? TEAM_NAME_COLOR[NAME_TO_TEAM_ID[data.awayTeam]] || DARK_FG
    : DARK_FG;
  const homeNameColor = NAME_TO_TEAM_ID[data.homeTeam]
    ? TEAM_NAME_COLOR[NAME_TO_TEAM_ID[data.homeTeam]] || DARK_FG
    : DARK_FG;

  return (
    <ColorBg bg={bg}>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 8 }}>
        <GameStatusHeader data={data} />
        <FlexWidget style={{ height: 6 }} />

        {/* ── Main row (반응형: 중앙 96px 고정, 좌우 flex: 1) ── */}
        <FlexWidget style={{ flex: 1, flexDirection: "row", alignItems: "center", width: "match_parent" }}>
          {/* Away side */}
          <FlexWidget style={{ flex: 1, alignItems: "center" }}>
            <ImageWidget image={awayCharImage} imageWidth={36} imageHeight={36} />
            <FlexWidget style={{ height: 3 }} />
            <TextWidget text={data.awayTeam} style={{ fontSize: 13, fontWeight: "700", color: awayNameColor }} />
            {isLive && (data.isTop === "1" ? data.currentBatter : data.currentPitcher) ? (
              <FlexWidget>
                <FlexWidget style={{ height: 2 }} />
                <TextWidget text={data.isTop === "1" ? `B:${data.currentBatter}` : `P:${data.currentPitcher}`} style={{ fontSize: 9, color: DARK_FG }} />
              </FlexWidget>
            ) : (
              <FlexWidget>
                <FlexWidget style={{ height: 2 }} />
                <TextWidget text={data.awayPitcher || ""} style={{ fontSize: 9, color: DARK_FG }} />
              </FlexWidget>
            )}
          </FlexWidget>

          {/* Center: score */}
          <FlexWidget style={{ width: 96, alignItems: "center" }}>
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <TextWidget text={data.awayScore} style={{ fontSize: 32, fontWeight: "700", color: DARK_FG }} />
              <FlexWidget style={{ width: 8 }} />
              <TextWidget text=":" style={{ fontSize: 18, fontWeight: "700", color: alpha(DARK_FG, "44") }} />
              <FlexWidget style={{ width: 8 }} />
              <TextWidget text={data.homeScore} style={{ fontSize: 32, fontWeight: "700", color: DARK_FG }} />
            </FlexWidget>
          </FlexWidget>

          {/* Home side */}
          <FlexWidget style={{ flex: 1, alignItems: "center" }}>
            <ImageWidget image={homeCharImage} imageWidth={36} imageHeight={36} />
            <FlexWidget style={{ height: 3 }} />
            <TextWidget text={data.homeTeam} style={{ fontSize: 13, fontWeight: "700", color: homeNameColor }} />
            {isLive && (data.isTop === "1" ? data.currentPitcher : data.currentBatter) ? (
              <FlexWidget>
                <FlexWidget style={{ height: 2 }} />
                <TextWidget text={data.isTop === "1" ? `P:${data.currentPitcher}` : `B:${data.currentBatter}`} style={{ fontSize: 9, color: DARK_FG }} />
              </FlexWidget>
            ) : (
              <FlexWidget>
                <FlexWidget style={{ height: 2 }} />
                <TextWidget text={data.homePitcher || ""} style={{ fontSize: 9, color: DARK_FG }} />
              </FlexWidget>
            )}
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </ColorBg>
  );
}
