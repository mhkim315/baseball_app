@AGENTS.md

# Build rule
- EAS build (`eas build`)은 사용자가 명시적으로 요청할 때만 실행할 것. 절대 자동으로 빌드하지 않음.
- AAB 빌드 시에는 `mobile/app.json`의 `version`과 `versionCode`를 자동으로 1씩 증가시킨 후 빌드할 것.
- 앱 내 버전 표시(`my.tsx` 설정 화면 하단)는 `Constants.expoConfig.version`을 읽으므로, `app.json`의 `version`만 수정하면 자동 반영됨.

# Server
- 서버 설정 상세: `mobile/server-setup.md` 참고

# Daily backup
- 대화 시작 시 사용자에게 백업 실행 여부를 먼저 물어본 후 진행.
- 백업 대상: 서버 데이터(`/home/opc/fullcount_backend/repo/data/`) 로컬 복사
- 백업 경로: `C:\Users\user\Documents\baseball_app\server-backup\YYYY-MM-DD\`
- 제외: `collector.log`, `api.log`, `server.log` 등 로그 파일
- 하루 1회만 실행 (중복 방지).
