import { resolveHashtags, type TeamStreakInfo } from "@/lib/sticker";

// ─── Helpers ────────────────────────────────────────────────

function streak(type: "W" | "L" | null, count: number, prevType: "W" | "L" | null = null, prevCount = 0): TeamStreakInfo {
  return { type, count, prevType, prevCount };
}

// ─── Team Tag Tests ─────────────────────────────────────────

describe("resolveHashtags — teamTag", () => {
  it("returns empty on loss", () => {
    const r = resolveHashtags(streak("W", 3), { type: "W", count: 3 }, "lose", {
      isHome: true, isFirstWin: false, isFirstGame: false,
    });
    expect(r).toEqual({ teamTag: "", myTag: "" });
  });

  it("연패탈출 when prev streak was 2+ losses and now win", () => {
    const r = resolveHashtags(streak("W", 1, "L", 3), { type: null, count: 0 }, "win", {
      isHome: true, isFirstWin: false, isFirstGame: false,
    });
    expect(r.teamTag).toBe("연패탈출");
  });

  it("N연승 when current streak is 2+ wins", () => {
    const r = resolveHashtags(streak("W", 4), { type: null, count: 0 }, "win", {
      isHome: true, isFirstWin: false, isFirstGame: false,
    });
    expect(r.teamTag).toBe("4연승");
  });

  it("no teamTag when team won but only 1 win (no streak, no recovery)", () => {
    const r = resolveHashtags(streak("W", 1), { type: null, count: 0 }, "win", {
      isHome: true, isFirstWin: false, isFirstGame: false,
    });
    expect(r.teamTag).toBe("");
  });

  it("무승부", () => {
    const r = resolveHashtags(streak(null, 0), { type: null, count: 0 }, "draw", {
      isHome: null, isFirstWin: false, isFirstGame: false,
    });
    expect(r.teamTag).toBe("무승부");
  });

  it("연패탈출가자 during live game when team is on losing streak", () => {
    const r = resolveHashtags(streak("L", 3), { type: null, count: 0 }, null, {
      isHome: null, isFirstWin: false, isFirstGame: false, statsMode: "live",
    });
    expect(r.teamTag).toBe("연패탈출가자");
  });

  it("N연승가자! during live game when team is on win streak", () => {
    const r = resolveHashtags(streak("W", 3), { type: null, count: 0 }, null, {
      isHome: null, isFirstWin: false, isFirstGame: false, statsMode: "live",
    });
    expect(r.teamTag).toBe("4연승가자!");
  });
});

// ─── My Tag Tests ───────────────────────────────────────────

describe("resolveHashtags — myTag", () => {
  it("첫직관 when isFirstGame", () => {
    const r = resolveHashtags(streak(null, 0), { type: null, count: 0 }, "win", {
      isHome: true, isFirstWin: false, isFirstGame: true, statsMode: "live",
    });
    expect(r.myTag).toBe("첫직관");
  });

  it("집관첫승 when isFirstWin in broadcast mode", () => {
    const r = resolveHashtags(streak(null, 0), { type: null, count: 0 }, "win", {
      isHome: true, isFirstWin: true, isFirstGame: false, statsMode: "broadcast",
    });
    expect(r.myTag).toBe("집관첫승");
  });

  it("직관N연승 when my streak is 2+", () => {
    const r = resolveHashtags(streak(null, 0), { type: "W", count: 5 }, "win", {
      isHome: true, isFirstWin: false, isFirstGame: false, statsMode: "live",
    });
    expect(r.myTag).toBe("직관5연승");
  });

  it("집관N연승 in broadcast mode", () => {
    const r = resolveHashtags(streak(null, 0), { type: "W", count: 3 }, "win", {
      isHome: true, isFirstWin: false, isFirstGame: false, statsMode: "broadcast",
    });
    expect(r.myTag).toBe("집관3연승");
  });

  it("홈승리 when 1 win streak and home", () => {
    const r = resolveHashtags(streak(null, 0), { type: "W", count: 1 }, "win", {
      isHome: true, isFirstWin: false, isFirstGame: false,
    });
    expect(r.myTag).toBe("홈승리");
  });

  it("원정승리 when 1 win streak and away", () => {
    const r = resolveHashtags(streak(null, 0), { type: "W", count: 1 }, "win", {
      isHome: false, isFirstWin: false, isFirstGame: false,
    });
    expect(r.myTag).toBe("원정승리");
  });

  it("no myTag when 1 win streak and isHome is null", () => {
    const r = resolveHashtags(streak(null, 0), { type: "W", count: 1 }, "win", {
      isHome: null, isFirstWin: false, isFirstGame: false,
    });
    expect(r.myTag).toBe("");
  });

  it("직관연승 during live game when my streak is 2+", () => {
    const r = resolveHashtags(streak(null, 0), { type: "W", count: 2 }, null, {
      isHome: null, isFirstWin: false, isFirstGame: false, statsMode: "live",
    });
    expect(r.myTag).toBe("직관2연승");
  });

  it("no myTag during live game when my streak is 1", () => {
    const r = resolveHashtags(streak(null, 0), { type: "W", count: 1 }, null, {
      isHome: null, isFirstWin: false, isFirstGame: false,
    });
    expect(r.myTag).toBe("");
  });
});

// ─── Combined Tests ─────────────────────────────────────────

describe("resolveHashtags — combined", () => {
  it("handles draw with personal streak", () => {
    const r = resolveHashtags(streak(null, 0), { type: "W", count: 3 }, "draw", {
      isHome: true, isFirstWin: false, isFirstGame: false, statsMode: "live",
    });
    expect(r.teamTag).toBe("무승부");
    expect(r.myTag).toBe("직관3연승");
  });

  it("empty tags when lose even with streaks", () => {
    const r = resolveHashtags(streak("W", 5), { type: "W", count: 10 }, "lose", {
      isHome: true, isFirstWin: false, isFirstGame: false,
    });
    expect(r).toEqual({ teamTag: "", myTag: "" });
  });
});
