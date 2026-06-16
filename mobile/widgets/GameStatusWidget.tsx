import { FlexWidget, TextWidget, ImageWidget } from "react-native-android-widget";
import { LOCAL_CHARACTERS } from "@/lib/characterAssets";
import type { CharacterEmotion } from "@/lib/emotions";

const WIDGET_BUILD = "OTA-v40-independent-views";

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

const TEAM_NAME_COLOR: Record<string, string> = {
  doosan: "#131230", lg: "#C0334A", kiwoom: "#820024", ssg: "#CE0E2D",
  kt: "#231F20", hanwha: "#FF6600", samsung: "#074CA1", kia: "#EA0029",
  lotte: "#1E467C", nc: "#1D467C",
};

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

function computeWidgetEmotion(data: WidgetGameData, isMyHome: boolean): CharacterEmotion {
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

/* ─────────── 헬퍼 (데이터 가공용, UI 아님) ─────────── */

function getTeamInfo(data: WidgetGameData, isHome: boolean) {
  const isLive = data.status === "live";
  const teamName = isHome ? data.homeTeam : data.awayTeam;
  const teamId = NAME_TO_TEAM_ID[teamName] || teamName.toLowerCase();
  
  const isMyHome = data.homeIsMyTeam;
  const isMyTeam = isHome ? isMyHome : !isMyHome;
  const emotion = computeWidgetEmotion(data, isMyTeam);
  const charImage = LOCAL_CHARACTERS[`${teamId}_${emotion}`] || LOCAL_CHARACTERS[`${teamId}_default`];
  const nameColor = TEAM_NAME_COLOR[teamId] || DARK_FG;
  
  // 공격팀 점수는 진하게, 수비팀 점수는 연하게
  const isAttacking = isLive && (data.isTop === (isHome ? "0" : "1"));
  const scoreColor = isLive ? (isAttacking ? DARK_FG : alpha(DARK_FG, "55")) : DARK_FG;
  
  const pbText = isLive && isAttacking 
    ? `B:${data.currentBatter || ""}` 
    : isLive 
      ? `P:${data.currentPitcher || (isHome ? data.homePitcher : data.awayPitcher) || ""}`
      : `P:${isHome ? data.homePitcher : data.awayPitcher || ""}`;

  return { teamName, charImage, nameColor, scoreColor, pbText };
}

function getHeaderInfo(data: WidgetGameData) {
  const isLive = data.status === "live";
  const statusText = data.status === "cancelled" ? "취소"
    : isLive ? `${data.inning}회${data.isTop === "1" ? "초" : "말"}`
      : data.status === "finished" ? "경기 종료" : "경기 전";

  const bCnt = Math.min(parseInt(data.ball || "0", 10), 3);
  const sCnt = Math.min(parseInt(data.strike || "0", 10), 2);
  const oCnt = Math.min(parseInt(data.out || "0", 10), 2);
  
  return { isLive, statusText, bCnt, sCnt, oCnt };
}

/* ─────────── 공통 UI 컴포넌트 (의존성 최소화) ─────────── */

function ColorBg({ children }: { children: any }) {
  return (
    <FlexWidget style={{ width: "match_parent", height: "match_parent", backgroundColor: "#f5f0eb", borderRadius: 16 }} clickAction="OPEN_APP">
      {children}
    </FlexWidget>
  );
}

function BaseSituation({ b1, b2, b3, size }: { b1?: string, b2?: string, b3?: string, size: number }) {
  const activeColor = "#e07b3c";
  const inactiveColor = "#000000";
  const getBase = (occ?: string) => occ && occ !== "0" ? "◆" : "◇";
  const getColor = (occ?: string) => occ && occ !== "0" ? activeColor : inactiveColor;
  
  const bottomWidth = Math.round(size * 2.1);

  return (
    <FlexWidget style={{ alignItems: "center", justifyContent: "center" }}>
      <FlexWidget style={{ alignItems: "center" }}>
        <TextWidget text={getBase(b2)} style={{ fontSize: size, color: getColor(b2), fontWeight: "700" }} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", width: bottomWidth }}>
        <TextWidget text={getBase(b3)} style={{ fontSize: size, color: getColor(b3), fontWeight: "700" }} />
        <TextWidget text={getBase(b1)} style={{ fontSize: size, color: getColor(b1), fontWeight: "700" }} />
      </FlexWidget>
    </FlexWidget>
  );
}

/* ─────────── Component Router ─────────── */

interface WidgetProps {
  width: number;
  height: number;
  data: WidgetGameData | null;
  myTeam: string;
}

export function GameStatusWidget({ width, height, data, myTeam }: WidgetProps) {
  // 강제 테스트용 MOCK 데이터 삽입
  data = {
    homeTeam: "LG", awayTeam: "KIA",
    homeScore: "3", awayScore: "12",
    inning: "7", isTop: "1", status: "live", time: "18:30",
    homeIsMyTeam: true,
    stadium: "잠실", weather: "맑음",
    awayPitcher: "네일", homePitcher: "임찬규",
    ball: "2", strike: "2", out: "1",
    base1: "1", base2: "0", base3: "1",
    currentPitcher: "임찬규", currentBatter: "김도영",
  };

  try {
    if (!data) return noGameView();
    
    // 폭 130 이하 (1x2 등)는 지원 중단
    if (width < 130) {
      return (
        <ColorBg>
          <FlexWidget style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <TextWidget text="지원하지 않는" style={{ fontSize: 10, color: DARK_FG }} />
            <TextWidget text="크기입니다" style={{ fontSize: 10, color: DARK_FG }} />
          </FlexWidget>
        </ColorBg>
      );
    }

    if (height < 80) {
      if (width < 230) return view2x1(data);
      return view3x1(data);
    } else {
      if (width < 230) return view2x2(data);
      return view4x2(data);
    }
  } catch (e) {
    console.warn("GameStatusWidget render error", e);
    return (
      <FlexWidget style={{ width: "match_parent", height: "match_parent", backgroundColor: "#000000", justifyContent: "center", alignItems: "center" }} clickAction="OPEN_APP">
        <TextWidget text="!" style={{ fontSize: 20, color: "#FFFFFF" }} />
      </FlexWidget>
    );
  }
}

function noGameView() {
  return (
    <ColorBg>
      <FlexWidget style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <TextWidget text="오늘의 경기 없음" style={{ fontSize: 13, color: DARK_FG }} />
        <TextWidget text={WIDGET_BUILD} style={{ fontSize: 6, color: alpha(DARK_FG, "44") }} />
      </FlexWidget>
    </ColorBg>
  );
}

/* ─────────── 1. view2x1 (폭 < 230, 높이 < 80) ─────────── */
function view2x1(data: WidgetGameData) {
  const away = getTeamInfo(data, false);
  const home = getTeamInfo(data, true);
  const head = getHeaderInfo(data);

  return (
    <ColorBg>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 6, paddingHorizontal: 10, width: "match_parent" }}>
        {/* 상단 헤더: 공간이 매우 좁으므로 이닝/BSO/새로고침만. 마름모는 중앙에 초소형으로. */}
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", width: "match_parent" }}>
          <TextWidget text={head.statusText} style={{ fontSize: 10, fontWeight: "700", color: head.isLive ? "#e07b3c" : alpha(DARK_FG, "88") }} />
          {head.isLive && (
            <FlexWidget style={{ flexDirection: "row", alignItems: "center", marginLeft: 8 }}>
              <TextWidget text={"●".repeat(head.bCnt) + "○".repeat(3 - head.bCnt)} style={{ fontSize: 7, color: "#43a047" }} />
              <FlexWidget style={{ width: 3 }} />
              <TextWidget text={"●".repeat(head.sCnt) + "○".repeat(2 - head.sCnt)} style={{ fontSize: 7, color: "#f9a825" }} />
              <FlexWidget style={{ width: 3 }} />
              <TextWidget text={"●".repeat(head.oCnt) + "○".repeat(2 - head.oCnt)} style={{ fontSize: 7, color: "#e53935" }} />
            </FlexWidget>
          )}
          <FlexWidget style={{ flex: 1 }} />
          <FlexWidget clickAction="REFRESH" style={{ padding: 2, paddingHorizontal: 4 }}>
            <TextWidget text="↻" style={{ fontSize: 14, color: "#e07b3c", fontWeight: "700" }} />
          </FlexWidget>
        </FlexWidget>

        {/* 중앙 컨텐츠 */}
        <FlexWidget style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
          <FlexWidget style={{ alignItems: "center", width: 40 }}>
            <ImageWidget image={away.charImage} imageWidth={20} imageHeight={20} />
            <TextWidget text={away.teamName} style={{ fontSize: 9, fontWeight: "700", color: away.nameColor }} />
          </FlexWidget>

          <FlexWidget style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            {head.isLive && (
              <FlexWidget style={{ alignItems: "center", marginBottom: 2 }}>
                <BaseSituation b1={data.base1} b2={data.base2} b3={data.base3} size={5} />
              </FlexWidget>
            )}
            <FlexWidget style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "center" }}>
              <FlexWidget style={{ alignItems: "center" }}>
                <TextWidget text={data.awayScore} style={{ fontSize: 18, fontWeight: "700", color: away.scoreColor }} />
                {head.isLive && <TextWidget text={away.pbText} style={{ fontSize: 7, color: DARK_FG }} />}
              </FlexWidget>
              <TextWidget text=" : " style={{ fontSize: 12, fontWeight: "700", color: alpha(DARK_FG, "44"), marginHorizontal: 4 }} />
              <FlexWidget style={{ alignItems: "center" }}>
                <TextWidget text={data.homeScore} style={{ fontSize: 18, fontWeight: "700", color: home.scoreColor }} />
                {head.isLive && <TextWidget text={home.pbText} style={{ fontSize: 7, color: DARK_FG }} />}
              </FlexWidget>
            </FlexWidget>
          </FlexWidget>

          <FlexWidget style={{ alignItems: "center", width: 40 }}>
            <ImageWidget image={home.charImage} imageWidth={20} imageHeight={20} />
            <TextWidget text={home.teamName} style={{ fontSize: 9, fontWeight: "700", color: home.nameColor }} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </ColorBg>
  );
}

/* ─────────── 2. view3x1 (폭 >= 230, 높이 < 80) ─────────── */
function view3x1(data: WidgetGameData) {
  const away = getTeamInfo(data, false);
  const home = getTeamInfo(data, true);
  const head = getHeaderInfo(data);

  return (
    <ColorBg>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 8, paddingHorizontal: 14, width: "match_parent" }}>
        {/* 상단 헤더: 가로 공간 충분. 마름모를 헤더로 올려 세로 공간 확보 */}
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", width: "match_parent" }}>
          <TextWidget text={head.statusText} style={{ fontSize: 11, fontWeight: "700", color: head.isLive ? "#e07b3c" : alpha(DARK_FG, "88") }} />
          {head.isLive && (
            <FlexWidget style={{ flexDirection: "row", alignItems: "center", marginLeft: 12 }}>
              <TextWidget text={"●".repeat(head.bCnt) + "○".repeat(3 - head.bCnt)} style={{ fontSize: 9, color: "#43a047" }} />
              <FlexWidget style={{ width: 4 }} />
              <TextWidget text={"●".repeat(head.sCnt) + "○".repeat(2 - head.sCnt)} style={{ fontSize: 9, color: "#f9a825" }} />
              <FlexWidget style={{ width: 4 }} />
              <TextWidget text={"●".repeat(head.oCnt) + "○".repeat(2 - head.oCnt)} style={{ fontSize: 9, color: "#e53935" }} />
              <FlexWidget style={{ width: 14 }} />
              <BaseSituation b1={data.base1} b2={data.base2} b3={data.base3} size={11} />
            </FlexWidget>
          )}
          <FlexWidget style={{ flex: 1 }} />
          <FlexWidget clickAction="REFRESH" style={{ padding: 2, paddingHorizontal: 6 }}>
            <TextWidget text="↻" style={{ fontSize: 18, color: "#e07b3c", fontWeight: "700" }} />
          </FlexWidget>
        </FlexWidget>

        {/* 중앙 컨텐츠 */}
        <FlexWidget style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
          <FlexWidget style={{ alignItems: "center", width: 50 }}>
            <ImageWidget image={away.charImage} imageWidth={26} imageHeight={26} />
            <TextWidget text={away.teamName} style={{ fontSize: 11, fontWeight: "700", color: away.nameColor }} />
          </FlexWidget>

          <FlexWidget style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <FlexWidget style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "center" }}>
              <FlexWidget style={{ alignItems: "center" }}>
                <TextWidget text={data.awayScore} style={{ fontSize: 26, fontWeight: "700", color: away.scoreColor }} />
                {head.isLive && <TextWidget text={away.pbText} style={{ fontSize: 9, color: DARK_FG }} />}
              </FlexWidget>
              <TextWidget text=" : " style={{ fontSize: 16, fontWeight: "700", color: alpha(DARK_FG, "44"), marginHorizontal: 8 }} />
              <FlexWidget style={{ alignItems: "center" }}>
                <TextWidget text={data.homeScore} style={{ fontSize: 26, fontWeight: "700", color: home.scoreColor }} />
                {head.isLive && <TextWidget text={home.pbText} style={{ fontSize: 9, color: DARK_FG }} />}
              </FlexWidget>
            </FlexWidget>
          </FlexWidget>

          <FlexWidget style={{ alignItems: "center", width: 50 }}>
            <ImageWidget image={home.charImage} imageWidth={26} imageHeight={26} />
            <TextWidget text={home.teamName} style={{ fontSize: 11, fontWeight: "700", color: home.nameColor }} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </ColorBg>
  );
}

/* ─────────── 3. view2x2 (폭 < 230, 높이 >= 80) ─────────── */
function view2x2(data: WidgetGameData) {
  const away = getTeamInfo(data, false);
  const home = getTeamInfo(data, true);
  const head = getHeaderInfo(data);

  return (
    <ColorBg>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 8, paddingHorizontal: 12, width: "match_parent" }}>
        {/* 상단 헤더: 가로폭이 좁으므로 마름모는 중앙으로 내림 */}
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", width: "match_parent" }}>
          <TextWidget text={head.statusText} style={{ fontSize: 11, fontWeight: "700", color: head.isLive ? "#e07b3c" : alpha(DARK_FG, "88") }} />
          {head.isLive && (
            <FlexWidget style={{ flexDirection: "row", alignItems: "center", marginLeft: 10 }}>
              <TextWidget text={"●".repeat(head.bCnt) + "○".repeat(3 - head.bCnt)} style={{ fontSize: 9, color: "#43a047" }} />
              <FlexWidget style={{ width: 3 }} />
              <TextWidget text={"●".repeat(head.sCnt) + "○".repeat(2 - head.sCnt)} style={{ fontSize: 9, color: "#f9a825" }} />
              <FlexWidget style={{ width: 3 }} />
              <TextWidget text={"●".repeat(head.oCnt) + "○".repeat(2 - head.oCnt)} style={{ fontSize: 9, color: "#e53935" }} />
            </FlexWidget>
          )}
          <FlexWidget style={{ flex: 1 }} />
          <FlexWidget clickAction="REFRESH" style={{ padding: 2, paddingHorizontal: 4 }}>
            <TextWidget text="↻" style={{ fontSize: 16, color: "#e07b3c", fontWeight: "700" }} />
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ height: 6 }} />

        {/* 중앙 컨텐츠 */}
        <FlexWidget style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
          <FlexWidget style={{ alignItems: "center", width: 42 }}>
            <ImageWidget image={away.charImage} imageWidth={24} imageHeight={24} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={away.teamName} style={{ fontSize: 10, fontWeight: "700", color: away.nameColor }} />
          </FlexWidget>

          <FlexWidget style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            {head.isLive && (
              <FlexWidget style={{ alignItems: "center", marginBottom: 4 }}>
                <BaseSituation b1={data.base1} b2={data.base2} b3={data.base3} size={8} />
              </FlexWidget>
            )}
            <FlexWidget style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "center" }}>
              <FlexWidget style={{ alignItems: "center" }}>
                <TextWidget text={data.awayScore} style={{ fontSize: 20, fontWeight: "700", color: away.scoreColor }} />
                {head.isLive && <TextWidget text={away.pbText} style={{ fontSize: 8, color: DARK_FG }} />}
              </FlexWidget>
              <TextWidget text=" : " style={{ fontSize: 14, fontWeight: "700", color: alpha(DARK_FG, "44"), marginHorizontal: 4 }} />
              <FlexWidget style={{ alignItems: "center" }}>
                <TextWidget text={data.homeScore} style={{ fontSize: 20, fontWeight: "700", color: home.scoreColor }} />
                {head.isLive && <TextWidget text={home.pbText} style={{ fontSize: 8, color: DARK_FG }} />}
              </FlexWidget>
            </FlexWidget>
          </FlexWidget>

          <FlexWidget style={{ alignItems: "center", width: 42 }}>
            <ImageWidget image={home.charImage} imageWidth={24} imageHeight={24} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={home.teamName} style={{ fontSize: 10, fontWeight: "700", color: home.nameColor }} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </ColorBg>
  );
}

/* ─────────── 4. view4x2 (폭 >= 230, 높이 >= 80) ─────────── */
function view4x2(data: WidgetGameData) {
  const away = getTeamInfo(data, false);
  const home = getTeamInfo(data, true);
  const head = getHeaderInfo(data);

  return (
    <ColorBg>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 10, paddingHorizontal: 16, width: "match_parent" }}>
        {/* 상단 헤더: 매우 여유로움. 마름모를 헤더로 올려 중앙을 비움 */}
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", width: "match_parent" }}>
          <TextWidget text={head.statusText} style={{ fontSize: 13, fontWeight: "700", color: head.isLive ? "#e07b3c" : alpha(DARK_FG, "88") }} />
          {head.isLive && (
            <FlexWidget style={{ flexDirection: "row", alignItems: "center", marginLeft: 16 }}>
              <TextWidget text={"●".repeat(head.bCnt) + "○".repeat(3 - head.bCnt)} style={{ fontSize: 11, color: "#43a047" }} />
              <FlexWidget style={{ width: 5 }} />
              <TextWidget text={"●".repeat(head.sCnt) + "○".repeat(2 - head.sCnt)} style={{ fontSize: 11, color: "#f9a825" }} />
              <FlexWidget style={{ width: 5 }} />
              <TextWidget text={"●".repeat(head.oCnt) + "○".repeat(2 - head.oCnt)} style={{ fontSize: 11, color: "#e53935" }} />
              <FlexWidget style={{ width: 16 }} />
              <BaseSituation b1={data.base1} b2={data.base2} b3={data.base3} size={14} />
            </FlexWidget>
          )}
          <FlexWidget style={{ flex: 1 }} />
          <FlexWidget clickAction="REFRESH" style={{ padding: 4, paddingHorizontal: 8 }}>
            <TextWidget text="↻" style={{ fontSize: 22, color: "#e07b3c", fontWeight: "700" }} />
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ height: 10 }} />

        {/* 중앙 컨텐츠 */}
        <FlexWidget style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
          <FlexWidget style={{ alignItems: "center", width: 64 }}>
            <ImageWidget image={away.charImage} imageWidth={36} imageHeight={36} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={away.teamName} style={{ fontSize: 13, fontWeight: "700", color: away.nameColor }} />
          </FlexWidget>

          <FlexWidget style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <FlexWidget style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "center" }}>
              <FlexWidget style={{ alignItems: "center" }}>
                <TextWidget text={data.awayScore} style={{ fontSize: 32, fontWeight: "700", color: away.scoreColor }} />
                {head.isLive && <TextWidget text={away.pbText} style={{ fontSize: 10, color: DARK_FG }} />}
              </FlexWidget>
              <TextWidget text=" : " style={{ fontSize: 18, fontWeight: "700", color: alpha(DARK_FG, "44"), marginHorizontal: 12 }} />
              <FlexWidget style={{ alignItems: "center" }}>
                <TextWidget text={data.homeScore} style={{ fontSize: 32, fontWeight: "700", color: home.scoreColor }} />
                {head.isLive && <TextWidget text={home.pbText} style={{ fontSize: 10, color: DARK_FG }} />}
              </FlexWidget>
            </FlexWidget>
          </FlexWidget>

          <FlexWidget style={{ alignItems: "center", width: 64 }}>
            <ImageWidget image={home.charImage} imageWidth={36} imageHeight={36} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={home.teamName} style={{ fontSize: 13, fontWeight: "700", color: home.nameColor }} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </ColorBg>
  );
}
