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
  return main4x2View(data, myTeam);
}

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
      <TextWidget text="오늘의 경기 없음" fontSize={16} textColor="#666666" />
    </FlexWidget>
  );
}

function main4x2View(data: WidgetGameData, myTeam: string) {
  const isMyHome = data.homeTeam === myTeam;
  // Status string
  let statusText = "경기 전";
  let statusColor = "#666666";
  if (data.status === "live") {
    statusText = `LIVE ${data.inning}회${data.isTop === "1" ? "초" : "말"}`;
    statusColor = "#ef4444"; // Red for live
  } else if (data.status === "finished") {
    statusText = "경기 종료";
  } else if (data.status === "cancelled") {
    statusText = "취소";
  } else {
    statusText = `${data.inning}회`; // Scheduled time or inning
  }

  // BSO colors
  const b = parseInt(data.ball || "0", 10);
  const s = parseInt(data.strike || "0", 10);
  const o = parseInt(data.out || "0", 10);

  // Bases
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
        padding: 16,
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {/* Header: Status */}
      <FlexWidget style={{ flexDirection: "row", justifyContent: "center", marginBottom: 8 }}>
        <FlexWidget style={{ backgroundColor: data.status === "live" ? "#fef2f2" : "#f5f5f5", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
          <TextWidget text={statusText} fontSize={12} fontWeight="700" textColor={statusColor} />
        </FlexWidget>
      </FlexWidget>

      {/* Main Score Area */}
      <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-around", flex: 1 }}>
        {/* Away Team */}
        <FlexWidget style={{ alignItems: "center", flex: 1 }}>
          <TextWidget text={data.awayTeam} fontSize={16} fontWeight="700" textColor={!isMyHome ? "#222" : "#666"} />
          <TextWidget text={data.awayScore} fontSize={36} fontWeight="700" textColor={!isMyHome ? "#222" : "#666"} />
        </FlexWidget>

        {/* VS / BSO */}
        <FlexWidget style={{ alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }}>
          {data.status === "live" ? (
            <FlexWidget style={{ alignItems: "center", gap: 6 }}>
              <BsoIndicator label="B" count={b} max={3} activeColor="#4caf50" />
              <BsoIndicator label="S" count={s} max={2} activeColor="#f7d44a" />
              <BsoIndicator label="O" count={o} max={2} activeColor="#ef4444" />
            </FlexWidget>
          ) : (
            <TextWidget text="VS" fontSize={20} fontWeight="700" textColor="#dddddd" />
          )}
        </FlexWidget>

        {/* Home Team */}
        <FlexWidget style={{ alignItems: "center", flex: 1 }}>
          <TextWidget text={data.homeTeam} fontSize={16} fontWeight="700" textColor={isMyHome ? "#222" : "#666"} />
          <TextWidget text={data.homeScore} fontSize={36} fontWeight="700" textColor={isMyHome ? "#222" : "#666"} />
        </FlexWidget>
      </FlexWidget>

      {/* Footer: Base Runners (Only shown if live) */}
      {data.status === "live" && (
        <FlexWidget style={{ flexDirection: "row", justifyContent: "center", marginTop: 8 }}>
           <FlexWidget style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#f8f9fa", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 8 }}>
             <TextWidget text="주자" fontSize={11} fontWeight="700" textColor="#888" />
             <FlexWidget style={{ flexDirection: "row", gap: 4 }}>
                <BaseIndicator active={b3} label="3루" />
                <BaseIndicator active={b2} label="2루" />
                <BaseIndicator active={b1} label="1루" />
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
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: i < count ? activeColor : "#eeeeee",
          marginHorizontal: 2,
        }}
      />
    );
  }

  return (
    <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
      <TextWidget text={label} fontSize={10} fontWeight="700" textColor="#999999" style={{ width: 12 }} />
      {circles}
    </FlexWidget>
  );
}

function BaseIndicator({ active, label }: { active: boolean; label: string }) {
  return (
    <FlexWidget style={{ alignItems: "center", justifyContent: "center", width: 24, height: 16, backgroundColor: active ? "#ff9800" : "#e0e0e0", borderRadius: 4 }}>
      <TextWidget text={label} fontSize={9} fontWeight="700" textColor={active ? "#ffffff" : "#999999"} />
    </FlexWidget>
  );
}
