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
  if (params.actionType) searchParams.set("actionType", params.actionType);
  if (params.search) searchParams.set("search", params.search);
  if (params.startDate) searchParams.set("startDate", String(params.startDate));
  if (params.endDate) searchParams.set("endDate", String(params.endDate));

  const query = searchParams.toString();
  return fetchJson(`${BASE_URL}/activity${query ? `?${query}` : ""}`);
}

// Logs
export interface LogParams {
  limit?: number;
  level?: string;
  accountName?: string;
}

export async function fetchLogs(params: LogParams = {}): Promise<{ logs: LogEntry[] }> {
  const searchParams = new URLSearchParams();

  if (params.limit) searchParams.set("limit", String(params.limit));
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
