import sys

with open('mobile/widgets/GameStatusWidget.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

def replace_block(content, func_name, new_content):
    start_idx = content.find(f"function {func_name}(data: WidgetGameData) {{")
    if start_idx == -1:
        print(f"Error: {func_name} not found")
        sys.exit(1)
    
    brace_count = 0
    end_idx = -1
    for i in range(start_idx, len(content)):
        if content[i] == '{':
            brace_count += 1
        elif content[i] == '}':
            brace_count -= 1
            if brace_count == 0:
                end_idx = i + 1
                break
    
    if end_idx == -1:
        print(f"Error: Could not find end of {func_name}")
        sys.exit(1)
        
    return content[:start_idx] + new_content + content[end_idx:]

view2x1 = """function view2x1(data: WidgetGameData) {
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
          <FlexWidget style={{ alignItems: "center", marginTop: 4 }}>
            <TextWidget text={data.stadium || "경기 전"} style={{ fontSize: 10, color: alpha(DARK_FG, "88") }} />
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
              <TextWidget text=" : " style={{ fontSize: 14, color: alpha(DARK_FG, "44"), marginHorizontal: 4 }} />
              <TextWidget text={home.scoreText} style={{ fontSize: 20, fontWeight: "700", color: home.scoreColor }} />
            </FlexWidget>
            <TextWidget text={home.teamName} style={{ fontSize: 13, fontWeight: "700", color: home.nameColor }} />
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center", marginTop: 4 }}>
            <TextWidget text="경기 종료" style={{ fontSize: 10, fontWeight: "700", color: DARK_FG }} />
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
                <TextWidget text=" : " style={{ fontSize: 14, color: alpha(DARK_FG, "44"), marginHorizontal: 4 }} />
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
}"""

view4x1 = """function view4x1(data: WidgetGameData) {
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
            <TextWidget text={away.pbText || away.teamName} style={{ fontSize: 11, fontWeight: "700", color: away.nameColor, marginTop: 4 }} />
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center" }}>
            <TextWidget text="경기 전" style={{ fontSize: 10, fontWeight: "700", color: alpha(DARK_FG, "88"), marginBottom: 2 }} />
            <TextWidget text={data.time || "VS"} style={{ fontSize: 24, fontWeight: "700", color: DARK_FG }} />
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center" }}>
            <ImageWidget image={home.charImage} imageWidth={32} imageHeight={32} />
            <TextWidget text={home.pbText || home.teamName} style={{ fontSize: 11, fontWeight: "700", color: home.nameColor, marginTop: 4 }} />
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
            {awayWon && <TextWidget text="WIN" style={{ fontSize: 10, fontWeight: "700", color: "#d32f2f", marginTop: 2 }} />}
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center" }}>
            <TextWidget text="경기 종료" style={{ fontSize: 10, fontWeight: "700", color: DARK_FG, marginBottom: 2 }} />
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <TextWidget text={away.scoreText} style={{ fontSize: 28, fontWeight: "700", color: awayWon ? away.scoreColor : alpha(away.scoreColor, "77") }} />
              <TextWidget text=" : " style={{ fontSize: 18, color: alpha(DARK_FG, "44"), marginHorizontal: 6 }} />
              <TextWidget text={home.scoreText} style={{ fontSize: 28, fontWeight: "700", color: homeWon ? home.scoreColor : alpha(home.scoreColor, "77") }} />
            </FlexWidget>
          </FlexWidget>
          <FlexWidget style={{ alignItems: "center" }}>
            <ImageWidget image={home.charImage} imageWidth={32} imageHeight={32} />
            {homeWon && <TextWidget text="WIN" style={{ fontSize: 10, fontWeight: "700", color: "#d32f2f", marginTop: 2 }} />}
          </FlexWidget>
        </FlexWidget>
      </ColorBg>
    );
  }

  return (
    <ColorBg>
      <FlexWidget style={{ flex: 1, flexDirection: "column", padding: 8, paddingHorizontal: 16, width: "match_parent" }}>
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
            <TextWidget text="↻" style={{ fontSize: 16, color: "#e07b3c", fontWeight: "700" }} />
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            <ImageWidget image={away.charImage} imageWidth={32} imageHeight={32} />
            <FlexWidget style={{ width: 8 }} />
            <TextWidget text={away.teamName} style={{ fontSize: 14, fontWeight: "700", color: away.nameColor }} />
            <FlexWidget style={{ width: 8 }} />
            {away.pbText ? <TextWidget text={away.pbText} style={{ fontSize: 10, color: DARK_FG }} /> : <FlexWidget />}
          </FlexWidget>

          <FlexWidget style={{ marginHorizontal: 12, flexDirection: "row", alignItems: "center" }}>
            {isCancelled ? (
              <TextWidget text="우천 취소" style={{ fontSize: 16, fontWeight: "700", color: DARK_FG }} />
            ) : (
              <>
                <TextWidget text={away.scoreText} style={{ fontSize: 28, fontWeight: "700", color: away.scoreColor }} />
                <TextWidget text=" : " style={{ fontSize: 18, color: alpha(DARK_FG, "44"), marginHorizontal: 6 }} />
                <TextWidget text={home.scoreText} style={{ fontSize: 28, fontWeight: "700", color: home.scoreColor }} />
              </>
            )}
          </FlexWidget>

          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            {home.pbText ? <TextWidget text={home.pbText} style={{ fontSize: 10, color: DARK_FG }} /> : <FlexWidget />}
            <FlexWidget style={{ width: 8 }} />
            <TextWidget text={home.teamName} style={{ fontSize: 14, fontWeight: "700", color: home.nameColor }} />
            <FlexWidget style={{ width: 8 }} />
            <ImageWidget image={home.charImage} imageWidth={32} imageHeight={32} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </ColorBg>
  );
}"""

view2x2 = """function view2x2(data: WidgetGameData) {
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
          <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", width: "match_parent" }}>
            <TextWidget text="오늘 경기" style={{ fontSize: 11, fontWeight: "700", color: alpha(DARK_FG, "88") }} />
            <TextWidget text={data.time || "VS"} style={{ fontSize: 14, fontWeight: "700", color: DARK_FG }} />
          </FlexWidget>

          <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent", paddingHorizontal: 12 }}>
            <ImageWidget image={away.charImage} imageWidth={40} imageHeight={40} />
            <TextWidget text="VS" style={{ fontSize: 16, fontWeight: "700", color: alpha(DARK_FG, "55") }} />
            <ImageWidget image={home.charImage} imageWidth={40} imageHeight={40} />
          </FlexWidget>

          <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", width: "match_parent", marginTop: 4 }}>
            <FlexWidget style={{ alignItems: "center", width: 60 }}>
              <TextWidget text={away.teamName} style={{ fontSize: 13, fontWeight: "700", color: away.nameColor }} />
              {away.pbText && <TextWidget text={away.pbText} style={{ fontSize: 10, color: DARK_FG, marginTop: 4 }} />}
            </FlexWidget>
            <FlexWidget style={{ alignItems: "center", width: 60 }}>
              <TextWidget text={home.teamName} style={{ fontSize: 13, fontWeight: "700", color: home.nameColor }} />
              {home.pbText && <TextWidget text={home.pbText} style={{ fontSize: 10, color: DARK_FG, marginTop: 4 }} />}
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
          <FlexWidget style={{ flexDirection: "row", justifyContent: "center", width: "match_parent", marginBottom: 8 }}>
            <TextWidget text="경기 종료" style={{ fontSize: 12, fontWeight: "700", color: alpha(DARK_FG, "88") }} />
          </FlexWidget>

          <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
            <FlexWidget style={{ alignItems: "center", flex: 1 }}>
              <TextWidget text={away.teamName} style={{ fontSize: 12, fontWeight: "700", color: away.nameColor, marginBottom: 4 }} />
              <TextWidget text={away.scoreText} style={{ fontSize: 32, fontWeight: "700", color: awayWon ? away.scoreColor : alpha(away.scoreColor, "77") }} />
              {awayWon && <TextWidget text="WIN" style={{ fontSize: 10, fontWeight: "700", color: "#d32f2f", marginTop: 4 }} />}
            </FlexWidget>

            <TextWidget text=" : " style={{ fontSize: 16, color: alpha(DARK_FG, "44") }} />

            <FlexWidget style={{ alignItems: "center", flex: 1 }}>
              <TextWidget text={home.teamName} style={{ fontSize: 12, fontWeight: "700", color: home.nameColor, marginBottom: 4 }} />
              <TextWidget text={home.scoreText} style={{ fontSize: 32, fontWeight: "700", color: homeWon ? home.scoreColor : alpha(home.scoreColor, "77") }} />
              {homeWon && <TextWidget text="WIN" style={{ fontSize: 10, fontWeight: "700", color: "#d32f2f", marginTop: 4 }} />}
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
          <TextWidget text={head.isLive ? head.statusText : (data.stadium || "")} style={{ fontSize: 11, fontWeight: "700", color: head.isLive ? "#e07b3c" : alpha(DARK_FG, "88") }} />
          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            <TextWidget text={data.weather || ""} style={{ fontSize: 11, color: alpha(DARK_FG, "88"), marginRight: 8 }} />
            <FlexWidget clickAction="REFRESH" style={{ padding: 2 }}>
              <TextWidget text="↻" style={{ fontSize: 14, color: "#e07b3c", fontWeight: "700" }} />
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ alignItems: "center", height: 26, justifyContent: "center" }}>
          {head.isLive ? <BaseSituation b1={data.base1} b2={data.base2} b3={data.base3} size={8} /> : <FlexWidget />}
        </FlexWidget>

        <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
          <ImageWidget image={away.charImage} imageWidth={32} imageHeight={32} />
          <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", flex: 1 }}>
            {isCancelled ? (
              <TextWidget text="취소" style={{ fontSize: 18, fontWeight: "700", color: DARK_FG }} />
            ) : (
              <>
                <TextWidget text={away.scoreText} style={{ fontSize: 26, fontWeight: "700", color: away.scoreColor }} />
                <TextWidget text=" : " style={{ fontSize: 16, color: alpha(DARK_FG, "44"), marginHorizontal: 6 }} />
                <TextWidget text={home.scoreText} style={{ fontSize: 26, fontWeight: "700", color: home.scoreColor }} />
              </>
            )}
          </FlexWidget>
          <ImageWidget image={home.charImage} imageWidth={32} imageHeight={32} />
        </FlexWidget>

        <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", width: "match_parent", marginTop: 4 }}>
          <FlexWidget style={{ alignItems: "flex-start", width: 60 }}>
            <TextWidget text={away.teamName} style={{ fontSize: 13, fontWeight: "700", color: away.nameColor }} />
            {away.pbText ? <TextWidget text={away.pbText} style={{ fontSize: 10, color: DARK_FG, marginTop: 2 }} /> : <FlexWidget />}
          </FlexWidget>
          
          <FlexWidget style={{ alignItems: "flex-end", width: 60 }}>
            <TextWidget text={home.teamName} style={{ fontSize: 13, fontWeight: "700", color: home.nameColor }} />
            {home.pbText ? <TextWidget text={home.pbText} style={{ fontSize: 10, color: DARK_FG, marginTop: 2 }} /> : <FlexWidget />}
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
}"""

view4x2 = """function view4x2(data: WidgetGameData) {
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
            <TextWidget text={data.stadium || "경기장 미정"} style={{ fontSize: 13, fontWeight: "700", color: alpha(DARK_FG, "88") }} />
            <TextWidget text={data.weather || ""} style={{ fontSize: 13, color: alpha(DARK_FG, "88") }} />
          </FlexWidget>

          <FlexWidget style={{ flex: 1 }} />

          <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
            <FlexWidget style={{ alignItems: "center", width: 100 }}>
              <ImageWidget image={away.charImage} imageWidth={56} imageHeight={56} />
              <FlexWidget style={{ height: 8 }} />
              <TextWidget text={away.teamName} style={{ fontSize: 16, fontWeight: "700", color: away.nameColor }} />
              {away.pbText && <TextWidget text={away.pbText} style={{ fontSize: 12, color: DARK_FG, marginTop: 4 }} />}
            </FlexWidget>

            <FlexWidget style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <TextWidget text="경기 전" style={{ fontSize: 14, fontWeight: "700", color: alpha(DARK_FG, "88"), marginBottom: 4 }} />
              <TextWidget text={data.time || "VS"} style={{ fontSize: 36, fontWeight: "700", color: DARK_FG }} />
            </FlexWidget>

            <FlexWidget style={{ alignItems: "center", width: 100 }}>
              <ImageWidget image={home.charImage} imageWidth={56} imageHeight={56} />
              <FlexWidget style={{ height: 8 }} />
              <TextWidget text={home.teamName} style={{ fontSize: 16, fontWeight: "700", color: home.nameColor }} />
              {home.pbText && <TextWidget text={home.pbText} style={{ fontSize: 12, color: DARK_FG, marginTop: 4 }} />}
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
            <TextWidget text="경기 종료" style={{ fontSize: 14, fontWeight: "700", color: alpha(DARK_FG, "88") }} />
          </FlexWidget>

          <FlexWidget style={{ flex: 1 }} />

          <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
            <FlexWidget style={{ alignItems: "center", width: 100 }}>
              <ImageWidget image={away.charImage} imageWidth={56} imageHeight={56} />
              <FlexWidget style={{ height: 8 }} />
              <TextWidget text={away.teamName} style={{ fontSize: 16, fontWeight: "700", color: away.nameColor }} />
              {awayWon && <TextWidget text="승리" style={{ fontSize: 14, fontWeight: "700", color: "#d32f2f", marginTop: 4 }} />}
            </FlexWidget>

            <FlexWidget style={{ flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "row" }}>
              <TextWidget text={away.scoreText} style={{ fontSize: 48, fontWeight: "700", color: awayWon ? away.scoreColor : alpha(away.scoreColor, "77") }} />
              <TextWidget text=" : " style={{ fontSize: 28, fontWeight: "700", color: alpha(DARK_FG, "44"), marginHorizontal: 16 }} />
              <TextWidget text={home.scoreText} style={{ fontSize: 48, fontWeight: "700", color: homeWon ? home.scoreColor : alpha(home.scoreColor, "77") }} />
            </FlexWidget>

            <FlexWidget style={{ alignItems: "center", width: 100 }}>
              <ImageWidget image={home.charImage} imageWidth={56} imageHeight={56} />
              <FlexWidget style={{ height: 8 }} />
              <TextWidget text={home.teamName} style={{ fontSize: 16, fontWeight: "700", color: home.nameColor }} />
              {homeWon && <TextWidget text="승리" style={{ fontSize: 14, fontWeight: "700", color: "#d32f2f", marginTop: 4 }} />}
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
            <TextWidget text="↻" style={{ fontSize: 20, color: "#e07b3c", fontWeight: "700" }} />
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ flex: 1 }} />

        <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
          <FlexWidget style={{ alignItems: "center", width: 72 }}>
            <ImageWidget image={away.charImage} imageWidth={48} imageHeight={48} />
            <FlexWidget style={{ height: 4 }} />
            <TextWidget text={away.teamName} style={{ fontSize: 15, fontWeight: "700", color: away.nameColor }} />
            {away.pbText ? <TextWidget text={away.pbText} style={{ fontSize: 11, color: DARK_FG, marginTop: 4 }} /> : <FlexWidget />}
          </FlexWidget>

          <FlexWidget style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
              {isCancelled ? (
                <TextWidget text="우천 취소" style={{ fontSize: 28, fontWeight: "700", color: DARK_FG }} />
              ) : (
                <>
                  <TextWidget text={away.scoreText} style={{ fontSize: 40, fontWeight: "700", color: away.scoreColor }} />
                  <TextWidget text=" : " style={{ fontSize: 24, fontWeight: "700", color: alpha(DARK_FG, "44"), marginHorizontal: 12 }} />
                  <TextWidget text={home.scoreText} style={{ fontSize: 40, fontWeight: "700", color: home.scoreColor }} />
                </>
              )}
            </FlexWidget>
          </FlexWidget>

          <FlexWidget style={{ alignItems: "center", width: 72 }}>
            <ImageWidget image={home.charImage} imageWidth={48} imageHeight={48} />
            <FlexWidget style={{ height: 4 }} />
            <TextWidget text={home.teamName} style={{ fontSize: 15, fontWeight: "700", color: home.nameColor }} />
            {home.pbText ? <TextWidget text={home.pbText} style={{ fontSize: 11, color: DARK_FG, marginTop: 4 }} /> : <FlexWidget />}
          </FlexWidget>
        </FlexWidget>
        
        <FlexWidget style={{ flex: 1 }} />
      </FlexWidget>
    </ColorBg>
  );
}"""

content = replace_block(content, "view2x1", view2x1)
content = replace_block(content, "view4x1", view4x1)
content = replace_block(content, "view2x2", view2x2)
content = replace_block(content, "view4x2", view4x2)

with open('mobile/widgets/GameStatusWidget.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
