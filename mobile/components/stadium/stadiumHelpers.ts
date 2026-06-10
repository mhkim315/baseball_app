import type { FoodPlace } from "@/lib/api";
import { FOOD_CATEGORIES } from "@/lib/stadiumData";

export const IMAGE_BASE = "https://api.fullcount.kr/static";

export const TABS = [
  { id: "info", label: "기본정보" },
  { id: "food", label: "먹거리" },
  { id: "parking", label: "주차" },
  { id: "transport", label: "교통" },
  { id: "nearby", label: "주변맛집" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export const SEAT_IMAGES: Record<string, string> = {
  "1": "jamsil", "2": "gochuck", "3": "incheon", "4": "suwon",
  "5": "daejeon", "6": "daegu", "7": "gwangju", "8": "sajik", "9": "changwon",
};

export const FOOD_MAP_IMAGES: Record<string, string> = {
  "1": "jamsil", "2": "gochuck", "3": "incheon", "4": "suwon",
  "5": "daejeon", "6": "daegu", "7": "gwangju", "8": "busan", "9": "changwon",
};

export const CATEGORY_ORDER = ["all", "chicken", "korean", "western", "cafe"];

export const NEARBY_CATEGORIES: Record<string, { color: string }> = {
  "치킨·호프": { color: "#e11d48" },
  "고깃집": { color: "#ea580c" },
  "밥집·국밥": { color: "#d97706" },
  "카페·디저트": { color: "#7c3aed" },
  "술집·이자카야": { color: "#0891b2" },
  "면·분식": { color: "#059669" },
};

export const DIRECTION_OFFSETS: Record<string, { dx: number; dy: number }> = {
  NW: { dx: -5.5, dy: -5.5 }, N: { dx: 0, dy: -6.5 }, NE: { dx: 5.5, dy: -5.5 },
  W: { dx: -6.5, dy: 0 },                                     E: { dx: 6.5, dy: 0 },
  SW: { dx: -5.5, dy: 5.5 },  S: { dx: 0, dy: 6.5 },  SE: { dx: 5.5, dy: 5.5 },
};

export const DIRECTION_ANCHOR: Record<string, { x: number; y: number }> = {
  E: { x: 0, y: -0.5 }, W: { x: -1, y: -0.5 }, N: { x: -0.5, y: -1 }, S: { x: -0.5, y: 0 },
  NE: { x: 0, y: -1 }, NW: { x: -1, y: -1 }, SE: { x: 0, y: 0 }, SW: { x: -1, y: 0 },
};

export const SEAT_ASPECT_RATIOS: Record<string, number> = {
  "1": 1008 / 1007, "2": 931 / 1125, "3": 1208 / 1125, "4": 958 / 1125,
  "5": 956 / 1125, "6": 1112 / 1125, "7": 1127 / 1125, "8": 927 / 1096, "9": 1005 / 1125,
};

export const FOOD_MAP_ASPECT_RATIOS: Record<string, number> = {
  "1": 1182 / 1117, "2": 861 / 1117, "3": 1192 / 1117, "4": 919 / 1008,
  "5": 891 / 1117, "6": 1117 / 1117, "7": 1096 / 1098, "8": 830 / 975, "9": 979 / 1047,
};

export function getLabelPositionStyle(direction: string, labelLeft: number, labelTop: number, text?: string): Record<string, any> {
  switch (direction) {
    case "E":
      return { left: `${labelLeft}%`, top: `${labelTop}%`, transform: [{ translateY: -7 }] };
    case "W":
      return { right: `${100 - labelLeft}%`, top: `${labelTop}%`, transform: [{ translateY: -7 }] };
    case "N":
      return { left: `${labelLeft}%`, bottom: `${100 - labelTop}%`, transform: [{ translateX: estimateHalfWidth(text) }] };
    case "S":
      return { left: `${labelLeft}%`, top: `${labelTop}%`, transform: [{ translateX: estimateHalfWidth(text) }] };
    case "NE":  return { left: `${labelLeft}%`, bottom: `${100 - labelTop}%` };
    case "NW":  return { right: `${100 - labelLeft}%`, bottom: `${100 - labelTop}%` };
    case "SE":  return { left: `${labelLeft}%`, top: `${labelTop}%` };
    case "SW":  return { right: `${100 - labelLeft}%`, top: `${labelTop}%` };
    default:    return { left: `${labelLeft}%`, top: `${labelTop}%` };
  }
}

export function estimateHalfWidth(text?: string): number {
  if (!text) return 0;
  let w = 4;
  for (const ch of text) {
    w += ch.charCodeAt(0) > 127 ? 9 : 5.5;
  }
  return -Math.round(w / 2);
}

export function isRightAnchor(direction: string): boolean {
  return direction === "W" || direction === "NW" || direction === "SW";
}

export function getLabelCoords(
  leftPct: number, topPct: number,
  direction = "E",
  layouts?: Record<string, any> | null,
  stadiumId?: string, floor?: string, category?: string, idx?: number,
) {
  if (layouts && stadiumId && idx != null) {
    const floorKey = String(floor || "기타").trim();
    const bucket = layouts.stadiums?.[stadiumId]?.floors?.[floorKey];
    if (bucket) {
      const catKey = category && category !== "all" ? category : "all";
      const entry = bucket[catKey]?.[String(idx)] || bucket.all?.[String(idx)];
      if (entry?.labelDirection) {
        direction = entry.labelDirection;
      }
    }
  }
  const offset = DIRECTION_OFFSETS[direction] || DIRECTION_OFFSETS.E;
  return {
    left: leftPct,
    top: topPct,
    labelLeft: Math.min(100, Math.max(0, leftPct + offset.dx)),
    labelTop: Math.min(100, Math.max(0, topPct + offset.dy)),
    direction,
    anchor: DIRECTION_ANCHOR[direction] || DIRECTION_ANCHOR.E,
  };
}

export function uniqueFloors(stores: FoodPlace[]): string[] {
  const set = new Set(stores.map((s) => s.floor || "기타"));
  return Array.from(set).sort((a, b) => {
    const na = parseFloat(a.replace(/[^0-9.]/g, "")) || 0;
    const nb = parseFloat(b.replace(/[^0-9.]/g, "")) || 0;
    if (na === nb) return a.localeCompare(b, "ko");
    return na - nb;
  });
}

export function categoryKey(store: FoodPlace): string {
  const raw = (store.category || "cafe").trim();
  return raw in FOOD_CATEGORIES ? raw : "cafe";
}
