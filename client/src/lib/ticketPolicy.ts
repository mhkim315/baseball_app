import type { TicketTier, TeamTicketPolicy } from "@shared/types";

const TICKET_POLICY: Record<string, TeamTicketPolicy> = {
  LG: {
    name: "LG 트윈스", color: "#C8102E", venue: "잠실야구장", platform: "티켓링크 / LG 트윈스 앱",
    tiers: [
      { id: "long_member", name: "장기 연속 회원 (10년+)", dDay: -9, time: "14:00", maxTickets: 4, seats: "블루석 이하 일부", note: "2025년 이전부터 10년 이상 연속 가입한 기존 회원 대상" },
      { id: "annual", name: "연간회원", dDay: -8, time: "14:00", maxTickets: 4, seats: "블루석 이하 (일부 제외)" },
      { id: "season", name: "시즌권", dDay: null, time: null, maxTickets: null, seats: "본인 지정석", note: "별도 예매 불필요" },
      { id: "general", name: "일반", dDay: -7, time: "11:00", maxTickets: 8, seats: "전 좌석" },
      { id: "obstructed_view", name: "시야 방해석", dDay: -7, time: "11:30", maxTickets: 8, seats: "시야 방해석", note: "멤버십 등급 관계없이 별도 예매" },
    ],
  },
  두산: {
    name: "두산 베어스", color: "#131230", venue: "잠실야구장", platform: "NOL티켓(인터파크) / 두산 베어스 앱",
    tiers: [
      { id: "season", name: "시즌권", dDay: null, time: null, maxTickets: null, seats: "본인 지정석", note: "2026년부터 기명제 단일화. 타인 양도 불가" },
      { id: "bears_club", name: "베어스클럽 (성인)", dDay: -7, time: "10:00", maxTickets: 2, seats: "블루석 이하", note: "일반 예매보다 1시간 빠름. 1일 1회" },
      { id: "doorini", name: "두린이클럽 (어린이)", dDay: -7, time: "10:00", maxTickets: 4, seats: "블루석 이하", note: "만 14세 이하. 일반 예매보다 1시간 빠름" },
      { id: "general", name: "일반", dDay: -7, time: "11:00", maxTickets: 4, seats: "전 좌석" },
    ],
  },
  키움: {
    name: "키움 히어로즈", color: "#820024", venue: "고척스카이돔", platform: "NOL티켓(인터파크)",
    tiers: [
      { id: "annual", name: "연간회원 (홈 시즌권)", dDay: -7, time: "11:00", maxTickets: 4, seats: "지정석 + 추가 예매", note: "일반보다 3시간 빠름" },
      { id: "away_season", name: "원정팀 시즌권", dDay: null, time: null, maxTickets: null, seats: "고척돔 내 고정좌석", note: "타팀 팬 전용" },
      { id: "hero_membership", name: "히어로 멤버십", dDay: -7, time: "12:00", maxTickets: 2, seats: "전 좌석", note: "일반보다 2시간 빠름" },
      { id: "general", name: "일반", dDay: -7, time: "14:00", maxTickets: 4, seats: "전 좌석" },
    ],
  },
  SSG: {
    name: "SSG 랜더스", color: "#CE0E2D", venue: "인천SSG랜더스필드", platform: "티켓링크 / SSG닷컴 / SSG 랜더스 앱",
    tiers: [
      { id: "landi", name: "랜디 (199,000원)", dDay: -7, time: "11:00", maxTickets: 6, seats: "전 좌석 (일부 제외)", note: "랜디 전용 게이트" },
      { id: "batti", name: "배티 (99,000원)", dDay: -7, time: "11:00", maxTickets: 6, seats: "전 좌석 (일부 제외)", note: "스타벅스 게이트" },
      { id: "season_member", name: "시즌티켓 회원", dDay: -7, time: "11:00", maxTickets: null, seats: "전 좌석", note: "시즌티켓 구매자 동반인 대상" },
      { id: "puri", name: "푸리 (50,000원)", dDay: -6, time: "11:00", maxTickets: 6, seats: "전 좌석 (일부 제외)", note: "스타벅스 게이트" },
      { id: "friends", name: "프렌즈", dDay: -5, time: "11:00", maxTickets: 6, seats: "전 좌석 (일부 제외)" },
      { id: "general", name: "일반", dDay: -4, time: "11:00", maxTickets: 6, seats: "전 좌석" },
    ],
  },
  NC: {
    name: "NC 다이노스", color: "#315288", venue: "창원NC파크", platform: "NC 다이노스 자체 앱 / 홈페이지 / 티켓링크",
    tiers: [
      { id: "season_n", name: "시즌티켓 회원 (N타입)", dDay: -8, time: "11:00", maxTickets: null, seats: "전 좌석", note: "고정좌석 보유자. 추가 예매 D-8 11:00" },
      { id: "mint_plus", name: "민트 멤버십 플러스", dDay: -8, time: "17:00", maxTickets: 4, seats: "전 좌석", note: "체크인 40회 달성 시 자동 승급" },
      { id: "mint", name: "민트 멤버십", dDay: -7, time: "11:00", maxTickets: 4, seats: "전 좌석" },
      { id: "general", name: "일반", dDay: -6, time: "11:00", maxTickets: null, seats: "전 좌석" },
    ],
  },
  롯데: {
    name: "롯데 자이언츠", color: "#041E42", venue: "사직야구장", platform: "롯데 자이언츠 공식 앱 / 웹 / 티켓링크",
    tiers: [
      { id: "season", name: "시즌권 멤버십", dDay: null, time: null, maxTickets: null, seats: "본인 지정석", note: "예매 불필요. 포스트시즌 우선 예매권 제공" },
      { id: "preorder_membership", name: "선예매 멤버십", dDay: -14, time: "10:00", maxTickets: 2, seats: "전 좌석 (응원석 제외)", note: "경기 2주 전 10:00 오픈" },
      { id: "general", name: "일반", dDay: -14, time: "14:00", maxTickets: 8, seats: "전 좌석", note: "경기 2주 전 14:00 오픈" },
    ],
  },
  KT: {
    name: "KT wiz", color: "#000000", venue: "수원KT위즈파크", platform: "위잽(wizzap) 앱 / 티켓링크",
    tiers: [
      { id: "full_season", name: "풀 시즌권", dDay: -7, time: "12:00", maxTickets: 2, seats: "지정석 + 추가 예매", note: "PO 선예매 혜택" },
      { id: "magic", name: "매직회원", dDay: -7, time: "13:00", maxTickets: null, seats: "응원지정석", note: "시즌 6매 쿠폰제" },
      { id: "victory", name: "빅또리회원", dDay: -7, time: "13:00", maxTickets: null, seats: "선택 좌석", note: "1만 명. 시즌 10경기 쿠폰제" },
      { id: "general", name: "일반", dDay: -7, time: "16:00", maxTickets: null, seats: "전 좌석", note: "wizzap 앱 전용" },
    ],
  },
  KIA: {
    name: "KIA 타이거즈", color: "#EA0029", venue: "광주기아챔피언스필드", platform: "티켓링크 / KIA 타이거즈 앱",
    tiers: [
      { id: "season", name: "시즌권", dDay: -8, time: "10:00", maxTickets: 2, seats: "지정석 + 추가 예매", note: "한국시리즈 선예매 1매 제공" },
      { id: "early_pass", name: "얼리패스", dDay: -8, time: "10:30", maxTickets: 2, seats: "K9·K8·K5·EV·외야석", note: "일반보다 1일 빠름" },
      { id: "general", name: "일반", dDay: -7, time: "11:00", maxTickets: 8, seats: "전 좌석" },
    ],
  },
  한화: {
    name: "한화 이글스", color: "#FF6600", venue: "대전 한화생명 볼파크", platform: "한화이글스 앱 / 티켓링크",
    tiers: [
      { id: "season", name: "시즌권", dDay: null, time: null, maxTickets: null, seats: "본인 지정석", note: "별도 예매 불필요" },
      { id: "general", name: "일반", dDay: -7, time: "11:00", maxTickets: 4, seats: "전 좌석", note: "5단계 구간 요금제" },
    ],
  },
  삼성: {
    name: "삼성 라이온즈", color: "#074CA1", venue: "대구삼성라이온즈파크", platform: "티켓링크 / 삼성 라이온즈 공식 앱",
    tiers: [
      { id: "season", name: "시즌권", dDay: null, time: null, maxTickets: null, seats: "본인 지정석", note: "별도 예매 불필요" },
      { id: "lions_gold", name: "라이온즈 멤버십 (골드)", dDay: -8, time: "11:00", maxTickets: null, seats: "SKY석·외야지정석", note: "D-8 11:00 ~ D-7 10:00" },
      { id: "lions_silver", name: "라이온즈 멤버십 (실버)", dDay: -8, time: "11:00", maxTickets: null, seats: "SKY석·외야지정석" },
      { id: "general", name: "일반", dDay: -7, time: "11:00", maxTickets: 6, seats: "전 좌석", note: "홈 시리즈 전체 동시 오픈" },
    ],
  },
};

const TEAM_ID_TO_POLICY_KEY: Record<string, string> = {
  doosan: "두산", lg: "LG", kiwoom: "키움", ssg: "SSG",
  nc: "NC", lotte: "롯데", kt: "KT", kia: "KIA",
  hanwha: "한화", samsung: "삼성",
};

export function getTicketPolicy(teamId: string): TeamTicketPolicy | null {
  const key = TEAM_ID_TO_POLICY_KEY[teamId];
  return key ? TICKET_POLICY[key] || null : null;
}
