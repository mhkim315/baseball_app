# Fullcount.kr Mobile App — 개발 작업 문서

> 마지막 업데이트: 2026-05-18
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
