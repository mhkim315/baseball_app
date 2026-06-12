// 구장 ID → 팀 ID 매핑
export const STADIUM_TEAM_MAP: Record<string, string[]> = {
  "1": ["doosan", "lg"],
  "2": ["kiwoom"],
  "3": ["ssg"],
  "4": ["kt"],
  "5": ["hanwha"],
  "6": ["samsung"],
  "7": ["kia"],
  "8": ["lotte"],
  "9": ["nc"],
};

export const TEAM_STADIUM_MAP: Record<string, string> = {
  doosan: "1", lg: "1", kiwoom: "2", ssg: "3", kt: "4",
  hanwha: "5", samsung: "6", kia: "7", lotte: "8", nc: "9",
};

// 팀 ID → short venue name (API /schedule과 동일한 값)
export const TEAM_VENUE: Record<string, string> = {
  doosan: "잠실", lg: "잠실",
  kiwoom: "고척",
  ssg: "문학",
  kt: "수원",
  hanwha: "대전",
  samsung: "대구",
  kia: "광주",
  lotte: "사직",
  nc: "창원",
};

export function resolveVenue(homeTeamId: string, venue?: string | null): string {
  if (venue) return venue;
  return TEAM_VENUE[homeTeamId] || "";
}

import type { StadiumBrief } from "@shared/types";

export const STADIUM_BRIEFS: Record<string, StadiumBrief> = {
  "1": {
    id: "1", name: "잠실야구장", location: "서울 송파구", capacity: "25,553석",
    homeTeams: "LG 트윈스, 두산 베어스",
    ticket: { purchase: "LG: 티켓링크/LG트윈스앱\n두산: NOL티켓(인터파크)/두산앱", price: "9,000원(외야)~90,000원(프리미엄)" },
    parking: { fee: "경기일 선불 6,000원", note: "올림픽주경기장 리모델링으로 주차면 대폭 축소. 승용차 5부제 평일 적용. 대중교통 강력 권장" },
    transit: { subway: "2호선/9호선 종합운동장역 5·6번 출구 도보 5분", bus: "301, 333, 341, 345, 350, 360" },
  },
  "2": {
    id: "2", name: "고척스카이돔", location: "서울 구로구", capacity: "16,813석",
    homeTeams: "키움 히어로즈",
    ticket: { purchase: "NOL티켓(인터파크)", price: "시즌별 가격제" },
    parking: { fee: "일반 관람객 주차 원칙적 불가", note: "SkyBox VIP 전용 지하주차장만 운영. 인근 환승/민영 주차장 이용. 대중교통 강력 권장" },
    transit: { subway: "1호선 구일역 2번 출구 도보 10분", bus: "160, 600, 6513, 6611" },
  },
  "3": {
    id: "3", name: "인천SSG랜더스필드", location: "인천 미추홀구", capacity: "23,000석",
    homeTeams: "SSG 랜더스",
    ticket: { purchase: "티켓링크 / SSG닷컴 / SSG 앱", price: "11,000원(SKY뷰)~37,000원(홈런커플존)" },
    parking: { fee: "경기일 2,000원(선불)", note: "지하+지상 최대 4,000대. 경기 후 혼잡 예상" },
    transit: { subway: "인천2호선 문학경기장역 2번 출구 도보 5분", bus: "부평역·주안역 방면 다수 노선" },
  },
  "4": {
    id: "4", name: "수원KT위즈파크", location: "경기 수원시", capacity: "20,000석",
    homeTeams: "KT 위즈",
    ticket: { purchase: "위잽(Wizzap) 앱 / 티켓링크", price: "10,000원(외야)~70,000원(테이블)" },
    parking: { fee: "5,000원(사전예약제)", note: "사전 주차 예약 필수, 미예약 시 진입 불가. 경기 7일 전 오후 5시 예약 오픈. 만석공원 공영주차장(도보 20분) 대체 가능" },
    transit: { subway: "수인분당선 수원시청역 2번 출구 도보 10분", bus: "2007, 621, 7770, 310, 991" },
  },
  "5": {
    id: "5", name: "대전 한화생명 볼파크", location: "대전 중구 대종로 373 (부사동)", capacity: "20,007석",
    homeTeams: "한화 이글스",
    ticket: { purchase: "한화이글스 앱 / 티켓링크", price: "9,000원(외야)~50,000원(프리미엄)" },
    parking: { fee: "무료", note: "약 900대 주차 가능. 경기일 혼잡, 대중교통 권장" },
    transit: { subway: "1호선 중구청역 3번 출구 도보 10분", bus: "101, 102, 105, 201, 311, 316, 510, 513" },
  },
  "6": {
    id: "6", name: "대구삼성라이온즈파크", location: "대구 수성구", capacity: "24,000석",
    homeTeams: "삼성 라이온즈",
    ticket: { purchase: "티켓링크 / 삼성 라이온즈 공식 앱", price: "10,000원(외야)~80,000원(프리미엄)" },
    parking: { fee: "2,000원(현금 선불)", note: "공식 주차장 852면(일반용) 조기 만차 심함. 대구미술관 주차 후 무료 셔틀버스 이용 적극 권장" },
    transit: { subway: "대구2호선 야구장역 1번 출구 바로 연결", bus: "509, 609, 급행1" },
  },
  "7": {
    id: "7", name: "광주기아챔피언스필드", location: "광주 북구", capacity: "20,500석",
    homeTeams: "KIA 타이거즈",
    ticket: { purchase: "티켓링크 / KIA 타이거즈 앱", price: "9,000원(외야)~60,000원(프리미엄)" },
    parking: { fee: "3,000원 ~ 5,000원", note: "주차장 유료화 추진 중. 조기 만차 시 임동 공영주차장 활용" },
    transit: { subway: "광주1호선 문화전당역 도보 15분", bus: "금남51, 송정17, 지원45" },
  },
  "8": {
    id: "8", name: "사직야구장", location: "부산 동래구", capacity: "24,500석",
    homeTeams: "롯데 자이언츠",
    ticket: { purchase: "롯데 자이언츠 앱(giantsclub.com) / 티켓링크", price: "9,000원(외야)~70,000원(프리미엄)" },
    parking: { fee: "1일 최대 5,000원", note: "사직종합운동장 주차장. 조기 만차 잦아 홈플러스 아시아드점(도보 5분) 병행 이용. 경기일 혼잡, 대중교통 권장" },
    transit: { subway: "3호선 사직역 1번 출구 도보 5분", bus: "77, 131, 44" },
  },
  "9": {
    id: "9", name: "창원NC파크", location: "경남 창원시", capacity: "22,112석",
    homeTeams: "NC 다이노스",
    ticket: { purchase: "NC 다이노스 앱 / 홈페이지", price: "다이내믹 프라이싱 적용 (경기/좌석별 변동)" },
    parking: { fee: "경기시간 무료(티켓 인증 시)", note: "철골주차장/양덕공영주차장 경기 전 1시간~후 1시간 무료. 창원/진주/김해 무료 셔틀버스(6대) 운행. 대중교통 이용 시 2,000원 할인(화~금)" },
    transit: { subway: "없음 (버스 이용)", bus: "101, 102, 105, 113, 150, 151, 160, 161, 170, 171, 200, 250, 700, 710, 800" },
  },
};

import type { FoodPlace, ParkingSpot, NearbyRestaurant } from "@shared/types";

// 구장 내 먹거리 (food-places 기반 - 잠실 샘플)

export const STADIUM_FOODS: Record<string, FoodPlace[]> = {
  "1": [
    { shop: "자문밖", menu: "닭갈비, 볶음밥, 막국수", category: "korean", floor: "1F", zone: "3루 내야 출입구 부근" },
    { shop: "BHC", menu: "뿌링클, 골드킹, 콜팝", category: "chicken", floor: "1F", zone: "3루 내야 출입구 부근" },
    { shop: "노랑통닭", menu: "치킨, 떡볶이", category: "chicken", floor: "1F", zone: "3루 내야 출입구 부근" },
    { shop: "피자스쿨", menu: "피자, 파스타", category: "western", floor: "1F", zone: "중앙 출입구" },
    { shop: "맘스터치", menu: "싸이버거, 치킨", category: "fastfood", floor: "1F", zone: "1루 내야 출입구 부근" },
    { shop: "이삭토스트", menu: "토스트, 음료", category: "snack", floor: "1F", zone: "1루 외야 부근" },
    { shop: "스타벅스", menu: "커피, 음료", category: "cafe", floor: "1F", zone: "중앙 출입구" },
    { shop: "곱창고", menu: "곱창, 막창", category: "korean", floor: "3F", zone: "3루 내야" },
    { shop: "60계치킨", menu: "후라이드, 양념", category: "chicken", floor: "3F", zone: "1루 내야" },
  ],
  "2": [
    { shop: "BBQ", menu: "황금올리브, 자메이카통다리", category: "chicken", floor: "1F", zone: "3루 출입구" },
    { shop: "버거킹", menu: "와퍼, 치킨버거", category: "fastfood", floor: "1F", zone: "중앙 출입구" },
    { shop: "명랑핫도그", menu: "핫도그, 감자", category: "snack", floor: "1F", zone: "1루 출입구" },
    { shop: "이디야커피", menu: "커피, 음료", category: "cafe", floor: "1F", zone: "중앙 출입구" },
  ],
  "3": [
    { shop: "교촌치킨", menu: "교촌오리지날, 허니콤보", category: "chicken", floor: "1F", zone: "3루 출입구" },
    { shop: "서브웨이", menu: "샌드위치, 쿠키", category: "western", floor: "1F", zone: "중앙 출입구" },
    { shop: "CU 편의점", menu: "간식, 음료, 주류", category: "convenience", floor: "1F", zone: "1루 출입구" },
    { shop: "롯데리아", menu: "불고기버거, 치킨", category: "fastfood", floor: "1F", zone: "외야" },
    { shop: "공차", menu: "밀크티, 스무디", category: "cafe", floor: "1F", zone: "중앙 출입구" },
  ],
  "4": [
    { shop: "네네치킨", menu: "파닭, 스노윙", category: "chicken", floor: "1F", zone: "3루 출입구" },
    { shop: "도미노피자", menu: "피자, 사이드", category: "western", floor: "1F", zone: "중앙 출입구" },
    { shop: "GS25", menu: "간식, 음료, 주류", category: "convenience", floor: "1F", zone: "1루 출입구" },
    { shop: "할리스커피", menu: "커피, 음료", category: "cafe", floor: "1F", zone: "중앙 출입구" },
  ],
  "5": [
    { shop: "굽네치킨", menu: "고추바사삭, 볼케이노", category: "chicken", floor: "1F", zone: "3루 출입구" },
    { shop: "맥도날드", menu: "빅맥, 맥너겟", category: "fastfood", floor: "1F", zone: "중앙 출입구" },
    { shop: "메가커피", menu: "커피, 음료", category: "cafe", floor: "1F", zone: "1루 출입구" },
  ],
  "6": [
    { shop: "호식이두마리치킨", menu: "후라이드, 양념", category: "chicken", floor: "1F", zone: "3루 출입구" },
    { shop: "KFC", menu: "치킨, 버거", category: "fastfood", floor: "1F", zone: "중앙 출입구" },
    { shop: "파리바게뜨", menu: "빵, 케이크, 음료", category: "cafe", floor: "1F", zone: "1루 출입구" },
    { shop: "CU 편의점", menu: "간식, 음료, 주류", category: "convenience", floor: "1F", zone: "외야" },
  ],
  "7": [
    { shop: "처갓집양념치킨", menu: "양념치킨, 간장치킨", category: "chicken", floor: "1F", zone: "3루 출입구" },
    { shop: "롯데리아", menu: "불고기버거, 치킨", category: "fastfood", floor: "1F", zone: "중앙 출입구" },
    { shop: "투썸플레이스", menu: "커피, 케이크", category: "cafe", floor: "1F", zone: "1루 출입구" },
  ],
  "8": [
    { shop: "페리카나", menu: "양념치킨, 간장치킨", category: "chicken", floor: "1F", zone: "3루 출입구" },
    { shop: "맘스터치", menu: "싸이버거, 치킨", category: "fastfood", floor: "1F", zone: "중앙 출입구" },
    { shop: "이디야커피", menu: "커피, 음료", category: "cafe", floor: "1F", zone: "1루 출입구" },
    { shop: "CU 편의점", menu: "간식, 음료, 주류", category: "convenience", floor: "1F", zone: "외야" },
  ],
  "9": [
    { shop: "BBQ", menu: "황금올리브, 자메이카통다리", category: "chicken", floor: "1F", zone: "3루 출입구" },
    { shop: "버거킹", menu: "와퍼, 치킨버거", category: "fastfood", floor: "1F", zone: "중앙 출입구" },
    { shop: "스타벅스", menu: "커피, 음료", category: "cafe", floor: "1F", zone: "1루 출입구" },
  ],
};

// 구장 주변 주차장 정보 (stadium-surroundings 기반)

export const STADIUM_PARKING: Record<string, ParkingSpot[]> = {
  "1": [
    { name: "종합운동장 공식 주차장", description: "약 876면. 경기일 소형 6,000원 선불. 평일 5부제" },
    { name: "잠실한강공원 주차장", description: "706면. 도보 10-15분. 1,000원/30분, 1일 최대 10,000원" },
    { name: "롯데월드몰 주차장", description: "도보 5-8분. CGV 이용 시 4시간 4,800원" },
    { name: "석촌호수 공영주차장", description: "도보 10-15분. 공영주차장 요금 적용" },
  ],
  "2": [
    { name: "고척돔 주차장", description: "484면. 5부제 시행. 현장 주차 협소" },
    { name: "동양미래대 주차장", description: "1,500원/30분. 도보 5분" },
  ],
  "3": [
    { name: "문학경기장 주차장", description: "지하+지상 최대 4,000대. 경기일 2,000원 선불" },
  ],
  "4": [
    { name: "KT위즈파크 주차장", description: "사전예약제 3,000원. 경기 7일 전 오후 5시 오픈" },
    { name: "만석공원 공영주차장", description: "도보 20분. 무료" },
  ],
  "5": [
    { name: "한화생명볼파크 주차장", description: "약 900대. 무료" },
  ],
  "6": [
    { name: "라이온즈파크 주차장", description: "사전예약 5,000원. 셔틀버스 운행" },
    { name: "수성못 공영주차장", description: "도보 15분. 공영주차장 요금" },
  ],
  "7": [
    { name: "챔피언스필드 주차장", description: "약 1,000대. 3,000원" },
    { name: "무등경기장 주차장", description: "도보 5분. 무료" },
  ],
  "8": [
    { name: "사직종합운동장 주차장", description: "5,000원. 경기일 혼잡" },
  ],
  "9": [
    { name: "NC파크 주차장", description: "사전예약 3,000원. 셔틀버스 운행" },
    { name: "마산종합운동장 주차장", description: "도보 10분. 무료" },
  ],
};

// 구장 주변 맛집 (stadium-eats 기반 - 잠실 샘플)

export const STADIUM_NEARBY: Record<string, NearbyRestaurant[]> = {
  "1": [
    { name: "옛날통닭", category: "치킨·호프", address: "서울 송파구 잠실동 205-4", phone: "" },
    { name: "두찜 잠실새내점", category: "치킨·호프", address: "서울 송파구 잠실동 213-4", phone: "02-6082-8272" },
    { name: "미쳐버린파닭 잠실점", category: "치킨·호프", address: "서울 송파구 잠실동 213-27", phone: "02-416-9293" },
    { name: "잠실곱창 본점", category: "한식", address: "서울 송파구 잠실동 184-21", phone: "02-421-2292" },
    { name: "종합운동장 순대타운", category: "분식", address: "서울 송파구 잠실동 일대", phone: "" },
  ],
  "2": [
    { name: "고척돔 치킨거리", category: "치킨", address: "서울 구로구 고척동 일대", phone: "" },
    { name: "구일역 먹자골목", category: "한식", address: "서울 구로구 구일역 일대", phone: "" },
  ],
  "3": [
    { name: "문학 먹자골목", category: "한식", address: "인천 미추홀구 문학동 일대", phone: "" },
    { name: "주안역 먹자골목", category: "다양", address: "인천 미추홀구 주안동 일대", phone: "" },
  ],
  "4": [
    { name: "수원 통닭거리", category: "치킨", address: "경기 수원시 팔달구 일대", phone: "" },
    { name: "수원역 먹자골목", category: "다양", address: "경기 수원시 팔달구 일대", phone: "" },
  ],
  "5": [
    { name: "성심당 본점", category: "베이커리", address: "대전 중구 대종로 480번길 15", phone: "042-256-6516" },
    { name: "대전역 먹자골목", category: "다양", address: "대전 동구 대전역 일대", phone: "" },
  ],
  "6": [
    { name: "수성못 카페거리", category: "카페", address: "대구 수성구 수성못 일대", phone: "" },
    { name: "대구 막창골목", category: "한식", address: "대구 중구 동인동 일대", phone: "" },
  ],
  "7": [
    { name: "광주 양동시장", category: "전통시장", address: "광주 서구 양동 일대", phone: "" },
    { name: "충장로 먹자골목", category: "다양", address: "광주 동구 충장로 일대", phone: "" },
  ],
  "8": [
    { name: "사직동 먹자골목", category: "다양", address: "부산 동래구 사직동 일대", phone: "" },
    { name: "온천장 먹자골목", category: "한식", address: "부산 동래구 온천동 일대", phone: "" },
  ],
  "9": [
    { name: "마산어시장", category: "해산물", address: "경남 창원시 마산합포구 일대", phone: "" },
    { name: "창원 중앙동 먹자골목", category: "다양", address: "경남 창원시 의창구 일대", phone: "" },
  ],
};

// 카테고리 아이콘/라벨 매핑
export const FOOD_CATEGORIES: Record<string, { label: string; emoji: string }> = {
  korean: { label: "한식", emoji: "🍚" },
  chicken: { label: "치킨", emoji: "🍗" },
  western: { label: "양식", emoji: "🍕" },
  fastfood: { label: "패스트푸드", emoji: "🍔" },
  snack: { label: "간식", emoji: "🌭" },
  cafe: { label: "카페", emoji: "☕" },
  convenience: { label: "편의점", emoji: "🏪" },
};
