#!/bin/bash
# Deploy server/data_api/main.py to OCI
# Usage: ./deploy.sh [user@host] [port]
# Requires: ~/.ssh/oracle.key

HOST="${1:-opc@168.107.59.177}"
PORT="${2:-22}"

echo "=== Deploying data API server ==="

# Copy main.py
scp -P "$PORT" -i ~/.ssh/oracle.key main.py "$HOST:/home/opc/fullcount_backend/main.py" || { echo "SCP main.py failed"; exit 1; }

# Ensure scripts directory exists and copy naver_api.py
ssh -p "$PORT" -i ~/.ssh/oracle.key "$HOST" "mkdir -p /home/opc/fullcount_backend/scripts" || { echo "mkdir scripts failed"; exit 1; }
scp -P "$PORT" -i ~/.ssh/oracle.key ../../scripts/naver_api.py "$HOST:/home/opc/fullcount_backend/scripts/naver_api.py" || { echo "SCP naver_api.py failed"; exit 1; }

# Install dependencies and restart service
ssh -p "$PORT" -i ~/.ssh/oracle.key "$HOST" "sudo pip3 install cachetools && sudo systemctl restart fullcount-api.service && sleep 2 && sudo systemctl status fullcount-api.service --no-pager -l" || { echo "Restart failed"; exit 1; }

echo "=== Deploy complete ==="
