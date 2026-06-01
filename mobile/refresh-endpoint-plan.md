# Refresh-data 경량 갱신 엔드포인트 설계 문서

> 작성일: 2026-06-01
> 목적: 현재 분산된 5분 주기 갱신 요청을 하나의 경량 엔드포인트로 통합

---

## 1. 현재 상황

### 1.1 데이터 갱신 현황

앱에서 5분 TTL(Time-To-Live)로 갱신되는 데이터들이 각각 별도 API 엔드포인트로 분산되어 있음.

| 데이터 | 엔드포인트 | 응답 크기 | TTL | 호출 시점 |
|--------|-----------|:--------:|:---:|-----------|
| today-games | `GET /today-games` | 2 KB | 5분 | 홈화면 `load()` |
| daily-scores (전체) | `GET /daily-scores` | 1,012 KB (729일) | 5분 | 홈화면 `load()` |
| schedule (인접 3개월) | `GET /schedule/{month}?year=` | 16 KB × 3 | 24시간 | 홈화면 `load()` |
| standings | `GET /standings` | 1 KB | 5분 | 순위 탭 진입 |
| score-summary | `GET /score-summary?year=` | 0.5 KB | 5분 | 순위 탭 진입 |
| game-detail | `GET /game-detail/{id}` | 3 KB × 게임수 | 5분 | 경기상세 진입 시 |

### 1.2 홈화면 1회 mount 시 발생하는 요청

```
홈화면 load()
├── cachedTodayGames()       → GET /today-games        (2 KB)
├── cachedAllDailyScores()   → GET /daily-scores       (1,012 KB ← 문제!)
├── cachedScheduleByMonth()  → GET /schedule/6?year=   (16 KB)
├── cachedScheduleByMonth()  → GET /schedule/5?year=   (16 KB)
└── cachedScheduleByMonth()  → GET /schedule/7?year=   (16 KB)

순위 탭 진입
├── cachedStandings()        → GET /standings           (1 KB)
└── cachedScoreSummary()     → GET /score-summary?year= (0.5 KB)

합계: ~1,065 KB (1MB+), 7개 요청
```

### 1.3 문제점

1. **daily-scores 전제(1MB)를 5분마다 재검증**
   - `cachedAllDailyScores()`가 매번 SQLite 캐시 TTL(5분)을 체크
   - TTL 만료 시 729일치(1MB) JSON 전체 재다운로드
   - 실제로 2026년 데이터는 135일(약 151KB, onboarding-data 기준)만 의미 있음
   - 과거(2021~2025)는 전부 로컬 번들 데이터로 처리

2. **분산된 TTL 만료 시점**
   - 각 함수가 개별 SQLite 캐시 키를 보고 TTL 체크
   - today-games 만료 / daily-scores 만료 / schedule 만료 시점이 각각 다름
   - 캐시가 서로 다른 시점에 만료되면 여러 번의 분산된 API 호출 발생

3. **중복 데이터**
   - `today-games.json`과 `daily-scores.json`에 오늘 경기 정보가 중복 존재
   - `standings`와 `score-summary`는 동일한 daily-scores 데이터에서 파생

---

## 2. 제안: `/refresh-data` 경량 갱신 엔드포인트

### 2.1 설계 목표

- **하나의 엔드포인트**로 5분 주기 갱신이 필요한 모든 데이터를 전달
- 응답 크기를 **최소화** (~20KB, 경기 5개 기준)
- **서버 부하 최소화** (daily-scores.json 전체 로드 방지)
- 기존 엔드포인트는 **fallback으로 유지**
- 경기상세 진입 시 추가 API 요청 없이 SQLite hit

### 2.2 응답 구조

```
GET /refresh-data

Response 200 OK
{
  "todayGames": {               // today-games.json (live 상태 포함)
    "date": "2026-06-01",
    "games": [
      {
        "id": "20260601-OBLG-0",
        "home": "두산",
        "away": "LG",
        "status": "live",
        "liveInning": "5초",
        ...
      }
    ],
    "nextGames": [...]           // 다음날 경기 (선택)
  },

  "standings": [                 // kbo_standings.json의 rows 배열
    { "rank": 1, "teamName": "KIA", "wlt": "35-20-1", "winRate": 0.636, ... },
    ...
  ],

  "scoreSummary": {              // pre-computed score-summary.json
    "year": 2026,
    "teams": [
      { "team": "KIA", "games": 56, "runsScored": 312, "runsAllowed": 235, ... },
      ...
    ]
  },

  "todayScores": [               // daily-scores.json → 오늘 날짜만 필터링
    {
      "gameId": "20260601-OBLG-0",
      "home": "두산", "away": "LG",
      "homeScore": 3, "awayScore": 2,
      "outcome": "두산승",
      "winPitcher": "곽빈",
      "losePitcher": "엔스",
      ...
    },
    ...
  ],

  "todayGameDetails": {           // game-detail (5분 주기 백그라운드 갱신)
    "20260601-OBLG-0": {
      "gameId": "20260601-OBLG-0",
      "starters": { "home": { "name": "곽빈" }, "away": { "name": "엔스" } },
      "lineup": { "home": [...], "away": [...] },
      "scoreBoard": { "rheb": {...}, "inn": {...} },
      "pitchingResult": [...],
      "etcRecords": [...]
    },
    ...
  }
}
```

예상 크기: **~20 KB** (todayGames 2KB + standings 1KB + scoreSummary 0.5KB + todayScores 1.5KB + game-detail×5 15KB)

### 2.3 제외하는 데이터와 이유

| 데이터 | 제외 이유 |
|--------|----------|
| schedule | 24시간 TTL, 하루 1-2회 갱신으로 충분. refresh 주기 아님 |
| 과거 날짜 scores | SQLite에 Infinity TTL로 이미 캐싱됨 (한 번 받으면 영구) |
| 인접 날짜 scores | 홈화면 load()에서 `cachedDailyScores(어제/내일)`로 개별 호출. 각각 1.5KB |

### 2.4 포함하는 데이터

| 데이터 | 포함 이유 | 크기 |
|--------|----------|:----:|
| todayGames | 라이브 스코어, 이닝, 상태 | 2KB |
| standings | 순위표 | 1KB |
| scoreSummary | 팀별 득실 | 0.5KB |
| todayScores | 오늘 경기 최종 결과 | 1.5KB |
| game-detail | 경기상세 진입 시 SQLite hit (추가 요청 없음) | 3KB × 5 = 15KB |

---

## 3. 서버 구현

### 3.1 새로운 엔드포인트

```python
@app.get("/refresh-data")
def get_refresh_data():
    today_str = date.today().isoformat()
    year = date.today().year
    today_games = load_json("today-games.json")

    standings_data = load_json("kbo_standings.json")
    standings = standings_data.get("rows") if standings_data else None

    # 오늘 날짜 scores만 daily-scores.json에서 추출
    daily = load_json("daily-scores.json")
    today_scores = daily.get("dates", {}).get(today_str, []) if daily else []

    # score-summary는 inline 계산 (score-summary.json 파일 없어도 동작)
    team_runs = {}; team_games = {}
    if daily:
        for date_str, games in daily.get("dates", {}).items():
            if not date_str.startswith(str(year)):
                continue
            for game in games:
                if game.get("cancelled") or game.get("outcome") is None:
                    continue
                team_runs[game["away"]] = team_runs.get(game["away"], 0) + game["awayScore"]
                team_games[game["away"]] = team_games.get(game["away"], 0) + 1
                team_runs[game["home"]] = team_runs.get(game["home"], 0) + game["homeScore"]
                team_games[game["home"]] = team_games.get(game["home"], 0) + 1
    teams = [{"teamName": t, "avgRuns": round(team_runs[t] / team_games.get(t, 0), 1)
              if team_games.get(t, 0) > 0 else 0, "totalRuns": team_runs[t], "totalGames": team_games.get(t, 0)}
             for t in sorted(team_runs)]
    score_summary = {"year": year, "teams": teams}

    # 오늘 경기의 game-detail 빌드 (lineup/scoreBoard/pitchingResult)
    today_game_details = {}
    for g in (today_games or {}).get("games", []):
        gid = g.get("id")
        if not gid:
            continue
        m = GAME_ID_REGEX.match(gid)
        if not m:
            continue
        date_str = f"{m.group(1)[:4]}-{m.group(1)[4:6]}-{m.group(1)[6:8]}"
        away_team = TEAM_CODE_MAP.get(m.group(2))
        home_team = TEAM_CODE_MAP.get(m.group(3))
        if not away_team or not home_team:
            continue

        lineup = {"home": [], "away": []}
        starters = {"home": None, "away": None}
        score_board = None
        pitching_result = []
        etc_records = []

        for team_id, side in [(away_team, "away"), (home_team, "home")]:
            record_path = DATA_DIR / "teams" / team_id / "game-records" / f"{date_str}.json"
            if record_path.exists():
                with open(record_path, "r", encoding="utf-8") as f:
                    record = json.load(f)
                lineup[side] = record.get("homeLineup" if side == "home" else "awayLineup", [])
                if not starters[side]:
                    starter = record.get("homeStarter" if side == "home" else "awayStarter")
                    if starter:
                        starters[side] = starter
                if record.get("scoreBoard"):
                    score_board = record["scoreBoard"]
                if record.get("pitchingResult"):
                    pitching_result = record["pitchingResult"]
                if record.get("etcRecords"):
                    etc_records = record["etcRecords"]

        today_game_details[gid] = {
            "gameId": gid, "date": date_str,
            "homeTeam": home_team, "awayTeam": away_team,
            "starters": starters, "lineup": lineup,
            "scoreBoard": score_board, "pitchingResult": pitching_result,
            "etcRecords": etc_records,
        }

    return {
        "todayGames": today_games,
        "standings": standings,
        "todayScores": today_scores,
        "scoreSummary": score_summary,
        "todayGameDetails": today_game_details,
    }
```

### 3.2 score-summary pre-compute

**문제**: score-summary를 계산하려면 daily-scores.json(1MB)의 모든 dates를 순회해야 함.
**해결**: `scheduled_collect()` 파이프라인에서 경기 데이터 수집 직후 score-summary를 미리 계산하여 별도 JSON 파일로 저장.

```python
# scheduled_collect() 내부 (주기적 실행)
def scheduled_collect():
    # ... 기존 데이터 수집 로직 ...

    # score-summary pre-compute
    scores = load_json("daily-scores.json")
    if scores:
        current_year = date.today().year
        summary = compute_score_summary(current_year, scores)
        if summary:
            with open(DATA_DIR / "score-summary.json", "w", encoding="utf-8") as f:
                json.dump(summary, f, ensure_ascii=False, indent=2)
```

이렇게 하면 `/refresh-data`에서 daily-scores.json을 전혀 읽지 않아도 됨. score-summary.json 파일 크기는 ~0.5KB.

### 3.3 서버 부하 분석

- `load_json()`은 `_JSON_CACHE`(TTL 300초)에 캐싱됨
- collector 실행(180~300초 랜덤 간격) 시 `_JSON_CACHE.clear()` → 첫 요청만 cache miss
- Cache miss여도 로컬 SSD에서 JSON 파일 읽기(수 ms) → 부하 미미
- 오늘 날짜 필터링은 dict lookup 1회 → O(1)

---

## 4. 앱 구현

### 4.1 prefetch.ts — fetchRefreshData() 추가

```typescript
// mobile/lib/prefetch.ts

async function fetchRefreshData(): Promise<boolean> {
  try {
    const data = await api.fetchRefreshData();
    if (!data) return false;

    const today = new Date().toISOString().slice(0, 10);

    // todayGames → cache key "today:{YYYY-MM-DD}"
    await db.setCache(`today:${today}`, JSON.stringify(data.todayGames));

    // todayScores → cache key "scores:{YYYY-MM-DD}"
    if (data.todayScores) {
      await db.setCache(`scores:${today}`, JSON.stringify({ games: data.todayScores }));
    }

    // standings
    if (data.standings) {
      await db.setCache("standings:current", JSON.stringify({ rows: data.standings, fetchedAt: "" }));
    }

    // scoreSummary
    if (data.scoreSummary) {
      await db.setCache(`score-summary:${data.scoreSummary.year}`, JSON.stringify(data.scoreSummary));
    }

    // todayGameDetails → "game:{gameId}" (5분마다 백그라운드 갱신)
    for (const [gameId, detail] of Object.entries(data.todayGameDetails)) {
      await db.setCache(`game:${gameId}`, JSON.stringify(detail));
    }

    return true;
  } catch {
    return false;
  }
}
```

### 4.2 prefetchOnAppInit() 변경

```typescript
export async function prefetchOnAppInit(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const cached = await db.getCache(`today:${today}`);

  // TTL 5분 이내면 skip
  if (cached && Date.now() - cached.updatedAt < 300_000) {
    return;
  }

  // In-flight dedup
  if (consolidationPrefetchPromise) {
    await consolidationPrefetchPromise;
    return;
  }

  // 1순위: /refresh-data (~20KB)
  consolidationPrefetchPromise = (async () => {
    const ok = await fetchRefreshData();
    if (!ok) {
      // 2순위: /onboarding-data fallback (~200KB)
      await fetchAndCacheOnboarding();
    }
  })();

  try {
    await consolidationPrefetchPromise;
  } finally {
    consolidationPrefetchPromise = null;
  }
}
```

**Fallback 체인**: `/refresh-data` → `/onboarding-data` → 개별 API

### 4.3 home.tsx — load() 영향도

현재 `load()`에서 호출되는 함수들 중 `/refresh-data`로 대체 가능한 것:

| 함수 | 대체 가능? | 방식 |
|------|:---------:|------|
| `cachedTodayGames()` | ✅ | `/refresh-data`가 `today:{date}` 캐시 갱신 → SQLite hit |
| `cachedGameDetail()` | ✅ | `/refresh-data`가 `game:{gameId}` 캐시 갱신 → 경기상세 진입 시 SQLite hit, 추가 요청 없음 |
| `cachedAllDailyScores()` | ⚠️ 부분적 | 오늘 날짜 scores는 fresh, 과거는 기존 캐시 유지. `scores:__all__` 미갱신 시 `cachedAllDailyScores()`는 개별 API 호출 → **앱 최초 마운트 시 1회**만 발생 |
| `cachedScheduleByMonth()` | ❌ | 24시간 TTL, 별도 유지 |

### 4.4 cachedAllDailyScores() 유지 (lazy)

`cachedAllDailyScores()`는 refresh 경로에서만 우회하고, 다음 사용처는 lazy call 유지:

| 호출 위치 | 호출 시점 | 처리 |
|-----------|----------|------|
| `home.tsx`:preloadAll | 홈화면 mount | `/refresh-data`로 갱신된 오늘 점수로 calCache 일부 커버, stale하면 개별 API |
| `sticker.ts`:computeTeamStreak | 스티커 생성 시 | lazy call 유지 (사용자 액션 기반, 빈도 낮음) |
| `diary.tsx` | 다이어리 진입 | lazy pre-warm 유지 |

---

## 5. 데이터 흐름 비교

### Before (현재)

```
[앱 마운트]
  ↓
cachedTodayGames()  → TTL 체크 → GET /today-games (2KB)
cachedAllDailyScores() → TTL 체크 → GET /daily-scores (1MB)
cachedScheduleByMonth() ×3 → TTL 체크 → GET /schedule/... (48KB)
  ↓
[순위 탭 진입]
cachedStandings() → TTL 체크 → GET /standings (1KB)
cachedScoreSummary() → TTL 체크 → GET /score-summary (0.5KB)
```

### After

```
[앱 마운트 or 포그라운드]
  ↓
prefetchOnAppInit()
  → TTL 체크 (today:{date} < 5분?)
  → GET /refresh-data (~20KB)  ← 단 1개 요청
    ├── today:{date} 갱신 (todayGames)
    ├── scores:{today} 갱신 (todayScores)
    ├── standings:current 갱신
    ├── score-summary:{year} 갱신
    └── game:{gameId}×N 갱신 (todayGameDetails)
  ↓
[순위 탭 진입]        → cachedStandings() → SQLite hit
[경기상세 진입]       → cachedGameDetail() → SQLite hit
```

---

## 6. 예상 효과

| 항목 | Before | After | 개선 |
|------|-------|-------|:----:|
| 홈화면 mount 시 요청 수 | 5개 | 1개 (+ fallback 시 1개) | **80% 감소** |
| 홈화면 mount 시 다운로드 크기 | 1,064 KB | 20 KB (refresh-data) | **98% 감소** |
| 순위 탭 진입 시 요청 수 | 2개 | 0개 (SQLite hit) | **100% 감소** |
| 경기상세 진입 시 요청 수 | 1개 (API 호출) | 0개 (SQLite hit) | **100% 감소** |
| 데이터 신선도 | 5분 | 5분 | 동일 |

---

## 7. 위험 요소 및 대책

| 위험 | 설명 | 대책 |
|------|------|------|
| `/refresh-data` 장애 | 신규 엔드포인트 장애 시 갱신 중단 | `/onboarding-data` fallback (기존 검증됨), 최종 fallback으로 개별 API |
| score-summary 파일 stale | `scheduled_collect()` 실패 시 score-summary.json 갱신 안 됨 | `/refresh-data` 내에서 `load_json("score-summary.json")` 실패 시 None 반환, 앱은 기존 SQLite 캐시 사용 |
| daily-scores.json 구조 변경 | 서버에서 키명 변경 시 todayScores 미반환 | todayScores 누락 시에도 todayGames + standings로 부분 갱신 가능 |
| cachedAllDailyScores 5분 TTL | refresh-data로 today scores만 갱신되면 __all__ 키가 stale | `cachedAllDailyScores()` 내부 TTL 체크 시 만료 → 개별 API 1회 호출 (1MB지만 5분에 1번) |
| 오프라인 | 네트워크 미연결 시 갱신 실패 | 기존 SQLite 캐시 사용 (stale data), 다음 기회에 재시도 |

---

## 8. 변경 파일 목록

| 파일 | 변경 내용 | EAS 빌드 필요? |
|------|----------|:-------------:|
| `server/main.py` (flat) | `/refresh-data` 엔드포인트 추가 + game-detail 빌드 | ❌ (서버만 재시작) |
| `shared/types.ts` | `RefreshData` 인터페이스 추가 (+ `todayGameDetails`) | ✅ |
| `shared/api.ts` | `fetchRefreshData()` 메서드 추가 | ✅ |
| `mobile/lib/api.ts` | `fetchRefreshData` re-export | ✅ |
| `mobile/lib/prefetch.ts` | `fetchRefreshDataAndCache()` + `prefetchOnAppInit()` fallback | ✅ |

---

## 9. Opus 리뷰 요약

[Opus 4.7 review via claude-code]

| 의견 | 판정 | 반영 |
|------|:----:|:----:|
| 설계 방향 적절함 | ✅ | — |
| `cachedAllDailyScores()` 완전 제거 금지 (sticker.ts/diary.tsx 필요) | ✅ | refresh 경로만 우회, lazy call 유지 |
| score-summary pre-compute로 daily-scores.json 로드 회피 | ✅ | `scheduled_collect()`에 추가 |
| 3-date window scores는 per-date 호출로 충분 | ✅ | SQLite cache hit率高 |
| `/refresh-data` 실패 시 `/onboarding-data` fallback | ✅ | `prefetchInitialData()`는 미사용 |
| 서버 JSON cache hit율 충분 (로컬 SSD) | ✅ | 특별 조치 불필요 |
| 캘린더 첫 진입 지연 — `preloadAll()`에서 cachedAllDailyScores 유지 | ✅ | 문제 없음 |
