import { useLocation } from "wouter";

export default function Beta() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      {/* Mobile header */}
      <div className="md:hidden px-5 pt-6 pb-4">
        <h1 className="text-xl font-bold">풀카운트 앱</h1>
        <p className="text-sm text-muted-foreground mt-0.5">iOS 정식 출시 · Android 비공개 테스트</p>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-2 md:mt-6">
        <div className="bg-card rounded-2xl border border-border p-5 text-sm leading-relaxed space-y-4">
          <h2 className="text-base font-bold text-primary">
            📱 직관의 모든 순간을 기록하세요
          </h2>
          <p className="text-muted-foreground">
            내가 직관한 날짜, 점수, 감정을 기록하고 나만의 야구 일기를 완성하세요.
            풀카운트가 야구장의 모든 순간을 간직할 수 있도록 도와드립니다.
          </p>

          <div className="bg-primary/5 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-primary font-bold text-base leading-none mt-0.5">01</span>
              <div>
                <p className="font-semibold text-foreground">경기 일정 & 실시간 스코어</p>
                <p className="text-muted-foreground text-xs mt-0.5">응원하는 팀의 경기 일정을 한눈에, 실시간으로 업데이트되는 스코어를 확인하세요.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-primary font-bold text-base leading-none mt-0.5">02</span>
              <div>
                <p className="font-semibold text-foreground">직관 기록 & 통계</p>
                <p className="text-muted-foreground text-xs mt-0.5">내 직관 승률, 득점, 요일별 통계부터 구장별 방문 기록까지 자동으로 분석해드립니다.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-primary font-bold text-base leading-none mt-0.5">03</span>
              <div>
                <p className="font-semibold text-foreground">구장 정보 & 길찾기</p>
                <p className="text-muted-foreground text-xs mt-0.5">전국 구장의 먹거리, 좌석 정보, 교통편과 지도를 제공합니다.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-primary font-bold text-base leading-none mt-0.5">04</span>
              <div>
                <p className="font-semibold text-foreground">응원가 & 선수 정보</p>
                <p className="text-muted-foreground text-xs mt-0.5">구단별 응원가와 선수 프로필을 앱 하나로 편리하게 확인하세요.</p>
              </div>
            </div>
          </div>

          {/* iOS - App Store */}
          <a
            href="https://apps.apple.com/kr/app/%ED%92%80%EC%B9%B4%EC%9A%B4%ED%8A%B8-%EC%A7%81%EA%B4%80-%EA%B8%B0%EB%A1%9D/id6775470174"
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-primary/10 rounded-xl p-4 border border-primary/20 active:scale-[0.98] transition-transform"
          >
            <h3 className="font-bold text-foreground text-sm">🍎 iOS — App Store에서 다운로드</h3>
            <p className="text-muted-foreground text-xs mt-1">
              풀카운트가 App Store에 정식 출시되었습니다. 지금 바로 다운로드하세요.
            </p>
            <p className="text-xs text-primary font-medium mt-2">
              App Store 열기 →
            </p>
          </a>

          {/* Android - Private test */}
          <div className="bg-card rounded-xl p-4 border border-border">
            <h3 className="font-bold text-foreground text-sm">🤖 Android — 비공개 테스터 모집</h3>
            <p className="text-muted-foreground text-xs mt-1">
              정식 출시에 앞서 비공개 테스터를 모집합니다.
              아래 이메일로 구글 계정 이메일 주소를 보내주시면 Play Store에서 먼저 앱을 받을 수 있습니다.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="text-sm font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-lg">
                info@fullcount.kr
              </code>
            </div>
          </div>

          <button
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm active:scale-[0.98] transition-transform"
            onClick={() => setLocation("/")}
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
