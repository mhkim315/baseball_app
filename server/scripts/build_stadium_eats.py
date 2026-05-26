"""
Kakao Local API로 9개 구장 주변 맛집 accuracy 기준 검색.
카테고리 6개 × 권역 2개(2km·5km) × 구장 9개 = 108회 검색.
"""
from __future__ import annotations

import json
import ssl
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "data" / "stadium-eats.json"

KAKAO_SEARCH_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
KAKAO_API_KEY = "4a9e8454d66ef173dd9003a06e35ad48"

STADIUMS = {
    "1": {"name": "잠실야구장", "lng": 127.0720, "lat": 37.5124, "region": "서울 송파구"},
    "2": {"name": "고척스카이돔", "lng": 126.8673, "lat": 37.4982, "region": "서울 구로구"},
    "3": {"name": "SSG 랜더스필드", "lng": 126.6933, "lat": 37.4368, "region": "인천 미추홀구"},
    "4": {"name": "KT 위즈파크", "lng": 127.0097, "lat": 37.2998, "region": "수원 장안구"},
    "5": {"name": "한화생명 볼파크", "lng": 127.4291, "lat": 36.3171, "region": "대전 중구"},
    "6": {"name": "삼성라이온즈파크", "lng": 128.6816, "lat": 35.8409, "region": "대구 수성구"},
    "7": {"name": "기아챔피언스필드", "lng": 126.8891, "lat": 35.1681, "region": "광주 북구"},
    "8": {"name": "사직야구장", "lng": 129.0616, "lat": 35.1940, "region": "부산 동래구"},
    "9": {"name": "창원 NC파크", "lng": 128.5818, "lat": 35.2224, "region": "창원 마산회원구"},
}

# 6개 카테고리 × 검색 키워드
CATEGORIES = [
    ("치킨·호프", ["옛날통닭", "치킨호프"]),
    ("고깃집", ["돼지갈비", "소갈비"]),
    ("밥집·국밥", ["국밥", "한식"]),
    ("카페·디저트", ["로스터리카페", "디저트카페"]),
    ("술집·이자카야", ["이자카야", "요리주점"]),
    ("면·분식", ["칼국수", "막국수"]),
]

# 제외할 프랜차이즈 키워드 (이름에 포함되면 스킵)
FRANCHISE = [
    # 치킨
    "교촌", "BBQ", "BHC", "굽네", "페리카나", "네네", "멕시카나", "푸라닭",
    "호식이두마리", "또래오래", "60계", "지코바", "자담", "처갓집",
    "가마로", "땅땅", "디디", "뿌리", "치킨플러스", "계동",
    "맘스터치", "롯데리아", "KFC", "맥도날드", "버거킹", "서브웨이",
    "노브랜드버거", "쉐이크쉑", "모스버거", "크리스피",
    # 피자
    "도미노", "피자헛", "미스터피자", "피자스쿨", "피자알볼로", "피자마루",
    "59쌀피자", "청년피자", "고피자",
    # 커피/카페/디저트
    "스타벅스", "이디야", "투썸", "할리스", "커피빈", "빽다방",
    "메가MGC", "컴포즈", "파스쿠찌", "탐앤탐스", "엔제리너스", "공차",
    "설빙", "배스킨라빈스", "던킨", "파리바게뜨", "뚜레쥬르",
    "파리크라상", "파스쿠찌", "커피에반하다", "더벤티", "매머드",
    # 한식/분식 프랜차이즈
    "본죽", "본도시락", "김가네", "한솥", "놀부", "원할머니", "하남돼지",
    "새마을식당", "육쌈냉면", "맛있는술상", "역전우동", "명랑핫도그",
    "아딸", "죠스떡볶이", "신전떡볶이", "두끼", "배떡", "청년다방",
    # 중식/일식 프랜차이즈
    "홍콩반점", "티원", "사보텐", "스시노칸다", "갓덴스시",
    # 주점 프랜차이즈
    "생활맥주", "비어킹", "치어스", "크라운호프", "맥주창고",
    # 기타
    "CU", "GS25", "세븐일레븐", "이마트24", "미니스톱",
]

def is_franchise(name: str) -> bool:
    for f in FRANCHISE:
        if f.lower() in name.lower():
            return True
    return False

PER_PAGE = 10
CTX = ssl.create_default_context()


def kakao_search(query: str, x: float, y: float, radius: int, page: int = 1) -> list[dict]:
    params = urllib.parse.urlencode({
        "query": query, "x": str(x), "y": str(y), "radius": str(radius),
        "sort": "accuracy", "size": PER_PAGE, "page": page,
    })
    req = urllib.request.Request(
        f"{KAKAO_SEARCH_URL}?{params}",
        headers={"Authorization": f"KakaoAK {KAKAO_API_KEY}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15, context=CTX) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"      API error: {e}")
        return []
    docs = data.get("documents", [])
    return [{"name": d["place_name"], "lng": float(d["x"]), "lat": float(d["y"]),
             "address": d.get("address_name", ""), "phone": d.get("phone", ""),
             "category": d.get("category_name", "")} for d in docs]


def main():
    existing = {}
    if OUT_PATH.exists():
        existing = json.loads(OUT_PATH.read_text(encoding="utf-8"))
    if "stadiums" not in existing:
        existing["stadiums"] = {}

    for sid, stadium in STADIUMS.items():
        if sid in existing.get("stadiums", {}) and len(existing["stadiums"][sid].get("spots", [])) > 50:
            print(f"\n[Stadium {sid}] {stadium['name']} - already built, skipping")
            continue

        print(f"\n{'='*60}")
        print(f"[Stadium {sid}] {stadium['name']} ({stadium['region']})")
        print(f"{'='*60}")

        all_spots = {}

        for cat_name, keywords in CATEGORIES:
            for radius, label in [(2000, "도보"), (5000, "차량")]:
                key = f"{cat_name}/{label}"
                results = []
                for kw in keywords:
                    res = kakao_search(f"{stadium['region']} {kw}", stadium["lng"], stadium["lat"], radius)
                    results.extend(res)
                    time.sleep(0.15)
                print(f"  {key} ({', '.join(keywords)}, {radius}m)...", end=" ")
                if not results:
                    print("0 results")
                    continue
                # 중복 제거 + 프랜차이즈 필터링
                unique = []
                seen = set()
                for r in results:
                    n = r["name"].strip()
                    if n in seen or is_franchise(n):
                        continue
                    seen.add(n)
                    r["name"] = n
                    r["cat"] = cat_name
                    unique.append(r)
                all_spots.setdefault(key, []).extend(unique[:5])
                print(f"{len(unique[:5])} spots")
                time.sleep(0.3)

        # JSON 저장용으로 변환
        spots_out = []
        for key, items in all_spots.items():
            for item in items:
                spots_out.append({**item, "_key": key})

        existing["stadiums"][sid] = {
            "name": stadium["name"],
            "center": [stadium["lng"], stadium["lat"]],
            "spots": spots_out,
        }
        print(f"  Total spots: {len(spots_out)}")

    OUT_PATH.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSaved -> {OUT_PATH}")


if __name__ == "__main__":
    main()
