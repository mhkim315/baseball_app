import type { BadgeDefinition } from "../types";
import { resolveIsWin } from "@/lib/expenseStats";
import { parseGameTeamIds } from "@shared/constants";
import { ALL_CHARACTERS } from "@/lib/emotions";

export const EXPLORATION_BADGES: BadgeDefinition[] = [
  {
    id: "first_away",
    badgeKey: "first_away",
    emoji: "✈️",
    title: "첫 원정",
    description: "첫 원정 경기를 직관했어요",
    tier: "easy",
    xp: 10,
    category: "exploration",
    progressTarget: 1,
    check: (records) => {
      const awayRecords = records.filter((r) => {
        if (!r.cheered_team || !r.game_id) return false;
        const ids = parseGameTeamIds(r.game_id);
        return ids.homeId && ids.homeId !== r.cheered_team;
      }).sort((a, b) => a.date.localeCompare(b.date));
      const awayCount = awayRecords.length;
      return {
        unlocked: awayCount >= 1,
        progressCurrent: Math.min(awayCount, 1),
        progressTarget: 1,
        qualifyingDate: awayCount >= 1 ? awayRecords[0].date : undefined,
      };
    },
  },
  {
    id: "stadium_3",
    badgeKey: "stadium_3",
    emoji: "🏟️",
    title: "구장 3개",
    description: "서로 다른 3개 구장을 방문했어요",
    tier: "medium",
    xp: 25,
    category: "exploration",
    progressTarget: 3,
    check: (records) => {
      const sorted = [...records].filter((r) => r.stadium).sort((a, b) => a.date.localeCompare(b.date));
      const stadiums = new Set<string>();
      let qualifyingDate: string | undefined;
      for (const r of sorted) {
        stadiums.add(r.stadium!);
        if (stadiums.size >= 3) { qualifyingDate = r.date; break; }
      }
      return {
        unlocked: stadiums.size >= 3,
        progressCurrent: Math.min(stadiums.size, 3),
        progressTarget: 3,
        qualifyingDate,
      };
    },
  },
  {
    id: "doubleheader",
    badgeKey: "doubleheader",
    emoji: "👯",
    title: "더블헤더",
    description: "같은 날 2경기를 모두 직관했어요",
    tier: "medium",
    xp: 25,
    category: "exploration",
    progressTarget: 1,
    check: (records) => {
      const dateGames = new Map<string, Set<string>>();
      for (const r of records) {
        if (!dateGames.has(r.date)) dateGames.set(r.date, new Set());
        dateGames.get(r.date)!.add(r.game_id);
      }
      const dhDate = [...dateGames.entries()].find(([, games]) => games.size >= 2);
      return {
        unlocked: !!dhDate,
        progressCurrent: dhDate ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: dhDate ? dhDate[0] : undefined,
      };
    },
  },
  {
    id: "stadium_5",
    badgeKey: "stadium_5",
    emoji: "🏟️🏟️",
    title: "구장 5개",
    description: "서로 다른 5개 구장을 방문했어요",
    tier: "hard",
    xp: 50,
    category: "exploration",
    progressTarget: 5,
    check: (records) => {
      const sorted = [...records].filter((r) => r.stadium).sort((a, b) => a.date.localeCompare(b.date));
      const stadiums = new Set<string>();
      let qualifyingDate: string | undefined;
      for (const r of sorted) {
        stadiums.add(r.stadium!);
        if (stadiums.size >= 5) { qualifyingDate = r.date; break; }
      }
      return {
        unlocked: stadiums.size >= 5,
        progressCurrent: Math.min(stadiums.size, 5),
        progressTarget: 5,
        qualifyingDate,
      };
    },
  },
  {
    id: "stadium_all",
    badgeKey: "stadium_all",
    emoji: "🗺️",
    title: "전 구장 정복",
    description: "KBO 1군 9개 구장을 모두 방문했어요",
    tier: "epic",
    xp: 100,
    category: "exploration",
    progressTarget: 9,
    check: (records) => {
      const sorted = [...records].filter((r) => r.stadium).sort((a, b) => a.date.localeCompare(b.date));
      const stadiums = new Set<string>();
      let qualifyingDate: string | undefined;
      for (const r of sorted) {
        stadiums.add(r.stadium!);
        if (stadiums.size >= 9) { qualifyingDate = r.date; break; }
      }
      return {
        unlocked: stadiums.size >= 9,
        progressCurrent: Math.min(stadiums.size, 9),
        progressTarget: 9,
        qualifyingDate,
      };
    },
  },
  {
    id: "blowout",
    badgeKey: "blowout",
    emoji: "💪",
    title: "대승 직관",
    description: "10점차 이상 대승 경기 직관",
    tier: "easy",
    xp: 10,
    category: "exploration",
    progressTarget: 1,
    check: (records) => {
      const match = records.find((r) => {
        const win = resolveIsWin(r);
        return win === 1 && r.score_away != null && r.score_home != null && Math.abs(r.score_away! - r.score_home!) >= 10;
      });
      return {
        unlocked: !!match,
        progressCurrent: match ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: match?.date,
      };
    },
  },
  {
    id: "one_run_win",
    badgeKey: "one_run_win",
    emoji: "😱",
    title: "한점차 승리",
    description: "1점차 승리 경기 직관",
    tier: "easy",
    xp: 10,
    category: "exploration",
    progressTarget: 1,
    check: (records) => {
      const match = records.find((r) => {
        const win = resolveIsWin(r);
        return win === 1 && r.score_away != null && r.score_home != null && Math.abs(r.score_away! - r.score_home!) === 1;
      });
      return {
        unlocked: !!match,
        progressCurrent: match ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: match?.date,
      };
    },
  },
  {
    id: "tie_game",
    badgeKey: "tie_game",
    emoji: "🤝",
    title: "무승부 직관",
    description: "무승부 경기 직관",
    tier: "easy",
    xp: 10,
    category: "exploration",
    progressTarget: 1,
    check: (records) => {
      const match = records.find((r) => resolveIsWin(r) === 0);
      return {
        unlocked: !!match,
        progressCurrent: match ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: match?.date,
      };
    },
  },
  {
    id: "shutout",
    badgeKey: "shutout",
    emoji: "🧤",
    title: "완봉승 직관",
    description: "상대팀 0점 승리 직관",
    tier: "easy",
    xp: 10,
    category: "exploration",
    progressTarget: 1,
    check: (records) => {
      const match = records.find((r) => {
        const win = resolveIsWin(r);
        return win === 1 && r.score_away != null && r.score_home != null && (r.score_home === 0 || r.score_away === 0);
      });
      return {
        unlocked: !!match,
        progressCurrent: match ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: match?.date,
      };
    },
  },
  {
    id: "irresponsible_pleasure",
    badgeKey: "irresponsible_pleasure",
    emoji: "🍿",
    title: "책임없는쾌락",
    description: "내 팀이 아닌 경기를 순수하게 즐겼어요 — 타팀 VS 타팀 직관 3회",
    tier: "easy",
    xp: 10,
    category: "exploration",
    progressTarget: 3,
    check: (records, _existingBadges, _attendanceStreak, myTeam) => {
      if (!myTeam) return { unlocked: false, progressCurrent: 0, progressTarget: 3 };
      const otherGames = records.filter((r) => {
        if (!r.game_id) return false;
        const ids = parseGameTeamIds(r.game_id);
        return ids.homeId !== myTeam && ids.awayId !== myTeam;
      });
      const sorted = [...otherGames].sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: otherGames.length >= 3,
        progressCurrent: Math.min(otherGames.length, 3),
        progressTarget: 3,
        qualifyingDate: otherGames.length >= 3 ? sorted[2].date : undefined,
      };
    },
  },
  {
    id: "past_record_1",
    badgeKey: "past_record_1",
    emoji: "📜",
    title: "추억의 시작",
    description: "앱 설치 전 직관 기록을 1개 작성했어요",
    tier: "easy",
    xp: 10,
    category: "exploration",
    progressTarget: 1,
    check: (records, _existingBadges, _attendanceStreak, _myTeam, installDate) => {
      if (!installDate) return { unlocked: false, progressCurrent: 0, progressTarget: 1 };
      const pastRecords = records.filter((r) => r.date < installDate);
      return {
        unlocked: pastRecords.length >= 1,
        progressCurrent: Math.min(pastRecords.length, 1),
        progressTarget: 1,
      };
    },
  },
  {
    id: "past_record_5",
    badgeKey: "past_record_5",
    emoji: "📖",
    title: "추억 소환",
    description: "앱 설치 전 직관 기록을 5개 작성했어요",
    tier: "easy",
    xp: 10,
    category: "exploration",
    progressTarget: 5,
    check: (records, _existingBadges, _attendanceStreak, _myTeam, installDate) => {
      if (!installDate) return { unlocked: false, progressCurrent: 0, progressTarget: 5 };
      const pastRecords = records.filter((r) => r.date < installDate);
      return {
        unlocked: pastRecords.length >= 5,
        progressCurrent: Math.min(pastRecords.length, 5),
        progressTarget: 5,
      };
    },
  },
  {
    id: "past_record_10",
    badgeKey: "past_record_10",
    emoji: "📚",
    title: "추억 수집가",
    description: "앱 설치 전 직관 기록을 10개 작성했어요",
    tier: "medium",
    xp: 25,
    category: "exploration",
    progressTarget: 10,
    check: (records, _existingBadges, _attendanceStreak, _myTeam, installDate) => {
      if (!installDate) return { unlocked: false, progressCurrent: 0, progressTarget: 10 };
      const pastRecords = records.filter((r) => r.date < installDate);
      return {
        unlocked: pastRecords.length >= 10,
        progressCurrent: Math.min(pastRecords.length, 10),
        progressTarget: 10,
      };
    },
  },
  {
    id: "past_record_20",
    badgeKey: "past_record_20",
    emoji: "⏳",
    title: "과거 여행자",
    description: "앱 설치 전 직관 기록을 20개 작성했어요",
    tier: "medium",
    xp: 25,
    category: "exploration",
    progressTarget: 20,
    check: (records, _existingBadges, _attendanceStreak, _myTeam, installDate) => {
      if (!installDate) return { unlocked: false, progressCurrent: 0, progressTarget: 20 };
      const pastRecords = records.filter((r) => r.date < installDate);
      return {
        unlocked: pastRecords.length >= 20,
        progressCurrent: Math.min(pastRecords.length, 20),
        progressTarget: 20,
      };
    },
  },
  {
    id: "past_record_50",
    badgeKey: "past_record_50",
    emoji: "🕰️",
    title: "타임슬립",
    description: "앱 설치 전 직관 기록을 50개 작성했어요",
    tier: "hard",
    xp: 50,
    category: "exploration",
    progressTarget: 50,
    check: (records, _existingBadges, _attendanceStreak, _myTeam, installDate) => {
      if (!installDate) return { unlocked: false, progressCurrent: 0, progressTarget: 50 };
      const pastRecords = records.filter((r) => r.date < installDate);
      return {
        unlocked: pastRecords.length >= 50,
        progressCurrent: Math.min(pastRecords.length, 50),
        progressTarget: 50,
      };
    },
  },
  {
    id: "emotion_collector",
    badgeKey: "emotion_collector",
    emoji: "🎭",
    title: "감정 수집가",
    description: `캐릭터 감정 ${ALL_CHARACTERS.length}종을 모두 모았어요`,
    tier: "hard",
    xp: 50,
    category: "exploration",
    progressTarget: ALL_CHARACTERS.length,
    check: (
      _records,
      _existingBadges,
      _attendanceStreak,
      _myTeam,
      _installDate,
      _totalAttendanceDays,
      unlockedEmotions
    ) => {
      const count = unlockedEmotions?.length ?? 0;
      return {
        unlocked: count >= ALL_CHARACTERS.length,
        progressCurrent: Math.min(count, ALL_CHARACTERS.length),
        progressTarget: ALL_CHARACTERS.length,
      };
    },
  },
  {
    id: "game_type_all",
    badgeKey: "game_type_all",
    emoji: "🎓",
    title: "박학다식",
    description: "정규시즌·시범경기·포스트시즌을 모두 직관했어요",
    tier: "medium",
    xp: 25,
    category: "exploration",
    progressTarget: 3,
    check: (records) => {
      const types = new Set(records.map((r) => r.game_type ?? "regular"));
      return {
        unlocked: types.size >= 3,
        progressCurrent: Math.min(types.size, 3),
        progressTarget: 3,
      };
    },
  },
];
