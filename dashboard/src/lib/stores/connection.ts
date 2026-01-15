import { writable, derived, get } from "svelte/store";
import { connectionState, type ConnectionState } from "./websocket";

// API reachability state
export const apiReachable = writable(true);

// Track durations
export const bothUnreachableDuration = writable(0);
export const wsOnlyUnreachableDuration = writable(0);

// Connection blocked state:
// - Both unreachable for 3+ seconds, OR
// - WebSocket only down for 30+ seconds
export const connectionBlocked = derived(
  [bothUnreachableDuration, wsOnlyUnreachableDuration],
  ([$bothDuration, $wsOnlyDuration]) => $bothDuration >= 3000 || $wsOnlyDuration >= 30000
);

// Reason for blocking (for display purposes)
export const blockReason = derived(
  [bothUnreachableDuration, wsOnlyUnreachableDuration],
  ([$bothDuration, $wsOnlyDuration]) => {
    if ($bothDuration >= 3000) return "both";
    if ($wsOnlyDuration >= 30000) return "websocket";
    return null;
  }
);

// Check API reachability
async function checkApiReachability(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch("/api/stats", {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

// Connection monitor
let monitorInterval: ReturnType<typeof setInterval> | null = null;
let bothUnreachableStartTime: number | null = null;
let wsOnlyUnreachableStartTime: number | null = null;

function isWebSocketDown(state: ConnectionState): boolean {
  // Only "connected" is considered up - connecting/disconnected/error are all down
  return state !== "connected";
}

export function startConnectionMonitor(): void {
  if (monitorInterval) return;

  // Check immediately
  runCheck();

  // Then check every second
  monitorInterval = setInterval(runCheck, 1000);
}

async function runCheck(): Promise<void> {
  const wsState = get(connectionState);
  const wsDown = isWebSocketDown(wsState);

  if (!wsDown) {
    // WebSocket is up - everything is fine
    apiReachable.set(true);
    bothUnreachableStartTime = null;
    wsOnlyUnreachableStartTime = null;
    bothUnreachableDuration.set(0);
    wsOnlyUnreachableDuration.set(0);
    return;
  }

  // WebSocket is down - check API
  const apiUp = await checkApiReachability();
  apiReachable.set(apiUp);

  if (!apiUp) {
    // Both down
    wsOnlyUnreachableStartTime = null;
    wsOnlyUnreachableDuration.set(0);

    if (bothUnreachableStartTime === null) {
      bothUnreachableStartTime = Date.now();
    }
    bothUnreachableDuration.set(Date.now() - bothUnreachableStartTime);
  } else {
    // Only WS down (API is up)
    bothUnreachableStartTime = null;
    bothUnreachableDuration.set(0);

    if (wsOnlyUnreachableStartTime === null) {
      wsOnlyUnreachableStartTime = Date.now();
    }
    wsOnlyUnreachableDuration.set(Date.now() - wsOnlyUnreachableStartTime);
  }
}

export function stopConnectionMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  bothUnreachableStartTime = null;
  wsOnlyUnreachableStartTime = null;
  bothUnreachableDuration.set(0);
  wsOnlyUnreachableDuration.set(0);
}
