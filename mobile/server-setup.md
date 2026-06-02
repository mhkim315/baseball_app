# 서버 설정 (Oracle Cloud)

## 접속
- **Host:** 168.107.59.177
- **User:** opc
- **Key:** `~/.ssh/oracle.key`
- **명령어:** `ssh -i ~/.ssh/oracle.key opc@168.107.59.177`

## 서비스 구성

### API 서버 (systemd)
- **서비스명:** `fullcount-api.service`
- **실행:** `/home/opc/fullcount_backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000`
- **WorkingDir:** `/home/opc/fullcount_backend/`
- **재시작:** `sudo systemctl restart fullcount-api.service`
- **로그:** `journalctl -u fullcount-api.service -f`

### Nginx (reverse proxy)
- **도메인:** `api.fullcount.kr` → localhost:8000
- **SSL:** `/etc/nginx/ssl/api.fullcount.kr.cer` (Let's Encrypt via acme.sh)
- **CORS:** 모든 origin 허용
- **설정:** `/etc/nginx/conf.d/default.conf`
- **관련 명령어:** `sudo nginx -t`, `sudo systemctl reload nginx`

### acme.sh (SSL 갱신)
- **cron:** 매일 12:30 실행 (`30 12 * * *`)
- **설치:** `/home/opc/.acme.sh/`

## 디렉토리 구조

```
/home/opc/
├── fullcount_backend/
│   ├── main.py              # 실제 서빙 중인 API (직접 배포, repo 외부)
│   ├── collector.py          # 데이터 수집기
│   ├── venv/                 # Python 가상환경
│   ├── repo/
│   │   ├── server/           # server git repo (server/data_api/main.py)
│   │   ├── shared/           # 공유 타입
│   │   └── data/             # JSON 데이터 파일
│   │       ├── daily-scores.json
│   │       ├── today-games.json
│   │       ├── kbo_standings*.json
│   │       ├── kbo_schedule_2026.json
│   │       ├── seasons/
│   │       └── teams/        # game-records (팀별/일자별)
│   ├── api.log
│   ├── collector.log
│   └── server.log
├── upgrade_oci.sh            # OCI VM 업그레이드 스크립트 (현재 중단)
├── .oci/                     # OCI CLI 설정
└── shared/                   # 앱-서버 공유 타입 복사본
```

## 배포 방식

### API 코드 반영 (main.py)
```bash
# 1. 로컬에서 server/data_api/main.py 수정 후 git push
# 2. 서버에서 git pull
cd /home/opc/fullcount_backend/repo && git pull origin master
# 3. main.py 복사
cp /home/opc/fullcount_backend/repo/server/data_api/main.py /home/opc/fullcount_backend/main.py
# 4. 서비스 재시작
sudo systemctl restart fullcount-api.service
```

### collector.py 반영
```bash
cp /home/opc/fullcount_backend/repo/server/data_api/collector.py /home/opc/fullcount_backend/collector.py
```

> **참고:** `main.py`와 `collector.py`는 repo 밖에 별도 파일로 존재. git pull 후 직접 복사 필요.

## 서비스 관리

```bash
sudo systemctl status fullcount-api.service   # 상태 확인
sudo systemctl restart fullcount-api.service   # 재시작
sudo journalctl -u fullcount-api.service -n 50 # 최근 로그 50줄
sudo journalctl -u fullcount-api.service -f    # 로그 실시간
```

## 방화벽 (iptables)
- 22/tcp (SSH)
- 80/tcp (HTTP → redirect 301)
- 443/tcp (HTTPS)

## VM 스펙
- **Shape:** VM.Standard.A1.Flex
- **OCPU:** 2 (1 OCPU → 2 OCPU 업그레이드 완료)
- **RAM:** 12 GB
- **OS:** Oracle Linux
- **리전:** Chuncheon (KR)

## 데이터 백업
- **핵심 데이터:** `/home/opc/fullcount_backend/repo/data/`
- **설정:** systemd service, nginx, crontab
- **방법:** `scp -i ~/.ssh/oracle.key -r opc@168.107.59.177:/home/opc/fullcount_backend/repo/data/ ./backup/`
