import re

with open("mobile/widgets/GameStatusWidget.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Remove anything from line 610 onwards (the garbage lines)
lines = content.split('\n')
valid_lines = lines[:609] # Keep up to line 609
new_content = '\n'.join(valid_lines)

# Append view4x2
view4x2_code = """
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
            <TextWidget text={`${data.stadium || "오늘 경기"} ${data.weather || ""}`.trim()} style={{ fontSize: 13, fontWeight: "700", color: alpha(DARK_FG, "88") }} />
            <FlexWidget clickAction="REFRESH" style={{ paddingLeft: 8, paddingVertical: 2 }}><TextWidget text="↻" style={{ fontSize: 18, color: "#e07b3c", fontWeight: "700" }} /></FlexWidget>
          </FlexWidget>

          <FlexWidget style={{ flex: 1 }} />

          <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
            <FlexWidget style={{ alignItems: "center", width: 100 }}>
              {data.awayRank && (
                <FlexWidget style={{ alignItems: "center", marginBottom: 6 }}>
                  <TextWidget text={`${data.awayRank}위`} style={{ fontSize: 11, fontWeight: "700", color: alpha(DARK_FG, "88") }} />
                  {data.awayStreak && <FlexWidget style={{ marginTop: 2 }}><TextWidget text={data.awayStreak.startsWith("최근") ? data.awayStreak : `최근 ${data.awayStreak}`} style={{ fontSize: 11, color: alpha(DARK_FG, "88") }} /></FlexWidget>}
                </FlexWidget>
              )}
              <ImageWidget image={away.charImage} imageWidth={56} imageHeight={56} />
              <FlexWidget style={{ height: 8 }} />
              <TextWidget text={away.teamName} style={{ fontSize: 16, fontWeight: "700", color: away.nameColor }} />
              {away.pbText && <FlexWidget style={{marginTop: 4}}><TextWidget text={away.pbText} style={{ fontSize: 12, color: DARK_FG }} /></FlexWidget>}
            </FlexWidget>

            <FlexWidget style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <FlexWidget style={{marginBottom: 4}}><TextWidget text="경기 전" style={{ fontSize: 14, fontWeight: "700", color: alpha(DARK_FG, "88") }} /></FlexWidget>
              <TextWidget text={data.time || "VS"} style={{ fontSize: 28, fontWeight: "700", color: DARK_FG }} />
            </FlexWidget>

            <FlexWidget style={{ alignItems: "center", width: 100 }}>
              {data.homeRank && (
                <FlexWidget style={{ alignItems: "center", marginBottom: 6 }}>
                  <TextWidget text={`${data.homeRank}위`} style={{ fontSize: 11, fontWeight: "700", color: alpha(DARK_FG, "88") }} />
                  {data.homeStreak && <FlexWidget style={{ marginTop: 2 }}><TextWidget text={data.homeStreak.startsWith("최근") ? data.homeStreak : `최근 ${data.homeStreak}`} style={{ fontSize: 11, color: alpha(DARK_FG, "88") }} /></FlexWidget>}
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
            <TextWidget text={`${data.stadium || "오늘 경기"} ${data.weather || ""}`.trim()} style={{ fontSize: 13, color: alpha(DARK_FG, "88") }} />
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <TextWidget text="경기 종료" style={{ fontSize: 14, fontWeight: "700", color: alpha(DARK_FG, "88") }} />
              <FlexWidget clickAction="REFRESH" style={{ paddingLeft: 8, paddingVertical: 2 }}><TextWidget text="↻" style={{ fontSize: 18, color: "#e07b3c", fontWeight: "700" }} /></FlexWidget>
            </FlexWidget>
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
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", width: "match_parent", justifyContent: "space-between" }}>
          <TextWidget text={head.isLive ? head.statusText : (data.stadium || "오늘 경기")} style={{ fontSize: 13, fontWeight: "700", color: head.isLive ? "#e07b3c" : alpha(DARK_FG, "88") }} />
          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            <FlexWidget style={{marginRight: 8}}><TextWidget text={`${data.stadium || ""} ${data.weather || ""}`.trim()} style={{ fontSize: 12, color: alpha(DARK_FG, "88") }} /></FlexWidget>
            <FlexWidget clickAction="REFRESH" style={{ padding: 4 }}>
              <TextWidget text="↻" style={{ fontSize: 20, color: "#e07b3c", fontWeight: "700" }} />
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ flex: 1 }} />

        <FlexWidget style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}>
          <FlexWidget style={{ alignItems: "center", width: 72 }}>
            {data.awayRank && (
              <FlexWidget style={{ alignItems: "center", marginBottom: 6 }}>
                <TextWidget text={`${data.awayRank}위`} style={{ fontSize: 11, fontWeight: "700", color: alpha(DARK_FG, "88") }} />
                {data.awayStreak && <FlexWidget style={{ marginTop: 2 }}><TextWidget text={data.awayStreak.startsWith("최근") ? data.awayStreak : `최근 ${data.awayStreak}`} style={{ fontSize: 11, color: alpha(DARK_FG, "88") }} /></FlexWidget>}
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
                {data.homeStreak && <FlexWidget style={{ marginTop: 2 }}><TextWidget text={data.homeStreak.startsWith("최근") ? data.homeStreak : `최근 ${data.homeStreak}`} style={{ fontSize: 11, color: alpha(DARK_FG, "88") }} /></FlexWidget>}
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
"""
new_content += "\n" + view4x2_code

# Replace view2x2 font sizes
# time is at top right
old_line = '<TextWidget text={data.time || "VS"} style={{ fontSize: 14, fontWeight: "700", color: DARK_FG }} />'
new_line = '<TextWidget text={data.time || "VS"} style={{ fontSize: 12, fontWeight: "700", color: DARK_FG }} />'
new_content = new_content.replace(old_line, new_line)

with open("mobile/widgets/GameStatusWidget.tsx", "w", encoding="utf-8") as f:
    f.write(new_content)

print("Fixed!")
