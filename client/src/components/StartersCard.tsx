import { TeamBadge } from "@/components/TeamBadge";
import { TEAM_COLORS } from "@/lib/teamColors";

interface StartersCardProps {
  awayTeam: string;
  homeTeam: string;
  awayStarterName?: string;
  homeStarterName?: string;
  isFuture: boolean;
}

export default function StartersCard({
  awayTeam,
  homeTeam,
  awayStarterName,
  homeStarterName,
  isFuture,
}: StartersCardProps) {
  const away = TEAM_COLORS[awayTeam];
  const home = TEAM_COLORS[homeTeam];
  if (!away || !home) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 mt-3">
      <h3 className="text-sm font-semibold mb-3">선발투수</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 bg-accent/30 rounded-xl p-3">
          <TeamBadge teamId={awayTeam} size="sm" variant="ball" />
          <div>
            <p className="text-sm font-medium">{isFuture ? "미정" : (awayStarterName || "미정")}</p>
            <p className="text-xs" style={{ color: away.primary }}>{away?.shortName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-accent/30 rounded-xl p-3">
          <TeamBadge teamId={homeTeam} size="sm" variant="ball" />
          <div>
            <p className="text-sm font-medium">{isFuture ? "미정" : (homeStarterName || "미정")}</p>
            <p className="text-xs" style={{ color: home.primary }}>{home?.shortName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
