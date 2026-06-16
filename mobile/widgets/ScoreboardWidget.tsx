import { FlexWidget, TextWidget, ImageWidget } from "react-native-android-widget";
import { LOCAL_CHARACTERS } from "@/lib/characterAssets";
import type { WidgetGame } from "@shared/types";

const DARK_FG = "#2a2a32";
const TEAM_NAME_COLOR: Record<string, string> = {
  doosan: "#131230", lg: "#C0334A", kiwoom: "#820024", ssg: "#CE0E2D",
  kt: "#231F20", hanwha: "#FF6600", samsung: "#074CA1", kia: "#EA0029",
  lotte: "#1E467C", nc: "#1D467C",
};

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

export function ScoreboardWidget({ game, width }: { game: WidgetGame, width: number }) {
  const isLive = game.status === "live";
  const isScheduled = game.status === "scheduled";
  const isCancelled = game.status === "cancelled";
  const isFinished = game.status === "finished";

  const awayTeamId = NAME_TO_TEAM_ID[game.awayName] || game.awayName.toLowerCase();
  const homeTeamId = NAME_TO_TEAM_ID[game.homeName] || game.homeName.toLowerCase();

  const awayColor = TEAM_NAME_COLOR[awayTeamId] || DARK_FG;
  const homeColor = TEAM_NAME_COLOR[homeTeamId] || DARK_FG;

  // Determine Emotion based on score difference
  let awayEmotion = "default";
  let homeEmotion = "default";
  if (game.score) {
    const diff = game.score.home - game.score.away;
    if (diff > 0) {
      homeEmotion = diff >= 5 ? "mocking" : "joyful";
      awayEmotion = diff >= 5 ? "resigned_disgust" : "sad";
    } else if (diff < 0) {
      awayEmotion = diff <= -5 ? "mocking" : "joyful";
      homeEmotion = diff <= -5 ? "resigned_disgust" : "sad";
    } else {
      homeEmotion = "determined";
      awayEmotion = "determined";
    }
  }

  const awayChar = LOCAL_CHARACTERS[`${awayTeamId}_${awayEmotion}`] || LOCAL_CHARACTERS[`${awayTeamId}_default`];
  const homeChar = LOCAL_CHARACTERS[`${homeTeamId}_${homeEmotion}`] || LOCAL_CHARACTERS[`${homeTeamId}_default`];

  let statusText = "경기 전";
  if (isCancelled) statusText = "우천 취소";
  else if (isFinished) statusText = "경기 종료";
  else if (isLive) statusText = "진행 중";

  const { inn, rheb } = game.scoreBoard || { inn: { away: [], home: [] }, rheb: { away: {r:0,h:0,e:0}, home: {r:0,h:0,e:0} } };

  // Fill innings to 9 minimum
  const maxInnings = Math.max(9, inn.away.length);
  const inningsArray = Array.from({ length: maxInnings }, (_, i) => i + 1);

  return (
    <FlexWidget style={{ width: "match_parent", height: "match_parent", backgroundColor: "#f5f0eb", borderRadius: 16, padding: 12, paddingHorizontal: 16 }} clickAction="OPEN_APP">
      {/* 1. Header */}
      <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "match_parent", marginBottom: 8 }}>
        <TextWidget text={`${game.venue || ""} ${game.time || ""}`} style={{ fontSize: 12, color: alpha(DARK_FG, "88"), fontWeight: "700" }} />
        <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
          <TextWidget text={statusText} style={{ fontSize: 12, color: isLive ? "#e07b3c" : DARK_FG, fontWeight: "700", marginRight: 16 }} />
          <FlexWidget clickAction="REFRESH" style={{ padding: 4 }}>
            <TextWidget text="↻" style={{ fontSize: 18, color: "#e07b3c", fontWeight: "700" }} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>

      {/* 2. Top Banner (Score & Emotion) */}
      <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "match_parent", marginBottom: 12 }}>
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", width: 80 }}>
          <ImageWidget image={awayChar} imageWidth={40} imageHeight={40} />
          <FlexWidget style={{ width: 8 }} />
          <TextWidget text={game.awayName} style={{ fontSize: 16, fontWeight: "700", color: awayColor }} />
        </FlexWidget>

        <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
          {isScheduled ? (
            <TextWidget text="VS" style={{ fontSize: 32, fontWeight: "700", color: DARK_FG }} />
          ) : isCancelled ? (
            <TextWidget text="취소" style={{ fontSize: 32, fontWeight: "700", color: DARK_FG }} />
          ) : (
            <>
              <TextWidget text={String(game.score?.away ?? 0)} style={{ fontSize: 36, fontWeight: "700", color: awayColor }} />
              <TextWidget text=" : " style={{ fontSize: 24, fontWeight: "700", color: alpha(DARK_FG, "44"), marginHorizontal: 12 }} />
              <TextWidget text={String(game.score?.home ?? 0)} style={{ fontSize: 36, fontWeight: "700", color: homeColor }} />
            </>
          )}
        </FlexWidget>

        <FlexWidget style={{ flexDirection: "row", alignItems: "center", width: 80, justifyContent: "flex-end" }}>
          <TextWidget text={game.homeName} style={{ fontSize: 16, fontWeight: "700", color: homeColor }} />
          <FlexWidget style={{ width: 8 }} />
          <ImageWidget image={homeChar} imageWidth={40} imageHeight={40} />
        </FlexWidget>
      </FlexWidget>

      {/* 3. Main Scoreboard Table */}
      <FlexWidget style={{ backgroundColor: "#ffffff", borderRadius: 8, padding: 8, width: "match_parent", marginBottom: 12 }}>
        {/* Table Header */}
        <FlexWidget style={{ flexDirection: "row", width: "match_parent", borderBottomWidth: 1, borderColor: "#e0e0e0", paddingBottom: 4, marginBottom: 4 }}>
          <FlexWidget style={{ width: 40, alignItems: "center" }}><TextWidget text="팀" style={{ fontSize: 10, color: "#888", fontWeight: "700" }} /></FlexWidget>
          <FlexWidget style={{ flex: 1, flexDirection: "row" }}>
            {inningsArray.map(i => (
              <FlexWidget key={i} style={{ flex: 1, alignItems: "center" }}>
                <TextWidget text={String(i)} style={{ fontSize: 10, color: "#888", fontWeight: "700" }} />
              </FlexWidget>
            ))}
          </FlexWidget>
          <FlexWidget style={{ width: 80, flexDirection: "row", borderLeftWidth: 1, borderColor: "#e0e0e0" }}>
            <FlexWidget style={{ flex: 1, alignItems: "center" }}><TextWidget text="R" style={{ fontSize: 10, color: "#d32f2f", fontWeight: "700" }} /></FlexWidget>
            <FlexWidget style={{ flex: 1, alignItems: "center" }}><TextWidget text="H" style={{ fontSize: 10, color: "#888", fontWeight: "700" }} /></FlexWidget>
            <FlexWidget style={{ flex: 1, alignItems: "center" }}><TextWidget text="E" style={{ fontSize: 10, color: "#888", fontWeight: "700" }} /></FlexWidget>
          </FlexWidget>
        </FlexWidget>

        {/* Away Row */}
        <FlexWidget style={{ flexDirection: "row", width: "match_parent", paddingVertical: 4 }}>
          <FlexWidget style={{ width: 40, alignItems: "center" }}><TextWidget text={game.awayName} style={{ fontSize: 12, color: awayColor, fontWeight: "700" }} /></FlexWidget>
          <FlexWidget style={{ flex: 1, flexDirection: "row" }}>
            {inningsArray.map((_, idx) => (
              <FlexWidget key={idx} style={{ flex: 1, alignItems: "center" }}>
                <TextWidget text={inn.away[idx] !== undefined && inn.away[idx] !== null ? String(inn.away[idx]) : "-"} style={{ fontSize: 12, color: DARK_FG, fontWeight: "700" }} />
              </FlexWidget>
            ))}
          </FlexWidget>
          <FlexWidget style={{ width: 80, flexDirection: "row", borderLeftWidth: 1, borderColor: "#e0e0e0" }}>
            <FlexWidget style={{ flex: 1, alignItems: "center" }}><TextWidget text={String(rheb.away.r)} style={{ fontSize: 12, color: "#d32f2f", fontWeight: "700" }} /></FlexWidget>
            <FlexWidget style={{ flex: 1, alignItems: "center" }}><TextWidget text={String(rheb.away.h)} style={{ fontSize: 12, color: DARK_FG, fontWeight: "700" }} /></FlexWidget>
            <FlexWidget style={{ flex: 1, alignItems: "center" }}><TextWidget text={String(rheb.away.e)} style={{ fontSize: 12, color: DARK_FG, fontWeight: "700" }} /></FlexWidget>
          </FlexWidget>
        </FlexWidget>

        {/* Home Row */}
        <FlexWidget style={{ flexDirection: "row", width: "match_parent", paddingVertical: 4 }}>
          <FlexWidget style={{ width: 40, alignItems: "center" }}><TextWidget text={game.homeName} style={{ fontSize: 12, color: homeColor, fontWeight: "700" }} /></FlexWidget>
          <FlexWidget style={{ flex: 1, flexDirection: "row" }}>
            {inningsArray.map((_, idx) => (
              <FlexWidget key={idx} style={{ flex: 1, alignItems: "center" }}>
                <TextWidget text={inn.home[idx] !== undefined && inn.home[idx] !== null ? String(inn.home[idx]) : "-"} style={{ fontSize: 12, color: DARK_FG, fontWeight: "700" }} />
              </FlexWidget>
            ))}
          </FlexWidget>
          <FlexWidget style={{ width: 80, flexDirection: "row", borderLeftWidth: 1, borderColor: "#e0e0e0" }}>
            <FlexWidget style={{ flex: 1, alignItems: "center" }}><TextWidget text={String(rheb.home.r)} style={{ fontSize: 12, color: "#d32f2f", fontWeight: "700" }} /></FlexWidget>
            <FlexWidget style={{ flex: 1, alignItems: "center" }}><TextWidget text={String(rheb.home.h)} style={{ fontSize: 12, color: DARK_FG, fontWeight: "700" }} /></FlexWidget>
            <FlexWidget style={{ flex: 1, alignItems: "center" }}><TextWidget text={String(rheb.home.e)} style={{ fontSize: 12, color: DARK_FG, fontWeight: "700" }} /></FlexWidget>
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>

      {/* 4. Bottom Detailed Info */}
      <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "match_parent" }}>
        {isScheduled ? (
          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            <TextWidget text={`원정 선발: ${game.awayStarter || "?"}`} style={{ fontSize: 12, color: DARK_FG, marginRight: 16 }} />
            <TextWidget text={`홈 선발: ${game.homeStarter || "?"}`} style={{ fontSize: 12, color: DARK_FG }} />
          </FlexWidget>
        ) : isLive ? (
          <>
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <TextWidget text={`P: ${game.relay?.pitcher?.name || "?"}`} style={{ fontSize: 12, color: DARK_FG, fontWeight: "700", marginRight: 16 }} />
              <TextWidget text={`B: ${game.relay?.batter?.name || "?"}`} style={{ fontSize: 12, color: DARK_FG, fontWeight: "700" }} />
            </FlexWidget>
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              {/* BSO */}
              <FlexWidget style={{ marginRight: 16 }}>
                <FlexWidget style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                  <TextWidget text="B " style={{ fontSize: 10, color: "#43a047", fontWeight: "700" }} />
                  <TextWidget text={"●".repeat(parseInt(game.relay?.ball||"0")) + "○".repeat(3 - parseInt(game.relay?.ball||"0"))} style={{ fontSize: 10, color: "#43a047" }} />
                </FlexWidget>
                <FlexWidget style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                  <TextWidget text="S " style={{ fontSize: 10, color: "#f9a825", fontWeight: "700" }} />
                  <TextWidget text={"●".repeat(parseInt(game.relay?.strike||"0")) + "○".repeat(2 - parseInt(game.relay?.strike||"0"))} style={{ fontSize: 10, color: "#f9a825" }} />
                </FlexWidget>
                <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
                  <TextWidget text="O " style={{ fontSize: 10, color: "#e53935", fontWeight: "700" }} />
                  <TextWidget text={"●".repeat(parseInt(game.relay?.out||"0")) + "○".repeat(2 - parseInt(game.relay?.out||"0"))} style={{ fontSize: 10, color: "#e53935" }} />
                </FlexWidget>
              </FlexWidget>
              {/* Diamond */}
              <BaseSituation b1={game.relay?.base1} b2={game.relay?.base2} b3={game.relay?.base3} size={14} />
            </FlexWidget>
          </>
        ) : (
          <TextWidget text="경기가 종료되었습니다." style={{ fontSize: 12, color: DARK_FG }} />
        )}
      </FlexWidget>

    </FlexWidget>
  );
}

function BaseSituation({ b1, b2, b3, size }: { b1?: string, b2?: string, b3?: string, size: number }) {
  const activeColor = "#e07b3c";
  const inactiveColor = "#d0d0d0";
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
