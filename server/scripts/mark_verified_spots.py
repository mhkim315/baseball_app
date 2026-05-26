"""1회성: 주차장 좌표를 추정치(verified:false)로 표시하고 카카오 보정된 좌표를 확인."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "stadium-surroundings.json"

# 이전 스크립트에서 보정된 spot 이름들 (구장ID_spot이름)
VERIFIED = {
    "잠실한강공원 주차장", "롯데월드몰 주차장", "석촌호수 공영주차장",
    "아시아공원 공영주차장", "탄천 공영주차장",
    "고척근린공원 공영주차장", "구로구청 공영주차장",
    "문학경기장 공영주차장", "인천문화예술회관 주차장",
    "장안구청 공영주차장", "홈플러스 북수원점",
    "만석공원 공영주차장", "이마트 북수원점",
    "부사동 공영주차장", "대전역 동광장 공영주차장",
    "중앙시장 공영주차장", "대전 중구청 공영주차장",
    "대구스타디움 주차장", "대공원역 공영주차장", "수성알파시티 공영주차장",
    "무등야구장 지하주차장", "임동 공영주차장", "광주 북구청 공영주차장", "광주역 공영주차장",
    "홈플러스 아시아드점", "부산종합운동장 주차장",
    "사직동 제일주차장", "사직동 거성주차장",
    "양덕 공영주차장", "롯데마트 양덕점", "봉암공단 주차장",
}

data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
count = 0
for sid, stadium in data["stadiums"].items():
    for spot in stadium["spots"]:
        if spot["kind"] == "parking":
            spot["verified"] = spot["name"] in VERIFIED
            if spot["verified"]:
                count += 1

DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Marked {count} verified spots out of all parking spots")
