# Code Review: 스티커(Sticker) 시스템 구현 계획

> **리뷰 결과**: ⚠️ 수정 후 통과 (Conditional Pass)
> 리뷰 일시: 2026-05-29
> 리뷰어: Claude Opus 4.7 (외부 에이전트)
>
> **수정 반영 사항**
> - ScoreEntry에 game_type 부재 → 시범경기 필터링 방식 재설계 (아래 1a 참고)
> - handleCopy() 변수 스코핑 버그 수정 (uri → try 블록 밖으로)
> - win_rate_cache → jikgwan_records 직접 쿼리로 정정
> - expo-clipboard 설치 필요 (npx expo install expo-clipboard)
> - setImageAsync: tmpfile 대신 base64 사용으로 변경
> - ViewShot/Android: 프로젝트 내 첫 사용, 실기기 QA 필수

## 배경

모바일 앱(fullcount.kr)의 경기 상세 화면에서 사용자가 직관한 경기 결과를 인스타그램 스토리에 공유할 수 있는 동적 스티커를 생성하는 기능.
사용자가 직접 경기장에서 찍은 사진이나 티켓 없이도, 앱이 보유한 경기 데이터와 사용자의 직관 통계를 조합하여 인스타 스티커를 만들어 클립보드에 복사해준다.

---

## 데이터 흐름

```
경기 상세 화면 → [스티커 만들기] 버튼
  → StickerEditorModal (bottom sheet)
    → 게임 데이터 조회: cachedDailyScores(date) | cachedGameDetail(gameId)
    → 사용자 통계 조회: computeDiaryStats(), computeStreakStats()
    → 팀 연승 계산: computeTeamStreak()
    → 해시태그 로직: resolveHashtags()
    → ViewShot.captureRef() → Clipboard.setImageAsync()
    → 실패 시: Sharing.shareAsync() fallback
```

---

## 데이터 소스

| 데이터 | 출처 | 상세 |
|--------|------|------|
| 경기 점수/이닝 | `cachedDailyScores(date)` | API 캐시, 로컬 JSON (2021-2026) |
| 팀명/순위 | `cachedTodayGames()` | 홈/원정 팀명, 순위 |
| 직관 승률 | `getTeamDiaryStats(teamId)` | `jikgwan_records` 직접 쿼리 (is_win 집계) |
| 직관 streak | `computeStreakStats()` | `jikgwan_records` 기반 연승/연패 |
| 팀 연승 | `computeTeamStreak(year, teamId)` | **신규**, 스코어 데이터로 로컬 계산 |
| 유저 정보 | `TeamContext`, `user_settings` | 응원팀, 닉네임, 프로필 |

---

## 구현 계획

### Phase 1: 데이터 레이어

#### 1a. 팀 연승 계산 함수 — `lib/stats.ts` (신규 함수)

```typescript
export function computeTeamStreak(games: ScoreEntry[], teamId: string): { type: "W" | "L" | "D" | null; count: number; display: string }
```

- 입력: `cachedAllDailyScores(year)` 결과를 필터링하여 특정 팀 경기만 추출
- 날짜 내림차순 정렬, 시즌 단위 (시즌 넘어가면 초기화)
- 포스트시즌 포함, 시범경기 제외
- **※ ScoreEntry에 game_type 필드 없음** → 시범경기 날짜를 `EXHIBITION_SCORES`(별도 데이터소스)에서 추출하여 필터링. `cachedAllDailyScores()`가 머지한 결과에서 시범경기 날짜의 경기를 제외한 뒤 streak 계산.
- 결과: `{ type: "W", count: 5, display: "5연승" }` / `{ type: "W", count: 1, display: "연패탈출" }` 등
- **※ 엣지 케이스**: 무승부는 streak 유지 (끊지도 늘리지도 않음)

#### 1b. 해시태그 규칙 엔진 — `lib/sticker.ts` (신규)

```typescript
export interface HashtagResult {
  teamTag: string | null;   // 자동: 팀 streak 기반
  myTag: string | null;     // 자동: 내 직관 streak 기반
}

export function resolveHashtags(
  teamStreak: { type: string; count: number },
  myStreak: { type: string; count: number },
  isFirstWin: boolean,
  isHome: boolean | null,
  gameResult: "win" | "lose" | "draw"
): HashtagResult
```

| gameResult | 우선순위 | 조건 | 태그 |
|---|---|---|---|
| **win** | 1 | 2연패+ → 1승 | `#연패탈출` |
| | 2 | 2연승+ | `#N연승` |
| | 3 | 무승부 | `#무승부` |
| | - | 그 외 | 생략 |
| **my** | 1 | 해당팀 직관 첫 승 | `#직관첫승` |
| | 2 | 2연패+ → 1승 | `#직관연패탈출` |
| | 3 | 2연승+ | `#직관N연승` |
| | 4 | 1승 (홈) | `#홈승리` |
| | 5 | 1승 (원정) | `#원정승리` |
| | 6 | 첫 직관 경기 | `#첫직관` |
| | - | 그 외 | 생략 |
| **lose** | - | 자동 태그 전부 숨김 | 사용자 직접 입력만 |
| **draw** | 1 | 무승부 | `#무승부` |

#### 1c. 홈/원정 판별 — `lib/sticker.ts`

- `game_id` → `parseGameTeamIds()` → `cheered_team`이 `homeId`와 일치하면 홈
- `stadium` 필드로 보조 확인 (미기입 시 null)
- null이면 `#홈승리`/`#원정승리` 대신 `#첫승리`

#### 1d. barrel exports (`lib/db/index.ts`)

```typescript
export { computeTeamStreak, resolveHashtags } from "./sticker"; // or lib/stats.ts
```

### Phase 2: UI 컴포넌트

#### 2a. StickerModal — `components/StickerModal.tsx`

Props: `visible: boolean`, `game: GameDetail | ScoreEntry`, `onClose: () => void`

**내부 상태:**
- `background`: "transparent" | "masking" | "receipt" (기본: transparent)
- `stroke`: boolean (기본: true)
- `showBadge`: boolean (기본: true, 승률/해시태그 표시)
- `hashtags`: string[] (사용자가 수정한 해시태그 배열, 3개 고정)
- `textColor`: string (기본: #000)
- `capturing`: boolean (복사 중)
- `viewRef`: ViewShot ref

**레이아웃 (bottom sheet, maxHeight 85%):**

1. 헤더: "스티커 만들기" + 닫기 버튼
2. 게임 선택기 (현 경기 자동 선택, 같은 날 다른 경기 선택 가능)
3. **스티커 미리보기 영역** (회색 배경 위에 렌더링)
   - 실제 캡처 대상 = ViewShot ref
   - 투명 배경 시 글자만 떠 있음
   - 300px width 고정
   
   스티커 구성 (위→아래):
   ```
   ┌─────────────────────────────┐
   │ 2026.05.28(목)  @fullcount.kr│  ← 날짜 + 워터마크
   │                             │
   │    KT    3 : 7    두산      │  ← 팀명(팀컬러) + 점수(승=검정/패=회색)
   │    5위          3위         │
   │                             │
   │   1  2  3  4  5  6  7  8  9 R│  ← 이닝 스코어보드
   │ KT 0  0  1  0  0  2  0  0  0 3│
   │ 두산 2 0  0  3  1  1  0  0   7│  ← X 대신 빈칸
   │                             │
   │ [🏆 직관 승률 67% (6승 3패)  ]│  ← badge-toggle ON 시
   │ [  #5연승 #직관3연승 #태그입력]│  ← 클릭하여 직접 수정
   └─────────────────────────────┘
   ```

4. **컨트롤 영역:**
   - 배경 선택: 투명 / 마스킹 테이프 / 찢어진 영수증 (chip 버튼)
   - 외곽선 토글 (투명 배경 시인성 보장)
   - 승률·해시태그 표시 토글
   - 경기 결과: 승리 / 패배 (데모용, 실제는 game.result로 고정)
   - "스티커의 해시태그를 클릭하여 직접 수정하세요" (안내문)
   - [📋 인스타 스티커 복사] 버튼 (primary, full width)

#### 2b. StickerContentView — `components/StickerContent.tsx`

ViewShot으로 캡처할 실제 스티커 컨텐츠. StickerModal 내부에서 렌더링.

Props:
```typescript
interface StickerContentProps {
  game: ScoreEntry;           // 경기 데이터 (팀, 점수, 이닝별 점수)
  teamStreak: StreakResult;   // 팀 연승 정보
  myStreak: StreakResult;     // 나의 직관 연승 정보
  stats: { winRate: number; wins: number; losses: number; draws: number };
  hashtags: [string, string, string];  // [팀태그, 내태그, 사용자태그]
  background: "transparent" | "masking" | "receipt";
  stroke: boolean;
  showBadge: boolean;
  textColor: string;
}
```

**Android ViewShot 방어**:
```
collapsable={false}
opacity: 0.01
zIndex: -1
```
(pointerEvents="none"는 ViewShot hit test 차단으로 사용 금지)

> **참고**: React Native에서 `::before` pseudo-element 사용 불가 → overlay View로 대체.
> CSS `boxShadow` → RN: `shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius` (iOS) + `elevation` (Android).
> CSS `background` → RN: `backgroundColor`.
> 이 ViewShot 방식은 프로젝트 내 첫 사용이므로 Android 실기기 QA 필수.
>
> **ViewShot 해상도**: 모달 내 300px 미리보기를 그대로 캡처하면 고해상도 화면에서 글씨가 깨질 수 있음.
> ViewShot `width` 옵션으로 600px로 캡처하면 선명도 확보 가능. 미리보기는 `scale(0.5)`로 축소하여 표시.
>
> **무승부 + 연승 공존**: 무승부 경기여도 내 직관 연승이 유지 중이면 `#무승부`와 `#직관N연승`을 함께 표시.
>
> **인스타 전용 fallback (Phase 2)**: expo-sharing은 인스타 피드/DM으로 유도될 수 있음.
> 추후 Meta 공식 SDK(딥링크)로 인스타 스토리 전용 공유를 고려.

#### 2c. 경기 상세 진입점 — `app/game/[id].tsx` (수정, ~10줄)

- 경기 종료 상태일 때만 버튼 표시
- `[스티커 만들기]` 버튼: `showStickerModal` state toggle

#### 2d. 폰트

- Noto Sans KR (기본 시스템 폰트로 fallback)

### Phase 3: 복사/공유

#### 3a. ViewShot 캡처 + 클립보드

```typescript
import ViewShot from "react-native-view-shot";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";

async function handleCopy(viewRef: ViewShot) {
  let base64 = "";
  setCapturing(true);
  try {
    base64 = await viewRef.capture({ format: "png", result: "base64" });
  } catch (e) {
    Alert.alert("오류", "스티커 생성에 실패했습니다.");
    setCapturing(false);
    return;
  }
  try {
    await Clipboard.setImageAsync(`data:image/png;base64,${base64}`);
    Alert.alert("완료", "클립보드에 복사되었습니다.");
  } catch (e) {
    console.warn("Clipboard.setImageAsync failed", e);
    // fallback: 공유 시트
    try {
      const uri = await viewRef.capture({ format: "png", result: "tmpfile" });
      await Sharing.shareAsync(uri, { mimeType: "image/png" });
    } catch (e2) {
      Alert.alert("오류", "스티커 공유에 실패했습니다.");
    }
  } finally {
    setCapturing(false);
  }
}
```

**변경사항**: `result: "tmpfile"` → `result: "base64"` (expo-clipboard `setImageAsync()`는 `data:image/png;base64,...` 포맷과의 호환성이 더 안정적)<br>
**uri 스코핑 수정**: `let base64`를 try 블록 밖에서 선언, 캡처 실패 시 early return

> **참고**: `expo-clipboard`는 현재 미설치 상태 — `npx expo install expo-clipboard` 필요.

#### 3b. 복사 중 상태

- 버튼 비활성화 + 텍스트 "생성 중..."
- 스티커 영역에 반투명 로딩 오버레이 (선택사항)

---

## 배경 스타일 (CSS-in-JS)

```typescript
const STICKER_BG = {
  transparent: {},  // no bg
  masking: {        // 마스킹 테이프
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 8,                                  // Android shadow
    shadowColor: "#000", shadowOpacity: 0.15,      // iOS shadow
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 20,
  },
  receipt: {        // 찢어진 영수증
    backgroundColor: "#fffbf0",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#000", shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 20,
  },
};
```

※ React Native에서 `::before` 사용 불가 → ViewShot 내부에 동일 효과를 내는 overlay View로 대체

---

## 해시태그 편집 UX

- 자동 생성된 해시태그는 음영/기본값 표시
- 사용자가 태그를 탭하면 `TextInput`으로 전환 (inline edit)
- `#` 기호는 고정 (수정 불가), 텍스트 부분만 편집 가능
- 3개 고정 슬롯: [팀태그] [내태그] [사용자태그]
- 사용자태그 플레이스홀더: "태그입력" (회색)
- 모달 닫으면 초기화 (저장하지 않음)

실제 구현:
```tsx
// 각 태그 슬롯 구조
<View style={{ flexDirection: "row", alignItems: "center" }}>
  <Text style={styles.hashSign}>#</Text>
  {editing ? (
    <TextInput ... />
  ) : (
    <Pressable onPress={() => setEditing(index)}>
      <Text style={...}>{text || placeholder}</Text>
    </Pressable>
  )}
</View>
```

---

## 주요 파일

| 파일 | 작업 | 예상 라인 |
|------|------|----------|
| `lib/stats.ts` | **수정** — `computeTeamStreak()` 추가 | +60L |
| `lib/sticker.ts` | **신규** — `resolveHashtags()` + type | +80L |
| `components/StickerModal.tsx` | **신규** | ~350L |
| `components/StickerContent.tsx` | **신규** | ~200L |
| `app/game/[id].tsx` | **수정** — 버튼 + 모달 진입 | +15L |
| `lib/db/index.ts` | **수정** — barrel export | +2L |

총 신규 ~690L, 수정 ~77L (+ 폰트 설정)

---

## 고려할 엣지 케이스 (검증 필요)

- [ ] 무승부 경기: streak 유지, 자동 태그 `#무승부`
- [ ] 첫 직관 경기: `#첫직관`, 승률 0%면 숫자 생략
- [ ] 시즌 넘어가는 streak: 시즌 단위 초기화 확인
- [ ] 포스트시즌 포함, 시범경기 제외
- [ ] 더블헤더 당일 2경기 모두 직관: 게임 선택기 필요
- [ ] 홈/원정 판별 불가 (stadium 미기입): `#첫승리` fallback
- [ ] ViewShot이 잡히지 않는 안드로이드 기종
- [ ] expo-clipboard 미지원 기기: expo-sharing fallback
- [ ] 해시태그 길이 제한: 한글 기준 15자 제한 (3줄 방지)

---

## 질문

1. `computeTeamStreak()`는 `cachedAllDailyScores(year)`를 호출하는데, 현재 연도(2026)의 API 캐시 갱신 주기(5분 TTL)와 무관하게 실시간 streak을 보장할 수 있는가?
2. ViewShot의 opacity 0.01 + zIndex -1 방식이 모든 안드로이드 기종에서 동작하는가? (기존 diary photo stamp 패턴과 동일)
3. 3가지 배경 스타일의 `::before`를 React Native에서 overlay View로 대체할 때, ViewShot이 overlay를 정상 캡처하는가?
