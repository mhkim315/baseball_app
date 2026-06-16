# Code Review: 서버 game-detail DH 2차전 식별 문제

## 배경

더블헤더 2차전 경기 상세 페이지(game/[id])에서 1차전의 선발투수/라인업/스코어보드가 그대로 표시되는 버그가 있습니다. resolveGames() 통합으로 모바일 앱의 점수 매칭은 이미 수정되었으나, 서버(`/game-detail/{game_id}`)가 DH 2차전을 올바르게 식별하지 못해 잘못된 game-records 데이터를 반환하는 것이 근본 원인입니다.

---

## 데이터 흐름

### 1. gameId 생성 (buildGameId)
```
buildGameId(awayId, homeId, date, suffix) → "20260528-LGKT-2"
```
- `suffix`: 일정 배열 내 0-based global position
- ex) 2026-05-28에 KIA:LG(1차), 두산:한화, KIA:LG(2차) 3경기 → suffix: 0, 1, 2
- `/game-detail/20260528-LGKT-2` 호출 시 서버는 DH 2차전을 요청받음

### 2. 서버 game-detail 엔드포인트 (`server/data_api/main.py:402`)
```python
m = GAME_ID_REGEX.match(game_id)  # (\d{8})-([A-Z]{2})([A-Z]{2})-(\d)
game_seq = int(m.group(4))  # suffix digit
```
- today-games.json / daily-scores.json에서 gameId exact match 시도
- 실패 시 matchup 기준 fallback (gameIdx / relative index 계산)
- **이후 game-records 데이터 로딩에서는 DH 구분 없음** (핵심 문제)

### 3. game-records 읽기 (`main.py:458-474`)
```python
for team_id, side in [(away_team, "away"), (home_team, "home")]:
    record_path = DATA_DIR / "teams" / team_id / "game-records" / f"{date_str}.json"
    if record_path.exists():
        record = json.load(f)
        lineup[side] = record.get("homeLineup" if side == "home" else "awayLineup", [])
        starter = record.get("homeStarter" if side == "home" else "awayStarter")
        score_board = record.get("scoreBoard")
```
- game-records 파일은 **팀 × 날짜** 단위 (`doosan/2026-05-28.json`)
- DH 당일 두 경기 데이터가 한 파일에 있으나, 서버는 **DH 1차전/2차전 구분 없이** 최상위 필드만 읽음
- 결과: DH 2차전에서도 1차전의 선발/라인업/스코어보드가 반환됨

### 4. 현재 Naver 스크래핑 구조 (`scripts/build_game_records.py`)
- Naver API의 `schedule/games/{gameId}` → 각 gameId별로 데이터 조회 가능 (DH 1차/2차가 다른 gameId)
- 그러나 저장 시 `{date}.json` 단일 파일에 병합 → DH 2차전 데이터가 1차전 데이터를 덮어쓰거나 무시됨

---

## 분석 필요 사항

### 핵심 질문
DH 2차전이 1차전과 다른 gameId를 가지고 있음에도, 서버가 이를 구분하지 못하고 동일한 game-records 데이터를 반환하는 문제를 어떻게 해결할 것인가?

### 고려할 수 있는 접근법

**A. game-records 파일명에 DH suffix 추가**
- 현재: `teams/doosan/game-records/2026-05-28.json`
- 제안: `teams/doosan/game-records/2026-05-28_1.json` (DH 1차), `2026-05-28_2.json` (DH 2차)
- 장점: 데이터 출처(Naver API)가 각 gameId를 독립적으로 제공하므로 저장 시점에서 분리 가능
- 단점: 기존 데이터 마이그레이션 필요, backfill 스크립트 수정

**B. 서버가 game-records 파일 내에서 DH 구분하여 읽기**
- Naver 스크래핑 시 gameId별 데이터를 파일 내부에 key 분리하여 저장 (예: `lineup_1`, `lineup_2`)
- 서버에서 `game_seq`를 보고 올바른 key의 데이터 선택
- 단점: game-records JSON 구조 변경 필요, 기존 데이터와의 호환성

**C. 모바일 앱에서 DH 2차전 선발/라인업을 별도 API로 보완**
- `fetchGameDetail()` 결과가 DH 1차전 데이터임을 감지하면, today-games API 등에서 별도 조회
- 서버 수정 없이 앱에서 해결
- 단점: 근본적인 서버 문제를 회피, 데이터 정합성 보장 어려움

### 검증 포인트
- [ ] Naver API의 `schedule/games/{gameId}`가 DH 1차/2차에 대해 정말 다른 데이터를 반환하는가?
- [ ] 현재 game-records JSON 파일 구조에서 DH 1차/2차 데이터가 어떻게 저장되어 있는가? (중복 덮어쓰기인가, 둘 다 보존?인가)
- [ ] daily-scores.json의 gameIdx와 buildGameId suffix 간 매핑이 정확한가?
- [ ] 기존 데이터(2020-2025)도 같은 문제가 있는가, 아니면 2026년에만 발생?

---

## 컨텍스트 링크

- [game-detail 엔드포인트](server/data_api/main.py#L402)
- [resolveGames.ts — 모바일 측 DH 점수 매칭](mobile/lib/resolveGames.ts)
- [buildGameId — gameId 생성](shared/constants.ts)
- [game/[id].tsx — 모바일 game-detail 호출](mobile/app/game/[id].tsx)
- [gameIdx 컨벤션 문서](gameidx-convention.md)
- [game-records suffix fix 이력](game-records-suffix-fix.md)
- [백필 스크립트](scripts/backfill_multi_year.py)
