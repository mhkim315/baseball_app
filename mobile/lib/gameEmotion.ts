import type { CharacterEmotion } from "@/lib/emotions";

export interface GameEmotionInput {
  status: "scheduled" | "live" | "finished" | "cancelled";
  myScore: number;
  oppScore: number;
  inning: number;
  isTop: boolean;   // actual game: true = top (away bats), false = bottom (home bats)
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
  return -worst;
}

function maxLead(myInns: (number | null)[], oppInns: (number | null)[]): number {
  let mySum = 0, oppSum = 0, best = 0;
  for (let i = 0; i < Math.max(myInns.length, oppInns.length); i++) {
    mySum += myInns[i] ?? 0;
    oppSum += oppInns[i] ?? 0;
    best = Math.max(best, mySum - oppSum);
  }
  return best;
}

function lastInningScored(myInns: (number | null)[], oppInns: (number | null)[], myIsHome: boolean): boolean {
  if (myIsHome) {
    const lastIdx = myInns.length - 1;
    return lastIdx >= 0 && (myInns[lastIdx] ?? 0) > 0;
  }
  const lastIdx = myInns.length - 1;
  return lastIdx >= 0 && (myInns[lastIdx] ?? 0) > 0;
}

function wasBehindAfter(inning: number, myInns: (number | null)[], oppInns: (number | null)[]): boolean {
  let mySum = 0, oppSum = 0;
  for (let i = 0; i < Math.max(myInns.length, oppInns.length); i++) {
    mySum += myInns[i] ?? 0;
    oppSum += oppInns[i] ?? 0;
    if (i >= inning - 1 && mySum < oppSum) return true;
  }
  return false;
}

function wasAheadAfter(inning: number, myInns: (number | null)[], oppInns: (number | null)[]): boolean {
  let mySum = 0, oppSum = 0;
  for (let i = 0; i < Math.max(myInns.length, oppInns.length); i++) {
    mySum += myInns[i] ?? 0;
    oppSum += oppInns[i] ?? 0;
    if (i >= inning - 1 && mySum > oppSum) return true;
  }
  return false;
}

function leadChanges(myInns: (number | null)[], oppInns: (number | null)[]): number {
  let changes = 0, prevLeader = 0, mySum = 0, oppSum = 0;
  for (let i = 0; i < Math.max(myInns.length, oppInns.length); i++) {
    mySum += myInns[i] ?? 0;
    oppSum += oppInns[i] ?? 0;
    const curr = mySum > oppSum ? 1 : mySum < oppSum ? -1 : 0;
    if (curr !== 0 && curr !== prevLeader && prevLeader !== 0) changes++;
    if (curr !== 0) prevLeader = curr;
  }
  return changes;
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
    const combined = myScore + oppScore;
    const duel = combined <= 6;   // pitcher's duel: ≤3 runs per team avg
    const slug = combined >= 16;  // slugfest: ≥8 runs per team avg

    if (diff > 0) {
      const walkOff = hasInnData && isMyHome && lastInningScored(myInns!, oppInns!, true) && inning >= 9;
      const comeback = hasInnData ? maxDeficit(myInns!, oppInns!) : 0;
      const lateBehind = hasInnData && wasBehindAfter(6, myInns!, oppInns!);
      const changes = hasInnData ? leadChanges(myInns!, oppInns!) : 0;
      const blowout = diff >= 8;
      const shutout = oppScore === 0;
      const close = diff <= 2;

      if (walkOff && extra) return "in_love";
      if (walkOff) return "in_love";
      if (comeback >= 5) return "in_love";
      if (lateBehind && comeback >= 2) return "shocked";
      if (changes >= 3) return "joyful";
      if (comeback >= 2) return "joyful";
      if (blowout && shutout) return "mocking";
      if (blowout) return "mocking";
      if (shutout) return "tongue";
      if (slug && close) return "shocked";
      if (duel && close) return "determined";
      if (slug) return "shocked";
      if (duel) return "determined";
      if (close && extra) return "determined";
      if (close) return "thumbs_up";
      return "joyful";
    }

    if (diff < 0) {
      const blownLead = hasInnData ? maxLead(myInns!, oppInns!) : 0;
      const lateAhead = hasInnData && wasAheadAfter(6, myInns!, oppInns!);
      const walkOffLoss = hasInnData && !isMyHome && lastInningScored(oppInns!, myInns!, true) && inning >= 9;
      const blowout = diff <= -8;
      const shutout = myScore === 0;
      const close = diff >= -2;

      if (walkOffLoss && extra) return "devastated";
      if (walkOffLoss) return "devastated";
      if (blownLead >= 5) return "furious";
      if (lateAhead && blownLead >= 2) return "angry";
      if (blownLead >= 2) return "angry";
      if (blowout && shutout) return "resigned_disgust";
      if (blowout) return "resigned_disgust";
      if (shutout) return "depressed";
      if (slug && close) return "annoyed";
      if (duel && close) return "shocked";
      if (slug) return "annoyed";
      if (duel) return "shocked";
      if (close && extra) return "crying";
      if (close) return "sad";
      return "crying";
    }

    if (extra) return "sleepy";
    return "neutral";
  }

  // ── Live game: snapshot-based fallback ──────────────────────
  const inningNum = inning || 1;
  const nowBasesLoaded = base1 === "1" && base2 === "1" && base3 === "1";
  const scoringPosition = base2 === "1" || base3 === "1";
  const oppHasChances = isMyHome === isTop;
  const myChances = isMyHome !== isTop;

  if (diff === 0) {
    if (inningNum >= 10) return "sleepy";
    if (oppHasChances && nowBasesLoaded) return "extream_shock";
    if (myChances && nowBasesLoaded) return "in_love";
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
