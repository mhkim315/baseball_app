const BASE = import.meta.env.BASE_URL;

export default function Rules() {
  const rules = [
    { title: "이닝(회)", desc: "공격(초)·수비(말)가 한 바퀴 도는 단위예요. 공격측에서 아웃 세 개가 나오면 그 이닝은 끝나요." },
    { title: "아웃", desc: "삼진(스트라이크 세 번), 뜬공·땅볼로 잡히거나, 주자가 태그·포스로 잡히는 식으로 세 명이 나가면 공격 턴이 끝나요." },
    { title: "타순", desc: "정해진 순서대로 타석에 서고, 경기 내내 그 순서가 계속 돌아가요." },
    { title: "득점", desc: "주자가 1·2·3루를 거쳐 홈 플레이트를 밟으면 팀에 1점이 올라가요. 안타만이 아니라 볼넷·사구 등으로 출루한 뒤 진루해도 같아요." },
    { title: "사사구(사구·볼넷)", desc: "안타 없이 타자가 1루에 나가는 경우가 있어요. 공이 몸에 맞으면 사구(몸맞는 공), 볼이 네 번 쌓이면 볼넷으로 출루해요." },
  ];

  const gallery = [
    { img: "field", alt: "야구장 전경 — 수비 포지션과 전광판 등이 표시된 안내 그림", caption: "누가 어디 서 있는지, 전광판은 어디인지 한번 잡아 두면 경기가 훨씬 따라가기 쉬워요." },
    { img: "scoring", alt: "야구장 탑다운 뷰 — 주자가 베이스를 돌아 홈을 밟을 때 득점이 1점 올라가는 모습", caption: "화살표 방향대로 1·2·3루를 거쳐 홈 플레이트를 밟으면 그때 팀 점수가 1점 올라가요. 주자 여러 명이 있으면 홈을 밟은 만큼 점수가 쌓여요." },
    { img: "strike", alt: "스트라이크와 볼 — 노스윙과 스윙 시 비교", caption: "스윙을 안 했을 때: 공이 스트라이크 존을 지나가면 스트라이크, 아니면 볼이에요. 스윙을 했으면(헛스윙) 존 안·밖이랑 상관없이 스트라이크." },
    { img: "check-swing", alt: "볼·스트라이크 판정과 체크스윙 여부를 설명하는 그림", caption: '"진짜 스윙이었나?" 스윙도중 멈추게 되면 심판이 배트가 얼마나 나갔는지 봐요. 애매하면 비디오 판독이 나올 수 있어요.' },
    { img: "walk-hit-by-pitch", alt: "사구와 볼넷 — 안타 없이 타자가 출루하는 두 가지 예", caption: "사구(몸맞는 공)는 던진 공이 타자 몸에 맞으면 출루해요. 볼넷은 스트라이크 세 번 전에 볼이 네 번 쌓이면 걸어서 1루로 가요. 둘 다 안타 없이 1루에 나가는 대표적인 경우예요." },
    { img: "batted-ball", alt: "파울볼, 홈런, 플라이볼, 안타 네 가지 타구 예시", caption: "파울은 파울 라인 밖으로 나간 타구예요. 홈런은 타구가 담장을 넘겨 모든 주자가 홈으로 들어와요. 뜬공은 공이 높게 떠서 수비가 잡으면 아웃인 타구예요. 안타는 수비가 잡지 못하고 공이 페어 안에 떨어져 주자가 진루하는 경우를 말해요." },
    { img: "force-tag", alt: "포스아웃과 태그아웃의 차이를 보여주는 그림", caption: "포스 아웃은 \"지금 꼭 가야 하는 베이스\"가 정해져 있을 때, 수비가 그 베이스만 밟아도 아웃이 나는 거예요(뒤에 주자가 생겨 밀려나는 상황 등). 그게 아닐 때에는 태그 아웃으로 주자 몸을 직접 건드려야 아웃이에요." },
    { img: "umpire", alt: "세이프, 아웃, 스트라이크, 볼 — 심판 수신호 안내", caption: "멀리 앉아도 심판 손동작만 알아 두면 세이프·아웃·스트라이크·볼을 빠르게 구분할 수 있어요." },
  ];

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      {/* 모바일 헤더 */}
      <div className="md:hidden px-5 pt-6 pb-4">
        <h1 className="text-xl font-bold">야구 기본규칙</h1>
        <p className="text-sm text-muted-foreground mt-0.5">입문자 가이드</p>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-2 md:mt-6">
        {/* 기본 규칙 */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            처음 직관할 때 꼭 알면 좋은 것만 골라 적었어요. 더 자세한 규정은 아래 내용을 확인하면 돼요.
          </p>
          <ul className="flex flex-col gap-3">
            {rules.map((r, i) => (
              <li key={i} className="text-sm leading-relaxed">
                <strong className="text-foreground">{r.title}</strong>
                <span className="text-muted-foreground">: {r.desc}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 그림으로 보는 입문 */}
        <div className="mt-4">
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed px-1">
            아래는 그림 순서대로, 경기장 전체 → 득점(홈에서 1점) → 스트라이크·볼 → 체크스윙 → 사사구(몸맞는 공·볼넷) → 타구 → 포스·태그 → 심판 수신호 흐름이에요.
          </p>
          <div className="flex flex-col gap-4">
            {gallery.map((item, i) => (
              <figure key={i} className="bg-card rounded-2xl border border-border overflow-hidden">
                <img
                  src={`${BASE}rules/${item.img}.jpg`}
                  alt={item.alt}
                  className="w-full h-auto"
                  loading="lazy"
                />
                <figcaption className="text-xs text-muted-foreground leading-relaxed p-4">
                  {item.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
