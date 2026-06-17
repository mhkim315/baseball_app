# Android Widget 디버그 로그 & 반복 오류 방지 가이드

> 마지막 업데이트: 2026-06-17
>
> Android 홈 화면 위젯(react-native-android-widget + RemoteViews) 개발 과정에서
> 발생한 모든 버그, 근본 원인, 해결 방법을 종합 정리합니다.
> 반복되는 오류를 방지하기 위한 체크리스트 포함.

---

## 1. 아키텍처 개요

### 파일 구조

| 파일 | 역할 |
|------|------|
| `mobile/widgets/GameStatusWidget.tsx` | 모든 위젯 사이즈(2x1~5x5)의 UI 렌더링 |
| `mobile/widgets/ScoreboardWidget.tsx` | 대형(4x2+, width≥230 height≥160) 전광판 위젯 |
| `mobile/widgets/updateWidget.tsx` | 위젯 데이터 파이프라인 (API fetch + FCM push → 위젯 업데이트) |
| `mobile/widgets/taskHandler.tsx` | 위젯 시스템 이벤트 핸들러 (WIDGET_CLICK 등) |
| `mobile/lib/teamStorage.ts` | AsyncStorage 팀 동기화 (WIDGET_TEAM_KEY) |
| `mobile/lib/TeamContext.tsx` | 앱 내 팀 상태 관리 (SQLite + AsyncStorage) |
| `mobile/lib/fcm.ts` | FCM push 토큰/핸들러 |
| `mobile/lib/notification.ts` | 잠금화면 전광판 (expo-notifications) |
| `mobile/lib/usePushSetup.ts` | 푸시 설정 React Hook |
| `mobile/index.js` | 백그라운드 핸들러 등록 (최상단) |

### 데이터 흐름 (3-Track)

```
Track A: FCM Push (서버 → data-only → 앱)
  └─ Background: setBackgroundMessageHandler → updateWidgetFromFCM() → ALL widgets
  └─ Foreground: onMessage → updateWidgetFromFCM() → ALL widgets

Track B: Periodic Poll (16s / 5s)
  └─ 홈탭 focusEffect (16s) → load() (화면 데이터만, 위젯 아님)
  └─ Foreground Service HeadlessTask (5s) → updateWidgetPeriodic() → ALL widgets

Track C: User Interaction
  └─ Widget REFRESH click → taskHandler → updateWidgetPeriodic() → ALL widgets
  └─ Widget ADD/RESIZE → taskHandler → updateWidgetPeriodic() → ALL widgets
```

### 위젯 크기별 분기 (GameStatusWidget)

| 크기 | 조건 | 렌더 함수 |
|------|------|-----------|
| 2x1, 3x1 | width < 230, height < 80 | `view2x1()` |
| 3x1, 4x1, 5x1 | width ≥ 230, height < 80 | `view4x1()` |
| 2x2, 3x2, 2x3 등 | width < 230, height ≥ 80 | `view2x2()` → 4분기 |
| 4x2+ (대형) | width ≥ 230, height ≥ 160 | `ScoreboardWidget` |
| 4x2 (중형) | width ≥ 230, height ≥ 80, height < 160 | `view4x2()` |

---

## 2. 반복 오류 카탈로그

### 🔴 Category A: RemoteViews 렌더링 실패 → 백지 위젯

#### A1. 빈 FlexWidget 과다 → inflation 실패

| 항목 | 내용 |
|------|------|
| **증상** | 위젯이 완전히 빈 화면(백지)으로 표시. 다른 크기는 정상 동작 |
| **발생일** | 2026-06-17 (2회) |
| **근본 원인** | `{condition ? <X/> : <FlexWidget/>}` 패턴이 각각 빈 `LinearLayout`을 RemoteViews 트리에 추가. 15+개가 쌓이면 Android `RemoteViews.inflate()` 실패 |
| **해결** | 단일 통합 레이아웃 대신 상태별 분기(scheduled/finished/cancelled/live)로 필요한 요소만 렌더링 |
| **커밋** | `4eaf8e9` |
| **재발 방지** | 새 위젯 레이아웃 추가 시 **빈 fallback을 5개 미만**으로 유지할 것 |

#### A2. TextWidget text="" 빈 문자열 → RemoteViews crash

| 항목 | 내용 |
|------|------|
| **증상** | 위젯이 업데이트되지 않고 마지막 성공한 뷰("오늘 경기 없음")에 갇힘. 2x2와 2x1에서 발생 |
| **발생일** | 2026-06-17 |
| **근본 원인** | `text={data.time \|\| ""}` 등이 `""`를 생성 → Android `setTextViewText(id, "")` 호출이 일부 기기에서 `IllegalArgumentException` 발생 → RemoteViews가 전체 업데이트를 포기하고 이전 뷰 유지 |
| **해결** | 모든 `\|\| ""` → `\|\| " "` (공백 한 칸) |
| **커밋** | `8b648d2` |
| **재발 방지** | **TextWidget의 text prop에 절대 빈 문자열("")이 들어가지 않도록 할 것.** 템플릿 리터럴도 `${val \|\| " "}` 패턴 사용 |

#### A3. TextWidget에 margin 속성 직접 사용 → RemoteViews crash

| 항목 | 내용 |
|------|------|
| **증상** | OTA 업데이트가 다운로드됐으나 위젯이 전혀 렌더링되지 않음 (백지) |
| **발생일** | 2026-06-17 |
| **근본 원인** | `react-native-android-widget`의 TextWidget에 `marginTop`, `marginHorizontal` 등을 직접 사용 → Android RemoteViews가 해당 속성을 해석하지 못하고 예외 발생 |
| **해결** | 모든 margin을 TextWidget에서 제거하고, FlexWidget으로 감싸서 FlexWidget에 margin 적용 |
| **커밋** | `39eab59` |
| **재발 방지** | **TextWidget에는 절대 margin/padding 등 spacing 속성을 직접 주지 말 것.** FlexWidget으로 감싸서 적용 |

#### A4. TextWidget falsy 값 전달 → boolean conditional crash

| 항목 | 내용 |
|------|------|
| **증상** | `{condition && <TextWidget text="hello"/>}` 패턴에서 condition이 false일 때 JS의 `false` 값이 RemoteViews로 전달되어 crash |
| **발생일** | 2026-06-17 |
| **근본 원인** | `&&` 단축 평가가 `false`를 반환하고, 이 falsy 값이 React 컴포넌트 트리에서 RemoteViews로 직렬화됨 |
| **해결** | `{condition ? <TextWidget text="hello"/> : null}` 패턴 사용. 단, null도 위험할 수 있으니 상태별 분기(return early)가 가장 안전 |
| **커밋** | `67a32b7` (1차), `4eaf8e9` (근본 해결) |
| **재발 방지** | **return early 패턴을 기본으로 사용.** 조건부 렌더링이 불가피하면 `condition ? <X/> : null` 사용 |

---

### 🟡 Category B: 데이터 파이프라인 누락

#### B1. FCM push 경로에서 rank/streak 데이터 손실

| 항목 | 내용 |
|------|------|
| **증상** | 서버 `/widget-data`에는 `homeRank`/`awayRank`/`homeStreak`/`awayStreak`가 있지만 FCM push로 업데이트된 위젯에서는 표시 안 됨 |
| **원인** | `buildWidgetProps()`가 FCM flat key(`Record<string,string>`)에서 rank/streak 필드를 추출하지 않음. `_lastWidgetGame` fallback도 `scoreBoard`와 `relay`만 보존 |
| **해결** | `buildWidgetProps()`에 rank/streak 4개 필드 추가 + FCM fallback에서도 보존 |
| **커밋** | `4eaf8e9` |
| **재발 방지** | 서버 API에 새 필드 추가 시 `buildWidgetProps()`와 `_lastWidgetGame` fallback 둘 다 업데이트할 것 |

#### B2. streak 필드 타입 불일치 (.toString() 누락)

| 항목 | 내용 |
|------|------|
| **증상** | `data.awayStreak.startsWith("최근")`에서 TypeError 발생 가능 |
| **원인** | `homeRank`/`awayRank`는 `.toString()`으로 감쌌으나 `homeStreak`/`awayStreak`는 원시값 그대로 전달 |
| **해결** | `String(myGame.homeStreak ?? "")`으로 방어적 변환 |
| **커밋** | `4eaf8e9` |
| **재발 방지** | **서버에서 받은 모든 데이터는 String()으로 감싸서 전달할 것** — API 응답 타입은 보장되지 않음 |

---

### 🟢 Category C: UI/UX 이슈

#### C1. VS 위치가 감정표현 이미지보다 위에 뜸

| 항목 | 내용 |
|------|------|
| **증상** | 2x2 scheduled에서 VS 텍스트가 원정/홈팀 컬럼의 세로 중앙에 위치해 48dp 이미지보다 위에 표시 |
| **해결** | `alignItems: "flex-start"` + `marginTop: 14`로 이미지와 동일선 정렬 |
| **커밋** | `f0ff35d` |

#### C2. 크림 배경에 파스텔톤 글자 가독성 저하

| 항목 | 내용 |
|------|------|
| **증상** | 배경 `#f5f0eb` 위의 alpha 44~88% `#2a2a32` 텍스트가 잘 안보임 |
| **해결** | alpha 값 일괄 상향: `44→77`, `66→99`, `88→cc` |
| **커밋** | `f0ff35d` |

#### C3. 마이팀 변경 후 위젯 반영 지연

| 항목 | 내용 |
|------|------|
| **증상** | 앱에서 팀 변경 시 위젯이 즉시 갱신되지 않고 다음 주기적 업데이트까지 대기 |
| **해결** | `TeamContext.setMyTeam()`에서 AsyncStorage 쓰기 완료 후 `updateWidgetPeriodic()` 호출 |
| **커밋** | `f0ff35d` |

---

### 🔵 Category D: Kotlin 네이티브 이슈

#### D1. RN 0.81.5 getTaskConfig 시그니처 변경

| 항목 | 내용 |
|------|------|
| **증상** | Gradle `compileReleaseKotlin` 실패: `'getTaskConfig' overrides nothing` |
| **원인** | React Native 0.81.5에서 `HeadlessJsTaskService.getTaskConfig(intent: Intent)` → `getTaskConfig(intent: Intent?)`로 파라미터 nullable 변경 |
| **해결** | `Intent` → `Intent?` |
| **커밋** | `2dff04c` |

#### D2. Android 14 Foreground Service Type 필수

| 항목 | 내용 |
|------|------|
| **증상** | Android 14(API 34) 기기에서 Foreground Service 시작 시 런타임 크래시 |
| **원인** | `startForeground(id, notification)` 호출 시 `foregroundServiceType` 미지정 |
| **해결** | `ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC` 추가 + AndroidManifest.xml에 `foregroundServiceType="dataSync"` 선언 |
| **커밋** | `428ec13` |

#### D3. Android 12 Foreground Service 제한

| 항목 | 내용 |
|------|------|
| **증상** | Android 12+에서 백그라운드에서 Foreground Service 시작 시 `ForegroundServiceStartNotAllowedException` |
| **해결** | Live Mode auto start/stop 로직으로 앱이 foreground일 때만 서비스 시작 |
| **커밋** | `cd8cf72`, `3f6b480` |

#### D4. UTF-8 한글 깨짐 (prebuild)

| 항목 | 내용 |
|------|------|
| **증상** | `npx expo prebuild` 후 AndroidManifest.xml, strings.xml, Kotlin 파일에 `풀카운트` → `?카운??` 같은 깨진 문자열 생성 |
| **원인** | Windows 환경에서 `expo prebuild`의 UTF-8 처리 버그 |
| **해결** | 모든 위젯 라벨/설명/텍스트를 영문으로 통일 |
| **커밋** | `f3e1509`, `9cc0d8c`, `4372daf` |

---

## 3. 체크리스트: 새 위젯 기능 추가 전 확인사항

### RemoteViews 안전성
- [ ] TextWidget text prop에 빈 문자열 `""`이 들어가지 않는가? → `|| " "` 사용
- [ ] TextWidget에 margin/padding 속성을 직접 사용하지 않는가? → FlexWidget으로 감싸기
- [ ] 빈 `<FlexWidget />` fallback이 5개 미만인가? → 상태별 분기 사용
- [ ] `condition && <Widget/>` 패턴 대신 early return 또는 `condition ? <Widget/> : null` 사용

### 데이터 파이프라인
- [ ] `/widget-data` API의 새 필드가 `updateWidgetPeriodic()`에서 추출되는가?
- [ ] FCM push 경로(`buildWidgetProps`)에서도 새 필드가 추출되는가?
- [ ] `_lastWidgetGame` fallback에서 새 필드가 보존되는가?
- [ ] 모든 API 값이 `String()`으로 감싸져 있는가? (타입 불일치 방어)

### Kotlin 네이티브
- [ ] `HeadlessJsTaskService`의 메서드 시그니처가 현재 RN 버전과 일치하는가?
- [ ] `startForeground()` 호출에 `FOREGROUND_SERVICE_TYPE`이 지정됐는가?
- [ ] AndroidManifest.xml에 `foregroundServiceType`이 선언됐는가?
- [ ] 모든 문자열이 영문인가? (한글 UTF-8 깨짐 방어)

### 배포
- [ ] OTA는 `--branch test`로 배포 (preview는 동일 runtimeVersion으로 자동 적용)
- [ ] 배포 후 기기에서 앱 재실행(또는 위젯 제거 후 재추가)으로 확인

---

## 4. OTA 배포 가이드

### 채널 전략
- **test**: EAS Build `test-apk` 프로필 (`runtimeVersion: "3.0.0"`)
- **preview**: 사용 중단 — test와 동일 runtimeVersion이라 별도 배포 불필요

### 배포 명령어
```bash
cd mobile
npx eas update --branch test --message "설명"
```

### 적용 확인
- 배포 완료 후 약 1~2분 내 기기에서 다운로드
- 앱 재실행 또는 위젯 제거 후 재추가로 강제 적용 가능

---

## 5. 전체 커밋 히스토리 (위젯 관련)

```
2026-06-17 f0ff35d fix(widget): align VS with images, darken muted text, sync team on refresh
2026-06-17 8b648d2 fix(widget): replace empty string fallbacks with space in TextWidget text
2026-06-17 4eaf8e9 fix(widget): rewrite 2x2 layout as 4 clean branches + streak/rank safety
2026-06-17 67a32b7 Fix native crashes + update 2x2 widget layout
2026-06-17 cd8cf72 fix(widget): fix ForegroundServiceStartNotAllowedException crash on Android 12+
2026-06-17 3f6b480 feat(widget): auto start/stop foreground service based on live status
2026-06-17 9523b36 fix(widget): add missing refresh buttons and remove rank/streak from 2x2
2026-06-17 e97b5a9 fix(server): add widget streaks to response
2026-06-17 9f430d8 chore: record widget OTA debugging and update types
2026-06-17 39eab59 fix(widget): remove margins from TextWidget to prevent native crash
2026-06-17 0ba368e feat(widget): implement pre-game and post-game layouts for widgets
2026-06-17 d731a26 feat: implement Live Mode Foreground Service for widgets
2026-06-17 9f24ebd Merge feat/widget-livescore-4x2 into feat/widget-views-decoupled
2026-06-17 e492db0 feat: updated game status widget layouts and added scoreboard widget
2026-06-17 d28f6bc feat: separate and decouple Android widget views (2x1, 2x2, 3x1, 4x2)
2026-06-16 5b5f0c7 feat: unify Android widget layouts and improve refresh target
2026-06-16 4a7b7d6 fix: relay inning/isTop 우선 사용, P/B 표시 추가, 2x2/3x1 잘림 수정
2026-06-16 5c5621a fix: 4x2 주루 사이 콜론 제거 + 2x2 캐릭터/점수 크기 축소
2026-06-16 331aabf fix: 2x2 위젯 캐릭터 표시 + 4x2 주루 상황 점수 사이로 이동
2026-06-16 9dc5396 fix: 위젯 주루 상황(base1-3) 표시
2026-06-16 cf594f9 fix: 위젯 이닝/초말 표시
2026-06-16 39fd31e fix: BSO 322, 헤더 고정폭 정렬, 2x2 캐릭터 추가
2026-06-16 6cfb36a feat: 2x2 위젯 전용 레이아웃 + 헤더 space-between 정렬
2026-06-16 a0660b8 feat: 1x1~5x5 모든 위젯 크기 선언 (25개)
2026-06-16 3c5e330 feat: 잠금화면 전광판 알림 ON/OFF 스위치 (기본 OFF)
2026-06-16 474c381 feat: 모든 위젯 크기 선언 + 크기별 렌더링
2026-06-16 88b342d feat: Android Widget (4x2) + FCM push + 잠금화면 알림
```

---

## 6. 관련 문서

- `DEVELOPMENT_LOG.md` — 전체 프로젝트 Phase 1~23 + Hotfix
- `mobile/widgets/GameStatusWidget.tsx` — 위젯 UI (`// @ts-nocheck`)
- `mobile/widgets/updateWidget.tsx` — 데이터 파이프라인
- `mobile/widgets/taskHandler.tsx` — 위젯 이벤트 핸들러
- `mobile/lib/TeamContext.tsx` — 팀 상태 관리
- `server/data_api/main.py` — `/widget-data` API (rank/streak 포함)

---

## 7. 2026-06-17 추가 버그 픽스

### 🔴 Category E: Naver API 전면 변경 대응

서버 `/widget-data`가 500 에러 후 모든 경기 `scheduled` 표시. Naver가 API 응답 구조 전면 개편.

| # | 변경 전 | 변경 후 | 영향 |
|---|---------|---------|------|
| E1 | `status` | `statusCode` | 모든 경기 scheduled 오판 |
| E2 | `homeScore`/`awayScore` | `homeTeamScore`/`awayTeamScore` | 점수 null |
| E3 | relay 최상위 `currentGameState` | `textRelayData.currentGameState` | BSO/주자 null |
| E4 | `homeEntry`/`awayEntry` list | dict (`pitcher`/`batter` 키) | p2n 매핑 실패 |
| E5 | base 값 `"0"`/`"1"` | 선수 번호 (예: `"7"`) | 주루 오탐지 |
| E6 | `homeOrAway` int | `homeOrAway` str (`"0"`) | `isTop` 비교 실패 (`"0" == 0` → False) |

### 🔴 Category F: Hermes require() 함수 내 호출 → 포그라운드 먹통

| 항목 | 내용 |
|------|------|
| **증상** | OTA 이후 포그라운드 서비스가 완전히 먹통. REFRESH 무응답, 데이터 갱신 안 됨 |
| **발생일** | 2026-06-17 |
| **근본 원인** | `updateWidget.tsx`에서 `require("react-native")`를 async 함수 내부에서 호출. Hermes 엔진은 `require()`를 모듈 최상위에서만 허용. 함수 내 `require()` → crash → try-catch로 삼켜짐 → `updateWidgetPeriodic` 전체 중단 |
| **해결** | 자동종료 로직을 `taskHandler.tsx`로 이동 (최상위에서 `NativeModules` import). `updateWidget.tsx`에서 `require()` 제거 |
| **커밋** | `4e0eff5` |
| **재발 방지** | **절대 함수 내에서 `require()` 호출하지 말 것.** 필요한 모듈은 파일 최상단에서 import |

### 🟡 Category G: 투수/타자명 미표시

| 항목 | 내용 |
|------|------|
| **증상** | 위젯/앱에서 `P:` `B:` 옆에 이름이 "-" 또는 빈 값으로 표시 |
| **근본 원인** | Naver API 변경(E4)으로 `homeEntry`/`awayEntry`가 list→dict로 바뀌며 pcode→name lookup 실패 |
| **타자 해결** | `textRelays` 전체 스캔 → `pcode→name` 맵 구축 → `currentGameState.batter` pcode로 현재 타자명 조회 |
| **투수 해결 (2단계)** | 1) 스케줄 API의 `awayCurrentPitcherName`/`homeCurrentPitcherName`을 widget-data 응답에 `awayCurrentPitcher`/`homeCurrentPitcher`로 추가 (경기 중 불펜 교체도 실시간 반영). 2) `isTop` 기준으로 수비 중인 팀의 현재 투수를 `relay.pitcher.name`에 주입 |

### 🟢 Category H: FCM Push 비활성화

- **배경**: `push_worker.py`가 1:1 개별 FCM 전송 → 수백 명만 돼도 병목
- **판단**: 앱 폴링(16s) + 위젯 포그라운드(6s) + 수동 REFRESH로 실시간성 충분
- **설정**: `ENABLE_PUSH_NOTIFICATIONS=false` (systemd override)
- **영향**: 백그라운드 완전 종료 시 15~30분 OS 주기로만 갱신 (위젯 provider `updatePeriodMillis=900000` 으로 개선)

### 🟢 Category I: 포그라운드 자동종료 + Doze 대응

| 항목 | 내용 |
|------|------|
| **자동종료** | `LiveScoreTask`에서 매 주기 `data.status !== "live"` 체크 → 경기 종료 시 `stopService()` |
| **안전장치** | Kotlin `LiveScoreService`에 60분 타임아웃 (APK 빌드 필요) |
| **15분 주기 wake** | 모든 위젯 provider `updatePeriodMillis`: 0 → 900000 (APK 빌드 필요) |
| **Doze 동작** | AOD ON → Handler 정상, AOD OFF → 콜백 큐에 쌓임 → 화면 ON 시 순차 실행 |
| **개선 과제** | AlarmManager 전환 (다음 APK) |
