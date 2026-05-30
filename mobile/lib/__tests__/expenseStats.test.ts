import type { JikgwanRecord } from "@/lib/db";
import { resolveIsWin } from "@/lib/expenseStats";

// ─── Helpers ────────────────────────────────────────────────

const baseRecord = (overrides: Partial<JikgwanRecord> = {}): JikgwanRecord => ({
  id: 1,
  game_id: "20260530-OBLG-0", // away=OB(doosan), home=LG(lg)
  date: "2026.05.30",
  cheered_team: "doosan",
  score_home: 5,
  score_away: 3,
  is_win: null,
  game_type: null,
  game_status: null,
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
  ...overrides,
});

// game_id format helpers
const DOOSAN_HOME = "20260530-SKOB-0"; // away=SK(ssg), home=OB(doosan)
const DOOSAN_AWAY = "20260530-OBLG-0"; // away=OB(doosan), home=LG(lg)

// ─── Tests ──────────────────────────────────────────────────

describe("resolveIsWin", () => {
  it("returns is_win when set (1 = win)", () => {
    expect(resolveIsWin(baseRecord({ is_win: 1 }))).toBe(1);
  });

  it("returns is_win when set (-1 = loss)", () => {
    expect(resolveIsWin(baseRecord({ is_win: -1 }))).toBe(-1);
  });

  it("returns is_win when set (0 = draw)", () => {
    expect(resolveIsWin(baseRecord({ is_win: 0 }))).toBe(0);
  });

  it("returns null for live games", () => {
    expect(resolveIsWin(baseRecord({ game_status: "live" }))).toBeNull();
  });

  it("returns null when both scores are null", () => {
    expect(resolveIsWin(baseRecord({ score_home: null, score_away: null }))).toBeNull();
  });

  it("returns null when both scores are 0", () => {
    expect(resolveIsWin(baseRecord({ score_home: 0, score_away: 0 }))).toBeNull();
  });

  it("returns null when no cheered_team", () => {
    expect(resolveIsWin(baseRecord({ cheered_team: null }))).toBeNull();
  });

  it("resolves home team win from scores (doosan at home, wins 5-3)", () => {
    const r = baseRecord({ game_id: DOOSAN_HOME, cheered_team: "doosan", score_home: 5, score_away: 3 });
    expect(resolveIsWin(r)).toBe(1);
  });

  it("resolves home team loss from scores (doosan at home, loses 2-4)", () => {
    const r = baseRecord({ game_id: DOOSAN_HOME, cheered_team: "doosan", score_home: 2, score_away: 4 });
    expect(resolveIsWin(r)).toBe(-1);
  });

  it("resolves away team win from scores (doosan away, wins 5-3)", () => {
    const r = baseRecord({ game_id: DOOSAN_AWAY, cheered_team: "doosan", score_home: 3, score_away: 5 });
    expect(resolveIsWin(r)).toBe(1);
  });

  it("resolves draw from scores (3-3)", () => {
    const r = baseRecord({ game_id: DOOSAN_HOME, cheered_team: "doosan", score_home: 3, score_away: 3 });
    expect(resolveIsWin(r)).toBe(0);
  });

  it("returns null when game_id cannot be parsed", () => {
    const r = baseRecord({ game_id: "invalid", cheered_team: "doosan", score_home: 5, score_away: 3 });
    expect(resolveIsWin(r)).toBeNull();
  });

  it("is_win takes precedence over scores even when contradictory", () => {
    // is_win says win, but scores say loss → trust is_win
    const r = baseRecord({ is_win: 1, game_id: DOOSAN_HOME, cheered_team: "doosan", score_home: 1, score_away: 9 });
    expect(resolveIsWin(r)).toBe(1);
  });
});
