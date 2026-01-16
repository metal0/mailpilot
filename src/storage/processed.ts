import { getDatabase } from "./database.js";
import { parseDuration } from "../utils/duration.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("processed");

export function isMessageProcessed(
  messageId: string,
  accountName: string
): boolean {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT 1 FROM processed_messages
    WHERE message_id = ? AND account_name = ?
  `);
  const result = stmt.get(messageId, accountName);
  return result !== undefined;
}

export function markMessageProcessed(
  messageId: string,
  accountName: string
): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO processed_messages (message_id, account_name, processed_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(messageId, accountName, Date.now());
  logger.debug("Message marked as processed", { messageId, accountName });
}

export function cleanupProcessedMessages(ttl: string): number {
  const ttlMs = parseDuration(ttl);
  const cutoff = Date.now() - ttlMs;

  const db = getDatabase();
  const stmt = db.prepare(`
    DELETE FROM processed_messages
    WHERE processed_at < ?
  `);
  const result = stmt.run(cutoff);

  if (result.changes > 0) {
    logger.debug("Cleaned up expired processed messages", {
      deleted: result.changes,
      ttl,
    });
  }

  return result.changes;
}

export function getProcessedCount(accountName?: string): number {
  const db = getDatabase();

  if (accountName) {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM processed_messages
      WHERE account_name = ?
    `);
    const result = stmt.get(accountName) as { count: number };
    return result.count;
  }

  const stmt = db.prepare(`SELECT COUNT(*) as count FROM processed_messages`);
  const result = stmt.get() as { count: number };
  return result.count;
}
