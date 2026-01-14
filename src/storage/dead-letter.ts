import { getDatabase } from "./database.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("dead-letter");

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
    SELECT id, message_id, account_name, folder, uid, error, attempts, created_at, resolved_at
    FROM dead_letter
    WHERE resolved_at IS NULL
  `;
  const params: string[] = [];

  if (accountName) {
    query += ` AND account_name = ?`;
    params.push(accountName);
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
    SELECT id, message_id, account_name, folder, uid, error, attempts, created_at, resolved_at
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
    logger.info("Resolved dead letter entry", { id });
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
    logger.info("Removed dead letter entry", { id });
    return true;
  }

  return false;
}

export function cleanupResolvedDeadLetters(maxAgeDays = 30): number {
  const db = getDatabase();
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  const result = db.prepare(`
    DELETE FROM dead_letter
    WHERE resolved_at IS NOT NULL AND resolved_at < ?
  `).run(cutoff);

  if (result.changes > 0) {
    logger.info("Cleaned up old resolved dead letter entries", {
      deleted: result.changes,
      maxAgeDays,
    });
  }

  return result.changes;
}
