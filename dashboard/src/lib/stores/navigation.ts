import { writable } from "svelte/store";

export type Tab = "overview" | "activity" | "logs" | "settings" | "debug";

export interface NavigationState {
  tab: Tab;
  activityFilter?: "all" | "errors";
}

export const navigation = writable<NavigationState | null>(null);

// Track if settings has unsaved changes
export const settingsHasChanges = writable<boolean>(false);

export function navigateTo(tab: Tab, options?: { activityFilter?: "all" | "errors" }) {
  navigation.set({
    tab,
    activityFilter: options?.activityFilter,
  });
}
