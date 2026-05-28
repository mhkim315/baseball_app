# Fullcount 서버 백업 — 2026-05-28

## 포함된 파일

| 파일 | 설명 |
|------|------|
| `main.py` | FastAPI 데이터 API 서버 (uvicorn) |
| `collector.py` | 데이터 수집 스케줄러 (3~5분 간격) |
| `fullcount-api.service` | systemd 서비스 파일 |
| `nginx-api.conf` | nginx reverse proxy 설정 (api.fullcount.kr) |
| `server_data.tar.gz` | JSON 데이터 파일 + seasons 디렉토리 (12MB) |
| `fullcount_db.sql` | PostgreSQL 데이터베이스 덤프 (7.8KB) |

## 복구 방법

```bash
# 1. Python 파일 복사
cp main.py collector.py /home/opc/fullcount_backend/

# 2. 데이터 복원
tar xzf server_data.tar.gz -C /home/opc/fullcount_backend/repo/

# 3. systemd 서비스 복원
sudo cp fullcount-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart fullcount-api.service

# 4. nginx 설정 복원
sudo cp nginx-api.conf /etc/nginx/conf.d/
sudo nginx -s reload
```

## Git

서버 코드는 `server/data_api/main.py`에서 git 관리 중.
배포: `server/data_api/deploy.sh`
