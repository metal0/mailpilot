# Database Schema

Mailpilot uses SQLite for persistent storage. The database path is configurable via `state.database_path` (default: `./data/mailpilot.db`).

## Tables

### processed_messages

Tracks which emails have been processed to prevent duplicate processing.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key (auto-increment) |
| `message_id` | TEXT | Email Message-ID header |
| `account_name` | TEXT | Account that processed this email |
| `processed_at` | INTEGER | Unix timestamp of processing |

**Indexes:**
- `idx_processed_messages_account` - For filtering by account
- `idx_processed_messages_processed_at` - For TTL cleanup

**Unique Constraint:** `(message_id, account_name)`

**Retention:** Configurable via `state.processed_ttl` (default: 24h)

---

### audit_log

Records all actions taken on emails for auditing and debugging.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key (auto-increment) |
| `message_id` | TEXT | Email Message-ID header |
| `account_name` | TEXT | Account that processed this email |
| `actions` | TEXT | JSON array of actions taken |
| `llm_provider` | TEXT | LLM provider used (nullable) |
| `llm_model` | TEXT | LLM model used (nullable) |
| `subject` | TEXT | Email subject (nullable, opt-in) |
| `confidence` | REAL | LLM confidence score 0.0-1.0 (nullable) |
| `reasoning` | TEXT | LLM reasoning for the classification (nullable) |
| `created_at` | INTEGER | Unix timestamp of processing |

**Indexes:**
- `idx_audit_log_account` - For filtering by account
- `idx_audit_log_created_at` - For TTL cleanup and sorting

**Retention:** Configurable via `state.audit_retention` (default: 30d)

**Privacy Note:** The `subject` column is only populated if `state.audit_subjects` is set to `true`.

---

### dashboard_users

Stores dashboard admin accounts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key (auto-increment) |
| `username` | TEXT | Unique username |
| `password_hash` | TEXT | bcrypt hashed password |
| `created_at` | INTEGER | Unix timestamp of account creation |

**Unique Constraint:** `username`

---

### dashboard_sessions

Manages authenticated dashboard sessions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Session ID (primary key) |
| `user_id` | INTEGER | Foreign key to `dashboard_users.id` |
| `created_at` | INTEGER | Unix timestamp of session creation |
| `expires_at` | INTEGER | Unix timestamp when session expires |

**Foreign Key:** `user_id` references `dashboard_users(id)` with `ON DELETE CASCADE`

**Indexes:**
- `idx_dashboard_sessions_expires` - For cleanup of expired sessions
- `idx_dashboard_sessions_user` - For looking up user sessions

**Session TTL:** Configurable via `dashboard.session_ttl` (default: 24h)

---

### dead_letter

Stores emails that failed processing for later retry.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key (auto-increment) |
| `message_id` | TEXT | Email Message-ID header |
| `account_name` | TEXT | Account the email belongs to |
| `folder` | TEXT | IMAP folder containing the email |
| `uid` | INTEGER | IMAP UID of the email |
| `error` | TEXT | Error message from failed processing |
| `attempts` | INTEGER | Number of processing attempts (default: 1) |
| `created_at` | INTEGER | Unix timestamp when first failed |
| `resolved_at` | INTEGER | Unix timestamp when resolved (nullable) |
| `retry_status` | TEXT | Status: pending, retrying, exhausted, success, skipped |
| `next_retry_at` | INTEGER | Unix timestamp for next retry attempt (nullable) |
| `last_retry_at` | INTEGER | Unix timestamp of last retry attempt (nullable) |

**Indexes:**
- `idx_dead_letter_account` - For filtering by account
- `idx_dead_letter_resolved` - For finding unresolved entries
- `idx_dead_letter_retry` - For finding entries due for retry

**Retry Status Values:**
- `pending` - Waiting for next retry attempt
- `retrying` - Currently being retried
- `exhausted` - Max retry attempts reached
- `success` - Successfully processed after retry
- `skipped` - User manually skipped retries

**Resolution:** Entries are marked resolved (not deleted) when successfully retried, exhausted, or manually skipped.

---

## Database Configuration

```yaml
state:
  database_path: ./data/mailpilot.db  # SQLite database location
  processed_ttl: 24h                  # How long to remember processed message IDs
  audit_retention: 30d                # How long to keep audit log entries
  audit_subjects: false               # Store email subjects (privacy tradeoff)
```

## Pragmas

The database is initialized with:
- `journal_mode = WAL` - Write-Ahead Logging for better concurrent performance
- `foreign_keys = ON` - Enforce foreign key constraints
