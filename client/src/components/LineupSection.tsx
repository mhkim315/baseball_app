import { TeamBadge } from "@/components/TeamBadge";
import { TEAM_COLORS } from "@/lib/teamColors";
import type { LineupPlayer } from "@/lib/api";

const POSITION_LABELS: Record<string, string> = {
  "1": "1B", "2": "2B", "3": "3B",
  "유": "SS", "포": "C", "중": "CF",
  "좌": "LF", "우": "RF", "지": "DH", "투": "P",
  "1루수": "1B", "2루수": "2B", "3루수": "3B",
  "유격수": "SS", "포수": "C", "중견수": "CF",
  "좌익수": "LF", "우익수": "RF", "지명타자": "DH", "투수": "P",
};

interface LineupSectionProps {
  awayTeam: string;
  homeTeam: string;
  awayLineup: LineupPlayer[];
  homeLineup: LineupPlayer[];
  hasLineup: boolean;
  isLive?: boolean;
  isFuture?: boolean;
  lineupConfirmed?: boolean;
  showLineupStatus?: boolean;
}

export default function LineupSection({
  awayTeam,
  homeTeam,
  awayLineup,
  homeLineup,
  hasLineup,
  isLive,
  lineupConfirmed,
  showLineupStatus,
}: LineupSectionProps) {
  const away = TEAM_COLORS[awayTeam];
  const home = TEAM_COLORS[homeTeam];
  if (!away || !home) return null;

  if (!hasLineup) {
    return (
      <div className="mt-3 bg-card rounded-2xl border border-border p-8 text-center">
        <p className="text-muted-foreground text-sm mb-1">아직 라인업이 공개되지 않았어요</p>
        <p className="text-xs text-muted-foreground">경기 시작 전에 확정 후 업데이트돼요</p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      {isLive ? (
        <div className="text-center mb-2">
          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-destructive/10 text-destructive animate-pulse">
            경기 중
          </span>
        </div>
      ) : showLineupStatus ? (
        <div className="text-center mb-2">
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
            lineupConfirmed
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
          }`}>
            {lineupConfirmed ? "라인업 확정" : "예상 라인업"}
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {/* Away lineup */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
            <TeamBadge teamId={awayTeam} size="sm" variant="bat" />
            <span className="text-sm font-semibold" style={{ color: away.primary }}>{away?.shortName}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {awayLineup.map((player: LineupPlayer) => (
              <div key={player.order} className="flex items-center gap-2 text-sm">
                <span className="text-xs text-muted-foreground w-4 text-right">{player.order}</span>
                <span className="text-xs text-muted-foreground w-5 text-center bg-accent rounded px-1">
                  {POSITION_LABELS[player.position] || player.position}
                </span>
                <span className="font-medium">{player.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Home lineup */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
            <TeamBadge teamId={homeTeam} size="sm" variant="bat" />
            <span className="text-sm font-semibold" style={{ color: home.primary }}>{home?.shortName}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {homeLineup.map((player: LineupPlayer) => (
              <div key={player.order} className="flex items-center gap-2 text-sm">
                <span className="text-xs text-muted-foreground w-4 text-right">{player.order}</span>
                <span className="text-xs text-muted-foreground w-5 text-center bg-accent rounded px-1">
                  {POSITION_LABELS[player.position] || player.position}
                </span>
                <span className="font-medium">{player.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
