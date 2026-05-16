import type { GameDetail, ScoreEntry } from "@/lib/api";

const WLS_LABELS: Record<string, string> = {
  "W": "승", "L": "패", "S": "세", "H": "홀",
};

const WLS_COLORS: Record<string, string> = {
  "W": "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950",
  "L": "text-red-500 bg-red-50 dark:text-red-400 dark:bg-red-950",
  "S": "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950",
  "H": "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950",
};

interface PitchingResultCardProps {
  detail: GameDetail;
  scoreFallback: ScoreEntry | null;
}

export default function PitchingResultCard({ detail, scoreFallback }: PitchingResultCardProps) {
  if (detail.pitchingResult && detail.pitchingResult.length > 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-4 mt-3">
        <h3 className="text-sm font-semibold mb-3">투수 기록</h3>
        <div className="flex flex-col gap-2">
          {detail.pitchingResult.map((p, i) => {
            const wlsLabel = WLS_LABELS[p.wls] || p.wls;
            const wlsColor = WLS_COLORS[p.wls] || "text-muted-foreground bg-accent";
            return (
              <div key={i} className="flex items-center justify-between bg-accent/30 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${wlsColor}`}>{wlsLabel}</span>
                  <span className="text-sm font-medium">{p.name}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.ip && <span>{p.ip}이닝</span>}
                  {p.era && <span className="ml-2">ERA {p.era}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (scoreFallback) {
    return (
      <div className="bg-card rounded-2xl border border-border p-4 mt-3">
        <h3 className="text-sm font-semibold mb-3">투수 기록</h3>
        <div className="flex items-center justify-between bg-accent/30 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950">승</span>
            <span className="text-sm font-medium">{scoreFallback.winPitcher || "-"}</span>
          </div>
        </div>
        <div className="flex items-center justify-between bg-accent/30 rounded-xl px-4 py-2.5 mt-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-red-500 bg-red-50 dark:text-red-400 dark:bg-red-950">패</span>
            <span className="text-sm font-medium">{scoreFallback.losePitcher || "-"}</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
