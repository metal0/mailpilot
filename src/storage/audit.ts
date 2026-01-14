import { getDatabase } from "./database.js";
import { parseDuration } from "../utils/duration.js";
import { createLogger } from "../utils/logger.js";
import type { LlmAction } from "../llm/parser.js";

const logger = createLogger("audit");

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
  const stmt = db.prepare(`
    INSERT INTO audit_log (message_id, account_name, actions, llm_provider, llm_model, subject, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    messageId,
    accountName,
    JSON.stringify(actions),
    llmProvider ?? null,
    llmModel ?? null,
    subject ?? null,
    Date.now()
  );

  logger.debug("Action logged", {
    messageId,
    accountName,
    actionCount: actions.length,
  });
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
