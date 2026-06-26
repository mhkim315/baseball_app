# Server + Client Changes Review — 2026-06-26

리뷰만 해주세요. 직접 수정하지 마세요.

## Summary

Live game push notification overhaul: team name display fix, event-based formatting, score play-by-play descriptions.

## Files Changed (4 files, +110 / -35 lines)

| File | Changes |
|------|---------|
| `scripts/naver_adapter.py` | +9 lines — extract textRelays from relay response |
| `server/scripts/push_worker.py` | +52 / -23 lines — event type, new payload fields, score parsing |
| `mobile/lib/notification.ts` | +15 / -19 lines — event-based formatting, team name mapping |
| `mobile/app/(tabs)/my.tsx` | +27 lines — lock screen notification toggle UI |

## Detailed Changes

### 1. `scripts/naver_adapter.py` — textRelays extraction

`normalize_relay()` now extracts the last 15 `textRelays` entries from Naver API's relay response. Each entry is a plain text string like `"류지혁 : 중견수 오른쪽 3루타"` or `"1루주자 김상준 : 홈인"`. Stored under new `"textRelays"` key in returned relay dict. Backward compatible — old consumers ignore new key.

### 2. `server/scripts/push_worker.py` — Event types + rich payload

**`_has_changed()`**: Return type changed `bool` → `str | None`. Returns `"score"`, `"inning"`, `"status"`, or `None`. First detection returns `None` (no push on startup — previous behavior pushed on every first detection).

**`_parse_score_event()`**: New helper. Parses textRelays to extract batter + hit type and scoring runners. Handles edge cases:
- Normal hit+score: `"류지혁 : 중견수 오른쪽 3루타"` + `"김상준 : 홈인"` → `"류지혁 중견수 오른쪽 3루타 → 김상준 홈인"`
- Multiple runners: uses `·` separator
- Score without hit (wild pitch, steal): runners only, no hitter
- Pitch entries ("1구 볼"): no " : " separator → naturally skipped

**`_build_payload(game, event="")`**: New fields added (legacy fields unchanged):
- `event` — "score" / "inning" / "status" / ""
- `home_name`, `away_name` — Korean team names
- `current_pitcher`, `current_batter` — from relay
- `score_desc` — parsed play description (only when event="score")

Legacy `home_team`/`away_team` (short codes) remain — widget FCM path depends on them.

**Dispatch loop**: `changed` now stores `(game, event)` tuples. Weather refresh (scheduled games) calls `_build_payload(game)` without event — uses default `""`.

### 3. `mobile/lib/notification.ts` — Event-based formatting + team name fix

**Team name**: 3-tier fallback: `data.home_name` → `SHORT_CODE_TO_NAME[data.home_team]` → `data.home_team`

**Format by event type**:

Score (`event === "score"`):
```
⚾ 득점! 삼성 5 : 3 LG
류지혁 중견수 오른쪽 3루타 → 김상준·최형우 홈인
```

Inning / fallback:
```
⚾ 7회초 시작 | 삼성 3 : 5 LG
투수 원태인 | 타자 구자욱
```

**Removed**: BSO dot display (🟢🟡🔴) and base runner enumeration — replaced with pitcher/batter info.

### 4. `mobile/app/(tabs)/my.tsx` — Lock screen notification toggle

Toggle "실시간 점수 알림" in "설정" section (below dark mode). Default OFF. AsyncStorage key: `lock_screen_notification_enabled`. Description: "득점, 이닝 변경시".

## Backward Compatibility

| Scenario | Widget FCM | Notification |
|----------|:---:|:---:|
| Old client + New server | No change (ignores new fields) | Old format |
| New client + Old server | No change | Korean via fallback, inning format |
| New client + New server | No change | Full rich format |

## Deployment Status

- Server: Deployed + fullcount-api.service restarted
- Android OTA: Update group `f132ae51`, `production` branch, runtime 1.3.5
- iOS: Not deployed
