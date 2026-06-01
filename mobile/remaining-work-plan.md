# 남은 작업 계획

## 우선순위

1. **~~AppState prefetch + dedup 리셋 버그~~** ✅ 완료
2. **~~April/May/March game-records 재수집~~** ✅ 완료 (3/12~5/12 전구간)
3. **~~서버 선발투수 ?? 버그~~** ✅ 완료
4. **~~온보딩 연도 필터~~** ✅ 완료
5. **📋 경량 갱신 엔드포인트 `/refresh-data`** — 설계 완료, 구현 대기
6. **EAS 빌드** — 필요 시 진행

---

## 5. 경량 갱신 엔드포인트 `/refresh-data`

### 문제
홈화면 mount 1번에 **1MB+ 7개 요청** 발생. `cachedAllDailyScores()`가 729일치(1MB) daily-scores 전체를 5분마다 재검증.

### 해결
`/refresh-data` 엔드포인트 (~5KB)로 5분 주기 갱신 통합. score-summary pre-compute로 서버 부하 최소화.

### 변경 파일

| 파일 | 변경 내용 | EAS 필요? |
|------|----------|:---------:|
| `server/data_api/main.py` | `/refresh-data` 엔드포인트 + `scheduled_collect()`에 score-summary pre-compute | ❌ |
| `shared/api.ts` | `fetchRefreshData()` 타입/스키마 추가 | ✅ |
| `shared/schemas.ts` | `RefreshDataResponseSchema` 추가 | ✅ |
| `mobile/lib/prefetch.ts` | `fetchRefreshData()`, `prefetchOnAppInit()` 변경 | ✅ |

### 상세 설계 문서
→ [refresh-endpoint-plan.md](refresh-endpoint-plan.md)

---

## 6. EAS 빌드

**버전 정보**:
- 현재: v1.0.11 (versionCode 12)
- 5번 구현 완료 후 진행 권장

**미적용 앱 변경사항** (현재 빌드가 없어도 서버 데이터로 커버 가능):
- AppState 프리페치 (`home.tsx`)
- dedup promise 누수 수정 (`prefetch.ts`)
- 경기상세 3초 자동 재시도 (`game/[id].tsx`)
- fetchWithCache 백그라운드 재시도 (`gameCache.ts`)
- 경기상세 코치멘트 줄바꿈/분기
- `/refresh-data` 연동 (구현 후)
