import { writable, derived, get } from "svelte/store";
import { stats, deadLetters } from "./data";

export interface Notification {
  id: string;
  type: "error" | "warning" | "info";
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  source: "system" | "account" | "deadletter";
}

function createNotificationsStore() {
  const { subscribe, update, set } = writable<Notification[]>([]);
  const dismissed = writable<Set<string>>(new Set());

  function markRead(id: string): void {
    update((notifications) =>
      notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  function markAllRead(): void {
    update((notifications) => notifications.map((n) => ({ ...n, read: true })));
  }

  function dismiss(id: string): void {
    dismissed.update((d) => {
      d.add(id);
      return d;
    });
  }

  function clearAll(): void {
    update(() => []);
    dismissed.set(new Set());
  }

  return {
    subscribe,
    set,
    update,
    markRead,
    markAllRead,
    dismiss,
    clearAll,
    dismissed,
  };
}

export const notifications = createNotificationsStore();

export const unreadCount = derived(
  [notifications, notifications.dismissed],
  ([$notifications, $dismissed]) =>
    $notifications.filter((n) => !n.read && !$dismissed.has(n.id)).length
);

export const alertCount = derived(
  [stats, deadLetters],
  ([$stats, $deadLetters]) => {
    let count = 0;

    const disconnected = $stats?.accounts.filter(a => !a.connected && !a.paused).length ?? 0;
    count += disconnected;

    count += $deadLetters.length;

    const errors = $stats?.totals.errors ?? 0;
    if (errors > 0) count += 1;

    return count;
  }
);

export function generateSystemNotifications(): void {
  const $stats = get(stats);
  const $deadLetters = get(deadLetters);
  const newNotifications: Notification[] = [];

  const disconnected = $stats?.accounts.filter(a => !a.connected && !a.paused) ?? [];
  for (const account of disconnected) {
    newNotifications.push({
      id: `disconnect-${account.name}`,
      type: "error",
      title: "Account Disconnected",
      message: `${account.name} has lost connection`,
      timestamp: Date.now(),
      read: false,
      source: "account",
    });
  }

  if ($deadLetters.length > 0) {
    newNotifications.push({
      id: `deadletters-${$deadLetters.length}`,
      type: "warning",
      title: "Failed Emails",
      message: `${$deadLetters.length} email(s) failed processing`,
      timestamp: Date.now(),
      read: false,
      source: "deadletter",
    });
  }

  const errors = $stats?.totals.errors ?? 0;
  if (errors > 0) {
    newNotifications.push({
      id: `errors-total`,
      type: "warning",
      title: "Processing Errors",
      message: `${errors} total error(s) recorded`,
      timestamp: Date.now(),
      read: false,
      source: "system",
    });
  }

  notifications.set(newNotifications);
}
