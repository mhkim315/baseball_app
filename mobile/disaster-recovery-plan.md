# 서버 장애 복구 플랜 (Disaster Recovery)

> 대상: OCI Chuncheon VM.Standard.A1.Flex (2 OCPU, 12GB RAM)
> 작성일: 2026-06-01

---

## 1. 복구 전략 개요

**목표:** VM 회수/장애 시 1시간 내 새 서버 복구
**우선순위:** JSON 데이터(196MB) > SSL 인증서 > API 코드 > DB

복구 옵션:
| 옵션 | 비용 | 시간 | 난이도 |
|:-----|:---:|:---:|:-----:|
| OCI 새 VM (같은 리전) | 무료 | ~30분 | 하 |
| OCI 새 VM (다른 리전) | 무료 | ~30분 | 중 |
| 유료 클라우드 (최저 사양) | ~$5-10/월 | ~1시간 | 중 |
| 로컬 임시 서버 | 없음 | 즉시 | 상 (외부 접근 필요) |

---

## 2. 사전 준비 (이미 완료)

| 항목 | 위치 | 상태 |
|:-----|:-----|:----:|
| JSON 데이터 | `server-backup/YYYY-MM-DD/data/` | ✅ 일간 자동 백업 |
| nginx 설정 | `server-backup/YYYY-MM-DD/nginx-config/api.conf` | ✅ 1회 백업 |
| SSL 인증서 | `server-backup/YYYY-MM-DD/nginx-config/api.fullcount.kr.cer` | ✅ 1회 백업 |
| SSL 개인키 | `server-backup/YYYY-MM-DD/nginx-config/api.fullcount.kr.key` | ✅ 1회 백업 |
| main.py | `server-backup/YYYY-MM-DD/main.py` | ✅ 1회 백업 |
| collector.py | `server-backup/YYYY-MM-DD/collector.py` | ✅ 1회 백업 |
| 서버 설정 문서 | `mobile/server-setup.md` | ✅ |
| GitHub repo | `https://github.com/mhkim315/baseball.git` | ✅ |

---

## 3. 복구 절차

### Step 1: 새 VM 프로비저닝

**OCI 같은 리전:**
```bash
# OCI CLI로 새 인스턴스 생성 (또는 콘솔에서 수동)
oci compute instance launch \
  --availability-domain AD-1 \
  --compartment-id ocid1.compartment.oc1..xxxx \
  --shape VM.Standard.A1.Flex \
  --shape-config '{"ocpus":1,"memoryInGBs":6}' \
  --subnet-id ocid1.subnet.oc1..xxxx \
  --image-id ocid1.image.oc1..xxxx \
  --ssh-authorized-keys-file ~/.ssh/id_rsa.pub
```

**유료 클라우드 (예: 최저 Spec):**
- `t3.micro` (2 vCPU, 1GB RAM, $8/월) 또는 `t4g.nano` ($5/월)
- Ubuntu 22.04 LTS
- Elastic IP 확보

### Step 2: 기본 설정

```bash
# 패키지 설치
sudo dnf install -y nginx python3.11 git postgresql-server

# Python 가상환경
python3 -m venv /home/opc/fullcount_backend/venv

# pip 패키지 설치
/home/opc/fullcount_backend/venv/bin/pip install \
  fastapi==0.128.8 uvicorn==0.39.0 APScheduler==3.11.2 \
  beautifulsoup4==4.14.3 requests==2.32.5 \
  psycopg2-binary==2.9.12 pydantic==2.13.4 \
  SQLAlchemy==2.0.49 python-dotenv==1.2.1
```

> **참고:** 전체 패키지 목록은 `server-backup/YYYY-MM-DD/pip-list.txt` 참고

### Step 3: 데이터 복원

```bash
# 1. GitHub에서 repo clone
git clone https://github.com/mhkim315/baseball.git /home/opc/fullcount_backend/repo

# 2. JSON 데이터 복원 (백업에서)
cp -r server-backup/YYYY-MM-DD/data/* /home/opc/fullcount_backend/repo/data/

# 3. main.py 복원
cp server-backup/YYYY-MM-DD/main.py /home/opc/fullcount_backend/main.py

# 4. collector.py 복원 (있으면)
cp server-backup/YYYY-MM-DD/collector.py /home/opc/fullcount_backend/collector.py
```

### Step 4: nginx + SSL 설정

```bash
# nginx 설정 복사
sudo cp server-backup/YYYY-MM-DD/nginx-config/api.conf /etc/nginx/conf.d/
sudo cp server-backup/YYYY-MM-DD/nginx-config/api.fullcount.kr.cer /etc/nginx/ssl/
sudo cp server-backup/YYYY-MM-DD/nginx-config/api.fullcount.kr.key /etc/nginx/ssl/
sudo nginx -t && sudo systemctl reload nginx

# 만약 SSL 재발급 필요 시 (acme.sh)
curl https://get.acme.sh | sh
~/.acme.sh/acme.sh --issue -d api.fullcount.kr --nginx
~/.acme.sh/acme.sh --install-cert -d api.fullcount.kr \
  --key-file /etc/nginx/ssl/api.fullcount.kr.key \
  --fullchain-file /etc/nginx/ssl/api.fullcount.kr.cer
```

### Step 5: systemd 서비스 등록

```bash
# /etc/systemd/system/fullcount-api.service 생성
sudo tee /etc/systemd/system/fullcount-api.service << 'EOF'
[Unit]
Description=Fullcount API Server
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=opc
WorkingDirectory=/home/opc/fullcount_backend
ExecStart=/home/opc/fullcount_backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5
Environment=PYTHONUNBUFFERED=1
Environment=DATABASE_URL=postgresql://fullcount_user:fullcount_pass_2026@localhost/fullcount_db
Environment=DATA_DIR=/home/opc/fullcount_backend/repo/data

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now fullcount-api.service
sudo systemctl status fullcount-api.service
```

### Step 6: 방화벽 확인

```bash
sudo firewall-cmd --add-service=http --add-service=https --permanent
sudo firewall-cmd --reload
```

### Step 7: DNS 변경

- **DNS 레코드:** `api.fullcount.kr` → 새 VM 공인 IP
- **TTL:** 300초 (5분) → 짧게 설정해두는 게 좋음
- **전파 시간:** 보통 1~10분, 최대 30분

---

## 4. PostgreSQL DB (cheering_songs, games, stadiums, standings, teams)

**현재 DB 상태:**
- 크기: 매우 작음 (metatables 위주)
- 용도: 응원가/구장/팀 정보 + standings 일부
- 주요 데이터는 JSON 파일이 커버

**복구 방법:**
```bash
# DB 백업 파일 확인 (server-backup에 없으면 재생성 가능)
# fullcount_db.sql 있으면 복원
sudo -u postgres psql -f fullcount_db.sql

# 없으면 앱 구동에 치명적이지 않음 — JSON 데이터로 메인 기능 동작
```

> **참고:** DB에는 정적 메타데이터(응원가, 구장, 팀) 위주. daily-scores, game-detail 등 핵심 실시간 데이터는 JSON 파일.

---

## 5. 주의사항 및 체크리스트

### 복구 후 검증

```bash
# 1. 서비스 동작 확인
curl -s http://127.0.0.1:8000/today-games | head -c 100

# 2. nginx HTTPS
curl -s https://api.fullcount.kr/today-games | head -c 100

# 3. JSON 데이터 정상
curl -s https://api.fullcount.kr/daily-scores?date=2026-05-28 | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(f'games: {len(d.get(\"games\",[]))}')"
```

### SSL 만료일
- 현재 인증서: **2026-08-10**까지 유효
- acme.sh cron으로 자동 갱신됨 (매일 12:30)
- 만약 새 VM이면 acme.sh 재설치 후 재발급

### OCI 회수 징후
- OCI 계정 이메일 수시 확인 (스팸함 포함)
- 24시간 평균 CPU 10% 미만 지속 시 위험
- 사용량이 없다면 의도적으로 health check 요청을 추가 고려

---

## 6. 로컬 백업 파일 구조

```
server-backup/
├── 2026-06-01/
│   ├── data/                    # JSON 데이터 (196MB)
│   │   ├── daily-scores.json
│   │   ├── today-games.json
│   │   ├── kbo_standings*.json
│   │   ├── kbo_schedule_2026.json
│   │   ├── seasons/
│   │   └── teams/               # game-records
│   ├── main.py                  # API 서버 코드
│   ├── collector.py             # 데이터 수집기
│   └── nginx-config/
│       ├── api.conf             # nginx reverse proxy 설정
│       ├── api.fullcount.kr.cer # SSL 인증서
│       └── api.fullcount.kr.key # SSL 개인키
└── ... (일자별)
```

---

## 7. 최악의 시나리오: 백업도 없고 VM도 사라짐

**남은 것:** GitHub repo (코드 + 빌드 스크립트)

**복구 가능한 데이터:**
- 공통 타입, API 코드 — GitHub에서 100% 복원
- JSON 데이터 — collector를 실행하면 스스로 수집 시작

**복구 불가:**
- 일부 game-records (collector는 향후 데이터만 수집)
- 누락분은 `server/data_collection/merge_scores.js`로 재수집 필요

**결론:** 코드는 안전. 데이터는 시간 지연만 있을 뿐 다시 쌓을 수 있음.

---

## 8. 문서 위치

- 서버 설정: `mobile/server-setup.md`
- 복구 플랜: `mobile/disaster-recovery-plan.md` (이 파일)
- 로컬 백업: `server-backup/YYYY-MM-DD/`
- 서버 API 코드: `server/data_api/main.py` (GitHub)
