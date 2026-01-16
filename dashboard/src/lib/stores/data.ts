import { writable, derived } from "svelte/store";

export interface AccountStatus {
  name: string;
  connected: boolean;
  paused: boolean;
  idleSupported: boolean;
  llmProvider: string;
  llmModel: string;
  lastScan: string | null;
  emailsProcessed: number;
  actionsTaken: number;
  errors: number;
  imapHost: string;
  imapPort: number;
  imapUsername: string;
}

export interface ActionBreakdown {
  type: string;
  count: number;
}

export interface ProviderStats {
  name: string;
  model: string;
  requestsToday: number;
  requestsTotal: number;
  requestsLastMinute: number;
  rateLimited: boolean;
  rpmLimit?: number;
  healthy: boolean;
  healthStale: boolean;
}

export interface QueueStatus {
  accountName: string;
  folder: string;
  processing: boolean;
  pendingCount: number;
}

export interface AuditEntry {
  id: number;
  messageId: string;
  accountName: string;
  actions: Array<{ type: string; folder?: string; flags?: string[]; reason?: string }>;
  llmProvider?: string;
  llmModel?: string;
  subject?: string;
  createdAt: number;
}

export interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  context: string;
  message: string;
  meta?: Record<string, unknown>;
}

export type RetryStatus = "pending" | "retrying" | "exhausted" | "success";

export interface DeadLetterEntry {
  id: number;
  messageId: string;
  accountName: string;
  folder: string;
  uid: number;
  error: string;
  attempts: number;
  createdAt: number;
  retryStatus: RetryStatus;
  nextRetryAt: number | null;
  lastRetryAt: number | null;
}

export interface DashboardStats {
  version: string;
  uptime: number;
  dryRun: boolean;
  totals: {
    emailsProcessed: number;
    actionsTaken: number;
    errors: number;
  };
  accounts: AccountStatus[];
  actionBreakdown: ActionBreakdown[];
  providerStats: ProviderStats[];
  queueStatus: QueueStatus[];
  deadLetterCount: number;
}

export interface ServiceStatus {
  enabled: boolean;
  healthy: boolean;
  url?: string;
}

export interface ServicesStatus {
  tika: ServiceStatus;
  clamav: ServiceStatus;
}

// Main data stores
export const stats = writable<DashboardStats | null>(null);
export const activity = writable<AuditEntry[]>([]);
export const logs = writable<LogEntry[]>([]);
export const deadLetters = writable<DeadLetterEntry[]>([]);
export const serviceStatus = writable<ServicesStatus | null>(null);

// Filter stores
export const selectedAccount = writable<string | null>(null);
export const searchQuery = writable<string>("");
export const logLevel = writable<string>("");

// Activity-specific filter stores (persisted across tab switches)
export const activitySearchQuery = writable<string>("");
export const activitySelectedFilters = writable<Set<string>>(new Set(["move", "flag", "read", "delete", "spam", "noop", "errors"]));

// Logs-specific filter stores (persisted across tab switches)
export const logsSearchQuery = writable<string>("");
export const logsSelectedLevels = writable<Set<string>>(new Set(["debug", "info", "warn", "error"]));

// Derived stores for filtered data
export const filteredActivity = derived(
  [activity, selectedAccount, searchQuery],
  ([$activity, $selectedAccount, $searchQuery]) => {
    let result = $activity;

    if ($selectedAccount) {
      result = result.filter((a) => a.accountName === $selectedAccount);
    }

    if ($searchQuery) {
      const query = $searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.subject?.toLowerCase().includes(query) ||
          a.messageId.toLowerCase().includes(query) ||
          a.accountName.toLowerCase().includes(query)
      );
    }

    return result;
  }
);

export const filteredLogs = derived(
  [logs, selectedAccount, logLevel],
  ([$logs, $selectedAccount, $logLevel]) => {
    let result = $logs;

    if ($selectedAccount) {
      result = result.filter((l) => l.context.includes($selectedAccount));
    }

    if ($logLevel) {
      const levels = ["debug", "info", "warn", "error"];
      const minLevel = levels.indexOf($logLevel);
      result = result.filter((l) => levels.indexOf(l.level) >= minLevel);
    }

    // Return in reverse chronological order (newest first)
    return [...result].reverse();
  }
);

// Account list derived from stats
export const accountList = derived(stats, ($stats) => {
  return $stats?.accounts.map((a) => a.name) ?? [];
});
