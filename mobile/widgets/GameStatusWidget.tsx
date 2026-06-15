import { FlexWidget, TextWidget } from "react-native-android-widget";

interface WidgetGameData {
  homeTeam: string;
  awayTeam: string;
  homeScore: string;
  awayScore: string;
  inning: string;
  isTop: string;
  status: string;
  ball?: string;
  strike?: string;
  out?: string;
  base1?: string;
  base2?: string;
  base3?: string;
}

interface WidgetProps {
  width: number;
  height: number;
  data: WidgetGameData | null;
  myTeam: string;
}

export function GameStatusWidget({ width, height, data, myTeam }: WidgetProps) {
  if (!data) {
    return noGameView();
  }

  // 2x1 / very short: just score
  if (height < 80) {
    return compactScoreView(data, myTeam);
  }

  // 2x2 / narrow: compact score + status
  if (width < 230) {
    return smallView(data, myTeam);
  }

  // 4x2+ / standard: full scoreboard
  return main4x2View(data, myTeam);
}

/* ============ No Game ============ */
function noGameView() {
  return (
    <FlexWidget
      style={{
        width: "match_parent",
        height: "match_parent",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#ffffff",
        borderRadius: 16,
      }}
    >
      <TextWidget text="오늘의 경기 없음" fontSize={14} textColor="#666666" />
    </FlexWidget>
  );
}

/* ============ Compact (2x1, 4x1) ============ */
function compactScoreView(data: WidgetGameData, myTeam: string) {
  const isMyHome = data.homeTeam === myTeam;
  const myScore = isMyHome ? data.homeScore : data.awayScore;
  const oppScore = isMyHome ? data.awayScore : data.homeScore;
  const oppTeam = isMyHome ? data.awayTeam : data.homeTeam;

  return (
    <FlexWidget
      style={{
        width: "match_parent",
        height: "match_parent",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-evenly",
        backgroundColor: "#ffffff",
        borderRadius: 12,
        paddingHorizontal: 8,
      }}
    >
      <TextWidget text={myScore} fontSize={22} fontWeight="700" textColor="#222" />
      <TextWidget text=":" fontSize={14} textColor="#999" />
      <TextWidget text={oppScore} fontSize={22} fontWeight="700" textColor="#888" />
      <TextWidget text={oppTeam} fontSize={11} textColor="#888" />
    </FlexWidget>
  );
}

/* ============ Small (2x2, narrow) ============ */
function smallView(data: WidgetGameData, myTeam: string) {
  const statusText = data.status === "live"
    ? `LIVE ${data.inning}회${data.isTop === "1" ? "초" : "말"}`
    : data.status === "finished"
      ? "종료"
      : data.status === "cancelled"
        ? "취소"
        : `${data.inning}회`;

  return (
    <FlexWidget
      style={{
        width: "match_parent",
        height: "match_parent",
        padding: 10,
        justifyContent: "center",
        backgroundColor: "#ffffff",
        borderRadius: 16,
      }}
    >
      {/* Status badge */}
      <FlexWidget style={{ alignItems: "center", marginBottom: 6 }}>
        <TextWidget text={statusText} fontSize={10} fontWeight="700" textColor={data.status === "live" ? "#ef4444" : "#999"} />
      </FlexWidget>
      {/* Score row */}
      <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
        <FlexWidget style={{ alignItems: "center", flex: 1 }}>
          <TextWidget text={data.awayTeam} fontSize={13} fontWeight="600" textColor="#666" />
          <TextWidget text={data.awayScore} fontSize={28} fontWeight="700" textColor="#222" />
        </FlexWidget>
        <TextWidget text=":" fontSize={16} textColor="#ccc" style={{ marginHorizontal: 4 }} />
        <FlexWidget style={{ alignItems: "center", flex: 1 }}>
          <TextWidget text={data.homeTeam} fontSize={13} fontWeight="600" textColor="#666" />
          <TextWidget text={data.homeScore} fontSize={28} fontWeight="700" textColor="#222" />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

/* ============ Full 4x2+ Scoreboard ============ */
function main4x2View(data: WidgetGameData, myTeam: string) {
  const isMyHome = data.homeTeam === myTeam;

  let statusText = "경기 전";
  let statusColor = "#666666";
  if (data.status === "live") {
    statusText = `LIVE ${data.inning}회${data.isTop === "1" ? "초" : "말"}`;
    statusColor = "#ef4444";
  } else if (data.status === "finished") {
    statusText = "경기 종료";
  } else if (data.status === "cancelled") {
    statusText = "취소";
  } else {
    statusText = `${data.inning}회`;
  }

  const b = parseInt(data.ball || "0", 10);
  const s = parseInt(data.strike || "0", 10);
  const o = parseInt(data.out || "0", 10);
  const b1 = data.base1 === "1";
  const b2 = data.base2 === "1";
  const b3 = data.base3 === "1";

  return (
    <FlexWidget
      style={{
        width: "match_parent",
        height: "match_parent",
        backgroundColor: "#ffffff",
        borderRadius: 16,
        padding: 14,
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {/* Header: Status */}
      <FlexWidget style={{ flexDirection: "row", justifyContent: "center", marginBottom: 6 }}>
        <FlexWidget
          style={{
            backgroundColor: data.status === "live" ? "#fef2f2" : "#f5f5f5",
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 12,
          }}
        >
          <TextWidget text={statusText} fontSize={11} fontWeight="700" textColor={statusColor} />
        </FlexWidget>
      </FlexWidget>

      {/* Main Score Area */}
      <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-around", flex: 1 }}>
        {/* Away Team */}
        <FlexWidget style={{ alignItems: "center", flex: 1 }}>
          <TextWidget text={data.awayTeam} fontSize={15} fontWeight="700" textColor={!isMyHome ? "#222" : "#666"} />
          <TextWidget text={data.awayScore} fontSize={34} fontWeight="700" textColor={!isMyHome ? "#222" : "#666"} />
        </FlexWidget>

        {/* BSO */}
        <FlexWidget style={{ alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
          {data.status === "live" ? (
            <FlexWidget style={{ alignItems: "center", gap: 5 }}>
              <BsoIndicator label="B" count={b} max={3} activeColor="#4caf50" />
              <BsoIndicator label="S" count={s} max={2} activeColor="#f7d44a" />
              <BsoIndicator label="O" count={o} max={2} activeColor="#ef4444" />
            </FlexWidget>
          ) : (
            <TextWidget text="VS" fontSize={18} fontWeight="700" textColor="#dddddd" />
          )}
        </FlexWidget>

        {/* Home Team */}
        <FlexWidget style={{ alignItems: "center", flex: 1 }}>
          <TextWidget text={data.homeTeam} fontSize={15} fontWeight="700" textColor={isMyHome ? "#222" : "#666"} />
          <TextWidget text={data.homeScore} fontSize={34} fontWeight="700" textColor={isMyHome ? "#222" : "#666"} />
        </FlexWidget>
      </FlexWidget>

      {/* Footer: Base Runners (live only) */}
      {data.status === "live" && (
        <FlexWidget style={{ flexDirection: "row", justifyContent: "center", marginTop: 6 }}>
          <FlexWidget
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#f8f9fa",
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 16,
              gap: 6,
            }}
          >
            <TextWidget text="주자" fontSize={10} fontWeight="700" textColor="#888" />
            <FlexWidget style={{ flexDirection: "row", gap: 3 }}>
              <BaseIndicator active={b3} label="3" />
              <BaseIndicator active={b2} label="2" />
              <BaseIndicator active={b1} label="1" />
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

function BsoIndicator({ label, count, max, activeColor }: { label: string; count: number; max: number; activeColor: string }) {
  const circles = [];
  for (let i = 0; i < max; i++) {
    circles.push(
      <FlexWidget
        key={i}
        style={{
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: i < count ? activeColor : "#eeeeee",
          marginHorizontal: 1,
        }}
      />
    );
  }

  return (
    <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
      <TextWidget text={label} fontSize={9} fontWeight="700" textColor="#999999" style={{ width: 10 }} />
      {circles}
    </FlexWidget>
  );
}

function BaseIndicator({ active, label }: { active: boolean; label: string }) {
  return (
    <FlexWidget
      style={{
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 15,
        backgroundColor: active ? "#ff9800" : "#e0e0e0",
        borderRadius: 4,
      }}
    >
      <TextWidget text={label} fontSize={8} fontWeight="700" textColor={active ? "#ffffff" : "#999999"} />
    </FlexWidget>
  );
}
