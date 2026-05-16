import { TEAM_COLORS } from "@/lib/teamColors";

interface ScoreBoardTableProps {
  awayTeam: string;
  homeTeam: string;
  innData: { away: (number | null)[]; home: (number | null)[] };
  rheb: { away: { r: number; h: number; e: number }; home: { r: number; h: number; e: number } };
  maxInn: number;
}

export default function ScoreBoardTable({
  awayTeam,
  homeTeam,
  innData,
  rheb,
  maxInn,
}: ScoreBoardTableProps) {
  const away = TEAM_COLORS[awayTeam];
  const home = TEAM_COLORS[homeTeam];
  if (!away || !home) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 mt-3 overflow-x-auto">
      <h3 className="text-sm font-semibold mb-3">스코어보드</h3>
      <table className="w-full text-xs text-center">
        <thead>
          <tr className="text-muted-foreground">
            <th className="py-1 pr-2 text-left">팀</th>
            {Array.from({ length: maxInn }).map((_, i) => (
              <th key={i} className="py-1 px-1.5 w-7">{i + 1}</th>
            ))}
            <th className="py-1 px-1.5 border-l border-border w-7">R</th>
            <th className="py-1 px-1.5 w-7">H</th>
            <th className="py-1 px-1.5 w-7">E</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border">
            <td className="py-1.5 pr-2 text-left font-medium" style={{ color: away.primary }}>{away?.shortName}</td>
            {Array.from({ length: maxInn }).map((_, i) => (
              <td key={i} className="py-1.5 px-1.5">{innData.away[i] != null ? innData.away[i] : '-'}</td>
            ))}
            <td className="py-1.5 px-1.5 border-l border-border font-bold">{rheb.away.r ?? '-'}</td>
            <td className="py-1.5 px-1.5">{rheb.away.h ?? '-'}</td>
            <td className="py-1.5 px-1.5">{rheb.away.e ?? '-'}</td>
          </tr>
          <tr>
            <td className="py-1.5 pr-2 text-left font-medium" style={{ color: home.primary }}>{home?.shortName}</td>
            {Array.from({ length: maxInn }).map((_, i) => (
              <td key={i} className="py-1.5 px-1.5">{innData.home[i] != null ? innData.home[i] : '-'}</td>
            ))}
            <td className="py-1.5 px-1.5 border-l border-border font-bold">{rheb.home.r ?? '-'}</td>
            <td className="py-1.5 px-1.5">{rheb.home.h ?? '-'}</td>
            <td className="py-1.5 px-1.5">{rheb.home.e ?? '-'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
