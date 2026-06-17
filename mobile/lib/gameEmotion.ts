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
}

/**
 * Compute character emotion from one team's perspective based on live game context:
 * score differential, inning, bases loaded / scoring position.
 * Ported from the Android Widget's computeWidgetEmotion algorithm.
 */
export function computeGameEmotion(input: GameEmotionInput): CharacterEmotion {
  const { status, myScore, oppScore, inning, isTop, isMyHome, base1, base2, base3 } = input;
  const diff = myScore - oppScore;

  if (status === "cancelled") return "rain_cancellation";
  if (status === "scheduled") return "default";

  if (status === "finished") {
    if (diff > 0) return "thumbs_up";
    if (diff === 0) return "neutral";
    return "crying";
  }

  // Live game — determine who has scoring chances from "my team" perspective
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
