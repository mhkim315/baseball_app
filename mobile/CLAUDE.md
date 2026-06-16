@AGENTS.md

# Build rule
- EAS build (`eas build`)은 반드시 **사용자의 명시적 승인** 후에만 실행할 것. "좋아", "해", "GO" 등의 승인 없이 절대 실행 금지.
- 빌드 전에 다음을 사용자에게 알릴 것: "EAS Build는 유료 서비스이므로 실행 전 승인 필요" (비용 발생 가능 안내)
- iOS와 Android는 동일한 `app.json`의 `version`을 사용함.
- 빌드 시 `mobile/app.json`의 `version`과 `versionCode`(Android 전용)를 1씩 증가시킨 후 빌드할 것.
- 앱 내 버전 표시(`my.tsx` 설정 화면 하단)는 `Constants.expoConfig.version`을 읽으므로, `app.json`의 `version`만 수정하면 자동 반영됨.

# Test APK (풀카운트_test)
- 테스트 앱은 프로덕션과 **완전히 분리된 package name** 사용: `kr.fullcount.app.test`
- 기존 Play Store 앱과 **사이드바이사이드 설치 가능**
- **배포 프로필**: `eas build -p android --profile test-apk` (APK, internal distribution)
- `android/` 디렉토리는 `.gitignore`되어 있으므로 prebuild 시 자동 적용됨
- **google-services.json**: 두 패키지(`kr.fullcount.app` + `kr.fullcount.app.test`)를 모두 포함. 프로덕션/테스트 공용.

### 프로덕션 복귀 방법
테스트 완료 후 Play Store 제출 시 `app.json` 3개 필드를 원래 값으로 되돌릴 것:
  1. `expo.name` → `"풀카운트"`
  2. `expo.android.package` → `"kr.fullcount.app"`
  3. `expo.ios.bundleIdentifier` → `"kr.fullcount.app"`
- `expo.slug`는 `"fullcount-kr"` 고정 (EAS projectId와 연결, 변경 불가)
- 되돌린 후 `npx expo prebuild -p android --clean` 실행
- `google-services.json`은 변경 불필요 (두 패키지 모두 포함)

# OTA update (eas update)
- **JS/TS 코드만 변경한 경우** (UI, 로직, API 호출 등) EAS Build 대신 `eas update` 사용.
- 새 네이티브 패키지 추가, `app.json` 변경, 플러그인 변경 시에만 EAS Build 필요.
- 배포 명령어: `cd mobile && eas update --branch production --message "설명"`
- 스토어 심사 불필요, 사용자 앱 재실행 시 자동 적용.

# Server
- 서버 설정 상세: `mobile/server-setup.md` 참고

# Daily backup
- 대화 시작 시 사용자에게 백업 실행 여부를 먼저 물어본 후 진행.
- 백업 대상: 서버 데이터(`/home/opc/fullcount_backend/repo/data/`) 로컬 복사
- 백업 경로: `C:\Users\user\Documents\baseball_app\server-backup\YYYY-MM-DD\`
- 제외: `collector.log`, `api.log`, `server.log` 등 로그 파일
- 하루 1회만 실행 (중복 방지).
