// @ts-nocheck
import { FlexWidget, TextWidget, ImageWidget } from "react-native-android-widget";
import { LOCAL_CHARACTERS } from "@/lib/characterAssets";
import type { CharacterEmotion } from "@/lib/emotions";

export interface WidgetGameData {
  homeTeam: string; awayTeam: string;
  homeScore: string; awayScore: string;
  inning: string; isTop: string; status: string;
  time?: string; homeIsMyTeam: boolean;
  stadium?: string; weather?: string;
  awayPitcher?: string; homePitcher?: string;
  ball?: string; strike?: string; out?: string;
  base1?: string; base2?: string; base3?: string;
  currentPitcher?: string; currentBatter?: string;
}

const TEAM_NAME_COLOR: Record<string, string> = {
  doosan: "#131230", lg: "#C0334A", kiwoom: "#820024", ssg: "#CE0E2D",
  kt: "#231F20", hanwha: "#FF6600", samsung: "#074CA1", kia: "#EA0029",
  lotte: "#1E467C", nc: "#1D467C",
};
const DARK_FG = "#2a2a32";
const FG_93 = "#303038"; const FG_87 = "#3c3c44"; const FG_73 = "#56565e"; const FG_47 = "#7b7b83";

const NAME_TO_TEAM_ID: Record<string, string> = {
  두산: "doosan", LG: "lg", 키움: "kiwoom", SSG: "ssg",
  KT: "kt", 한화: "hanwha", 삼성: "samsung", KIA: "kia",
  롯데: "lotte", NC: "nc",
  OB: "doosan", WO: "kiwoom", SK: "ssg",
  HH: "hanwha", SS: "samsung", HT: "kia", LT: "lotte",
};

function alpha(hex: string, a: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const av = parseInt(a, 16) / 255;
  return `#${Math.round(r * av + 0xf5 * (1 - av)).toString(16).padStart(2, "0")}${Math.round(g * av + 0xf0 * (1 - av)).toString(16).padStart(2, "0")}${Math.round(b * av + 0xeb * (1 - av)).toString(16).padStart(2, "0")}`;
}

function computeEmotion(d: WidgetGameData, isHome: boolean): CharacterEmotion {
  if (d.status === "cancelled") return "rain_cancellation";
  if (d.status === "scheduled") return "default";
  const myScore = parseInt(isHome ? d.homeScore : d.awayScore, 10) || 0;
  const oppScore = parseInt(isHome ? d.awayScore : d.homeScore, 10) || 0;
  const diff = myScore - oppScore;
  if (d.status === "finished") {
    if (diff > 0) return "thumbs_up";
    if (diff === 0) return "neutral";
    return "crying";
  }
  const inn = parseInt(d.inning || "1", 10);
  const isMyHome = d.homeIsMyTeam;
  const oppChances = isHome ? (isMyHome === (d.isTop === "1")) : (isMyHome !== (d.isTop === "1"));
  const myChances = !oppChances;
  const loaded = d.base1 === "1" && d.base2 === "1" && d.base3 === "1";
  const scoring = d.base2 === "1" || d.base3 === "1";
  if (diff === 0) {
    if (inn >= 10) return "sleepy";
    if (oppChances && loaded) return "extream_shock";
    if (myChances && loaded) return "in_love";
    if (inn >= 7) return "determined";
    return "default";
  }
  if (diff >= 5) return "mocking";
  if (diff >= 1 && diff <= 4) {
    if (oppChances && scoring && diff <= 2) return "flustered";
    return "joyful";
  }
  if (diff <= -5) return "resigned_disgust";
  if (inn >= 9) return "praying";
  if (myChances && scoring && diff >= -2) return "determined";
  return "sad";
}

function getSide(d: WidgetGameData, isHome: boolean) {
  const name = isHome ? d.homeTeam : d.awayTeam;
  const id = NAME_TO_TEAM_ID[name] || name.toLowerCase();
  const emotion = computeEmotion(d, isHome);
  const img = LOCAL_CHARACTERS[`${id}_${emotion}`] || LOCAL_CHARACTERS[`${id}_default`] || LOCAL_CHARACTERS["doosan_default"];
  const color = TEAM_NAME_COLOR[id] || DARK_FG;
  const live = d.status === "live";
  const sched = d.status === "scheduled";
  const att = live && (d.isTop === (isHome ? "0" : "1"));
  const sc = live ? (att ? DARK_FG : alpha(DARK_FG, "55")) : DARK_FG;
  let pb = "";
  if (live) pb = att ? `B:${d.currentBatter || " "}` : `P:${d.currentPitcher || (isHome ? d.homePitcher : d.awayPitcher) || " "}`;
  else if (sched) pb = `${isHome ? d.homePitcher || "?" : d.awayPitcher || "?"}`;
  const score = (sched || d.status === "cancelled") ? "" : (isHome ? d.homeScore : d.awayScore);
  return { name, img, color, scoreColor: sc, pb, score };
}

function getHeader(d: WidgetGameData) {
  const live = d.status === "live";
  let txt = "";
  if (d.status === "cancelled") txt = "취소";
  else if (live) txt = `${d.inning}회${d.isTop === "1" ? "초" : "말"}`;
  else if (d.status === "finished") txt = "경기 종료";
  else txt = d.stadium || "경기 전";
  return {
    live, txt,
    b: Math.min(parseInt(d.ball || "0", 10), 3),
    s: Math.min(parseInt(d.strike || "0", 10), 2),
    o: Math.min(parseInt(d.out || "0", 10), 2),
  };
}

function Base({ b1, b2, b3, size }: { b1?: string; b2?: string; b3?: string; size: number }) {
  const on = (v?: string) => v && v !== "0";
  const dot = (v?: string) => on(v) ? "◆" : "◇";
  const clr = (v?: string) => on(v) ? "#e07b3c" : "#000000";
  const dw = Math.round(size * 2.5);
  return (
    <FlexWidget style={{ alignItems: "center" }}>
      <TextWidget text={dot(b2)} style={{ fontSize: size, color: clr(b2), fontWeight: "700" }} />
      <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", width: dw }}>
        <TextWidget text={dot(b3)} style={{ fontSize: size, color: clr(b3), fontWeight: "700" }} />
        <TextWidget text={dot(b1)} style={{ fontSize: size, color: clr(b1), fontWeight: "700" }} />
      </FlexWidget>
    </FlexWidget>
  );
}

function BSO({ b, s, o, fs = 10 }: { b: number; s: number; o: number; fs?: number }) {
  return (
    <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
      <TextWidget text={`B:${"●".repeat(b)}${"○".repeat(3 - b)}`} style={{ fontSize: fs, color: "#43a047" }} />
      <FlexWidget style={{ width: 4 }} />
      <TextWidget text={`S:${"●".repeat(s)}${"○".repeat(2 - s)}`} style={{ fontSize: fs, color: "#f9a825" }} />
      <FlexWidget style={{ width: 4 }} />
      <TextWidget text={`O:${"●".repeat(o)}${"○".repeat(2 - o)}`} style={{ fontSize: fs, color: "#e53935" }} />
    </FlexWidget>
  );
}

function RefreshBtn({ fs = 14 }: { fs?: number }) {
  return (
    <FlexWidget clickAction="REFRESH" style={{ padding: 2, paddingHorizontal: 4 }}>
      <TextWidget text="↻" style={{ fontSize: fs, color: "#e07b3c", fontWeight: "700" }} />
    </FlexWidget>
  );
}

function NoGame() {
  return (
    <FlexWidget style={{ width: "match_parent", height: "match_parent", backgroundColor: "#f5f0eb", borderRadius: 16 }} clickAction="OPEN_APP">
      <FlexWidget style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <TextWidget text="오늘은 경기가 없어요" style={{ fontSize: 14, color: DARK_FG }} />
        <FlexWidget style={{ height: 8 }} />
        <RefreshBtn fs={16} />
      </FlexWidget>
    </FlexWidget>
  );
}

function Card({ children }: { children: any }) {
  return (
    <FlexWidget style={{ width: "match_parent", height: "match_parent", backgroundColor: "#f5f0eb", borderRadius: 16 }} clickAction="OPEN_APP">
      {children}
    </FlexWidget>
  );
}

// ─── View 2x2 ───
function View2x2(data: WidgetGameData) {
  const away = getSide(data, false);
  const home = getSide(data, true);
  const hdr = getHeader(data);
  const s = data.status;

  if (s === "scheduled") return Sched2x2(data, away, home);
  if (s === "cancelled") return Cancelled2x2(data, away, home);
  if (s === "finished") return Finished2x2(data, away, home);
  return Live2x2(data, away, home, hdr);
}

function Sched2x2(data: WidgetGameData, away: ReturnType<typeof getSide>, home: ReturnType<typeof getSide>) {
  return (
    <Card>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 10, width: "match_parent" }}>
        <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "match_parent" }}>
          <TextWidget text={data.stadium || "오늘 경기"} style={{ fontSize: 11, fontWeight: "700", color: FG_87 }} />
          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            <TextWidget text={data.time || " "} style={{ fontSize: 11, fontWeight: "700", color: DARK_FG }} />
            <RefreshBtn />
          </FlexWidget>
        </FlexWidget>
        <FlexWidget style={{ flex: 1 }} />
        <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", width: "match_parent", paddingHorizontal: 4, alignItems: "flex-start" }}>
          <FlexWidget style={{ alignItems: "center", flex: 1 }}>
            <ImageWidget image={away.img} imageWidth={48} imageHeight={48} />
            <FlexWidget style={{ height: 6 }} />
            <TextWidget text={away.name} style={{ fontSize: 13, fontWeight: "700", color: away.color }} />
            <FlexWidget style={{ height: 4 }} />
            <TextWidget text={away.pb || " "} style={{ fontSize: 10, color: DARK_FG }} />
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center", width: 28, marginTop: 14 }}>
            <TextWidget text="VS" style={{ fontSize: 14, fontWeight: "700", color: FG_73 }} />
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center", flex: 1 }}>
            <ImageWidget image={home.img} imageWidth={48} imageHeight={48} />
            <FlexWidget style={{ height: 6 }} />
            <TextWidget text={home.name} style={{ fontSize: 13, fontWeight: "700", color: home.color }} />
            <FlexWidget style={{ height: 4 }} />
            <TextWidget text={home.pb || " "} style={{ fontSize: 10, color: DARK_FG }} />
          </FlexWidget>
        </FlexWidget>
        <FlexWidget style={{ flex: 1 }} />
      </FlexWidget>
    </Card>
  );
}

function Finished2x2(data: WidgetGameData, away: ReturnType<typeof getSide>, home: ReturnType<typeof getSide>) {
  const aw = parseInt(data.awayScore) > parseInt(data.homeScore);
  const hw = parseInt(data.homeScore) > parseInt(data.awayScore);
  return (
    <Card>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 10, width: "match_parent" }}>
        <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "match_parent" }}>
          <TextWidget text="경기 종료" style={{ fontSize: 11, fontWeight: "700", color: FG_87 }} />
          <RefreshBtn />
        </FlexWidget>
        <FlexWidget style={{ flex: 1 }} />
        <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", width: "match_parent", paddingHorizontal: 4 }}>
          <FlexWidget style={{ alignItems: "center", flex: 1 }}>
            {aw ? <TextWidget text="WIN" style={{ fontSize: 10, fontWeight: "700", color: "#d32f2f" }} /> : <FlexWidget style={{ height: 14 }} />}
            <ImageWidget image={away.img} imageWidth={40} imageHeight={40} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={away.name} style={{ fontSize: 12, fontWeight: "700", color: away.color }} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={data.awayScore} style={{ fontSize: 28, fontWeight: "700", color: aw ? away.scoreColor : alpha(away.scoreColor, "77") }} />
          </FlexWidget>
          <FlexWidget style={{ width: 24, alignItems: "center", justifyContent: "flex-start" }}>
            <FlexWidget style={{ height: 78 }} />
            <TextWidget text=":" style={{ fontSize: 22, fontWeight: "700", color: FG_73 }} />
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center", flex: 1 }}>
            {hw ? <TextWidget text="WIN" style={{ fontSize: 10, fontWeight: "700", color: "#d32f2f" }} /> : <FlexWidget style={{ height: 14 }} />}
            <ImageWidget image={home.img} imageWidth={40} imageHeight={40} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={home.name} style={{ fontSize: 12, fontWeight: "700", color: home.color }} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={data.homeScore} style={{ fontSize: 28, fontWeight: "700", color: hw ? home.scoreColor : alpha(home.scoreColor, "77") }} />
          </FlexWidget>
        </FlexWidget>
        <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", width: "match_parent", marginTop: 6, paddingHorizontal: 4 }}>
          <TextWidget text={`${aw ? "승" : "패"}: ${data.awayPitcher || "-"}`} style={{ fontSize: 9, color: DARK_FG }} />
          <TextWidget text={`${hw ? "승" : "패"}: ${data.homePitcher || "-"}`} style={{ fontSize: 9, color: DARK_FG }} />
        </FlexWidget>
        <FlexWidget style={{ flex: 1 }} />
      </FlexWidget>
    </Card>
  );
}

function Cancelled2x2(data: WidgetGameData, away: ReturnType<typeof getSide>, home: ReturnType<typeof getSide>) {
  return (
    <Card>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 10, width: "match_parent" }}>
        <FlexWidget style={{ flexDirection: "row", justifyContent: "flex-end", width: "match_parent" }}>
          <RefreshBtn />
        </FlexWidget>
        <FlexWidget style={{ flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "match_parent", paddingHorizontal: 4 }}>
          <FlexWidget style={{ alignItems: "center", flex: 1 }}>
            <ImageWidget image={away.img} imageWidth={48} imageHeight={48} />
            <FlexWidget style={{ height: 4 }} />
            <TextWidget text={away.name} style={{ fontSize: 13, fontWeight: "700", color: away.color }} />
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center", width: 40 }}>
            <TextWidget text="우천" style={{ fontSize: 12, fontWeight: "700", color: DARK_FG }} />
            <TextWidget text="취소" style={{ fontSize: 12, fontWeight: "700", color: DARK_FG }} />
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center", flex: 1 }}>
            <ImageWidget image={home.img} imageWidth={48} imageHeight={48} />
            <FlexWidget style={{ height: 4 }} />
            <TextWidget text={home.name} style={{ fontSize: 13, fontWeight: "700", color: home.color }} />
          </FlexWidget>
        </FlexWidget>
        <FlexWidget style={{ flex: 1 }} />
      </FlexWidget>
    </Card>
  );
}

function Live2x2(data: WidgetGameData, away: ReturnType<typeof getSide>, home: ReturnType<typeof getSide>, hdr: ReturnType<typeof getHeader>) {
  return (
    <Card>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 10, width: "match_parent" }}>
        <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "match_parent" }}>
          <TextWidget text={data.stadium || "오늘 경기"} style={{ fontSize: 11, fontWeight: "700", color: FG_93 }} />
          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            <TextWidget text={hdr.txt} style={{ fontSize: 11, fontWeight: "700", color: "#e07b3c" }} />
            <RefreshBtn />
          </FlexWidget>
        </FlexWidget>
        <FlexWidget style={{ height: 4 }} />
        <BSO b={hdr.b} s={hdr.s} o={hdr.o} fs={11} />
        <FlexWidget style={{ alignItems: "center", justifyContent: "center", width: "match_parent" }}>
          <Base b1={data.base1} b2={data.base2} b3={data.base3} size={13} />
        </FlexWidget>
        <FlexWidget style={{ flex: 1 }} />
        <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", width: "match_parent", paddingHorizontal: 4 }}>
          <FlexWidget style={{ alignItems: "center", flex: 1 }}>
            <ImageWidget image={away.img} imageWidth={40} imageHeight={40} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={data.awayScore} style={{ fontSize: 30, fontWeight: "700", color: away.scoreColor }} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={away.name} style={{ fontSize: 12, fontWeight: "700", color: away.color }} />
            {away.pb ? <TextWidget text={away.pb} style={{ fontSize: 9, color: DARK_FG }} /> : null}
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center", justifyContent: "center" }}>
            <FlexWidget style={{ height: 42 }} />
            <TextWidget text=":" style={{ fontSize: 18, fontWeight: "700", color: FG_73 }} />
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center", flex: 1 }}>
            <ImageWidget image={home.img} imageWidth={40} imageHeight={40} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={data.homeScore} style={{ fontSize: 30, fontWeight: "700", color: home.scoreColor }} />
            <FlexWidget style={{ height: 2 }} />
            <TextWidget text={home.name} style={{ fontSize: 12, fontWeight: "700", color: home.color }} />
            {home.pb ? <TextWidget text={home.pb} style={{ fontSize: 9, color: DARK_FG }} /> : null}
          </FlexWidget>
        </FlexWidget>
        <FlexWidget style={{ flex: 1 }} />
      </FlexWidget>
    </Card>
  );
}

// ─── View 4x2 ───
function View4x2(data: WidgetGameData) {
  const away = getSide(data, false);
  const home = getSide(data, true);
  const hdr = getHeader(data);
  const s = data.status;

  if (s === "scheduled") return Sched4x2(data, away, home);
  if (s === "cancelled") return Cancelled2x2(data, away, home); // reuse 2x2 cancelled
  if (s === "finished") return Finished4x2(data, away, home);
  return Live4x2(data, away, home, hdr);
}

function Sched4x2(data: WidgetGameData, away: ReturnType<typeof getSide>, home: ReturnType<typeof getSide>) {
  return (
    <Card>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 16, paddingHorizontal: 24, width: "match_parent" }}>
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
          <TextWidget text={`${data.stadium || "오늘 경기"} ${data.weather || ""}`.trim() || " "} style={{ fontSize: 13, fontWeight: "700", color: FG_93 }} />
          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            <TextWidget text={data.time || " "} style={{ fontSize: 13, fontWeight: "700", color: DARK_FG }} />
            <RefreshBtn fs={18} />
          </FlexWidget>
        </FlexWidget>
        <FlexWidget style={{ flex: 1 }} />
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
          <FlexWidget style={{ alignItems: "center", width: 100 }}>
            <ImageWidget image={away.img} imageWidth={56} imageHeight={56} />
            <FlexWidget style={{ height: 8 }} />
            <TextWidget text={away.name} style={{ fontSize: 16, fontWeight: "700", color: away.color }} />
            {away.pb ? <TextWidget text={away.pb} style={{ fontSize: 12, color: DARK_FG }} /> : null}
          </FlexWidget>
          <FlexWidget style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <TextWidget text="VS" style={{ fontSize: 28, fontWeight: "700", color: FG_47 }} />
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center", width: 100 }}>
            <ImageWidget image={home.img} imageWidth={56} imageHeight={56} />
            <FlexWidget style={{ height: 8 }} />
            <TextWidget text={home.name} style={{ fontSize: 16, fontWeight: "700", color: home.color }} />
            {home.pb ? <TextWidget text={home.pb} style={{ fontSize: 12, color: DARK_FG }} /> : null}
          </FlexWidget>
        </FlexWidget>
        <FlexWidget style={{ flex: 1 }} />
      </FlexWidget>
    </Card>
  );
}

function Finished4x2(data: WidgetGameData, away: ReturnType<typeof getSide>, home: ReturnType<typeof getSide>) {
  const aw = parseInt(data.awayScore) > parseInt(data.homeScore);
  const hw = parseInt(data.homeScore) > parseInt(data.awayScore);
  return (
    <Card>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 16, paddingHorizontal: 24, width: "match_parent" }}>
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
          <TextWidget text={`${data.stadium || "오늘 경기"} ${data.weather || ""}`.trim() || " "} style={{ fontSize: 13, fontWeight: "700", color: FG_87 }} />
          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            <TextWidget text="경기 종료" style={{ fontSize: 14, fontWeight: "700", color: FG_87 }} />
            <RefreshBtn fs={18} />
          </FlexWidget>
        </FlexWidget>
        <FlexWidget style={{ flex: 1 }} />
        <FlexWidget style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", width: "match_parent" }}>
          <FlexWidget style={{ alignItems: "center", width: 100 }}>
            {aw ? <TextWidget text="WIN" style={{ fontSize: 13, fontWeight: "700", color: "#d32f2f" }} /> : <FlexWidget style={{ height: 18 }} />}
            <ImageWidget image={away.img} imageWidth={52} imageHeight={52} />
            <FlexWidget style={{ height: 6 }} />
            <TextWidget text={away.name} style={{ fontSize: 15, fontWeight: "700", color: away.color }} />
            <FlexWidget style={{ height: 4 }} />
            <TextWidget text={`${aw ? "승" : "패"}: ${data.awayPitcher || "-"}`} style={{ fontSize: 11, color: DARK_FG }} />
          </FlexWidget>
          <FlexWidget style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <TextWidget text={data.awayScore} style={{ fontSize: 40, fontWeight: "700", color: aw ? away.scoreColor : alpha(away.scoreColor, "99") }} />
              <TextWidget text=" : " style={{ fontSize: 24, fontWeight: "700", color: FG_73, marginHorizontal: 12 }} />
              <TextWidget text={data.homeScore} style={{ fontSize: 40, fontWeight: "700", color: hw ? home.scoreColor : alpha(home.scoreColor, "99") }} />
            </FlexWidget>
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center", width: 100 }}>
            {hw ? <TextWidget text="WIN" style={{ fontSize: 13, fontWeight: "700", color: "#d32f2f" }} /> : <FlexWidget style={{ height: 18 }} />}
            <ImageWidget image={home.img} imageWidth={52} imageHeight={52} />
            <FlexWidget style={{ height: 6 }} />
            <TextWidget text={home.name} style={{ fontSize: 15, fontWeight: "700", color: home.color }} />
            <FlexWidget style={{ height: 4 }} />
            <TextWidget text={`${hw ? "승" : "패"}: ${data.homePitcher || "-"}`} style={{ fontSize: 11, color: DARK_FG }} />
          </FlexWidget>
        </FlexWidget>
        <FlexWidget style={{ flex: 1 }} />
      </FlexWidget>
    </Card>
  );
}

function Live4x2(data: WidgetGameData, away: ReturnType<typeof getSide>, home: ReturnType<typeof getSide>, hdr: ReturnType<typeof getHeader>) {
  const loc = data.stadium ? (data.weather ? `${data.stadium} ${data.weather}` : data.stadium) : "오늘 경기";
  return (
    <Card>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 12, paddingHorizontal: 20, width: "match_parent" }}>
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", width: "match_parent", justifyContent: "space-between" }}>
          <TextWidget text={loc} style={{ fontSize: 13, fontWeight: "700", color: FG_93 }} />
          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            <TextWidget text={hdr.txt} style={{ fontSize: 13, fontWeight: "700", color: "#e07b3c" }} />
            <RefreshBtn fs={20} />
          </FlexWidget>
        </FlexWidget>
        <FlexWidget style={{ flex: 1 }} />
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", width: "match_parent" }}>
          <BSO b={hdr.b} s={hdr.s} o={hdr.o} fs={12} />
          <FlexWidget style={{ width: 16 }} />
          <Base b1={data.base1} b2={data.base2} b3={data.base3} size={15} />
        </FlexWidget>
        <FlexWidget style={{ height: 8 }} />
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
          <FlexWidget style={{ alignItems: "center", width: 72 }}>
            <ImageWidget image={away.img} imageWidth={48} imageHeight={48} />
            <FlexWidget style={{ height: 4 }} />
            <TextWidget text={away.name} style={{ fontSize: 15, fontWeight: "700", color: away.color }} />
            {away.pb ? <TextWidget text={away.pb} style={{ fontSize: 11, color: DARK_FG }} /> : null}
          </FlexWidget>
          <FlexWidget style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
              <TextWidget text={data.awayScore} style={{ fontSize: 34, fontWeight: "700", color: away.scoreColor }} />
              <TextWidget text=" : " style={{ fontSize: 22, fontWeight: "700", color: FG_73, marginHorizontal: 8 }} />
              <TextWidget text={data.homeScore} style={{ fontSize: 34, fontWeight: "700", color: home.scoreColor }} />
            </FlexWidget>
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center", width: 72 }}>
            <ImageWidget image={home.img} imageWidth={48} imageHeight={48} />
            <FlexWidget style={{ height: 4 }} />
            <TextWidget text={home.name} style={{ fontSize: 15, fontWeight: "700", color: home.color }} />
            {home.pb ? <TextWidget text={home.pb} style={{ fontSize: 11, color: DARK_FG }} /> : null}
          </FlexWidget>
        </FlexWidget>
        <FlexWidget style={{ flex: 1 }} />
      </FlexWidget>
    </Card>
  );
}

// ─── Main Component ───
interface WidgetProps { width: number; height: number; data: WidgetGameData | null; myTeam: string; }

export function GameStatusWidget({ width, height, data }: WidgetProps) {
  try {
    if (!data) return <NoGame />;
    if (width < 80) return <Card><FlexWidget style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><TextWidget text="지원 안함" style={{ fontSize: 10, color: DARK_FG }} /></FlexWidget></Card>;
    if (height < 80) {
      if (width < 230) return <Sched2x2 data={data} away={getSide(data, false)} home={getSide(data, true)} />;
      return <Sched4x2 data={data} away={getSide(data, false)} home={getSide(data, true)} />;
    }
    if (width < 230) return <View2x2 data={data} />;
    return <View4x2 data={data} />;
  } catch (e) {
    return <Card><FlexWidget style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><TextWidget text="Error" style={{ fontSize: 14, color: "#FFF" }} /></FlexWidget></Card>;
  }
}
