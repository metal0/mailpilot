#!/usr/bin/env npx tsx
/**
 * Seed script for E2E and integration testing
 *
 * Usage:
 *   pnpm seed:test                      # Default: seed all data types with default counts
 *   pnpm seed:test --audit 50           # Seed 50 audit log entries only
 *   pnpm seed:test --dead-letter 10     # Seed 10 dead letter entries only
 *   pnpm seed:test --processed 100      # Seed 100 processed message records only
 *   pnpm seed:test --user               # Seed test user (testadmin/testpassword123)
 *   pnpm seed:test --all                # Seed all data types (same as default)
 *   pnpm seed:test --clear              # Clear all data without seeding new data
 *   pnpm seed:test --db ./custom.db     # Use custom database path
 *
 * Options:
 *   --db <path>         Database path (default: ./data/test-mailpilot.db)
 *   --audit <n>         Number of audit log entries to seed (default: 150)
 *   --dead-letter <n>   Number of dead letter entries to seed (default: 8)
 *   --processed <n>     Number of processed message records to seed (default: 200)
 *   --user              Seed test user for E2E authentication tests
 *   --all               Seed all data types (default behavior)
 *   --clear             Clear existing data without seeding
 *   --no-clear          Don't clear existing data before seeding (append mode)
 *   --help              Show this help message
 */

import Database from "better-sqlite3";
import { resolve } from "path";
import { mkdirSync, existsSync } from "fs";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

export const TEST_USER = {
  username: "testadmin",
  password: "testpassword123",
};

interface SeedOptions {
  dbPath: string;
  auditCount: number;
  deadLetterCount: number;
  processedCount: number;
  seedAudit: boolean;
  seedDeadLetter: boolean;
  seedProcessed: boolean;
  seedUser: boolean;
  clearOnly: boolean;
  clearFirst: boolean;
}

function parseArgs(): SeedOptions {
  const args = process.argv.slice(2);

  const options: SeedOptions = {
    dbPath: resolve(process.cwd(), "data/test-mailpilot.db"),
    auditCount: 150,
    deadLetterCount: 8,
    processedCount: 200,
    seedAudit: false,
    seedDeadLetter: false,
    seedProcessed: false,
    seedUser: false,
    clearOnly: false,
    clearFirst: true,
  };

  let hasSpecificSeed = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;

      case "--db":
        if (!nextArg) {
          console.error("Error: --db requires a path argument");
          process.exit(1);
        }
        options.dbPath = resolve(process.cwd(), nextArg);
        i++;
        break;

      case "--audit":
        hasSpecificSeed = true;
        options.seedAudit = true;
        if (nextArg && !nextArg.startsWith("-")) {
          options.auditCount = parseInt(nextArg, 10);
          if (isNaN(options.auditCount) || options.auditCount < 0) {
            console.error("Error: --audit requires a positive number");
            process.exit(1);
          }
          i++;
        }
        break;

      case "--dead-letter":
        hasSpecificSeed = true;
        options.seedDeadLetter = true;
        if (nextArg && !nextArg.startsWith("-")) {
          options.deadLetterCount = parseInt(nextArg, 10);
          if (isNaN(options.deadLetterCount) || options.deadLetterCount < 0) {
            console.error("Error: --dead-letter requires a positive number");
            process.exit(1);
          }
          i++;
        }
        break;

      case "--processed":
        hasSpecificSeed = true;
        options.seedProcessed = true;
        if (nextArg && !nextArg.startsWith("-")) {
          options.processedCount = parseInt(nextArg, 10);
          if (isNaN(options.processedCount) || options.processedCount < 0) {
            console.error("Error: --processed requires a positive number");
            process.exit(1);
          }
          i++;
        }
        break;

      case "--user":
        hasSpecificSeed = true;
        options.seedUser = true;
        break;

      case "--all":
        options.seedAudit = true;
        options.seedDeadLetter = true;
        options.seedProcessed = true;
        options.seedUser = true;
        hasSpecificSeed = true;
        break;

      case "--clear":
        options.clearOnly = true;
        break;

      case "--no-clear":
        options.clearFirst = false;
        break;

      default:
        if (arg.startsWith("-")) {
          console.error(`Unknown option: ${arg}`);
          console.error("Use --help for usage information");
          process.exit(1);
        }
    }
  }

  // Default: seed all if no specific seed options provided
  if (!hasSpecificSeed && !options.clearOnly) {
    options.seedAudit = true;
    options.seedDeadLetter = true;
    options.seedProcessed = true;
    options.seedUser = true;
  }

  return options;
}

function printHelp(): void {
  console.log(`
Seed Test Data - Populate database with test fixtures for E2E testing

Usage:
  pnpm seed:test [options]
  npx tsx scripts/seed-test-data.ts [options]

Examples:
  pnpm seed:test                      # Seed all data types with defaults
  pnpm seed:test --audit 50           # Seed 50 audit log entries only
  pnpm seed:test --dead-letter 10     # Seed 10 dead letter entries
  pnpm seed:test --processed 100      # Seed 100 processed messages
  pnpm seed:test --user               # Seed test user only
  pnpm seed:test --audit 20 --dead-letter 5  # Seed multiple types
  pnpm seed:test --clear              # Clear all data without seeding
  pnpm seed:test --no-clear --audit 10  # Append 10 audit entries

Options:
  --db <path>         Database path (default: ./data/test-mailpilot.db)
  --audit <n>         Seed <n> audit log entries (default: 150)
  --dead-letter <n>   Seed <n> dead letter entries (default: 8)
  --processed <n>     Seed <n> processed message records (default: 200)
  --user              Seed test user (testadmin/testpassword123)
  --all               Seed all data types (default behavior)
  --clear             Clear existing data without seeding new data
  --no-clear          Append mode - don't clear existing data before seeding
  --help, -h          Show this help message

Data Types:
  audit         Activity log entries showing email processing history
  dead-letter   Failed email processing records for retry/investigation
  processed     Message ID tracking to prevent duplicate processing
  user          Test user for E2E authentication tests
`);
}

const subjects = [
  "Your weekly newsletter digest",
  "Meeting reminder: Q4 Planning",
  "Invoice #2024-1234 from Acme Corp",
  "Welcome to our service!",
  "Your order has shipped",
  "Important: Security update required",
  "RE: Project proposal feedback",
  "New comment on your post",
  "Subscription renewal notice",
  "Flight confirmation: NYC to LAX",
  "Password reset request",
  "Your monthly statement is ready",
  "Team standup notes - Jan 14",
  "Invitation: Product launch event",
  "Quick question about the API",
  "FW: Client feedback summary",
  "Reminder: Dentist appointment tomorrow",
  "Your package has been delivered",
  "New follower notification",
  "Weekly expense report",
];

const actionTypes = [
  { type: "move", folder: "Newsletters", reason: "Newsletter content detected" },
  { type: "move", folder: "Work", reason: "Work-related email from colleague" },
  { type: "move", folder: "Finance", reason: "Financial document or invoice" },
  { type: "move", folder: "Personal", reason: "Personal correspondence" },
  { type: "flag", reason: "Important email requiring attention" },
  { type: "read", reason: "Informational email, no action needed" },
  { type: "noop", reason: "Unable to categorize, leaving in inbox" },
  { type: "spam", reason: "Spam or promotional content" },
];

const llmProviders = [
  { provider: "openai", model: "gpt-4o-mini" },
  { provider: "openai", model: "gpt-4o" },
  { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
];

const reasonings = [
  "Email contains newsletter subscription content with marketing links",
  "Sender is from corporate domain, subject mentions project deadlines",
  "Financial document detected with invoice reference number",
  "Personal conversation with friend about weekend plans",
  "Urgent security notice requiring immediate attention",
  "Automated system notification, informational only",
  "Unable to determine clear category from content",
  "Promotional content with unsubscribe links",
];

const errors = [
  "IMAP connection timeout after 30000ms",
  "LLM rate limit exceeded, retry after 60s",
  "Failed to parse LLM response: unexpected token",
  "Message not found in folder INBOX",
  "Authentication failed: invalid credentials",
  "Network error: ECONNRESET",
  "Attachment extraction failed: file too large",
];

const accounts = ["personal-gmail", "work-outlook", "test-account"];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateMessageId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 20; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return `<${id}@mail.example.com>`;
}

function ensureDbDirectory(dbPath: string): void {
  const dir = resolve(dbPath, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL,
      account_name TEXT NOT NULL,
      actions TEXT NOT NULL,
      llm_provider TEXT,
      llm_model TEXT,
      subject TEXT,
      confidence REAL,
      reasoning TEXT,
      created_at INTEGER NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS processed_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL UNIQUE,
      account_name TEXT NOT NULL,
      processed_at INTEGER NOT NULL
    );

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

    CREATE INDEX IF NOT EXISTS idx_audit_account ON audit_log(account_name);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_dead_letter_account ON dead_letter(account_name);
    CREATE INDEX IF NOT EXISTS idx_processed_message_id ON processed_messages(message_id);
    CREATE INDEX IF NOT EXISTS idx_dashboard_sessions_expires ON dashboard_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_dashboard_sessions_user ON dashboard_sessions(user_id);
  `);
}

function seedAuditLog(db: Database.Database, count: number): void {
  console.log(`Inserting ${count} audit log entries...`);

  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  const stmt = db.prepare(`
    INSERT INTO audit_log (message_id, account_name, actions, llm_provider, llm_model, subject, confidence, reasoning, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction(() => {
    for (let i = 0; i < count; i++) {
      const account = randomElement(accounts);
      const subject = randomElement(subjects);
      const action = randomElement(actionTypes);
      const llm = randomElement(llmProviders);
      const createdAt = now - randomInt(0, 7 * day);

      const actions = [action];
      if (Math.random() > 0.7) {
        actions.push({ type: "read", reason: "Marked as read after processing" });
      }

      // Generate confidence: ~60% high (0.8-1.0), ~25% medium (0.5-0.79), ~15% low (0.3-0.49)
      let confidence: number;
      const roll = Math.random();
      if (roll < 0.6) {
        confidence = 0.8 + Math.random() * 0.2; // High: 0.8-1.0
      } else if (roll < 0.85) {
        confidence = 0.5 + Math.random() * 0.3; // Medium: 0.5-0.79
      } else {
        confidence = 0.3 + Math.random() * 0.2; // Low: 0.3-0.49
      }
      confidence = Math.round(confidence * 100) / 100; // Round to 2 decimal places

      const reasoning = randomElement(reasonings);

      stmt.run(
        generateMessageId(),
        account,
        JSON.stringify(actions),
        llm.provider,
        llm.model,
        subject,
        confidence,
        reasoning,
        createdAt
      );
    }
  });

  insertMany();
  console.log(`  Inserted ${count} audit log entries`);
}

function seedDeadLetter(db: Database.Database, count: number): void {
  console.log(`Inserting ${count} dead letter entries...`);

  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  const stmt = db.prepare(`
    INSERT INTO dead_letter (message_id, account_name, folder, uid, error, attempts, created_at, resolved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const unresolvedCount = Math.ceil(count * 0.6);
  const resolvedCount = count - unresolvedCount;

  const insertMany = db.transaction(() => {
    // Unresolved entries
    for (let i = 0; i < unresolvedCount; i++) {
      const account = randomElement(accounts);
      const error = randomElement(errors);
      const createdAt = now - randomInt(0, 3 * day);
      const attempts = randomInt(1, 5);

      stmt.run(
        generateMessageId(),
        account,
        "INBOX",
        randomInt(1000, 9999),
        error,
        attempts,
        createdAt,
        null
      );
    }

    // Resolved entries
    for (let i = 0; i < resolvedCount; i++) {
      const account = randomElement(accounts);
      const error = randomElement(errors);
      const createdAt = now - randomInt(3 * day, 7 * day);
      const resolvedAt = createdAt + randomInt(hour, day);

      stmt.run(
        generateMessageId(),
        account,
        "INBOX",
        randomInt(1000, 9999),
        error,
        randomInt(1, 3),
        createdAt,
        resolvedAt
      );
    }
  });

  insertMany();
  console.log(`  Inserted ${unresolvedCount} unresolved + ${resolvedCount} resolved dead letter entries`);
}

function seedProcessedMessages(db: Database.Database, count: number): void {
  console.log(`Inserting ${count} processed message records...`);

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO processed_messages (message_id, account_name, processed_at)
    VALUES (?, ?, ?)
  `);

  const insertMany = db.transaction(() => {
    for (let i = 0; i < count; i++) {
      const account = randomElement(accounts);
      const processedAt = now - randomInt(0, 7 * day);
      stmt.run(generateMessageId(), account, processedAt);
    }
  });

  insertMany();
  console.log(`  Inserted ${count} processed message records`);
}

async function seedUser(db: Database.Database): Promise<void> {
  console.log(`Seeding test user: ${TEST_USER.username}...`);

  const existingUser = db.prepare(`SELECT id FROM dashboard_users WHERE username = ?`).get(TEST_USER.username);

  if (existingUser) {
    console.log("  Test user already exists, skipping");
    return;
  }

  const passwordHash = await bcrypt.hash(TEST_USER.password, BCRYPT_ROUNDS);
  const now = Date.now();

  const stmt = db.prepare(`
    INSERT INTO dashboard_users (username, password_hash, created_at)
    VALUES (?, ?, ?)
  `);

  stmt.run(TEST_USER.username, passwordHash, now);
  console.log(`  Created test user: ${TEST_USER.username}`);
}

function clearData(db: Database.Database, options: SeedOptions): void {
  if (options.seedAudit || options.clearOnly) {
    db.prepare("DELETE FROM audit_log").run();
    console.log("  Cleared audit_log table");
  }
  if (options.seedDeadLetter || options.clearOnly) {
    db.prepare("DELETE FROM dead_letter").run();
    console.log("  Cleared dead_letter table");
  }
  if (options.seedProcessed || options.clearOnly) {
    db.prepare("DELETE FROM processed_messages").run();
    console.log("  Cleared processed_messages table");
  }
  if (options.seedUser || options.clearOnly) {
    db.prepare("DELETE FROM dashboard_sessions").run();
    db.prepare("DELETE FROM dashboard_users").run();
    console.log("  Cleared dashboard_users and dashboard_sessions tables");
  }
}

async function main(): Promise<void> {
  const options = parseArgs();

  console.log(`\nSeed Test Data`);
  console.log(`==============`);
  console.log(`Database: ${options.dbPath}`);

  ensureDbDirectory(options.dbPath);

  const db = new Database(options.dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  try {
    initializeSchema(db);

    if (options.clearFirst || options.clearOnly) {
      console.log("\nClearing existing data...");
      clearData(db, options);
    }

    if (options.clearOnly) {
      console.log("\nData cleared. Exiting (--clear mode).");
      return;
    }

    console.log("\nSeeding data...");

    if (options.seedUser) {
      await seedUser(db);
    }

    if (options.seedAudit) {
      seedAuditLog(db, options.auditCount);
    }

    if (options.seedDeadLetter) {
      seedDeadLetter(db, options.deadLetterCount);
    }

    if (options.seedProcessed) {
      seedProcessedMessages(db, options.processedCount);
    }

    console.log("\nDone! Test data has been seeded.");
    console.log("Refresh the dashboard to see the new data.");
  } finally {
    db.close();
  }
}

main().catch(console.error);
