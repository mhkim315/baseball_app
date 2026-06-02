import type { Badge, JikgwanRecord } from "@/lib/db";

export type BadgeTier = "tutorial" | "easy" | "medium" | "hard" | "epic";

export interface BadgeDefinition {
  id: string;
  badgeKey: string;
  emoji: string;
  title: string;
  description: string;
  tier: BadgeTier;
  xp: number;
  category: "milestone" | "streak" | "attendance" | "exploration" | "secret";
  progressTarget: number;
  teamId?: string;
  check: (
    records: JikgwanRecord[],
    existingBadges: Badge[],
    attendanceStreak: number,
    myTeam?: string | null,
    installDate?: string,
    totalAttendanceDays?: number,
    unlockedEmotions?: string[]
  ) => BadgeEvalResult;
}

export interface BadgeEvalResult {
  unlocked: boolean;
  progressCurrent: number;
  progressTarget: number;
  qualifyingDate?: string;
}
