import type { JikgwanRecord } from "@/lib/db";
import {
  parseDateStr,
  filterByYear,
  filterByGameType,
  computeDiaryStats,
  computeStreakStats,
  computeOpponentStats,
  computeHomeAwayStats,
  computeDayOfWeekStats,
} from "@/lib/stats";

// ─── Helpers ────────────────────────────────────────────────

let nextId = 1;
function resetId() { nextId = 1; }

const baseRecord = (overrides: Partial<JikgwanRecord> = {}): JikgwanRecord => ({
  id: nextId++,
  game_id: "20260530-OBLG-0",
  date: "2026.05.30",
  cheered_team: "doosan",
  score_home: 5,
  score_away: 3,
  is_win: 1,
  game_type: null,
  stadium: "잠실",
  emotion: null,
  photo_path: null,
  photos: null,
  memo: null,
  created_at: "",
  three_line_1: null,
  three_line_2: null,
  three_line_3: null,
  frame_style: "classic",
  is_live: null,
  seat: null,
  is_cancelled: undefined,
  game_status: null,
  ...overrides,
});

function win(overrides: Partial<JikgwanRecord> = {}): JikgwanRecord {
  return baseRecord({ is_win: 1, ...overrides });
}

function loss(overrides: Partial<JikgwanRecord> = {}): JikgwanRecord {
  return baseRecord({ is_win: -1, ...overrides });
}

function draw(overrides: Partial<JikgwanRecord> = {}): JikgwanRecord {
  return baseRecord({ is_win: 0, ...overrides });
}

// game_id format: "YYYYMMDD-ABCD-N" where awayCode=first 2 chars, homeCode=last 2
// doosan="OB", lg="LG", ssg="SK", samsung="SS"
function gid(away: string, home: string, date = "20260530", suffix = "0"): string {
  return `${date}-${away}${home}-${suffix}`;
}

// ─── parseDateStr ───────────────────────────────────────────

describe("parseDateStr", () => {
  it("parses YYYY.MM.DD format", () => {
    const d = parseDateStr("2026.05.30");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4);
    expect(d!.getDate()).toBe(30);
  });

  it("parses YYYY-MM-DD format", () => {
    const d = parseDateStr("2026-05-30");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getDate()).toBe(30);
  });

  it("returns null for invalid format", () => {
    expect(parseDateStr("")).toBeNull();
    expect(parseDateStr("invalid")).toBeNull();
    expect(parseDateStr("20260530")).toBeNull();
  });
});

// ─── filterByYear ───────────────────────────────────────────

describe("filterByYear", () => {
  const records = [
    baseRecord({ date: "2025.06.01", id: 1 }),
    baseRecord({ date: "2026.05.30", id: 2 }),
    baseRecord({ date: "2026.06.01", id: 3 }),
    baseRecord({ date: "2027.01.01", id: 4 }),
  ];

  it("filters by year with dot format", () => {
    const r = filterByYear(records, 2026);
    expect(r).toHaveLength(2);
  });

  it("returns all when year is undefined", () => {
    expect(filterByYear(records, undefined)).toEqual(records);
  });

  it("returns empty when no match", () => {
    expect(filterByYear(records, 2020)).toHaveLength(0);
  });
});

// ─── filterByGameType ───────────────────────────────────────

describe("filterByGameType", () => {
  const regular = baseRecord({ game_type: null, id: 1 });
  const postseason = baseRecord({ game_type: "postseason", id: 2 });
  const exhibition = baseRecord({ game_type: "exhibition", id: 3 });

  it("returns all when gameType is undefined", () => {
    expect(filterByGameType([regular, postseason, exhibition], undefined)).toHaveLength(3);
  });

  it("filters regular (null game_type)", () => {
    const r = filterByGameType([regular, postseason, exhibition], "regular");
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe(1);
  });

  it("filters by specific game type", () => {
    const r = filterByGameType([regular, postseason, exhibition], "postseason");
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe(2);
  });
});

// ─── computeDiaryStats ──────────────────────────────────────

describe("computeDiaryStats", () => {
  beforeEach(() => resetId());

  it("counts wins, draws, losses and winRate", () => {
    const records = [
      win({ id: 1, date: "2026.05.01" }),
      win({ id: 2, date: "2026.05.02" }),
      loss({ id: 3, date: "2026.05.03" }),
      draw({ id: 4, date: "2026.05.04" }),
      win({ id: 5, date: "2026.05.05" }),
    ];
    const stats = computeDiaryStats(records);
    expect(stats.wins).toBe(3);
    expect(stats.losses).toBe(1);
    expect(stats.draws).toBe(1);
    expect(stats.totalGames).toBe(5);
    expect(stats.winRate).toBeCloseTo(0.6);
  });

  it("counts stadiums and emotions", () => {
    const records = [
      win({ stadium: "잠실", emotion: "happy", id: 1, date: "2026.05.01" }),
      win({ stadium: "잠실", emotion: "happy", id: 2, date: "2026.05.02" }),
      win({ stadium: "고척", emotion: "excited", id: 3, date: "2026.05.03" }),
    ];
    const stats = computeDiaryStats(records);
    expect(stats.stadiums).toEqual(expect.arrayContaining(["잠실", "고척"]));
    expect(stats.stadiums).toHaveLength(2);
    expect(stats.emotionCounts).toEqual({ happy: 2, excited: 1 });
  });

  it("handles empty records", () => {
    const stats = computeDiaryStats([]);
    expect(stats.totalGames).toBe(0);
    expect(stats.wins).toBe(0);
    expect(stats.winRate).toBe(0);
  });

  it("filters by year", () => {
    const records = [
      win({ id: 1, date: "2025.12.31" }),
      win({ id: 2, date: "2026.01.01" }),
    ];
    const s2025 = computeDiaryStats(records, 2025);
    expect(s2025.totalGames).toBe(1);
    const s2026 = computeDiaryStats(records, 2026);
    expect(s2026.totalGames).toBe(1);
  });

  it("0 wins has 0% winRate", () => {
    const stats = computeDiaryStats([loss({ id: 1, date: "2026.05.01" })]);
    expect(stats.winRate).toBe(0);
  });
});

// ─── computeStreakStats ─────────────────────────────────────

describe("computeStreakStats", () => {
  beforeEach(() => resetId());

  it("reports no streak for empty records", () => {
    const s = computeStreakStats([]);
    expect(s.currentType).toBeNull();
    expect(s.currentCount).toBe(0);
  });

  it("tracks a simple win streak (WWW L)", () => {
    const records = [
      win({ date: "2026.05.01", game_id: gid("OB", "LG", "20260501") }),
      win({ date: "2026.05.02", game_id: gid("OB", "LG", "20260502") }),
      win({ date: "2026.05.03", game_id: gid("OB", "LG", "20260503") }),
      loss({ date: "2026.05.04", game_id: gid("OB", "SK", "20260504") }),
    ];
    const s = computeStreakStats(records);
    expect(s.currentType).toBe("L");
    expect(s.currentCount).toBe(1);
    expect(s.longestWin).toBe(3);
    expect(s.longestLose).toBe(1);
  });

  it("tracks alternating streak correctly", () => {
    const records = [
      win({ date: "2026.05.01", game_id: gid("OB", "LG", "20260501") }),
      win({ date: "2026.05.02", game_id: gid("OB", "LG", "20260502") }),
      loss({ date: "2026.05.03", game_id: gid("OB", "LG", "20260503") }),
      loss({ date: "2026.05.04", game_id: gid("OB", "LG", "20260504") }),
      loss({ date: "2026.05.05", game_id: gid("OB", "LG", "20260505") }),
      win({ date: "2026.05.06", game_id: gid("OB", "LG", "20260506") }),
    ];
    const s = computeStreakStats(records);
    expect(s.currentType).toBe("W");
    expect(s.currentCount).toBe(1);
    expect(s.longestWin).toBe(2);
    expect(s.longestLose).toBe(3);
  });

  it("doubleheader both wins count separately in streak", () => {
    // DH 1차전 and 2차전 on the same day, different game_ids
    const records = [
      win({ date: "2026.05.30", game_id: gid("OB", "LG", "20260530", "0") }),
      win({ date: "2026.05.30", game_id: gid("OB", "LG", "20260530", "1") }),
      win({ date: "2026.05.31", game_id: gid("OB", "LG", "20260531") }),
    ];
    const s = computeStreakStats(records);
    expect(s.currentType).toBe("W");
    expect(s.currentCount).toBe(3);
    expect(s.longestWin).toBe(3);
  });

  it("draws are excluded from streak (neither break nor extend)", () => {
    const records = [
      win({ date: "2026.05.01", game_id: gid("OB", "LG", "20260501") }),
      win({ date: "2026.05.02", game_id: gid("OB", "LG", "20260502") }),
      draw({ date: "2026.05.03", game_id: gid("OB", "LG", "20260503") }),
      win({ date: "2026.05.04", game_id: gid("OB", "LG", "20260504") }),
    ];
    const s = computeStreakStats(records);
    // draw excluded: WWW (3 wins)
    expect(s.currentType).toBe("W");
    expect(s.currentCount).toBe(3);
    expect(s.longestWin).toBe(3);
  });

  it("longest lose streak detected correctly", () => {
    const records = [
      win({ date: "2026.05.01", game_id: gid("OB", "LG", "20260501") }),
      loss({ date: "2026.05.02", game_id: gid("OB", "LG", "20260502") }),
      loss({ date: "2026.05.03", game_id: gid("OB", "LG", "20260503") }),
      loss({ date: "2026.05.04", game_id: gid("OB", "LG", "20260504") }),
      win({ date: "2026.05.05", game_id: gid("OB", "LG", "20260505") }),
      loss({ date: "2026.05.06", game_id: gid("OB", "LG", "20260506") }),
    ];
    const s = computeStreakStats(records);
    expect(s.currentType).toBe("L");
    expect(s.currentCount).toBe(1);
    expect(s.longestWin).toBe(1);
    expect(s.longestLose).toBe(3);
  });

  it("handles single record", () => {
    const s = computeStreakStats([win({ date: "2026.05.01", game_id: gid("OB", "LG", "20260501") })]);
    expect(s.currentType).toBe("W");
    expect(s.currentCount).toBe(1);
    expect(s.longestWin).toBe(1);
    expect(s.longestLose).toBe(0);
  });

  it("handles YYYY-MM-DD date format (safety)", () => {
    const records = [
      win({ date: "2026-05-01", game_id: gid("OB", "LG", "20260501") }),
      win({ date: "2026-05-02", game_id: gid("OB", "LG", "20260502") }),
      win({ date: "2026-05-03", game_id: gid("OB", "LG", "20260503") }),
    ];
    const s = computeStreakStats(records);
    expect(s.currentType).toBe("W");
    expect(s.currentCount).toBe(3);
  });
});

// ─── computeOpponentStats ───────────────────────────────────

describe("computeOpponentStats", () => {
  it("counts wins/losses by opponent", () => {
    const records = [
      // doosan home vs lg → doosan wins (5-3)
      win({ game_id: gid("OB", "LG"), cheered_team: "doosan", is_win: 1 }),
      // doosan home vs ssg → doosan loses (2-4)
      loss({ game_id: gid("OB", "SK", "20260531"), cheered_team: "doosan", is_win: -1 }),
      // lg home vs doosan → doosan away win (3-1)
      win({ game_id: gid("LG", "OB", "20260601"), cheered_team: "doosan", is_win: 1 }),
    ];
    // game_id "OBLG-0" → away=OB=doosan, home=LG=lg
    // game_id "OBSK-0" → away=OB=doosan, home=SK=ssg
    // game_id "LGOB-0" → away=LG=lg, home=OB=doosan
    const stats = computeOpponentStats(records, "doosan");
    expect(stats).toHaveLength(2);

    const lg = stats.find((s) => s.opponentId === "lg");
    expect(lg).toBeDefined();
    expect(lg!.wins).toBe(2); // home vs lg + away at lg
    expect(lg!.losses).toBe(0);

    const ssg = stats.find((s) => s.opponentId === "ssg");
    expect(ssg).toBeDefined();
    expect(ssg!.losses).toBe(1);
  });
});

// ─── computeHomeAwayStats ───────────────────────────────────

describe("computeHomeAwayStats", () => {
  it("splits stats by home/away", () => {
    const records = [
      // doosan home vs lg → home win (game_id: OBLG-0 → away=OB=doosan, home=LG=lg)
      win({ game_id: gid("OB", "LG"), cheered_team: "doosan", is_win: 1 }),
      // ssg home vs doosan → away loss (game_id: SKOB-0 → away=SK=ssg, home=OB=doosan)
      loss({ game_id: gid("SK", "OB", "20260531"), cheered_team: "doosan", is_win: -1 }),
      // lg home vs doosan → away win (game_id: LGOB-0 → away=LG=lg, home=OB=doosan)
      win({ game_id: gid("LG", "OB", "20260601"), cheered_team: "doosan", is_win: 1 }),
    ];
    const h = computeHomeAwayStats(records, "doosan");

    // doosan is home when homeId === "doosan" → game_id with OB in 2nd half (home)
    // OBLG-0: away=OB(doosan), home=LG → doosan is AWAY here
    // SKOB-0: away=SK, home=OB(doosan) → doosan is HOME here
    // LGOB-0: away=LG, home=OB(doosan) → doosan is HOME here

    expect(h.away.wins).toBe(1); // game 1 (doosan at away)
    expect(h.away.losses).toBe(0);
    expect(h.home.wins).toBe(1); // game 3 (doosan at home)
    expect(h.home.losses).toBe(1); // game 2 (doosan at home lost)
  });
});

// ─── computeDayOfWeekStats ──────────────────────────────────

describe("computeDayOfWeekStats", () => {
  it("returns stats for all 7 days", () => {
    // 2026-05-30 is Saturday (getDay() = 6)
    const records = [
      win({ date: "2026.05.30" }),
    ];
    const stats = computeDayOfWeekStats(records);
    expect(stats).toHaveLength(7);
    const sat = stats[6];
    expect(sat.day).toBe("토");
    expect(sat.wins).toBe(1);
  });

  it("empty records return zero for all days", () => {
    const stats = computeDayOfWeekStats([]);
    expect(stats).toHaveLength(7);
    for (const s of stats) {
      expect(s.total).toBe(0);
    }
  });
});
