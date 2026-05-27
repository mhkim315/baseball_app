import type { ScheduleGame } from "./api";

let _schedule: Record<string, ScheduleGame[]> | undefined;

function loadSchedule(): Record<string, ScheduleGame[]> {
  if (!_schedule) {
    _schedule = require("./data/scheduleData.json") as Record<string, ScheduleGame[]>;
  }
  return _schedule;
}

const handler: ProxyHandler<Record<string, ScheduleGame[]>> = {
  get(_target, prop: string) {
    return loadSchedule()[prop];
  },
  ownKeys() {
    return Reflect.ownKeys(loadSchedule());
  },
  getOwnPropertyDescriptor() {
    return { enumerable: true, configurable: true };
  },
};

export const LOCAL_SCHEDULE = new Proxy({} as Record<string, ScheduleGame[]>, handler);
export { LOCAL_SCORES } from "./scoresData";
