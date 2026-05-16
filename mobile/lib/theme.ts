// 웹앱 라이트 테마 색상 (CSS 변수 → React Native)
// Reference: client/src/index.css :root

export const theme = {
  background: "#faf9f5",
  foreground: "#1e1e25",
  card: "#fefef9",
  cardForeground: "#1e1e25",
  primary: "#e07b3c",
  primaryForeground: "#fafaf8",
  secondary: "#efede7",
  secondaryForeground: "#50505a",
  muted: "#efedeb",
  mutedForeground: "#75757e",
  accent: "#e8e2d2",
  accentForeground: "#1e1e25",
  destructive: "#d73b3b",
  destructiveForeground: "#fefefe",
  border: "#e1ded8",
  input: "#e1ded8",
  ring: "#e07b3c",

  // Semantic aliases
  success: "#2e7d32",
  warning: "#ed6c02",
  info: "#0288d1",

  // Tab bar
  tabBarBackground: "#fefef9",
  tabBarBorder: "#e1ded8",
  tabBarActive: "#e07b3c",
  tabBarInactive: "#75757e",
};

export type Theme = typeof theme;

// 다크 모드 컬러 (향후 사용)
export const darkTheme: Theme = {
  background: "#111",
  foreground: "#fff",
  card: "#1a1a1a",
  cardForeground: "#fff",
  primary: "#e07b3c",
  primaryForeground: "#fff",
  secondary: "#2a2a2a",
  secondaryForeground: "#888",
  muted: "#2a2a2a",
  mutedForeground: "#888",
  accent: "#2a2a2a",
  accentForeground: "#fff",
  destructive: "#ef4444",
  destructiveForeground: "#fff",
  border: "#333",
  input: "#333",
  ring: "#e07b3c",
  success: "#4caf50",
  warning: "#ff9800",
  info: "#29b6f6",

  tabBarBackground: "#1a1a1a",
  tabBarBorder: "#333",
  tabBarActive: "#fff",
  tabBarInactive: "#666",
};
