# Fullcount.kr Mobile App — 개발 작업 문서

> 마지막 업데이트: 2026-05-28 (Phase 14)
> 
> 이 문서는 이전 대화 컨텍스트가 만료되어도 작업을 이어갈 수 있도록 상세히 기록합니다.

---

## 프로젝트 개요

Baseball web app (fullcount.kr)을 React Native + Expo 기반 iOS/Android 앱으로 변환.

- **도메인**: fullcount.kr (Cloudflare DNS)
- **API 서버**: Oracle Cloud VM (168.107.59.177) — FastAPI + PostgreSQL
- **프론트엔드 (기존)**: `client/` — React + Vite + TailwindCSS (현상 유지, 버그 수정만)
- **모바일**: `mobile/` — Expo SDK 54 + React Native 0.81.5 + Expo Router 6
- **공유 코드**: `shared/` — API 클라이언트, 타입, 상수, 팀 컬러

---

## 현재 상태: Phase 1~6 완료, Phase 7 대기 중

| Phase | 상태 | 설명 |
|-------|------|------|
| 1 | ✅ 완료 | Expo 프로젝트 생성, shared 코드 연결, 탭 네비게이션 |
| 2 | ✅ 완료 | 홈 탭 (DateStrip, GameCard, API 연동) |
| 3 | ✅ 완료 | 소셜 로그인 (Kakao/Naver/Google/Apple) |
| 4 | ✅ 완료 | MY 탭 (SQLite, 팀선택, 프로필, 승률) |
| 5 | ✅ 완료 | 직관 카메라 (촬영, 오버레이, 저장) |
| 6 | ✅ 완료 | 커뮤니티 게시판 (FastAPI CRUD, JWT 인증) |
| 7 | ⏳ 대기 | 약관, EAS Build, 앱스토어 심사, 계정 등록 |

---

## 상세 파일 구조

### `mobile/` — Expo React Native 앱

```
mobile/
├── app/                              # Expo Router 파일 기반 라우팅
│   ├── _layout.tsx                   # 루트 레이아웃 (Stack navigator)
│   ├── (tabs)/
│   │   ├── _layout.tsx               # 하단 탭 (홈, 커뮤니티, MY)
│   │   ├── home.tsx                  # 홈 - 경기 일정/카드
│   │   ├── community.tsx             # 커뮤니티 게시판 목록
│   │   └── my.tsx                    # MY - 팀선택/프로필/승률/직관기록
│   ├── game/[id].tsx                 # 경기 상세 화면
│   ├── onboarding.tsx                # 첫 실행 팀 선택
│   ├── login.tsx                     # 소셜 로그인 화면
│   ├── nickname-setup.tsx            # 첫 로그인 닉네임 설정
│   ├── community/
│   │   ├── create.tsx                # 게시글 작성
│   │   └── [id].tsx                  # 게시글 상세 + 댓글
│   └── jikgwan/
│       ├── camera.tsx                # 카메라 촬영
│       └── preview.tsx               # 사진 + 오버레이 합성/저장
├── components/
│   ├── GameCard.tsx                  # 경기 카드 (메인/축소)
│   ├── TeamBadge.tsx                 # 팀 로고 뱃지
│   ├── DateStrip.tsx                 # 주간 날짜 선택 바
│   ├── JikgwanFeed.tsx              # 직관 사진 피드
│   ├── ProfilePicker.tsx            # 프로필 캐릭터 선택
│   └── TeamSelector.tsx             # 응원팀 선택 그리드
├── lib/
│   ├── auth.ts                      # JWT 토큰 관리 + 커뮤니티 API calls
│   ├── db.ts                        # SQLite 온디바이스 DB (설정/직관/승률)
│   ├── camera.ts                    # 카메라 + 파일시스템 유틸리티
│   └── socialConfig.ts              # OAuth 제공자 설정 (API 키)
└── app.json                         # Expo 설정
```

### `server/fullcount_backend/` — FastAPI 백엔드

```
server/fullcount_backend/
├── auth.py                          # 소셜 로그인 + JWT 발급/검증
├── community.py                     # 게시글/댓글 CRUD
├── account.py                       # 회원 탈퇴 + 데이터 내보내기
├── database.py                      # SQLAlchemy async engine
├── models.py                        # CommunityUser, CommunityPost, CommunityComment
└── migration.sql                    # PostgreSQL 스키마 (커뮤니티 테이블)
```

---

## Phase별 상세 작업 내역

### Phase 1: 프로젝트 초기화 + 공유 코드

**작업 내용:**
- Expo SDK 54 + TypeScript 5.9 프로젝트 생성
- Expo Router 6 파일 기반 라우팅 설정 (탭 네비게이션 + Stack)
- `shared/` 디렉토리 import 경로 설정 (`@shared/` paths in tsconfig.json)
- `TEAM_COLORS`를 `shared/teamColors.ts`로 이동, `client/`에서 re-export
- `TeamBadge` 공유 컴포넌트 생성

**핵심 결정:**
- `client/`는 현상 유지, 신규 기능은 모바일 우선 개발
- `shared/`를 통해 타입/상수 재사용

### Phase 2: 홈 탭

**작업 내용:**
- `DateStrip` — 주간 날짜 선택 바 (탭 시 월간 확장)
- `GameCard` — 메인 카드 (점수/라인업/투수) + 축소 카드
- 기존 API 연동: today-games, schedule, daily-scores
- 내 팀 선택 시 해당 팀 경기 최상단 하이라이트
- `gameHasStarted` 시간 체크로 상태 감지
- `PitcherMap` 구성 ("미정" 필터링)
- game-detail fallback (선발투수 누락 시)
- 자정 날짜 경계 체크

**핵심 결정:**
- 팀 선택 전: 전 구단 경기 카드 표시
- 팀 선택 후: 내 팀 경기 하이라이트 + 나머지 축소 카드

### Phase 3: 소셜 로그인

**파일 생성/수정:**
- `lib/socialConfig.ts` — OAuth 제공자별 API 키 설정 (env vars)
- `app/login.tsx` — 4개 소셜 로그인 버튼
  - Kakao: `expo-auth-session` (yellow button)
  - Naver: `expo-auth-session` (green button)
  - Google: placeholder (EAS Build 필요)
  - Apple: `expo-apple-authentication` native (iOS only)
- `app/nickname-setup.tsx` — 첫 로그인 닉네임 설정
- `lib/auth.ts` — `loginWithProvider`, `updateNickname`, `getToken`/`setToken` 등

**백엔드 수정:**
- `LoginRequest`/`RegisterRequest`에 `authorization_code` 필드 추가
- `exchange_kakao_code()` — Kakao auth code → access token 서버 교환
- `exchange_naver_code()` — Naver auth code → access token 서버 교환
- `verify_social()` — 코드/토큰 모두 지원하는 통합 검증 함수
- `PUT /api/auth/nickname` — JWT 기반 닉네임 변경 엔드포인트

**소셜 로그인 플로우:**

```
[Kakao/Naver]
1. 클라이언트 → OAuth 웹뷰 → 사용자 로그인 → authorization code
2. 클라이언트 → POST /api/auth/login { authorization_code } → 백엔드
3. 백엔드 → 제공자 토큰 엔드포인트 → access_token 교환
4. 백엔드 → 제공자 사용자 API → 사용자 정보 확인
5. 백엔드 → 자체 JWT 발급 → 클라이언트

[Apple]
1. 클라이언트 → AppleAuthentication.signInAsync() → identityToken
2. 클라이언트 → POST /api/auth/login { access_token: identityToken } → 백엔드
3. 백엔드 → Apple public key로 JWT 검증 → 사용자 정보 확인
4. 백엔드 → 자체 JWT 발급 → 클라이언트

[신규 사용자]
1. 로그인 → is_new=true → /nickname-setup 으로 리다이렉트
2. 닉네임 입력 → updateNickname() → PUT /api/auth/nickname (JWT 인증)
3. 완료 → dismissAll() → 메인 화면
```

**커뮤니티 로그인 연동:**
- 미로그인 시 게시판에 "로그인하기" 버튼 표시
- 헤더에도 "로그인" 버튼 표시
- 로그인 후 자동으로 커뮤니티 이용 가능

**설치한 패키지:**
```
npx expo install expo-auth-session expo-web-browser expo-apple-authentication
```

### Phase 4: MY 탭

**파일 생성/수정:**
- `lib/db.ts` — SQLite 온디바이스 DB (expo-sqlite `openDatabaseAsync`)
- `components/TeamSelector.tsx` — 10구단 선택 그리드
- `components/ProfilePicker.tsx` — 캐릭터 감정 아이콘 선택
- `components/JikgwanFeed.tsx` — 직관 사진 인스타 피드
- `app/(tabs)/my.tsx` — MY 메인 화면 (팀선택, 프로필, 승률, 직관, 설정)

**SQLite 스키마:**
```sql
CREATE TABLE user_settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL
);
CREATE TABLE jikgwan_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL, date TEXT NOT NULL,
  photo_path TEXT, memo TEXT,
  score_away INTEGER, score_home INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE win_rate_cache (
  team_id TEXT PRIMARY KEY,
  total_games INTEGER, wins INTEGER, draws INTEGER, losses INTEGER,
  updated_at TEXT
);
```

**데이터 저장 전략:**
| 데이터 | 저장소 | 설명 |
|--------|--------|------|
| 개인 직관기록 | SQLite (온디바이스) | 사진 메타데이터, 날짜, 경기정보 |
| 사진 파일 | 기기 로컬 파일시스템 | 앱 외부 공유 시 로고 오버레이 |
| 내 팀/닉네임/프로필 | SQLite + AsyncStorage | 개인화 설정 |
| 승률 계산 | SQLite (온디바이스) | 서버 전송 안 함 |
| 커뮤니티 게시글/댓글 | PostgreSQL (VM) | user_id만 보관 |
| 소셜 로그인 토큰 | expo-secure-store | OAuth 토큰 안전한 저장 |
| API 데이터 | 기존 FastAPI | 경기, 순위, 구장 등 |

### Phase 5: 직관 카메라

**파일 생성:**
- `lib/camera.ts` — SDK 54 새 File API (`File`, `Directory`, `Paths`)
  - `getPhotoDir()`, `ensurePhotoDir()`, `getPhotoUri()`, `getAllPhotos()`, `deletePhoto()`
- `app/jikgwan/camera.tsx` — 전체화면 카메라 (`CameraView`)
  - 권한 플로우 (허용/거부/재요청)
  - 촬영 버튼
- `app/jikgwan/preview.tsx` — 사진 + 오버레이 합성
  - 오버레이: 로고 (우상단), 팀 뱃지+점수 (중앙하단), 구장명+타임스탬프 (하단)
  - `react-native-view-shot`으로 View 캡처 → 단일 JPG 합성
  - `expo-image-manipulator`로 1200px 리사이즈
  - SQLite `jikgwan_records`에 레코드 저장

**오버레이 구성:**
```
┌──────────────────────┐
│              [로고]  │
│                      │
│    [팀1] 3 - 2 [팀2] │
│    LG vs 두산        │
│    잠실 야구장       │
│    2026.05.16 14:30  │
└──────────────────────┘
```

**참고: SDK 54 마이그레이션 이슈**
- `FileSystem.documentDirectory` deprecated → `Paths.document` + `new Directory()` / `new File()`
- `Directory.list()` returns `(Directory | File)[]`, `.extension`은 File에만 존재 → `instanceof File` type guard 필요
- `expo-image-manipulator`의 `manipulateAsync`는 여전히 사용 가능 (SDK 54 호환)
- `ViewShot` ref 타입: `useRef<any>(null)` 사용

### Phase 6: 커뮤니티 게시판

**서버 파일:**
- `server/fullcount_backend/auth.py` — 로그인/회원가입/JWT
- `server/fullcount_backend/community.py` — 게시글/댓글 CRUD
- `server/fullcount_backend/account.py` — 회원 탈퇴 + 데이터 내보내기
- `server/fullcount_backend/migration.sql` — PostgreSQL 스키마

**커뮤니티 API:**
| 메서드 | 엔드포인트 | 인증 | 설명 |
|--------|-----------|------|------|
| GET | /api/community/posts | X | 게시글 목록 (페이지네이션) |
| POST | /api/community/posts | JWT | 게시글 작성 |
| GET | /api/community/posts/{id} | X | 게시글 상세 + 댓글 |
| PUT | /api/community/posts/{id} | JWT | 게시글 수정 (내 글만) |
| DELETE | /api/community/posts/{id} | JWT | 게시글 삭제 (soft delete) |
| POST | /api/community/posts/{id}/comments | JWT | 댓글 작성 |
| DELETE | /api/community/comments/{id} | JWT | 댓글 삭제 (soft delete) |

**회원 탈퇴 API:**
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| DELETE | /api/auth/delete-account | 게시글/댓글 익명화, 계정 soft delete |
| GET | /api/auth/export-data | 내 게시글/댓글 데이터 내보내기 |

**핵심 설계 원칙:**
- 모든 삭제는 soft delete (`deleted_at` timestamp) — 30일 복구 기간
- 회원 탈퇴 시 게시글/댓글은 "탈퇴한 회원" 표시, user_id는 유지
- 재로그인 시 계정 복구 가능 (deleted_at = NULL)

**모바일 community API client (`lib/auth.ts`):**
- `fetchPosts(page, pageSize)` — 게시글 목록
- `fetchPostDetail(postId)` — 상세 + 댓글
- `createPost(title, content)` — 작성 (JWT 필요)
- `updatePost(postId, title, content)` — 수정 (JWT 필요)
- `deletePost(postId)` — 삭제 (JWT 필요)
- `createComment(postId, content)` — 댓글 작성 (JWT 필요)
- `deleteComment(commentId)` — 댓글 삭제 (JWT 필요)
- `deleteAccount()` — 회원 탈퇴
- `exportData()` — 데이터 내보내기

---

## 남은 작업 (Phase 7) — 상세 가이드

### 0. 사전 준비: 계정 및 키 발급

각 제공자 개발자 콘솔에서 키를 발급받고 `.env` 파일에 설정해야 합니다.

#### 0-1. Kakao Developers
1. https://developers.kakao.con 에 접속 → 로그인
2. "내 애플리케이션" → "애플리케이션 추가하기"
3. 앱 이름: "fullcount" (또는 원하는 이름)
4. **요약 정보**에서 `REST API 키` 확인
5. 왼쪽 메뉴 "플랫폼" → iOS/Android 설정:
   - iOS: 번들 ID `kr.fullcount.app` 입력
   - Android: 패키지명 + 키해시 (EAS Build 후 확인 가능)
6. 왼쪽 메뉴 "카카오 로그인" → **활성화**
7. Redirect URI 등록:
   - `kr.fullcount.app://auth` (모바일 OAuth)
   - 필요 시 웹: `https://api.fullcount.kr/api/auth/kakao/callback`
8. `KAKAO_REST_API_KEY` → `.env` 파일에 저장 (server + mobile)
   - 서버: `KAKAO_REST_API_KEY=xxxxx`
   - 모바일: `EXPO_PUBLIC_KAKAO_REST_API_KEY=xxxxx`

#### 0-2. Naver Developers
1. https://developers.naver.com 에 접속 → 로그인
2. "Application" → "애플리케이션 등록"
3. 사용 API: "네이버 로그인"
4. 로그인 Callback URL: `kr.fullcount.app://auth` 등록
5. Client ID + Client Secret 확인
6. `.env` 설정:
   - 서버: `NAVER_CLIENT_ID=xxxxx`, `NAVER_CLIENT_SECRET=xxxxx`
   - 모바일: `EXPO_PUBLIC_NAVER_CLIENT_ID=xxxxx`, `EXPO_PUBLIC_NAVER_CLIENT_SECRET=xxxxx`

#### 0-3. Google Cloud Console
1. https://console.cloud.google.com → 프로젝트 생성
2. "API 및 서비스" → "OAuth 동의 화면" 설정 (External)
3. "사용자 인증 정보" → "OAuth 클라이언트 ID 생성"
4. **iOS 클라이언트**: 번들 ID `kr.fullcount.app`
5. **Android 클라이언트**: 패키지명 + SHA-1 (EAS Build 후)
6. **웹 클라이언트**: 승인된 리디렉션 URI
7. `.env` 설정:
   - 서버: `GOOGLE_CLIENT_ID=xxxxx` (웹 클라이언트 ID)
   - 모바일: `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=xxxxx`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=xxxxx`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxxxx`

#### 0-4. Apple Developer
1. https://developer.apple.com → Apple Developer Program 가입 ($99/년)
2. Certificates, Identifiers & Profiles → Identifiers → App ID
3. Bundle ID: `kr.fullcount.app` → Sign In with Apple **활성화**
4. Keys → 새 키 → Sign In with Apple → 설정
5. Service ID 생성 → Redirect URI 등록
6. `.env` 모바일: Apple은 expo-apple-authentication이 번들 ID 기반으로 자동 처리

### 1. VM 배포

```bash
# SSH 접속
ssh opc@168.107.59.177

# 백엔드 파일 복사 (로컬에서)
scp server/fullcount_backend/auth.py opc@168.107.59.177:/home/opc/fullcount_backend/
scp server/fullcount_backend/community.py opc@168.107.59.177:/home/opc/fullcount_backend/
scp server/fullcount_backend/account.py opc@168.107.59.177:/home/opc/fullcount_backend/

# .env에 새 환경변수 추가 (MOBILE_REDIRECT_URI)
# kr.fullcount.app://auth

# DB 마이그레이션
sudo -u postgres psql -d fullcount -f /home/opc/fullcount_backend/migration.sql

# 서비스 재시작
sudo systemctl restart fullcount-backend
# 또는 uvicorn 직접 재시작
# ps aux | grep uvicorn
# kill <PID>
# cd /home/opc/fullcount_backend && nohup uvicorn main:app --host 0.0.0.0 --port 8000 &
```

**필수 환경변수 (서버 `.env`에 추가 필요):**
```
KAKAO_REST_API_KEY=xxxxx
NAVER_CLIENT_ID=xxxxx
NAVER_CLIENT_SECRET=xxxxx
GOOGLE_CLIENT_ID=xxxxx
MOBILE_REDIRECT_URI=kr.fullcount.app://auth
JWT_SECRET=<랜덤 문자열 생성>
```

**DB 마이그레이션 SQL (`migration.sql` — 서버에 복사 필요):**
```sql
CREATE TABLE IF NOT EXISTS community_users (
  user_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  nickname TEXT NOT NULL,
  profile_type TEXT DEFAULT 'character',
  profile_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP DEFAULT NULL
);
CREATE TABLE IF NOT EXISTS community_posts (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES community_users(user_id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP DEFAULT NULL
);
CREATE TABLE IF NOT EXISTS community_comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES community_users(user_id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_created ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON community_comments(post_id);
```

### 2. 약관 페이지

**서버에 `/api/terms` 및 `/api/privacy` 엔드포인트 추가:**

이용약관과 개인정보처리방침은 HTML 파일로 서빙 (또는 `main.py`에 정적 라우트 추가).

```python
# main.py 에 추가
from fastapi.responses import HTMLResponse

@app.get("/api/terms", response_class=HTMLResponse)
async def terms():
    with open("terms.html") as f:
        return f.read()

@app.get("/api/privacy", response_class=HTMLResponse)
async def privacy():
    with open("privacy.html") as f:
        return f.read()
```

**약관 문서 준비 필요 항목:**
- 수집하는 개인정보 항목 (소셜 로그인 ID, 닉네임)
- 개인정보 수집 목적 (커뮤니티 기능, 사용자 식별)
- 개인정보 보관 기간 (회원 탈퇴 시 30일 후 파기)
- 개인정보 제3자 제공 여부 (제공하지 않음)
- 사용자 권리 (열람, 수정, 삭제, 이의제기)
- https://privacy.fullcount.kr (또는 API 엔드포인트)

**모바일 앱 내 약관 링크:**
- MY 탭 설정 섹션에 "이용약관", "개인정보처리방침" 버튼 추가
- WebView 또는 Linking.openURL로 표시

### 3. EAS Build 설정

#### 3-1. Expo 계정 생성
```bash
npx expo register  # 웹 브라우저 열림
# 또는
npx expo login
```

#### 3-2. EAS CLI 설치
```bash
npm install -g eas-cli
eas login
```

#### 3-3. EAS Build 설정 (eas.json)
```json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development"
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "ios": {
        "simulator": true
      }
    },
    "production": {
      "channel": "production"
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@email.com",
        "ascAppId": "APPLE_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "track": "internal",
        "releaseStatus": "completed"
      }
    }
  }
}
```

#### 3-4. EAS Build 실행
```bash
# 개발 빌드 (로컬 테스트용)
eas build --platform ios --profile development
eas build --platform android --profile development

# 프로덕션 빌드
eas build --platform ios --profile production
eas build --platform android --profile production
```

### 4. 앱 아이콘 / 스플래시

**`app.json` 설정:**
```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#111111"
    },
    "ios": {
      "icon": "./assets/icon.png",
      "splash": {
        "image": "./assets/splash.png",
        "resizeMode": "contain",
        "backgroundColor": "#111111"
      }
    },
    "android": {
      "icon": "./assets/icon.png",
      "splash": {
        "image": "./assets/splash.png",
        "resizeMode": "contain",
        "backgroundColor": "#111111"
      }
    }
  }
}
```

- `icon.png`: 1024x1024 (iOS) / 512x512 (Android)
- `splash.png`: 1284x2778 (iOS) / 1242x2436 (Android)

### 5. 개인정보처리방침 / 이용약관 (앱스토어 심사 필수)

**Apple App Store 필수 요건:**
1. **Apple Sign In 필수**: 다른 소셜 로그인 제공 시 Apple Sign In도 반드시 제공
2. **회원 탈퇴 기능**: 계정 삭제 기능 필수 (`DELETE /api/auth/delete-account`)
3. **개인정보처리방침**: 앱 내 WebView 또는 Safari로 열람 가능해야 함
4. **이용약관**: 회원가입 시 동의 절차 필요
5. **ATT (App Tracking Transparency)**: 타사 추적 시 팝업 필요 (해당 없으면 불필요)

**Google Play Store 필수 요건:**
1. **개인정보처리방침**: 스토어 등록 + 앱 내 링크
2. **데이터 삭제**: 앱 내 계정 삭제 요청 가능해야 함
3. **Data safety section**: 수집 데이터 유형과 목적 명시

**대한민국 개인정보보호법:**
- 만 14세 미만 가입 제한 → 커뮤니티 이용약관에 명시
- 개인정보 처리방침에 수집 항목, 목적, 보관 기간, 파기 방법 명시
- 회원 탈퇴 시 개인정보 파기 (30일 유예 후 완전 삭제)

### 6. Google Sign In (네이티브 모듈)

`app/login.tsx`에 Google 로그인 placeholder가 있습니다. EAS 개발 빌드 후 구현:

```bash
npx expo install @react-native-google-signin/google-signin
```

구현 참고:
```typescript
// app/login.tsx — handleGoogleLogin
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";

GoogleSignin.configure({
  iosClientId: SOCIAL_CONFIG.google.iosClientId,
  androidClientId: SOCIAL_CONFIG.google.androidClientId,
  webClientId: SOCIAL_CONFIG.google.webClientId,
});

await GoogleSignin.hasPlayServices();
const { accessToken } = await GoogleSignin.signIn();
const user = await loginWithProvider("google", accessToken);
```

### 7. Apple Sign In 문제 해결

Apple Sign In은 `expo-apple-authentication`을 사용합니다.
- iOS 시뮬레이터에서는 작동하지 않음 (실기기 또는 EAS Build 필요)
- `expo prebuild`로 native 프로젝트 생성 후 빌드 필요
- Apple Developer Program 가입 후 Sign In with Apple entitlement 활성화

---

## 백엔드 API 전체 목록

### Auth (`/api/auth`)
| 메서드 | 엔드포인트 | 인증 | 설명 |
|--------|-----------|------|------|
| POST | /api/auth/login | - | 소셜 로그인 (access_token 또는 authorization_code) |
| POST | /api/auth/register | - | 회원가입 (소셜 토큰 + 닉네임) |
| GET | /api/auth/me | JWT | 내 정보 조회 |
| PUT | /api/auth/nickname | JWT | 닉네임 변경 |
| DELETE | /api/auth/delete-account | JWT | 회원 탈퇴 |
| GET | /api/auth/export-data | JWT | 개인정보 내보내기 |

### Community (`/api/community`)
| 메서드 | 엔드포인트 | 인증 | 설명 |
|--------|-----------|------|------|
| GET | /api/community/posts | - | 게시글 목록 (?page=&page_size=) |
| POST | /api/community/posts | JWT | 게시글 작성 |
| GET | /api/community/posts/{id} | - | 게시글 상세 + 댓글 |
| PUT | /api/community/posts/{id} | JWT | 게시글 수정 |
| DELETE | /api/community/posts/{id} | JWT | 게시글 삭제 |
| POST | /api/community/posts/{id}/comments | JWT | 댓글 작성 |
| DELETE | /api/community/comments/{id} | JWT | 댓글 삭제 |

---

## 환경변수 (.env) 설정 가이드

### 서버 (`server/.env`)
```env
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost/fullcount

# JWT
JWT_SECRET=<랜덤 64자 이상 문자열>
JWT_ALGORITHM=HS256
JWT_EXPIRY_HOURS=720

# Social Login API Keys
KAKAO_REST_API_KEY=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
GOOGLE_CLIENT_ID=

# Mobile OAuth Redirect
MOBILE_REDIRECT_URI=kr.fullcount.app://auth
```

### 모바일 (`mobile/.env`)
```env
EXPO_PUBLIC_KAKAO_REST_API_KEY=
EXPO_PUBLIC_NAVER_CLIENT_ID=
EXPO_PUBLIC_NAVER_CLIENT_SECRET=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_REDIRECT_URI=kr.fullcount.app://auth
```

---

## Git 워크플로우

```bash
# baseball_app 레포 (개발)
git add .
git commit -m "..."
git push origin master

# baseball 레포 (프로덕션 배포) 
# 필요시 baseball_app → baseball 레포로 복사 후 push
```

---

## 알려진 이슈 및 주의사항

1. **expo-secure-store**: `npm install` 시 peer dependency 충돌 발생 → `--legacy-peer-deps` 플래그 사용
2. **SDK 54 FileSystem**: `FileSystem.documentDirectory` deprecated → `Paths.document` + `File`/`Directory` class 사용
3. **ViewShot ref**: `useRef<any>(null)` 사용 (ViewShot이 component value여서 타입 없음)
4. **expo-image-manipulator**: `manipulateAsync`는 SDK 54에서도 사용 가능 (완전히 제거되지 않음)
5. **OAuth redirect URI**: `expo-auth-session`은 `makeRedirectUri()`로 자동 생성. 개발 환경과 프로덕션에서 다를 수 있음
6. **Google Sign In**: EAS 개발 빌드 후 `@react-native-google-signin/google-signin` 설치 필요
7. **Apple Sign In**: iOS 시뮬레이터 미작동, 실기기 필요
8. **데이터 삭제 정책**: 회원 탈퇴 시 30일 유예 후 개인정보 완전 삭제 (스케줄러 필요)
9. **Photo save on Android production**: ImagePicker가 `content://` URI 반환 → `expo-file-system/legacy`의 `copyAsync`로 처리 (fetch()는 RN에서 content:// 미지원)
10. **expo-image-picker SDK 54 호환버전**: `~17.0.11` 사용. 55.x는 SDK 55+ 전용
11. **EAS Free plan**: 월 30회 Android 빌드 제한. 초과 시 `--local` 로컬 빌드 필요
12. **System nav bar overlap**: `edgeToEdgeEnabled: true` 상태에서 Android 시스템 네비게이션 바가 앱을 가리지 않도록 `useSafeAreaInsets()`로 하단 패딩 적용

---
## 2026-05-18 이후 추가 작업 — Phase 7.1: 다크모드, 다이어리 개선, UI/UX

### 다크모드 (ThemeContext 기반)
**파일 생성:**
- `lib/ThemeContext.tsx` — ThemeProvider, useTheme() hook, light/dark theme 전환, SQLite 저장, 시스템 Appearance 감지

**파일 수정 (39개):**
- 모든 컴포넌트에서 `import { theme }` → `import { useTheme }` + 컴포넌트 내 `const { theme } = useTheme()`
- 스타일을 `useMemo(() => StyleSheet.create({...}), [theme])`로 이동
- 다크모드 토글: MY 페이지 설정 섹션에 추가
- `teamPrimaryColor(teamId, isDark)` 헬퍼로 팀 컬러 동적 처리

### 다이어리 기능 개선
**파일 수정:**
- `components/DiaryEntryModal.tsx`:
  - 직관/집관(`is_live`) 토글 버튼 추가
  - 좌석 입력 필드 추가 (isLive=true 시 표시)
  - 경기 상세 화면에서 프리셋 게임으로 바로 write 단계 진입 (`presetGame`/`presetDate` prop)
  - 저장 완료 후 다이어리 탭으로 자동 이동
  - `addJikgwanRecord`/`updateJikgwanRecord`에 `is_live`, `seat`, `cheered_team` 필드 추가
- `components/DiaryCard.tsx`:
  - 직관/집관 뱃지 표시
  - 좌석 정보(🎫) 표시
  - 기본 ⚾ 이미지 제거 (사진 없으면 아무 것도 표시 안 함)
  - 공유/수정/삭제 버튼
- `components/DiaryTimeline.tsx`:
  - 날짜 선택 시 해당 날짜 기록만 필터링
- `components/DiaryStats.tsx`:
  - 다이어리 기반 승률과 실시간 승률 함께 표시 (dual win rate)

### 사진 저장 시스템 재작성
**`lib/camera.ts` 완전 재작성 (3차 시도):**
- 1차: `fetch(content://)` — RN에서 작동 안 함 ❌
- 2차: `readAsStringAsync` + base64 → 파일 쓰기 — 브릿지 모듈 의존성 이슈 ❌
- 3차: `expo-file-system/legacy`의 `copyAsync` 사용 — Android ContentResolver 네이티브 지원 ✅
  - `import * as FileSystem from "expo-file-system/legacy"`
  - `FileSystem.copyAsync({ from: sourceUri, to: destUri })`
- MediaLibrary 저장 제거 (`saveToLibraryAsync`로 갤러리 중복 저장 방지)
- 사진 저장 실패 시 에러 throw 대신 `console.warn` + 건너뛰기

### 경기 상세 화면 개선
- 투수 기록 칩 레이아웃으로 변경 (승/세/홀/패를 `flexWrap: "wrap"` 칩으로 표시)
- "직관 기록하기" 버튼 추가 → DiaryEntryModal 프리셋 모드로 연결
- 저장 완료 후 다이어리 탭으로 자동 네비게이션

### UI/UX 제스처 및 키보드 개선
- **홈 캘린더 스와이프**: PanResponder로 아래로 스와이프 (>80px) 시 캘린더 접기
  - `calendarOpenRef` 사용해 클로저에 상태 고정 문제 해결
- **다이어리 모달 스와이프**: 핸들바 PanResponder로 아래 스와이프 시 모달 닫기
  - 핸들바 영역 확대 (padding 10→16, width 36→48)
  - 어두운 배경(overlay) 탭 시 모달 닫힘
- **키보드 가림 방지**: ScrollView에 `keyboardShouldPersistTaps="handled"` 추가
  - 일기 TextInput focus 시 `scrollToEnd` 호출
- **시스템 네비게이션 바**: `useSafeAreaInsets().bottom`을 root layout에 적용
  - DiaryEntryModal sheet에도 `Math.max(insets.bottom, 8)` 패딩 적용
  - `edgeToEdgeEnabled: true` 유지, safe area로 대응

### 캘린더 UI
- `CalendarGrid.tsx` 다크모드 대응 (하드코딩된 light 색상 제거)
- `CalendarPage.tsx` 생성 (다이어리 탭 내 캘린더 페이지)

### 설정
- `components/SettingsButton.tsx` — 톱니바퀴 아이콘 버튼
- 모든 탭 페이지 상단에 설정 버튼 추가
- MY 페이지 다크모드 토글

### 앱 아이콘
- splash 배경: `#faf9f5` → `#fde8d6` (파스텔 피치)
- Android adaptiveIcon 배경: `#fde8d6`

### 패키지 변경
- `expo-image-picker`: `55.0.20` → `~17.0.11` (SDK 54 호환으로 다운그레이드)
- `react-native-gesture-handler`: `~2.28.0` 설치 (PanResponder와 별도로 사용 가능)

### 사진 선택 시 날짜 필터링
- DatePhotoPicker 컴포넌트 추가 — 갤러리에서 특정 날짜의 사진만 선택 가능
- commit: `7bf7fee`

### 경기 카드 이닝 표시
- 라이브 경기에서 "경기 중" 대신 이닝 정보 표시 (예: "3회말")
- GameDetail scoreBoard.inn 배열 길이로 이닝 추론 (away.length > home.length → 초, 같으면 → 말)
- Web + Mobile GameCard 동시 적용
- commit: `de22328`

### 구장 미저장 버그 수정
- /game-detail API가 빈 venue 반환 시 TEAM_VENUE 매핑으로 폴백
- resolveVenue() 유틸을 두 진입 경로(다이어리탭, 경기상세)에서 공유
- 기록 수정 경로에 stadium 필드 추가
- commit: `88c2c24`

### EAS Build
- 현재 Free plan Android 빌드 크레딧 소진 (6/1 초기화)
- 로컬 빌드: `npx eas build --platform android --profile preview --local`

### Git
```bash
git add .
git commit -m "..."
git push origin master
```

---
## Phase 7-9: 2026년 경기결과 미표시 + 서버 스크립트 백업 (2026-05-26)

### 문제 보고
- "26년 캘린더 일정은 있는데 경기결과가 전부 없어"
- `GET /daily-scores/2026-05-25` → `{"error":"Data not found"}`

### 원인 분석 (OCI 서버 진단)

**핵심**: 서버에서 `daily-scores.json`이 사라짐. API 코드 자체에는 연도 필터링이 없고, 단순히 `daily-scores.json` 파일을 읽어서 반환하는 구조.

서버 데이터 파이프라인 (APScheduler 3~5분 간격):
```
collector.py → update_hub_data.py → build_daily_scores.py → daily-scores.json
```

**서버 상태 진단 결과**:
1. `daily-scores.json` 존재하지 않음 (collector 로그에는 "741 dates with scores"라고 기록되어 있었으나 파일이 사라짐)
2. `update_hub_data.py` 존재하지 않음 — `collector.py`가 `subprocess.run(["python3", "scripts/update_hub_data.py"])`로 실행하는데 파일 자체가 없음
3. `build_daily_scores.py` 존재하지 않음
4. `build_today_games.py` 존재하지 않음
5. `data/teams/index.json` 존재하지 않음
6. `data/teams/*/live-results.json` (10개 팀) 전부 존재하지 않음
7. `game-records/` 디렉토리는 정상 (최신 데이터 보존 중)
8. `collector.log` 마지막 기록: `2026-05-25 08:22:53` — 이후 갱신 없음
9. data_api (uvicorn) 프로세스: 정상 실행 중 (5/25 15:59:57 systemd 재시작)

**원인 추정**: 서버에서 `git pull`(fetch_postseason.py 업데이트) 과정에서 git에 추적되지 않던 untracked 스크립트 및 데이터 파일들이 삭제됨.

### 수정 작업 (로컬 백업 → 서버 복원)

**복원할 파일 추출** (`server_backup/data_backup.tar.gz`):
- 24개 Python 스크립트 (update_hub_data.py, build_daily_scores.py, build_today_games.py, fetch_kbo_game_results.py, fetch_kbo_standings.py, build_game_records.py 등)
- `data/teams/index.json` (팀 인덱스)
- `data/teams/*/live-results.json` (10개 팀별 경기 결과)
- `data/daily-scores.json` (최종 점수 데이터)

**SCP 복원**:
```
scp build_daily_scores.py → server:/repo/scripts/
scp build_today_games.py → server:/repo/scripts/
scp update_hub_data.py → server:/repo/scripts/
scp index.json → server:/repo/data/teams/
scp live-results.json (10개 팀) → server:/repo/data/teams/*/
scp daily-scores.json → server:/repo/data/
```

**파이프라인 실행**:
```bash
cd /home/opc/fullcount_backend/repo
python3 scripts/update_hub_data.py --skip-preview --skip-lineup
```
- `fetch_kbo_standings.py` — 2026 순위 갱신 ✅
- `fetch_kbo_game_results.py` — live-results.json 재생성 (30일치) ✅
- `build_game_records.py` — game-records 재생성 (10일치) ✅
- `build_today_games.py` — `kbo_schedule_2026.json` 없어서 실패 → graceful fallback 패치
- `build_daily_scores.py` — `daily-scores.json` 재생성 (729 dates) ✅

**build_today_games.py 패치**:
- `find_game_for_team()`와 `build_games()` 함수에서 `kbo_schedule_2026.json` FileNotFoundError를 try/except로 처리
- 파일 없으면 `{"games": [], "noGames": True}` 반환 (전체 파이프라인 중단 방지)

**API 서비스 재시작**:
```bash
sudo systemctl restart fullcount-api.service
```

### 검증
- `GET /daily-scores/2026-05-24` → 5개 경기 전부 정상 점수 반환 (두산 2-5 한화, 키움 4-6 LG, SSG 2-3 KIA, NC 8-5 KT, 삼성 10-0 롯데)
- `GET /daily-scores/2026-05-23` → 5개 경기 정상 (선발투수 정보 포함)
- `GET /daily-scores/2026-05-01` → 5개 경기 정상
- `https://api.fullcount.kr/daily-scores/2026-05-24` → 외부 API도 정상 응답
- May 총 27일치 데이터 복원
- collector 수동 실행 검증 완료 (전체 파이프라인 정상)

### 서버 스크립트 백업 (로컬 git)

**문제**: 서버 전용 스크립트들이 GitHub에 없어서 재발 가능성 존재

**조치**:
1. `server-scripts` 로컬 전용 브랜치 생성
2. `server/scripts/`에 24개 서버 스크립트 커밋
3. `.gitignore`에 `server/scripts/` 등록 (GitHub 푸시 방지)
4. 커밋: `860e044`

### 커밋
- `e2ea073` — Bump version to 1.0.6 for release build
- `860e044` — Add server/scripts/ to gitignore (local-only server scripts)

### Lessons Learned
1. **서버 git pull은 untracked 파일도 위험**: 서버 전용 스크립트가 git pull 후 사라질 수 있음
2. **로컬 백업의 중요성**: `server_backup/`이 없었으면 서버 데이터 전부 복구 불가능
3. **로컬 전용 브랜치로 서버 스크립트 관리**: `server-scripts` 브랜치로 이중 안전장치

---

## Phase 7-10: 포스트시즌 데이터 수집 (2021-2023) + 데이터 정합성 (2026-05-26)

### 포스트시즌 데이터 수집 (2021-2023)

**Naver API**에서 역대 포스트시즌 데이터를 수집하여 `postseasonData.ts`에 추가.

**수집 스크립트** (`scripts/fetch_postseason.py`):
- `GET https://api-gw.sports.naver.com/schedule/games` with fields=all, fromDate/toDate, size=100, page
- gameId prefix로 필터링: 4444(WC), 3333(준PO), 5555(PO), 7777(KS) + roundCode(kbo_ps_wd/sp/po/ks)
- 2021-2023 연도별 10월~11월 범위 (toDate=11-30)
- 44개 경기 정상 수집 확인: 2021(13), 2022(15), 2023(16)
- `scripts/gen_postseason_ts.py` — JSON → TypeScript 변환, absolute path 버그 수정

**데이터 출처**: Naver Sports API 수집 로컬 데이터

### 포스트시즌 스코어 데이터 수집 (2024-2025)

2024-2025 포스트시즌 스코어를 Naver API에서 수집하여 `postseasonData.ts`에 SCORES 추가.

2025-10-03 한화 vs KT 6-6 무승부 경기: `outcome: "W"`로 잘못 기록 → `null`로 정정 (무승부는 승패 없음)

### 캘린더 포스트시즌 통합 (schedule)

`cachedScheduleByMonth` (y≤2025): LOCAL_SCHEDULE + POSTSEASON_SCHEDULE 병합
- Dedup: POSTSEASON_SCHEDULE 우선 (같은 경기는 postseason 버전 사용)
- `seen` Set으로 date+away+home 기반 중복 제거

### 코드리뷰로 발견된 버그 수정

**버그 1 - LOCAL_SCORES 점수 반전 (CRITICAL)**:
- `scores_2025.ts`의 2025-10-02, 10-04 포스트시즌 경기 점수가 홈/원정 반전
- 10-02: SSG 7-2 KIA → KIA 7-2 SSG
- 10-04: SSG@NC 7-1 → NC 7-1 SSG, 삼성@KIA 9-8 → KIA 9-8 삼성
- 10-03: stale `outcome: "T"` → `null`

**버그 2 - cachedDailyScores 우선순위 (CRITICAL)**:
- `cachedDailyScores`가 LOCAL_SCORES를 POSTSEASON_SCORES보다 먼저 체크
- LOCAL에 잘못된 데이터가 있어도 POSTSEASON 데이터가 절대 반환되지 않음
- 수정: POSTSEASON_SCORES를 LOCAL_SCORES보다 먼저 체크

**버그 3 - CalendarGrid loading 하드코딩 (MEDIUM)**:
- `loading={false}` → `loading={loading}`으로 복원

**버그 4 - 침묵 에러 처리 (MEDIUM)**:
- `.catch(() => null)` → `console.warn` 추가

**커밋**:
- `a7f25ee` — Fix score priority, wrong 2025 postseason scores, restore loading prop

### 캐시 실패 시 자동 재시도 개선

**문제**: API 첫 로드 실패 시 앱이 자동으로 재시도하지 않아 사용자가 수동 액션(탭/스와이프)해야만 복구됨.

**수정 1 - scheduleRetry (gameCache.ts)**:
- `fetchWithCache`가 stale cache를 반환할 때(API 실패), 백그라운드에서 지수 백오프 재시도 실행
- 간격: 5s → 15s → 45s (최대 3회, 총 ~65초)
- 성공 시 `db.setCache()`로 캐시 갱신, 실패 시 조용히 종료

**수정 2 - cachedAllDailyScores stale fallback (gameCache.ts)**:
- 기존: TTL 만료 시 `deleteCache`를 API 호출 전에 실행 → API 실패 시 fallback 불가
- 수정: stale cache를 보존, API 실패 시 fallback으로 반환 (fetchWithCache와 동일한 패턴)

**수정 3 - AppState foreground refresh (home.tsx)**:
- 앱이 foreground로 돌아올 때 `load()` 호출
- TTL이 자동으로 처리 (fresh cache면 재요청 없음)

**커밋**:
- `36fe5db` — Add background retry, fix cachedAllDailyScores stale fallback, add AppState refresh

---

## Phase 7-11: 도전과제 시스템 확장 — YearInReview + UI/UX 개선 (2026-05-26~27)

### Phase 3 — YearInReview (연간 리캡)

**신규 파일:**
- `components/YearInReview.tsx` — 전체화면 시즌 리캡 컴포넌트
  - 커버 (레벨 emoji + "2026, 당신의 야구")
  - 통계 그리드 (경기 수, 승률, 방문 구장, 총 지출)
  - 승/무/패 breakdown + 연승 행진 표시
  - 방문 구장 칩, 상대 전적 (가장 많이 이긴/진 팀)
  - 감정 분포 바 차트 + 상위 4개 감정
  - 획득 배지 개수, 마무리 메시지
  - 빈 상태: 5경기 미만 시 데이터 부족 안내

**파일 수정:**
- `lib/achievements.ts` — `computeSeasonSummary()` 추가
- `app/(tabs)/my.tsx` — "시즌 리캡" 카드 추가, YearInReview 모달 연결

### 버그 수정: 도전과제 네비게이션 (3회 수정)

**문제 1 — 라우트 파라미터 미전달:**
- `router.push({ pathname, params })`가 탭 내비게이터에서 이미 마운트된 화면에 파라미터를 전달하지 않음
- 1차 수정: `useLocalSearchParams` → 실패
- 2차 수정: `setPendingDiaryDeepLink()` 모듈 레벨 함수로 전환 (useFocusEffect에서 읽음)
- `AchievementWidget`, `BadgeCollectionSection`, `AchievementToast` → setPendingDeepLink("achievement") + router.push

**문제 2 — horizontal pager 미스크롤:**
- `setActiveTab("stats")`만 호출하고 `tabScrollRef.scrollTo()` 누락 → segmented control은 통계로 바뀌나 실제 화면은 타임라인
- 수정: 탭 변경 시 `tabScrollRef.current?.scrollTo({ x: screenWidth * 2 })` 추가 (3곳)

### UI/UX 개선

**AchievementToast 테마 대응:**
- 1차: `isDark ? "#1a1a2e" : theme.foreground` (inverted) → 라이트에서 검정색으로 보임
- 2차: `theme.card` + `theme.foreground` + `theme.border` — 자연스러운 테마 통일

**홈 탭 위젯 접기:**
- 캘린더처럼 "도전과제 보기 ▼ / 접기 ▲" toggle 버튼으로 변경
- `LayoutAnimation`으로 접힘/펼침 애니메이션
- PanResponder 스와이프 (아래로 열기, 위로 닫기)
- 캘린더와 도전과제가 함께 열리지 않도록 상호 배타적 (한쪽 열면 다른 쪽 닫힘)
- 두 toggle을 가로 한 줄에 배치: "캘린더 보기 ▼ | 도전과제 보기 ▼"

### 커밋 내역

| 해시 | 설명 |
|------|------|
| `687cc73` | Add Phase 3 YearInReview + computeSeasonSummary |
| `a4422f4` | AchievementToast theme (inverted → card bg) |
| `dfc8d27` | Route widget to diary via params (1차 시도) |
| `9fdc801` | Fix pager scroll on tab switch |
| `6990c87` | Final toast theme fix (theme.card) |
| `7c14e60` | Route BadgeCollectionSection to achievement |
| `751488f` | Module-level deep-link (params → setPendingDiaryDeepLink) |
| `3c329cd` | Toast tap scroll fix |
| `a92342d` | AchievementWidget collapsible toggle |
| `84735ae` | Combined toggle row (calendar \| achievement) |
| `61a8ac8` | Swipe gesture for achievement |
| `4056f7f` | Mutual exclusive toggles |

### Phase 4 — 도전과제 4종 확장 (2026-05-27)

**Feature 1 — BadgeCollectionModal (컬렉션 뷰):**
- `mobile/components/BadgeCollectionModal.tsx` — 전체 화면 배지 그리드 모달
  - 레벨 카드 (emoji + LV.X + XP 프로그레스 바 + 획득 카운트)
  - 6개 카테고리 필터 탭 (전체/마일스톤/연승/출석/탐험/시크릿)
  - 3열 그리드: 해금 배지(불투명) / 잠긴 배지(opacity 0.35 + 🔒 + 진행률 미니바)
  - 배지 탭 → 상세 팝업 (조건, 진행률, 획득일)
  - 레벨 기반 시각적 강조 (LV.7 금색, LV.5 별)
- `app/(tabs)/my.tsx`:
  - BadgeCollectionSection onPress → BadgeCollectionModal 열림 (다이어리 이동 대체)

**Feature 2 — 레벨 보상:**
- `components/AchievementWidget.tsx` — 레벨별 시각적 차등 적용
  - LV.5+: level title 옆 ⭐ 표시
  - LV.5+: XP 바 주황색 악센트
  - LV.7+: XP 바 + border 금색(#ffd700)
- `components/BadgeCollectionModal.tsx` — 동일한 레벨 악센트 적용

**Feature 3 — 배지 획득 confetti 애니메이션:**
- `mobile/components/ConfettiOverlay.tsx` — 20개 Animated.View 파티클 confetti
  - 컬러 사각형/원형, 1.2~2초 fall + rotate + fade out
  - `useNativeDriver: true`로 성능 최적화
- `app/(tabs)/diary.tsx`:
  - 배지 해금 감지 → ConfettiOverlay 먼저 표시
  - confetti 종료 후 AchievementToast 표시 (순차 전환)

**Feature 4 — 신규 배지 5개 (KBO 특화):**
- `mobile/lib/achievements.ts` — Phase 4 배지 5개 추가 (기존 22개 → 27개)

| badgeKey | emoji | 타이틀 | 카테고리 | 조건 | XP |
|---|---|---|---|---|---|
| blowout | 💪 | 대승 직관 | secret | 10점차 이상 승리 | 10 |
| one_run_win | 😱 | 한점차 승리 | secret | 1점차 승리 | 10 |
| opening_day | 🎊 | 개막전 직관 | milestone | 3월 20일 이후 경기 | 10 |
| tie_game | 🤝 | 무승부 직관 | secret | 무승부 경기 | 10 |
| shutout | 🧤 | 완봉승 직관 | secret | 상대 0점 승리 | 10 |

### 커밋 내역 (도전과제 확장)

| 해시 | 설명 |
|------|------|
| `67d1979` | Add 5 new KBO badges (Phase 4) |
| `8bc0fe6` | Add ConfettiOverlay + diary unlock animation |
| `5262d44` | Add BadgeCollectionModal grid view + level rewards |
| `03f1bc5` | Fix CalendarGrid team selector spacing |

### Phase 5 — 구단별 시크릿 배지 10종 (2026-05-27)

KBO 10개 구단의 팬덤 문화·밈·응원가를 반영한 시크릿 배지 추가 (27개 → 37개).

| badgeKey | emoji | 타이틀 | 구단 | 조건 | XP |
|---|---|---|---|---|---|
| cant_live_without_kia | 🎵 | KIA 없인 못 살아 | KIA | KIA 응원 5승 | 10 |
| jokka_line | 🦾 | JOKKA 라인 | 삼성 | 삼성 1점차 승리 | 10 |
| seungri_yojeong | 🧚 | 승리의 요정 | LG | LG 3연승 | 15 |
| positive_rhythm | 🐻 | 긍정리듬 | 두산 | 두산 2연패 (연속 패배) | 10 |
| brand_god | 🏷️ | 브랜드의 가치 | SSG | SSG 3회 직관 | 10 |
| wiz_magic | 🪄 | 위즈 매직 | KT | KT 홈 승리 | 10 |
| kim_taekjin | 💻 | 김택진입니다 | NC | NC 원정 승리 | 10 |
| busan_galmaegi | 🌊 | 부산 갈매기 | 롯데 | 사직구장 직관 | 10 |
| im_happy | 😇 | 나는 행복합니다 | 한화 | 한화 5패 | 10 |
| heroes_way | 🦸 | 영웅의 길 | 키움 | 키움 승리 | 10 |

**변경 파일:**
- `mobile/lib/achievements.ts` — BADGE_DEFINITIONS에 Phase 5 구단별 시크릿 배지 10종 추가

**참고사항:**
- 모든 배지는 `"secret"` 카테고리, `"easy"` 티어 (seungri_yojeong만 `"medium"` 15xp)
- `cheered_team` 필드로 각 구단별 응원 기록 필터링
- `resolveIsWin(r)` / `parseGameTeamIds(r.game_id)` / `r.stadium` 활용
- `positive_rhythm`(두산)과 `im_happy`(한화)는 패배/연패 조건 — 아이러니 응원문화 반영

**커밋 내역:**
| 해시 | 설명 |
|------|------|
| `e7dcf48` | Add 10 team-specific secret badges (Phase 5) |

### Phase 6 — 구단별 배지 확장 + myTeam 필터링 (2026-05-27)

KBO 10개 구단 밈·응원가·팬덤 문화 추가 배지 12종 + 팀 전용 배지 myTeam 필터링 적용 (37개 → 49개).

**신규 배지 12종:**

| badgeKey | emoji | 타이틀 | 구단 | 조건 | XP |
|---|---|---|---|---|---|
| tiger_charge | 🐯 | 호랑이 군단 | KIA | 6점차 이상 승리 | 10 |
| lapark_master | 🏟️ | 라팍의 주인 | 삼성 | 삼성 홈경기 승리 | 10 |
| shinbaram | 🎺 | 신바람 야구 | LG | LG 8득점 이상 승리 | 10 |
| jamsil_derby | ⚔️ | 잠실 더비 승자 | LG | LG beats Doosan | 10 |
| jamsil_derby_doosan | ⚔️ | 잠실 더비 승자 | 두산 | 두산 beats LG | 10 |
| for_victory | 🎸 | 승리를 위하여 | 두산 | 4점차 이상 승리 | 10 |
| bazooka | 💥 | 바주카 발사 | SSG | 홈경기 3승 | 10 |
| water_festival | 💦 | 워터 페스티벌 | KT | 6-8월 직관 | 10 |
| tears_of_blood | 🩸 | 눈물의 피 | NC | NC beats Doosan 5+ | 10 |
| busan_port | 🎤 | 돌아와요 부산항에 | 롯데 | 홈경기 승리 | 10 |
| bodhisattva | 🪷 | 보살팬 | 한화 | 10+회 직관 | 10 |
| small_giant | 🦸‍♂️ | 작은 거인 | 키움 | 원정 승리 | 10 |

**myTeam 필터링:**
- `BadgeDefinition.teamId?: string` 필드 추가
- `getVisibleBadgeDefinitions(myTeam)` 공유 유틸리티로 일관된 필터링
- 기존 Phase 5 배지 10종에도 `teamId` 부여
- `myTeam` null 시 팀 배지 전체 숨김, 팀 전환 시 자동 반영
- `evaluateBadges()`, `computeLevel()`, `AchievementToast`는 변경 없음

**변경 파일:**
- `mobile/lib/achievements.ts` — interface + 12종 배지 + 유틸리티
- `mobile/components/BadgeCollectionModal.tsx` — myTeam prop, 필터링
- `mobile/components/AchievementWidget.tsx` — useTeam + 필터링

---

## Phase 9: 캐릭터 27종 확장, 집관 배지, 코드리뷰 버그픽스 (2026-05-27)

### 변경 내용

**1. 캐릭터 아이콘 9종 추가 (18→27)**
- devastated(멘붕), hot_summer(폭염), karen(까칠), out(퇴장), praying(기도), rain_cancellation(우취), resigned_disgust(체념), thumbs_up(따봉), provocative(도발)
- `scripts/normalize-images.cjs` EMOTIONS 배열 업데이트, 270개 PNG 재생성
- `mobile/lib/emotions.ts` CharacterEmotion/ALL_CHARACTERS 확장

**2. 집관(Home Viewing) 배지 5종**
- `home_first` (튜토리얼, 5xp) — 첫 집관 기록
- `home_10/30/50/100` — 집관 기록 마일스톤 (is_live=0 카운트)

**3. 토스트 애니메이션 개선**
- 사라질 때 fade-out + slide-down 동시 진행, 이후 LayoutAnimation으로 간격 축소
- EXIT_DURATION 250→350ms
- 토스트 탭 시 도전과제 모달로 이동

**4. 프로필 선택기 스크롤**
- 캐릭터 27개 표시를 위해 ScrollView(maxHeight: 360) 적용

**5. 코드리뷰 버그픽스 (9건)**
- `addUnlockedEmotion` — BEGIN IMMEDIATE 트랜잭션으로 동시 해금 경합 제거
- `busan_galmaegi` — 정렬 누락으로 잘못된 날짜 반환 수정
- `bodhisattva`/`irresponsible_pleasure` — qualifying date가 마지막 방문일이 아닌 N번째 방문일 사용
- 지출 금액 NaN 입력 시 알림 표시
- `diary.tsx` — loadData/checkBadges await 누락 수정
- `evaluateBadges` — 트랜잭션으로 래핑
- API onError 로깅 추가 (console.warn)
- AppState 리스너 추가 (foreground 감지)
- ErrorBoundary를 Provider 밖으로 이동

**6. AAB 빌드 v1.0.7(8)**
- EAS Build production 프로파일, Play Store 배포용

### 변경 파일
- `mobile/lib/emotions.ts` — CharacterEmotion 18→27
- `mobile/lib/achievements.ts` — 집관 배지 5종 + 버그픽스
- `mobile/lib/db.ts` — addUnlockedEmotion 트랜잭션, getDb export
- `mobile/lib/api.ts` — onError 로깅
- `mobile/components/AchievementToast.tsx` — exit slide-down + duration
- `mobile/components/DiaryEntryModal.tsx` — 지출 NaN 검증
- `mobile/app/(tabs)/diary.tsx` — await 추가, AchievementModal 연동
- `mobile/app/(tabs)/my.tsx` — 프로필 선택기 스크롤
- `mobile/app/_layout.tsx` — ErrorBoundary 위치, AppState 리스너
- `scripts/normalize-images.cjs` — EMOTIONS 18→27
- `client/public/team-characters/` — PNG 90개 추가
- `mobile/app.json` — version 1.0.7, versionCode 8
- `mobile/components/AchievementList.tsx` — useTeam + 필터링
- `mobile/app/(tabs)/my.tsx` — BadgeCollectionSection + Modal myTeam 전달

---

## Phase 10: Android adaptive-icon 여백 보정

> **날짜**: 2026-05-27

### 개요
Android 런처 아이콘이 시스템 마스크(mask)에 의해 가장자리 ~17%가 잘리는 문제 수정. 로고 이미지를 66% 축소 후 중앙에 배치하여 safe zone 내에 위치하도록 보정.

### 변경 사항
**1. 패딩 적용 이미지 생성**
- `sharp`로 `adaptive-icon.png`(1024×1024)를 66% 리사이즈(676×676) 후 투명 캔버스 중앙에 합성
- `adaptive-icon-padded.png` 생성 → `adaptive-icon.png`에 덮어쓰기 (참고용 파일은 삭제)
- `icon.png`(스플래시/로딩용)는 원본 유지 — 마스크 적용되지 않아 잘림 없음

**2. 시각 비교 HTML**
- `mobile/icon-compare.html` — 현재(빌드 중)/수정(패딩) side-by-side 비교 + 런처 미리보기

**3. 더블헤더 배지 조건 버그 수정**
- 같은 날 같은 `game_id`로 2개 기록 작성 시 더블헤더가 해금되던 문제 수정
- `records` 단순 카운트(dateCount) → 같은 날짜 내 **고유 `game_id` 개수**(dateGames Set)로 변경
- 같은 경기를 2번 기록해도 해금되지 않고, 실제로 다른 2경기를 직관해야 해금됨

### 변경 파일
| 파일 | 변경 |
|------|------|
| `mobile/assets/adaptive-icon.png` | 1024×1024 꽉 참 → 66% 중앙 패딩 버전으로 교체 |
| `mobile/lib/achievements.ts` | 더블헤더 check: dateCount → dateGames Set<game_id> |

---

## Phase 11: Game Detail Live Status Bug Fix

> **날짜**: 2026-05-27

### 개요
진행 중인 경기에서 홈 탭은 이닝(예: "3회초")을 표시하는데, 게임 상세 페이지는 "경기 종료"를 표시하는 버그 수정.

### 근본 원인
서버 `/game-detail/{gameId}` API가 다음 두 소스의 불일치로 **진행 중인 경기의 `gameInfo.status`를 `"finished"`로 잘못 반환**:
- `gameInfo.status` → `today-games.json`에서 못 찾으면 `daily-scores.json`으로 fallback. `daily-scores.json`은 진행 중에도 `awayScore`가 있으면 `"finished"`로 설정 (server/main.py:548)
- `scoreBoard.inn` → 팀별 `game-records/{date}.json`에서 읽어오므로 정상 (실시간 스크래핑)

홈 탭은 `TodayGame.status`(다른 API) + `score.outcome !== null`(결정적 finished 신호) 사용으로 영향 없음.

### 수정 내용 (`mobile/app/game/[id].tsx`)
1. **`isFinished`**: 오늘 경기에서 `gameInfo.status === "finished"`를 무조건 신뢰하지 않도록 `hasDefinitiveFinish` 가드 추가
   - 결정적 종료 신호: `scoreBoard?.rheb`(최종 R/H/E), `pitchingResult`(W/L), `etcRecords`(경기 후 기록)
2. **`isLive`**: 백업 조건을 `(isGameActive && isToday)` → `isToday`로 변경 (홈 탭과 동일)

### Edge Cases
- 진행 중 (API 잘못 응답): hasDefinitiveFinish=false → isFinished=false → isLive=true ✓
- 종료 (정상): hasDefinitiveFinish=true → isFinished=true ✓
- 과거 경기: `!isToday` → 기존 로직 유지 (regression 없음)
- 시작 직전/후, 데이터 없음: `isToday=true` + `gameHasStarted` true → live ✓

---

## Phase 12: 이닝 표시 통합

> **날짜**: 2026-05-27

### 개요
게임 상세 페이지에 진행 중인 경기의 이닝 정보(예: "3회초")를 표시. 이닝 추론 로직을 `shared/gameStatus.ts`로 분리하여 홈 탭과 게임 상세가 동일한 함수 사용.

### 변경 사항
1. **`shared/gameStatus.ts`** 신규 생성
   - `getInningInfo(inn)` — `scoreBoard.inn` 배열 길이로 회초/회말 추론
   - `InningInfo` 타입 (`inning`, `isTop`)

2. **홈 탭 리팩터링** (`home.tsx`)
   - 인라인 이닝 추론 로직(기존 10줄) → `getInningInfo()` 호출 (3줄)

3. **게임 상세 이닝 표시** (`[id].tsx`)
   - `liveLabel` 추가 — `getInningInfo()` 결과로 "N회초"/"N회말" 생성
   - 상태 배지에 `"경기 중"` 대신 `liveLabel` 표시

### 변경 파일
| 파일 | 변경 |
|------|------|
| `shared/gameStatus.ts` | 신규: getInningInfo, InningInfo |
| `mobile/app/(tabs)/home.tsx` | import + 인라인 로직→getInningInfo() 호출 |
| `mobile/app/game/[id].tsx` | import + liveLabel 계산 + 렌더링 |

---

## Phase 13: Live Game Badge Protection (3단계)

> **날짜**: 2026-05-27

### 개요
경기 중에 직관 기록을 저장하면 현재 진행 중인 점수(예: 3-2)로 `is_win`이 계산되어 저장됨. 최종 점수와 다르면 승/패/무/점수차/연승 등에 의존하는 **31개 배지 + 통계 + DiaryCard/Calendar 표시**가 모두 잘못되는 문제 수정.

### 전략: 3단계 접근

#### Phase 1 — 저장 시점에 `game_status` 저장 (DB + save path)

| 파일 | 변경 |
|------|------|
| `mobile/lib/db.ts` | `migrateJikgwanSchema`에 `game_status TEXT` 컬럼 추가, `JikgwanRecord` 인터페이스 확장, `addJikgwanRecord` INSERT 파라미터 추가, `JIKGWAN_ALLOWED_COLUMNS`/`updateJikgwanRecord` 타입에 추가 |
| `mobile/components/DiaryEntryModal.tsx` | `GameOption`에 `gameStatus` 필드 추가, `loadGames()`에서 score.outcome/schedule.status로 live/finished 추론, `handleSave()`에서 game_status 저장 |
| `mobile/app/game/[id].tsx` | `handleOpenDiary()`에서 `detail.gameInfo?.status`를 `gameOpt.gameStatus`로 전달 |

#### Phase 2 — `resolveIsWin`에서 live 기록 제외

| 파일 | 변경 |
|------|------|
| `mobile/lib/expenseStats.ts` | `resolveIsWin()` 첫 줄에 `if (rec.game_status === "live") return null;` — 1줄로 31개 배지 + 7개 통계 함수 + DiaryCard/Calendar 표시 모두 live 기록 제외 |

#### Phase 3 — 게임 종료 후 자동 백필

| 파일 | 변경 |
|------|------|
| `mobile/lib/achievements.ts` | `backfillLiveRecords()` 신규 — `game_status="live"` 기록 조회 → `cachedDailyScores(날짜)`로 최종 점수 확인 → `outcome` 있으면 `score_away`/`score_home`/`is_win`/`game_status="finished"` 업데이트. 날짜별 try-catch로 네트워크 오류 격리 |
| `mobile/app/(tabs)/home.tsx` | AppState 포그라운드 감지 + 마운트 시 `backfillLiveRecords()` → `evaluateBadges()` 순서 실행 |
| `mobile/app/(tabs)/diary.tsx` | 일기 저장 후 배지 평가 시 `backfillLiveRecords()` 먼저 실행 |

### 하위 호환성
| 시나리오 | game_status | resolveIsWin 동작 |
|----------|------------|-------------------|
| 새 기록, 경기 중 저장 | `"live"` | return null → 배지/통계 제외 |
| 새 기록, 경기 종료 후 저장 | `"finished"` | 기존 로직 (정상) |
| 새 기록, 미래 경기 저장 | `"scheduled"` or null | 기존 로직 (isWin null, 점수없음 → return null) |
| 기존 기록 (업데이트 전) | null | 기존 로직 그대로 (하위 호환) |

### 기타 수정
| 파일 | 변경 |
|------|------|
| `shared/types.ts` | `ScheduleGame`에 `gameIdx?: number` 추가 (기존 타입 에러 수정) |
| `mobile/components/CalendarPage.tsx` | `ScoreInfo`에 `gameIdx?: number` 추가 (기존 타입 에러 수정) |

### Verification
- `npx tsc --noEmit` — 에러 0 ✅
- 경기 중 저장 → `game_status="live"`로 저장 ✅
- `resolveIsWin(rec)` → `rec.game_status="live"`면 null 반환 ✅
- 기존 기록(legacy) → `game_status=null` → 기존 로직 그대로 동작 ✅
- 앱 재진입 시 `backfillLiveRecords()` → `evaluateBadges()` 자동 실행 ✅

---

## Phase 14: 승리 토템 시스템

> **날짜**: 2026-05-28

### 개요
사용자 커스터마이징 통계 기능. 개인만의 토템(행운의 아이템, 메이트, 루틴 등)을 등록하고 직관 기록 시 함께한 토템을 선택, 토템별 승률/연승 통계를 제공.

### Data Model

새 테이블:
- `totems` — `id`, `name`, `emoji`, `description`, `color`, `hidden`(soft-delete), `created_at`
- `diary_totems` — `id`, `record_id`(FK), `totem_id`(FK), `UNIQUE(record_id, totem_id)`

### DB 함수 (db.ts)

| 함수 | 설명 |
|------|------|
| `addTotem(name, emoji?, description?, color?)` | 새 토템 생성 |
| `updateTotem(id, fields)` | 토템 수정 (TOTEM_ALLOWED_COLUMNS 검증) |
| `deleteTotem(id, keepRecords)` | keepRecords=true → hidden=1 (soft-delete), false → 실제 DELETE |
| `getAllTotems()` | `WHERE hidden=0` — MY탭/모달용 |
| `addDiaryTotem(recordId, totemId)` | 기록-토템 연결 |
| `removeDiaryTotem(recordId, totemId)` | 연결 해제 |
| `getDiaryTotems(recordId)` | 특정 기록의 토템 목록 |
| `setDiaryTotems(recordId, totemIds)` | 일괄 덮어쓰기 (DELETE + INSERT) |
| `getTotemStats(totemId, records)` | 토템별 승률/횟수/연승 계산 |
| `getAllTotemStats(records, includeHidden?)` | 전체 토템 통계 (DiaryStats는 hidden 포함, MY탭은 제외) |
| `deleteDiaryTotemsByRecordId(recordId)` | 기록 삭제 시 연결 정리 |

### 변경 파일

| 파일 | 변경 |
|------|------|
| `mobile/lib/db.ts` | `totems`/`diary_totems` 테이블 CREATE, `migrateTotemSchema()`, `hidden` 컬럼 추가, `TOTEM_ALLOWED_COLUMNS` 검증, totem CRUD + stats 함수 11개, `resetAllData`/`deleteJikgwanRecord`에 totem 정리 추가 |
| `mobile/components/DiaryEntryModal.tsx` | GameOption에 gameStatus 추가, loadGames에서 status 추론, handleSave에서 game_status 저장, 토템 섹션 (칩 선택 UI, 빈 상태 문구, edit 시 기존 선택 복원) |
| `mobile/components/DiaryStats.tsx` | "토템 승률" 카드 추가 — 가로 스크롤 칩, 집관 포함/제외 토글 연동, `includeHidden=true`로 soft-delete 토템도 통계 표시 |
| `mobile/app/(tabs)/my.tsx` | "나의 토템" 섹션 — 2열 칩 그리드, create/edit 모달 (이모지 팔레트 36종 + 직접 입력, 색상 팔레트 12종), 삭제 확인 모달 (기록 유지/제거 선택) |
| `mobile/app/(tabs)/home.tsx` | 도전과제 위젯 onPress → MY탭 도전과제 모달로 이동 |
| `mobile/components/AchievementWidget.tsx` | onPress를 `router.push("/my?openAchievement=1")`로 변경 |

### 수정된 버그

| 버그 | 원인 | 수정 |
|------|------|------|
| deleteTotem 기록 유지 시 stats 사라짐 | diary_totems 연결 + totem 레코드 모두 삭제 | soft-delete: `hidden=1` 설정, diary_totems 유지 |
| soft-delete 토템이 MY탭에 계속 노출 | `getAllTotemStats()`가 hidden 포함 전체 조회 | `includeHidden` 파라미터 추가, MY탭은 기본값(false) |
| 토템 생성 후 MY탭에 안 나타남 | `getAllTotemStats`가 count>0인 것만 push | 필터 제거, 모든 토템 결과에 포함 |
| 토템 삭제 모달 버튼 글자 안 보임 | theme.secondary 배경 + mutedForeground 글자 | 명시적 색상 사용 (myTeamColor+white, muted+red) |
| 이모지 팔레트에 사람 없음 | 음식 이모지로 구성 | 사람 이모지 12종으로 교체 |
| 색상이 raw hex 입력 | 자유 입력 방식 | 12색 원형 팔레트 + X 버튼 |

### Code Review 반영

- `updateTotem`에 `TOTEM_ALLOWED_COLUMNS` Set 검증 추가 (SQL 키 인터폴레이션 보호)
- `getTotemStats`에 `if (!totem) throw` guard (hard-delete된 totem 조회 시 TypeError 방지)
- DiaryStats `.catch(() => {})` → `console.warn` (silent error 제거)

### Verification
- `npx tsc --noEmit` — 에러 0 ✅
- 토템 생성/수정/삭제 (기록 유지/제거) 정상 동작 ✅
- DiaryEntryModal 토템 선택/해제/저장 ✅
- DiaryStats 토템 통계 표시 (집관 토글 연동) ✅
- soft-delete 후 MY탭 미노출 + DiaryStats 통계 유지 ✅

## Phase 14.5: 초기화/백그라운드 안정성 수정 (2026-05-28)

### 커밋: e174aab — 앱 초기화 후 데이터 로딩 실패 및 사진 첨부 불가 문제 수정

### 수정된 버그

| 버그 | 원인 | 수정 |
|------|------|------|
| 앱 초기화 후 무한 로딩 스피너 | `TeamContext`에서 `getMyTeam()` reject 시 `.catch()` 없어 `loading`이 영원히 `true` | `.catch()`로 `setMyTeamState(null)`, `.finally()`로 `setLoading(false)` |
| 초기화 직후 갤러리 안 열리고 "권한 필요" 알림 | 권한 체크 2단계(`get`→`request`)가 Android 초기화 직후 `false` 반환 | `requestMediaLibraryPermissionsAsync` 직접 호출로 간소화 |
| 사진 크롭 후 저장 시 "사진 저장 실패" | `react-native-view-shot` `captureRef`가 만드는 캐시 URI가 시간 경과로 만료 | crop 즉시 `documentDirectory/jikgwan/`로 복사하여 영구 URI 사용 |
| `resizePhoto`가 에러를 삼켜 디버깅 어려움 | catch 블록에서 `return uri` (유효하지 않은 URI 그대로 반환) | 명시적 `throw new Error`로 변경 |

### 알려진 이슈 (미해결)

| 이슈 | 설명 | 상태 |
|------|------|------|
| 백그라운드 복귀 후 갤러리 실패 | Android가 오래된 Activity를 파괴한 후 복귀 시 `launchImageLibraryAsync` 자체가 실패할 수 있음. `getPendingResultAsync` 복구는 직전에 갤러리를 열었던 경우에만 유효하므로, 백그라운드 복귀 후 첫 갤러리 열기는 복구 불가 | 추후 `AppState` 리스너로 Activity 상태 감지 후 retry/지연 호출 검토 |

### 변경 파일

| 파일 | 변경 |
|------|------|
| `mobile/lib/TeamContext.tsx` | `useEffect`에 `.catch()` + `.finally()` 추가 |
| `mobile/components/diary/useDiaryForm.ts` | 권한 체크 간소화, `getPendingResultAsync`에 try-catch 추가 |
| `mobile/components/PhotoCropper.tsx` | `FileSystem` import, crop 후 `documentDirectory`로 즉시 복사 |
| `mobile/lib/camera.ts` | `resizePhoto` catch에서 throw로 변경 |

---

## Phase 15: resolveGames() 통합 — 데이터 흐름 아키텍처 개선

> **날짜**: 2026-05-28
> **브랜치**: `feature/resolve-games`

### 개요

4개 파일에 중복된 스케줄-점수 매칭 로직을 단일 `resolveGames()` 함수로 통합하고, game/[id]의 DH 점수 폴백 버그를 수정.

### 변경 내역

#### Phase 1 — `resolveGames.ts` 구현 (신규)

- `mobile/lib/resolveGames.ts`:
  - `ResolvedGame` 통합 인터페이스 (평탄화 필드 + `_raw` 원본 참조)
  - `resolveGames(schedule, scores, dateFilter, options?)` — 특정 날짜의 스케줄-점수 매칭
  - `resolveGamesForSchedule(schedule, scoresByDate, options?)` — 다중 날짜 편의 래퍼
  - 알고리즘: `pairCount Map`으로 동일 매치업 카운트 → `pairIdx`로 DH 인덱싱
  - `matchingScores.find(s => (s.gameIdx ?? 0) === pairIdx + 1) || matchingScores[pairIdx]`
  - `gameId`는 항상 `buildGameId()` 결과 사용 (API ID 불신)
  - `dhGameNumber`: 1-based (서버 convention), 0 = 단일경기
  - TodayGame enrichment: 투수, 상태, gameId 우선 적용
  - `_raw: { schedule?, score?, today? }`로 원본 참조 보존

#### Phase 2~6 — Consumer 마이그레이션 5건

| 파일 | 주요 변경 | 제거된 로직 |
|------|----------|-----------|
| `mobile/app/(tabs)/home.tsx` | `EnhancedGame` → `ResolvedGame`, ~60줄 매칭 제거 | `pairCount`, `matchingScores.find(...)` |
| `mobile/components/CalendarGrid.tsx` | `CalendarScore` 제거, props 단순화 (`resolvedGames` 단일 prop) | DH label/score 매칭, non-DH find 3블록 |
| `mobile/components/CalendarPage.tsx` | `ScoreInfo` 제거 | DH score matching, non-DH find |
| `mobile/components/DiaryCalendar.tsx` | props 통일 (`resolvedGames: ResolvedGame[]`) | pairCount DH 매칭 루프 |
| `mobile/app/game/[id].tsx` | `resolveGames()`로 DH 버그 수정 | global→per-matchup 변환, `.find()` fallback |

### 코드리뷰 수정

Opus 코드리뷰에서 발견된 버그 2건 수정:

| 버그 | 파일 | 원인 | 수정 |
|------|------|------|------|
| 팀 미설정 시 캘린더 빈 화면 | `DiaryCalendar.tsx` | `teamId`가 null이면 `myGamesByDate`에 아무것도 추가 안 함 | `if (!teamId \|\| ...)`로 조건 완화 |

### Verification

- `npx tsc --noEmit` — 에러 0 ✅
- 단일경기/더블헤더/취소/라이브/시범경기/포스트시즌 엣지 케이스 처리 ✅
- gameId 항상 `buildGameId()`로 생성 (API 포맷 변경 내성) ✅
- DH 2차전 gameSeq 인덱스 resolveGames 배열 인덱스와 일치 ✅

### 커밋

| 해시 | 설명 |
|------|------|
| `4a8fc6f` | `@refactor: resolveGames() 통합 — 데이터 흐름 아키텍처 개선` (6개 파일) |
| `(current)` | `@fix: resolveGames "전체" 팀 필터링 버그 수정` (CalendarGrid + DiaryCalendar) |