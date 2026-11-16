import { useState, useEffect } from "react";

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeTokens {
  text: string;
  secondaryText: string;
  mutedText: string;
  pendingText: string;
  doneText: string;
  primaryBtnBg: string;
  primaryBtnText: string;
  disabledBtnBg: string;
  disabledBtnText: string;
  retryBtnBg: string;
  retryBtnText: string;
  retryBtnBorder: string;
  errorText: string;
  linkText: string;
  failureBg: string;
  failureBorder: string;
  failureTitle: string;
  activeBadgeBg: string;
  doneBadgeBg: string;
  activeOrDoneBadgeText: string;
  pendingBadgeBg: string;
  pendingBadgeText: string;
  focusPrimary: string;
  focusAccent: string;
}

export const LIGHT_THEME: ThemeTokens = {
  text: "#111827",
  secondaryText: "#1f2937",
  mutedText: "#4b5563",
  pendingText: "#6b7280",
  doneText: "#059669",
  primaryBtnBg: "#059669",
  primaryBtnText: "#ffffff",
  disabledBtnBg: "#6b7280",
  disabledBtnText: "#ffffff",
  retryBtnBg: "#f3f4f6",
  retryBtnText: "#1f2937",
  retryBtnBorder: "#d1d5db",
  errorText: "#b91c1c",
  linkText: "#2563eb",
  failureBg: "#fef2f2",
  failureBorder: "#fee2e2",
  failureTitle: "#991b1b",
  activeBadgeBg: "#2563eb",
  doneBadgeBg: "#059669",
  activeOrDoneBadgeText: "#ffffff",
  pendingBadgeBg: "#e5e7eb",
  pendingBadgeText: "#374151",
  focusPrimary: "#047857",
  focusAccent: "#2563eb",
};

export const DARK_THEME: ThemeTokens = {
  text: "#f9fafb",
  secondaryText: "#e5e7eb",
  mutedText: "#d1d5db",
  pendingText: "#9ca3af",
  doneText: "#34d399",
  primaryBtnBg: "#059669",
  primaryBtnText: "#ffffff",
  disabledBtnBg: "#4b5563",
  disabledBtnText: "#ffffff",
  retryBtnBg: "#1f2937",
  retryBtnText: "#f9fafb",
  retryBtnBorder: "#374151",
  errorText: "#fca5a5",
  linkText: "#60a5fa",
  failureBg: "#450a0a",
  failureBorder: "#7f1d1d",
  failureTitle: "#fecaca",
  activeBadgeBg: "#3b82f6",
  doneBadgeBg: "#059669",
  activeOrDoneBadgeText: "#ffffff",
  pendingBadgeBg: "#374151",
  pendingBadgeText: "#e5e7eb",
  focusPrimary: "#34d399",
  focusAccent: "#60a5fa",
};

function getSystemDarkPreference(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useResolvedTheme(theme: ThemeMode = "system"): ThemeTokens {
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    theme === "system" ? getSystemDarkPreference() : false
  );

  useEffect(() => {
    if (
      theme !== "system" ||
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setSystemDark(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [theme]);

  if (theme === "dark") return DARK_THEME;
  if (theme === "light") return LIGHT_THEME;
  return systemDark ? DARK_THEME : LIGHT_THEME;
}

