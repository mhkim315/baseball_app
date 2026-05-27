export interface InningInfo {
  inning: number;
  isTop: boolean;
}

export function getInningInfo(
  inn?: { away: (number | null)[]; home: (number | null)[] } | null
): InningInfo | null {
  if (!inn) return null;
  const aLen = inn.away?.length ?? 0;
  const hLen = inn.home?.length ?? 0;
  if (aLen > hLen) return { inning: aLen, isTop: true };
  if (hLen > 0) return { inning: aLen, isTop: false };
  return null;
}
