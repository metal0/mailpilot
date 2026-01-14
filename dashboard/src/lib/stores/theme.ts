import { writable } from "svelte/store";

export type Theme = "dark" | "light";

function createThemeStore() {
  const { subscribe, set, update } = writable<Theme>("dark");

  return {
    subscribe,
    set: (value: Theme) => {
      localStorage.setItem("theme", value);
      document.documentElement.setAttribute("data-theme", value);
      set(value);
    },
    toggle: () => {
      update((current) => {
        const next = current === "dark" ? "light" : "dark";
        localStorage.setItem("theme", next);
        document.documentElement.setAttribute("data-theme", next);
        return next;
      });
    },
  };
}

export const theme = createThemeStore();
