# 서버 작업 로그

## 2026-06-19: 위젯 1.3.2 출시 + Naver API 대응 + Daum 폴백

### Naver API 필드 검증 결과

**Naver가 바꾼 게 아니라 원래 그랬던 것:**
- `homeScore`/`awayScore` → 항상 None. 실제 필드는 `homeTeamScore`/`awayTeamScore`
- `status` → 항상 None. 실제 필드는 `statusCode`
- relay 응답: 원래부터 `textRelayData` 래퍼 구조 (6/18까지는 relay를 안 써서 몰랐음)

**진짜 변경된 것:** 어제→오늘 사이 `textRelayData` 래퍼 추가. `homeEntry` 구조 `[...]` → `{batter:[],pitcher:[]}`

### Daum Sports API 발굴

- `sports.daum.net/prx/hermes/api/game/{ID}` → cpGameId로 매칭 (Naver team code와 100% 일치)
- `issue.daum.net/api/arms/SPORTS_GAME?gameId={ID}&detail=liveData` → liveData.ground에 BSO/주자/투수/타자
- ID 체계: 날짜별 순차 증가 (5경기/일, 비경기일 스킵)
- `daum_adapter.py`: `normalize_game` + `normalize_relay` + ID 스캔

### 3중 폴백 체계

### 아키텍처 변경

```
Naver API → main:8000 (7s TTL) → widget_worker:8001 (1s 폴링, 28MB)
                                              └→ /widget-data (외부 서빙)
KBO API  → collector → today-games.json (fallback)
Daum API → daum_adapter (2차 fallback)
```

### Naver API SSOT 통합 (91b6d91)

- widget_worker: Naver API 호출 제거 → main:8000 1초 폴링 프록시 (243MB→28MB)
- main.py: `statusCode` 필드명, 숫자 상태코드, gameId fallback
- naver_api.py: `parse_score_inning` list + dash 형식 처리

### KBO Fallback (e9c7916)

- Naver `schedule_games` 실패 시 `today-games.json`으로 폴백
- 내부 팀ID ↔ Naver short code 변환
- relay/scoreBoard/weather는 빈 값

### Relay 백오프 (50ee050, 1443fe6)

- 실패 시 `(now-4, None)`으로 1초 TTL
- 연속 실패 백오프: `[1, 1, 3, 5, 5, 10]`초 → cap 10s
- 성공 시 `_RELAY_FAILURES.pop()` → 초기화
- Rate limiter localhost 예외 처리 (09061cc)

### Push 최적화 (e48513b, 7853019)

- 변경 감지: 상태 + 득점 + 이닝 (BSO/주루 제거)
- 경기당 ~24~29회 (득점 5-10 + 이닝 17 + 상태 2)
- 경기전 30분 간격 weather refresh push

### 경기 시작 실시간 대응 (18:28~18:55 KST)

**발견된 Naver API 변경 (총 8개):**

| # | 버그 | 원인 | 커밋 |
|---|------|------|------|
| 1 | `parse_rheb` 크래시 | RHEB `[0,0,0,0]` 리스트 형식 | 4e58e4e |
| 2 | live→scheduled 역전 | `datetime.now()` UTC | 5fb59f5 |
| 3 | relay 데이터 누락 | `textRelayData` 래퍼 추가 | deddbee |
| 4 | `homeEntry` 구조 변경 | `[...]` → `{batter:[],pitcher:[]}` | deddbee |
| 5 | 투수/타자명 누락 | `homeLineup`/`awayLineup` 추가 | 98d3f40 |
| 6 | 앱 9회말 표시 | `getInningInfo(scoreBoard.inn)` 우선 | f76eff1 |
| 7 | 점수 전부 0:0 | `homeScore`→`homeTeamScore` | 23bbf23 |
| 8 | inning 배열 9개 전부 0 | `-`→0 변환 버그 | 6ba0aa9 |

**Naver API 필드 변경 내역:**

| Naver (구) | Naver (신) | 영향 |
|------------|-----------|------|
| `status` | `statusCode` | 값이 텍스트+숫자 혼재 |
| `homeScore` | `homeTeamScore` | 구버전 None |
| `awayScore` | `awayTeamScore` | 구버전 None |
| `homeTeamScoreByInning` | 형식 변경 | CSV → list string, `-`=미진행 |
| `homeTeamRheb` | 형식 변경 | CSV → list |

**game_relay 응답 구조:**

| 버전 | 구조 |
|------|------|
| v1 (6/18) | `{ homeEntry: [...], awayEntry: [...], currentGameState: {...} }` |
| v2 (6/19) | `{ textRelayData: { homeEntry: {batter:[],pitcher:[]}, currentGameState: {...}, inn, homeOrAway } }` |
| v3 (6/19) | v2 + `homeLineup`/`awayLineup` 추가 |

### Naver Adapter Layer (6b26c35)

`scripts/naver_adapter.py`: Naver 응답 → 내부 표준 형식 정규화

- `normalize_game(raw)` → 표준 game dict (team codes, scores, venue, time)
- `normalize_relay(raw)` → 표준 relay dict (BSO, bases, pitcher/batter with names)
- `parse_score_inning()` → list/CSV/dash 처리 + 미진행 이닝 truncate
- `parse_rheb()` → list/CSV/formats 처리

### Daum Sports API 폴백 (2a74224, a4df73c)

`scripts/daum_adapter.py`: Naver 완전 장애 시 2차 데이터 소스

**데이터 소스:**
- `sports.daum.net/prx/hermes/api/game/{ID}` → 게임 요약
- `issue.daum.net/api/arms/SPORTS_GAME?gameId={ID}&detail=liveData` → 라이브 데이터

**ID 체계:** 날짜별 순차 증가 (5경기/일, 비경기일 스킵)
- 기준점: 2026-06-18 = 80100867
- 스캔 방식으로 대상 날짜 게임 검색

**제공 데이터:** 점수, 이닝별 득점, RHEB, BSO, 주자, 투수/타자(이름), 선발, 구장

### Daum Fallback 통합 (d8c83be, b40ea43)

`main.py`에 3중 폴백 체계:

```
Naver → _validate_games() 검증
  ├─ 통과 → 정상 반환 (Daum ID pre-fetch)
  └─ 실패 → Daum (cooldown 120s, fetch-in-flight 보호)
       ├─ 통과 → Daum 데이터 (TTL 60s)
       └─ 실패 → KBO today-games.json
```

**보호 장치:**
- `_validate_games()`: 팀코드/venue 누락, live+점수None 감지
- Naver health tracking: 장애 시 5분간 재시도 스킵
- Daum cooldown 120s + fetch-in-flight 중복 방지
- Daum ID pre-fetch (30분 TTL, Naver 정상 시 미리 확보)

### 서버 수정 파일 총괄

| 파일 | 주요 수정 |
|------|----------|
| `server/data_api/main.py` | KBO fallback, Daum fallback, relay 백오프, timezone KST, statusCode, gameId fallback, validation, health tracking |
| `scripts/naver_adapter.py` | Naver 응답 정규화 (신규) |
| `scripts/daum_adapter.py` | Daum API 연동 (신규) |
| `scripts/naver_api.py` | `parse_score_inning` list+dash+truncate, `parse_rheb` list |
| `scripts/push_worker.py` | 이닝 감지, weather 30분 push |
| `server/data_api/widget_worker.py` | 36줄 타이머 프록시로 전환 |
