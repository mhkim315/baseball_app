import AsyncStorage from "@react-native-async-storage/async-storage";

const WIDGET_TEAM_KEY = "@fullcount_widget_team";

export const SHORT_CODE_TO_TEAM_ID: Record<string, string> = {
  OB: "doosan", LG: "lg", WO: "kiwoom", SK: "ssg",
  KT: "kt", HH: "hanwha", SS: "samsung", HT: "kia",
  LT: "lotte", NC: "nc",
};

export const SHORT_CODE_TO_NAME: Record<string, string> = {
  OB: "두산", LG: "LG", WO: "키움", SK: "SSG",
  KT: "KT", HH: "한화", SS: "삼성", HT: "KIA",
  LT: "롯데", NC: "NC",
};

export async function getMyTeamForWidget(): Promise<string | null> {
  return AsyncStorage.getItem(WIDGET_TEAM_KEY);
}

export async function setWidgetTeam(teamId: string | null): Promise<void> {
  if (teamId) {
    await AsyncStorage.setItem(WIDGET_TEAM_KEY, teamId);
  } else {
    await AsyncStorage.removeItem(WIDGET_TEAM_KEY);
  }
}
