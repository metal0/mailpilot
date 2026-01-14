import { writable, get } from "svelte/store";

export type Theme = "dark" | "light" | "oled" | "high-contrast" | "auto";
export type ResolvedTheme = "dark" | "light" | "oled" | "high-contrast";

const THEMES: Theme[] = ["light", "dark", "oled", "high-contrast", "auto"];

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "auto" ? getSystemTheme() : theme;
}

function createThemeStore() {
  const { subscribe, set, update } = writable<Theme>("dark");

  function applyTheme(value: Theme) {
    const resolved = resolveTheme(value);
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.setAttribute("data-theme-setting", value);
  }

  // Listen for system theme changes when in auto mode
  if (typeof window !== "undefined") {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      const current = localStorage.getItem("theme") as Theme;
      if (current === "auto") {
        applyTheme("auto");
      }
    });
  }

  return {
    subscribe,
    set: (value: Theme) => {
      localStorage.setItem("theme", value);
      applyTheme(value);
      set(value);
    },
    toggle: () => {
      update((current) => {
        const currentIndex = THEMES.indexOf(current);
        const next = THEMES[(currentIndex + 1) % THEMES.length];
        localStorage.setItem("theme", next);
        applyTheme(next);
        return next;
      });
    },
    cycle: () => {
      update((current) => {
        const currentIndex = THEMES.indexOf(current);
        const next = THEMES[(currentIndex + 1) % THEMES.length];
        localStorage.setItem("theme", next);
        applyTheme(next);
        return next;
      });
    },
    getResolved: (): ResolvedTheme => {
      return resolveTheme(get({ subscribe }));
    },
    themes: THEMES,
  };
}

export const theme = createThemeStore();

// Accent color store
function createAccentStore() {
  const defaultAccent = { h: 220, s: 80, l: 50 }; // Blue
  const { subscribe, set } = writable(defaultAccent);

  return {
    subscribe,
    set: (value: { h: number; s: number; l: number }) => {
      localStorage.setItem("accent-color", JSON.stringify(value));
      document.documentElement.style.setProperty("--accent-h", String(value.h));
      document.documentElement.style.setProperty("--accent-s", `${value.s}%`);
      document.documentElement.style.setProperty("--accent-l", `${value.l}%`);
      set(value);
    },
    setPreset: (preset: "blue" | "purple" | "green" | "orange" | "red") => {
      const presets = {
        blue: { h: 220, s: 80, l: 50 },
        purple: { h: 270, s: 70, l: 55 },
        green: { h: 150, s: 70, l: 40 },
        orange: { h: 30, s: 90, l: 50 },
        red: { h: 0, s: 75, l: 55 },
      };
      const value = presets[preset];
      localStorage.setItem("accent-color", JSON.stringify(value));
      document.documentElement.style.setProperty("--accent-h", String(value.h));
      document.documentElement.style.setProperty("--accent-s", `${value.s}%`);
      document.documentElement.style.setProperty("--accent-l", `${value.l}%`);
      set(value);
    },
    init: () => {
      const saved = localStorage.getItem("accent-color");
      if (saved) {
        try {
          const value = JSON.parse(saved);
          document.documentElement.style.setProperty("--accent-h", String(value.h));
          document.documentElement.style.setProperty("--accent-s", `${value.s}%`);
          document.documentElement.style.setProperty("--accent-l", `${value.l}%`);
          set(value);
        } catch {
          // Invalid saved value, use default
        }
      }
    },
  };
}

export const accentColor = createAccentStore();
