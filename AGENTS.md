# AI/LLM Integration in Mailpilot

This document describes how Mailpilot uses AI/LLM services for email classification and processing.

> **Note:** User-facing documentation is available on the [GitHub Wiki](https://github.com/metal0/mailpilot/wiki). This file contains technical details for developers.

## Overview

Mailpilot uses LLM APIs to classify incoming emails and determine actions (move to folder, flag, mark as read, delete, etc.). The system is provider-agnostic and supports any OpenAI-compatible API.

## Supported Providers

| Provider | API Format | Models | Vision |
|----------|------------|--------|--------|
| OpenAI | OpenAI Chat Completions | gpt-4o, gpt-4o-mini, gpt-4-turbo | gpt-4o, gpt-4-turbo |
| Anthropic | OpenAI-compatible | claude-3-opus, claude-3-sonnet, claude-3-haiku | claude-3-* models |
| Azure OpenAI | OpenAI-compatible | gpt-4, gpt-35-turbo | gpt-4 vision |
| Ollama | OpenAI-compatible | llama3, mistral, mixtral | llava, bakllava |
| Any OpenAI-compatible | OpenAI Chat Completions | varies | depends on model |

Set `supports_vision: true` in provider config to enable multimodal image support.

## Configuration

```yaml
llm_providers:
  - name: openai
    api_url: https://api.openai.com/v1/chat/completions
    api_key: ${OPENAI_API_KEY}
    default_model: gpt-4o-mini
    max_body_tokens: 4000      # Max tokens for email body
    max_thread_tokens: 2000    # Max tokens for thread context
    rate_limit_rpm: 60         # Requests per minute limit
    supports_vision: false     # Enable for image support (gpt-4o, claude-3)

accounts:
  - name: personal
    llm:
      provider: openai         # Reference to provider above
      model: gpt-4o-mini       # Override default model
```

## Classification Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  IMAP Fetch     │────▶│  Build Prompt    │────▶│  LLM Request    │
│  (email data)   │     │  (context + rules)│    │  (classification)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Execute Action │◀────│  Parse Response  │◀────│  JSON Response  │
│  (move/flag/etc)│     │  (validate JSON) │     │  (actions array)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Prompt Structure

The prompt sent to the LLM contains:

1. **Base Prompt**: User-defined classification rules
2. **Folder Context**: Available folders (predefined or existing)
3. **Response Schema**: Required JSON format
4. **Email Data**: From, Subject, Date, Body, Attachment names
5. **Extracted Attachments** (optional): Text content from PDF, DOCX, etc.

Example prompt structure:
```
[Your classification rules from config]

---

## Allowed Folders
You may ONLY move emails to these folders:
- Work
- Personal
- Finance
- Archive

## Response Format
You MUST respond with valid JSON in this exact format:
{
  "actions": [
    { "type": "move", "folder": "FolderName" },
    { "type": "flag", "flags": ["Important"] }
  ],
  "reasoning": "Brief explanation"
}

---

## Email to Classify

**From:** sender@example.com
**Subject:** Invoice #12345
**Date:** 2026-01-14T12:00:00Z
**Attachments:** invoice.pdf

**Body:**
Please find attached the invoice for January...
```

## Response Schema

The LLM must return valid JSON with an `actions` array:

```typescript
interface LlmResponse {
  actions: LlmAction[];
  reasoning?: string;
}

type LlmAction =
  | { type: "move"; folder: string }
  | { type: "spam" }
  | { type: "flag"; flags: string[] }
  | { type: "read" }
  | { type: "delete" }
  | { type: "noop"; reason?: string };
```

## Rate Limiting

Mailpilot enforces rate limits per provider:

- **RPM Limit**: Configurable requests per minute
- **429 Handling**: Respects `Retry-After` header
- **Exponential Backoff**: 3 retries with increasing delays
- **Queue**: Requests wait if limit reached

## Token Management

Email content is truncated to fit within token limits:

- **Body**: Truncated to `max_body_tokens` (default: 4000 chars ≈ 1000 tokens)
- **Thread Context**: Truncated to `max_thread_tokens` (default: 2000 chars)
- **Truncation**: Breaks at word boundaries, adds `[Content truncated...]`

## Error Handling

| Error | Handling |
|-------|----------|
| API timeout | Retry up to 3 times with backoff |
| Rate limit (429) | Wait for Retry-After, then retry |
| Invalid JSON response | Attempt recovery parsing, fallback to noop |
| Network error | Retry with exponential backoff |
| Provider unavailable | Log error, skip email processing |

## PGP Encrypted Emails

Emails detected as PGP encrypted are automatically skipped:

- Checks `Content-Type: multipart/encrypted`
- Checks for `application/pgp-encrypted` attachments
- Checks for `-----BEGIN PGP MESSAGE-----` markers

Skipped emails are logged with action `noop` and reason "PGP encrypted email".

## Attachment Extraction

When attachment extraction is enabled, Mailpilot extracts text from supported file types and includes it in the LLM prompt.

### How Attachments Appear in Prompts

```
## Attachments

### invoice.pdf (application/pdf, 245.0 KB)
[Extracted text, truncated]
```
Invoice #12345
Date: January 1, 2026
Amount Due: $500.00
...
```

### scan.png (image/png, 128.0 KB)
[Image attachment - will be included for vision-capable models]
```

### Extraction Process

1. **Filter**: Only allowed content types are processed
2. **Size Check**: Attachments over `max_size_mb` are skipped
3. **Extract**: Text extracted via Apache Tika
4. **Truncate**: Long content truncated to `max_extracted_chars`
5. **Format**: Added to prompt with filename and metadata

### Multimodal (Vision) Support

For vision-capable LLMs (GPT-4o, Claude 3), images can be sent directly:

```yaml
llm_providers:
  - name: openai-vision
    api_url: https://api.openai.com/v1/chat/completions
    api_key: ${OPENAI_API_KEY}
    default_model: gpt-4o
    supports_vision: true       # Required for image support

attachments:
  enabled: true
  extract_images: true          # Include base64 images
```

When both flags are enabled:
- Images are base64-encoded and sent as content parts
- OCR text from Tika is also included
- LLM can "see" the images alongside text

### Writing Prompts for Attachments

When attachments are enabled, consider adding rules like:

```yaml
default_prompt: |
  Classification rules:
  - Invoices (from PDF content or email body) → Finance
  - Contracts with signatures → Legal
  - Screenshots of errors → Development/Support
  - Scanned documents → Review folder
```

The LLM will see extracted text in the prompt and can classify based on attachment content.

## Dry Run Mode

Set `dry_run: true` in config to:
- Process emails through classification
- Log what actions would be taken
- Skip actual action execution

Useful for testing classification rules before enabling.

## Audit Logging

All classifications are logged to SQLite:

```sql
SELECT * FROM audit_log ORDER BY created_at DESC;
```

Fields: message_id, account_name, actions (JSON), provider, model, subject (if enabled), timestamp.

## Writing Effective Prompts

### Auto-Injected Content (DO NOT include in prompts)

The system **automatically appends** to every prompt:
1. **Folder lists** - Based on `folders.mode` (predefined/auto_create)
2. **Allowed actions** - If `allowed_actions` is configured
3. **JSON response schema** - Always included
4. **Email content** - From, Subject, Date, Body, Attachments

**Users only write classification rules.** The system handles everything else.

### Do
- Be specific about folder purposes
- Include examples of email types
- Define clear rules for edge cases
- Use consistent terminology
- Focus on classification logic only

### Don't
- Include folder lists (injected automatically)
- Include JSON schema (injected automatically)
- Include "Available actions" lists (injected automatically)
- Include response format instructions (injected automatically)
- Over-complicate with too many rules
- Use ambiguous language

### Example Base Prompt

```yaml
default_prompt: |
  You are an email classifier for a software developer.

  Classification rules:
  - Receipts, invoices, order confirmations → Finance
  - GitHub notifications, CI/CD alerts → Development
  - Meeting invites, calendar updates → Calendar
  - Newsletters, marketing emails → flag as "Newsletter", no move
  - Spam, phishing attempts → Spam
  - Personal correspondence from known contacts → Personal
  - Everything else → leave in INBOX (noop)

  When uncertain, prefer noop over incorrect classification.
```

## Provider Health Tracking

Mailpilot tracks the health status of each LLM provider:

### Health States

| State | Indicator | Meaning |
|-------|-----------|---------|
| Healthy | Green | Provider responding successfully |
| Unhealthy | Red | Provider failing (consecutive failures) |
| Stale | Gray | No recent health check (>10 min) |

### Health Check Behavior

- Health is checked on the Debug page via "Test LLM Health" button
- Successful requests reset consecutive failure count
- Failed requests increment consecutive failure count
- Provider is marked unhealthy after consecutive failures
- Health status broadcasts to all dashboard clients via WebSocket

### Dashboard Integration

The sidebar on the Overview page shows:
- Provider name
- Health indicator dot (color-coded)
- Tooltip with status text

The Debug page shows detailed provider info:
- Last health check timestamp
- Last successful request timestamp
- Consecutive failure count
- Request/error totals

## Monitoring

### Dashboard Stats
- Emails processed count
- Actions taken breakdown
- Provider request counts
- Provider health status
- Rate limit status

### Health Check
```bash
curl http://localhost:8080/health
```

### Provider Stats
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/status
```

## Testing LLM Features

**All LLM-related changes MUST include proper testing. NO SHORTCUTS.**

### Quality Standards

**Never take shortcuts with implementation or testing.** Every feature must be:
- Fully implemented (no partial functionality, no placeholders)
- Thoroughly tested (unit tests + E2E tests)
- Verified working in production-like conditions

### Unit Tests
Located in `tests/unit/`. Key test files:
- `tests/unit/llm/providers.test.ts` - Provider registration, health tracking
- `tests/unit/llm/parser.test.ts` - Response parsing, JSON validation
- `tests/unit/llm/rate-limiter.test.ts` - Rate limiting logic

When modifying LLM code:
1. Add/update unit tests for new behavior
2. Test edge cases (invalid JSON, timeouts, rate limits)
3. Mock external API calls, don't hit real LLM APIs in tests

### End-to-End Testing (EXHAUSTIVE)

E2E testing must cover most normal use and edge case situations. For LLM integration changes:

**Required Test Coverage:**
1. Start app with `pnpm dev`
2. Use Debug page to test LLM health checks
3. Process test emails and verify classification in Activity tab
4. Check provider stats update correctly on Overview page

**Exhaustive Testing Checklist:**
- [ ] Provider healthy → requests succeed, stats update
- [ ] Provider unhealthy → proper error display, no crashes
- [ ] Provider timeout → graceful handling, retry behavior
- [ ] Rate limit hit → proper queueing, no dropped requests
- [ ] Invalid API key → clear error message to user
- [ ] Network disconnection → reconnection handling
- [ ] Empty response → handled without crash
- [ ] Malformed JSON → parse recovery or meaningful error
- [ ] Very long emails → truncation works correctly
- [ ] Emails with attachments → extraction and classification
- [ ] Multiple providers → switching, health tracking
- [ ] Dashboard updates → real-time WebSocket sync

**Do NOT consider testing complete until:**
- All checklist items verified
- No console errors during testing
- UI behaves correctly in all states
- Error messages are user-friendly

### Testing Classification Changes
When modifying prompt building or response parsing:
1. Use Rule Testing Sandbox (when implemented) or manual testing
2. Test with various email types (receipts, newsletters, spam)
3. Verify actions execute correctly (or log correctly in dry run mode)
4. Check audit log records correct data
5. Test edge cases: empty body, very long body, special characters, unicode

### Documentation
Update these docs when LLM behavior changes:
- `AGENTS.md` - This file, for technical details
- GitHub Wiki - User-facing LLM provider setup guides
- `docs/dashboard.md` - If API endpoints change

### Documentation Accuracy (CRITICAL)

**All documentation must be verified against actual code:**

1. **Prompt structure** - Check `src/llm/prompt.ts` for what's auto-injected
2. **Response schema** - Check `src/llm/parser.ts` for expected format
3. **Config fields** - Check `src/config/schema.ts` for exact names:
   - `folders.watch` (not `watch_folders`)
   - `backlog.mode` (not `process_existing`)
   - `polling_interval` (not `check_interval`)
4. **API endpoints** - Check `src/server/dashboard.ts`:
   - `/api/dead-letter` (singular)
   - `/api/logs` supports `accountName` filter
5. **Model names** - Keep current with provider offerings

**Key clarification for prompt docs:**
- Users write classification rules ONLY
- System auto-injects: folders, actions, JSON schema, email content
- Do NOT document that users need to include JSON format or action lists

---

## Troubleshooting

### LLM Returns Invalid JSON
- Check if response is being truncated (increase `max_tokens` on provider)
- Verify prompt isn't too long
- Check provider logs for errors

### Rate Limiting Issues
- Reduce `rate_limit_rpm` in config
- Add delays between account processing
- Use cheaper/faster model for high-volume accounts

### Classification Accuracy
- Review audit log for patterns
- Refine prompt with specific examples
- Consider using more capable model
