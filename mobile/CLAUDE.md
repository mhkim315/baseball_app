@AGENTS.md

# Build rule
- EAS build (`eas build`)은 사용자가 명시적으로 요청할 때만 실행할 것. 절대 자동으로 빌드하지 않음.
- **빌드 전에 반드시 버전을 올릴 것.** 사용자에게 "버전 올리고 빌드할까요?"라고 먼저 확인.
- **빌드 전에 반드시 빌드 실행 의사를 확인할 것.** "진행할까요?"라고 묻고 승인 후 실행.
- iOS와 Android는 동일한 `mobile/app.json`의 `version`을 사용함.
- 버전 업데이트 시 다음 4곳을 모두 동기화할 것:
  1. `mobile/app.json` → `version` (예: 1.2.3), `buildNumber` (iOS), `versionCode` (Android)
  2. `mobile/app.json` → `runtimeVersion` (policy 대신 하드코딩된 문자열)
  3. `mobile/android/app/build.gradle` → `versionCode`, `versionName`
  4. `mobile/android/app/src/main/res/values/strings.xml` → `expo_runtime_version`
- 앱 내 버전 표시(`my.tsx` 설정 화면 하단)는 `Constants.expoConfig.version`을 읽으므로, `app.json`의 `version`만 수정하면 자동 반영됨.

# OTA update (eas update)
- **JS/TS 코드만 변경한 경우** (UI, 로직, API 호출 등) EAS Build 대신 OTA 사용.
- 새 네이티브 패키지 추가, `app.json` 플러그인 변경, Kotlin/Java 수정 시에만 EAS Build 필요.
- **프로덕션 배포 명령어**:
  ```bash
  cd mobile
  eas update --branch production --message "변경 내용 요약"
  ```
- 스토어 심사 불필요. 사용자 앱 재실행 시 자동 적용 (runtimeVersion 일치 필요).
- test 채널 배포 시 `--branch test` 사용.

# Server
- 서버 설정 상세: `mobile/server-setup.md` 참고

# Daily backup
- 대화 시작 시 사용자에게 백업 실행 여부를 먼저 물어본 후 진행.
- 백업 대상: 서버 데이터(`/home/opc/fullcount_backend/repo/data/`) 로컬 복사
- 백업 경로: `C:\Users\user\Documents\baseball_app\server-backup\YYYY-MM-DD\`
- 제외: `collector.log`, `api.log`, `server.log` 등 로그 파일
- 하루 1회만 실행 (중복 방지).
