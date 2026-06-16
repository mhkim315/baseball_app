# Android Widget OTA 업데이트 미적용 문제 — 원인 추정 요청

## 상황 요약
React Native Expo 앱(풀카운트)에서 Android Widget 기능을 구현 중입니다. 위젯 렌더링 코드를 수정하고 `eas update`(OTA)로 3번 배포했지만, 위젯이 전혀 변하지 않습니다. **텍스트 하나(문구 포맷)도 바뀌지 않는 것**으로 보아 OTA 업데이트 자체가 위젯 컨텍스트에 적용되지 않는 것으로 보입니다.

## 환경
- **Expo SDK 54**, React 19.1.0, React Native 0.83
- **react-native-android-widget v0.20.3** — JSX를 Android RemoteViews로 렌더링하는 라이브러리
- **EAS Build profile**: `preview` (channel: "preview", distribution: internal, APK)
- **Runtime version policy**: `appVersion` (현재 `app.json` version = "1.1.8")
- **OTA 배포**: `eas update --branch preview --message "..."` (preview 채널)
- **테스트 앱**: `kr.fullcount.app.test` 패키지, 풀카운트_test
- **newArchEnabled: true** (New Architecture / Fabric + TurboModules)

## 위젯 아키텍처

### 1. 위젯 초기 XML 레이아웃
`android:initialLayout="@layout/rn_widget"` — 빈 FrameLayout + 2개의 ImageView (light/dark 모드). 위젯은 이 ImageView에 비트맵을 세팅하는 방식으로 렌더링됨.

### 2. 위젯 업데이트 파이프라인

**JS 측** (`requestWidgetUpdate`):
```
renderWidget 콜백 → JSX 반환
  → buildWidgetTree(jsx) → WidgetTree JSON {type, props, children}
    → AndroidWidget.drawWidgetById(config, widgetName, widgetId)
```

**Native 측** (`RNWidget.drawWidget`):
```
config(WidgetTree JSON)
  → WidgetFactory.buildWidgetFromRoot() → 실제 Android View 계층 생성
    → View를 Bitmap으로 렌더링 (drawViewToBitmap)
      → Bitmap을 PNG로 디스크에 저장
        → ImageView에 URI 세팅 → AppWidgetManager.updateAppWidget()
```

### 3. 위젯 업데이트 트리거

**A. WIDGET_ADDED / WIDGET_RESIZED (Native → Headless Task)**:
```
RNWidgetProvider.onUpdate()
  → RNWidgetJsCommunication.startBackgroundTask() [WorkManager]
    → RNWidgetBackgroundTaskWorker (headless JS task)
      → AppRegistry.registerHeadlessTask("RNWidgetBackgroundTask")
        → taskHandler (등록된 콜백) → updateWidgetPeriodic()
```

**B. 홈화면 진입 시 (React 컴포넌트)**:
```
home.tsx useEffect
  → updateWidgetPeriodic()
    → API fetch → requestWidgetUpdate() 25개 위젯 이름 전부
```

### 4. updateWidgetPeriodic() 상세
```typescript
export async function updateWidgetPeriodic(): Promise<void> {
  const myTeam = await getMyTeamForWidget(); // AsyncStorage
  if (!myTeam) return;  // 팀 미설정 시 early return

  // API fetch
  const res = await fetch(`${API_BASE}/widget-data`);
  const json = await res.json();
  const myGame = json.games.find(g => /* team match */);

  // 데이터 매핑 (relay → inning, score 등)
  const data = { homeTeam, awayTeam, homeScore, awayScore, inning, time, ... };

  // 25개 위젯 모두 업데이트
  await updateAllWidgets(myTeam, data);
}
```

## 수정한 코드

### 1. `GameStatusWidget.tsx`
- 팀별 배경색 맵 추가 (`TEAM_BG_COLORS`: doosan → #131230, lg → #C0334A 등)
- 상태 텍스트 포맷 수정: `"18:30" + "회"` → `"18:30"` (시간만 표시)
- `homeIsMyTeam` 필드 추가로 내 팀 구분

### 2. `updateWidget.tsx`
- `inning` 필드: relay 데이터만 사용 (API time과 분리)
- `time` 필드 추가: 게임 시간 별도 저장
- `homeIsMyTeam` computed property: SHORT_CODE_TO_TEAM_ID로 비교
- try-catch로 `requestWidgetUpdate` 예외 처리

### 3. `home.tsx`
- `useEffect(() => { updateWidgetPeriodic(); }, [myTeam]);` 추가
  (홈화면 진입 시마다 위젯 강제 업데이트)

## 확인된 사실

### API 응답 (정상)
```json
{
  "gameId": "20260616-KTOB-0",
  "time": "18:30",
  "status": "scheduled",
  "homeTeam": "OB",
  "awayTeam": "KT",
  "homeName": "두산",
  "awayName": "KT",
  "score": null,
  "relay": null
}
```

### 사용자 증상
- "흰색배경에 18:30회 두산 vs kt 0:0 처음이랑 똑같아"
- 배경색(팀 컬러)도 안 바뀌고, 텍스트 포맷도 안 바뀜
- 4x2 위젯 기준으로 확인

### 텍스트가 안 바뀐 결정적 증거
- **구코드**: `inning + "회"` → `"18:30" + "회"` = **"18:30회"**
- **신코드**: `data.time` → **"18:30"** ("회" 없음)
- 사용자가 본 것은 **"18:30회"** → 구코드 실행 중

### OTA 배포 이력
1차: `test` 브랜치에 배포 (build는 preview 채널) → **브랜치/채널 불일치** (실패)
2차: `preview` 브랜치에 배포 → 채널 일치하나 변화 없음
3차: `preview` 브랜치 재배포 → 여전히 변화 없음

## 원인 추정이 필요한 부분

**왜 OTA 업데이트가 위젯에 적용되지 않는가?**

### 가설 1: 런타임 버전 불일치
- `eas update` 실행 시점의 `app.json` version과 빌드 시점의 version이 다를 가능성
- 단, 사용자가 확인한 앱 버전은 1.1.8로 일치

### 가설 2: OTA는 앱 재시작 후 적용
- Expo Updates 시스템: OTA는 다음 cold start에 적용됨
- 사용자가 앱을 완전히 종료했다가 재시작하지 않았을 가능성
- 하지만 3번의 OTA 배포 + 테스트 과정에서 재시작했을 가능성 높음

### 가설 3: Headless task가 OTA 번들을 사용하지 않음
- `RNWidgetBackgroundTaskWorker`가 실행되는 JS 컨텍스트가 OTA-updated bundle이 아닌 embedded bundle을 사용할 가능성
- WorkManager 기반 headless task가 `expo-updates`의 번들 스와핑 메커니즘과 충돌할 가능성
- 특히 `newArchEnabled: true` (TurboModules) 환경에서 차이가 있을 수 있음

### 가설 4: buildWidgetTreeInner가 React 19에서 실패
- `buildWidgetTreeInner`는 컴포넌트 함수를 직접 호출: `jsxTree.type(jsxTree.props)`
- React 19 + `babel-preset-expo`에서 함수 컴포넌트가 React Compiler에 의해 변환될 경우 직접 호출이 실패할 수 있음
- `buildWidgetTree`의 에러 핸들러는 "use no memo" 지시어를 권장함
- 단, `babel.config.js`에 `babel-plugin-react-compiler`가 명시적으로 추가되지 않아 컴파일러가 활성화되지 않았을 가능성 높음

### 가설 5: requestWidgetUpdate 내부 예외 (silent failure)
- `updateAllWidgets`에 try-catch가 있지만 `console.warn`만 출력
- 사용자가 로그를 볼 수 없어 예외 발생 여부를 모름
- 자세한 에러 로깅이 필요

### 가설 6: getMyTeamForWidget()이 null 반환
- `@fullcount_widget_team` AsyncStorage 키가 설정되지 않았을 가능성
- `setMyTeamWithSync()`가 호출되지 않으면 `getMyTeamForWidget()`이 null 반환
- 이 경우 `updateWidgetPeriodic()`이 early return
- 하지만 사용자에게는 "18:30회" 데이터가 보이므로, 팀은 설정되어 있음

### 가설 7: requestWidgetUpdate가 widgetName을 찾지 못함
- `AndroidWidget.getWidgetInfo()`가 Widget4x2의 provider class name을 찾지 못함
- `getWidgetProviderClassName()`이 `installedProviders`에서 일치하는 이름을 못 찾음
- TurboModules 환경에서 native module이 다르게 동작할 가능성

## 핵심 파일 구조
```
mobile/
  app.json                    — version 1.1.8, 25개 위젯 선언
  eas.json                    — preview profile → channel "preview"
  index.js                    — setupBackgroundHandlerDefault + registerWidgetTasks → expo-router/entry
  babel.config.js             — module-resolver만 있음 (react-compiler 없음)
  widgets/
    GameStatusWidget.tsx      — 위젯 UI (FlexWidget/TextWidget)
    updateWidget.tsx          — updateWidgetPeriodic, requestWidgetUpdate 호출
    taskHandler.tsx           — registerWidgetTaskHandler
  app/(tabs)/home.tsx         — useEffect로 updateWidgetPeriodic 호출
  lib/
    teamStorage.ts            — getMyTeamForWidget (AsyncStorage)
```

## 요청
이 모든 상황을 종합할 때, **OTA 업데이트가 위젯에 적용되지 않는 가장 가능성 높은 원인**과 그 **검증 방법**을 알려주세요. 추가로 필요한 정보가 있다면 무엇을 확인해야 하는지도 알려주세요.
