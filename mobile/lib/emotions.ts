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

// ── Character Icon System (16 types for profile/achievement rewards) ──

export type CharacterEmotion =
  | "default" | "determined" | "sad" | "joyful" | "neutral" | "angry"
  | "furious" | "shocked"
  | "annoyed" | "crying" | "curious" | "depressed"
  | "flustered" | "mocking" | "sleepy" | "tongue"
  | "in_love" | "extream_shock"
  | "devastated" | "hot_summer" | "karen" | "out" | "praying"
  | "rain_cancellation" | "resigned_disgust" | "thumbs_up" | "provocative";

export interface CharacterDef {
  id: CharacterEmotion;
  label: string;
  basic: boolean;
}

export const ALL_CHARACTERS: CharacterDef[] = [
  { id: "default", label: "기본", basic: true },
  { id: "determined", label: "불굴", basic: false },
  { id: "sad", label: "슬픔", basic: true },
  { id: "joyful", label: "기쁨", basic: true },
  { id: "neutral", label: "보통", basic: false },
  { id: "angry", label: "화남", basic: false },
  { id: "furious", label: "대노", basic: false },
  { id: "shocked", label: "놀람", basic: false },
  { id: "annoyed", label: "짜증", basic: false },
  { id: "crying", label: "울음", basic: false },
  { id: "curious", label: "호기심", basic: false },
  { id: "depressed", label: "우울", basic: false },
  { id: "flustered", label: "당황", basic: false },
  { id: "mocking", label: "놀림", basic: false },
  { id: "sleepy", label: "졸림", basic: false },
  { id: "tongue", label: "메롱", basic: false },
  { id: "in_love", label: "사랑", basic: false },
  { id: "extream_shock", label: "개놀람", basic: false },
  { id: "devastated", label: "멘붕", basic: false },
  { id: "hot_summer", label: "폭염", basic: false },
  { id: "karen", label: "까칠", basic: false },
  { id: "out", label: "퇴장", basic: false },
  { id: "praying", label: "기도", basic: false },
  { id: "rain_cancellation", label: "우취", basic: false },
  { id: "resigned_disgust", label: "체념", basic: false },
  { id: "thumbs_up", label: "따봉", basic: false },
  { id: "provocative", label: "도발", basic: false },
];

export const CHARACTER_BASIC_SET: CharacterEmotion[] = ALL_CHARACTERS.filter(c => c.basic).map(c => c.id);
export const CHARACTER_LOCKABLE_SET: CharacterEmotion[] = ALL_CHARACTERS.filter(c => !c.basic).map(c => c.id);

// Lookup: emotion ID → character image name for TeamBadge (all 16 types)
export const EMOTION_CHARACTER: Record<string, CharacterEmotion> = {};
for (const c of ALL_CHARACTERS) {
  EMOTION_CHARACTER[c.id] = c.id;
}
