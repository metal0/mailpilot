import { getDatabase } from "./database.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("account-settings");

export interface AccountSettings {
  accountName: string;
  paused: boolean;
  updatedAt: number;
}

export function savePausedStatus(accountName: string, paused: boolean): void {
  const db = getDatabase();
  const now = Date.now();

  db.prepare(`
    INSERT INTO account_settings (account_name, paused, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(account_name) DO UPDATE SET
      paused = excluded.paused,
      updated_at = excluded.updated_at
  `).run(accountName, paused ? 1 : 0, now);

  logger.debug("Saved paused status", { accountName, paused });
}

export function getPausedStatus(accountName: string): boolean {
  const db = getDatabase();

  const row = db.prepare(`
    SELECT paused FROM account_settings WHERE account_name = ?
  `).get(accountName) as { paused: number } | undefined;

  return row?.paused === 1;
}

export function getAllPausedAccounts(): string[] {
  const db = getDatabase();

  const rows = db.prepare(`
    SELECT account_name FROM account_settings WHERE paused = 1
  `).all() as Array<{ account_name: string }>;

  return rows.map((row) => row.account_name);
}

export function deleteAccountSettings(accountName: string): void {
  const db = getDatabase();
  db.prepare(`DELETE FROM account_settings WHERE account_name = ?`).run(accountName);
  logger.debug("Deleted account settings", { accountName });
}
