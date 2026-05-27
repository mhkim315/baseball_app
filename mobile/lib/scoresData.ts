import type { ScoreEntry } from "./api";
import { SCORES_2026 } from "./scores_2026";

let _merged: Record<string, ScoreEntry[]> | undefined;

function loadMerged(): Record<string, ScoreEntry[]> {
  if (!_merged) {
    const s2021: Record<string, ScoreEntry[]> = require("./data/scores_2021.json") as Record<string, ScoreEntry[]>;
    const s2022: Record<string, ScoreEntry[]> = require("./data/scores_2022.json") as Record<string, ScoreEntry[]>;
    const s2023: Record<string, ScoreEntry[]> = require("./data/scores_2023.json") as Record<string, ScoreEntry[]>;
    const s2024: Record<string, ScoreEntry[]> = require("./data/scores_2024.json") as Record<string, ScoreEntry[]>;
    const s2025: Record<string, ScoreEntry[]> = require("./data/scores_2025.json") as Record<string, ScoreEntry[]>;
    _merged = { ...s2021, ...s2022, ...s2023, ...s2024, ...s2025, ...SCORES_2026 };
  }
  return _merged;
}

const handler: ProxyHandler<Record<string, ScoreEntry[]>> = {
  get(target, prop) {
    return loadMerged()[prop as string];
  },
  ownKeys() {
    return Reflect.ownKeys(loadMerged());
  },
  getOwnPropertyDescriptor() {
    return { enumerable: true, configurable: true };
  },
};

export const LOCAL_SCORES = new Proxy({} as Record<string, ScoreEntry[]>, handler);
