import type { CharacterEmotion } from "@/lib/emotions";

export interface GameEmotionInput {
  status: "scheduled" | "live" | "finished" | "cancelled";
  myScore: number;
  oppScore: number;
  inning: number;
  isTop: boolean;  // actual game: true = top (away bats), false = bottom (home bats)
  isMyHome: boolean; // whether "my team" is the home team
  base1?: string;
  base2?: string;
  base3?: string;
  // For finished game analysis — inning-by-inning runs
  myInns?: (number | null)[];
  oppInns?: (number | null)[];
}


// ── Inning-by-inning analysis helpers ────────────────────────

function maxDeficit(myInns: (number | null)[], oppInns: (number | null)[]): number {
  let mySum = 0, oppSum = 0, worst = 0;
  for (let i = 0; i < Math.max(myInns.length, oppInns.length); i++) {
    mySum += myInns[i] ?? 0;
    oppSum += oppInns[i] ?? 0;
    worst = Math.min(worst, mySum - oppSum);
  }
  return -worst; // positive = how far we were behind
}

function maxLead(myInns: (number | null)[], oppInns: (number | null)[]): number {
  let mySum = 0, oppSum = 0, best = 0;
  for (let i = 0; i < Math.max(myInns.length, oppInns.length); i++) {
    mySum += myInns[i] ?? 0;
    oppSum += oppInns[i] ?? 0;
    best = Math.max(best, mySum - oppSum);
  }
  return best; // positive = our biggest lead
}

function lastInningScored(myInns: (number | null)[], oppInns: (number | null)[], myIsHome: boolean): boolean {
  // Did my team score in the final half-inning?
  if (myIsHome) {
    // Home team bats bottom — check if we scored in the last bottom inning
    const lastIdx = myInns.length - 1;
    return lastIdx >= 0 && (myInns[lastIdx] ?? 0) > 0;
  }
  // Away team bats top — check if we scored in the last top inning
  const lastIdx = myInns.length - 1;
  return lastIdx >= 0 && (myInns[lastIdx] ?? 0) > 0;
}


// ── Main emotion computation ──────────────────────────────────

export function computeGameEmotion(input: GameEmotionInput): CharacterEmotion {
  const { status, myScore, oppScore, inning, isTop, isMyHome, base1, base2, base3, myInns, oppInns } = input;
  const diff = myScore - oppScore;

  if (status === "cancelled") return "rain_cancellation";
  if (status === "scheduled") return "default";

  // ── Finished game: nuanced emotion based on how the game played out ──
  if (status === "finished") {
    const extra = inning >= 10;
    const hasInnData = myInns && oppInns && myInns.length > 0 && oppInns.length > 0;

    if (diff > 0) {
      // ── WE WON ──
      const walkOff = hasInnData && isMyHome && lastInningScored(myInns!, oppInns!, true) && inning >= 9;
      const comeback = hasInnData ? maxDeficit(myInns!, oppInns!) : 0;
      const blowout = diff >= 8;
      const shutout = oppScore === 0;
      const close = diff <= 2;

      if (walkOff && extra) return "in_love";        // 연장 끝내기 — 최고의 승리
      if (walkOff) return "in_love";                  // 끝내기 승리
      if (comeback >= 5) return "determined";         // 대역전승 (5점차 이상 뒤집음)
      if (comeback >= 2) return "joyful";             // 역전승
      if (blowout && shutout) return "mocking";       // 대승+영봉
      if (blowout) return "mocking";                  // 대승
      if (shutout) return "tongue";                   // 영봉승
      if (close && extra) return "determined";        // 연장 접전승
      if (close) return "thumbs_up";                  // 접전승 (1-2점차)
      return "joyful";                                 // 일반 승
    }

    if (diff < 0) {
      // ── WE LOST ──
      const blownLead = hasInnData ? maxLead(myInns!, oppInns!) : 0;
      const walkOffLoss = hasInnData && !isMyHome && lastInningScored(oppInns!, myInns!, true) && inning >= 9;
      const blowout = diff <= -8;
      const shutout = myScore === 0;
      const close = diff >= -2;

      if (walkOffLoss && extra) return "devastated";  // 연장 끝내기 패배
      if (walkOffLoss) return "devastated";            // 끝내기 패배 (원정팀)
      if (blownLead >= 5) return "furious";            // 대역전패 (5점차 리드 날림)
      if (blownLead >= 2) return "angry";              // 역전패
      if (blowout && shutout) return "resigned_disgust"; // 대패+영봉
      if (blowout) return "resigned_disgust";          // 대패
      if (shutout) return "depressed";                 // 영봉패
      if (close && extra) return "crying";             // 연장 석패
      if (close) return "sad";                         // 석패 (1-2점차)
      return "crying";                                  // 일반 패
    }

    // Tie
    if (extra) return "sleepy";
    return "neutral";
  }

  // ── Live game — determine who has scoring chances from "my team" perspective ──
  const oppHasChances = isMyHome === isTop;  // opp bats when (home && top) or (!home && bottom)
  const myChances = isMyHome !== isTop;       // my team bats when (home && bottom) or (!home && top)
  const inningNum = inning || 1;
  const basesLoaded = base1 === "1" && base2 === "1" && base3 === "1";
  const scoringPosition = base2 === "1" || base3 === "1";

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

/**
 * Simple fallback for when BSO/base context is unavailable (e.g. scheduled/finished preview).
 */
export function computeSimpleEmotion(
  status: "scheduled" | "live" | "finished" | "cancelled",
  myScore: number,
  oppScore: number,
): CharacterEmotion {
  return computeGameEmotion({
    status,
    myScore,
    oppScore,
    inning: 0,
    isTop: false,
    isMyHome: false,
  });
}
