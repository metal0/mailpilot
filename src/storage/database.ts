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

  logger.info("Database initialized", { path: dbPath });

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
  `);

  logger.debug("Database tables created");
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
    logger.info("Database closed");
  }
}
