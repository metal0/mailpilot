# Processing Headers

Mailpilot can optionally add custom headers to processed emails containing metadata about the classification and actions taken.

## Overview

When enabled, Mailpilot adds the following headers to processed emails:

```
X-Mailpilot-Processed: 2026-01-14T10:30:00.000Z
X-Mailpilot-Actions: move:Archive, flag:Important
X-Mailpilot-Model: gpt-4o-mini
X-Mailpilot-Analysis: <base64-encoded reasoning>
```

## Configuration

This feature is **opt-in** and disabled by default due to IMAP limitations (see Trade-offs below).

```yaml
add_processing_headers: true  # default: false
```

## Headers

| Header | Description |
|--------|-------------|
| `X-Mailpilot-Processed` | ISO timestamp when the email was processed |
| `X-Mailpilot-Actions` | Comma-separated list of actions taken (e.g., `move:Archive`, `flag:Important`, `noop:no action needed`) |
| `X-Mailpilot-Model` | LLM model used for classification |
| `X-Mailpilot-Analysis` | Base64-encoded LLM reasoning (if available) |

## Limitations

### Messages That Are Moved or Deleted

Headers are **not added** to messages that are:
- Moved to another folder (the `move` action)
- Deleted (the `delete` action)

This is because these actions change the message location/existence, making it impossible to reliably add headers afterward.

### PGP-Encrypted Messages

Headers are **not added** to PGP-encrypted messages. This prevents:
- Revealing metadata about encrypted content
- Modifying signed messages (which would break signatures)

## Trade-offs and Issues

**You should understand these trade-offs before enabling this feature.**

### 1. Message UID Changes

IMAP doesn't support modifying messages in-place. Mailpilot uses a workaround:

1. Fetch the original message
2. Add headers to the raw source
3. Append the modified message (gets a new UID)
4. Delete the original message

**Impact:**
- Email clients that track messages by UID may lose reference to the message
- Conversation threading may break in some clients
- Sync states in email clients may become inconsistent

### 2. Message Appears "Newer"

While the internal date is preserved, some email clients may:
- Re-sort the message based on append time
- Trigger "new mail" notifications
- Show the message as unread (flags are preserved, but behavior varies)

### 3. Additional Server Round-trips

Each message with headers added requires:
- FETCH (get source)
- FETCH (get flags)
- APPEND (new message)
- STORE (copy flags, if needed)
- DELETE (original)

This adds ~100-500ms per message depending on server latency.

### 4. Failure Risk

If the operation fails mid-way:

| Failure Point | Result |
|---------------|--------|
| After APPEND, before DELETE | **Duplicate message** - original + modified both exist |
| After DELETE, before APPEND | **Message lost** - this is prevented by doing APPEND first |

Mailpilot always APPENDs first, then DELETEs, minimizing data loss risk. However, duplicates may occur on failures.

### 5. Quota Impact

The operation briefly doubles message storage:
1. Original message exists
2. Modified message is appended
3. Original is deleted

On mailboxes near quota limits, the APPEND may fail with "quota exceeded" errors.

### 6. Server Compatibility

Not all IMAP servers handle this gracefully:
- Some servers may not preserve all metadata
- Custom flags may not be supported
- Some servers have APPEND size limits

## Recommendations

### When to Enable

- You need to track which emails were processed
- Your email client doesn't rely heavily on UID tracking
- You're okay with the performance overhead
- You primarily use `flag` or `noop` actions (not `move`)

### When to Keep Disabled

- You use email clients that sync by UID (some mobile clients)
- Performance is critical (high-volume mailboxes)
- You primarily use `move` actions (headers won't be added anyway)
- You have strict mailbox quota limits

## Alternative: Audit Log

If you need to track processed messages without modifying them, use the built-in audit log:

```yaml
state:
  audit_retention: 30d
  audit_subjects: true  # optional, stores subjects
```

Query the audit log at `./data/mailpilot.db` using SQLite:

```sql
SELECT * FROM audit_log
WHERE account_name = 'personal-gmail'
ORDER BY created_at DESC
LIMIT 100;
```

This provides the same information without modifying messages.
