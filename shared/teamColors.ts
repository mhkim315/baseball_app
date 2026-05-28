import type { TeamColor } from "./types";

export const TEAM_COLORS: Record<string, TeamColor> = {
  doosan: {
    id: "doosan",
    name: "두산 베어스",
    shortName: "두산",
    primary: "#131230",
    primaryLight: "#A8CCF5",
    secondary: "#FFFFFF",
    tertiary: "#C4161C",
  },
  lg: {
    id: "lg",
    name: "LG 트윈스",
    shortName: "LG",
    primary: "#C30452",
    primaryLight: "#F088AA",
    secondary: "#000000",
    tertiary: "#FFFFFF",
  },
  kt: {
    id: "kt",
    name: "KT 위즈",
    shortName: "KT",
    primary: "#000000",
    primaryLight: "#CCCCCC",
    secondary: "#EB1F25",
    tertiary: "#FFFFFF",
  },
  ssg: {
    id: "ssg",
    name: "SSG 랜더스",
    shortName: "SSG",
    primary: "#CE0E2D",
    primaryLight: "#F07A7A",
    secondary: "#F0A832",
    tertiary: "#1D1D1B",
  },
  nc: {
    id: "nc",
    name: "NC 다이노스",
    shortName: "NC",
    primary: "#1D467D",
    primaryLight: "#78ABE8",
    secondary: "#C6973F",
    tertiary: "#FFFFFF",
  },
  samsung: {
    id: "samsung",
    name: "삼성 라이온즈",
    shortName: "삼성",
    primary: "#074CA1",
    primaryLight: "#6AA8EE",
    secondary: "#FFFFFF",
    tertiary: "#C4C4C4",
  },
  lotte: {
    id: "lotte",
    name: "롯데 자이언츠",
    shortName: "롯데",
    primary: "#002B5C",
    primaryLight: "#5A96E0",
    secondary: "#D00F31",
    tertiary: "#FFFFFF",
  },
  hanwha: {
    id: "hanwha",
    name: "한화 이글스",
    shortName: "한화",
    primary: "#FF6600",
    primaryLight: "#FF8833",
    secondary: "#000000",
    tertiary: "#FFFFFF",
  },
  kia: {
    id: "kia",
    name: "KIA 타이거즈",
    shortName: "KIA",
    primary: "#EA0029",
    primaryLight: "#F57085",
    secondary: "#000000",
    tertiary: "#FFFFFF",
  },
  kiwoom: {
    id: "kiwoom",
    name: "키움 히어로즈",
    shortName: "키움",
    primary: "#820024",
    primaryLight: "#DB7490",
    secondary: "#000000",
    tertiary: "#FFFFFF",
  },
};

export const TEAM_LIST = Object.values(TEAM_COLORS);

export function teamPrimaryColor(teamId: string | null | undefined, isDark: boolean): string {
  if (!teamId) return "#888";
  const team = TEAM_COLORS[teamId];
  if (!team) return "#888";
  return isDark ? team.primaryLight || team.primary : team.primary;
}
