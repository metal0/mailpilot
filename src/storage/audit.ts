import { getDatabase } from "./database.js";
import { parseDuration } from "../utils/duration.js";
import { createLogger } from "../utils/logger.js";
import type { LlmAction } from "../llm/parser.js";

const logger = createLogger("audit");

// Optional WebSocket broadcast function (set by server during startup)
let broadcastActivityFn: ((data: unknown) => void) | null = null;

export function setActivityBroadcast(fn: (data: unknown) => void): void {
  broadcastActivityFn = fn;
}

export interface AuditEntry {
  id: number;
  messageId: string;
  accountName: string;
  actions: LlmAction[];
  llmProvider?: string;
  llmModel?: string;
  subject?: string;
  createdAt: number;
}

export function logAction(
  messageId: string,
  accountName: string,
  actions: LlmAction[],
  llmProvider?: string,
  llmModel?: string,
  subject?: string
): void {
  const db = getDatabase();
  const createdAt = Date.now();

  const stmt = db.prepare(`
    INSERT INTO audit_log (message_id, account_name, actions, llm_provider, llm_model, subject, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    messageId,
    accountName,
    JSON.stringify(actions),
    llmProvider ?? null,
    llmModel ?? null,
    subject ?? null,
    createdAt
  );

  logger.debug("Action logged", {
    messageId,
    accountName,
    actionCount: actions.length,
  });

  // Broadcast to WebSocket clients
  if (broadcastActivityFn) {
    const entry: AuditEntry = {
      id: Number(result.lastInsertRowid),
      messageId,
      accountName,
      actions,
      createdAt,
    };
    if (llmProvider) entry.llmProvider = llmProvider;
    if (llmModel) entry.llmModel = llmModel;
    if (subject) entry.subject = subject;

    broadcastActivityFn(entry);
  }
}

export function cleanupAuditLog(retention: string): number {
  const retentionMs = parseDuration(retention);
  const cutoff = Date.now() - retentionMs;

  const db = getDatabase();
  const stmt = db.prepare(`
    DELETE FROM audit_log
    WHERE created_at < ?
  `);
  const result = stmt.run(cutoff);

  if (result.changes > 0) {
    logger.info("Cleaned up expired audit entries", {
      deleted: result.changes,
      retention,
    });
  }

  return result.changes;
}

export function getAuditEntries(
  accountName?: string,
  limit = 100
): AuditEntry[] {
  const db = getDatabase();

  let query = `
    SELECT id, message_id, account_name, actions, llm_provider, llm_model, subject, created_at
    FROM audit_log
  `;
  const params: (string | number)[] = [];

  if (accountName) {
    query += ` WHERE account_name = ?`;
    params.push(accountName);
  }

  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);

  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as Array<{
    id: number;
    message_id: string;
    account_name: string;
    actions: string;
    llm_provider: string | null;
    llm_model: string | null;
    subject: string | null;
    created_at: number;
  }>;

  return rows.map((row) => {
    const entry: AuditEntry = {
      id: row.id,
      messageId: row.message_id,
      accountName: row.account_name,
      actions: JSON.parse(row.actions) as LlmAction[],
      createdAt: row.created_at,
    };

    if (row.llm_provider !== null) {
      entry.llmProvider = row.llm_provider;
    }
    if (row.llm_model !== null) {
      entry.llmModel = row.llm_model;
    }
    if (row.subject !== null) {
      entry.subject = row.subject;
    }

    return entry;
  });
}

export function getActionCount(accountName?: string): number {
  const db = getDatabase();

  if (accountName) {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM audit_log
      WHERE account_name = ?
    `);
    const result = stmt.get(accountName) as { count: number };
    return result.count;
  }

  const stmt = db.prepare(`SELECT COUNT(*) as count FROM audit_log`);
  const result = stmt.get() as { count: number };
  return result.count;
}

export interface ActionBreakdown {
  type: string;
  count: number;
}

export function getActionBreakdown(): ActionBreakdown[] {
  const db = getDatabase();

  // SQLite json_each to extract action types from the JSON array
  const stmt = db.prepare(`
    SELECT
      json_extract(value, '$.type') as type,
      COUNT(*) as count
    FROM audit_log, json_each(actions)
    GROUP BY type
    ORDER BY count DESC
  `);

  const rows = stmt.all() as Array<{ type: string; count: number }>;
  return rows;
}

export interface PaginatedAuditResult {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuditFilters {
  accountName?: string;
  actionType?: string;
  startDate?: number;
  endDate?: number;
  search?: string;
}

export function getAuditEntriesPaginated(
  page = 1,
  pageSize = 20,
  filters: AuditFilters = {}
): PaginatedAuditResult {
  const db = getDatabase();
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.accountName) {
    conditions.push("account_name = ?");
    params.push(filters.accountName);
  }

  if (filters.actionType) {
    conditions.push("EXISTS (SELECT 1 FROM json_each(actions) WHERE json_extract(value, '$.type') = ?)");
    params.push(filters.actionType);
  }

  if (filters.startDate) {
    conditions.push("created_at >= ?");
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push("created_at <= ?");
    params.push(filters.endDate);
  }

  if (filters.search) {
    conditions.push("(subject LIKE ? OR message_id LIKE ? OR account_name LIKE ?)");
    const searchPattern = `%${filters.search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Get total count
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM audit_log ${whereClause}`);
  const countResult = countStmt.get(...params) as { count: number };
  const total = countResult.count;

  // Get paginated entries
  const queryParams = [...params, pageSize, offset];
  const stmt = db.prepare(`
    SELECT id, message_id, account_name, actions, llm_provider, llm_model, subject, created_at
    FROM audit_log
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);

  const rows = stmt.all(...queryParams) as Array<{
    id: number;
    message_id: string;
    account_name: string;
    actions: string;
    llm_provider: string | null;
    llm_model: string | null;
    subject: string | null;
    created_at: number;
  }>;

  const entries = rows.map((row) => {
    const entry: AuditEntry = {
      id: row.id,
      messageId: row.message_id,
      accountName: row.account_name,
      actions: JSON.parse(row.actions) as LlmAction[],
      createdAt: row.created_at,
    };

    if (row.llm_provider !== null) {
      entry.llmProvider = row.llm_provider;
    }
    if (row.llm_model !== null) {
      entry.llmModel = row.llm_model;
    }
    if (row.subject !== null) {
      entry.subject = row.subject;
    }

    return entry;
  });

  return {
    entries,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export function exportAuditLog(filters: AuditFilters = {}): AuditEntry[] {
  const db = getDatabase();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.accountName) {
    conditions.push("account_name = ?");
    params.push(filters.accountName);
  }

  if (filters.actionType) {
    conditions.push("EXISTS (SELECT 1 FROM json_each(actions) WHERE json_extract(value, '$.type') = ?)");
    params.push(filters.actionType);
  }

  if (filters.startDate) {
    conditions.push("created_at >= ?");
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push("created_at <= ?");
    params.push(filters.endDate);
  }

  if (filters.search) {
    conditions.push("(subject LIKE ? OR message_id LIKE ? OR account_name LIKE ?)");
    const searchPattern = `%${filters.search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const stmt = db.prepare(`
    SELECT id, message_id, account_name, actions, llm_provider, llm_model, subject, created_at
    FROM audit_log
    ${whereClause}
    ORDER BY created_at DESC
  `);

  const rows = stmt.all(...params) as Array<{
    id: number;
    message_id: string;
    account_name: string;
    actions: string;
    llm_provider: string | null;
    llm_model: string | null;
    subject: string | null;
    created_at: number;
  }>;

  return rows.map((row) => {
    const entry: AuditEntry = {
      id: row.id,
      messageId: row.message_id,
      accountName: row.account_name,
      actions: JSON.parse(row.actions) as LlmAction[],
      createdAt: row.created_at,
    };

    if (row.llm_provider !== null) {
      entry.llmProvider = row.llm_provider;
    }
    if (row.llm_model !== null) {
      entry.llmModel = row.llm_model;
    }
    if (row.subject !== null) {
      entry.subject = row.subject;
    }

    return entry;
  });
}
