import * as React from "react";
import { useAuthStore } from "@/features/auth/auth-store";
import { apiClient } from "@/lib/api-client";

export type ThemeMode = "light" | "dark" | "system";
export const ACCENT_COLORS = ["default", "blue", "green", "orange", "violet"] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];

interface ThemeContextValue {
  theme: ThemeMode;
  accentColor: AccentColor;
  setTheme: (theme: ThemeMode) => void;
  setAccentColor: (color: AccentColor) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function applyTheme(theme: ThemeMode) {
  const isDark =
    theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

function applyAccent(color: AccentColor) {
  document.documentElement.classList.remove(...ACCENT_COLORS.map((c) => `theme-${c}`));
  if (color !== "default") {
    document.documentElement.classList.add(`theme-${color}`);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [theme, setThemeState] = React.useState<ThemeMode>(
    () => (user?.theme as ThemeMode) ?? (localStorage.getItem("manufactoo-theme") as ThemeMode) ?? "system",
  );
  const [accentColor, setAccentColorState] = React.useState<AccentColor>(
    () => (user?.accentColor as AccentColor) ?? (localStorage.getItem("manufactoo-accent") as AccentColor) ?? "default",
  );

  React.useEffect(() => {
    applyTheme(theme);
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => applyTheme("system");
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }
  }, [theme]);

  React.useEffect(() => {
    applyAccent(accentColor);
  }, [accentColor]);

  const persist = React.useCallback(
    (next: { theme?: ThemeMode; accentColor?: AccentColor }) => {
      if (!user) return;
      void apiClient.put("/api/users/me/preferences", {
        language: user.language,
        theme: next.theme ?? theme,
        accentColor: next.accentColor ?? accentColor,
      });
      updateUser(next);
    },
    [user, theme, accentColor, updateUser],
  );

  const setTheme = React.useCallback(
    (next: ThemeMode) => {
      setThemeState(next);
      localStorage.setItem("manufactoo-theme", next);
      persist({ theme: next });
    },
    [persist],
  );

  const setAccentColor = React.useCallback(
    (next: AccentColor) => {
      setAccentColorState(next);
      localStorage.setItem("manufactoo-accent", next);
      persist({ accentColor: next });
    },
    [persist],
  );

  return (
    <ThemeContext.Provider value={{ theme, accentColor, setTheme, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return ctx;
}
