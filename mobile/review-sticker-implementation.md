# Code Review: 스티커(Sticker) 시스템 구현 검증

> **구현 현황**: Phase 1~3 완료 (데이터 레이어 + UI + 클립보드 복사)
> **커밋**: 보려면 `git log --oneline -5` (master: 2개 커밋)
>
> - `f594436` — Phase 1: 팀 연승 계산 + 해시태그 규칙 엔진
> - `3f1ab4e` — Phase 2: StickerContent + StickerModal + game/[id] 진입

## 배경

모바일 앱(fullcount.kr)의 경기 상세 화면에서 사용자가 직관한 경기 결과를 인스타그램 스토리에 공유할 수 있는 동적 PNG 스티커 생성 기능.
사용자가 경기장에서 찍은 사진 없이도 앱 데이터(점수, 직관 통계, 연승)로 즉석 스티커를 만들어 클립보드에 복사해준다.

## 데이터 흐름

```
game/[id].tsx [스티커 만들기] 버튼 (isFinished && gs)
  → StickerModal (BottomSheet)
    → getTeamDiaryStats(homeTeam)     ← jikgwan_records
    → computeTeamStreak(year, teamId) ← cachedAllDailyScores (시범경기 제외)
    → getJikgwanRecords() → computeStreakStats() → 내 연승
    → resolveHashtags(teamStreak, myStreak, gameResult, context)
    → StickerContent 렌더링 (ViewShot ref)
    → captureRef() → Clipboard.setImageAsync() → Sharing.shareAsync() fallback
```

## 구현 파일 상세

### 1. `lib/sticker.ts` (~160L) — 데이터 레이어

**`computeTeamStreak(year, teamId)`** — 비동기, 팀 연승 계산
- `cachedAllDailyScores(year)` → 특정 팀 경기만 필터링 (TEAM_NAME_TO_ID)
- 시범경기 제외: `EXHIBITION_SCORES[date]` + `LOCAL_SCHEDULE[date].isExhibition`
- 무승부 제외 (streak 중단 X, 연장 X)
- 취소 경기 제외
- 최신 경기부터 역순 탐색, streak 끊기면 즉시 break
- 반환: `{ type, count, prevType, prevCount }` (prev는 연패탈출 감지용)

**`resolveHashtags(teamStreak, myStreak, gameResult, context)`** — 동기, 해시태그 규칙 엔진

우선순위:
| 구분 | 조건 | 태그 |
|------|------|------|
| lose | 모든 자동 태그 숨김 | 사용자 입력만 |
| draw | `#무승부` (myTag는 연승 시 유지) |
| team | 2연패+ → 1승 | `#연패탈출` |
| team | 2연승+ | `#N연승` |
| my | 첫직관 | `#첫직관` |
| my | 해당팀 첫 승 | `#직관첫승` |
| my | 2연승+ | `#직관N연승` |
| my | 1승 (홈) | `#홈승리` |
| my | 1승 (원정) | `#원정승리` |

### 2. `components/StickerContent.tsx` (~270L) — 스티커 뷰

Props:
```
awayTeam/homeTeam, awayTeamColor/homeTeamColor, awayScore/homeScore,
awayRank/homeRank, date, scoreBoard?, rheb?, gameResult,
background, stroke, showBadge, teamTag, myTag, customTag, stats
```

렌더링 구조:
```
View (300px, collapsable=false)
  ├── [background=masking] MaskingOverlay (사선 패턴)
  ├── [background=receipt] ReceiptOverlay (점선 테두리)
  ├── Header: 날짜 + @fullcount.kr
  ├── Scoreboard: 팀명(팀컬러) 점수(승=#111 / 패=#999) 순위
  ├── Innings Table: 1-9 R H E (X 없이 빈칸)
  └── [showBadge] Stats Badge: 승률 + 해시태그 3개
```

특이사항:
- stroke: textShadow 기반 (흰색 외곽선), scores/teamNames는 thick(radius 2)
- `::before` pseudo-element 불가 → overlay View로 대체
- Android ViewShot 방어: `collapsable={false}`

### 3. `components/StickerModal.tsx` (~380L) — 스티커 에디터

BottomSheet 내부:
```
[헤더] "스티커 만들기" + 닫기 버튼
[미리보기] 회색 배경 위 ViewShot ref로 감싼 StickerContent
[컨트롤]
  ├── 배경: 투명 / 마스킹 테이프 / 찢어진 영수증 (chip 버튼)
  ├── 외곽선: ON/OFF 토글
  ├── 승률·해시태그: ON/OFF 토글
  ├── 해시태그 입력: 3개 TextInput (#팀태그, #내태그, #사용자태그), 각 15자 제한
  └── [📋 인스타 스티커 복사] 버튼 (primary, full width)
```

데이터 로딩 (mount 시):
```
getTeamDiaryStats(homeTeam)  → stats (승률/승/무/패)
computeTeamStreak(year, homeTeam) → teamStreak
getJikgwanRecords() → computeStreakStats() → myStreak
→ resolveHashtags() → teamTag, myTag 자동 설정
```

**handleCopy()**:
```typescript
try {
  const base64 = await captureRef(viewRef, { format: "png", result: "base64" });
  try {
    await Clipboard.setImageAsync(`data:image/png;base64,${base64}`);
    Alert.alert("완료", ...);
  } catch {
    // fallback
    const uri = await captureRef(viewRef, { format: "png", result: "tmpfile" });
    await Sharing.shareAsync(uri, { mimeType: "image/png" });
  }
} catch {
  Alert.alert("오류", "스티커 생성에 실패했습니다.");
}
```

### 4. `app/game/[id].tsx` (+15L) — 진입점

추가된 것:
```tsx
// state
const [showStickerModal, setShowStickerModal] = useState(false);

// callback
const handleOpenSticker = useCallback(() => {
  if (!detail) return;
  setShowStickerModal(true);
}, [detail]);

// button (isFinished && gs일 때만 표시)
{isFinished && gs && (
  <Pressable style={styles.stickerBtn} onPress={handleOpenSticker}>
    <Text style={styles.stickerBtnText}>스티커 만들기</Text>
  </Pressable>
)}

// modal
<StickerModal
  visible={showStickerModal}
  onClose={() => setShowStickerModal(false)}
  awayTeam={detail.awayTeam}
  homeTeam={detail.homeTeam}
  awayScore={gs.away}
  homeScore={gs.home}
  awayRank={previewData ? String(previewData.awayRank) : undefined}
  homeRank={previewData ? String(previewData.homeRank) : undefined}
  date={detail.date}
  scoreBoard={detail.scoreBoard?.inn ? { away: ..., home: ... } : null}
  rheb={detail.scoreBoard?.rheb ?? null}
/>
```

## 검증이 필요한 사항

### 기능 검증
- [ ] computeTeamStreak: 시범경기 정상 제외되는가 (EXHIBITION_SCORES cross-ref)
- [ ] computeTeamStreak: 포스트시즌 포함되는가
- [ ] computeTeamStreak: 시즌 넘어가면 초기화되는가
- [ ] resolveHashtags: 무승부 + 내 연승 동시 표시 (e.g. `#무승부` + `#직관3연승`)
- [ ] resolveHashtags: 첫직관 → #첫직관 (stats.total === 0)
- [ ] resolveHashtags: 직관첫승 → #직관첫승 (wins === 0 & gameResult === win)
- [ ] resolveHashtags: 패배 시 모든 태그 숨김
- [ ] StickerContent: 9회말 미진행 시 빈칸 처리 (X 대신)
- [ ] StickerContent: stroke on/off — textShadow로 인한 글자 번짐 없음
- [ ] StickerModal: background 3종 전환 정상 동작
- [ ] StickerModal: 해시태그 입력 → 스티커 실시간 반영
- [ ] handleCopy: ViewShot 캡처 정상 동작 (captureRef)
- [ ] handleCopy: Clipboard.setImageAsync 정상 동작
- [ ] handleCopy: 실패 시 Sharing.shareAsync fallback

### 엣지 케이스
- [ ] 더블헤더 2차전: scoreBoard.inn 데이터 정상인가
- [ ] 취소 경기: isFinished=false → 버튼 미표시
- [ ] 점수 데이터 없음: gs가 null → 버튼 미표시
- [ ] 직관 기록 0건: stats는 0/0/0, isFirstGame=true, streak count=0
- [ ] ViewShot Android: `collapsable={false}` 방어, opacity/zIndex 미사용 (pointerEvents="none" 미사용)
- [ ] 시즌 시작 전: computeTeamStreak → scores 없음 → null 반환

### 코드 품질
- [ ] 사용하지 않는 코드/import 없음
- [ ] TypeScript `npx tsc --noEmit` 통과
- [ ] StickerContent: `createStroke()` 함수 제거됨 (unused)
- [ ] HandleCopy: base64 변수 스코핑 (try 밖 선언, 실패 시 early return)
- [ ] 컴포넌트 언마운트 시 cancelled 플래그로 상태 업데이트 방지

## 기술 스택
- `react-native-view-shot` ^5.1.0 — `captureRef()`
- `expo-clipboard` ~8.0.8 — `setImageAsync()`
- `expo-sharing` ~14.0.8 — `shareAsync()` fallback
- BottomSheet: 커스텀 컴포넌트 (Animated + PanResponder)
- ViewShot 방어: `collapsable={false}`, `opacity: 1` (opacity 0.01 미사용)

## 질문
1. `captureRef` + `result: "base64"`가 모든 Android 기종에서 안정적인가? (PhotoCropper는 `result` 미지정 = tmpfile 사용)
2. StickerContent의 textShadow 기반 stroke가 저사양 기기에서 렌더링 성능에 영향을 주는가?
3. `Sharing.shareAsync()` fallback은 인스타그램 스토리 공유까지 유도할 수 있는가, 아니면 단순 이미지 저장에 그치는가?
