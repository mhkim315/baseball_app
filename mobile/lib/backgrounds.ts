export type BgKey =
  | "transparent"
  | "sketchbook"
  | "retro"
  | "postit"
  | "grid"
  | "neon"
  | "grass"
  | "ground";

export const BG_LABEL_MAP: Record<BgKey, string> = {
  transparent: "투명",
  sketchbook: "스케치북",
  retro: "레트로",
  postit: "포스트잇",
  grid: "모눈노트",
  neon: "네온",
  grass: "잔디",
  ground: "그라운드",
};

export const BG_OPTIONS: { key: BgKey; label: string }[] = Object.entries(BG_LABEL_MAP).map(([key, label]) => ({
  key: key as BgKey,
  label,
}));

export const LOCKABLE_BACKGROUNDS: BgKey[] = ["retro", "postit", "grid", "neon", "grass", "ground"];
export const DEFAULT_BACKGROUNDS: BgKey[] = ["transparent", "sketchbook"];
