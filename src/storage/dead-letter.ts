import { getDatabase } from "./database.js";
import { parseDuration } from "../utils/duration.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("dead-letter");

export type RetryStatus = "pending" | "retrying" | "exhausted" | "success" | "skipped";

export interface DeadLetterEntry {
  id: number;
  messageId: string;
  accountName: string;
  folder: string;
  uid: number;
  error: string;
  attempts: number;
  createdAt: number;
  resolvedAt: number | null;
  retryStatus: RetryStatus;
  nextRetryAt: number | null;
  lastRetryAt: number | null;
}

export function addToDeadLetter(
  messageId: string,
  accountName: string,
  folder: string,
  uid: number,
  error: string
): number {
  const db = getDatabase();

  // Check if entry already exists for this message
  const existing = db.prepare(`
    SELECT id, attempts FROM dead_letter
    WHERE message_id = ? AND account_name = ? AND resolved_at IS NULL
  `).get(messageId, accountName) as { id: number; attempts: number } | undefined;

  if (existing) {
    // Update existing entry
    db.prepare(`
      UPDATE dead_letter
      SET attempts = attempts + 1, error = ?, folder = ?, uid = ?
      WHERE id = ?
    `).run(error, folder, uid, existing.id);

    logger.debug("Updated dead letter entry", {
      id: existing.id,
      messageId,
      accountName,
      attempts: existing.attempts + 1,
    });

    return existing.id;
  }

  // Insert new entry
  const result = db.prepare(`
    INSERT INTO dead_letter (message_id, account_name, folder, uid, error, attempts, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run(messageId, accountName, folder, uid, error, Date.now());

  logger.info("Added to dead letter queue", {
    id: result.lastInsertRowid,
    messageId,
    accountName,
    folder,
    uid,
  });

  return Number(result.lastInsertRowid);
}

export function getDeadLetterEntries(accountName?: string): DeadLetterEntry[] {
  const db = getDatabase();

  let query = `
    SELECT id, message_id, account_name, folder, uid, error, attempts, created_at, resolved_at,
           retry_status, next_retry_at, last_retry_at
    FROM dead_letter
  `;
  const params: string[] = [];
  const conditions: string[] = [];

  if (accountName) {
    conditions.push(`account_name = ?`);
    params.push(accountName);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += ` ORDER BY created_at DESC`;

  const rows = db.prepare(query).all(...params) as Array<{
    id: number;
    message_id: string;
    account_name: string;
    folder: string;
    uid: number;
    error: string;
    attempts: number;
    created_at: number;
    resolved_at: number | null;
    retry_status: RetryStatus | null;
    next_retry_at: number | null;
    last_retry_at: number | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    messageId: row.message_id,
    accountName: row.account_name,
    folder: row.folder,
    uid: row.uid,
    error: row.error,
    attempts: row.attempts,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    retryStatus: row.retry_status ?? "pending",
    nextRetryAt: row.next_retry_at,
    lastRetryAt: row.last_retry_at,
  }));
}

export function getDeadLetterCount(): number {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM dead_letter WHERE resolved_at IS NULL
  `).get() as { count: number };
  return result.count;
}

export function getDeadLetterById(id: number): DeadLetterEntry | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT id, message_id, account_name, folder, uid, error, attempts, created_at, resolved_at,
           retry_status, next_retry_at, last_retry_at
    FROM dead_letter
    WHERE id = ?
  `).get(id) as {
    id: number;
    message_id: string;
    account_name: string;
    folder: string;
    uid: number;
    error: string;
    attempts: number;
    created_at: number;
    resolved_at: number | null;
    retry_status: RetryStatus | null;
    next_retry_at: number | null;
    last_retry_at: number | null;
  } | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    messageId: row.message_id,
    accountName: row.account_name,
    folder: row.folder,
    uid: row.uid,
    error: row.error,
    attempts: row.attempts,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    retryStatus: row.retry_status ?? "pending",
    nextRetryAt: row.next_retry_at,
    lastRetryAt: row.last_retry_at,
  };
}

export function resolveDeadLetter(id: number): boolean {
  const db = getDatabase();
  const result = db.prepare(`
    UPDATE dead_letter
    SET resolved_at = ?
    WHERE id = ? AND resolved_at IS NULL
  `).run(Date.now(), id);

  if (result.changes > 0) {
    logger.debug("Resolved dead letter entry", { id });
    return true;
  }

  return false;
}

export function removeDeadLetter(id: number): boolean {
  const db = getDatabase();
  const result = db.prepare(`
    DELETE FROM dead_letter WHERE id = ?
  `).run(id);

  if (result.changes > 0) {
    logger.debug("Removed dead letter entry", { id });
    return true;
  }

  return false;
}

export function cleanupDeadLetters(retention: string): number {
  const retentionMs = parseDuration(retention);
  const cutoff = Date.now() - retentionMs;

  const db = getDatabase();
  const result = db.prepare(`
    DELETE FROM dead_letter
    WHERE created_at < ?
  `).run(cutoff);

  if (result.changes > 0) {
    logger.debug("Cleaned up expired dead letter entries", {
      deleted: result.changes,
      retention,
    });
  }

  return result.changes;
}

export function getEntriesDueForRetry(): DeadLetterEntry[] {
  const db = getDatabase();
  const now = Date.now();

  const rows = db.prepare(`
    SELECT id, message_id, account_name, folder, uid, error, attempts, created_at, resolved_at,
           retry_status, next_retry_at, last_retry_at
    FROM dead_letter
    WHERE resolved_at IS NULL
      AND retry_status = 'pending'
      AND (next_retry_at IS NULL OR next_retry_at <= ?)
    ORDER BY COALESCE(next_retry_at, created_at) ASC
  `).all(now) as Array<{
    id: number;
    message_id: string;
    account_name: string;
    folder: string;
    uid: number;
    error: string;
    attempts: number;
    created_at: number;
    resolved_at: number | null;
    retry_status: RetryStatus | null;
    next_retry_at: number | null;
    last_retry_at: number | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    messageId: row.message_id,
    accountName: row.account_name,
    folder: row.folder,
    uid: row.uid,
    error: row.error,
    attempts: row.attempts,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    retryStatus: row.retry_status ?? "pending",
    nextRetryAt: row.next_retry_at,
    lastRetryAt: row.last_retry_at,
  }));
}

export function updateRetryStatus(id: number, status: RetryStatus, nextRetryAt?: number): boolean {
  const db = getDatabase();
  const now = Date.now();

  const result = db.prepare(`
    UPDATE dead_letter
    SET retry_status = ?, next_retry_at = ?, last_retry_at = ?
    WHERE id = ? AND resolved_at IS NULL
  `).run(status, nextRetryAt ?? null, now, id);

  if (result.changes > 0) {
    logger.debug("Updated dead letter retry status", { id, status, nextRetryAt });
    return true;
  }

  return false;
}

export function markRetryExhausted(id: number): boolean {
  return updateRetryStatus(id, "exhausted");
}

export function scheduleRetry(id: number, nextRetryAt: number): boolean {
  return updateRetryStatus(id, "pending", nextRetryAt);
}

export function markRetrying(id: number): boolean {
  return updateRetryStatus(id, "retrying");
}

export function markRetrySuccess(id: number): boolean {
  const db = getDatabase();
  const now = Date.now();

  const result = db.prepare(`
    UPDATE dead_letter
    SET retry_status = 'success', resolved_at = ?, last_retry_at = ?
    WHERE id = ? AND resolved_at IS NULL
  `).run(now, now, id);

  if (result.changes > 0) {
    logger.info("Dead letter retry succeeded", { id });
    return true;
  }

  return false;
}

export function skipDeadLetter(id: number): boolean {
  const db = getDatabase();
  const now = Date.now();

  const result = db.prepare(`
    UPDATE dead_letter
    SET retry_status = 'skipped', resolved_at = ?, last_retry_at = ?
    WHERE id = ? AND resolved_at IS NULL
  `).run(now, now, id);

  if (result.changes > 0) {
    logger.info("Dead letter skipped", { id });
    return true;
  }

  return false;
}
