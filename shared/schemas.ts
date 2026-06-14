import * as z from "zod";

// ── Shared helpers ──────────────────────────────────────────

function normalizeDate(val: string): string {
  if (/^\d{8}$/.test(val)) {
    return `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`;
  }
  return val;
}

const dateString = z.string().transform(normalizeDate);

type SafeValidateLogFn = (msg: string) => void;
let logFn: SafeValidateLogFn = (msg) => console.warn(msg);

/** Override logger for testing */
export function setLogFn(fn: SafeValidateLogFn): void {
  logFn = fn;
}

/**
 * Safely validate unknown data against a Zod schema.
 * Returns the parsed data on success, logs warnings on failure, returns null.
 */
export function safeValidate<T>(schema: z.ZodType<T>, data: unknown, path: string): T | null {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  logFn(
    `[Zod] Validation failed for ${path}:\n` +
      result.error.issues
        .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("\n"),
  );
  return null;
}

// ── Sub-schemas (reused across API responses) ───────────────

/** ScoreEntry — 하루 경기 스코어 데이터 */
export const ScoreEntrySchema = z.object({
  away: z.string(),
  home: z.string(),
  awayScore: z.number().nullish(),
  homeScore: z.number().nullish(),
  outcome: z.string().nullable().nullish(),
  cancelled: z.boolean().nullish().default(false),
  winPitcher: z.string().nullable().nullish(),
  losePitcher: z.string().nullable().nullish(),
  gameIdx: z.number().int().nullish(),
}).passthrough();

/** ScheduleGame — 월별 경기 일정 */
export const ScheduleGameSchema = z.object({
  date: dateString,
  month: z.number().int(),
  day: z.number().int(),
  venue: z.string(),
  away: z.string(),
  home: z.string(),
  time: z.string().nullish(),
  status: z.string().nullish(),
  gubun: z.string().nullish(),
  isExhibition: z.boolean().nullish(),
  isPostseason: z.boolean().nullish(),
  gameIdx: z.number().int().nullish(),
}).passthrough();

/** LineupPlayer — 선발 라인업 엔트리 */
export const LineupPlayerSchema = z.object({
  order: z.number().int(),
  position: z.string(),
  name: z.string(),
}).passthrough();

/** 선발투수 이름 래퍼 */
export const StarterNameSchema = z.object({
  name: z.string(),
}).passthrough();

/** 투수 기록 W/S/H/L 항목 */
export const PitchingResultSchema = z.object({
  name: z.string(),
  wls: z.string(),
  era: z.string().nullish(),
  ip: z.string().nullish(),
}).passthrough();

/** RelayPlayerSchema — 현재 투수/타자 */
export const RelayPlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
}).passthrough();

/** RelayStateSchema — BSO, 주자, 투수/타자 실시간 데이터 */
export const RelayStateSchema = z.object({
  strike: z.string(),
  ball: z.string(),
  out: z.string(),
  base1: z.string(),
  base2: z.string(),
  base3: z.string(),
  pitcher: RelayPlayerSchema.nullable().nullish(),
  batter: RelayPlayerSchema.nullable().nullish(),
}).passthrough();

/** 경기 기록 하이라이트 */
export const EtcRecordSchema = z.object({
  how: z.string(),
  result: z.string(),
  desc: z.string().nullish(),
}).passthrough();

// ── API Response Schemas ────────────────────────────────────

/** POST /daily-scores/:date 응답 */
export const DailyScoresResponseSchema = z.object({
  date: dateString,
  games: z.array(ScoreEntrySchema),
}).passthrough();

/** POST /schedule/:month 응답 */
export const ScheduleByMonthResponseSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  games: z.array(ScheduleGameSchema),
}).passthrough();

/** TodayGame — 오늘 경기 API 개별 항목 */
export const TodayGameSchema = z.object({
  id: z.string(),
  date: dateString,
  venue: z.string(),
  time: z.string(),
  status: z.string(),
  away: z.object({
    id: z.string(),
    name: z.string(),
    starter: z.object({ name: z.string() }).passthrough().nullish(),
    rank: z.number().int().nullish(),
    record: z.string().nullish(),
  }).passthrough(),
  home: z.object({
    id: z.string(),
    name: z.string(),
    starter: z.object({ name: z.string() }).passthrough().nullish(),
    rank: z.number().int().nullish(),
    record: z.string().nullish(),
  }).passthrough(),
  score: z.object({ away: z.number(), home: z.number() }).passthrough().nullish(),
}).passthrough();

/** POST /today-games 응답 */
export const TodayGamesResponseSchema = z.object({
  date: dateString,
  games: z.array(TodayGameSchema),
  nextGames: z.array(TodayGameSchema).nullish(),
}).passthrough();

/** GameDetail — POST /game-detail/:gameId 응답 */
export const GameDetailSchema = z.object({
  gameId: z.string(),
  date: dateString,
  homeTeam: z.string(),
  awayTeam: z.string(),
  starters: z.object({
    home: StarterNameSchema.nullable().nullish(),
    away: StarterNameSchema.nullable().nullish(),
  }).passthrough(),
  lineup: z.object({
    home: z.array(LineupPlayerSchema).nullish().default([]),
    away: z.array(LineupPlayerSchema).nullish().default([]),
  }).passthrough(),
  lineupConfirmed: z.boolean().nullish(),
  gameInfo: z.object({
    time: z.string().nullable().nullish(),
    venue: z.string().nullable().nullish(),
    status: z.string().nullable().nullish(),
  }).passthrough().nullish(),
  // game-detail response — nullable fields for live/in-progress games
  score: z.object({ away: z.number(), home: z.number() }).passthrough().nullable().nullish(),
  scoreBoard: z.object({
    rheb: z.object({
      away: z.object({ r: z.number(), h: z.number(), e: z.number() }).passthrough(),
      home: z.object({ r: z.number(), h: z.number(), e: z.number() }).passthrough(),
    }).passthrough().nullish(),
    inn: z.object({
      away: z.array(z.number().nullable()),
      home: z.array(z.number().nullable()),
    }).nullish(),
  }).passthrough().nullish(),
  pitchingResult: z.array(PitchingResultSchema).nullish(),
  etcRecords: z.array(EtcRecordSchema).nullish(),
  relay: RelayStateSchema.nullable().nullish(),
}).passthrough();

// ── Inferred types (for future Phase 2 migration) ──────────

export type ScoreEntryInferred = z.infer<typeof ScoreEntrySchema>;
export type ScheduleGameInferred = z.infer<typeof ScheduleGameSchema>;
export type TodayGameInferred = z.infer<typeof TodayGameSchema>;
export type GameDetailInferred = z.infer<typeof GameDetailSchema>;
