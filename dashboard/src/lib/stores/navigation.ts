import { writable } from "svelte/store";

export type Tab = "overview" | "activity" | "logs" | "settings" | "debug";

export interface NavigationState {
  tab: Tab;
  activityFilter?: "all" | "activity" | "errors";
}

export const navigation = writable<NavigationState | null>(null);

export function navigateTo(tab: Tab, options?: { activityFilter?: "all" | "activity" | "errors" }) {
  navigation.set({
    tab,
    activityFilter: options?.activityFilter,
  });
}
