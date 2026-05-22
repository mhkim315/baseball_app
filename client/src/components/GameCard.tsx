import { TEAM_COLORS } from "@/lib/teamColors";
import { TeamBadge } from "@/components/TeamBadge";

interface GameCardProps {
  homeTeam: string;
  awayTeam: string;
  time: string;
  stadium: string;
  homePitcher?: string;
  awayPitcher?: string;
  status?: "scheduled" | "live" | "finished";
  homeScore?: number;
  awayScore?: number;
  winPitcher?: string | null;
  losePitcher?: string | null;
  cancelled?: boolean;
  onClick?: () => void;
  liveInning?: number;
  isTop?: boolean;
}

export default function GameCard({
  homeTeam,
  awayTeam,
  time,
  stadium,
  homePitcher,
  awayPitcher,
  status = "scheduled",
  homeScore,
  awayScore,
  winPitcher,
  losePitcher,
  cancelled,
  liveInning,
  isTop,
  onClick,
}: GameCardProps) {
  const home = TEAM_COLORS[homeTeam];
  const away = TEAM_COLORS[awayTeam];

  if (!home || !away) return null;

  const hasResult = status === "finished" && homeScore !== undefined && awayScore !== undefined && !cancelled;
  const homeWon = hasResult ? homeScore! > awayScore! : null;
  const awayWon = hasResult ? awayScore! > homeScore! : null;
  const isDraw = hasResult ? homeScore === awayScore : null;
  const showScore = (status === "finished" || status === "live" || ((homeScore || 0) + (awayScore || 0) > 0)) && homeScore !== undefined && awayScore !== undefined;

  const statusLabel = cancelled
    ? "취소"
    : status === "finished"
      ? "경기 종료"
      : status === "live"
        ? (liveInning != null ? `${liveInning}회${isTop ? "초" : "말"}` : "경기 중")
        : "경기 전";
  const statusBadgeClass = cancelled
    ? "text-muted-foreground"
    : status === "live"
    ? "text-destructive animate-pulse"
    : "text-muted-foreground";

  const awayEmotion = status === "scheduled" ? "determined" : awayWon === true ? "joyful" : isDraw || cancelled ? "neutral" : awayWon === false ? "sad" : "default" as const;
  const homeEmotion = status === "scheduled" ? "determined" : homeWon === true ? "joyful" : isDraw || cancelled ? "neutral" : homeWon === false ? "sad" : "default" as const;

  const cardStyle: React.CSSProperties = {
    borderLeft: `3px solid ${home.primary}`,
  };

  if (home.primary && away.primary && home.primary !== away.primary) {
    cardStyle.background = `linear-gradient(135deg, ${away.primary}08 0%, transparent 40%, transparent 60%, ${home.primary}08 100%)`;
  } else if (home.primary) {
    cardStyle.background = `linear-gradient(135deg, transparent 0%, ${home.primary}06 50%, transparent 100%)`;
  }

  return (
    <button
      onClick={onClick}
      className="w-full bg-card rounded-2xl border border-border p-5 transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] text-left"
      style={cardStyle}
    >
      {/* 상단: 시간 및 구장 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-muted-foreground font-medium">{time}</span>
        <span className="text-xs text-muted-foreground">{stadium}</span>
      </div>

      {/* 중앙: 팀 매치업 */}
      <div className="flex items-center justify-between">
        {/* 원정팀 */}
        <div className="flex flex-col items-center gap-2 flex-1">
          <TeamBadge teamId={awayTeam} size="md" emotion={awayEmotion} />
          <span className="text-xs font-medium" style={{ color: away.primary }}>{away.shortName}</span>
          {hasResult && winPitcher ? (
            <span className="text-xs text-muted-foreground">
              {isDraw ? `무: ${winPitcher}` : awayWon ? `승: ${winPitcher}` : `패: ${losePitcher ?? ""}`}
            </span>
          ) : awayPitcher ? (
            <span className="text-xs text-muted-foreground">
              {awayPitcher}
            </span>
          ) : null}
        </div>

        {/* 스코어 또는 VS */}
        <div className="flex flex-col items-center gap-1 px-4">
          <span className={`text-[10px] font-medium ${statusBadgeClass}`}>{statusLabel}</span>
          {showScore ? (
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-bold ${hasResult && !awayWon && !isDraw ? "text-muted-foreground/50" : ""}`}>{awayScore}</span>
              <span className="text-sm text-muted-foreground">:</span>
              <span className={`text-2xl font-bold ${hasResult && !homeWon && !isDraw ? "text-muted-foreground/50" : ""}`}>{homeScore}</span>
            </div>
          ) : (
            <span className={`text-sm font-medium ${cancelled ? "text-muted-foreground line-through" : "text-muted-foreground"}`}>VS</span>
          )}
        </div>

        {/* 홈팀 */}
        <div className="flex flex-col items-center gap-2 flex-1">
          <TeamBadge teamId={homeTeam} size="md" emotion={homeEmotion} />
          <span className="text-xs font-medium" style={{ color: home.primary }}>{home.shortName}</span>
          {hasResult && winPitcher ? (
            <span className="text-xs text-muted-foreground">
              {isDraw ? `무: ${winPitcher}` : homeWon ? `승: ${winPitcher}` : `패: ${losePitcher ?? ""}`}
            </span>
          ) : homePitcher ? (
            <span className="text-xs text-muted-foreground">
              {homePitcher}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
