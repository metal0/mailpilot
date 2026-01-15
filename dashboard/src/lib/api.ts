import type { DashboardStats, AuditEntry, LogEntry, DeadLetterEntry } from "./stores/data";

const BASE_URL = "/api";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Unauthorized");
    }
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

// Stats
export async function fetchStats(): Promise<DashboardStats> {
  return fetchJson(`${BASE_URL}/stats`);
}

// Activity
export interface ActivityParams {
  page?: number;
  pageSize?: number;
  accountName?: string;
  actionType?: string;
  actionTypes?: string[];
  search?: string;
  startDate?: number;
  endDate?: number;
}

export interface PaginatedActivity {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchActivity(params: ActivityParams = {}): Promise<PaginatedActivity> {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set("page", String(params.page));
  if (params.pageSize) searchParams.set("pageSize", String(params.pageSize));
  if (params.accountName) searchParams.set("accountName", params.accountName);
  if (params.actionTypes && params.actionTypes.length > 0) {
    searchParams.set("actionTypes", params.actionTypes.join(","));
  } else if (params.actionType) {
    searchParams.set("actionType", params.actionType);
  }
  if (params.search) searchParams.set("search", params.search);
  if (params.startDate) searchParams.set("startDate", String(params.startDate));
  if (params.endDate) searchParams.set("endDate", String(params.endDate));

  const query = searchParams.toString();
  return fetchJson(`${BASE_URL}/activity${query ? `?${query}` : ""}`);
}

// Logs
export interface LogParams {
  page?: number;
  pageSize?: number;
  level?: string;
  accountName?: string;
}

export interface LogsResponse {
  logs: LogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchLogs(params: LogParams = {}): Promise<LogsResponse> {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set("page", String(params.page));
  if (params.pageSize) searchParams.set("pageSize", String(params.pageSize));
  if (params.level) searchParams.set("level", params.level);
  if (params.accountName) searchParams.set("accountName", params.accountName);

  const query = searchParams.toString();
  return fetchJson(`${BASE_URL}/logs${query ? `?${query}` : ""}`);
}

// Dead Letter Queue
export async function fetchDeadLetters(): Promise<{ entries: DeadLetterEntry[]; total: number }> {
  return fetchJson(`${BASE_URL}/dead-letter`);
}

export async function retryDeadLetter(id: number): Promise<{ success: boolean }> {
  return fetchJson(`${BASE_URL}/dead-letter/${id}/retry`, { method: "POST" });
}

export async function dismissDeadLetter(id: number): Promise<{ success: boolean }> {
  return fetchJson(`${BASE_URL}/dead-letter/${id}/dismiss`, { method: "POST" });
}

// Account Actions
export async function pauseAccount(name: string): Promise<{ success: boolean; paused: boolean }> {
  return fetchJson(`${BASE_URL}/accounts/${encodeURIComponent(name)}/pause`, { method: "POST" });
}

export async function resumeAccount(name: string): Promise<{ success: boolean; paused: boolean }> {
  return fetchJson(`${BASE_URL}/accounts/${encodeURIComponent(name)}/resume`, { method: "POST" });
}

export async function reconnectAccount(name: string): Promise<{ success: boolean }> {
  return fetchJson(`${BASE_URL}/accounts/${encodeURIComponent(name)}/reconnect`, { method: "POST" });
}

export async function triggerProcess(name: string, folder = "INBOX"): Promise<{ success: boolean }> {
  return fetchJson(`${BASE_URL}/accounts/${encodeURIComponent(name)}/process?folder=${encodeURIComponent(folder)}`, {
    method: "POST",
  });
}

// Config Reload
export interface ReloadResult {
  success: boolean;
  added: string[];
  removed: string[];
  restarted: string[];
  unchanged: string[];
  errors: string[];
}

export async function reloadConfig(): Promise<ReloadResult> {
  return fetchJson(`${BASE_URL}/reload-config`, { method: "POST" });
}

// Email Preview
export interface EmailPreview {
  messageId: string;
  from: string;
  to: string[];
  subject: string;
  date: string;
  body: string;
  attachments: Array<{ filename: string; size: number; contentType: string }>;
}

export async function fetchEmailPreview(account: string, folder: string, uid: number): Promise<EmailPreview> {
  return fetchJson(`${BASE_URL}/emails/${encodeURIComponent(account)}/${encodeURIComponent(folder)}/${uid}`);
}

// Config Editor
export async function fetchConfig(): Promise<{ config: unknown; configPath: string }> {
  return fetchJson(`${BASE_URL}/config`);
}

export async function saveConfig(config: unknown, reload = true): Promise<{ success: boolean; reloadResult?: ReloadResult }> {
  return fetchJson(`${BASE_URL}/config`, {
    method: "PUT",
    body: JSON.stringify({ config, reload }),
  });
}

// Raw YAML Config Editor
export async function fetchRawConfig(): Promise<{ yaml: string; configPath: string }> {
  return fetchJson(`${BASE_URL}/config/raw`);
}

export async function saveRawConfig(yaml: string, reload = true): Promise<{ success: boolean; reloadResult?: ReloadResult }> {
  return fetchJson(`${BASE_URL}/config/raw`, {
    method: "PUT",
    body: JSON.stringify({ yaml, reload }),
  });
}

// Service Health
export interface ServiceStatus {
  enabled: boolean;
  healthy: boolean;
  url?: string;
}

export interface ServicesStatus {
  tika: ServiceStatus;
  clamav: ServiceStatus;
}

export async function fetchServices(): Promise<ServicesStatus> {
  return fetchJson(`${BASE_URL}/services`);
}

// Comprehensive Health Check
export interface HealthCheckResult {
  services: Record<string, { enabled: boolean; healthy: boolean; url?: string }>;
  llmProviders: Array<{ name: string; model: string; url: string; healthy: boolean }>;
  imapAccounts: Array<{ name: string; connected: boolean; idleSupported: boolean; lastScan: string | null; errors: number }>;
}

export async function fetchHealthCheck(checkLlm = false): Promise<HealthCheckResult> {
  return fetchJson(`${BASE_URL}/health-check${checkLlm ? "?llm=true" : ""}`);
}

// Test IMAP Connection
export interface ImapTestParams {
  host: string;
  port: number;
  tls: string;
  auth: string;
  username: string;
  password?: string;
  oauth_client_id?: string;
  oauth_client_secret?: string;
  oauth_refresh_token?: string;
  name?: string; // Account name - used to lookup existing credentials if masked
}

export interface ImapTestResult {
  success: boolean;
  error?: string;
  capabilities?: string[];
  folders?: string[];
}

export async function testImapConnection(params: ImapTestParams): Promise<ImapTestResult> {
  return fetchJson(`${BASE_URL}/test-imap`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// IMAP Presets
export interface ImapPreset {
  name: string;
  host: string;
}

export async function fetchImapPresets(): Promise<{ presets: ImapPreset[] }> {
  return fetchJson(`${BASE_URL}/imap-presets`);
}

// Probe IMAP Server (no auth)
export interface ImapProbeParams {
  host: string;
}

export interface ImapProviderInfo {
  name: string;
  type: "gmail" | "outlook" | "yahoo" | "icloud" | "fastmail" | "generic";
  requiresOAuth: boolean;
  oauthSupported: boolean;
}

export interface ImapPortConfig {
  port: number;
  tls: "tls" | "starttls" | "none";
}

export interface ImapProbeResult {
  success: boolean;
  provider?: ImapProviderInfo;
  availablePorts?: ImapPortConfig[];
  suggestedPort?: number;
  suggestedTls?: "tls" | "starttls" | "none";
  authMethods?: ("basic" | "oauth2")[];
  capabilities?: string[];
  portLocked?: boolean;
  isPreset?: boolean;
  error?: string;
}

export async function probeImap(params: ImapProbeParams): Promise<ImapProbeResult> {
  return fetchJson(`${BASE_URL}/probe-imap`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// LLM Provider Presets
export interface LlmPreset {
  name: string;
  api_url: string;
  default_model: string;
  api_key_placeholder: string;
  supports_vision: boolean;
}

export async function fetchLlmPresets(): Promise<{ presets: LlmPreset[] }> {
  return fetchJson(`${BASE_URL}/llm-presets`);
}

// Action Types
export type ActionType = "move" | "spam" | "flag" | "read" | "delete" | "noop";

export interface ActionTypesResponse {
  actionTypes: ActionType[];
  defaultAllowed: ActionType[];
}

export async function fetchActionTypes(): Promise<ActionTypesResponse> {
  return fetchJson(`${BASE_URL}/action-types`);
}

// Test LLM Connection
export interface LlmTestParams {
  api_url: string;
  api_key?: string;
  default_model: string;
  name?: string; // Provider name - used to lookup existing API key if masked
}

export interface LlmTestResult {
  success: boolean;
  error?: string;
}

export async function testLlmConnection(params: LlmTestParams): Promise<LlmTestResult> {
  return fetchJson(`${BASE_URL}/test-llm`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// GitHub Release Check
export interface GitHubRelease {
  tag_name: string;
  name: string;
  html_url: string;
  published_at: string;
}

export async function fetchLatestGitHubRelease(): Promise<GitHubRelease | null> {
  try {
    const res = await fetch("https://api.github.com/repos/metal0/mailpilot/releases/latest", {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        // No releases yet
        return null;
      }
      console.error("Failed to fetch GitHub release:", res.status);
      return null;
    }

    return res.json();
  } catch (e) {
    console.error("Failed to fetch GitHub release:", e);
    return null;
  }
}

// Compare semantic versions: returns 1 if a > b, -1 if a < b, 0 if equal
export function compareVersions(a: string, b: string): number {
  // Strip 'v' prefix if present
  const cleanA = a.replace(/^v/, "");
  const cleanB = b.replace(/^v/, "");

  const partsA = cleanA.split(".").map((n) => parseInt(n, 10) || 0);
  const partsB = cleanB.split(".").map((n) => parseInt(n, 10) || 0);

  const maxLen = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLen; i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;

    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }

  return 0;
}

// Export
export function exportCsvUrl(params: ActivityParams = {}): string {
  const searchParams = new URLSearchParams();
  searchParams.set("format", "csv");

  if (params.accountName) searchParams.set("accountName", params.accountName);
  if (params.actionType) searchParams.set("actionType", params.actionType);
  if (params.startDate) searchParams.set("startDate", String(params.startDate));
  if (params.endDate) searchParams.set("endDate", String(params.endDate));

  return `${BASE_URL}/export?${searchParams.toString()}`;
}
