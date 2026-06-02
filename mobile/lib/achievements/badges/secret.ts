import type { BadgeDefinition } from "../types";
import { resolveIsWin } from "@/lib/expenseStats";
import { parseGameTeamIds } from "@shared/constants";
import { computeStreakStats } from "@/lib/stats";
import { findStreakQualifyingDateLoss } from "../helpers";

export const SECRET_BADGES: BadgeDefinition[] = [
  {
    id: "owl",
    badgeKey: "owl",
    emoji: "🦉",
    title: "올빼미",
    description: "새벽 0시~6시 사이에 직관 기록을 작성했어요",
    tier: "medium",
    xp: 25,
    category: "secret",
    progressTarget: 1,
    check: (records) => {
      const owlRecord = records.find((r) => {
        if (!r.created_at) return false;
        const utcHour = parseInt(r.created_at.slice(11, 13), 10);
        const kstHour = (utcHour + 9) % 24;
        return kstHour >= 0 && kstHour < 6;
      });
      return {
        unlocked: !!owlRecord,
        progressCurrent: owlRecord ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: owlRecord ? owlRecord.date : undefined,
      };
    },
  },
  {
    id: "slugfest",
    badgeKey: "slugfest",
    emoji: "💣",
    title: "난타전",
    description: "양 팀 합계 20득점 이상 경기를 직관했어요",
    tier: "easy",
    xp: 10,
    category: "secret",
    progressTarget: 1,
    check: (records) => {
      const slugfest = records.find((r) => {
        if (r.score_home == null || r.score_away == null) return false;
        return r.score_home + r.score_away >= 20;
      });
      return {
        unlocked: !!slugfest,
        progressCurrent: slugfest ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: slugfest ? slugfest.date : undefined,
      };
    },
  },
  {
    id: "comeback",
    badgeKey: "comeback",
    emoji: "🔄",
    title: "컴백",
    description: "30일 이상 공백 후 다시 직관했어요",
    tier: "medium",
    xp: 25,
    category: "secret",
    progressTarget: 1,
    check: (records) => {
      const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
      let qualifyingDate: string | undefined;
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1].date.replace(/\./g, "-"));
        const curr = new Date(sorted[i].date.replace(/\./g, "-"));
        const days = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
        if (days >= 30) {
          qualifyingDate = sorted[i].date;
          break;
        }
      }
      return {
        unlocked: !!qualifyingDate,
        progressCurrent: qualifyingDate ? 1 : 0,
        progressTarget: 1,
        qualifyingDate,
      };
    },
  },
  // ── 팀별 시크릿 배지 ──
  {
    id: "cant_live_without_kia",
    badgeKey: "cant_live_without_kia",
    emoji: "🎵",
    title: "KIA 없인 못 살아",
    description: "KIA 응원가처럼 — KIA 승리를 5회 직관했어요",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "kia",
    progressTarget: 5,
    check: (records) => {
      const wins = records.filter((r) => r.cheered_team === "kia" && resolveIsWin(r) === 1);
      const sorted = [...wins].sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: wins.length >= 5,
        progressCurrent: Math.min(wins.length, 5),
        progressTarget: 5,
        qualifyingDate: wins.length >= 5 ? sorted[4]?.date : undefined,
      };
    },
  },
  {
    id: "jokka_line",
    badgeKey: "jokka_line",
    emoji: "🦾",
    title: "JOKKA 라인",
    description: "전설의 삼성 불펜처럼 — 1점차 접전 승리를 직관했어요",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "samsung",
    progressTarget: 1,
    check: (records) => {
      const match = records.find(
        (r) =>
          r.cheered_team === "samsung" &&
          resolveIsWin(r) === 1 &&
          r.score_away != null &&
          r.score_home != null &&
          Math.abs(r.score_away! - r.score_home!) === 1
      );
      return {
        unlocked: !!match,
        progressCurrent: match ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: match?.date,
      };
    },
  },
  {
    id: "seungri_yojeong",
    badgeKey: "seungri_yojeong",
    emoji: "🧚",
    title: "승리의 요정",
    description: "LG 연속 3승을 직관했어요 — 승리의 요정이 왔나봐요",
    tier: "medium",
    xp: 15,
    category: "secret",
    teamId: "lg",
    progressTarget: 3,
    check: (records) => {
      const lg = [
        ...records
          .filter((r) => r.cheered_team === "lg")
          .reduce((map, r) => {
            map.set(r.date, r);
            return map;
          }, new Map<string, typeof records[0]>())
          .values(),
      ].sort((a, b) => a.date.localeCompare(b.date));
      let streak = 0, best = 0, bestDate: string | undefined;
      for (const r of lg) {
        if (resolveIsWin(r) === 1) {
          streak++;
          if (streak > best) {
            best = streak;
            bestDate = r.date;
          }
        } else {
          streak = 0;
        }
      }
      return {
        unlocked: best >= 3,
        progressCurrent: Math.min(best, 3),
        progressTarget: 3,
        qualifyingDate: bestDate,
      };
    },
  },
  {
    id: "positive_rhythm",
    badgeKey: "positive_rhythm",
    emoji: "🐻",
    title: "긍정리듬",
    description: "두산 2연패 직관 — 괜찮아요, 긍정리듬이 있어요",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "doosan",
    progressTarget: 2,
    check: (records) => {
      const doosan = [
        ...records
          .filter((r) => r.cheered_team === "doosan")
          .reduce((map, r) => {
            map.set(r.date, r);
            return map;
          }, new Map<string, typeof records[0]>())
          .values(),
      ].sort((a, b) => a.date.localeCompare(b.date));
      let streak = 0, best = 0, bestDate: string | undefined;
      for (const r of doosan) {
        if (resolveIsWin(r) === -1) {
          streak++;
          if (streak > best) {
            best = streak;
            bestDate = r.date;
          }
        } else {
          streak = 0;
        }
      }
      return {
        unlocked: best >= 2,
        progressCurrent: Math.min(best, 2),
        progressTarget: 2,
        qualifyingDate: best >= 2 ? bestDate : undefined,
      };
    },
  },
  {
    id: "brand_god",
    badgeKey: "brand_god",
    emoji: "🏷️",
    title: "브랜드의 가치",
    description: "SSG 직관 3회 — 이게 바로 브랜드의 가치",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "ssg",
    progressTarget: 3,
    check: (records) => {
      const ssg = records.filter((r) => r.cheered_team === "ssg").sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: ssg.length >= 3,
        progressCurrent: Math.min(ssg.length, 3),
        progressTarget: 3,
        qualifyingDate: ssg.length >= 3 ? ssg[2]?.date : undefined,
      };
    },
  },
  {
    id: "wiz_magic",
    badgeKey: "wiz_magic",
    emoji: "🪄",
    title: "위즈 매직",
    description: "KT 홈경기 승리를 직관했어요 — 수원의 마법",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "kt",
    progressTarget: 1,
    check: (records) => {
      const match = records.find((r) => {
        if (r.cheered_team !== "kt" || !r.game_id || resolveIsWin(r) !== 1) return false;
        const ids = parseGameTeamIds(r.game_id);
        return ids.homeId === "kt";
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
    id: "kim_taekjin",
    badgeKey: "kim_taekjin",
    emoji: "💻",
    title: "김택진입니다",
    description: "NC 원정경기 승리를 직관했어요 — 구단주의 마음으로",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "nc",
    progressTarget: 1,
    check: (records) => {
      const match = records.find((r) => {
        if (r.cheered_team !== "nc" || !r.game_id || resolveIsWin(r) !== 1) return false;
        const ids = parseGameTeamIds(r.game_id);
        return ids.awayId === "nc";
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
    id: "busan_galmaegi",
    badgeKey: "busan_galmaegi",
    emoji: "🌊",
    title: "부산 갈매기",
    description: "사직구장에서 롯데 직관 — 돛대도 아니 달고 삿대도 없이",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "lotte",
    progressTarget: 3,
    check: (records) => {
      const 사직방문 = records
        .filter((r) => r.cheered_team === "lotte" && r.stadium != null && r.stadium.includes("사직"))
        .sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: 사직방문.length >= 3,
        progressCurrent: Math.min(사직방문.length, 3),
        progressTarget: 3,
        qualifyingDate: 사직방문.length >= 3 ? 사직방문[2].date : undefined,
      };
    },
  },
  {
    id: "im_happy",
    badgeKey: "im_happy",
    emoji: "😇",
    title: "나는 행복합니다",
    description: "한화 직관 8연패 — 그래도 나는 행복합니다",
    tier: "medium",
    xp: 25,
    category: "secret",
    teamId: "hanwha",
    progressTarget: 8,
    check: (records) => {
      const hanwhaRecords = records.filter((r) => r.cheered_team === "hanwha");
      const s = computeStreakStats(hanwhaRecords);
      const best = Math.max(s.longestLose, s.currentType === "L" ? s.currentCount : 0);
      return {
        unlocked: best >= 8,
        progressCurrent: Math.min(best, 8),
        progressTarget: 8,
      };
    },
  },
  {
    id: "heroes_way",
    badgeKey: "heroes_way",
    emoji: "🦸",
    title: "영웅의 길",
    description: "키움 응원 승리를 직관했어요 — 비재벌 구단의 자존심",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "kiwoom",
    progressTarget: 1,
    check: (records) => {
      const match = records.find((r) => r.cheered_team === "kiwoom" && resolveIsWin(r) === 1);
      return {
        unlocked: !!match,
        progressCurrent: match ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: match?.date,
      };
    },
  },
  {
    id: "tiger_charge",
    badgeKey: "tiger_charge",
    emoji: "🐯",
    title: "호랑이 군단",
    description: "KIA 타이거즈의 위엄 — 6점차 대승을 직관했어요",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "kia",
    progressTarget: 1,
    check: (records) => {
      const match = records.find(
        (r) =>
          r.cheered_team === "kia" &&
          resolveIsWin(r) === 1 &&
          r.score_away != null &&
          r.score_home != null &&
          Math.abs(r.score_away! - r.score_home!) >= 6
      );
      return {
        unlocked: !!match,
        progressCurrent: match ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: match?.date,
      };
    },
  },
  {
    id: "lapark_master",
    badgeKey: "lapark_master",
    emoji: "🏟️",
    title: "라팍의 주인",
    description: "삼성 라이온즈 파크에서 홈 승리를 직관했어요",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "samsung",
    progressTarget: 1,
    check: (records) => {
      const match = records.find((r) => {
        if (r.cheered_team !== "samsung" || !r.game_id || resolveIsWin(r) !== 1) return false;
        const ids = parseGameTeamIds(r.game_id);
        return ids.homeId === "samsung";
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
    id: "shinbaram",
    badgeKey: "shinbaram",
    emoji: "🎺",
    title: "신바람 야구",
    description: "LG 8득점 이상 폭발 — 신나는 야구를 직관했어요",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "lg",
    progressTarget: 1,
    check: (records) => {
      const match = records.find((r) => {
        if (r.cheered_team !== "lg" || resolveIsWin(r) !== 1) return false;
        if (r.score_away == null || r.score_home == null || !r.game_id) return false;
        const ids = parseGameTeamIds(r.game_id);
        if (!ids) return false;
        const isHome = ids.homeId === "lg";
        const teamScore = isHome ? r.score_home! : r.score_away!;
        return teamScore >= 8;
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
    id: "jamsil_derby",
    badgeKey: "jamsil_derby",
    emoji: "⚔️",
    title: "잠실 더비 승자",
    description: "LG가 두산을 꺾는 잠실 더비를 직관했어요",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "lg",
    progressTarget: 1,
    check: (records) => {
      const match = records.find((r) => {
        if (r.cheered_team !== "lg" || !r.game_id || resolveIsWin(r) !== 1) return false;
        const ids = parseGameTeamIds(r.game_id);
        const opponent = ids.homeId === "lg" ? ids.awayId : ids.homeId;
        return opponent === "doosan";
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
    id: "jamsil_derby_doosan",
    badgeKey: "jamsil_derby_doosan",
    emoji: "⚔️",
    title: "잠실 더비 승자",
    description: "두산이 LG를 꺾는 잠실 더비를 직관했어요",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "doosan",
    progressTarget: 1,
    check: (records) => {
      const match = records.find((r) => {
        if (r.cheered_team !== "doosan" || !r.game_id || resolveIsWin(r) !== 1) return false;
        const ids = parseGameTeamIds(r.game_id);
        const opponent = ids.homeId === "doosan" ? ids.awayId : ids.homeId;
        return opponent === "lg";
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
    id: "for_victory",
    badgeKey: "for_victory",
    emoji: "🎸",
    title: "승리를 위하여",
    description: "두산의 승전가처럼 — 4점차 이상 승리를 직관했어요",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "doosan",
    progressTarget: 1,
    check: (records) => {
      const match = records.find(
        (r) =>
          r.cheered_team === "doosan" &&
          resolveIsWin(r) === 1 &&
          r.score_away != null &&
          r.score_home != null &&
          Math.abs(r.score_away! - r.score_home!) >= 4
      );
      return {
        unlocked: !!match,
        progressCurrent: match ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: match?.date,
      };
    },
  },
  {
    id: "bazooka",
    badgeKey: "bazooka",
    emoji: "💥",
    title: "바주카 발사",
    description: "SSG 홈경기 3승을 직관했어요 — 레드웨이브의 주인공",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "ssg",
    progressTarget: 3,
    check: (records) => {
      const homeWins = records.filter((r) => {
        if (r.cheered_team !== "ssg" || !r.game_id || resolveIsWin(r) !== 1) return false;
        const ids = parseGameTeamIds(r.game_id);
        return ids.homeId === "ssg";
      });
      const sorted = [...homeWins].sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: homeWins.length >= 3,
        progressCurrent: Math.min(homeWins.length, 3),
        progressTarget: 3,
        qualifyingDate: homeWins.length >= 3 ? sorted[2]?.date : undefined,
      };
    },
  },
  {
    id: "water_festival",
    badgeKey: "water_festival",
    emoji: "💦",
    title: "워터 페스티벌",
    description: "KT 여름 홈경기를 직관했어요 — 시원한 물대포와 함께",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "kt",
    progressTarget: 1,
    check: (records) => {
      const match = records.find((r) => {
        if (r.cheered_team !== "kt") return false;
        const parts = r.date.split(".");
        if (parts.length < 2) return false;
        const month = parseInt(parts[1], 10);
        return month >= 6 && month <= 8;
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
    id: "tears_of_blood",
    badgeKey: "tears_of_blood",
    emoji: "🩸",
    title: "눈물의 피",
    description: "NC가 두산을 5점차로 꺾는 통쾌한 승리를 직관했어요",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "nc",
    progressTarget: 1,
    check: (records) => {
      const match = records.find((r) => {
        if (r.cheered_team !== "nc" || !r.game_id || resolveIsWin(r) !== 1) return false;
        if (r.score_away == null || r.score_home == null) return false;
        const ids = parseGameTeamIds(r.game_id);
        const opponent = ids.homeId === "nc" ? ids.awayId : ids.homeId;
        return opponent === "doosan" && Math.abs(r.score_away! - r.score_home!) >= 5;
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
    id: "busan_port",
    badgeKey: "busan_port",
    emoji: "🎤",
    title: "돌아와요 부산항에",
    description: "사직구장에서 롯데 홈 승리를 직관했어요",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "lotte",
    progressTarget: 1,
    check: (records) => {
      const match = records.find((r) => {
        if (r.cheered_team !== "lotte" || !r.game_id || resolveIsWin(r) !== 1) return false;
        const ids = parseGameTeamIds(r.game_id);
        return ids.homeId === "lotte";
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
    id: "bodhisattva",
    badgeKey: "bodhisattva",
    emoji: "🪷",
    title: "보살팬",
    description: "한화 응원 10회 직관 — 인내와 사랑의 보살팬",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "hanwha",
    progressTarget: 10,
    check: (records) => {
      const hanwha = records.filter((r) => r.cheered_team === "hanwha").sort((a, b) => a.date.localeCompare(b.date));
      return {
        unlocked: hanwha.length >= 10,
        progressCurrent: Math.min(hanwha.length, 10),
        progressTarget: 10,
        qualifyingDate: hanwha.length >= 10 ? hanwha[9].date : undefined,
      };
    },
  },
  {
    id: "small_giant",
    badgeKey: "small_giant",
    emoji: "🦸‍♂️",
    title: "작은 거인",
    description: "키움의 원정 승리를 직관했어요 — 작지만 강한 영웅들",
    tier: "easy",
    xp: 10,
    category: "secret",
    teamId: "kiwoom",
    progressTarget: 1,
    check: (records) => {
      const match = records.find((r) => {
        if (r.cheered_team !== "kiwoom" || !r.game_id || resolveIsWin(r) !== 1) return false;
        const ids = parseGameTeamIds(r.game_id);
        return ids.awayId === "kiwoom";
      });
      return {
        unlocked: !!match,
        progressCurrent: match ? 1 : 0,
        progressTarget: 1,
        qualifyingDate: match?.date,
      };
    },
  },
  // ── 패배 관련 ──
  {
    id: "loss_3",
    badgeKey: "loss_3",
    emoji: "😅",
    title: "그런 날도 있어",
    description: "직관 3연패를 기록했어요 — 누구에게나 있는 법이죠",
    tier: "easy",
    xp: 10,
    category: "secret",
    progressTarget: 3,
    check: (records) => {
      const s = computeStreakStats(records);
      const best = Math.max(s.longestLose, s.currentType === "L" ? s.currentCount : 0);
      return {
        unlocked: best >= 3,
        progressCurrent: Math.min(best, 3),
        progressTarget: 3,
        qualifyingDate: best >= 3 ? findStreakQualifyingDateLoss(records, 3) : undefined,
      };
    },
  },
  {
    id: "loss_5",
    badgeKey: "loss_5",
    emoji: "😇",
    title: "팬질은 원래 고통",
    description: "직관 5연패를 기록했어요 — 그래도 내일은 이기겠죠",
    tier: "medium",
    xp: 25,
    category: "secret",
    progressTarget: 5,
    check: (records) => {
      const s = computeStreakStats(records);
      const best = Math.max(s.longestLose, s.currentType === "L" ? s.currentCount : 0);
      return {
        unlocked: best >= 5,
        progressCurrent: Math.min(best, 5),
        progressTarget: 5,
        qualifyingDate: best >= 5 ? findStreakQualifyingDateLoss(records, 5) : undefined,
      };
    },
  },
];
