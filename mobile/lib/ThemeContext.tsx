import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { theme as lightTheme, darkTheme, type Theme } from "@/lib/theme";
import { getSetting, setSetting } from "@/lib/db";
interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setDarkMode: (dark: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const val = getSetting("dark_mode");
      if (val === "1") setIsDark(true);
      else if (val === "0") setIsDark(false);
      else setIsDark(systemScheme === "dark");
    } catch {}
  }, []);

  const setDarkMode = useCallback((dark: boolean) => {
    setIsDark(dark);
    setSetting("dark_mode", dark ? "1" : "0");
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !(prev ?? systemScheme === "dark");
      setSetting("dark_mode", next ? "1" : "0");
      return next;
    });
  }, []);

  const resolvedDark = isDark ?? systemScheme === "dark";
  const theme = resolvedDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, isDark: resolvedDark, toggleTheme, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
