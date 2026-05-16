import { TeamBadge } from "@/components/TeamBadge";
import { TEAM_COLORS } from "@/lib/teamColors";

interface GameHeaderCardProps {
  awayTeam: string;
  homeTeam: string;
  awayStarterName?: string;
  homeStarterName?: string;
  gameTime: string;
  venue: string;
  gameScore: { away: number; home: number } | null;
  isCancelled?: boolean;
  isLive?: boolean;
  isFinished?: boolean;
  isFuture?: boolean;
  awayWin: boolean | null;
  homeWin: boolean | null;
  isDraw: boolean;
  awayEmotion: "default" | "determined" | "sad" | "joyful" | "neutral";
  homeEmotion: "default" | "determined" | "sad" | "joyful" | "neutral";
  statusLabel: string;
}

export default function GameHeaderCard({
  awayTeam,
  homeTeam,
  awayStarterName,
  homeStarterName,
  gameTime,
  venue,
  gameScore,
  isCancelled,
  isLive,
  isFinished,
  isFuture,
  awayWin,
  homeWin,
  isDraw,
  awayEmotion,
  homeEmotion,
  statusLabel,
}: GameHeaderCardProps) {
  const away = TEAM_COLORS[awayTeam];
  const home = TEAM_COLORS[homeTeam];
  if (!away || !home) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col items-center gap-2">
          <TeamBadge teamId={awayTeam} size="lg" emotion={awayEmotion} />
          <span className="text-sm font-medium" style={{ color: away.primary }}>{away?.name}</span>
          <span className="text-xs text-muted-foreground">
            {isFuture ? "미정" : (awayStarterName || "-")}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-muted-foreground">{gameTime || "18:30"}</span>
          {isCancelled ? (
            <span className="text-lg font-bold text-muted-foreground line-through">취소</span>
          ) : gameScore ? (
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-bold ${isFinished && gameScore.away <= gameScore.home ? "text-muted-foreground" : ""}`}>{gameScore.away}</span>
              <span className="text-sm text-muted-foreground">:</span>
              <span className={`text-2xl font-bold ${isFinished && gameScore.home <= gameScore.away ? "text-muted-foreground" : ""}`}>{gameScore.home}</span>
            </div>
          ) : isLive ? (
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold">0</span>
              <span className="text-sm text-muted-foreground">:</span>
              <span className="text-2xl font-bold">0</span>
            </div>
          ) : (
            <span className="text-lg font-bold text-muted-foreground">VS</span>
          )}
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
            isLive ? "bg-destructive/10 text-destructive animate-pulse" :
            "bg-accent text-muted-foreground"
          }`}>
            {isLive ? "경기 중" : statusLabel}
          </span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <TeamBadge teamId={homeTeam} size="lg" emotion={homeEmotion} />
          <span className="text-sm font-medium" style={{ color: home.primary }}>{home?.name}</span>
          <span className="text-xs text-muted-foreground">
            {isFuture ? "미정" : (homeStarterName || "-")}
          </span>
        </div>
      </div>
      {venue && (
        <p className="text-center text-xs text-muted-foreground mt-3">{venue}</p>
      )}
    </div>
  );
}
