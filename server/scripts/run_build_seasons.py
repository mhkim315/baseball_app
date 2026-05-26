from __future__ import annotations
import subprocess, sys

scripts_dir = "/home/opc/fullcount_backend/repo/scripts"
years = [2022, 2023, 2024]

for y in years:
    print(f"\n===== YEAR {y} =====")
    subprocess.run(
        [sys.executable, f"{scripts_dir}/build_season.py", "--year", str(y), "--output-dir", "data/seasons"],
        check=True,
    )
    print(f"===== YEAR {y} DONE =====")
