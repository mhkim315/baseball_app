# Fullcount.kr Mobile App — 개발 작업 문서

> 마지막 업데이트: 2026-06-17 (Hotfix 1.2.0 + Test 3.0.0)
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

---

## Phase 17-5: 온보딩 프리페치 확장 — 모든 점수 + 인접 월 schedule (2026-06-01)

### 문제
온보딩 완료 후 홈화면 진입 시 경기 상세/일정이 바로 표시되지 않고 로딩 필요.

### 근본 원인
- 서버 `/onboarding-data`가 14일치 점수만 반환 (`range(14)`)
- `writeToCache()`가 `scores:__all__` 키를 쓰지 않아 `preloadAll()`의 `cachedAllDailyScores()`가 항상 API 호출
- 인접 월 schedule preload 없음

### 수정 내역

| 파일 | 변경 |
|------|------|
| `server/data_api/main.py` | `range(14)` 일부 순회 → `dates_dict.items()` 전체 순회 (모든 daily-scores 반환) |
| `mobile/lib/prefetch.ts` | `writeToCache()`에 `scores:__all__` 키 기록 추가 |
| `mobile/lib/prefetch.ts` | `fetchAndCacheOnboarding()`에 인접 월 schedule fire-and-forget preload 추가 |

### 커밋

| 해시 | 설명 |
|------|------|
| `c86c03f` | `fix: 온보딩 프리페치에 모든 점수 데이터 + 인접 월 schedule 포함` |

---

## Phase 17-6: 온보딩 응답 연도 필터 + 서버 동기화 및 전면 백업 (2026-06-01)

### 문제
`/onboarding-data`가 daily-scores.json의 729일치(2024-2026, ~1MB)를 통째로 반환. 앱에서 과거 연도(≤2025)는 LOCAL_SCORES로 로컬 처리하므로 서버에서 보낼 필요 없음.

### 수정 내역

| 파일 | 변경 |
|------|------|
| `server/data_api/main.py` (로컬) | `dates_dict.items()` → `if d.startswith(str(current_year))` 필터 추가 (후에 revert) |
| 서버 `main.py` (bak 기반) | `/onboarding-data` 엔드포인트 append, `current_year` 필터로 2026년만 반환 |

### 서버 배포 중 발견된 Python 3.9 호환 이슈

서버 Python 3.9에서 발생한 오류와 수정:

| 문제 | 원인 | 수정 |
|------|------|------|
| `TypeError: unsupported operand type(s) for \|` | `dict \| None` 타입 구문 (Python 3.10+) | `Optional[dict]`로 변경 |
| `ModuleNotFoundError: No module named 'data_api'` | `from data_api.main import _HISTORICAL_SCORING` — 서버는 flat `main.py`, 패키지 구조 아님 | inline `_HISTORICAL_SCORING` 사용 (서버 bak에 이미 정의됨) |
| `UnboundLocalError: local variable 'current_year' referenced before assignment` | `current_year` 할당이 scores 루프보다 뒤에 위치 | 루프 전으로 이동 |

**원인:** 로컬 `server/data_api/main.py`(Python 3.10+, `data_api` 패키지)와 서버 `main.py`(Python 3.9, flat)가 분기되어 있었음. 서버 backup(bak)에 `onboarding-data` 엔드포인트를 append하는 방식으로 해결.

### 서버 동기화

`server-scripts` 로컬 전용 브랜치에 서버 Python 파일 전체 동기화:

| 파일 | 커밋 |
|------|------|
| `server/data_api/main.py` | `e4d34fc` |
| `server/collector.py` | `9a4fae5` |
| `server/init_db.py` | `9a4fae5` |
| `server/migrate_data.py` | `9a4fae5` |
| `server/scripts/` (24개 파이프라인) | `b74e843` |

### 서버 전면 백업

`server_backup/` 갱신 (서버 완전 상실 시 복구 가능):

| 항목 | 파일 | 비고 |
|------|------|------|
| Python 코드 | `main.py`, `collector.py`, `init_db.py`, `migrate_data.py` | 서버 최신 버전 |
| nginx 설정 | `nginx/api.conf` | |
| nginx SSL | `nginx/api.fullcount.kr.cer` + `.key` | |
| systemd 서비스 | `systemd/fullcount-api.service` | DB 비밀번호 포함 |
| DB 덤프 | `full_db.sql` (7KB) | git-ignore |
| JSON 데이터 | `data.tar.gz` (12MB, 압축) | git-ignore |
| pip 패키지 | `requirements.txt` | |

### 메모리 갱신
- `oracle-server-access.md` — 동기화 루틴, 백업 항목, 복구 절차 업데이트

### Verification
- `/onboarding-data` 응답: **1MB(729일) → 253KB(135일, 2026년만)** ✅
- 모든 필드 정상: todayGames, standings, schedule, scoreSummary, gameDetails(20) ✅
- HTTP 200 ✅

---

## Phase 17-7: 경기상세 fallback 개선 + 서버 버그 수정 + April game-records 재수집 (2026-06-01)

### 문제
1. **경기상세 점수만 뜸**: `fetchWithCache`가 stale cache도 API 실패 시 `scheduleRetry` 없이 `null` 반환 → `tryExhibitionFallback()` → 점수만 표시
2. **dedup promise 누수**: `prefetchOnboardingData()`가 reject된 promise를 cleanup하지 않음 → `prefetchOnAppInit()`이 영원히 실패
3. **AppState 미처리**: 앱 백그라운드 복귀 시 `prefetchOnAppInit()` 호출되지 않아 캐시 장기간 stale
4. **선발투수 `??`**: `lineup.json`의 `startingPitcher: {"name": "??"}`가 game_data의 실제 선발을 덮어씀
5. **4월 game-records 없음**: 서버 pipeline이 5월에 추가되어 4월 경기 game-records 미존재

### 수정 내역

| # | 파일 | 변경 |
|---|------|------|
| 1 | `mobile/lib/gameCache.ts` | `fetchWithCache` — API 실패 시에도 `scheduleRetry` 호출 |
| 2 | `mobile/lib/prefetch.ts` | `prefetchOnboardingData()` — `try/finally`로 dedup promise cleanup |
| 3 | `mobile/app/(tabs)/home.tsx` | AppState 리스너에 `prefetchOnAppInit()` 추가 |
| 4 | `mobile/app/game/[id].tsx` | 3초 background 재시도로 점수 fallback→full detail 전환 |
| 5 | `server/data_api/main.py` | `lineup.json` fallback에서 `??`/`미정` placeholder 필터 |
| 6 | `server/data_api/main.py` | `/onboarding-data` 연도 필터 로컬 동기화 |
| 7 | 서버 명령 | `build_game_records.py --recent 60 --skip-existing` (4/3~5/12 전구간) |
| 8 | 서버 명령 | `build_game_records.py --recent 95 --skip-existing` (3/12~3/31 시범경기+개막전 포함) |

### game-records 보유 현황 (2026 시즌)

| 구간 | 내용 | 상태 |
|------|------|:----:|
| 3/12~3/24 | 시범경기 | ✅ |
| 3/28~3/29 | 개막 2연전 | ✅ |
| 3/31 | 정규시즌 | ✅ |
| 4/3~5/12 | 재수집 구간 (파이프라인 도입 전) | ✅ |
| 5/13~현재 | 파이프라인 자동 수집 | ✅ |

※ `build_game_records.py --recent 10` 파이프라인이 5월에 추가되어 그 이전 경기는 수동 재수집 필요.

### 영향도

서버 데이터만으로 해결 (빌드 불필요):
- `??` 선발투수 → lineup.json placeholder 필터
- 경기상세 점수만 뜸 → game-records 전 구간 보유
- 온보딩 응답 크기 → 연도 필터로 1MB→200KB

앱 변경사항 (EAS 빌드 필요, 이중 안전장치):
- AppState 프리페치, dedup 누수 수정, 3초 자동 재시도, 백그라운드 재시도

### 커밋

| 해시 | 설명 |
|------|------|
| `94d6ea7` | `fix: 경기상세 점수만 뜨는 현상 — API 실패 시 백그라운드 재시도 + 3초 자동 복구` |
| `f17123a` | `fix: AppState 포그라운드 복귀 시 prefetch 자동 실행 + dedup promise 리셋 누락 수정` |
| `81a1500` | `fix: 서버 선발투수 ?? 버그 + 온보딩 연도 필터 로컬 동기화 + April game-records 재수집` |

---

## Phase 17-8: /refresh-data 엔드포인트 + 서버 상태 점검 (2026-06-01)

### 목적

기존 개별 API 요청을 대체하는 경량 갱신 엔드포인트 `/refresh-data` 구현. 5분 주기 백그라운드 갱신에 최적화된 단일 API로 부하와 데이터 사용량을 줄임.

### 변경 내역

**서버 (`server/data_api/main.py`)**
- `/refresh-data` GET 엔드포인트 신규 추가
- 응답: `todayGames`, `todayScores`, `standings`, `scoreSummary`, `todayGameDetails`
- `todayGameDetails`: 오늘의 각 경기에 대해 `game-records/{date}.json`에서 lineup/scoreBoard/pitchingResult 추출
- 서버 JSON 캐시 TTL 60초→300초로 증가
- collector 실행 직후 JSON 캐시 clear + pre-warm 로직 추가

**공유 타입 (`shared/types.ts`)**
- `RefreshData` 인터페이스 정의

**공유 API (`shared/api.ts`)**
- `fetchRefreshData()` 추가

**앱 (`mobile/lib/api.ts`)**
- `fetchRefreshData` re-export

**앱 (`mobile/lib/prefetch.ts`)**
- `fetchRefreshDataAndCache()`: `/refresh-data` 응답을 5개 SQLite 캐시 키(today, scores, standings, score-summary, game)에 쓰기
- `prefetchOnAppInit()`: fallback 체인 구성 — `/refresh-data` → `/onboarding-data` → 개별 API

### 데이터 흐름

```
prefetchOnAppInit()
  → fetchRefreshDataAndCache()          (1 API call, ~20KB)
    → 실패 시 fetchOnboardingWithCache() (1 API call, ~200KB)
      → 실패 시 개별 API 호출           (5+ API calls)
```

### 응답 크기

- game-detail 미포함: ~5KB
- game-detail 포함 (5경기 기준): ~20KB
- game-detail 내 lineup/scoreBoard/pitchingResult만 포함 (전체 game-detail 응답보다 70% 경량)

### 서버 상태

| 항목 | 값 |
|------|:----:|
| OCPU | 2 (원래 1 → OCI 무료 업그레이드로 2OCPU/12GB) |
| RAM | 12 GB |
| 평균 CPU | 0.3~0.5% (near-idle) |
| 평균 메모리 | ~13% |
| 디스크 | 47.6G / 200G 사용 |
| 동시접속 추정 | active ~1,000 / background refresh ~10,000 |
| Workers | uvicorn single worker (추가 시 collector 분리 필요) |

### 예상 부하

- 5분 주기 = 12회/시간 × 사용자 수
- 1,000 DAU 기준: 12,000 req/h = 3.3 req/s
- `/refresh-data` 단일 엔드포인트가 개별 API 5~6회 대체
- 서버 JSON 캐시(300s TTL)로 동시 요청 중복 방지

### OCI 업그레이드 히스토리

| 단계 | 상태 | 비고 |
|------|:----:|------|
| 1→2 OCPU (A1.Flex) | ✅ 완료 | OCI 항상 무료 범위 내 |
| 2→4 OCPU | ⛔ 대기 중 | Chuncheon region Out of capacity, 50분 간격 자동 재시도 |
| 스크립트 위치 | `server/upgrade_oci.sh` | @reboot cron + PATH fix 완료 (`oci: command not found` → `export PATH`) |

### 커밋

| 해시 | 설명 |
|------|------|
| `4ef8419` | `feat: /refresh-data 경량 갱신 엔드포인트 — 앱 fallback 체인 + SQLite cache 갱신` |
| `d97af79` | `feat: /refresh-data에 game-detail(lineup/scoreBoard/pitchingResult) 포함` |
| `cd62eb8` | `docs: /refresh-data 작업 문서 업데이트` |
| `a2a8e17` | `chore: server-scripts — OCI upgrade 스크립트 PATH fix` |

---

## Phase 17-9: 서버 복구 플랜 수립 + 백업 체계 (2026-06-01)

### 작업 내역

**4 OCPU 업그레이드 중단**
- `@reboot cron` 제거, 실행 중이던 `upgrade_oci.sh` 종료
- 이유: 4 OCPU 회수 위험 증가 (24시간 평균 0.3~0.5% 사용량)

**서버 설정 문서화** (`mobile/server-setup.md`)
- systemd 서비스, nginx, 디렉토리 구조, 배포 방식 정리
- Python 패키지 목록 (fastapi 0.128.8, uvicorn 0.39.0 등 25개)
- SSL 인증서 (api.fullcount.kr, 만료 2026-08-10, acme.sh 자동 갱신)

**복구 플랜 수립** (`mobile/disaster-recovery-plan.md`)
- 단계별 복구 절차 (OCI 재생성 → 유료 클라우드 이전 → 최악의 시나리오)
- 사전 준비 체크리스트 (데이터, nginx설정, SSL, main.py, collector.py)

**로컬 백업 체계**
- 백업 경로: `server-backup/YYYY-MM-DD/data/` (JSON 196MB)
- nginx 설정 + SSL 인증서/개인키 별도 백업
- CLAUDE.md 규칙에 추가 (대화 시작 시 사용자 확인 후 실행)
- 하루 1회 중복 방지

**백업 파일**
```
server-backup/2026-06-01/
├── data/              # JSON 데이터 전체
├── main.py            # 서빙 중인 API 코드
├── collector.py       # 데이터 수집기
└── nginx-config/
    ├── api.conf       # nginx reverse proxy
    ├── api.fullcount.kr.cer
    └── api.fullcount.kr.key
```

### 새 문서 목록

| 문서 | 설명 |
|:-----|:-----|
| `mobile/server-setup.md` | 서버 설정 문서 |
| `mobile/disaster-recovery-plan.md` | 장애 복구 플랜 |

### CLAUDE.md 변경
- Server: `mobile/server-setup.md` 참고 규칙 추가
- Daily backup: 대화 시작 시 사용자 확인 후 실행 (하루 1회)

---

## Phase 18: iOS App Store 최초 배포 + 버그픽스 (2026-06-01~02)

> **버전**: iOS 1.0.0 (별도 트랙), Android 1.0.11 (versionCode 13)
> **iOS 상태**: 심사 제출 완료 ("심사 대기 중"), 수동 출시 설정
> **Android 상태**: AAB 빌드 큐 대기 중

### iOS App Store 배포 (최초)

**Apple Developer 설정:**
- App ID: `kr.fullcount.app` — Identifiers에 등록 (user가 직접)
- EAS Build가 Distribution Certificate + Provisioning Profile 자동 생성
- App Store Connect 앱 생성: "Fullcount" (이름 충돌로 "Fullcount" 사용 가능)

**App Store Connect 메타데이터 설정:**
| 항목 | 값 |
|------|-----|
| 설명 | "풀카운트와 함께하는 KBO 야구 직관 · 집관 기록 앱" |
| 키워드 | KBO, 야구, 직관, 풀카운트, 한국프로야구 |
| 개인정보 보호정책 URL | `https://api.fullcount.kr/privacy` |
| 연령 등급 | 4+ |
| 가격 | 무료 |
| 수집 데이터 | 연락처 정보/식별자/사용자 콘텐츠/구매 내역/검색 기록/진단 (총 6종) |
| 저작권 | "(c) 2026 fullcount.kr" |
| iPad 스크린샷 | 2048×2732 (1/4 상단, 3/4 하단 크롭) |

**앱 설정:**
- `ITSAppUsesNonExemptEncryption`: `false` (암호화 없음, 앱스토어 심사 필수)
- `app.json` version: iOS 1.0.0 / Android 1.0.11

**iOS 빌드 및 제출:**
- `npx eas build --platform ios --profile production --non-interactive` → Distribution Certificate 검증 실패
- 사용자가 직접 `npx eas build --platform ios --profile production` 실행 (interactive) → 성공
- `npx eas submit --platform ios --profile production` → App Store Connect 업로드 완료
- `PowerShell ExecutionPolicy` 이슈: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` 필요

**iPad 스크린샷 리사이즈 파이썬 스크립트:**
- `resize_ipad.py` — iPad 실기기 캡쳐(1488×2266) → 2048×2732 스케일 후 크롭
  - 크롭 비율: 상단 1/4, 하단 3/4 제거 (사용자 피드백 반영)
  - `scale = max(TARGET_W/w, TARGET_H/h)` → center crop with offset

| 파일 | 설명 |
|------|------|
| `C:\Users\user\Pictures\appstore\resize_ipad.py` | iPad 스크린샷 2048×2732 크롭 |
| `C:\Users\user\Pictures\appstore\make_ipad.py` | (시도) 흰색 캔버스 중앙 배치 → 실기기 사진으로 대체 |

**버전 분리 결정:**
- iOS: 1.0.0부터 별도 트랙 (앱스토어 첫 출시)
- Android: 기존 1.0.11 유지 (Play Store 이미 출시)
- `app.json`에서 빌드 시에만 각 플랫폼 버전 수동 변경
- memory: `ios-android-version-separate.md`, `ios-deploy-process.md` 문서화

### 버그 수정: 스티커 만료 시간

**파일:** `mobile/app/game/[id].tsx:618-620`
**변경:** `new Date().getHours() < 24` → `< 14`
**설명:** 스티커 생성 다음날 14시(오후 2시)까지 생성 가능, 14시 이후 만료

### 리팩터링: filterByGameType 순환 의존성 해결

**문제:** `lib/stats.ts` ↔ `lib/expenseStats.ts` 간 `filterByGameType`/`resolveIsWin` 순환 import

**해결:** `lib/gameTypeFilter.ts` 신규 생성 (공유 함수 추출)

| 파일 | 변경 |
|------|------|
| `lib/gameTypeFilter.ts` | 신규: `filterByGameType()` 추출 |
| `lib/stats.ts` | `filterByGameType` 제거, `@/lib/gameTypeFilter` import |
| `lib/expenseStats.ts` | `@/lib/stats` → `@/lib/gameTypeFilter` import 변경 |
| `lib/__tests__/stats.test.ts` | import 분리 (`@/lib/stats` + `@/lib/gameTypeFilter`) |

- 검증: `npx jest` → 46개 테스트 전부 통과 ✅
- `npx expo start --clear`로 Metro 캐시 초기화 필요 (중복 선언 에러 방지)

### Android 빌드
- `app.json` 변경: `version: "1.0.11"`, `versionCode: 13`
- `npx eas build --platform android --profile production` 실행 (큐 대기 중)

### iOS 배포 프로세스 문서화
- `memory/ios-deploy-process.md` — 전체 단계별 가이드 (Apple ID, 버전 관리, 명령어)
- `memory/ios-android-version-separate.md` — iOS/Android 버전 분리 결정 및 이유

### 스티커 코치멘트 2종 추가 (홈 → 경기상세 연결)

**날짜:** 2026-06-02

**문제:**
- today-back 코치(1회성)를 이미 본 사용자에게 스티커 활성화 시점에 다시 알릴 방법이 없음
- 경기 시작 전(14시~경기시작), 취소, 월요일 등 스티커 불가 구간에서 "일기를 적어보세요"로 대체했지만, 스티커 가능해졌을 때 안내 부재
- 24시 이후 어제 경기(다음날 14시 전까지 스티커 유효)에서도 코치 필요

**해결:**
1. **홈 스티커 코치** (`showHomeStickerCoach`): today-back 코치를 이미 본 상태에서, 현재 보고 있는 날짜(`selectedDate`)의 게임 중 `finished`/`live`가 있으면 발동
   - `selectedDate` 기준이므로 오늘뿐 아니라 어제(14시 전) 페이지에서도 정상 작동
   - 메시지: "카드를 눌러 경기 스티커를 생성해보세요"
   - 저장소 키: `has_seen_home_sticker_coach`
2. **경기상세 스티커 코치** (`showDetailStickerCoach`): 홈 코치에서 카드 탭 시 `&sc=1` 파라미터로 전달받아 발동
   - 메시지: "스티커는 경기시작부터 다음날 14시까지 만들 수 있어요"
   - 저장소 키: `has_seen_detail_sticker_coach`
3. **레이스 컨디션 방어:** `todayBackChecked.current && !showTodayBackCoach` 가드로 today-back 코치 인플라이트 감지

**변경 파일:**
| 파일 | 변경 |
|------|------|
| `mobile/lib/db/settings.ts` | get/setHomeStickerCoachSeen, get/setDetailStickerCoachSeen 추가 (4함수) |
| `mobile/lib/db/index.ts` | 4개 함수 barrel export 추가 |
| `mobile/app/(tabs)/home.tsx` | state/refs/effect/render + onClick `sc=1` 파라미터 + scroll dismiss |
| `mobile/app/game/[id].tsx` | `sc` 파라미터, state, effect 2개, dismiss, render 추가 |

**커밋:** `00c55c1`

### 장시간 사용 후 ImagePicker/Sharing 실패 복구

**날짜:** 2026-06-02

**문제:**
- 장시간 앱을 백그라운드에 두면 Android가 Activity를 파괴함
- Expo 네이티브 모듈(expo-image-picker, expo-sharing)이 stale Activity 참조를 들고 있어 `launchImageLibraryAsync` / `shareAsync` 자체가 실패
- `getPendingResultAsync`는 picker가 실제 실행된 적 있어야만 복구 가능 → 이 케이스에서는 무용지물
- (DEVELOPMENT_LOG.md:1390에 이미 문서화된 미해결 이슈)

**해결: 3중 방어 패턴**
1. **AppState foreground 복구:** `AppState.addEventListener("change")`로 포그라운드 복귀 시 `getPendingResultAsync()` 선제 호출
2. **300ms retry:** 1차 실패 시 300ms 지연 후 2차 시도 (Android가 새 Activity 참조를 정리할 시간)
3. **fallback:** 2차도 실패 시 `getPendingResultAsync()` 최종 확인 → 그래도 없으면 오류 Alert

**변경 파일:**
| 파일 | 변경 |
|------|------|
| `mobile/components/diary/useDiaryForm.ts` | AppState 리스너 + 300ms retry + getPendingResultAsync 3중 방어 |
| `mobile/components/CollectionModal.tsx` | 동일 패턴 적용, handleAddPhotoResult 분리, 오류 Alert 추가 |
| `mobile/components/DiaryTimeline.tsx` | Sharing.shareAsync try/catch + Alert 추가 |

**전체 감사 결과:**
- ImagePicker 2곳 → 둘 다 복구 완료
- Sharing 2곳 → 둘 다 try/catch 완료
- ImageManipulator, WebView, Linking → Activity 사용 안 함 (안전)

**커밋:** `eb78fa3`

### 스티커 해시태그 알고리즘 수정 + 1회초 초기 스코어보드 + UI 개선

**날짜:** 2026-06-02

#### 1. 스티커 해시태그 알고리즘 수정

**문제:**
- 연패 중인 팀의 라이브 경기에서 "2연승가자!"가 출력됨
- *원인:* `computeTeamStreak`가 `allScores` 전체를 순회하며 오늘 라이브 경기의 임시 스코어(앞서고 있는 상태)까지 과거 전적에 포함 → streak type이 L→W로 뒤바뀜
- `isHome: true` 하드코딩으로 원정팀 직관 시 `홈승리`로 잘못 표시

**해결:**
- `computeTeamStreak`에 `beforeDate` 파라미터 추가 → 라이브 경기 시 오늘 날짜 이후 스코어 제외
- `isHome: true` → `isTargetHome`
- fallback myTag: `야구장`/`집관` → `승요기원`
- 집관 모드에서 지도핀/venue 숨김 처리

**변경 파일:**
| 파일 | 변경 |
|------|------|
| `mobile/lib/sticker.ts` | computeTeamStreak `beforeDate` 파라미터 + 루프 필터 |
| `mobile/components/StickerModal.tsx` | isHome 수정, isLive?date 전달, fallback myTag 변경 |
| `mobile/components/StickerContent.tsx` | 집관 모드 지도핀/venue 숨김, 승리팀 🏆 표시, 배지 🔥 |

#### 2. 1회초 초기 스코어보드 표시

**문제:** 경기 시작 후 1회초에 득점이 없으면 `getInningInfo`가 `null` 반환 → `liveLabel`이 "경기 중", 스코어보드 미표시, 스티커 라이브 스코어 조정 UI 비활성화

**해결:** 경기 시작 후(isLive) 득점 전에도 합성 초기값 `{ away: [0], home: [] }`을 주입하여 모든 스코어보드 UI 활성화

**변경 파일:**
| 파일 | 변경 |
|------|------|
| `mobile/app/game/[id].tsx` | inningInfo/innData/rheb/StickerModal prop — isLive 시 합성 fallback |
| `mobile/app/(tabs)/home.tsx` | getInningInfo null 시 `{ inning: 1, isTop: true }` fallback |

**커밋:** `92b5fc6`

---

## Phase 19: v1.0.13 — 경기 시간 표기 알고리즘 전면 개선 (2026-06-03~04)

> **버전**: 1.0.13 (iOS / Android 통합)
> **iOS 상태**: 1.0.12 심사 제출 완료 ("심사 대기 중")
> **Android 상태**: 1.0.13 Play Store 출시 노트 — "경기 시간 정확도 개선, 데이터 불일치 수정"

### 홈탭-경기상세 데이터 불일치 — 클라이언트 이중 방어

**날짜:** 2026-06-03

**문제:** 홈탭과 경기상세 화면의 게임 데이터가 불일치 (서로 다른 fetch 결과 사용)

**해결: 클라이언트 이중 방어**
1. **경기상세에서 홈탭 데이터 우선:** `[id].tsx:168-175` — game detail API 호출 전 홈탭의 `todayGames` 데이터를 `scheduleTimeRef`에 저장
2. **상태 동기화:** 홈탭에서 받은 `status`/`outcome`/`score`를 경기상세에 전달하여 갱신 전에도 일관된 상태 표시
3. **fallback 체인:** `detail.gameInfo?.time || scheduleTimeRef.current || "18:30"`

**커밋:** `9949cb6`

### 경기 시간 표기 오류 전면 수정

**날짜:** 2026-06-03~04

**버그 현상:**
- 내일(6/5) 경기: 17:00으로 표시 (실제 18:30)
- 토요일(6/6) KT-SSG: 18:30으로 표시 (실제 14:00)
- 어제(6/3) 경기: 18:30으로 표시 (실제 경기 시간 무시)
- 캐시 삭제 후 모든 카드 18:30

**근본 원인 분석 (데이터 흐름 4단계):**
```
KBO API → collector.py (DB) → build_today_games.py (today-games.json) 
  → main.py API → 앱 resolveGames.ts
```
1. **collector.py `patch_today_games_times()`가 `nextGames` 시간 오염:** DB games.time은 활성 시간대(경기시간-2h~+4h)에만 갱신되어 내일 경기는 stale 값. 그런데 `patch_today_games_times()`가 `nextGames`까지 DB 값으로 덮어써서 Naver의 정확한 시간을 파괴
2. **`build_today_games.py` 1일치 only:** `nextGames`를 1일만 생성 → 모레 이후 날짜는 schedule JSON의 "18:30"(placeholder) 폴백
3. **`_build_game_detail()` `nextGames` 미검색:** today-games.json의 `games[]`만 검색하고 `nextGames[]`는 검색 안 함 → 내일 이후 경기는 항상 daily-scores.json(시간 필드 없음) 폴백 → 18:30

**수정 내역 (전량 서버 측):**

| 파일 | 수정 | 위치 |
|------|------|------|
| `build_today_games.py` (서버, repo 외) | nextGames 1일 → **7일** 확장 + Naver `schedule_games().gameDateTime` 7일치 오버레이 | `build_games()` |
| `collector.py` (서버, repo 외) | `patch_today_games_times()` nextGames 패치 제거, `update_game_time()` 항상 호출 | Fix 8, 9 |
| `server/data_api/main.py` | `_build_game_detail()` nextGames 검색 추가 (line 604), `_get_db_game_time()` DB fallback, `_enrich_schedule_times()` schedule 보강 + 날짜포맷 보정 | Fix 10, 11 |

**변경 (repo 내 `main.py`):**
```python
# Fix 10: _build_game_detail() — nextGames 검색
for g in today.get("games", []) + today.get("nextGames", []):  # + nextGames 추가

# Fix 10: _get_db_game_time() — DB 시간 fallback 헬퍼
def _get_db_game_time(game_id: str) -> Optional[str]:
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT time::text FROM games WHERE id = :gid"),
                {"gid": game_id}
            ).fetchone()
            if row and row[0]:
                return row[0].strip()
    except Exception:
        pass
    return None

# Fix 11: _enrich_schedule_times() — schedule 보강
# today-games.json의 시간으로 schedule JSON 덮어쓰기
key = (tg_date.replace("-", ""), away.get("name", ""), home.get("name", ""))  # 날짜포맷 보정
```

**검증 결과:**
- 토요일 6/6: KT-SSG **14:00** ✅, 나머지 **17:00** ✅
- 일요일 6/7: 전경기 **17:00** ✅
- 평일: 전경기 **18:30** ✅
- game-detail 엔드포인트: `20260606-KTSK-0` → `"14:00"` ✅

**앱 빌드 불필요:** 전량 서버 변경. 캐시 새로고침으로 적용.

**한계:** 7일 이후 경기는 schedule JSON의 "18:30" (placeholder) 그대로 사용. 완전 해결은 서버 `build_today_games.py`를 7일 이상으로 확장하거나 KBO 스케줄 크롤링 필요.

**커밋:** `5eeae24`, `d781a75`

## Phase 19.5: CoachMark 확장 및 버그픽스 (2026-06-04~05)

> **관련 커밋:** `120e6a6`, `5ce3cfe`, `965de7f`

### 신규 코치멘트 8종 추가

**날짜:** 2026-06-04

**추가된 코치멘트:**

| 화면 | 방문 | 대상 | 상태 |
|------|------|------|------|
| Cheer | visit 1 | TeamExpander (헤더 우측) | ✅ 유지 |
| Rank | visit 2+ | YearSelector (연도 변경) | ✅ 유지 |
| Home | visit 2 | Calendar 토글 | ✅ 유지 |
| Home | visit 3 | Achievement 토글 | ❌ 제거 (사용자 요청) |
| My | visit 2+ | 프로필 설정 | ❌ 제거 (사용자 요청) |
| Diary | visit 2 | 지출 탭 (캘린더/통계) | ✅ 유지 |
| Diary | visit 3 | ViewMode 토글 (타임라인) | ✅ 유지 |
| Diary | visit 4 | 검색 (타임라인) | ✅ 유지 |

**인프라:** SQLite `user_settings`에 `visit_count` 추적, `has_seen_*` 16개 함수 추가.

### 발견된 버그 4종 및 수정

**날짜:** 2026-06-04~05

1. **Home — 스와이프 + 캘린더 코치멘트 중복 표시**
   - 원인: `InteractionManager.runAfterInteractions`와 동기 useEffect 가드 간 race condition. async `.then()` 콜백에서 `showCoachMark` 재확인 누락.
   - 수정: `showCoachMarkRef` 미러링 ref + `.then()` 내 재확인 + `homeDeepCoachPending` pending ref + JSX 우선순위 게이트

2. **Cheer — TeamExpander 코치멘트가 "야구 규칙" 탭 아래 표시**
   - 원인: CoachMark JSX가 tabRow 뒤에 위치
   - 수정: CoachMark 블록을 header와 tabRow 사이로 이동

3. **Rank — YearSelector 코치멘트 위치 오류**
   - 원인: CoachMark가 header View 바깥에 배치, subtitle과의 간격 과다
   - 수정: header View 내부 subtitle 아래로 이동

4. **Diary — 지출 코치멘트 미표시**
   - 원인: 하나의 one-shot ref가 3개 코치멘트를 모두 게이트. 기본 탭 "timeline"에서 ref 소진 후 calendar/stats 전환해도 재진입 불가
   - 수정: Expense용 ref + timeline용 ref 분리, 효과 1→2개로 분할

### Rank 탭 UI 개선
- 테이블 폰트 0.5step 업 (13→13.5, 12→12.5)
- 1/2/3등 rank 숫자 금은동 색상 적용 (Gold/Silver/Bronze)

### 제거된 코치멘트 (사용자 요청)
- Home 도전과제 코치멘트
- My 프로필 설정 코치멘트
- 관련 DB 함수 4개 및 import 정리

---

## Phase 17-7: 바로가기 시스템 개선 및 스티커 시간 제한 알림 (2026-06-05)

### ShortcutButton UI 개선
- idle 상태 ⚡ 원형 아이콘 → ⚡ + "바로가기 만들기" 텍스트 버튼으로 변경
- "사용 안 함" 선택 시 버튼 완전히 숨김 (`return null`)
- `getShortcut()`이 `null` 반환하여 "미설정"과 "사용 안 함" 구분
  - `null` = 미설정 → 설정 유도 버튼 표시
  - `""` = 사용 안 함 → 버튼 숨김
  - 그 외 = 활성화 → 아이콘 + 라벨 표시

### 스티커 시간 제한 알림 (sc=1)
- `sc=1` 진입 시 스티커 생성 가능 시간 체크
- 가능 → StickerModal 자동 오픈 (기존 유지)
- 불가 → SimpleAlert: "스티커는 경기 시작부터 다음날 14시까지 만들 수 있어요"

### 버그 수정
- `findMyTeamGame`에서 취소 경기(`cancelled`) 건너뛰도록 수정
- `executeShortcut`에 `try/catch` 추가 (unhandled rejection 방지)
- `ShortcutButton` SHORTCUT_ICONS/LABELS에 `??` fallback 추가

### 변경 파일
| 파일 | 변경 |
|---|---|
| `mobile/lib/db/settings.ts` | `getShortcut()` null 반환 |
| `mobile/components/ShortcutButton.tsx` | 3-way 렌더링 + fallback |
| `mobile/components/ShortcutPickerModal.tsx` | ShortcutType \| null 타입 |
| `mobile/app/(tabs)/home.tsx` | 상태 타입, auto-set 조건, try/catch |
| `mobile/app/(tabs)/my.tsx` | 상태 타입, 표시 로직 |
| `mobile/app/(tabs)/diary.tsx` | Route params 탭 이동 |
| `mobile/app/game/[id].tsx` | sc=1 스티커 시간 체크 + SimpleAlert |
| `mobile/lib/shortcutHelper.ts` | cancelled 경기 필터링 |

---

## Phase 17-8: 키보드 대응 통일 및 스티커 바로가기 버그 수정 (2026-06-07)

### 키보드 대응 통일
- `lib/hooks/useKeyboardHeight.ts` 신규 생성 (10줄 중복 리스너 공통화)
- **StickerModal**: 해시태그 입력 시 키보드 가림 현상 해결
  - `useKeyboardHeight()` + `contentContainerStyle paddingBottom` + `keyboardDismissMode="interactive"`
  - `BottomSheet`에 `fillHeight` prop 추가 (Yoga maxHeight 스크롤뷰 바운딩 문제 해결)
  - `useWindowDimensions()`로 Android resize 모드 대응
  - 해시태그 onFocus 시 `scrollTo` 자동 스크롤
  - 미리보기 ScrollView 외부 고정, 여백 최소화 (previewArea paddingVertical: 8, header paddingVertical: 5)
- **diary.tsx**: 검색바 키보드 대응 (`useKeyboardHeight`, iOS만 marginBottom)
- **CollectionModal / my.tsx**: KAV에 `keyboardVerticalOffset` 추가 (safe area 기반)
- **useDiaryForm.ts / ExpenseModal.tsx**: inline 키보드 리스너 → `useKeyboardHeight()` 훅으로 교체
- **app.json**: `softwareKeyboardLayoutMode: "resize"` 명시

### usePressOnce 훅
- `lib/hooks/usePressOnce.ts` 신규 생성 — cooldown 500ms 내 중복 실행 방지
- StickerModal: handleClose, handleCopyClipboard, handleShare에 적용

### 스티커 바로가기 자정 이후 버그 수정
- **원인**: `findRecentMyTeamGame`의 `isStarted` 판단이 `score != null`을 fallback으로 사용
  - `ScoreEntry.homeScore`가 `number` 타입이라 `0 != null`이 항상 `true` → 시작 전 오늘 경기를 "시작됨"으로 오판
  - API의 `g.status = "scheduled"`가 있어도 `|| score != null`이 덮어씀
- **수정**: 시간 기반 추론으로 전환
  - `g.status`가 "finished"/"live" → 즉시 시작됨
  - 그 외 → 오늘 경기면 `now >= gameTime` 확인, 과거 경기면 `score != null` fallback
  - `g.time`은 서버 스케줄에서 매번 업데이트되므로 정확

### 빌드
- iOS: v1.0.15 (versionCode 16)
- Android: v1.0.15 (versionCode 17), AAB 출시 준비 완료

### 변경 파일
| 파일 | 변경 |
|---|---|
| `mobile/lib/hooks/useKeyboardHeight.ts` | **신규** — 키보드 높이 리스너 공통 훅 |
| `mobile/lib/hooks/usePressOnce.ts` | **신규** — 중복 터치 방지 훅 |
| `mobile/components/StickerModal.tsx` | 키보드 대응, 미리보기 고정, usePressOnce |
| `mobile/components/BottomSheet.tsx` | fillHeight prop, useWindowDimensions |
| `mobile/app/(tabs)/diary.tsx` | 검색바 키보드 대응 |
| `mobile/components/CollectionModal.tsx` | KAV keyboardVerticalOffset |
| `mobile/app/(tabs)/my.tsx` | KAV keyboardVerticalOffset (2곳) |
| `mobile/components/diary/useDiaryForm.ts` | useKeyboardHeight 적용 |
| `mobile/components/ExpenseModal.tsx` | useKeyboardHeight 적용 |
| `mobile/app.json` | softwareKeyboardLayoutMode 명시, versionCode 17 |
| `mobile/lib/shortcutHelper.ts` | isStarted 시간 기반 추론 수정 |

---

## Phase 17-9: 초기 진입 버벅임 완화 + ScrollView 중첩 수정 (2026-06-07)

### 스키마 버전 체크로 warm start 최적화
- **`connection.ts`**: `SCHEMA_VERSION=1` 상수 추가
  - DB `user_settings`에 저장된 `schema_version` 확인 후 일치 시 4개 `PRAGMA table_info()` 마이그레이션 + 30일 캐시 정리 모두 skip
  - 첫 실행에만 마이그레이션 실행 후 `schema_version` 저장
  - 2회차 이후 initSchema 블로킹 시간 약 50% 감소

### SplashScreen 제어로 초기화 중 버벅임 차단
- `expo-splash-screen` 설치
- **`_layout.tsx`**: `SplashScreen.preventAutoHideAsync()` 모듈 최상단 호출
- `RootLayoutInner`에서 `useEffect` + `InteractionManager.runAfterInteractions`로 첫 렌더링 + 동기 DB 작업 완료 후 `SplashScreen.hideAsync()`
- 이전: 스플래시 사라진 후 UI 멈춤 노출 → 이후: 스플래시 유지 → 준비되면 전환

### DiaryStats 수평 ScrollView 중첩 문제
- **원인**: `diary.tsx`의 외부 `pagingEnabled` ScrollView가 가로 제스처를 가로채 내부 토템/구장 ScrollView가 동작하지 않음
- **수정**: `DiaryStats.tsx`의 토템 승률 + 방문 구장 ScrollView에 `nestedScrollEnabled` 추가
- 5개 이상 토템 설정 시 5번째부터 잘리던 문제 해결

### 기타
- 직관 기록 최소조건 변경: 사진/일기 필수 → 감정표현 선택으로 (`useDiaryForm.ts`)
- iOS NSURLCache 문제 해결: `shared/api-client.ts`에 `cache: "no-store"` 적용
- 경기 시간 18:30 폴백 근본 수정: 서버 `main.py`에서 game-records JSON을 게임 시간 출처로 통일
- TOTEM-DEBUG 로그 제거 (`my.tsx`)

### 버전
- v1.1.0 (iOS), versionCode 18 (Android)

### 커밋
| 해시 | 설명 |
|------|------|
| `de35fbf` | `fix: 초기 진입 버벅임 완화 — 스키마 버전 체크 + SplashScreen 제어` |
| `5231289` | `fix: DiaryStats 토템/구장 수평 스크롤 nestedScrollEnabled 추가` |

## Phase 17-10: 암표 신고 증빙사진 첨부 — WebView Canvas 이어붙이기 (2026-06-09)

### 증빙사진 이어붙이기 기능
- 기존 TicketReportModal에 사진 첨부 단계(photos step) 추가
- **프로세스**: 구단 선택 → 좌석 조회 → 증빙사진 선택(최대 4장) → 이미지 이어붙이기 → 갤러리 저장

### 기술 구현
- **이미지 합성**: WebView + Canvas HTML에 이미지를 base64 data URL로 전달, 세로로 드로잉 후 `toDataURL()`로 하나의 PNG 추출
- **이미지 처리**: `expo-image-manipulator`로 각 이미지를 1080w PNG로 리사이즈 → `File.base64()`로 base64 변환
- **WebView 메시지**: `ReactNativeWebView.postMessage()`로 합성 결과 수신, `File.write(raw, { encoding: "base64" })`로 캐시 저장
- **갤러리 저장**: `MediaLibrary.requestPermissionsAsync(true)` (writeOnly) + `createAssetAsync()`
- **알림 통일**: 모든 `Alert.alert()` → `SimpleAlert` 네이티브 스타일 컴포넌트로 교체
- **해결한 버그**: data URL `data:image/png;base64,` 프리픽스 누락으로 WebView 이미지 로딩 실패, MediaLibrary AUDIO 권한 에러

### 의존성
- `expo-media-library` 추가 (갤러리 저장)

### 버전
- v1.1.1 (변경 없음)

### 커밋
| 해시 | 설명 |
|------|------|
| `6d4f6ae` | `feat: 증빙사진 첨부 — WebView Canvas 이미지 이어붙이기 + 갤러리 저장` |
| `ca831d9` | `fix: iOS File.write encoding 미지원 — atob→Uint8Array 변환` |

### iOS File.write 호환성 수정
- **원인**: `expo-file-system` v19 iOS에서 `File.write(content, { encoding: "base64" })`가 encoding 파라미터를 지원하지 않아 `InvalidArgsNumberException` 발생
- **수정**: `atob()`로 base64 디코딩 후 `Uint8Array`로 변환 → `outFile.write(bytes)` 호출 (TypedArray overload 사용)
- Swift 구현체: `func write(_ content: TypedArray)` — `Data(bytes: content.rawPointer, count: content.byteLength).write(to: url)`

---

## Phase 17-11: 암표 신고 시스템 문서화 + 스티커 바로가기 버그 수정 (2026-06-09~10)

### 암표 신고 시스템 문서화
- `docs/ticket-report-system.md` 신규 작성
- 배경/기획 의도, 데이터 수집 과정, 3단계 UI 프로세스, WebView Canvas 합성 기술 구현, iOS 호환성 이슈, 앱 분리 시 고려사항 포함
- 다른 에이전트와 협업 시 전체 맥락 전달용

### 스티커 바로가기 버그 수정
**파일:** `mobile/lib/shortcutHelper.ts`

**버그:** 경기상세에서 스티커 생성은 가능하지만, 바로가기(ShortcutButton → "스티커 만들기")에서는 `findRecentMyTeamGame()`이 게임을 찾지 못함.

**원인 3가지:**

| 문제 | 설명 |
|------|------|
| `isStarted` 조건 누락 | `score.awayScore > 0 \|\| score.homeScore > 0`만 체크 → 0-0 라이브 경기 감지 불가 |
| `if (!scores.length) return null` | dailyScores API에 아직 데이터 없으면 바로 포기. 경기상세는 game-detail API(다른 파이프라인)라 영향 없음 |
| `gi` = 배열 인덱스 | `dayGames` 배열 인덱스를 gameId suffix로 사용 → DH convention(0/1/2)과 불일치 |

**수정:**
1. **시간 기반 fallback** `hasGameTimePassed(g)` — 경기 시간이 지났으면 started로 간주
2. **조기 return 제거** — scores 없어도 schedule 데이터로 게임 발견 가능
3. **gameId suffix** — `g.gameIdx ?? "0"` 사용, DH convention 준수

**검증:** `npx tsc --noEmit` — 에러 0 ✅

**커밋:**
| 해시 | 설명 |
|------|------|
| `e37b8d6` | `fix: 스티커 바로가기 — isStarted 시간 기반 fallback + early return 제거 + gameIdx suffix` |

---

## Phase 17-12: 감정표현 번들 + Android 크래시 수정 (2026-06-10)

### 감정표현 이미지 70장 앱 번들 포함
- `assets/team-characters/`에 70개 PNG (10구단 × 7기본 감정) 저장 (~4MB)
- `lib/characterAssets.ts` 자동 생성 — `require()`로 로컬 이미지 매핑
- `TeamBadge.tsx` 수정:
  - 기본 감정(7종) → 로컬 이미지 우선 로딩 (`LOCAL_CHARACTERS[{teamId}_{emotion}]`)
  - 비기본 감정(27종 확장) → 기존 네트워크 URL 로딩 유지
  - 이미지 폴백 재시도: 3회 제한 제거 → 지수 백오프 (3초~최대30초)
  - `onError`: 로컬 이미지일 땐 undefined (재시도 불필요)

### Android 크래시 수정 (v1.1.2→v1.1.3)
**문제:** Android v1.1.2 실행 즉시 "풀카운트 앱에 버그가 있어 앱을 종료합니다" 크래시

**원인:** `expo-splash-screen ^56.0.10`이 Expo SDK 54와 네이티브 ABI 불일치
- `de35fbf` 커밋에서 `expo-splash-screen`을 `npm install`로 수동 추가 → 최신 버전(56.x) 설치
- 다른 `expo-*` 패키지들은 `npx expo install`로 SDK 54에 맞게 설치됨
- iOS는 네이티브 모듈 바인딩이 Android보다 관대해서 영향 없었음

**수정:**
```
npm install expo-splash-screen  # ^56.0.10 (잘못됨)
→ npx expo install expo-splash-screen  # ~31.0.13 (SDK 54 정식)
```

**교훈:** Expo 패키지는 반드시 `npx expo install`로 설치할 것. `npm install`은 최신 SDK용 버전을 설치함.

### 버전
- v1.1.3 (versionCode 22), Android AAB 빌드 완료
- iOS v1.1.1 (별도 빌드 필요)

### 커밋
| 해시 | 설명 |
|------|------|
| `6e4d3ce` | `feat: 감정표현 이미지 70장 번들 포함 (기본 7종 × 10구단)` |
| `ea3320d` | `fix: TeamBadge 이미지 로드 재시도 무한 지속 (3→max 30s 지수 백오프)` |
| `c42d744` | `chore: bump version 1.1.1 → 1.1.2 (Android versionCode 21)` |
| `9d54daf` | `fix: expo-splash-screen SDK 54 버전 고정 (^56.0.10 → ~31.0.13)` |

---

## Phase 18: v1.1.4~v1.1.5 안드로이드/iOS 안정화 (2026-06-10~11)

### v1.1.4: Google Play 권한 심사 대응
- **문제:** Play Store에서 READ_MEDIA_IMAGES/READ_MEDIA_VIDEO 권한 거절
- **수정:** `app.json` blockedPermissions에 두 권한 추가 + `ImagePicker.requestMediaLibraryPermissionsAsync()` 3곳 삭제
- Android Photo Picker(API 33+)는 권한 불필요

### v1.1.5: 종합 안정화

**스티커 바로가기 버그** (2af82a4)
- findRecentMyTeamGame이 gameIdx 기반 suffix 사용 → resolveGames와 불일치
- gi(배열 인덱스) 기반으로 통일

**코드리뷰 4건 치명적 버그** (463f4ef)
- SplashScreen 데드락: preventAutoHideAsync/hideAsync try/catch + ErrorBoundary hideAsync
- TicketReportModal OOM: Canvas PNG→JPEG(0.8) + WebView onContentProcessDidTerminate
- TeamBadge 재시도: 3회 빠른(3s→6s→12s) + 이후 60s 느린 무한재시도 + 언마운트 clearTimeout
- TicketReportModal 크래시: tierNames?.length, prices?.[selectedTier]

**원격 이미지 403 복구** (9b22453)
- 근본 원인: fullcount.kr(Cloudflare Pages)의 `_redirects /* /index.html 200`이 모든 이미지 요청을 SPA로 라우팅
- 서버: /var/www/static/ 생성 + nginx location /static/ (30일 캐시, CORS) + SELinux httpd_sys_content_t
- 앱: IMAGE_BASE → api.fullcount.kr/static (TeamBadge, stadiumHelpers, CheerContent)

**안드로이드 DB 좀비 현상**
- allowBackup: false 추가 — 앱 삭제 시 Google Drive SQLite 자동복원 차단

**3건 크래시 방어 + 경기종료 감지** (45ed0bd)
- StadiumMapView: iOS WebView onContentProcessDidTerminate → reload
- TicketReportModal: Promise.all → for...of 순차처리 (저사양 iOS 메모리)
- app.json: iOS buildNumber "1" 추가
- game/[id].tsx: hasPitchingOutcome — daily-scores outcome null이어도 투수기록(W/L) 있으면 경기종료

### 빌드
- Android: v1.1.5 (versionCode 24), iOS: v1.1.5 (buildNumber 1)
- AAB: `wQjv-L9v3WyfkZ0cNW3WHkh0ZlglthSpFX9DXv-EweA`
- IPA: `XRJqbPCw3RJn3B8kc--aSnABnMGrrOripqSyV2I8PgI`

### 커밋
| 해시 | 설명 |
|------|------|
| `2af82a4` | `fix: 스티커 바로가기 잘못된 경기 표시` |
| `6b0865f` | `fix: Google Play READ_MEDIA_IMAGES/VIDEO 권한 제거` |
| `463f4ef` | `fix: 코드리뷰 4건 치명적 버그 수정` |
| `9b22453` | `fix: 원격 이미지 403 — IMAGE_BASE 변경 + 서버 정적파일` |
| `45ed0bd` | `fix: 3건 크래시 방어 + 경기종료 감지 강화` |
| `97ba65c` | `chore: bump 1.1.4 → 1.1.5 (versionCode 24)` |
| `5415569` | `fix: TeamBadge 재시도 — 3회 빠른 후 60s 느린 무한재시도` |

## Phase 18-2: outcome 필드 일괄 교정 + build_daily_scores.py 버그 수정 (2026-06-11)

### 문제
2020~2025년 데이터의 outcome(W/L/T) 필드가 약 56% 잘못 기록됨
- 서버 daily-scores.json: **1,823건 오류** (전체 3,253 non-cancelled 중)
- 앱 번들 scores_2021~2025.json: **1,052건 오류**

### 근본 원인

1. **build_daily_scores.py line 48**: `live-results.json`의 팀 상대적 outcome(`W`=해당팀 승리)을 그대로 복사. 첫 번째 팀의 데이터가 dedup 우선 적용되어 50-50 확률로 틀린 값이 저장됨
2. **build_daily_scores.py lines 77-82**: 시범경기 전부 `outcome="W"` (홈 승리 `"L"`이 없음)
3. **build_season.py lines 95-96**: T_SCORE/B_SCORE swap (T=Top=원정, B=Bottom=홈) — 점수 영향 있었으나 game-records 덮어쓰기로 최종 데이터는 정상

### 수정

**서버 build_daily_scores.py 복구 (재발 방지):**
- `compute_outcome()` 함수 추가: 점수 기반 W/L/T 계산
- line 48: `game.get("outcome")` → `compute_outcome(awayScore, homeScore)`
- lines 77-82: 시범경기 `outcome` 통일 — `compute_outcome()`으로 대체
- `update_hub_data.py` 재실행 → 모든 파생 파일 정상 재생성

**서버 daily-scores.json:**
- `recompute_outcomes.py`: 백업본 대상 1,823건 교정
- 수정본 SCP 업로드 + nginx cache TTL 만료 대기 (300초) 후 정상 응답 확인

**앱 번들 (scores_2021~2025.json 5개):**
- 각 파일의 모든 게임 점수 기반 outcome 재계산: 1,052건 교정
- 점수는 변경 없음, outcome 문자열만 수정

### 검증

| 검증 항목 | 결과 |
|-----------|------|
| 서버 전체 3,253 non-cancelled | ✅ 0 wrong (3,253/3,253 correct) |
| 2020-05-05 spot check | ✅ 5/5 correct |
| 2025-05-17 (DH 5경기) | ✅ 10/10 correct |
| Jest tests (stats/expenseStats/sticker) | ✅ 64/64 passed |
| 로컬 번들 5개 파일 전수검사 | ✅ 0 wrong |

### 버전
- (대기 중) v1.1.6 Android 재빌드 후 Play Store 출시 필요

### 커밋
| 해시 | 설명 |
|------|------|
| `d3869a8` | `fix: outcome 필드 일괄 교정 — 2,875건 + build_daily_scores.py 점수 기반 재계산으로 변경` |

---

## Phase 18-3: 경기 상태 "finished" 오표시 + 시간 체계 버그 수정 (2026-06-11)

### 문제
모든 경기(오늘+미래 30경기)가 `"status": "finished"`로 표시됨. 앱에서 경기 시작 전인데 "경기 종료"로 보이는 현상.

### 근본 원인 (2중 버그)

**Bug 1 — compute_outcome(0,0) → "T" (CRITICAL):**
- `d3869a8`에서 추가한 `compute_outcome()`가 pre-game 0-0 점수를 무승부("T")로 계산
- `build_today_games.py`가 `if s.get("outcome"):` → `"finished"`로 판단
- Naver API는 pre-game에 `outcome: null`을 주었는데, 점수 기반 재계산으로 바꾸면서 pre-game과 real tie 구분 불가

**영향받은 코드 (모두 동일 패턴):**
| 위치 | 파일 | 라인 | 영향 |
|------|------|------|------|
| today-games API | `build_today_games.py` | 253 | 모든 경기 "finished" ❌ |
| game-detail API | `main.py` | 729 | 경기 상세 "finished" ❌ |
| score summary | `main.py` | 427, 856 | pre-game 0-0이 통계에 포함되어 평균 왜곡 ⚠️ |

**Bug 2 — 시간 비교가 현재 날짜 기준 (MEDIUM):**
```python
# before
game_start = now_kst.replace(hour=gh, minute=gm)  # 오늘 날짜 기준!
```
미래 경기도 `now_kst.replace()`가 오늘 날짜를 사용하여 항상 과거로 판단 → `"live"`로 표시

### 수정

**build_daily_scores.py (서버 + 로컬 백업):**
- `outcome` 조건을 `winPitcher/losePitcher` 존재 여부로 변경
- Naver API는 경기 종료 시에만 `winPitcher/losePitcher` 채움 → 가장 신뢰할 수 있는 경기 종료 신호
```python
# before
"outcome": None if game.get("cancelled") else compute_outcome(...)
# after
"outcome": None if (
    game.get("cancelled") or
    not (game.get("winPitcher") or game.get("losePitcher"))
) else compute_outcome(...)
```

**build_today_games.py (서버 + 로컬 백업):**
- 시간 비교를 게임 날짜 기준으로 변경
```python
# before
game_start = now_kst.replace(hour=gh, minute=gm, second=0, microsecond=0)
# after
game_start = datetime(int(target_date[:4]), int(target_date[5:7]),
                      int(target_date[8:10]), gh, gm, tzinfo=KST)
```

### 검증

| 항목 | 결과 |
|------|------|
| 오늘 경기 (6/11 5경기) | ✅ `"live"` |
| 미래 경기 (6/12~6/18 25경기) | ✅ `"scheduled"` |
| daily-scores outcome | ✅ `null` (pre-game/live) |
| 이미 종료된 경기 | ✅ `"finished"` 유지 (winPitcher/losePitcher 있음) |
| 0-0 실제 무승부 | ✅ `winPitcher/losePitcher` 있으므로 정상 감지 |

### 영향도
- 서버 데이터 파이프라인만 수정, 앱 코드 변경 없음
- 앱 SQLite 캐시는 5분 TTL 후 자동 갱신
- pre-game 0-0이 score summary에서 제외되어 팀 평균 득점 정확도 향상

### 버전
- v1.1.6 (변경 없음, 서버 데이터만 교체)

### 커밋
| 해시 | 설명 |
|------|------|
| (로컬만) | `fix: build_daily_scores.py outcome pre-game 가드 winPitcher/losePitcher 기반으로 변경` |
| (로컬만) | `fix: build_today_games.py 시간 비교 게임 날짜 기준으로 수정` |

---

## Phase 18-4: 모아보기 모달 UI 통일 + 코드리뷰 정리 (2026-06-11~12)

### 변경 사항

| 항목 | 파일 | 상세 |
|------|------|------|
| **EmotionPicker lockedAlert** | `EmotionPicker.tsx` | `position:absolute` → `<Modal transparent>`로 변경 — 확인 버튼이 컨테이너 바깥으로 잘리던 버그 수정 |
| **직관기록 삭제 후 미갱신** | `db/records.ts` | `deleteJikgwanRecord`에 `invalidateRecordsCache()` 추가 — 삭제 후 UI 즉시 갱신되도록 수정 |
| **TicketReportModal 뒤로가기** | `TicketReportModal.tsx` | 첫 화면(팀 선택 step)에 ✕ 닫기 버튼 추가 |
| **모달 X 버튼 위치 통일** | `AchievementModal`, `CollectionModal`, `YearInReview`, `TicketReportModal`, `my.tsx` | X 버튼을 오른쪽으로 통일 (기존 좌/우 혼재) |
| **모달 닫기 버튼 스타일 통일** | 전 모달 | "닫기" 텍스트 버튼 → ✕ 아이콘으로 일원화 |
| **모달 시트 형태 통일** | `AchievementModal`, `CollectionModal`(이미 적용됨 이후 추가 모달), `YearInReview`, `my.tsx` TotemList | full-screen → bottom sheet (borderTopRadius 24, maxHeight 85~90%) |
| **모달 애니메이션 통일** | `AchievementModal`, `CollectionModal`, `YearInReview`, `my.tsx` TotemList | `Animated.spring(tension:50, friction:9)` + `shouldRender` 패턴 적용 — 모든 모달 동일한 spring 애니메이션으로 통일 |
| **+버튼 → +추가 텍스트 버튼** | `CollectionModal`, `my.tsx` TotemList | 기존 "+" 심볼 → "+ 추가" 텍스트 버튼 + 배경 추가, X와 간격 20px로 이격 (터치 오류 방지) |
| **배지 상세 오버레이 클리핑** | `AchievementModal.tsx` | badge detail popup이 `overflow:hidden` 컨테이너 내부에서 잘리던 현상 수정 — overlay를 bottom sheet 밖으로 이동 |
| **CollectionModal 코드리뷰 정리** | `CollectionModal.tsx` | 리스트 X → `handleClose` 사용, 미사용 `styles.overlay` 제거, content에 `overflow:hidden` 추가 |

### 수정 파일
- `mobile/components/EmotionPicker.tsx`
- `mobile/lib/db/records.ts`
- `mobile/components/TicketReportModal.tsx`
- `mobile/components/AchievementModal.tsx`
- `mobile/components/YearInReview.tsx`
- `mobile/components/CollectionModal.tsx`
- `mobile/app/(tabs)/my.tsx`
- `server_backup_2026-05-29/build_daily_scores.py`

### 커밋
| 해시 | 설명 |
|------|------|
| `4f39b2c` | fix: EmotionPicker lockedAlert Modal변환 + deleteJikgwanRecord 캐시무효화 |
| `b8e24a4` | design: 모아보기 모달 UI 통일 — X버튼 위치/시트형태/spring애니메이션 |
| (squash) | 추가 모달 spring 변환 + handleClose + overflow 수정 |
| `0bf5fdb` | fix: 코드리뷰 발견 4건 수정 — badge detail overflow 클리핑, CollectionModal 3건 정리 |

### 특이사항
- **learned**: React Native `Animated.spring` vs `Modal animationType="slide"`의 차이 — spring이 더 부드럽고 일관된 물리 효과 제공
- **learned**: `<Modal transparent>`는 모든 컨텐츠 위에 렌더링되므로, `position:absolute`가 잘리는 작은 컴포넌트 내 overlay 문제 해결에 효과적
- **learned**: `overflow: "hidden"`은 `borderRadius`가 있는 컨테이너에서 자식 컨텐츠가 모서리를 넘어갈 때 필수
- **caution**: PowerShell here-string (`@'...'@`)은 열리는 `@'`가 반드시 컬럼 0에 위치해야 함 — `git commit -m`과 같은 줄에 쓰면 `@`가 메시지에 포함됨

---

## Phase 18-5: Collector 동작 방식 확인 및 or falsy-0 수정 (2026-06-12~13)

### Collector 실행 방식: APScheduler (cron 아님)

서버 `main.py`의 **APScheduler**가 `collector.py`의 `collect()` 함수를 주기적으로 실행. cron이나 systemd timer가 아님.

```python
# main.py (scheduler 섹션, lines 129-148)
scheduler = BackgroundScheduler()

def scheduled_collect():
    try:
        from collector import collect
        collect()
    except Exception as e:
        print(f"Collection error: {e}")
    _JSON_CACHE.clear()
    load_json("today-games.json")
    load_json("daily-scores.json")
    next_interval = random.randint(180, 300)  # 3~5분 랜덤
    next_run_time = datetime.now() + timedelta(seconds=next_interval)
    scheduler.add_job(scheduled_collect, "date", run_date=next_run_time)

scheduler.add_job(scheduled_collect, "date", run_date=datetime.now() + timedelta(seconds=10))
scheduler.start()
```

- 각 실행이 완료되면 `random.randint(180, 300)`초 후 다음 실행을 1회 예약
- 로그 확인: `journalctl -u fullcount-api.service | grep 'collect start'`
- 로그 파일(`collector.log`)은 5/26 이후 갱신 없었음 → 서버 재시작 후 출력이 systemd journal로 변경되었기 때문

### `or` falsy-0 패턴 수정

**문제**: `collector.py`에서 `data.get("visitTeamScore") or data.get("homeTeamScore")` 패턴 사용. Python에서 `0 or X`는 `X`로 평가되어 셧아웃 경기(0-X, X-0)에서 점수가 잘못 기록됨.

**수정**:
```python
# BEFORE
away_score = data.get("visitTeamScore") or data.get("homeTeamScore")
home_score = data.get("homeTeamScore") or data.get("visitTeamScore")

# AFTER
away_score = data.get("visitTeamScore")
home_score = data.get("homeTeamScore")
if away_score is None:
    away_score = data.get("homeTeamScore")
if home_score is None:
    home_score = data.get("visitTeamScore")
```

**적용 대상**:
- 로컬 `server_backup/collector.py` (`99c3a12` 커밋)
- 서버 `/home/opc/fullcount_backend/collector.py` (직접 SSH 수정, 2026-06-12)

### 확인 사항
- collector는 3~5분 랜덤 간격으로 정상 동작 중
- `collector.log` 파일이 멈춘 것은 서버 재시작 후 journald로 로그 출력 방식이 변경된 것 — collector 자체는 문제 없음
- APScheduler 방식이므로 별도 cron 설정 불필요 (API 서버가 떠 있으면 자동 실행)

---

## Phase 18-6: Standings 컬럼 재배치 + last10 계산 버그 수정 + v1.1.7 빌드 (2026-06-12)

### 순위 화면 개선

**컬럼 순서 변경** (웹 + 모바일):
- 기존: `# / 팀 / 승 / 무 / 패 / 승률 / 차 / 연속 / 경기수 / 최근10경기`
- 변경: `# / 팀 / 경기수 / 승 / 무 / 패 / 승률 / 차 / 연속 / 최근10경기`
- 컬럼 간격 확대 및 폰트 크기 통일 (최근10경기 11→13px, 연속 11→12px)

**신규 필드 표시**:
- `gamesPlayed`(경기수), `last10`(최근10경기) 필드를 Standings 테이블에 추가
- StandingRow 타입 optional 확장, API fetchStandingsJson 정규화 추가
- `formatLast10()` 유틸: `W-L-D` → "7승1무2패" 형식으로 변환

### last10 계산 버그 수정

**버그**: `fetch_kbo_standings.py`의 `compute_last10()`이 해당 팀 경기만 필터링하지 않고 **모든 경기**를 집계하여 W/L 기록이 크게 왜곡됨.
- ex) 두산(당시 9위)이 참여하지 않은 경기에서 상대팀 승리 = 두산 관점에서 "패"로 기록
- 결과: 두산 4-6-0 (실제: 6-3-1)

**수정**: `if game.get("away") != team_name and game.get("home") != team_name: continue` 조건 추가

**서버 배포**: 스크립트 SCP 전송 후 실행 → kbo_standings.json 데이터 재생성 완료

### v1.1.7 빌드

- version: 1.1.6 → 1.1.7
- Android versionCode: 25 → 26
- iOS buildNumber: 1 → 2 (앱스토어 심사 대기)
- iOS 먼저 빌드 완료 → Android 1개만 빌드

### 변경 파일

| 파일 | 변경 |
|------|------|
| `client/src/pages/Standings.tsx` | 컬럼 재배치, 폰트/간격 통일, formatLast10 추가, overflow-x-auto |
| `mobile/app/(tabs)/rank.tsx` | 컬럼 재배치, horizontal ScrollView, 폰트/간격 통일, formatLast10 추가 |
| `scripts/fetch_kbo_standings.py` | compute_last10 팀 필터 추가, last10/gamesPlayed 필드 |
| `shared/types.ts` | StandingRow에 gamesPlayed?, last10? 추가 |
| `shared/api.ts` | fetchStandingsJson 정규화에 gamesPlayed/last10 추가 |
| `mobile/app.json` | version 1.1.7, versionCode 26, buildNumber 2 |

### 커밋

| 해시 | 설명 |
|------|------|
| `9578930` | standings column reorder, font, last10 fix |
| `ee1fcc2` | bump version 1.1.6 → 1.1.7 |

---

## Phase 19: BSO/주루/PB 3-state 디스플레이 통일 (2026-06-14~15)

### 개요

기존 Naver relay API 2-Track 아키텍처 위에 BSO/주루/PB 표시를 GameCard와 경기상세 화면에 통일.

### 변경 사항

#### 1. GameCard 3-state 팀 컬럼

| 상태 | 표시 |
|------|------|
| 경기전 | 선발투수 이름 |
| 경기중 | `isTop` 기반 P(투수) / B(타자) |
| 경기종료 | 승/패/무 투수 |

#### 2. 경기상세 헤더 카드 재구성

- **Top row**: time(좌) / status badge(중) / venue(우) — 3-column flex
- **BSO+주루**: RelayLive 컴포넌트 제거 → GameCard와 동일한 인라인 B-S-O 1열 가로 표시
- **팀 컬럼**: GameCard와 동일한 3-state 표시 (선발/PB/승패)
- **색상 통일**: B=초록, S=노랑, O=빨강, 주루=주황

#### 3. RelayLive 컴포넌트 개선

- `inline` prop: 가로 정렬 모드 (경기상세 scoreColumn용, 현재는 미사용)
- `hidePlayers` prop: P/B 이름 숨김 옵션
- `BaseDiamond` 컴포넌트 추가 (사각형 주자 표시)
- 레이아웃을 세로 BSO + 중앙 다이아몬드로 개선
- O(아웃) dot 3→2개로 변경

### 테스트용 TEMP 목업

- `home.tsx` / `[id].tsx`: `__DEV__`에서 finished 경기를 강제 live + mock relay로 전환
- 배포 전 제거 필요

### 브랜치

| 항목 | 내용 |
|------|------|
| 브랜치 | `feat/gamecard-detail-relay-ui` |
| 커밋 | `c31d8dc` — BSO/주루/PB 3-state 디스플레이 — GameCard + 경기상세 통일 |

### 변경 파일

| 파일 | 변경 |
|------|------|
| `mobile/app/game/[id].tsx` | 헤더 카드 3-state + BSO 인라인 + venue/status top row |
| `mobile/components/GameCard.tsx` | 3-state 팀 컬럼 + BSO 헤더 row 통합 |
| `mobile/components/RelayLive.tsx` | inline/hidePlayers prop + BaseDiamond + O 2dot |
| `mobile/app/(tabs)/home.tsx` | TEMP mock relay for dev testing |

---

## Phase 19.5: 실시간 폴링 주기 최적화 — 서버 7s / 앱 10s / SQLite 3s (2026-06-15)

### 개요

서버↔Naver, 앱↔서버 API 호출 주기를 전면 재설계. widget-data 엔드포인트를 Single Source of Truth로 통합하고 비대칭 폴링 간격으로 공진(resonance) 현상 제거.

### 변경 사항

#### 1. 서버 측 (`server/data_api/main.py`)
- `_WIDGET_CACHE_TTL = 7` (Naver list 호출 주기와 동일, 가장 최신 데이터 보장)
- `_RELAY_CACHE_TTL = 5` (초기 game-detail 로드용으로만 사용, 폴링에서는 미사용)
- widget-data V3 엔드포인트: Naver schedule_games(list, fields=all) + game_relay(BSO) 통합

#### 2. 앱 측 (`mobile/app/(tabs)/home.tsx`)
- **홈탭 폴링**: 60초 (앱 내부에 사용자가 있을 때만 동작)
- 홈탭의 실시간 데이터는 `cachedGameDetail()` 개별 호출 → `cachedWidgetData()` 단일 호출로 대체

#### 3. 앱 측 (`mobile/app/game/[id].tsx`)
- **경기상세 폴링**: 10초
- Widget data overlay 방식: `fetchGameDetailFresh()` 대신 `cachedWidgetData()`에서 점수/이닝/relay만 추출

#### 4. SQLite 캐시 TTL (`mobile/lib/gameCache.ts`)
- `cachedWidgetData()`: TTL = 3초 (서버 7s + SQLite 3s = 앱 10s 주기에 정확히 정렬)

#### 5. 아키텍처 원칙
- **SSOT (Single Source of Truth)**: 모든 실시간 데이터는 `/widget-data` 1개 엔드포인트
- **비대칭 폴링**: 서버 7s ≠ 앱 10s → 공진 회피
- **stale-while-revalidate 제거**: 실시간 데이터는 무조건 fresh fetch, 과거 데이터만 stale 허용

### 브랜치

| 항목 | 내용 |
|------|------|
| 브랜치 | `feat/gamecard-detail-relay-ui` |
| 커밋 | `4006b88` — 실시간성 대폭 향상 |
| 커밋 | `447590a` — 폴링 주기 최적화 |
| 커밋 | `21b1485` — widget-data V3 SSOT |

---

## Phase 19.6: 직관 예정(D-Day) 캘린더 — is_planned 기반 (2026-06-15)

### 개요

미래 경기 일정을 "직관 예정"으로 등록하고, 캘린더/타임라인/카드 전반에 D-Day 정보와 event pill을 표시. 경기일이 지나면 자동으로 실제 직관 기록으로 전환.

### 변경 사항

#### 1. DB 계층
| 파일 | 변경 |
|------|------|
| `mobile/lib/db/connection.ts` | `migrateJikgwanSchema()`에 `is_planned INTEGER DEFAULT 0` 컬럼 추가 |
| `mobile/lib/db/records.ts` | `JikgwanRecord` 타입에 `is_planned?: number` 추가. INSERT/VALUES/화이트리스트 바인딩 |

#### 2. 비즈니스 로직
| 파일 | 변경 |
|------|------|
| `mobile/components/diary/useDiaryForm.ts` | `isFutureGame`을 `useMemo`로 추출 (기존 `handleSave` 지역변수). return 객체에 노출. 저장 시 `is_planned: isFutureGame ? 1 : 0`. emotion validation `!isFutureGame` 조건부 우회 |

#### 3. 작성 폼
| 파일 | 변경 |
|------|------|
| `mobile/components/diary/DiaryWriteStep.tsx` | `{!isFutureGame && (...)}`로 emotion/live-toggle/expense/totem 조건부 렌더링. placeholder 텍스트 "다짐 / 기대평" 변경 |

#### 4. 카드/타임라인
| 파일 | 변경 |
|------|------|
| `mobile/components/DiaryCard.tsx` | `upcoming = record.is_planned === 1 \|\| isUpcoming(...)` 명시적 플래그 우선 |
| `mobile/components/GridTimeline.tsx` | plannedRecords/actualRecords 분리. `ListHeaderComponent`에 수평 D-Day 티켓 카드 섹션 추가. scroll offset 보정 |

#### 5. 캘린더
| 파일 | 변경 |
|------|------|
| `mobile/components/CalendarGridPure.tsx` | `plannedRecords` prop. 날짜 정규화(`r.date.replace(/\./g, "-")`) 후 매칭. 팀 컬러 event pill `✓ 예매` 렌더링 |
| `mobile/components/CalendarContainer.tsx` | `plannedRecords` prop pass-through |
| `mobile/components/DiaryCalendar.tsx` | `isPlanned` 플래그. `skipResult`에 `isPlanned` 포함. event pill 렌더링 |
| `mobile/app/(tabs)/home.tsx` | `plannedRecords` state. `loadJikgwanData()`로 중복 제거 + `useFocusEffect` 적용. AppState listener 통일 |

### 이슈

- **CalendarGridPure 날짜 포맷 불일치**: jikgwan_records는 `YYYY.MM.DD`, games는 `YYYY-MM-DD` → `r.date.replace(/\./g, "-")` 정규화로 수정 (commit 33f517c)

### UX 흐름

1. 미래 날짜 → is_planned=1 저장 → 캘린더 pill + 타임라인 D-Day 카드
2. 경기일 도과 후 수정 → isFutureGame=false → emotion/score 입력 강제
3. 저장 시 is_planned=0 → 일반 과거 기록으로 전환

### 브랜치

| 항목 | 내용 |
|------|------|
| 브랜치 | `feat/gamecard-detail-relay-ui` |
| 커밋 | `1c6b1a4` — D-Day 캘린더 feature |
| 커밋 | `33f517c` — 날짜 포맷 버그 수정 |

---

## Phase 19.7: Android 홈 위젯 Phase 1 — 기획 및 방향 검증 (2026-06-15)

### 개요

`react-native-android-widget` 라이브러리를 활용한 Android 홈 화면 위젯 개발 계획 수립 및 검증.

### 검증 결과 (4가지 리스크 식별)

| 리스크 | 내용 | 해결방안 |
|--------|------|----------|
| 1. Entry point | Expo Router에서는 `index.js`가 없음. 위젯 task handler 등록 위치 모호 | `app/_layout.tsx` 최상단 module scope에서 `registerWidgetTaskHandler()` 호출 |
| 2. SQLite 접근 | Widget background headless JS에서 `expo-sqlite` 초기화 불확실 | 응원팀 ID를 SQLite + AsyncStorage 이중 저장. Widget은 AsyncStorage에서 읽음 |
| 3. RemoteViews 제약 | `borderRadius`, `position: absolute`, SVG 등 사용 불가 | Material You 기본 스타일 준수. 팀 로고는 Base64 data URI로 처리 |
| 4. 개발 사이클 | 위젯 UI 변경 시 전체 네이티브 재빌드 필요 | 앱 내 Preview 화면으로 UI 반복 개발, 최종만 빌드 |

### 데이터 흐름

```
사용자 탭 → WidgetProvider (native)
  → registerWidgetTaskHandler (headless JS)
    → AsyncStorage: @fullcount_widget_team 읽기
    → fetch("https://api.fullcount.kr/widget-data")
    → RemoteViews 렌더링 (FullcountWidget.tsx)
```

### 브랜치

| 항목 | 내용 |
|------|------|
| 브랜치 | `feat/gamecard-detail-relay-ui` (Phase 1 개발 진행 예정) |

---

## Phase 20: 서버 푸시 알림 인프라 + 날씨 정보 표시 (2026-06-15)

### 개요

GameCard/경기상세 UI 통일 작업 중 확장된 작업들. 날씨 정보 표시, 서버 측 푸시 알림 전송 인프라(FCM/APNs) 구축 완료.

### Phase 20.1: GameCard + 경기상세 UI 통일

- GameCard와 경기상세 상단 영역을 동일한 컴포넌트로 통일
- BSO/주루/PB 3-state 디스플레이를 두 화면에서 일관되게 표시
- 상태 배지(경기 전/경기 중/경기 종료) 위치를 헤더에서 점수 바로 위로 이동
- large prop에 따른 분기 줄이고 stylesheet 통일

### Phase 20.2: 구장 날씨 정보 표시

- **서버**: `/widget-data` 엔드포인트에 ThreadPoolExecutor로 각 구장 날씨 동시 수집 → `todayWeather` 필드에 포함
- **클라이언트**: GameCard 헤더 우측에 `26°C 맑음` 형식으로 표시
- 당일 경기만 날씨 표시, 과거/미래는 우측 필드 비움
- `VENUE_TO_FULL_NAME` 매핑으로 단축 구장명(잠실→잠실야구장) 변환

### Phase 20.3: Mock 데이터 제거

- `__DEV__` 기반 mock relay/mock weather 데이터 완전 제거
- 실제 Naver API 연동으로만 동작하도록 정리

### Phase 20.4: 서버 푸시 알림 인프라 (Phase 1)

**신규 파일 (6개)**:

| 파일 | 역할 |
|------|------|
| `server/data_api/push_init.sql` | `device_tokens` 테이블 DDL (`target_team_id` + 인덱스) |
| `server/data_api/init_push_db.py` | One-shot DB 마이그레이션 |
| `server/data_api/push_router.py` | `POST /push/register`, `/unregister`, `GET /status` |
| `server/scripts/fcm_sender.py` | Firebase Admin SDK, data-only 메시지 |
| `server/scripts/apns_sender.py` | httpx HTTP/2 + ES256 JWT, Live Activities |
| `server/scripts/push_worker.py` | 상태 diff → 구독 타겟팅 쿼리 → FCM/APNs 병렬 dispatch |

**수정 파일 (2개)**:

| 파일 | 변경 |
|------|------|
| `server/data_api/main.py` | `ENABLE_PUSH` flag, router 마운트, `_get_widget_data_cached()` 추출, push_worker 5~10초 스케줄러 |
| `server/fullcount_backend/requirements.txt` | `httpx[http2]`, `firebase-admin` 추가 |

**핵심 설계**:
- push_worker는 `/widget-data` 메모리 캐시 읽기만 하여 5~10초마다 돌아도 DB/Naver 부하 없음
- `target_team_id`로 특정 팀 구독자에게만 발송 (전체 발송 방지)
- FCM Data Message 특성상 모든 값 `str()` 캐스팅
- `ENABLE_PUSH_NOTIFICATIONS` env var로 전체 기능 ON/OFF (기본 OFF)
- `DRY_RUN=true` 기본값으로 실제 발송 없이 로그만 출력

**배포 완료 항목**:
- Firebase 서비스 계정 키 → 서버 `/home/opc/fullcount_backend/fcm-service-account.json`
- Apple .p8 키 → 서버 `/home/opc/fullcount_backend/apns-key.p8`
- systemd drop-in: 환경변수 설정 (`push-override.conf`)
- `pip install firebase-admin`, `httpx[http2]`
- `init_push_db.py` 실행 → `device_tokens` 테이블 생성
- 서비스 재시작 및 정상 동작 확인

**남은 전제조건** (Phase 2/3에서 필요):
- Android 앱에서 FCM 토큰 등록 → `/push/register` 호출
- iOS WidgetExtension + ActivityAttributes 구현

### 커밋 로그

```
c31d8dc feat: BSO/주루/PB 3-state 디스플레이 — GameCard + 경기상세 통일
a09bb1e feat: 실시간 BSO/주자/투타 표시 — Naver relay API 2-Track 아키텍처
16a1093 feat: GameCard 단일화 + 오래된 사진 흰색 버그 수정
f581b62 feat: 구장 날씨 scraping + RateLimitMiddleware TTLCache 개선
21b1485 feat: widget-data V3 SSOT + 사진 경로 일괄 복구
447590a feat: 폴링 주기 최적화 — 홈탭 60초, 경기상세 12초
4006b88 feat: 실시간성 대폭 향상 — 서버 7s / 앱 10s / SQLite TTL 3s
1c6b1a4 @ feat: 직관 예정(D-Day) 캘린더 — is_planned 기반 일정 등록/표시
33f517c @ fix: CalendarGridPure 날짜 포맷 불일치로 event pill 미표시 버그 수정
0ef569f fix: GameCard large/non-large 레이아웃 통일 — statusLabel/BSO/이닝 위치 일원화
949a855 feat: GameCard 날씨 정보 표시 + VENUE_TO_FULL_NAME 매핑
a3898de feat: 날씨 정보 당일만 표시 + mock 데이터 제거
b438ab1 feat: Phase 1 — 서버 푸시 알림 인프라 (FCM/APNs/device_tokens/push_worker)
bd7b2a7 fix: push_router 항상 마운트 (ENABLE_PUSH off 시 push_disabled 응답)
1a15576 feat: push_worker payload에 home_team/away_team 추가 (위젯용)
ed99edb fix: TodayGame score Zod 스키마 nullable 허용 (nextGames null 경고 수정)
```

---

## Phase 21: 직관 예정 UI 개선 + OTA 인지 (2026-06-15)

### 개요

v1.1.8 (versionCode 27, buildNumber 3) 스토어 제출 완료. UI 수정은 EAS Build 없이 `eas update`로 즉시 배포 가능하다는 사실을 정리.

### OTA vs Build 기준

| 변경 유형 | OTA (`eas update`) | 필요 |
|-----------|:------------------:|:----:|
| JS/TS 코드만 변경 (UI, 로직, API 호출) | ✅ 가능 |
| `app.json` 설정 변경 (버전, 아이콘, 플러그인) | ❌ EAS Build |
| 새 네이티브 패키지 추가 | ❌ EAS Build + prebuild |
| 스토어 제출용 버전업 | ❌ EAS Build |

즉, **네이티브 변경/Firebase/아이콘 등이 아닌 순수 UI/로직 수정은 `eas update --branch production --message "..."` 한 줄로 사용자에게 즉시 배포 가능.** 심사 불필요.

### 수정사항

- **직관 예정 모달 제목**: `isFutureGame`일 때 "기록 작성" → **"직관 예정"**으로 표시
- **캘린더 탭 동작**: 이미 등록된 직관 예정 날짜 탭 → 타임라인이 아닌 **수정 모달 열림**
- **서버-backup .gitignore 추가**: `server-backup/` 폴더 332MB가 EAS 업로드에 포함되던 문제 수정 (152MB로 감소)

### 커밋 로그

```
(직관 예정 UI 수정 — 미커밋, `eas update`로 배포 예정)
```

---

## Phase 22: FCM/위젯 테스트 앱 분리 (2026-06-15)

### 배경

EAS Preview APK가 기존 Play Store 앱과 서명 키 불일치로 설치 충돌 발생. 기존 앱과 완전히 분리된 테스트 앱(`풀카운트_test`)을 생성하여 사이드바이사이드 설치 가능하도록 구성.

### 테스트 앱 identity

| 항목 | 프로덕션 | 테스트 |
|------|---------|--------|
| 앱 이름 | 풀카운트 | 풀카운트_test |
| slug | fullcount-kr | fullcount-kr (EAS 프로젝트 ID와 연결, 변경 불가) |
| Android package | `kr.fullcount.app` | `kr.fullcount.app.test` |
| Android package | `kr.fullcount.app` | `kr.fullcount.app.test` |
| iOS bundleIdentifier | `kr.fullcount.app` | `kr.fullcount.app.test` |

### google-services.json

Firebase Console에서 `kr.fullcount.app.test` Android 앱을 추가 등록하여, 하나의 `google-services.json`에 두 패키지 client가 모두 포함됨:

```json
"client": [
  { "package_name": "kr.fullcount.app" },
  { "package_name": "kr.fullcount.app.test" }
]
```

- 이 파일은 두 빌드 모두에서 동일하게 사용 가능
- 프로덕션 빌드 시에도 변경 불필요

### 프로덕션 복귀 방법

테스트 완료 후 Play Store 제출용 빌드 시 `app.json` 3개 필드만 원래 값으로 되돌리면 됨:

| 필드 | 프로덕션 값 |
|------|-----------|
| `expo.name` | `"풀카운트"` |
| `expo.slug` | `"fullcount-kr"` (변경 불가, EAS projectId와 연결됨) |
| `expo.android.package` | `"kr.fullcount.app"` |
| `expo.ios.bundleIdentifier` | `"kr.fullcount.app"` |

`android/` 디렉토리는 `.gitignore`에 포함되어 추적되지 않으므로, `expo prebuild -p android --clean`으로 재생성 시 새 패키지명 자동 적용됨.

### EAS Build 프로필

`test-apk` 프로필(eas.json에 추가 완료):
```json
"test-apk": {
  "android": { "buildType": "apk" },
  "distribution": "internal",
  "channel": "test"
}
```

APK로 빌드하여 사이드로딩 설치.

### 관련 신규 파일 (Phase 21에서 작성)

| 파일 | 역할 |
|------|------|
| `mobile/lib/fcm.ts` | FCM token lifecycle (권한 요청, 토큰 획득, foreground/background 핸들러) |
| `mobile/lib/pushRegistration.ts` | 서버 `/push/register`, `/unregister` API 호출 |
| `mobile/lib/usePushSetup.ts` | React Hook — 앱 부팅 시 FCM 토큰 등록 + myTeam 변경 감지 |
| `mobile/lib/notification.ts` | Notifee lock screen notification (ongoing, visibility PUBLIC) |
| `mobile/lib/teamStorage.ts` | 위젯용 AsyncStorage 팀 동기화 (Headless JS에서 SQLite 대체) |
| `mobile/widgets/GameStatusWidget.tsx` | 위젯 UI (Compact/Normal/Wide 3단계) |
| `mobile/widgets/updateWidget.tsx` | FCM payload / HTTP fetch → 위젯 렌더링 |
| `mobile/widgets/taskHandler.tsx` | WIDGET_ADDED / RESIZED / UPDATE handler |
| `mobile/plugins/withAndroidWidget.js` | Config plugin (Manifest receiver + widget XML) |
| `mobile/index.js` | Custom entry point (background handler + widget tasks → expo-router) |

### 수정 파일

| 파일 | 변경 |
|------|------|
| `mobile/app.json` | name/slug → test identity, package/bundleIdentifier → test, googleServicesFile 추가 |
| `mobile/google-services.json` | `kr.fullcount.app.test` client entry 추가 |
| `mobile/lib/TeamContext.tsx` | `setMyTeam` → AsyncStorage 동기화 추가 |
| `mobile/app/_layout.tsx` | `usePushSetup()` 호출 추가 |
| `mobile/eas.json` | `test-apk` 프로필 추가 |

### Phase 22 커밋 로그

```
(테스트 앱 분리 — 미커밋, APK 빌드 전)
```

---

## Phase 23: Android Widget (4x2) + FCM Push + 잠금화면 알림 (2026-06-16)

### 개요

Android 바탕화면 위젯(react-native-android-widget)과 FCM 푸시 알림을 통합. 테스트 APK(`풀카운트_test`)로 EAS Build하여 검증.

### 아키텍처 결정

| 결정 | 선택 | 이유 |
|------|------|------|
| Widget library | `react-native-android-widget` v0.20.3 | Expo managed workflow 지원, app.plugin.js 내장 |
| FCM | `@react-native-firebase/messaging` v24.1.1 | FCM data-only message (알림창 없이 위젯 갱신) |
| Lock screen | `expo-notifications` v0.32.17 | @notifee/react-native jitpack.io timeout 문제로 교체 |
| Widget sizes | 1x1 ~ 5x5 (25개) | EAS Build 한 번으로 전부 APK에 박고 OTA로 UI 관리 |
| Default alarm | OFF | 처음 설치 시 무음/무알림, 위젯만 갱신 |

### 변경 파일

| 파일 | 변경 |
|------|------|
| `mobile/app.json` | plugins: `react-native-android-widget` (25개 위젯) + `expo-notifications` |
| `mobile/index.js` | **신규** — custom entry: background handler 먼저 등록 → expo-router |
| `mobile/lib/fcm.ts` | **신규** — FCM token lifecycle, foreground/background handler |
| `mobile/lib/notification.ts` | **신규** — expo-notifications setup + updateLockScreenScore (AsyncStorage toggle) |
| `mobile/lib/pushRegistration.ts` | **신규** — 서버 `/push/register`, `/unregister` |
| `mobile/lib/teamStorage.ts` | **신규** — AsyncStorage 팀 동기화 (SHORT_CODE_TO_TEAM_ID 포함) |
| `mobile/lib/usePushSetup.ts` | **신규** — React Hook (토큰/팀 변경 감지) |
| `mobile/widgets/GameStatusWidget.tsx` | **신규** — 3-tier 렌더링 (compact <80dp / small <230dp / full) |
| `mobile/widgets/updateWidget.tsx` | **신규** — requestWidgetUpdate로 모든 위젯 타입 일괄 갱신 |
| `mobile/widgets/taskHandler.tsx` | **신규** — WIDGET_ADDED/RESIZED/UPDATE handler |
| `mobile/widgets/rn-android-widget.d.ts` | **신규** — TypeScript 타입 정의 |
| `mobile/app/(tabs)/my.tsx` | 잠금화면 전광판 ON/OFF Switch 추가 |
| `mobile/lib/TeamContext.tsx` | setMyTeam → AsyncStorage 동기화 추가 |
| `mobile/app/_layout.tsx` | usePushSetup() 호출 추가 |
| `mobile/plugins/withAndroidWidget.js` | **삭제** — 라이브러리 app.plugin.js로 대체 |

### 커밋 로그

```
88b342d feat: Android Widget (4x2 LiveScoreWidget) + FCM push + 잠금화면 알림
474c381 feat: 모든 위젯 크기 선언 (2x1/2x2/4x2/5x2/4x3) + 크기별 렌더링
3c5e330 feat: 잠금화면 전광판 알림 ON/OFF 스위치 (기본 OFF)
a0660b8 feat: 1x1~5x5 모든 위젯 크기 선언 (25개)
```

### 위젯 크기별 렌더링 규칙

| 크기 | 너비 | 높이 | 표시 내용 |
|------|------|------|---------|
| 1x1~1x5, 2x1 | <80dp | 제한 없음 | 점수만 (compactScoreView) |
| 2x2~2x5, 3x2 | <230dp | 제한 없음 | 팀명+점수+상태 (smallView) |
| 4x1~5x5 | ≥230dp | ≥80dp | 전광판+BSO+주자 (main4x2View) |


## 2026-06-16: 안드로이드 포그라운드 서비스 및 스코어보드 전광판 통합 완료

### 주요 변경 사항

1. **포그라운드 서비스(Live Mode) 적용**
   - 위젯 백그라운드 태스크 생존율 문제를 해결하기 위해 LiveScoreService (Foreground Service) 네이티브 모듈 구축
   - 잠금화면 위젯에서 사용자가 REFRESH 탭 시 네이티브 브릿지(LiveScoreModule)를 통해 포그라운드 서비스 구동
   - 5초마다 React Native Headless Task를 트리거하여 스코어 업데이트 후 상단바 고정 알림 렌더링 유지

2. **대형 전광판 위젯(ScoreboardWidget) 통합**
   - 기존 eat/widget-livescore-4x2 브랜치의 스코어보드 구현부를 eat/widget-views-decoupled 로 병합 완료
   - 크기(width 230 이상, height 160 이상) 감지를 통해 자동으로 9이닝 득점판 레이아웃 전환

3. **네이티브 파일 트래킹 강제화**
   - Expo .gitignore에 의해 제외되던 ndroid/ 네이티브 수정본을 유실 방지차 git add -f 로 리포지토리에 강제 포함

---

## Hotfix 1.2.0 + Test 3.0.0 분리 (2026-06-17)

### 개요
DB is_planned 컬럼 누락 에러 수정 및 프로덕션 AAB 빌드. 위젯 테스트용 브랜치(feat/widget-views-decoupled)의 버전을 3.0.0으로 분리.

### 작업 내역

#### 1. DB is_planned 컬럼 누락 에러 수정
- **원인**: `1c6b1a4` 커밋에서 `jikgwan_records`에 `is_planned` 컬럼을 추가했으나 `SCHEMA_VERSION`을 1→2로 올리지 않음
- **메커니즘**: `initSchema()`가 `schema_version=1 === SCHEMA_VERSION(1)` 조건으로 migration을 skip → `is_planned` 컬럼이 물리적으로 존재하지 않음 → `addJikgwanRecord()`의 INSERT가 `"table jikgwan_records has no column named is_planned"` 에러 발생
- **수정**: `connection.ts`의 `SCHEMA_VERSION`을 1→2로 변경
- **영향 범위**: 1.1.9 버전 이상에서 첫 INSERT 시도 시 전 사용자에게 발생. 스토어 버전(1.1.8)은 해당 코드 없어 영향 없음

#### 2. 프로덕션 1.2.0 AAB 빌드
- **버전**: app.json version 1.2.0, buildNumber 4, versionCode 29
- **OTA 활성화**: eas.json production/test-apk 프로필에 `channel: "production"` 추가
- **홈탭 개선**: polling 60s→16s, widget-data status 동기화 추가
- **커밋**: `6e87ee0` (master), EAS AAB 빌드 완료 (versionCode 29)

#### 3. 위젯 테스트 3.0.0 분리 (feat/widget-views-decoupled)
- 프로덕션 1.2.0과 혼동 방지를 위해 테스트 버전을 3.0.0으로 독립
- **android package**: `kr.fullcount.app` → `kr.fullcount.app.test` (사이드바이사이드 설치 가능)
- **앱 이름**: `풀카운트_test` (기존 유지)
- **runtimeVersion**: bare workflow 대응을 위해 `{"policy":"appVersion"}` → `"3.0.0"` 하드코딩
- **네이티브 폴더 동기화**: 패키지명 변경에 따라 android/ 내 build.gradle, Kotlin/Java 소스, AndroidManifest.xml 전부 `kr.fullcount.app.test`로 일괄 변경
- **커밋**: `9a19053`, `66c2e72` (feat/widget-views-decoupled)

#### 4. EAS APK 빌드 실패 및 수정
- **1차 실패**: `runtimeVersion` 정책 오류 — bare workflow에선 `{"policy":"appVersion"}` 불가 → `"3.0.0"` 하드코딩
- **2차 실패**: Gradle build unknown error — 2가지 원인:
  - `pnpm-lock.yaml` + `package-lock.json` 동시 존재 → lock 파일 충돌 → `pnpm-lock.yaml` 삭제
  - `react-native-view-shot` 5.1.0 (SDK 54 요구 4.0.3과 불일치) → `npx expo install --fix`로 4.0.3 교정
- **3차 발견**: `AndroidManifest.xml`의 25개 `WIDGET_CLICK` 인텐트가 구 패키지명(`kr.fullcount.app`) 하드코딩 → `kr.fullcount.app.test`로 일괄 변경
- **커밋**: `87ffb06`, `559de55` (feat/widget-views-decoupled)

### 커밋 로그
```
6e87ee0 master: bump version 1.2.0 (SCHEMA_VERSION 2, OTA channel, 홈탭 16s)
9a19053 feat/widget-views-decoupled: bump test version 3.0.0 (versionCode 31)
66c2e72 feat/widget-views-decoupled: fix bare workflow runtimeVersion hardcode
87ffb06 feat/widget-views-decoupled: delete pnpm-lock.yaml, fix react-native-view-shot 5.1.0→4.0.3
559de55 feat/widget-views-decoupled: fix AndroidManifest.xml WIDGET_CLICK package name (25개)
```

#### 5. 인코딩 깨짐 + Kotlin 컴파일 에러 수정 및 빌드 성공 (2026-06-17)

**1차 문제: `npx expo prebuild` UTF-8 한글 깨짐**
- `app.json`, `AndroidManifest.xml`, `strings.xml`에 위젯 라벨/설명이 `풀카운트 4x2` → `?카운??4x2`, `4x2 위젯` → `4x2 ?기 ?젯` 으로 깨져서 AAPT 빌드 실패
- `fix.py`로 깨진 문자열을 영문(`FullCount NxN`, `NxN Widget`)으로 치환

**2차 문제: fix.py regression (백슬래시 주입)**
- Python 정규식 `r'\"FullCount...\"'` 가 JSON/XML 파일에 리터럴 `\"`를 삽입
- **app.json**: `"label": \"FullCount 1x1\"` → JSON parse error
- **AndroidManifest.xml**: `android:label=\"FullCount 1x1\"` → XML Unquoted attribute error
- 수동으로 `\"` → `"` 전부 교정 (50곳씩)
- **커밋**: `9cc0d8c`, `4372daf`

**3차 문제: Kotlin 컴파일 에러 (LiveScoreTaskService.kt)**
- `:app:compileReleaseKotlin` 실패 — `'getTaskConfig' overrides nothing`
- **원인**: React Native 0.81.5에서 `HeadlessJsTaskService.getTaskConfig(intent: Intent)` → `getTaskConfig(intent: Intent?)`로 시그니처 변경 (nullable Intent)
- **수정**: `LiveScoreTaskService.kt:9` — `Intent` → `Intent?`
- **커밋**: `2dff04c`

**4차 문제: LiveScoreService.kt UTF-8 깨짐 + Android 14 크래시**
- Kotlin 파일 내 알림 텍스트도 `"풀카운트 라이브 모드"` → 깨진 UTF-8 바이트 포함 → Kotlin 컴파일러 `MalformedInputException` 유발 가능
- Android 14 (API 34)부터 `startForeground()` 호출 시 `FOREGROUND_SERVICE_TYPE` 필수 — 누락 시 런타임 크래시
- **수정**: 알림 텍스트 영문으로 교체 + `ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC` 분기 처리
- **커밋**: `428ec13`

**최종 빌드 성공**
- Build ID: `50c3f4db-d5f3-4bba-bc31-812e53f47fc7`
- APK: https://expo.dev/accounts/duboo82/projects/fullcount-kr/builds/50c3f4db-d5f3-4bba-bc31-812e53f47fc7

### 커밋 로그 (추가)
```
2dff04c feat/widget-views-decoupled: fix getTaskConfig Intent → Intent? (RN 0.81.5)
428ec13 feat/widget-views-decoupled: fix UTF-8 chars + Android 14 startForeground requirement
9cc0d8c feat/widget-views-decoupled: fix escaped quotes in app.json (fix.py regression)
4372daf feat/widget-views-decoupled: fix backslash-quotes in AndroidManifest.xml
f3e1509 feat/widget-views-decoupled: fix encoding issues with widget labels
```
### Widget OTA + 2x2 Blank Screen Fix (2026-06-17)

#### OTA 채널 정리
- preview 채널과 test 채널이 동일한 untimeVersion: "3.0.0"을 공유 → test에만 OTA 배포해도 preview 빌드에 자동 적용됨 → 향후 preview 별도 배포 불필요

#### 1차 문제: 2x2 위젯 RemoteViews inflation 실패 (빈 화면)
- **증상**: 2x2 위젯이 빈 화면(백지)으로 표시. 4x2 등 다른 크기는 정상.
- **원인**: iew2x2가 단일 통합 레이아웃에 삼항식 {condition ? <X/> : <FlexWidget/>} 패턴을 15회 이상 사용 → 빈 LinearLayout이 RemoteViews 트리에 쌓여 inflation 실패 → 백지 위젯
- **수정**: iew2x2를 4개 분기(iew2x2Scheduled, iew2x2Finished, iew2x2Cancelled, iew2x2Live)로 분리. 각 분기는 해당 상태에 필요한 요소만 렌더링, 빈 fallback 제거
- **커밋**: 4eaf8e9

#### 2차 문제: TextWidget text="" 빈 문자열 → Android RemoteViews crash
- **증상**: 1차 수정 후 4x2는 동작하나 2x2는 여전히 먹통 ("오늘 경기 없음" 화면에 갇힘). view2x1도 동일 증상.
- **원인**: 분기 코드에서 data.time || "", way.pbText || "" 등 빈 문자열 ""이 TextWidget text prop에 전달. Android RemoteViews의 setTextViewText(id, "")가 일부 기기에서 렌더링 실패 → 위젯이 전체 업데이트를 포기하고 마지막 성공한 뷰 유지
- **수정**: 모든 || "" fallback을 || " " (공백 한 칸)으로 변경. 공백은 시각적으로 동일하면서 네이티브 크래시 우회
- **영향 라인**: GameStatusWidget.tsx:470,485,497,647,648 (view2x2Scheduled 3곳 + view2x2Live 2곳)
- **커밋**: 8b648d2

#### 3차 수정: VS 위치 + 텍스트 대비 + 팀 변경 즉시 반영
- **VS 위치**: 2x2 scheduled에서 VS가 원정/홈팀 컬럼 전체 높이의 중앙에 떠서 감정표현 이미지보다 위에 위치 → lignItems: "flex-start" + marginTop: 14로 이미지(48dp)와 동일선에 정렬
- **텍스트 대비**: 크림 배경(#f5f0eb) 위의 파스텔톤 글자(alpha 44%, 66%, 88%)가 잘 안보임 → alpha 값 일괄 상향 (44→77, 66→99, 88→cc)
- **팀 동기화**: 앱에서 마이팀 변경 시 위젯이 즉시 반응하지 않음 → TeamContext.setMyTeam()에서 AsyncStorage 쓰기 직후 updateWidgetPeriodic() 호출로 위젯 즉시 갱신
- **커밋**: 0ff35d

#### 함께 수정된 부가 문제
- **charImage undefined 방어**: LOCAL_CHARACTERS["doosan_default"] fallback 추가
- **streak .toString() 방어**: String(myGame.homeStreak ?? "")으로 타입 불일치 방지
- **WidgetGameData 인터페이스**: rank/streak 4개 필드 추가
- **FCM 경로 rank/streak 보존**: _lastWidgetGame에서 rank/streak/homeIsMyTeam 보존하도록 FCM fallback 보강
- **game-finished fallback 복원**: 오늘 경기 없는 날 _lastWidgetGame을 status="finished"로 표시

### 커밋 로그
`
f0ff35d fix(widget): align VS with images, darken muted text, sync team on refresh
8b648d2 fix(widget): replace empty string fallbacks with space in TextWidget text
4eaf8e9 fix(widget): rewrite 2x2 layout as 4 clean branches + streak/rank safety
`

### OTA 배포
- **채널**: test (preview는 동일 runtimeVersion으로 자동 적용)
- **Update Group**: 865ff834 (1차), 600347f (3차)
- **기기 적용**: 앱 재실행(또는 위젯 제거 후 재추가) 후 반영 확인

### Naver API 전면 변경 대응 (2026-06-17)

경기 시작 후(18:30) 서버 `/widget-data`가 500 에러를 반환하고, 복구 후에도 모든 경기가 `scheduled`로 표시되는 장애 발생.
원인은 Naver가 API 응답 구조를 전면 개편한 것.

#### 서버 수정 내역

| # | 변경 전 | 변경 후 | 영향 |
|---|---------|---------|------|
| 1 | `status` 필드 | `statusCode` | 모든 경기 scheduled로 오판 |
| 2 | `homeScore`/`awayScore` | `homeTeamScore`/`awayTeamScore` | 점수 null |
| 3 | relay 최상위 `currentGameState` | `textRelayData.currentGameState` | BSO/주자 null |
| 4 | `homeEntry`/`awayEntry` list | dict (`pitcher`/`batter` 키) | 투수/타자명 깨짐 |
| 5 | base 값 `"0"`/`"1"` | 선수 번호 (예: `"7"`) | 주루 오탐지 |
| 6 | `inn`/`homeOrAway` 없었음 | `textRelayData.inn` / `textRelayData.homeOrAway` | 이닝 정보 추가 |
| 7 | `homeOrAway` == int `0` | `homeOrAway` == str `"0"` | `isTop` 비교 실패 (Python `"0" == 0` → False) |

#### 클라이언트 수정

- **home.tsx**: `scoreBoard.inn`이 빈 배열일 때 `relay.inning`/`relay.isTop`을 fallback으로 사용
- **프로덕션(master)에도 동일 패치 적용** → OTA `production` 채널 배포 (`7173b196`)

#### Foreground Service Doze 동작 확인

- **AOD ON**: 화면 꺼진 상태에서도 Handler.postDelayed 5초 주기 유지, 정상 갱신
- **AOD OFF**: Deep Doze 진입 → Handler 큐에 콜백 쌓임 → 화면 켜면 순차 실행으로 몰아서 업데이트
- **JS 컨텍스트**: Doze에서도 살아있음 (kill되지 않음)
- **개선 과제**: AlarmManager로 전환 시 Doze에서도 5초 주기 보장 가능

### 커밋 로그 (추가)
```
master:
d3faec4 fix(home): use relay inning/isTop as fallback when scoreBoard.inn is empty

feat/widget-views-decoupled:
5a79edf fix(home): use relay inning/isTop as fallback when scoreBoard.inn is empty
5b660e1 chore: disable WIDGET_MOCK_LIVE, use real API data
d5e5342 fix(widget): solid colors for RemoteViews, larger scores, tighter base
798618d fix(widget): larger BSO/base, darker muted text, add colon between 2x2 scores
61d7a3e fix(widget): BSO labels + wider diamond + larger base situation
e84a78c fix(widget): 2x2 live - add BSO labels, move score below image
a593d18 feat(widget): redesign 2x2 and 4x2 live layouts
b2278dc test: add WIDGET_MOCK_LIVE flag for widget layout testing
```

### 투수/타자 표시 + 감정표현 반전 수정 (2026-06-17)

#### 현재 투수명 미표시 문제
- **증상**: 위젯에서 `P:` 옆에 투수명이 빈 값으로 표시됨
- **원인**: relay의 `pitcher.name`이 항상 빈 문자열 — Naver API 구조 변경(entry list→dict)으로 인해 pcode→name 매핑이 실패. 특히 불펜 투수의 경우 entry 리스트에 pcode가 없어서 lookup 불가
- **서버 해결**: Naver 스케줄 API에 `awayCurrentPitcherName`/`homeCurrentPitcherName`이 직접 제공됨 → widget-data 응답에 `awayCurrentPitcher`/`homeCurrentPitcher` 필드 추가
- **클라이언트 해결**: `updateWidgetPeriodic()`에서 `relay.isTop`을 기준으로 현재 투수 결정. `isTop === "1"` (원정팀 공격=초) → `homeCurrentPitcher` 사용, `isTop === "0"` (홈팀 공격=말) → `awayCurrentPitcher` 사용. 폴백: `awayCurrentPitcher || homeCurrentPitcher`

#### 현재 타자명 미표시 문제
- **증상**: 위젯에서 `B:` 옆에 타자명이 빈 값으로 표시됨
- **원인**: relay의 `batter.name`도 pitcher와 동일하게 entry lookup 실패
- **서버 해결**: Naver relay API의 `textRelays` 배열에서 타자명 추출. 각 textRelay 항목의 `title` 필드가 `"8번타자 최재훈"` 형식 → 정규식 `^\d+번타자\s+(.+)` 로 이름 파싱 → relay 응답의 `batter.name`에 포함

#### 감정표현 반전 문제
- **증상**: OTA 이후 이기고 있는 팀이 우는(crying) 감정표현으로 표시됨 (반대로 찍힘)
- **원인**: `buildWidgetProps()`에 하드코딩된 `homeIsMyTeam: false`가 FCM 경로를 통해 `_lastWidgetGame` 캐시로 유입. `_lastWidgetGame`이 없을 때 이 false 값이 그대로 사용되어 `isMyHome`이 항상 false로 평가 → 원정팀 기준으로 감정 계산 → 실제 홈팀 응원 시 감정 반전
- **해결**: `buildWidgetProps()`에서 `homeIsMyTeam` 제거 (FCM 경로에선 `_lastWidgetGame` fallback으로만 설정). `WidgetGameData.homeIsMyTeam`을 optional로 변경

#### 2x2 1/3루 색칠 안 됨 문제
- **증상**: 2x2 위젯에서 1루/3루 다이아몬드(◆)가 보이지 않고, 보이더라도 inactive 색상(검정)으로만 표시. 4x2는 정상
- **원인**: `BaseSituation` 감싸는 `FlexWidget`에 `height: 22` 제한이 걸려 있어 2단 다이아몬드 구조(2루 1줄 + 1,3루 1줄 ≈ 30px)가 잘려나감. 2루만 보이고 1,3루는 clipping
- **해결**: `height: 22` 제거 → 컨테이너가 내용물 높이에 맞게 자동 확장

### 커밋 로그 (추가)
```
6284299 fix(widget): remove hardcoded homeIsMyTeam=false causing reversed emotions
41cbe39 fix(widget): improve currentPitcher fallback when relay.isTop missing
fd33c07 fix(widget): use schedule API current pitcher names for P/B display
17e4fca fix(widget): remove height constraint clipping 1st/3rd base in 2x2
```

#### 타자명 고정 버그 + 앱 GameCard 투수 미표시

**타자명 고정 (항상 "한승택")**:
- **원인**: textRelays 배열에서 가장 최근 `X번타자 NAME` 항목을 사용 → textRelays가 실시간 갱신되지 않아 이전 타자 이름이 계속 반환됨
- **서버 해결**: textRelays 전체를 스캔해 `pcode→name` 맵을 구축하고, `currentGameState.batter` pcode로 현재 타자명 조회. 12명 매핑 성공 → 실시간 추적 가능

**앱 GameCard 투수 미표시 (P: 대신 "-" 표시)**:
- **원인**: GameCard가 `relay.pitcher?.name`을 직접 사용 → 서버 p2n lookup 실패로 항상 빈 값
- **해결 (2단계)**:
  1. `GameCard.tsx`: `relay.pitcher?.name`이 빈 값일 때 선발투수(`awayPitcher`/`homePitcher`)로 폴백
  2. `home.tsx`: widget data enrichment 시 `isTop` 기준으로 `homeCurrentPitcher`/`awayCurrentPitcher`를 `relay.pitcher.name`에 주입 → 현재 투수 실시간 반영 (Naver API에서 불펜 교체도 업데이트됨)

#### FCM Push 비활성화

- **배경**: 서버 `push_worker.py`가 1:1 개별 FCM 전송 방식 → 수백 명만 돼도 병목 발생, 수십 초~수 분 지연
- **판단**: 앱 폴링(16s) + 위젯 포그라운드 서비스(5s) + 수동 REFRESH로도 실시간성 충분히 확보 가능
- **결정**: FCM을 끄고 폴링/포그라운드 기반으로만 운영
- **서버 설정**: `/etc/systemd/system/fullcount-api.service.d/push-override.conf` → `ENABLE_PUSH_NOTIFICATIONS=false` + `systemctl restart`

### Phase 24: 위젯 1.3.1 안정화 + 서버 최적화 (2026-06-19)

**브랜치**: `test/stable-build` → 1.3.1 (35), master → iOS OTA 1.2.0

#### 서버: widget_worker 경량 프록시로 전환 (243MB → 28MB)
- Naver API 호출을 main:8000으로 통합 (중복 호출 제거)
- widget_worker:8001 → 1초 타이머로 main 폴링, in-memory 캐시 서빙만
- `/widget-data` 요청 절대 블로킹 없음 (항상 2ms 응답)
- systemd `fullcount-widget.service` 등록 (재부팅 생존)

#### 서버: KBO fallback 추가
- Naver API 실패 시 `today-games.json`(KBO API)로 폴백
- `_naver_status()`: 텍스트/숫자 상태코드 모두 지원
- `statusCode` 필드명 수정 (Naver API 변경 대응)
- gameId에서 팀코드 파싱 fallback

#### 서버: relay 캐시 백오프
- 실패 시 `[1, 1, 3, 5, 5, 10]`초 간격으로 재시도
- 성공 시 카운터 초기화
- rate limiter localhost 예외 처리

#### 앱: widget-data SSOT로 데이터 소스 통일
- `home.tsx`: 오늘 경기 정보 `/widget-data` 단일 소스로
- `nextGames`만 `/today-games` 유지
- `SHORT_CODE_TO_TEAM_ID` 매핑으로 Naver코드↔내부ID 변환
- widget-data → TodayGame 컨버터 추가

#### 앱: TypeScript 오류 27→0
- `WidgetRelay`: `inning`/`isTop` 필드 추가
- `JikgwanRecord` import 누락 수정
- `GridTimeline`: `parseDotDate` import 경로 수정
- `StickerModal`: ref null guard + `setCapturing` 상태 수정
- `DiaryEntryModal`: `isFutureGame` prop 전달
- `records.ts`: `is_planned` Pick 타입 추가
- `notification.ts`: Expo 54 `presentNotificationAsync`→`scheduleNotificationAsync`
- `WidgetGameData`: `homeIsMyTeam` optional→required 통일

#### 푸시 최적화
- `push_worker`: BSO/주루 변경 감지 제거, 이닝 변경 감지 추가
- 경기전 30분 간격 weather refresh push 추가
- 경기당 푸시: ~24~29회 (득점 5-10 + 이닝 17 + 상태 2)

#### 위젯 UI
- 4x2 취소 레이아웃 추가 (구장+날씨 헤더)
- 2x2 취소 레이아웃 헤더 추가
- `getMyTeamForWidget()`: DB fallback 추가 (기존 사용자 마이팀 인식)

#### 커밋
```
test/stable-build:
91b6d91 fix(server): Naver API SSOT - widget_worker to proxy, statusCode fix, inning parser
e9c7916 feat: KBO API fallback + mobile widget-data SSOT consolidation
8120fe2 fix: resolve all TypeScript errors (27→0)
cc5cb3a fix: code review - KBO fallback score field, StickerModal capturing state
50ee050 fix(server): shorten relay cache TTL to 1s on failure (was 5s)
1443fe6 fix(server): exponential backoff for relay failures (1,1,3,5,5,10s)
09061cc fix(server): exempt localhost from rate limiter
e48513b fix(push): add inning change detection, remove BSO/base triggers
8efeb6d fix(widget): add 4x2 cancelled view, add header to 2x2 cancelled
7853019 feat(push): add 30min weather refresh push for scheduled games
0796add fix(widget): fallback to DB for existing users without widget team

master:
3242381 fix(ios): port server/data fixes from test/stable-build for iOS 1.2.0
8d5bb0e fix(ios): set runtimeVersion 1.2.0 for iOS OTA
```

**OTAs**: Android 1.3.1 (4회), iOS 1.2.0 (1회)

---

**FCM OFF 상태에서 실시간 갱신 흐름**:
| 상태 | 갱신 방식 | 주기 |
|------|-----------|------|
| 앱 활성 + 홈탭 focused | `useFocusEffect` 폴링 | 16초 |
| 포그라운드 서비스 ON | `LiveScoreService` → HeadlessTask | 5초 |
| 백그라운드 (앱 OFF, 서비스 OFF) | Android WorkManager | 15~30분 |
| 사용자 수동 | 위젯 REFRESH 버튼 | 즉시 + 포그라운드 시작 |

#### 서버 동시접속자 용량 분석

- **스펙**: Oracle Ampere 2 OCPU, 12GB RAM
- **병목 제거 후**: `/widget-data` 인메모리 캐시 (TTL 7s), FCM OFF
- **추정**: 싱글 uvicorn → ~10,000명, workers=4 → ~30,000~40,000명
- **주요 개선 포인트**: 이미 인메모리 캐싱 + Rate Limit(100/min) 적용 완료

### 커밋 로그 (추가)
```
feat/widget-views-decoupled:
d4dab66 fix(home): inject current pitcher name into relay for GameCard display
acebe62 fix(GameCard): fall back to starter name when relay pitcher name is empty
a711952 docs: record pitcher/batter name fix + emotion reversal + 2x2 base clipping
6284299 fix(widget): remove hardcoded homeIsMyTeam=false causing reversed emotions
41cbe39 fix(widget): improve currentPitcher fallback when relay.isTop missing
fd33c07 fix(widget): use schedule API current pitcher names for P/B display

master:
23942a7 fix(home): inject current pitcher name into relay for GameCard display
0c0563a fix(GameCard): fall back to starter name when relay pitcher name is empty
```
```