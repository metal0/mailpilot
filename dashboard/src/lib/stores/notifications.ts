import { writable, derived, get } from "svelte/store";
import { stats, deadLetters } from "./data";

export type NotificationEvent = "error" | "connection_lost" | "dead_letter" | "retry_exhausted" | "daily_summary";

export interface Notification {
  id: string;
  type: "error" | "warning" | "info";
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  source: "system" | "account" | "deadletter";
  event?: NotificationEvent;
  data?: Record<string, unknown>;
}

export const browserNotificationPermission = writable<NotificationPermission>("default");

const STORAGE_KEY_READ = "mailpilot-notifications-read";
const STORAGE_KEY_DISMISSED = "mailpilot-notifications-dismissed";
const STORAGE_KEY_NOTIFIED = "mailpilot-notifications-sent";

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return fallback;
}

function saveToStorage(key: string, value: unknown): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* ignore */ }
}

function createNotificationsStore() {
  const { subscribe, update, set } = writable<Notification[]>([]);

  const initialDismissed = new Set<string>(loadFromStorage<string[]>(STORAGE_KEY_DISMISSED, []));
  const dismissed = writable<Set<string>>(initialDismissed);

  const initialRead = new Set<string>(loadFromStorage<string[]>(STORAGE_KEY_READ, []));
  const readIds = writable<Set<string>>(initialRead);

  const initialNotified = new Set<string>(loadFromStorage<string[]>(STORAGE_KEY_NOTIFIED, []));
  const notifiedIds = writable<Set<string>>(initialNotified);

  function markRead(id: string): void {
    update((notifications) =>
      notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    readIds.update((r) => {
      r.add(id);
      saveToStorage(STORAGE_KEY_READ, [...r]);
      return r;
    });
  }

  function markAllRead(): void {
    update((notifications) => {
      const ids = notifications.map((n) => n.id);
      readIds.update((r) => {
        ids.forEach((id) => r.add(id));
        saveToStorage(STORAGE_KEY_READ, [...r]);
        return r;
      });
      return notifications.map((n) => ({ ...n, read: true }));
    });
  }

  function dismiss(id: string): void {
    dismissed.update((d) => {
      d.add(id);
      saveToStorage(STORAGE_KEY_DISMISSED, [...d]);
      return d;
    });
  }

  function clearAll(): void {
    // Add all current notification IDs to dismissed set so they don't reappear
    update((current) => {
      const ids = current.map((n) => n.id);
      dismissed.update((d) => {
        ids.forEach((id) => d.add(id));
        saveToStorage(STORAGE_KEY_DISMISSED, [...d]);
        return d;
      });
      return [];
    });
  }

  function isRead(id: string): boolean {
    return get(readIds).has(id);
  }

  function markNotified(id: string): void {
    notifiedIds.update((n) => {
      n.add(id);
      saveToStorage(STORAGE_KEY_NOTIFIED, [...n]);
      return n;
    });
  }

  function wasNotified(id: string): boolean {
    return get(notifiedIds).has(id);
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
    isRead,
    markNotified,
    wasNotified,
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
  const $dismissed = get(notifications.dismissed);
  const newNotifications: Notification[] = [];

  const disconnected = $stats?.accounts.filter(a => !a.connected && !a.paused) ?? [];
  for (const account of disconnected) {
    const id = `disconnect-${account.name}`;
    if (!$dismissed.has(id)) {
      newNotifications.push({
        id,
        type: "error",
        title: "Account Disconnected",
        message: `${account.name} has lost connection`,
        timestamp: Date.now(),
        read: notifications.isRead(id),
        source: "account",
      });
    }
  }

  if ($deadLetters.length > 0) {
    const id = `deadletters-${$deadLetters.length}`;
    if (!$dismissed.has(id)) {
      newNotifications.push({
        id,
        type: "warning",
        title: "Failed Emails",
        message: `${$deadLetters.length} email(s) failed processing`,
        timestamp: Date.now(),
        read: notifications.isRead(id),
        source: "deadletter",
      });
    }
  }

  const errors = $stats?.totals.errors ?? 0;
  if (errors > 0) {
    const id = `errors-total`;
    if (!$dismissed.has(id)) {
      newNotifications.push({
        id,
        type: "warning",
        title: "Processing Errors",
        message: `${errors} total error(s) recorded`,
        timestamp: Date.now(),
        read: notifications.isRead(id),
        source: "system",
      });
    }
  }

  notifications.set(newNotifications);
}

export function addNotification(notification: Omit<Notification, "read">): void {
  notifications.update((current) => {
    const newNotification: Notification = { ...notification, read: false };
    return [newNotification, ...current].slice(0, 100);
  });

  sendBrowserNotification(notification.title, notification.message, notification.id);
}

export function sendBrowserNotification(title: string, body: string, tag?: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  if (Notification.permission === "granted") {
    try {
      new Notification(title, {
        body,
        icon: "/favicon.png",
        tag,
      });
    } catch {
      // Browser notifications may be blocked or unsupported
    }
  }
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }

  if (Notification.permission === "granted") {
    browserNotificationPermission.set("granted");
    return "granted";
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    browserNotificationPermission.set(permission);
    return permission;
  }

  browserNotificationPermission.set("denied");
  return "denied";
}

export function initBrowserNotificationPermission(): void {
  if (typeof window !== "undefined" && "Notification" in window) {
    browserNotificationPermission.set(Notification.permission);
  }
}
