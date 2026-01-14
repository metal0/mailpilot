/**
 * Seed script to insert dummy test data for dashboard testing
 * Run with: npx tsx scripts/seed-test-data.ts
 */

import Database from "better-sqlite3";
import { resolve } from "path";

const dbPath = resolve(process.cwd(), "tmp/mailpilot.db");
console.log(`Opening database at: ${dbPath}`);

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const now = Date.now();
const hour = 60 * 60 * 1000;
const day = 24 * hour;

const accounts = ["personal-gmail"];

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

const errors = [
  "IMAP connection timeout after 30000ms",
  "LLM rate limit exceeded, retry after 60s",
  "Failed to parse LLM response: unexpected token",
  "Message not found in folder INBOX",
  "Authentication failed: invalid credentials",
  "Network error: ECONNRESET",
  "Attachment extraction failed: file too large",
];

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

// Clear existing test data
console.log("Clearing existing data...");
db.prepare("DELETE FROM audit_log").run();
db.prepare("DELETE FROM dead_letter").run();
db.prepare("DELETE FROM processed_messages").run();

// Insert audit log entries
console.log("Inserting audit log entries...");
const auditStmt = db.prepare(`
  INSERT INTO audit_log (message_id, account_name, actions, llm_provider, llm_model, subject, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const auditCount = 150;
for (let i = 0; i < auditCount; i++) {
  const account = randomElement(accounts);
  const subject = randomElement(subjects);
  const action = randomElement(actionTypes);
  const llm = randomElement(llmProviders);
  const createdAt = now - randomInt(0, 7 * day);

  const actions = [action];
  if (Math.random() > 0.7) {
    actions.push({ type: "read", reason: "Marked as read after processing" });
  }

  auditStmt.run(
    generateMessageId(),
    account,
    JSON.stringify(actions),
    llm.provider,
    llm.model,
    subject,
    createdAt
  );
}
console.log(`  Inserted ${auditCount} audit log entries`);

// Insert dead letter entries
console.log("Inserting dead letter entries...");
const deadLetterStmt = db.prepare(`
  INSERT INTO dead_letter (message_id, account_name, folder, uid, error, attempts, created_at, resolved_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const deadLetterCount = 5;
for (let i = 0; i < deadLetterCount; i++) {
  const account = randomElement(accounts);
  const error = randomElement(errors);
  const createdAt = now - randomInt(0, 3 * day);
  const attempts = randomInt(1, 5);

  deadLetterStmt.run(
    generateMessageId(),
    account,
    "INBOX",
    randomInt(1000, 9999),
    error,
    attempts,
    createdAt,
    null // unresolved
  );
}
console.log(`  Inserted ${deadLetterCount} dead letter entries`);

// Insert some resolved dead letters too
const resolvedCount = 3;
for (let i = 0; i < resolvedCount; i++) {
  const account = randomElement(accounts);
  const error = randomElement(errors);
  const createdAt = now - randomInt(3 * day, 7 * day);
  const resolvedAt = createdAt + randomInt(hour, day);

  deadLetterStmt.run(
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
console.log(`  Inserted ${resolvedCount} resolved dead letter entries`);

// Insert processed messages
console.log("Inserting processed message records...");
const processedStmt = db.prepare(`
  INSERT OR IGNORE INTO processed_messages (message_id, account_name, processed_at)
  VALUES (?, ?, ?)
`);

const processedCount = 200;
for (let i = 0; i < processedCount; i++) {
  const account = randomElement(accounts);
  const processedAt = now - randomInt(0, day);

  processedStmt.run(generateMessageId(), account, processedAt);
}
console.log(`  Inserted ${processedCount} processed message records`);

db.close();

console.log("\nDone! Test data has been inserted.");
console.log("Refresh the dashboard to see the new data.");
