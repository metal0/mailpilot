import { writable } from "svelte/store";
import { stats, activity, logs, serviceStatus, type ServicesStatus, type DashboardStats } from "./data";
import { addToast } from "./toast";
import { fetchStats } from "../api";

export type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

export const connectionState = writable<ConnectionState>("disconnected");

// Version and restart tracking for update detection
let initialVersion: string | null = null;
let lastKnownUptime: number | null = null;
export const versionMismatch = writable<{ current: string; new: string; serverRestarted?: boolean } | null>(null);

// Track stats changes from any source (API or WebSocket)
function trackVersionAndUptime(statsData: DashboardStats | null): void {
  if (!statsData) return;

  // Track version for update detection
  if (statsData.version) {
    if (initialVersion === null) {
      initialVersion = statsData.version;
      console.log("[version-tracker] Initial version set:", initialVersion);
    } else if (statsData.version !== initialVersion) {
      console.log("[version-tracker] Version mismatch detected:", initialVersion, "->", statsData.version);
      versionMismatch.set({
        current: initialVersion,
        new: statsData.version,
      });
    }
  }

  // Track uptime to detect server restarts
  if (statsData.uptime !== undefined) {
    if (lastKnownUptime !== null && statsData.uptime < lastKnownUptime) {
      // Server restarted - uptime decreased
      console.log("[version-tracker] Server restart detected, uptime:", lastKnownUptime, "->", statsData.uptime);
      versionMismatch.set({
        current: initialVersion ?? "unknown",
        new: statsData.version ?? "unknown",
        serverRestarted: true,
      });
    }
    lastKnownUptime = statsData.uptime;
  }
}

// Subscribe to stats store to track all changes (API and WebSocket)
stats.subscribe(trackVersionAndUptime);

let ws: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000;

interface WebSocketMessage {
  type: "stats" | "activity" | "logs" | "account_update" | "toast" | "service_status";
  data: unknown;
}

function handleMessage(event: MessageEvent): void {
  try {
    const message: WebSocketMessage = JSON.parse(event.data);

    switch (message.type) {
      case "stats": {
        // Version and uptime tracking is handled by stats store subscription
        stats.set(message.data as DashboardStats);
        break;
      }

      case "activity":
        activity.update((current) => {
          const newEntries = Array.isArray(message.data) ? message.data : [message.data];
          // Prepend new entries and limit to 100
          return [...newEntries, ...current].slice(0, 100);
        });
        break;

      case "logs":
        logs.update((current) => {
          const newEntries = Array.isArray(message.data) ? message.data : [message.data];
          return [...newEntries, ...current].slice(0, 500);
        });
        break;

      case "account_update":
        // Trigger stats refresh for account changes
        stats.update((s) => s);
        break;

      case "toast":
        const toast = message.data as { message: string; type?: "info" | "success" | "error" };
        addToast(toast.message, toast.type ?? "info");
        break;

      case "service_status":
        serviceStatus.set(message.data as ServicesStatus);
        break;
    }
  } catch (e) {
    console.error("Failed to parse WebSocket message:", e);
  }
}

function getReconnectDelay(): number {
  // Exponential backoff with jitter
  const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), 30000);
  const jitter = delay * 0.2 * Math.random();
  return delay + jitter;
}

export function connect(): void {
  if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) {
    return;
  }

  connectionState.set("connecting");

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  ws = new WebSocket(wsUrl);

  ws.onopen = async () => {
    connectionState.set("connected");
    reconnectAttempts = 0;
    console.log("WebSocket connected");

    // Fetch fresh stats on connect/reconnect to detect server restarts
    try {
      const freshStats = await fetchStats();
      stats.set(freshStats);
    } catch (e) {
      console.error("Failed to fetch stats on reconnect:", e);
    }
  };

  ws.onmessage = handleMessage;

  ws.onclose = (event) => {
    connectionState.set("disconnected");
    ws = null;

    if (!event.wasClean && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = getReconnectDelay();
      console.log(`WebSocket closed, reconnecting in ${delay}ms...`);
      reconnectTimeout = setTimeout(() => {
        reconnectAttempts++;
        connect();
      }, delay);
    }
  };

  ws.onerror = () => {
    connectionState.set("error");
  };
}

export function disconnect(): void {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (ws) {
    ws.close();
    ws = null;
  }

  connectionState.set("disconnected");
}

export function send(message: unknown): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function dismissVersionMismatch(): void {
  versionMismatch.set(null);
}

export function refreshForNewVersion(): void {
  window.location.reload();
}
