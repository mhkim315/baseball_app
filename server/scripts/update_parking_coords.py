"""
Kakao Local API로 stadium-surroundings.json의 주차장 좌표를 보정.
구장 기준 3km 이내 결과만 반영. 지역 컨텍스트 포함 검색.
"""
from __future__ import annotations

import json
import math
import time
import urllib.parse
import urllib.request
from pathlib import Path

KAKAO_API_KEY = ""  # 직접 발급받은 REST API 키를 입력하세요
KAKAO_SEARCH_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "stadium-surroundings.json"

# 구장 ID별 지역 컨텍스트 + 중심 좌표
STADIUM_META = {
    "1": {"name": "잠실야구장", "area": "서울 송파구 잠실", "center": (127.0720, 37.5124)},
    "2": {"name": "고척스카이돔", "area": "서울 구로구 고척동", "center": (126.8673, 37.4982)},
    "3": {"name": "SSG 랜더스필드", "area": "인천 미추홀구 문학", "center": (126.6933, 37.4368)},
    "4": {"name": "KT 위즈파크", "area": "경기 수원 장안구", "center": (127.0097, 37.2998)},
    "5": {"name": "대전 한화생명 볼파크", "area": "대전 중구 부사동", "center": (127.4291, 36.3171)},
    "6": {"name": "삼성라이온즈파크", "area": "대구 수성구 연호동", "center": (128.6816, 35.8409)},
    "7": {"name": "기아챔피언스필드", "area": "광주 북구 임동", "center": (126.8891, 35.1681)},
    "8": {"name": "사직야구장", "area": "부산 동래구 사직동", "center": (129.0616, 35.1940)},
    "9": {"name": "창원 NC파크", "area": "경남 창원 마산회원구 양덕", "center": (128.5818, 35.2224)},
}

MAX_DISTANCE_KM = 3.0  # 이 거리 이상이면 무시


def haversine_km(lng1, lat1, lng2, lat2):
    """두 지점 간 거리 (km)."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def kakao_search(query: str) -> list[dict]:
    """카카오 로컬 API 키워드 검색. 최대 5개 결과 반환."""
    params = urllib.parse.urlencode({"query": query, "size": 5})
    req = urllib.request.Request(
        f"{KAKAO_SEARCH_URL}?{params}",
        headers={"Authorization": f"KakaoAK {KAKAO_API_KEY}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"    API 오류: {e}")
        return []
    return data.get("documents", [])


def find_best_match(spot_name: str, area: str, center: tuple) -> dict | None:
    """지역 컨텍스트 포함 검색. 구장 중심 3km 이내만 허용."""
    clng, clat = center

    # 검색어 후보: 지역명 + 주차장명 조합
    queries = [
        f"{area} {spot_name}",
        spot_name,
    ]

    for q in queries:
        results = kakao_search(q)
        for doc in results:
            dist = haversine_km(clng, clat, float(doc["x"]), float(doc["y"]))
            if dist <= MAX_DISTANCE_KM:
                return {
                    "lng": round(float(doc["x"]), 7),
                    "lat": round(float(doc["y"]), 7),
                    "name": doc["place_name"],
                    "address": doc.get("address_name", ""),
                    "distance_km": round(dist, 2),
                }
        time.sleep(0.15)

    return None


def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    stadiums = data["stadiums"]
    updated = 0
    failed = 0

    for stadium_id, spots in stadiums.items():
        meta = STADIUM_META[stadium_id]
        sname = meta["name"]
        area = meta["area"]
        center = meta["center"]
        print(f"\n{'='*50}")
        print(f"구장 {stadium_id}: {sname} ({area})")
        print(f"{'='*50}")

        for spot in spots.get("spots", []):
            if spot["kind"] != "parking":
                continue

            spot_name = spot["name"]
            old_lng = spot["lng"]
            old_lat = spot["lat"]
            print(f"\n  검색: {spot_name}")
            print(f"    기존: {old_lng:.6f}, {old_lat:.6f}")

            result = find_best_match(spot_name, area, center)

            if result:
                spot["lng"] = result["lng"]
                spot["lat"] = result["lat"]
                print(f"    → 수정: {result['lng']:.6f}, {result['lat']:.6f}")
                print(f"    ({result['name']}, {result['address']}, {result['distance_km']}km)")
                updated += 1
            else:
                print(f"    → 3km 이내 검색 결과 없음 (기존 유지)")
                failed += 1

            time.sleep(0.25)

    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n{'='*50}")
    print(f"완료: {updated}개 수정, {failed}개 실패 → {DATA_PATH}")


if __name__ == "__main__":
    main()
