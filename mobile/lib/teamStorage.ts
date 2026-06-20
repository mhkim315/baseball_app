import AsyncStorage from "@react-native-async-storage/async-storage";
import { setMyTeam as setMyTeamInDb, getMyTeam } from "@/lib/db";

const WIDGET_TEAM_KEY = "@fullcount_widget_team";

/**
 * Naver short code → lowercase team ID mapping.
 * Server API (/widget-data, push payload) uses short codes (OB, LG, HT…),
 * while the app stores team IDs as lowercase names (doosan, lg, kia…).
 */
export const SHORT_CODE_TO_TEAM_ID: Record<string, string> = {
  OB: "doosan", LG: "lg", WO: "kiwoom", SK: "ssg",
  KT: "kt", HH: "hanwha", SS: "samsung", HT: "kia",
  LT: "lotte", NC: "nc",
};

/** Reverse lookup: team ID → short code */
export const TEAM_ID_TO_SHORT_CODE: Record<string, string> = {
  doosan: "OB", lg: "LG", kiwoom: "WO", ssg: "SK",
  kt: "KT", hanwha: "HH", samsung: "SS", kia: "HT",
  lotte: "LT", nc: "NC",
};

/** Short code → Korean display name (for widget UI when API name not available) */
export const SHORT_CODE_TO_NAME: Record<string, string> = {
  OB: "두산", LG: "LG", WO: "키움", SK: "SSG",
  KT: "KT", HH: "한화", SS: "삼성", HT: "KIA",
  LT: "롯데", NC: "NC",
};

export async function getMyTeamForWidget(): Promise<string | null> {
  let team = await AsyncStorage.getItem(WIDGET_TEAM_KEY);
  // Fallback: 기존 사용자는 DB에만 팀 정보 있음
  if (!team) {
    try { team = getMyTeam(); } catch { /* DB not available in widget process */ }
    if (team) await AsyncStorage.setItem(WIDGET_TEAM_KEY, team);
  }
  return team;
}

export async function setMyTeamWithSync(teamId: string | null): Promise<void> {
  if (teamId) {
    setMyTeamInDb(teamId);
    await AsyncStorage.setItem(WIDGET_TEAM_KEY, teamId);
  } else {
    await AsyncStorage.removeItem(WIDGET_TEAM_KEY);
  }
}

const WIDGET_ATTENDANCE_KEY = "@fullcount_widget_attendance";

export interface AttendanceSummary {
  total: number;
  wins: number;
  losses: number;
  ties: number;
  winRate: number; // 0-100
}

export async function getAttendanceForWidget(): Promise<AttendanceSummary | null> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_ATTENDANCE_KEY);
    if (raw) return JSON.parse(raw) as AttendanceSummary;
  } catch { /* ignore */ }
  return null;
}

export async function setAttendanceForWidget(summary: AttendanceSummary): Promise<void> {
  await AsyncStorage.setItem(WIDGET_ATTENDANCE_KEY, JSON.stringify(summary));
}
