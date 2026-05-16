import { TEAM_COLORS } from "@/lib/teamColors";

interface PreviewCardProps {
  awayTeam: string;
  homeTeam: string;
  previewData: {
    homeRecord: string;
    awayRecord: string;
    homeRank: number;
    awayRank: number;
    homeRecent: ("승" | "패" | "무")[];
    awayRecent: ("승" | "패" | "무")[];
  };
}

export default function PreviewCard({ awayTeam, homeTeam, previewData }: PreviewCardProps) {
  const away = TEAM_COLORS[awayTeam];
  const home = TEAM_COLORS[homeTeam];
  if (!away || !home) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 mt-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-col items-center gap-1 flex-1">
          <span className="text-xs text-muted-foreground">{previewData.awayRank}위</span>
          <span className="text-sm font-semibold" style={{ color: away.primary }}>{away?.shortName}</span>
          <span className="text-xs text-muted-foreground">{previewData.awayRecord}</span>
        </div>
        <div className="flex flex-col items-center gap-1 px-3">
          <span className="text-[10px] text-muted-foreground">시즌 성적</span>
          <span className="text-[10px] text-muted-foreground">VS</span>
        </div>
        <div className="flex flex-col items-center gap-1 flex-1">
          <span className="text-xs text-muted-foreground">{previewData.homeRank}위</span>
          <span className="text-sm font-semibold" style={{ color: home.primary }}>{home?.shortName}</span>
          <span className="text-xs text-muted-foreground">{previewData.homeRecord}</span>
        </div>
      </div>
      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {previewData.awayRecent.map((r, i) => (
              <span key={i} className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                r === "승" ? "bg-blue-500 text-white" : r === "패" ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"
              }`}>{r === "무" ? "무" : r}</span>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">최근 5경기</span>
          <div className="flex gap-1">
            {previewData.homeRecent.map((r, i) => (
              <span key={i} className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                r === "승" ? "bg-blue-500 text-white" : r === "패" ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"
              }`}>{r === "무" ? "무" : r}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
