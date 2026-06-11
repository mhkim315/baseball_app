# outcome 필드 일괄 수정 및 재빌드 계획

## 현황

- **점수(score)**: 모든 데이터 정상 (game-records 1,541건 + KBO API 28건 검증 완료)
- **outcome 필드**: 6개 파일에서 총 2,875건 오류 (W/L 반대)
  - 서버 `daily-scores.json`: 1,823건
  - 앱 번들 `scores_20{21-25}.json`: 1,052건
- **근본 원인**: `build_season.py` T/B swap → `merge_scores.js` 병합 시 outcome 계산 불일치
- **재발 방지**: `build_season.py` 점수 T/B swap 이미 수정됨. 선발투수 swap도 수정 필요.

---

## Phase 1: 앱 번들 데이터 수정 (로컬)

**대상**: `mobile/lib/data/scores_2021.json` ~ `scores_2025.json` (5개)

**방법**: 각 파일의 모든 게임에 대해 `awayScore > homeScore → "W"`, `< → "L"`, `== → "T"` 로 outcome 재계산. 취소 경기는 제외.

**위험도**: 낮음. 점수는 변경하지 않고 outcome 문자열만 교정.  
**영향**: 직관/집관 통계, 배지(승리토템), 스티커 바로가기 등 outcome 기반 로직이 정상 작동하게 됨.  
**검증**: 수정 전후 diff 확인, sample spot-check.

## Phase 2: 서버 데이터 수정

### 2a. daily-scores.json 교체
- 수정된 `daily-scores-fixed.json`을 서버로 업로드
- 기존 파일 백업 후 교체: `cp daily-scores.json daily-scores.json.bak`
- `regenerate_json_files.py` 실행하여 파생 파일 재생성

### 2b. 재발 방지 조치
- `build_season.py` line 111-112 선발투수 swap 수정 (B_PIT/T_PIT → 올바른 매핑)
- 서버에서 수정된 build_season.py로 교체
- 기존 season JSON 파일(`data/seasons/*/regular-season.json`)도 outcome 재계산 (차후 regenerate 시 재발 방지)

**위험도**: 중간. 서버에서 파일 교체 시 서비스 중단 최소화 필요.  
**롤백**: `daily-scores.json.bak` 으로 즉시 복구 가능.

## Phase 3: 로컬 데이터 정합성 검증

- 수정 전후 `diff` 확인하여 의도하지 않은 변경 없는지 체크
- `npm test` (Jest 26 tests) 실행하여 기존 통계/배지 로직 regression 확인
- 수동 스팟 체크: 2020-05-05, 2025-05-17 등 이슈 있었던 날짜

## Phase 4: 앱 재빌드

- `mobile/app.json` version, versionCode 1씩 증가
- `eas build --platform android --profile production`
- 빌드 완료 후 기기에서 smoke test:
  - [ ] 경기상세 점수/승패 표시 정상
  - [ ] 직관/집관 통계 승률 정상
  - [ ] 배지(승리토템) 발동 정상
  - [ ] 스티커 바로가기 경기 선택 정상
- Play Store 비공개 테스트 → 프로덕션 출시

---

## 실행 순서

```
Phase 1 (로컬 번들 수정)
  ↓
Phase 3 (검증: diff + Jest + spot-check)
  ↓
Phase 2 (서버 교체)
  ↓
Phase 4 (재빌드 + Play Store)
```

Phase 1→3은 로컬에서 안전하게 진행 가능. Phase 2는 독립적.
