from __future__ import annotations
import subprocess, sys, time
from pathlib import Path

DATA = Path("/home/opc/fullcount_backend/repo/data/seasons")
SCRIPTS = Path("/home/opc/fullcount_backend/repo/scripts")
years = ["2020", "2021", "2022", "2023", "2024"]

# Wait for all season JSONs
print("Waiting for season files...", flush=True)
while True:
    missing = []
    for y in years:
        p = DATA / y / "regular-season.json"
        if not p.exists():
            missing.append(y)
    if not missing:
        break
    print(f"  Still waiting for: {', '.join(missing)}", flush=True)
    time.sleep(30)

print("All season files ready! Starting backfill...", flush=True)
result = subprocess.run(
    [sys.executable, str(SCRIPTS / "backfill_multi_year.py"), "--years", "2020,2021,2022,2023,2024"],
)
sys.exit(result.returncode)
