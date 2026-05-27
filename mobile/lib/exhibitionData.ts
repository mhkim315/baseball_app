import type { ScoreEntry } from "./api";

let _data: Record<string, ScoreEntry[]> | undefined;

function loadData(): Record<string, ScoreEntry[]> {
  if (!_data) {
    _data = require("./data/exhibitionData.json") as Record<string, ScoreEntry[]>;
  }
  return _data;
}

const handler: ProxyHandler<Record<string, ScoreEntry[]>> = {
  get(_target, prop: string) {
    return loadData()[prop];
  },
  ownKeys() {
    return Reflect.ownKeys(loadData());
  },
  getOwnPropertyDescriptor() {
    return { enumerable: true, configurable: true };
  },
};

export const EXHIBITION_SCORES = new Proxy({} as Record<string, ScoreEntry[]>, handler);
