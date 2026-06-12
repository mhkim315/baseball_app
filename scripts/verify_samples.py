import sys
import json
import random
import re
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
from naver_api import schedule_games

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / 'mobile' / 'lib' / 'data'

years = [2021, 2022, 2023, 2024, 2025]
samples = {}

for y in years:
    p = DATA_DIR / f'scores_{y}.json'
    if p.exists():
        with open(p, encoding='utf-8') as f:
            d = json.load(f)
            dates = list(d.keys())
            if dates:
                # Pick 2 random dates
                chosen = random.sample(dates, min(2, len(dates)))
                for dt in chosen:
                    samples[dt] = d[dt]

# Special handling for 2026 (TS file)
ts_p = ROOT / 'mobile' / 'lib' / 'scores_2026.ts'
if ts_p.exists():
    content = ts_p.read_text(encoding='utf-8')
    match = re.search(r'export const SCORES_2026[^=]*=\s*(\{.*?\});', content, re.DOTALL)
    if match:
        try:
            # We can use json.loads if the object keys are quoted.
            # But TS might not have quoted keys. We can just use node to parse it.
            pass
        except:
            pass

print("=== VERIFICATION REPORT ===")
for dt in sorted(samples.keys()):
    print(f"\nChecking {dt}...")
    local_games = samples[dt]
    naver_games = schedule_games(dt, dt)
    
    for lg in local_games:
        if lg.get('cancelled'):
            continue
        # Find matching game in Naver API
        match = next((ng for ng in naver_games if ng.get('categoryId') == 'kbo' and ng.get('awayTeamName') == lg.get('away') and ng.get('homeTeamName') == lg.get('home')), None)
        
        if match:
            na_s = match.get('awayTeamScore')
            nh_s = match.get('homeTeamScore')
            la_s = lg.get('awayScore')
            lh_s = lg.get('homeScore')
            out = lg.get('outcome')
            
            if la_s is None or lh_s is None:
                continue
                
            expected_out = "W" if la_s > lh_s else "L" if lh_s > la_s else "T"
            
            print(f"  {lg['away']}@{lg['home']}: Local {la_s}-{lh_s} (out:{out}) | Naver {na_s}-{nh_s}")
            if la_s != na_s or lh_s != nh_s:
                print("    >>> ❌ SCORE MISMATCH!!!")
            if out != expected_out:
                print(f"    >>> ❌ OUTCOME MISMATCH! Expected {expected_out}, got {out}")
        else:
            print(f"  {lg['away']}@{lg['home']}: NOT FOUND IN NAVER")
