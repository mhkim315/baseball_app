// @ts-nocheck
import { FlexWidget, TextWidget, ImageWidget } from "react-native-android-widget";
import { LOCAL_CHARACTERS } from "@/lib/characterAssets";
import type { CharacterEmotion } from "@/lib/emotions";

const WIDGET_BUILD = "OTA-v41-master-layouts";

export interface WidgetGameData {
  homeTeam: string;
  awayTeam: string;
  homeScore: string;
  awayScore: string;
  inning: string;
  isTop: string;
  status: string;
  time?: string;
  homeIsMyTeam: boolean;
  homeRank?: string;
  awayRank?: string;
  homeStreak?: string;
  awayStreak?: string;
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

const MONDAY_IMAGE = require("../assets/monday.png");
const DARK_FG = "#2a2a32";
const FG_93 = "#303038";
const FG_87 = "#3c3c44";
const FG_73 = "#56565e";
const FG_47 = "#7b7b83";

function alpha(hex: string, a: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const alphaVal = parseInt(a, 16) / 255;
  const br = Math.round(r * alphaVal + 0xf5 * (1 - alphaVal));
  const bg = Math.round(g * alphaVal + 0xf0 * (1 - alphaVal));
  const bb = Math.round(b * alphaVal + 0xeb * (1 - alphaVal));
  return `#${br.toString(16).padStart(2, "0")}${bg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`;
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

  const myScore = parseInt(isMyHome ? data.homeScore : data.awayScore, 10) || 0;
  const oppScore = parseInt(isMyHome ? data.awayScore : data.homeScore, 10) || 0;
  const diff = myScore - oppScore;

  if (data.status === "finished") {
    if (diff > 0) return "thumbs_up";
    if (diff === 0) return "neutral";
    return "crying";
  }

  // Live Game
  const inningNum = parseInt(data.inning || "1", 10);
  const oppHasChances = (isMyHome && data.isTop === "1") || (!isMyHome && data.isTop === "0");
  const myChances = (isMyHome && data.isTop === "0") || (!isMyHome && data.isTop === "1");
  const basesLoaded = data.base1 === "1" && data.base2 === "1" && data.base3 === "1";
  const scoringPosition = data.base2 === "1" || data.base3 === "1";

  if (diff === 0) {
    if (inningNum >= 10) return "sleepy";
    if (oppHasChances && basesLoaded) return "extream_shock";
    if (myChances && basesLoaded) return "in_love";
    if (inningNum >= 7) return "determined";
    return "default";
  }
  if (diff >= 5) return "mocking";
  if (diff >= 1 && diff <= 4) {
    if (oppHasChances && scoringPosition && diff <= 2) return "flustered";
    return "joyful";
  }
  if (diff <= -5) return "resigned_disgust";
  if (diff >= -4 && diff <= -1) {
    if (inningNum >= 9) return "praying";
    if (myChances && scoringPosition && diff >= -2) return "determined";
    return "sad";
  }
  return "default";
}

function getTeamInfo(data: WidgetGameData, isHome: boolean) {
  const isLive = data.status === "live";
  const isScheduled = data.status === "scheduled";
  
  const teamName = isHome ? data.homeTeam : data.awayTeam;
  const teamId = NAME_TO_TEAM_ID[teamName] || teamName.toLowerCase();
  
  const isMyHome = data.homeIsMyTeam;
  const emotion = computeWidgetEmotion(data, isHome);
  const charImage = LOCAL_CHARACTERS[`${teamId}_${emotion}`] || LOCAL_CHARACTERS[`${teamId}_default`] || LOCAL_CHARACTERS["doosan_default"];
  const nameColor = TEAM_NAME_COLOR[teamId] || DARK_FG;
  
  const isAttacking = isLive && (data.isTop === (isHome ? "0" : "1"));
  const scoreColor = isLive ? (isAttacking ? DARK_FG : alpha(DARK_FG, "55")) : DARK_FG;
  
  let pbText = "";
  if (isLive) {
    pbText = isAttacking 
      ? `B:${data.currentBatter || ""}` 
      : `P:${data.currentPitcher || (isHome ? data.homePitcher : data.awayPitcher) || ""}`;
  } else if (isScheduled) {
    const p = isHome ? data.homePitcher : data.awayPitcher;
    pbText = p || " ";
  }

  const scoreText = (isScheduled || data.status === "cancelled") ? " " : (isHome ? data.homeScore : data.awayScore);

  return { teamName, charImage, nameColor, scoreColor, pbText, scoreText };
}

function getHeaderInfo(data: WidgetGameData) {
  const isLive = data.status === "live";
  let statusText = "";
  if (data.status === "cancelled") statusText = "취소";
  else if (isLive) statusText = `${data.inning}회${data.isTop === "1" ? "초" : "말"}`;
  else if (data.status === "finished") statusText = "경기 종료";
  else statusText = data.stadium || "경기 전";

  const bCnt = Math.min(parseInt(data.ball || "0", 10), 3);
  const sCnt = Math.min(parseInt(data.strike || "0", 10), 2);
  const oCnt = Math.min(parseInt(data.out || "0", 10), 2);
  
  return { isLive, statusText, bCnt, sCnt, oCnt };
}

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
  const getColor = (occ?: string) => (occ && String(occ) !== "0") ? activeColor : inactiveColor;
  const diamondW = Math.round(size * 2.5);
  return (
    <FlexWidget style={{ alignItems: "center" }}>
      <TextWidget text={getBase(b2)} style={{ fontSize: size, color: getColor(b2), fontWeight: "700" }} />
      <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", width: diamondW }}>
        <TextWidget text={getBase(b3)} style={{ fontSize: size, color: getColor(b3), fontWeight: "700" }} />
        <TextWidget text={getBase(b1)} style={{ fontSize: size, color: getColor(b1), fontWeight: "700" }} />
      </FlexWidget>
    </FlexWidget>
  );
}

interface WidgetProps { width: number; height: number; data: WidgetGameData | null; myTeam: string; }

export function GameStatusWidget({ width, height, data, myTeam }: WidgetProps) {
  try {
    if (!data) return noGameView();
    if (width < 80) {
      return (
        <ColorBg>
          <FlexWidget style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <TextWidget text="지원 안함" style={{ fontSize: 10, color: DARK_FG }} />
          </FlexWidget>
        </ColorBg>
      );
    }
    if (height < 80) {
      if (width < 230) return view2x1(data);
      return view4x1(data);
    } else {
      if (width < 230) return view2x2(data);
      return view4x2(data);
    }
  } catch (e) {
    return (
      <FlexWidget style={{ width: "match_parent", height: "match_parent", backgroundColor: "#000", justifyContent: "center", alignItems: "center" }} clickAction="OPEN_APP">
        <TextWidget text="Error" style={{ fontSize: 14, color: "#FFF" }} />
      </FlexWidget>
    );
  }
}

function noGameView() {
  return (
    <ColorBg>
      <FlexWidget style={{ flexDirection: "row", width: "match_parent", padding: 12, justifyContent: "flex-end" }}>
        <FlexWidget clickAction="REFRESH" style={{ padding: 4 }}>
          <TextWidget text="↻" style={{ fontSize: 16, color: "#e07b3c", fontWeight: "700" }} />
        </FlexWidget>
      </FlexWidget>
      <FlexWidget style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ImageWidget image={MONDAY_IMAGE} imageWidth={44} imageHeight={44} />
        <FlexWidget style={{ height: 6 }} />
        <TextWidget text="오늘은 경기가 없어요" style={{ fontSize: 11, color: DARK_FG }} />
      </FlexWidget>
    </ColorBg>
  );
}

/* ─────────── 1. view2x1 (폭 < 230, 높이 < 80) ─────────── */
function view2x1(data: WidgetGameData) {
  const away = getTeamInfo(data, false);
  const home = getTeamInfo(data, true);
  const head = getHeaderInfo(data);
  const isScheduled = data.status === "scheduled";
  const isCancelled = data.status === "cancelled";
  const isFinished = data.status === "finished";

  if (isScheduled) {
    return (
      <ColorBg>
        <FlexWidget style={{ flex: 1, flexDirection: "column", justifyContent: "center", padding: 8, paddingHorizontal: 12 }}>
          <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "match_parent" }}>
            <TextWidget text={away.teamName} style={{ fontSize: 13, fontWeight: "700", color: away.nameColor }} />
            <TextWidget text={data.time || "VS"} style={{ fontSize: 20, fontWeight: "700", color: DARK_FG }} />
            <TextWidget text={home.teamName} style={{ fontSize: 13, fontWeight: "700", color: home.nameColor }} />
          </FlexWidget>
          <FlexWidget style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 4 }}>
            <TextWidget text={`${data.stadium || "오늘 경기"} ${data.weather ? data.weather.replace(/^[0-9.-]+°\s*/, "") : ""}`.trim()} style={{ fontSize: 10, color: FG_93 }} />
            <FlexWidget clickAction="REFRESH" style={{ paddingLeft: 6, paddingRight: 4, paddingVertical: 2 }}><TextWidget text="↻" style={{ fontSize: 12, color: "#e07b3c", fontWeight: "700" }} /></FlexWidget>
          </FlexWidget>
        </FlexWidget>
      </ColorBg>
    );
  }

  if (isFinished) {
    return (
      <ColorBg>
        <FlexWidget style={{ flex: 1, flexDirection: "column", justifyContent: "center", padding: 8, paddingHorizontal: 12 }}>
          <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "match_parent" }}>
            <TextWidget text={away.teamName} style={{ fontSize: 13, fontWeight: "700", color: away.nameColor }} />
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <TextWidget text={away.scoreText} style={{ fontSize: 20, fontWeight: "700", color: away.scoreColor }} />
              <FlexWidget style={{marginHorizontal: 4}}><TextWidget text=" : " style={{ fontSize: 14, color: FG_47 }} /></FlexWidget>
              <TextWidget text={home.scoreText} style={{ fontSize: 20, fontWeight: "700", color: home.scoreColor }} />
            </FlexWidget>
            <TextWidget text={home.teamName} style={{ fontSize: 13, fontWeight: "700", color: home.nameColor }} />
          </FlexWidget>
          <FlexWidget style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 4 }}>
            <TextWidget text="경기 종료" style={{ fontSize: 10, fontWeight: "700", color: DARK_FG }} />
            <FlexWidget clickAction="REFRESH" style={{ paddingLeft: 6, paddingRight: 4, paddingVertical: 2 }}><TextWidget text="↻" style={{ fontSize: 12, color: "#e07b3c", fontWeight: "700" }} /></FlexWidget>
          </FlexWidget>
        </FlexWidget>
      </ColorBg>
    );
  }

  return (
    <ColorBg>
      <FlexWidget style={{ flex: 1, flexDirection: "column", justifyContent: "space-between", padding: 8, paddingHorizontal: 12 }}>
        <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", width: "match_parent" }}>
          <TextWidget text={head.statusText} style={{ fontSize: 10, fontWeight: "700", color: head.isLive ? "#e07b3c" : FG_93 }} />
          <FlexWidget clickAction="REFRESH" style={{ padding: 2, paddingHorizontal: 4 }}>
            <TextWidget text="↻" style={{ fontSize: 12, color: "#e07b3c", fontWeight: "700" }} />
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", width: "match_parent" }}>
          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            <ImageWidget image={away.charImage} imageWidth={20} imageHeight={20} />
            <FlexWidget style={{ width: 4 }} />
            <TextWidget text={away.teamName} style={{ fontSize: 11, fontWeight: "700", color: away.nameColor }} />
          </FlexWidget>
          
          <FlexWidget style={{ marginHorizontal: 8, flexDirection: "row", alignItems: "center" }}>
            {isCancelled ? (
              <TextWidget text="취소" style={{ fontSize: 14, fontWeight: "700", color: DARK_FG }} />
            ) : (
              <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
                <TextWidget text={away.scoreText} style={{ fontSize: 20, fontWeight: "700", color: away.scoreColor }} />
                <FlexWidget style={{marginHorizontal: 4}}><TextWidget text=" : " style={{ fontSize: 14, color: FG_47 }} /></FlexWidget>
                <TextWidget text={home.scoreText} style={{ fontSize: 20, fontWeight: "700", color: home.scoreColor }} />
              </FlexWidget>
            )}
          </FlexWidget>

          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            <TextWidget text={home.teamName} style={{ fontSize: 11, fontWeight: "700", color: home.nameColor }} />
            <FlexWidget style={{ width: 4 }} />
            <ImageWidget image={home.charImage} imageWidth={20} imageHeight={20} />
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", width: "match_parent", height: 12 }}>
          {head.isLive ? (
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <TextWidget text={"●".repeat(head.bCnt) + "○".repeat(3 - head.bCnt)} style={{ fontSize: 7, color: "#43a047" }} />
              <FlexWidget style={{ width: 3 }} />
              <TextWidget text={"●".repeat(head.sCnt) + "○".repeat(2 - head.sCnt)} style={{ fontSize: 7, color: "#f9a825" }} />
              <FlexWidget style={{ width: 3 }} />
              <TextWidget text={"●".repeat(head.oCnt) + "○".repeat(2 - head.oCnt)} style={{ fontSize: 7, color: "#e53935" }} />
            </FlexWidget>
          ) : <FlexWidget />}
          
          {head.isLive ? (
            <BaseSituation b1={data.base1} b2={data.base2} b3={data.base3} size={8} />
          ) : <FlexWidget />}
        </FlexWidget>
      </FlexWidget>
    </ColorBg>
  );
}

/* ─────────── 2. view4x1 (3x1 포함, 폭 >= 230, 높이 < 80) ─────────── */
function view4x1(data: WidgetGameData) {
  const away = getTeamInfo(data, false);
  const home = getTeamInfo(data, true);
  const head = getHeaderInfo(data);
  const isScheduled = data.status === "scheduled";
  const isCancelled = data.status === "cancelled";
  const isFinished = data.status === "finished";

  if (isScheduled) {
    return (
      <ColorBg>
        <FlexWidget style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 8, paddingHorizontal: 24, width: "match_parent" }}>
          <FlexWidget style={{ alignItems: "center" }}>
            <ImageWidget image={away.charImage} imageWidth={32} imageHeight={32} />
            <FlexWidget style={{marginTop: 4}}><TextWidget text={away.pbText || away.teamName} style={{ fontSize: 11, fontWeight: "700", color: away.nameColor }} /></FlexWidget>
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center" }}>
            <FlexWidget style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
              <TextWidget text={`${data.stadium || "오늘 경기"} ${data.weather || ""}`.trim() || " "} style={{ fontSize: 10, fontWeight: "700", color: FG_93 }} />
              <FlexWidget clickAction="REFRESH" style={{ paddingLeft: 6, paddingRight: 4, paddingVertical: 2 }}><TextWidget text="↻" style={{ fontSize: 14, color: "#e07b3c", fontWeight: "700" }} /></FlexWidget>
            </FlexWidget>
            <TextWidget text={data.time || "VS"} style={{ fontSize: 24, fontWeight: "700", color: DARK_FG }} />
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center" }}>
            <ImageWidget image={home.charImage} imageWidth={32} imageHeight={32} />
            <FlexWidget style={{marginTop: 4}}><TextWidget text={home.pbText || home.teamName} style={{ fontSize: 11, fontWeight: "700", color: home.nameColor }} /></FlexWidget>
          </FlexWidget>
        </FlexWidget>
      </ColorBg>
    );
  }

  if (isFinished) {
    const awayWon = parseInt(data.awayScore) > parseInt(data.homeScore);
    const homeWon = parseInt(data.homeScore) > parseInt(data.awayScore);

    return (
      <ColorBg>
        <FlexWidget style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 8, paddingHorizontal: 24, width: "match_parent" }}>
          <FlexWidget style={{ alignItems: "center" }}>
            <ImageWidget image={away.charImage} imageWidth={32} imageHeight={32} />
            {awayWon ? <FlexWidget style={{marginTop: 2}}><TextWidget text="WIN" style={{ fontSize: 10, fontWeight: "700", color: "#d32f2f" }} /></FlexWidget> : <FlexWidget />}
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center" }}>
            <FlexWidget style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
              <TextWidget text="경기 종료" style={{ fontSize: 10, fontWeight: "700", color: DARK_FG }} />
              <FlexWidget clickAction="REFRESH" style={{ paddingLeft: 6, paddingRight: 4, paddingVertical: 2 }}><TextWidget text="↻" style={{ fontSize: 14, color: "#e07b3c", fontWeight: "700" }} /></FlexWidget>
            </FlexWidget>
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <TextWidget text={away.scoreText} style={{ fontSize: 24, fontWeight: "700", color: awayWon ? away.scoreColor : alpha(away.scoreColor, "77") }} />
              <FlexWidget style={{marginHorizontal: 4}}><TextWidget text=" : " style={{ fontSize: 16, color: FG_47 }} /></FlexWidget>
              <TextWidget text={home.scoreText} style={{ fontSize: 24, fontWeight: "700", color: homeWon ? home.scoreColor : alpha(home.scoreColor, "77") }} />
            </FlexWidget>
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center" }}>
            <ImageWidget image={home.charImage} imageWidth={32} imageHeight={32} />
            {homeWon ? <FlexWidget style={{marginTop: 2}}><TextWidget text="WIN" style={{ fontSize: 10, fontWeight: "700", color: "#d32f2f" }} /></FlexWidget> : <FlexWidget />}
          </FlexWidget>
        </FlexWidget>
      </ColorBg>
    );
  }

  return (
    <ColorBg>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 8, paddingHorizontal: 12, width: "match_parent" }}>
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", width: "match_parent" }}>
          <TextWidget text={head.isLive ? head.statusText : (`${data.stadium || "오늘 경기"} ${data.weather || ""}`.trim() || " ")} style={{ fontSize: 10, fontWeight: "700", color: head.isLive ? "#e07b3c" : FG_93 }} />
          {head.isLive ? (
            <FlexWidget style={{ flexDirection: "row", alignItems: "center", marginLeft: 8 }}>
              <TextWidget text={"●".repeat(head.bCnt) + "○".repeat(3 - head.bCnt)} style={{ fontSize: 8, color: "#43a047" }} />
              <FlexWidget style={{ width: 3 }} />
              <TextWidget text={"●".repeat(head.sCnt) + "○".repeat(2 - head.sCnt)} style={{ fontSize: 8, color: "#f9a825" }} />
              <FlexWidget style={{ width: 3 }} />
              <TextWidget text={"●".repeat(head.oCnt) + "○".repeat(2 - head.oCnt)} style={{ fontSize: 8, color: "#e53935" }} />
              <FlexWidget style={{ width: 10 }} />
              <BaseSituation b1={data.base1} b2={data.base2} b3={data.base3} size={9} />
            </FlexWidget>
          ) : <FlexWidget />}
          <FlexWidget style={{ flex: 1 }} />
          {head.isLive ? (
            <FlexWidget style={{ marginRight: 8 }}>
              <TextWidget text={`${data.stadium || ""} ${data.weather || ""}`.trim() || " "} style={{ fontSize: 10, color: FG_93 }} />
            </FlexWidget>
          ) : <FlexWidget />}
          <FlexWidget clickAction="REFRESH" style={{ padding: 2, paddingHorizontal: 4 }}>
            <TextWidget text="↻" style={{ fontSize: 14, color: "#e07b3c", fontWeight: "700" }} />
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            <ImageWidget image={away.charImage} imageWidth={28} imageHeight={28} />
            <FlexWidget style={{ width: 4 }} />
            <TextWidget text={away.teamName} style={{ fontSize: 12, fontWeight: "700", color: away.nameColor }} />
            <FlexWidget style={{ width: 4 }} />
            {away.pbText ? <TextWidget text={away.pbText} style={{ fontSize: 9, color: DARK_FG }} /> : <FlexWidget />}
          </FlexWidget>

          <FlexWidget style={{ marginHorizontal: 8, flexDirection: "row", alignItems: "center" }}>
            {isCancelled ? (
              <TextWidget text="우천 취소" style={{ fontSize: 14, fontWeight: "700", color: DARK_FG }} />
            ) : (
              <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
                <TextWidget text={away.scoreText} style={{ fontSize: 24, fontWeight: "700", color: away.scoreColor }} />
                <FlexWidget style={{marginHorizontal: 4}}><TextWidget text=" : " style={{ fontSize: 16, color: FG_47 }} /></FlexWidget>
                <TextWidget text={home.scoreText} style={{ fontSize: 24, fontWeight: "700", color: home.scoreColor }} />
              </FlexWidget>
            )}
          </FlexWidget>

          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            {home.pbText ? <TextWidget text={home.pbText} style={{ fontSize: 9, color: DARK_FG }} /> : <FlexWidget />}
            <FlexWidget style={{ width: 4 }} />
            <TextWidget text={home.teamName} style={{ fontSize: 12, fontWeight: "700", color: home.nameColor }} />
            <FlexWidget style={{ width: 4 }} />
            <ImageWidget image={home.charImage} imageWidth={28} imageHeight={28} />
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

  if (data.status === "scheduled") return view2x2Scheduled(data, away, home);
  if (data.status === "cancelled") return view2x2Cancelled(data, away, home);
  if (data.status === "finished") return view2x2Finished(data, away, home);
  return view2x2Live(data, away, home, head);
}

function view2x2Scheduled(data: WidgetGameData, away: ReturnType<typeof getTeamInfo>, home: ReturnType<typeof getTeamInfo>) {
  const weatherText = data.weather ? data.weather.replace(/^[0-9.-]+°\s*/, "") : "";
  const headerText = data.stadium ? (weatherText ? `${data.stadium} ${weatherText}` : data.stadium) : "오늘 경기";
  const hasRank = data.homeRank || data.awayRank;
  const hasStreak = data.homeStreak || data.awayStreak;
  const hasExtraInfo = hasRank || hasStreak;

  return (
    <ColorBg>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 10, width: "match_parent" }}>
        <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "match_parent" }}>
          <TextWidget text={headerText} style={{ fontSize: 11, fontWeight: "700", color: FG_87 }} />
          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            <TextWidget text={data.time || " "} style={{ fontSize: 11, fontWeight: "700", color: DARK_FG }} />
            <FlexWidget clickAction="REFRESH" style={{ padding: 2 }}>
              <TextWidget text="↻" style={{ fontSize: 14, color: "#e07b3c", fontWeight: "700" }} />
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ flex: 1 }} />

        <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", width: "match_parent", paddingHorizontal: 4, alignItems: "flex-start" }}>
          <FlexWidget style={{ alignItems: "center", flex: 1 }}>
            <ImageWidget image={away.charImage} imageWidth={48} imageHeight={48} />
            <FlexWidget style={{ height: 6 }} />
            <TextWidget text={away.teamName} style={{ fontSize: 13, fontWeight: "700", color: away.nameColor }} />
            <FlexWidget style={{ height: 4 }} />
            <TextWidget text={away.pbText || " "} style={{ fontSize: 10, color: DARK_FG }} />
          </FlexWidget>

          <FlexWidget style={{ alignItems: "center", width: 28, marginTop: 14 }}>
            <TextWidget text="VS" style={{ fontSize: 14, fontWeight: "700", color: FG_73 }} />
          </FlexWidget>

          <FlexWidget style={{ alignItems: "center", flex: 1 }}>
            <ImageWidget image={home.charImage} imageWidth={48} imageHeight={48} />
            <FlexWidget style={{ height: 6 }} />
            <TextWidget text={home.teamName} style={{ fontSize: 13, fontWeight: "700", color: home.nameColor }} />
            <FlexWidget style={{ height: 4 }} />
            <TextWidget text={home.pbText || " "} style={{ fontSize: 10, color: DARK_FG }} />
          </FlexWidget>
        </FlexWidget>

        {hasExtraInfo && (
          <FlexWidget style={{ flexDirection: "row", justifyContent: "space-around", width: "match_parent", marginTop: 8, paddingHorizontal: 4 }}>
            <FlexWidget style={{ alignItems: "center", flex: 1 }}>
              {data.awayRank ? <TextWidget text={`${data.awayRank}위`} style={{ fontSize: 11, fontWeight: "700", color: FG_87 }} /> : <FlexWidget style={{ height: 16 }} />}
              {data.awayStreak ? <TextWidget text={`최근 ${data.awayStreak}`} style={{ fontSize: 10, color: FG_73 }} /> : <FlexWidget style={{ height: 14 }} />}
            </FlexWidget>
            <FlexWidget style={{ width: 28 }} />
            <FlexWidget style={{ alignItems: "center", flex: 1 }}>
              {data.homeRank ? <TextWidget text={`${data.homeRank}위`} style={{ fontSize: 11, fontWeight: "700", color: FG_87 }} /> : <FlexWidget style={{ height: 16 }} />}
              {data.homeStreak ? <TextWidget text={`최근 ${data.homeStreak}`} style={{ fontSize: 10, color: FG_73 }} /> : <FlexWidget style={{ height: 14 }} />}
            </FlexWidget>
          </FlexWidget>
        )}

        <FlexWidget style={{ flex: 1 }} />
      </FlexWidget>
    </ColorBg>
  );
}

function view2x2Finished(data: WidgetGameData, away: ReturnType<typeof getTeamInfo>, home: ReturnType<typeof getTeamInfo>) {
  const awayWon = parseInt(data.awayScore) > parseInt(data.homeScore);
  const homeWon = parseInt(data.homeScore) > parseInt(data.awayScore);

  return (
    <ColorBg>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 10, width: "match_parent" }}>
        <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "match_parent" }}>
          <TextWidget text="경기 종료" style={{ fontSize: 11, fontWeight: "700", color: FG_87 }} />
          <FlexWidget clickAction="REFRESH" style={{ padding: 2 }}>
            <TextWidget text="↻" style={{ fontSize: 14, color: "#e07b3c", fontWeight: "700" }} />
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ flex: 1 }} />

        <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", width: "match_parent", paddingHorizontal: 4 }}>
          <FlexWidget style={{ alignItems: "center", flex: 1 }}>
            {awayWon ? <TextWidget text="WIN" style={{ fontSize: 10, fontWeight: "700", color: "#d32f2f" }} /> : <FlexWidget style={{ height: 14 }} />}
            <ImageWidget image={away.charImage} imageWidth={40} imageHeight={40} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={away.teamName} style={{ fontSize: 12, fontWeight: "700", color: away.nameColor }} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={data.awayScore} style={{ fontSize: 28, fontWeight: "700", color: awayWon ? away.scoreColor : alpha(away.scoreColor, "77") }} />
          </FlexWidget>

          <FlexWidget style={{ width: 24, alignItems: "center", justifyContent: "flex-start" }}>
            <FlexWidget style={{ height: 78 }} />
            <TextWidget text=":" style={{ fontSize: 22, fontWeight: "700", color: FG_73 }} />
          </FlexWidget>

          <FlexWidget style={{ alignItems: "center", flex: 1 }}>
            {homeWon ? <TextWidget text="WIN" style={{ fontSize: 10, fontWeight: "700", color: "#d32f2f" }} /> : <FlexWidget style={{ height: 14 }} />}
            <ImageWidget image={home.charImage} imageWidth={40} imageHeight={40} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={home.teamName} style={{ fontSize: 12, fontWeight: "700", color: home.nameColor }} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={data.homeScore} style={{ fontSize: 28, fontWeight: "700", color: homeWon ? home.scoreColor : alpha(home.scoreColor, "77") }} />
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", width: "match_parent", marginTop: 4 }}>
          <TextWidget text={`${awayWon ? "승" : "패"}: ${data.awayPitcher || "-"}`} style={{ fontSize: 9, color: DARK_FG }} />
          <TextWidget text={`${homeWon ? "승" : "패"}: ${data.homePitcher || "-"}`} style={{ fontSize: 9, color: DARK_FG }} />
        </FlexWidget>
        <FlexWidget style={{ flexDirection: "row", justifyContent: "flex-end", width: "match_parent", marginTop: 6 }}>
          <TextWidget text="경기 기록하기 ↵" style={{ fontSize: 9, color: "#e07b3c", fontWeight: "600" }} />
        </FlexWidget>

        <FlexWidget style={{ flex: 1 }} />
      </FlexWidget>
    </ColorBg>
  );
}

function view2x2Cancelled(data: WidgetGameData, away: ReturnType<typeof getTeamInfo>, home: ReturnType<typeof getTeamInfo>) {
  const weatherText = data.weather ? data.weather.replace(/^[0-9.-]+°\s*/, "") : "";
  const headerText = data.stadium ? (weatherText ? `${data.stadium} ${weatherText}` : data.stadium) : "오늘 경기";

  return (
    <ColorBg>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 10, width: "match_parent" }}>
        <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "match_parent" }}>
          <TextWidget text={headerText} style={{ fontSize: 11, fontWeight: "700", color: FG_87 }} />
          <FlexWidget clickAction="REFRESH" style={{ padding: 2 }}>
            <TextWidget text="↻" style={{ fontSize: 14, color: "#e07b3c", fontWeight: "700" }} />
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "match_parent", paddingHorizontal: 4 }}>
          <FlexWidget style={{ alignItems: "center", flex: 1 }}>
            <ImageWidget image={away.charImage} imageWidth={48} imageHeight={48} />
            <FlexWidget style={{ height: 4 }} />
            <TextWidget text={away.teamName} style={{ fontSize: 13, fontWeight: "700", color: away.nameColor }} />
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center", width: 40 }}>
            <TextWidget text="우천" style={{ fontSize: 12, fontWeight: "700", color: DARK_FG }} />
            <TextWidget text="취소" style={{ fontSize: 12, fontWeight: "700", color: DARK_FG }} />
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center", flex: 1 }}>
            <ImageWidget image={home.charImage} imageWidth={48} imageHeight={48} />
            <FlexWidget style={{ height: 4 }} />
            <TextWidget text={home.teamName} style={{ fontSize: 13, fontWeight: "700", color: home.nameColor }} />
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ flex: 1 }} />
      </FlexWidget>
    </ColorBg>
  );
}

function view2x2Live(data: WidgetGameData, away: ReturnType<typeof getTeamInfo>, home: ReturnType<typeof getTeamInfo>, head: ReturnType<typeof getHeaderInfo>) {
  const weatherText = data.weather ? data.weather.replace(/^[0-9.-]+°\s*/, "") : "";
  const locationText = data.stadium ? (weatherText ? `${data.stadium} ${weatherText}` : data.stadium) : "오늘 경기";

  return (
    <ColorBg>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 10, width: "match_parent" }}>
        <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "match_parent" }}>
          <TextWidget text={locationText} style={{ fontSize: 11, fontWeight: "700", color: FG_93 }} />
          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            <TextWidget text={head.statusText} style={{ fontSize: 11, fontWeight: "700", color: "#e07b3c" }} />
            <FlexWidget clickAction="REFRESH" style={{ padding: 2 }}>
              <TextWidget text="↻" style={{ fontSize: 14, color: "#e07b3c", fontWeight: "700" }} />
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", width: "match_parent" }}>
          <TextWidget text={"B:" + "●".repeat(head.bCnt) + "○".repeat(3 - head.bCnt)} style={{ fontSize: 11, color: "#43a047" }} />
          <FlexWidget style={{ width: 6 }} />
          <TextWidget text={"S:" + "●".repeat(head.sCnt) + "○".repeat(2 - head.sCnt)} style={{ fontSize: 11, color: "#f9a825" }} />
          <FlexWidget style={{ width: 6 }} />
          <TextWidget text={"O:" + "●".repeat(head.oCnt) + "○".repeat(2 - head.oCnt)} style={{ fontSize: 11, color: "#e53935" }} />
        </FlexWidget>
        <FlexWidget style={{ alignItems: "center", justifyContent: "center", width: "match_parent" }}>
          <BaseSituation b1={data.base1} b2={data.base2} b3={data.base3} size={13} />
        </FlexWidget>

        <FlexWidget style={{ flex: 1 }} />

        <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", width: "match_parent", paddingHorizontal: 4 }}>
          <FlexWidget style={{ alignItems: "center", flex: 1 }}>
            <ImageWidget image={away.charImage} imageWidth={40} imageHeight={40} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={data.awayScore} style={{ fontSize: 30, fontWeight: "700", color: away.scoreColor }} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={away.teamName} style={{ fontSize: 12, fontWeight: "700", color: away.nameColor }} />
            {away.pbText ? <FlexWidget style={{ height: 2 }} /> : null}
            {away.pbText ? <TextWidget text={away.pbText} style={{ fontSize: 9, color: DARK_FG }} /> : null}
          </FlexWidget>

          <FlexWidget style={{ alignItems: "center", justifyContent: "center" }}>
            <FlexWidget style={{ height: 42 }} />
            <TextWidget text=":" style={{ fontSize: 18, fontWeight: "700", color: FG_73 }} />
          </FlexWidget>

          <FlexWidget style={{ alignItems: "center", flex: 1 }}>
            <ImageWidget image={home.charImage} imageWidth={40} imageHeight={40} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={data.homeScore} style={{ fontSize: 30, fontWeight: "700", color: home.scoreColor }} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={home.teamName} style={{ fontSize: 12, fontWeight: "700", color: home.nameColor }} />
            {home.pbText ? <FlexWidget style={{ height: 2 }} /> : null}
            {home.pbText ? <TextWidget text={home.pbText} style={{ fontSize: 9, color: DARK_FG }} /> : null}
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ flex: 1 }} />
      </FlexWidget>
    </ColorBg>
  );
}


/* ─────────── 4. view4x2 (폭 >= 230, 높이 >= 80) ─────────── */
function view4x2(data: WidgetGameData) {
  const away = getTeamInfo(data, false);
  const home = getTeamInfo(data, true);
  const head = getHeaderInfo(data);
  const isScheduled = data.status === "scheduled";
  const isCancelled = data.status === "cancelled";
  const isFinished = data.status === "finished";

  if (isCancelled) {
    return (
      <ColorBg>
        <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 16, paddingHorizontal: 24, width: "match_parent" }}>
          <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
            <TextWidget text={`${data.stadium || "오늘 경기"} ${data.weather || ""}`.trim() || " "} style={{ fontSize: 13, fontWeight: "700", color: FG_87 }} />
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <TextWidget text="우천 취소" style={{ fontSize: 14, fontWeight: "700", color: FG_87 }} />
              <FlexWidget clickAction="REFRESH" style={{ paddingLeft: 8, paddingVertical: 2 }}><TextWidget text="↻" style={{ fontSize: 18, color: "#e07b3c", fontWeight: "700" }} /></FlexWidget>
            </FlexWidget>
          </FlexWidget>

          <FlexWidget style={{ flex: 1 }} />

          <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
            <FlexWidget style={{ alignItems: "center", width: 100 }}>
              <ImageWidget image={away.charImage} imageWidth={56} imageHeight={56} />
              <FlexWidget style={{ height: 8 }} />
              <TextWidget text={away.teamName} style={{ fontSize: 16, fontWeight: "700", color: away.nameColor }} />
            </FlexWidget>

            <FlexWidget style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <TextWidget text="취소" style={{ fontSize: 24, fontWeight: "700", color: FG_47 }} />
            </FlexWidget>

            <FlexWidget style={{ alignItems: "center", width: 100 }}>
              <ImageWidget image={home.charImage} imageWidth={56} imageHeight={56} />
              <FlexWidget style={{ height: 8 }} />
              <TextWidget text={home.teamName} style={{ fontSize: 16, fontWeight: "700", color: home.nameColor }} />
            </FlexWidget>
          </FlexWidget>

          <FlexWidget style={{ flex: 1 }} />
        </FlexWidget>
      </ColorBg>
    );
  }

  if (isScheduled) {
    return (
      <ColorBg>
        <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 16, paddingHorizontal: 24, width: "match_parent" }}>
          <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
            <TextWidget text={`${data.stadium || "오늘 경기"} ${data.weather || ""}`.trim() || " "} style={{ fontSize: 13, fontWeight: "700", color: FG_93 }} />
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <TextWidget text={data.time || " "} style={{ fontSize: 13, fontWeight: "700", color: DARK_FG }} />
              <FlexWidget clickAction="REFRESH" style={{ paddingLeft: 8, paddingVertical: 2 }}><TextWidget text="↻" style={{ fontSize: 18, color: "#e07b3c", fontWeight: "700" }} /></FlexWidget>
            </FlexWidget>
          </FlexWidget>

          <FlexWidget style={{ flex: 1 }} />

          <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
            <FlexWidget style={{ alignItems: "center", width: 100 }}>
              {data.awayRank ? (
                <FlexWidget style={{ alignItems: "center", marginBottom: 6 }}>
                  <TextWidget text={`${data.awayRank}위`} style={{ fontSize: 11, fontWeight: "700", color: FG_93 }} />
                  {data.awayStreak ? <FlexWidget style={{ marginTop: 2 }}><TextWidget text={data.awayStreak.startsWith("최근") ? data.awayStreak : `최근 ${data.awayStreak}`} style={{ fontSize: 11, color: FG_93 }} /></FlexWidget> : <FlexWidget />}
                </FlexWidget>
              ) : <FlexWidget />}
              <ImageWidget image={away.charImage} imageWidth={56} imageHeight={56} />
              <FlexWidget style={{ height: 8 }} />
              <TextWidget text={away.teamName} style={{ fontSize: 16, fontWeight: "700", color: away.nameColor }} />
              {away.pbText ? <FlexWidget style={{marginTop: 4}}><TextWidget text={away.pbText} style={{ fontSize: 12, color: DARK_FG }} /></FlexWidget> : <FlexWidget />}
            </FlexWidget>

            <FlexWidget style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <FlexWidget style={{marginBottom: 4}}><TextWidget text="경기 전" style={{ fontSize: 14, fontWeight: "700", color: FG_93 }} /></FlexWidget>
              <TextWidget text="VS" style={{ fontSize: 28, fontWeight: "700", color: FG_47 }} />
            </FlexWidget>

            <FlexWidget style={{ alignItems: "center", width: 100 }}>
              {data.homeRank ? (
                <FlexWidget style={{ alignItems: "center", marginBottom: 6 }}>
                  <TextWidget text={`${data.homeRank}위`} style={{ fontSize: 11, fontWeight: "700", color: FG_93 }} />
                  {data.homeStreak ? <FlexWidget style={{ marginTop: 2 }}><TextWidget text={data.homeStreak.startsWith("최근") ? data.homeStreak : `최근 ${data.homeStreak}`} style={{ fontSize: 11, color: FG_93 }} /></FlexWidget> : <FlexWidget />}
                </FlexWidget>
              ) : <FlexWidget />}
              <ImageWidget image={home.charImage} imageWidth={56} imageHeight={56} />
              <FlexWidget style={{ height: 8 }} />
              <TextWidget text={home.teamName} style={{ fontSize: 16, fontWeight: "700", color: home.nameColor }} />
              {home.pbText ? <FlexWidget style={{marginTop: 4}}><TextWidget text={home.pbText} style={{ fontSize: 12, color: DARK_FG }} /></FlexWidget> : <FlexWidget />}
            </FlexWidget>
          </FlexWidget>

          <FlexWidget style={{ flex: 1 }} />
        </FlexWidget>
      </ColorBg>
    );
  }

  if (isFinished) {
    const awayWon = parseInt(data.awayScore) > parseInt(data.homeScore);
    const homeWon = parseInt(data.homeScore) > parseInt(data.awayScore);

    return (
      <ColorBg>
        <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 16, paddingHorizontal: 24, width: "match_parent" }}>
          <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
            <TextWidget text={`${data.stadium || "오늘 경기"} ${data.weather || ""}`.trim() || " "} style={{ fontSize: 13, fontWeight: "700", color: FG_87 }} />
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <TextWidget text="경기 종료" style={{ fontSize: 14, fontWeight: "700", color: FG_87 }} />
              <FlexWidget clickAction="REFRESH" style={{ paddingLeft: 8, paddingVertical: 2 }}><TextWidget text="↻" style={{ fontSize: 18, color: "#e07b3c", fontWeight: "700" }} /></FlexWidget>
            </FlexWidget>
          </FlexWidget>

          <FlexWidget style={{ flex: 1 }} />

          <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
            <FlexWidget style={{ alignItems: "center", width: 100 }}>
              {awayWon ? <TextWidget text="WIN" style={{ fontSize: 13, fontWeight: "700", color: "#d32f2f" }} /> : <FlexWidget style={{ height: 18 }} />}
              <ImageWidget image={away.charImage} imageWidth={52} imageHeight={52} />
              <FlexWidget style={{ height: 6 }} />
              <TextWidget text={away.teamName} style={{ fontSize: 15, fontWeight: "700", color: away.nameColor }} />
              <FlexWidget style={{ height: 4 }} />
              <TextWidget text={`${awayWon ? "승" : "패"}: ${data.awayPitcher || "-"}`} style={{ fontSize: 11, color: DARK_FG }} />
            </FlexWidget>

            <FlexWidget style={{ flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "row" }}>
                <TextWidget text={away.scoreText} style={{ fontSize: 32, fontWeight: "700", color: awayWon ? away.scoreColor : alpha(away.scoreColor, "99") }} />
                <FlexWidget style={{marginHorizontal: 10}}><TextWidget text=" : " style={{ fontSize: 20, fontWeight: "700", color: FG_73 }} /></FlexWidget>
                <TextWidget text={home.scoreText} style={{ fontSize: 32, fontWeight: "700", color: homeWon ? home.scoreColor : alpha(home.scoreColor, "99") }} />
            </FlexWidget>

            <FlexWidget style={{ alignItems: "center", width: 100 }}>
              {homeWon ? <TextWidget text="WIN" style={{ fontSize: 13, fontWeight: "700", color: "#d32f2f" }} /> : <FlexWidget style={{ height: 18 }} />}
              <ImageWidget image={home.charImage} imageWidth={52} imageHeight={52} />
              <FlexWidget style={{ height: 6 }} />
              <TextWidget text={home.teamName} style={{ fontSize: 15, fontWeight: "700", color: home.nameColor }} />
              <FlexWidget style={{ height: 4 }} />
              <TextWidget text={`${homeWon ? "승" : "패"}: ${data.homePitcher || "-"}`} style={{ fontSize: 11, color: DARK_FG }} />
            </FlexWidget>
          </FlexWidget>

          <FlexWidget style={{ flexDirection: "row", justifyContent: "flex-end", width: "match_parent", marginTop: 6 }}>
            <TextWidget text="오늘 경기 기록하기 ↵" style={{ fontSize: 10, color: "#e07b3c", fontWeight: "600" }} />
          </FlexWidget>

          <FlexWidget style={{ flex: 1 }} />
        </FlexWidget>
      </ColorBg>
    );
  }

  // ── LIVE ──
  const locationText = data.stadium ? (data.weather ? `${data.stadium} ${data.weather}` : data.stadium) : "오늘 경기";

  return (
    <ColorBg>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 12, paddingHorizontal: 20, width: "match_parent" }}>
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", width: "match_parent", justifyContent: "space-between" }}>
          <TextWidget text={locationText} style={{ fontSize: 13, fontWeight: "700", color: FG_93 }} />
          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            <TextWidget text={head.statusText} style={{ fontSize: 13, fontWeight: "700", color: "#e07b3c" }} />
            <FlexWidget clickAction="REFRESH" style={{ paddingLeft: 8, paddingVertical: 4 }}>
              <TextWidget text="↻" style={{ fontSize: 20, color: "#e07b3c", fontWeight: "700" }} />
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ flex: 1 }} />

        {/* Row: Rank/Streak + BSO vertical + Base */}
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
          {/* Away rank/streak */}
          <FlexWidget style={{ alignItems: "center", width: 72 }}>
            {data.awayRank ? <TextWidget text={`${data.awayRank}위`} style={{ fontSize: 11, fontWeight: "700", color: FG_93 }} /> : <FlexWidget style={{ height: 16 }} />}
            {data.awayStreak ? <FlexWidget style={{ marginTop: 2 }}><TextWidget text={`최근 ${data.awayStreak}`} style={{ fontSize: 10, color: FG_93 }} /></FlexWidget> : <FlexWidget style={{ height: 14 }} />}
          </FlexWidget>

          {/* Center: BSO when fresh, spacer otherwise */}
          <FlexWidget style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
            <FlexWidget style={{ alignItems: "flex-start" }}>
              <TextWidget text={"B:" + "●".repeat(head.bCnt) + "○".repeat(3 - head.bCnt)} style={{ fontSize: 12, color: "#43a047" }} />
              <TextWidget text={"S:" + "●".repeat(head.sCnt) + "○".repeat(2 - head.sCnt)} style={{ fontSize: 12, color: "#f9a825" }} />
              <TextWidget text={"O:" + "●".repeat(head.oCnt) + "○".repeat(2 - head.oCnt)} style={{ fontSize: 12, color: "#e53935" }} />
            </FlexWidget>
            <FlexWidget style={{ width: 16 }} />
            <BaseSituation b1={data.base1} b2={data.base2} b3={data.base3} size={15} />
          </FlexWidget>

          {/* Home rank/streak */}
          <FlexWidget style={{ alignItems: "center", width: 72 }}>
            {data.homeRank ? <TextWidget text={`${data.homeRank}위`} style={{ fontSize: 11, fontWeight: "700", color: FG_93 }} /> : <FlexWidget style={{ height: 16 }} />}
            {data.homeStreak ? <FlexWidget style={{ marginTop: 2 }}><TextWidget text={`최근 ${data.homeStreak}`} style={{ fontSize: 10, color: FG_93 }} /></FlexWidget> : <FlexWidget style={{ height: 14 }} />}
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ height: 8 }} />

        {/* Row: Characters + Scores */}
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
          <FlexWidget style={{ alignItems: "center", width: 72 }}>
            <ImageWidget image={away.charImage} imageWidth={48} imageHeight={48} />
            <FlexWidget style={{ height: 4 }} />
            <TextWidget text={away.teamName} style={{ fontSize: 15, fontWeight: "700", color: away.nameColor }} />
            {away.pbText ? <FlexWidget style={{marginTop: 4}}><TextWidget text={away.pbText} style={{ fontSize: 11, color: DARK_FG }} /></FlexWidget> : <FlexWidget style={{ height: 16 }} />}
          </FlexWidget>

          <FlexWidget style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
              <TextWidget text={away.scoreText} style={{ fontSize: 34, fontWeight: "700", color: away.scoreColor }} />
              <FlexWidget style={{marginHorizontal: 8}}><TextWidget text=" : " style={{ fontSize: 22, fontWeight: "700", color: FG_73 }} /></FlexWidget>
              <TextWidget text={home.scoreText} style={{ fontSize: 34, fontWeight: "700", color: home.scoreColor }} />
            </FlexWidget>
          </FlexWidget>

          <FlexWidget style={{ alignItems: "center", width: 72 }}>
            <ImageWidget image={home.charImage} imageWidth={48} imageHeight={48} />
            <FlexWidget style={{ height: 4 }} />
            <TextWidget text={home.teamName} style={{ fontSize: 15, fontWeight: "700", color: home.nameColor }} />
            {home.pbText ? <FlexWidget style={{marginTop: 4}}><TextWidget text={home.pbText} style={{ fontSize: 11, color: DARK_FG }} /></FlexWidget> : <FlexWidget style={{ height: 16 }} />}
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ flex: 1 }} />
      </FlexWidget>
    </ColorBg>
  );
}
