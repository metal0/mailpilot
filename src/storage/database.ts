import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("database");

let db: Database.Database | null = null;

export function initDatabase(dbPath: string): Database.Database {
  if (db) {
    return db;
  }

  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    logger.debug("Created database directory", { path: dir });
  }

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  createTables(db);

  logger.debug("Database initialized", { path: dbPath });

  return db;
}

function createTables(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS processed_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL,
      account_name TEXT NOT NULL,
      processed_at INTEGER NOT NULL,
      UNIQUE(message_id, account_name)
    );

    CREATE INDEX IF NOT EXISTS idx_processed_messages_account
    ON processed_messages(account_name);

    CREATE INDEX IF NOT EXISTS idx_processed_messages_processed_at
    ON processed_messages(processed_at);

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL,
      account_name TEXT NOT NULL,
      actions TEXT NOT NULL,
      llm_provider TEXT,
      llm_model TEXT,
      subject TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_log_account
    ON audit_log(account_name);

    CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
    ON audit_log(created_at);

    CREATE TABLE IF NOT EXISTS dashboard_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dashboard_sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES dashboard_users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_dashboard_sessions_expires
    ON dashboard_sessions(expires_at);

    CREATE INDEX IF NOT EXISTS idx_dashboard_sessions_user
    ON dashboard_sessions(user_id);

    CREATE TABLE IF NOT EXISTS dead_letter (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL,
      account_name TEXT NOT NULL,
      folder TEXT NOT NULL,
      uid INTEGER NOT NULL,
      error TEXT NOT NULL,
      attempts INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      resolved_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_dead_letter_account
    ON dead_letter(account_name);

    CREATE INDEX IF NOT EXISTS idx_dead_letter_resolved
    ON dead_letter(resolved_at);
  `);

  // Migration: Add retry columns to existing dead_letter table
  migrateDeadLetterRetry(database);

  logger.debug("Database tables created");
}

function migrateDeadLetterRetry(database: Database.Database): void {
  // Check if retry_status column exists
  const tableInfo = database.prepare("PRAGMA table_info(dead_letter)").all() as Array<{ name: string }>;
  const hasRetryStatus = tableInfo.some((col) => col.name === "retry_status");

  if (!hasRetryStatus) {
    logger.info("Migrating dead_letter table to add retry columns");
    database.exec(`
      ALTER TABLE dead_letter ADD COLUMN retry_status TEXT DEFAULT 'pending';
      ALTER TABLE dead_letter ADD COLUMN next_retry_at INTEGER;
      ALTER TABLE dead_letter ADD COLUMN last_retry_at INTEGER;
    `);

    // Create index for retry queries
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_dead_letter_retry
      ON dead_letter(retry_status, next_retry_at);
    `);

    logger.info("Dead letter retry migration completed");
  }
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase first.");
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.debug("Database closed");
  }
}
