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
  const isMyTeam = isHome ? isMyHome : !isMyHome;
  const emotion = computeWidgetEmotion(data, isMyTeam);
  const charImage = LOCAL_CHARACTERS[`${teamId}_${emotion}`] || LOCAL_CHARACTERS[`${teamId}_default`];
  const nameColor = TEAM_NAME_COLOR[teamId] || DARK_FG;
  
  const isAttacking = isLive && (data.isTop === (isHome ? "0" : "1"));
  const scoreColor = isLive ? (isAttacking ? DARK_FG : alpha(DARK_FG, "55")) : DARK_FG;
  
  let pbText = "";
  if (isLive) {
    pbText = isAttacking 
      ? `B:${data.currentBatter || ""}` 
      : `P:${data.currentPitcher || (isHome ? data.homePitcher : data.awayPitcher) || ""}`;
  } else if (isScheduled) {
    pbText = `${isHome ? data.homePitcher || "?" : data.awayPitcher || "?"}`;
  }

  const scoreText = (isScheduled || data.status === "cancelled") ? "" : (isHome ? data.homeScore : data.awayScore);

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
      <FlexWidget style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <TextWidget text="오늘 경기 없음" style={{ fontSize: 13, color: DARK_FG }} />
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
            <TextWidget text={`${data.stadium || "오늘 경기"} ${data.weather ? data.weather.replace(/^[0-9.-]+°\s*/, "") : ""}`.trim()} style={{ fontSize: 10, color: alpha(DARK_FG, "88") }} />
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
              <FlexWidget style={{marginHorizontal: 4}}><TextWidget text=" : " style={{ fontSize: 14, color: alpha(DARK_FG, "44") }} /></FlexWidget>
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
          <TextWidget text={head.statusText} style={{ fontSize: 10, fontWeight: "700", color: head.isLive ? "#e07b3c" : alpha(DARK_FG, "88") }} />
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
              <>
                <TextWidget text={away.scoreText} style={{ fontSize: 20, fontWeight: "700", color: away.scoreColor }} />
                <FlexWidget style={{marginHorizontal: 4}}><TextWidget text=" : " style={{ fontSize: 14, color: alpha(DARK_FG, "44") }} /></FlexWidget>
                <TextWidget text={home.scoreText} style={{ fontSize: 20, fontWeight: "700", color: home.scoreColor }} />
              </>
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
              <TextWidget text={`${data.stadium || "오늘 경기"} ${data.weather || ""}`.trim()} style={{ fontSize: 10, fontWeight: "700", color: alpha(DARK_FG, "88") }} />
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
            {awayWon && <FlexWidget style={{marginTop: 2}}><TextWidget text="WIN" style={{ fontSize: 10, fontWeight: "700", color: "#d32f2f" }} /></FlexWidget>}
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center" }}>
            <FlexWidget style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
              <TextWidget text="경기 종료" style={{ fontSize: 10, fontWeight: "700", color: DARK_FG }} />
              <FlexWidget clickAction="REFRESH" style={{ paddingLeft: 6, paddingRight: 4, paddingVertical: 2 }}><TextWidget text="↻" style={{ fontSize: 14, color: "#e07b3c", fontWeight: "700" }} /></FlexWidget>
            </FlexWidget>
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <TextWidget text={away.scoreText} style={{ fontSize: 24, fontWeight: "700", color: awayWon ? away.scoreColor : alpha(away.scoreColor, "77") }} />
              <FlexWidget style={{marginHorizontal: 4}}><TextWidget text=" : " style={{ fontSize: 16, color: alpha(DARK_FG, "44") }} /></FlexWidget>
              <TextWidget text={home.scoreText} style={{ fontSize: 24, fontWeight: "700", color: homeWon ? home.scoreColor : alpha(home.scoreColor, "77") }} />
            </FlexWidget>
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center" }}>
            <ImageWidget image={home.charImage} imageWidth={32} imageHeight={32} />
            {homeWon && <FlexWidget style={{marginTop: 2}}><TextWidget text="WIN" style={{ fontSize: 10, fontWeight: "700", color: "#d32f2f" }} /></FlexWidget>}
          </FlexWidget>
        </FlexWidget>
      </ColorBg>
    );
  }

  return (
    <ColorBg>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 8, paddingHorizontal: 12, width: "match_parent" }}>
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", width: "match_parent" }}>
          <TextWidget text={head.isLive ? head.statusText : `${data.stadium || "오늘 경기"} ${data.weather || ""}`.trim()} style={{ fontSize: 10, fontWeight: "700", color: head.isLive ? "#e07b3c" : alpha(DARK_FG, "88") }} />
          {head.isLive && (
            <FlexWidget style={{ flexDirection: "row", alignItems: "center", marginLeft: 8 }}>
              <TextWidget text={"●".repeat(head.bCnt) + "○".repeat(3 - head.bCnt)} style={{ fontSize: 8, color: "#43a047" }} />
              <FlexWidget style={{ width: 3 }} />
              <TextWidget text={"●".repeat(head.sCnt) + "○".repeat(2 - head.sCnt)} style={{ fontSize: 8, color: "#f9a825" }} />
              <FlexWidget style={{ width: 3 }} />
              <TextWidget text={"●".repeat(head.oCnt) + "○".repeat(2 - head.oCnt)} style={{ fontSize: 8, color: "#e53935" }} />
              <FlexWidget style={{ width: 10 }} />
              <BaseSituation b1={data.base1} b2={data.base2} b3={data.base3} size={9} />
            </FlexWidget>
          )}
          <FlexWidget style={{ flex: 1 }} />
          {head.isLive && (
            <FlexWidget style={{ marginRight: 8 }}>
              <TextWidget text={`${data.stadium || ""} ${data.weather || ""}`.trim()} style={{ fontSize: 10, color: alpha(DARK_FG, "88") }} />
            </FlexWidget>
          )}
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
              <>
                <TextWidget text={away.scoreText} style={{ fontSize: 24, fontWeight: "700", color: away.scoreColor }} />
                <FlexWidget style={{marginHorizontal: 4}}><TextWidget text=" : " style={{ fontSize: 16, color: alpha(DARK_FG, "44") }} /></FlexWidget>
                <TextWidget text={home.scoreText} style={{ fontSize: 24, fontWeight: "700", color: home.scoreColor }} />
              </>
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
  const isScheduled = data.status === "scheduled";
  const isCancelled = data.status === "cancelled";
  const isFinished = data.status === "finished";

  if (isScheduled) {
    return (
      <ColorBg>
        <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 12, justifyContent: "space-between", width: "match_parent" }}>
          <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "match_parent" }}>
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <TextWidget text={`${data.stadium || "오늘 경기"} ${data.weather ? data.weather.replace(/^[0-9.-]+°\s*/, "") : ""}`.trim()} style={{ fontSize: 11, fontWeight: "700", color: alpha(DARK_FG, "88") }} />
              <FlexWidget clickAction="REFRESH" style={{ paddingLeft: 6, paddingRight: 4, paddingVertical: 2 }}><TextWidget text="↻" style={{ fontSize: 14, color: "#e07b3c", fontWeight: "700" }} /></FlexWidget>
            </FlexWidget>
            <TextWidget text={data.time || "VS"} style={{ fontSize: 14, fontWeight: "700", color: DARK_FG }} />
          </FlexWidget>

          <FlexWidget style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", width: "match_parent", paddingHorizontal: 12 }}>
            <FlexWidget style={{ alignItems: "center" }}>
              <ImageWidget image={away.charImage} imageWidth={40} imageHeight={40} />
            </FlexWidget>
            <FlexWidget style={{ marginBottom: 10 }}><TextWidget text="VS" style={{ fontSize: 16, fontWeight: "700", color: alpha(DARK_FG, "55") }} /></FlexWidget>
            <FlexWidget style={{ alignItems: "center" }}>
              <ImageWidget image={home.charImage} imageWidth={40} imageHeight={40} />
            </FlexWidget>
          </FlexWidget>

          <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", width: "match_parent", marginTop: 4 }}>
            <FlexWidget style={{ alignItems: "center", width: 60 }}>
              <TextWidget text={away.teamName} style={{ fontSize: 13, fontWeight: "700", color: away.nameColor }} />
              {away.pbText && <FlexWidget style={{marginTop: 4}}><TextWidget text={away.pbText} style={{ fontSize: 10, color: DARK_FG }} /></FlexWidget>}
            </FlexWidget>
            <FlexWidget style={{ alignItems: "center", width: 60 }}>
              <TextWidget text={home.teamName} style={{ fontSize: 13, fontWeight: "700", color: home.nameColor }} />
              {home.pbText && <FlexWidget style={{marginTop: 4}}><TextWidget text={home.pbText} style={{ fontSize: 10, color: DARK_FG }} /></FlexWidget>}
            </FlexWidget>
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
        <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 12, justifyContent: "space-between", width: "match_parent" }}>
          <FlexWidget style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", width: "match_parent", marginBottom: 8 }}>
            <TextWidget text="경기 종료" style={{ fontSize: 12, fontWeight: "700", color: alpha(DARK_FG, "88") }} />
            <FlexWidget clickAction="REFRESH" style={{ paddingLeft: 6, paddingRight: 4, paddingVertical: 2 }}><TextWidget text="↻" style={{ fontSize: 14, color: "#e07b3c", fontWeight: "700" }} /></FlexWidget>
          </FlexWidget>

          <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
            <FlexWidget style={{ alignItems: "center", flex: 1 }}>
              <FlexWidget style={{marginBottom: 4}}><TextWidget text={away.teamName} style={{ fontSize: 12, fontWeight: "700", color: away.nameColor }} /></FlexWidget>
              <TextWidget text={away.scoreText} style={{ fontSize: 32, fontWeight: "700", color: awayWon ? away.scoreColor : alpha(away.scoreColor, "77") }} />
              {awayWon && <FlexWidget style={{marginTop: 4}}><TextWidget text="WIN" style={{ fontSize: 10, fontWeight: "700", color: "#d32f2f" }} /></FlexWidget>}
            </FlexWidget>

            <TextWidget text=" : " style={{ fontSize: 16, color: alpha(DARK_FG, "44") }} />

            <FlexWidget style={{ alignItems: "center", flex: 1 }}>
              <FlexWidget style={{marginBottom: 4}}><TextWidget text={home.teamName} style={{ fontSize: 12, fontWeight: "700", color: home.nameColor }} /></FlexWidget>
              <TextWidget text={home.scoreText} style={{ fontSize: 32, fontWeight: "700", color: homeWon ? home.scoreColor : alpha(home.scoreColor, "77") }} />
              {homeWon && <FlexWidget style={{marginTop: 4}}><TextWidget text="WIN" style={{ fontSize: 10, fontWeight: "700", color: "#d32f2f" }} /></FlexWidget>}
            </FlexWidget>
          </FlexWidget>
          
          <FlexWidget style={{ flex: 1 }} />
        </FlexWidget>
      </ColorBg>
    );
  }

  return (
    <ColorBg>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 12, width: "match_parent" }}>
        <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", width: "match_parent" }}>
          <TextWidget text={head.isLive ? head.statusText : (data.stadium || "오늘 경기")} style={{ fontSize: 11, fontWeight: "700", color: head.isLive ? "#e07b3c" : alpha(DARK_FG, "88") }} />
          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            <FlexWidget style={{marginRight: 8}}><TextWidget text={data.weather ? data.weather.replace(/^[0-9.-]+°\s*/, "") : ""} style={{ fontSize: 11, color: alpha(DARK_FG, "88") }} /></FlexWidget>
            <FlexWidget clickAction="REFRESH" style={{ padding: 2 }}>
              <TextWidget text="↻" style={{ fontSize: 14, color: "#e07b3c", fontWeight: "700" }} />
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ alignItems: "center", height: 26, justifyContent: "center" }}>
          {head.isLive ? <BaseSituation b1={data.base1} b2={data.base2} b3={data.base3} size={8} /> : <FlexWidget />}
        </FlexWidget>

        <FlexWidget style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", width: "match_parent" }}>
          <FlexWidget style={{ alignItems: "center" }}>
            <ImageWidget image={away.charImage} imageWidth={32} imageHeight={32} />
          </FlexWidget>
          <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", flex: 1 }}>
            {isCancelled ? (
              <TextWidget text="취소" style={{ fontSize: 18, fontWeight: "700", color: DARK_FG }} />
            ) : (
              <>
                <TextWidget text={away.scoreText} style={{ fontSize: 26, fontWeight: "700", color: away.scoreColor }} />
                <FlexWidget style={{marginHorizontal: 6}}><TextWidget text=" : " style={{ fontSize: 16, color: alpha(DARK_FG, "44") }} /></FlexWidget>
                <TextWidget text={home.scoreText} style={{ fontSize: 26, fontWeight: "700", color: home.scoreColor }} />
              </>
            )}
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center" }}>
            <ImageWidget image={home.charImage} imageWidth={32} imageHeight={32} />
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", width: "match_parent", marginTop: 4 }}>
          <FlexWidget style={{ alignItems: "flex-start", width: 60 }}>
            <TextWidget text={away.teamName} style={{ fontSize: 13, fontWeight: "700", color: away.nameColor }} />
            {away.pbText ? <FlexWidget style={{marginTop: 2}}><TextWidget text={away.pbText} style={{ fontSize: 10, color: DARK_FG }} /></FlexWidget> : <FlexWidget />}
          </FlexWidget>
          
          <FlexWidget style={{ alignItems: "flex-end", width: 60 }}>
            <TextWidget text={home.teamName} style={{ fontSize: 13, fontWeight: "700", color: home.nameColor }} />
            {home.pbText ? <FlexWidget style={{marginTop: 2}}><TextWidget text={home.pbText} style={{ fontSize: 10, color: DARK_FG }} /></FlexWidget> : <FlexWidget />}
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ flex: 1 }} />

        <FlexWidget style={{ alignItems: "center", height: 16, justifyContent: "flex-end", width: "match_parent" }}>
          {head.isLive ? (
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <TextWidget text={"●".repeat(head.bCnt) + "○".repeat(3 - head.bCnt)} style={{ fontSize: 9, color: "#43a047" }} />
              <FlexWidget style={{ width: 6 }} />
              <TextWidget text={"●".repeat(head.sCnt) + "○".repeat(2 - head.sCnt)} style={{ fontSize: 9, color: "#f9a825" }} />
              <FlexWidget style={{ width: 6 }} />
              <TextWidget text={"●".repeat(head.oCnt) + "○".repeat(2 - head.oCnt)} style={{ fontSize: 9, color: "#e53935" }} />
            </FlexWidget>
          ) : <FlexWidget />}
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
  const isScheduled = data.status === "scheduled";
  const isCancelled = data.status === "cancelled";
  const isFinished = data.status === "finished";

  if (isScheduled) {
    return (
      <ColorBg>
        <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 16, paddingHorizontal: 24, width: "match_parent" }}>
          <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <TextWidget text={`${data.stadium || "오늘 경기"} ${data.weather || ""}`.trim()} style={{ fontSize: 13, fontWeight: "700", color: alpha(DARK_FG, "88") }} />
              <FlexWidget clickAction="REFRESH" style={{ paddingLeft: 8, paddingRight: 4, paddingVertical: 2 }}><TextWidget text="↻" style={{ fontSize: 18, color: "#e07b3c", fontWeight: "700" }} /></FlexWidget>
            </FlexWidget>
          </FlexWidget>

          <FlexWidget style={{ flex: 1 }} />

          <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
            <FlexWidget style={{ alignItems: "center", width: 100 }}>
              {data.awayRank && (
                <FlexWidget style={{ alignItems: "center", marginBottom: 6 }}>
                  <TextWidget text={`${data.awayRank}위`} style={{ fontSize: 11, fontWeight: "700", color: alpha(DARK_FG, "88") }} />
                  {data.awayStreak && <FlexWidget style={{ marginTop: 2 }}><TextWidget text={`최근 ${data.awayStreak}`} style={{ fontSize: 11, color: alpha(DARK_FG, "88") }} /></FlexWidget>}
                </FlexWidget>
              )}
              <ImageWidget image={away.charImage} imageWidth={56} imageHeight={56} />
              <FlexWidget style={{ height: 8 }} />
              <TextWidget text={away.teamName} style={{ fontSize: 16, fontWeight: "700", color: away.nameColor }} />
              {away.pbText && <FlexWidget style={{marginTop: 4}}><TextWidget text={away.pbText} style={{ fontSize: 12, color: DARK_FG }} /></FlexWidget>}
            </FlexWidget>

            <FlexWidget style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <FlexWidget style={{marginBottom: 4}}><TextWidget text="경기 전" style={{ fontSize: 14, fontWeight: "700", color: alpha(DARK_FG, "88") }} /></FlexWidget>
              <TextWidget text={data.time || "VS"} style={{ fontSize: 36, fontWeight: "700", color: DARK_FG }} />
            </FlexWidget>

            <FlexWidget style={{ alignItems: "center", width: 100 }}>
              {data.homeRank && (
                <FlexWidget style={{ alignItems: "center", marginBottom: 6 }}>
                  <TextWidget text={`${data.homeRank}위`} style={{ fontSize: 11, fontWeight: "700", color: alpha(DARK_FG, "88") }} />
                  {data.homeStreak && <FlexWidget style={{ marginTop: 2 }}><TextWidget text={`최근 ${data.homeStreak}`} style={{ fontSize: 11, color: alpha(DARK_FG, "88") }} /></FlexWidget>}
                </FlexWidget>
              )}
              <ImageWidget image={home.charImage} imageWidth={56} imageHeight={56} />
              <FlexWidget style={{ height: 8 }} />
              <TextWidget text={home.teamName} style={{ fontSize: 16, fontWeight: "700", color: home.nameColor }} />
              {home.pbText && <FlexWidget style={{marginTop: 4}}><TextWidget text={home.pbText} style={{ fontSize: 12, color: DARK_FG }} /></FlexWidget>}
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
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <TextWidget text="경기 종료" style={{ fontSize: 14, fontWeight: "700", color: alpha(DARK_FG, "88") }} />
              <FlexWidget clickAction="REFRESH" style={{ paddingLeft: 8, paddingRight: 4, paddingVertical: 2 }}><TextWidget text="↻" style={{ fontSize: 18, color: "#e07b3c", fontWeight: "700" }} /></FlexWidget>
            </FlexWidget>
            <TextWidget text={`${data.stadium || ""} ${data.weather || ""}`.trim()} style={{ fontSize: 13, color: alpha(DARK_FG, "88") }} />
          </FlexWidget>

          <FlexWidget style={{ flex: 1 }} />

          <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
            <FlexWidget style={{ alignItems: "center", width: 100 }}>
              <ImageWidget image={away.charImage} imageWidth={56} imageHeight={56} />
              <FlexWidget style={{ height: 8 }} />
              <TextWidget text={away.teamName} style={{ fontSize: 16, fontWeight: "700", color: away.nameColor }} />
              {awayWon && <FlexWidget style={{marginTop: 4}}><TextWidget text="승리" style={{ fontSize: 14, fontWeight: "700", color: "#d32f2f" }} /></FlexWidget>}
            </FlexWidget>

            <FlexWidget style={{ flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "row" }}>
              <TextWidget text={away.scoreText} style={{ fontSize: 40, fontWeight: "700", color: awayWon ? away.scoreColor : alpha(away.scoreColor, "77") }} />
              <FlexWidget style={{marginHorizontal: 12}}><TextWidget text=" : " style={{ fontSize: 24, fontWeight: "700", color: alpha(DARK_FG, "44") }} /></FlexWidget>
              <TextWidget text={home.scoreText} style={{ fontSize: 40, fontWeight: "700", color: homeWon ? home.scoreColor : alpha(home.scoreColor, "77") }} />
            </FlexWidget>

            <FlexWidget style={{ alignItems: "center", width: 100 }}>
              <ImageWidget image={home.charImage} imageWidth={56} imageHeight={56} />
              <FlexWidget style={{ height: 8 }} />
              <TextWidget text={home.teamName} style={{ fontSize: 16, fontWeight: "700", color: home.nameColor }} />
              {homeWon && <FlexWidget style={{marginTop: 4}}><TextWidget text="승리" style={{ fontSize: 14, fontWeight: "700", color: "#d32f2f" }} /></FlexWidget>}
            </FlexWidget>
          </FlexWidget>

          <FlexWidget style={{ flex: 1 }} />
        </FlexWidget>
      </ColorBg>
    );
  }

  return (
    <ColorBg>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 12, paddingHorizontal: 20, width: "match_parent" }}>
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", width: "match_parent" }}>
          <TextWidget text={head.isLive ? head.statusText : `${data.stadium || "오늘 경기"} ${data.weather || ""}`.trim()} style={{ fontSize: 13, fontWeight: "700", color: head.isLive ? "#e07b3c" : alpha(DARK_FG, "88") }} />
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
          {head.isLive && (
            <FlexWidget style={{ marginRight: 12 }}>
              <TextWidget text={`${data.stadium || ""} ${data.weather || ""}`.trim()} style={{ fontSize: 12, color: alpha(DARK_FG, "88") }} />
            </FlexWidget>
          )}
          <FlexWidget clickAction="REFRESH" style={{ padding: 4, paddingHorizontal: 8 }}>
            <TextWidget text="↻" style={{ fontSize: 20, color: "#e07b3c", fontWeight: "700" }} />
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ flex: 1 }} />

        <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
          <FlexWidget style={{ alignItems: "center", width: 72 }}>
            {data.awayRank && (
              <FlexWidget style={{ alignItems: "center", marginBottom: 6 }}>
                <TextWidget text={`${data.awayRank}위`} style={{ fontSize: 11, fontWeight: "700", color: alpha(DARK_FG, "88") }} />
                {data.awayStreak && <FlexWidget style={{ marginTop: 2 }}><TextWidget text={`최근 ${data.awayStreak}`} style={{ fontSize: 11, color: alpha(DARK_FG, "88") }} /></FlexWidget>}
              </FlexWidget>
            )}
            <ImageWidget image={away.charImage} imageWidth={48} imageHeight={48} />
            <FlexWidget style={{ height: 4 }} />
            <TextWidget text={away.teamName} style={{ fontSize: 15, fontWeight: "700", color: away.nameColor }} />
            {away.pbText ? <FlexWidget style={{marginTop: 4}}><TextWidget text={away.pbText} style={{ fontSize: 11, color: DARK_FG }} /></FlexWidget> : <FlexWidget />}
          </FlexWidget>

          <FlexWidget style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
              {isCancelled ? (
                <TextWidget text="우천 취소" style={{ fontSize: 28, fontWeight: "700", color: DARK_FG }} />
              ) : (
                <>
                <TextWidget text={away.scoreText} style={{ fontSize: 34, fontWeight: "700", color: away.scoreColor }} />
                <FlexWidget style={{marginHorizontal: 8}}><TextWidget text=" : " style={{ fontSize: 22, fontWeight: "700", color: alpha(DARK_FG, "44") }} /></FlexWidget>
                <TextWidget text={home.scoreText} style={{ fontSize: 34, fontWeight: "700", color: home.scoreColor }} />
              </>
              )}
            </FlexWidget>
          </FlexWidget>

          <FlexWidget style={{ alignItems: "center", width: 72 }}>
            {data.homeRank && (
              <FlexWidget style={{ alignItems: "center", marginBottom: 6 }}>
                <TextWidget text={`${data.homeRank}위`} style={{ fontSize: 11, fontWeight: "700", color: alpha(DARK_FG, "88") }} />
                {data.homeStreak && <FlexWidget style={{ marginTop: 2 }}><TextWidget text={`최근 ${data.homeStreak}`} style={{ fontSize: 11, color: alpha(DARK_FG, "88") }} /></FlexWidget>}
              </FlexWidget>
            )}
            <ImageWidget image={home.charImage} imageWidth={48} imageHeight={48} />
            <FlexWidget style={{ height: 4 }} />
            <TextWidget text={home.teamName} style={{ fontSize: 15, fontWeight: "700", color: home.nameColor }} />
            {home.pbText ? <FlexWidget style={{marginTop: 4}}><TextWidget text={home.pbText} style={{ fontSize: 11, color: DARK_FG }} /></FlexWidget> : <FlexWidget />}
          </FlexWidget>
        </FlexWidget>
        
        <FlexWidget style={{ flex: 1 }} />
      </FlexWidget>
    </ColorBg>
  );
}
