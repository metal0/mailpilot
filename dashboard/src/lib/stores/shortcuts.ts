import { writable, get } from "svelte/store";

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  scope: "global" | "activity" | "logs" | "settings" | "overview" | "debug";
}

export const SHORTCUTS: Record<string, Shortcut> = {
  // Tab navigation
  tab1: { key: "1", description: "Go to Overview", scope: "global" },
  tab2: { key: "2", description: "Go to Activity", scope: "global" },
  tab3: { key: "3", description: "Go to Logs", scope: "global" },
  tab4: { key: "4", description: "Go to Settings", scope: "global" },
  tab5: { key: "5", description: "Go to Debug", scope: "global" },

  // Global shortcuts
  help: { key: "?", shift: true, description: "Show keyboard shortcuts", scope: "global" },
  escape: { key: "Escape", description: "Close modal / Clear selection", scope: "global" },
  settings: { key: ",", ctrl: true, description: "Open Settings", scope: "global" },

  // List navigation (Activity & Logs)
  down: { key: "j", description: "Move down in list", scope: "activity" },
  up: { key: "k", description: "Move up in list", scope: "activity" },
  open: { key: "Enter", description: "Open selected item", scope: "activity" },
  retry: { key: "r", description: "Retry selected dead letter", scope: "activity" },
  dismiss: { key: "d", description: "Dismiss selected dead letter", scope: "activity" },

  // Search/filter
  search: { key: "f", description: "Focus search/filter", scope: "activity" },
  searchAlt: { key: "/", description: "Focus search/filter", scope: "activity" },

  // Streaming toggle
  toggleStream: { key: "p", description: "Toggle live streaming", scope: "activity" },
};

// User preference for shortcuts enabled/disabled
function createShortcutsEnabled() {
  const stored = typeof localStorage !== "undefined"
    ? localStorage.getItem("shortcuts.enabled")
    : null;
  const initial = stored === null ? true : stored === "true";

  const { subscribe, set, update } = writable(initial);

  return {
    subscribe,
    set: (value: boolean) => {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("shortcuts.enabled", String(value));
      }
      set(value);
    },
    toggle: () => {
      update((v) => {
        const newVal = !v;
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("shortcuts.enabled", String(newVal));
        }
        return newVal;
      });
    },
  };
}

export const shortcutsEnabled = createShortcutsEnabled();

// Current active scope
export const currentScope = writable<string>("overview");

// Help modal visibility
export const showShortcutsHelp = writable(false);

// Selected item index for list navigation
export const selectedIndex = writable<number>(-1);

// Check if a keyboard event matches a shortcut
export function matchesShortcut(event: KeyboardEvent, shortcut: Shortcut): boolean {
  const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase() ||
    (shortcut.key === "?" && event.key === "?" && event.shiftKey);

  const ctrlMatches = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
  const shiftMatches = shortcut.key === "?" ? true : !!shortcut.shift === event.shiftKey;
  const altMatches = !!shortcut.alt === event.altKey;

  return keyMatches && ctrlMatches && shiftMatches && altMatches;
}

// Check if the event target is an input element
export function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  return false;
}

// Get shortcuts for a specific scope (includes global shortcuts)
export function getShortcutsForScope(scope: string): Array<{ id: string; shortcut: Shortcut }> {
  return Object.entries(SHORTCUTS)
    .filter(([, s]) => s.scope === "global" || s.scope === scope)
    .map(([id, shortcut]) => ({ id, shortcut }));
}

// Format shortcut key for display
export function formatShortcutKey(shortcut: Shortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrl) {
    parts.push(navigator.platform.includes("Mac") ? "⌘" : "Ctrl");
  }
  if (shortcut.alt) {
    parts.push(navigator.platform.includes("Mac") ? "⌥" : "Alt");
  }
  if (shortcut.shift) {
    parts.push("Shift");
  }

  let key = shortcut.key;
  if (key === "Escape") key = "Esc";
  if (key === "Enter") key = "↵";
  if (key === " ") key = "Space";

  parts.push(key.toUpperCase());

  return parts.join(" + ");
}
