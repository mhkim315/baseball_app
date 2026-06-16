# resolveGames() 통합 구현 계획 — 리뷰 요청

리뷰만 해주세요. 직접 수정하지 마세요.

아래는 이전 데이터 흐름 아키텍처 리뷰에서 제안된 `resolveGames()` 통합 작업의 상세 구현 계획입니다. 구현에 들어가기 전에 설계와 접근 방식에 대한 조언을 구합니다.

---

## 배경

현재 동일한 "스케줄-점수 매칭 로직"이 4개 파일에 중복 구현되어 있습니다:

| 파일 | 위치 | 매칭 코드 |
|---|---|---|
| `home.tsx` | L315-323 | `pairKey` → `filter` → `find(gameIdx)` → `[pairIdx]` |
| `CalendarGrid.tsx` | L327-340, L426-433 | 동일 패턴 |
| `CalendarPage.tsx` | L296-298, L327 | 동일 패턴 |
| `DiaryCalendar.tsx` | L355-361 | 동일 패턴 |

추가로 `game/[id].tsx`는 더 복잡한 변종 — global positional suffix → per-matchup gameIdx 변환 로직이 있고, `.find()`가 첫 매치만 반환하는 DH 버그도 있습니다.

---

## Phase 1: `resolveGames()` 함수 구현

### 신규 파일: `mobile/lib/resolveGames.ts`

### ResolvedGame 타입

```ts
export interface ResolvedGame {
  // 식별
  gameId: string;              // "20260312-OBSK-0"
  date: string;                // "2026-03-12"

  // 팀
  homeTeam: string;            // "LG"
  awayTeam: string;            // "두산" (ScheduleGame shortName)
  homeId: string;              // "lg"
  awayId: string;              // "doosan"

  // 경기 정보
  time: string;                // "14:00"
  venue: string;
  status: "scheduled" | "live" | "finished" | "cancelled";
  isExhibition: boolean;
  isPostseason: boolean;

  // 점수
  homeScore?: number;
  awayScore?: number;
  outcome?: string | null;
  winPitcher?: string | null;
  losePitcher?: string | null;

  // 선발투수
  homePitcher?: string;
  awayPitcher?: string;

  // 더블헤더 — 1-based (서버 gameIdx convention)
  dhGameNumber: number;        // 0 = 단일경기, 1 = DH 1차전, 2 = DH 2차전
  isDoubleHeader: boolean;

  // 라이브
  liveInning?: number;
  isTop?: boolean;

  // 원본 참조 (필요한 consumer만 사용)
  todayGame?: TodayGame;
  scoreEntry?: ScoreEntry;
  scheduleGame?: ScheduleGame;
}
```

### 함수 시그니처

```ts
export function resolveGames(
  schedule: ScheduleGame[],
  scores: ScoreEntry[],
  options?: {
    todayGames?: TodayGame[];
    nextGames?: TodayGame[];
    dateFilter?: string;       // 특정 날짜만 (YYYY-MM-DD)
  }
): ResolvedGame[]
```

### 알고리즘

1. `schedule`을 `dateFilter`가 있으면 해당 날짜만 필터링
2. `pairCount = new Map<string, number>()` — 동일 매치업 카운터
3. 각 schedule game에 대해:
   - `pairKey = "${g.away}|${g.home}"` → `pairIdx`
   - `matchingScores = scores.filter(s => s.home === g.home && s.away === g.away)`
   - `score = matchingScores.find(s => (s.gameIdx ?? 0) === pairIdx + 1) || matchingScores[pairIdx]`
   - `dhGameNumber = isDoubleHeader ? pairIdx + 1 : 0`
   - TodayGame 데이터로 투수/상태/gameId enrichment
   - `gameId`: API 제공 ID 우선, 없으면 `buildGameId()`로 생성
   - `status`: cancelled > finished > live > scheduled 순으로 결정

### gameIdx 컨벤션

- `dhGameNumber`: 1-based (서버 gameIdx와 일치), 0 = 단일경기
- gameId suffix: 기존대로 0-based global positional 유지
- 변환은 resolveGames 내부에서만 담당

---

## Phase 2~6: Consumer 마이그레이션

| Phase | 파일 | 주요 변경 |
|---|---|---|
| 2 | `home.tsx` | `EnhancedGame` 제거, `load()` 내 매칭 로직 `resolveGames()`로 대체 |
| 3 | `CalendarGrid.tsx` | Props를 `games`+`scores` → `resolvedGames: ResolvedGame[]`로 변경, 내부 매칭 로직 전부 제거 |
| 4 | `CalendarPage.tsx` | `loadScores()` 결과를 `resolveGames()`로 처리, `ScoreInfo` 제거 |
| 5 | `DiaryCalendar.tsx` | `diary.tsx`에서 `resolveGames()` 호출하여 전달, DH 매칭 제거 |
| 6 | `game/[id].tsx` | `tryExhibitionFallback`의 global→per-matchup 변환 제거, DH 오버라이드 로직 `resolveGames()`로 대체 (`.find()` DH 버그 자연 해결) |

---

## 예상 소요 시간

| Phase | 내용 | 시간 |
|---|---|---|
| 1 | resolveGames() 구현 | 1.5h |
| 2 | home.tsx | 1h |
| 3 | CalendarGrid.tsx | 1h |
| 4 | CalendarPage.tsx | 0.5h |
| 5 | DiaryCalendar.tsx | 0.5h |
| 6 | game/[id].tsx | 0.5h |
| **계** | | **~5h** |

---

## Opus에게 묻고 싶은 4가지

### Q1. ResolvedGame에 raw reference 필드를 남길지 vs 완전 평탄화할지

현재 설계에는 `todayGame?`, `scoreEntry?`, `scheduleGame?` 필드를 남겨서 consumer가 필요할 때 원본 데이터에 접근할 수 있게 했습니다. 이렇게 하면 "혹시 모를" 엣지케이스에 대비할 수 있지만, ResolvedGame만으로 모든 화면을 커버하지 못한다는 신호이기도 합니다.

완전히 평탄화해서 raw reference 없이 ResolvedGame만으로 모든 consumer가 동작하게 하는 게 나을까요, 아니면 실용적으로 raw reference를 남기는 게 나을까요?

### Q2. gameId 생성 우선순위

현재 `home.tsx`는 non-DH 경기에서 API가 준 `todayGame.id`를 우선 사용하고, DH이거나 API id가 없으면 `buildGameId()`로 자체 생성합니다. `resolveGames()`도 같은 우선순위를 따를 예정인데, API id와 자체 생성 id의 포맷이 다른 경우가 있을지, 그리고 이 우선순위가 적절한지 궁금합니다.

### Q3. DiaryCalendar도 동일한 ResolvedGame 인터페이스로 통일?

DiaryCalendar는 일기 데이터 + 경기 데이터를 조합하는 특수한 케이스입니다. CalendarGrid와 동일하게 `resolvedGames: ResolvedGame[]` prop으로 통일할지, 아니면 DiaryCalendar만의 경량 인터페이스를 유지할지 조언 부탁드립니다.

### Q4. 점진적 마이그레이션 vs 빅뱅

6개 Phase를 순차 진행하면서 각 단계에서 테스트하는 접근을 생각하고 있습니다. 그런데 중간 단계에서는 resolveGames와 기존 로직이 공존하게 되어 혼란이 있을 수 있습니다. 피처 플래그나 어댑터 레이어 없이 그냥 한 번에 바꾸는 게 나을까요?
