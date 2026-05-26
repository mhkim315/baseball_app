export type EmotionId = "neutral" | "joyful" | "sad" | "angry" | "furious" | "shocked";

export interface EmotionDef {
  id: EmotionId;
  character: EmotionId;
  label: string;
}

export const EMOTIONS: EmotionDef[] = [
  { id: "neutral", character: "neutral", label: "보통" },
  { id: "joyful", character: "joyful", label: "기쁨" },
  { id: "sad", character: "sad", label: "슬픔" },
  { id: "angry", character: "angry", label: "화남" },
  { id: "furious", character: "furious", label: "대노" },
  { id: "shocked", character: "shocked", label: "놀람" },
];

export const EMOTION_COUNT = EMOTIONS.length;

// Lookup: emotion ID → character image name for TeamBadge
export const EMOTION_CHARACTER: Record<string, EmotionId> = {};
for (const e of EMOTIONS) {
  EMOTION_CHARACTER[e.id] = e.character;
}
