# 남은 작업 계획

## 우선순위

1. ~~AppState prefetch + dedup 리셋 버그~~ ✅ 완료
2. ~~April/May/March game-records 재수집~~ ✅ 완료 (3/12~5/12 전구간)
3. ~~서버 선발투수 ?? 버그~~ ✅ 완료
4. ~~온보딩 연도 필터~~ ✅ 완료
5. ~~경량 갱신 엔드포인트 `/refresh-data`~~ ✅ 완료
6. **EAS 빌드** — 필요 시 진행

---

## 완료된 항목 (#5)

| 항목 | 상태 |
|------|:----:|
| 서버 `/refresh-data` 엔드포인트 | ✅ 서버 반영 완료 |
| game-detail 포함 (lineup/scoreBoard/pitchingResult) | ✅ 서버 + 앱 반영 완료 |
| shared/types.ts RefreshData 인터페이스 | ✅ 커밋 완료 |
| shared/api.ts fetchRefreshData() | ✅ 커밋 완료 |
| mobile/lib/api.ts re-export | ✅ 커밋 완료 |
| mobile/lib/prefetch.ts fetchRefreshDataAndCache() | ✅ 커밋 완료 |
| prefetchOnAppInit() fallback 체인 | ✅ 커밋 완료 |

**Fallback 체인**: `/refresh-data` → `/onboarding-data` → 개별 API

---

## 6. EAS 빌드

**버전 정보**:
- 현재: v1.0.11 (versionCode 12)
- 필요 시 진행

**미적용 앱 변경사항** (서버 데이터로 일부 커버 가능):
- AppState 프리페치 (`home.tsx`)
- dedup promise 누수 수정 (`prefetch.ts`)
- 경기상세 3초 자동 재시도 (`game/[id].tsx`)
- fetchWithCache 백그라운드 재시도 (`gameCache.ts`)
- 경기상세 코치멘트 줄바꿈/분기
- `/refresh-data` 연동 (SQLite cache 갱신 로직)
