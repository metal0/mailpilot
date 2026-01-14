# Prompt System

Mailpilot automatically constructs prompts for the LLM by combining your custom prompt with injected context. Understanding this system helps you write more effective classification rules.

## How Prompts Are Built

When classifying an email, Mailpilot builds the final prompt in this order:

```
┌─────────────────────────────────────────┐
│  1. Your Base Prompt                    │  ← From config (prompt_override or default_prompt)
│     (classification rules, guidelines)  │
├─────────────────────────────────────────┤
│  2. Folder Information (injected)       │  ← Based on folder mode
│     - Predefined: allowed folders list  │
│     - Auto-create: existing folders     │
├─────────────────────────────────────────┤
│  3. Response Format (injected)          │  ← JSON schema always appended
│     (required JSON structure)           │
├─────────────────────────────────────────┤
│  4. Email Content (injected)            │  ← The email being classified
│     - From, Subject, Date               │
│     - Attachments (if any)              │
│     - Body                              │
│     - Thread context (if enabled)       │
└─────────────────────────────────────────┘
```

## What Gets Injected

### 1. Folder Information

**Predefined mode** - Mailpilot injects the allowed folder list:

```markdown
## Allowed Folders
You may ONLY move emails to these folders:
- Work
- Personal
- Finance/Bills
- Archive
```

**Auto-create mode** - Mailpilot injects existing folders to prevent duplicates:

```markdown
## Existing Folders
These folders already exist. Prefer using existing folders over creating new ones:
- Clients/Acme Corp
- Projects/Website
- Personal
```

### 2. Response Format

The JSON schema is always appended to ensure consistent responses:

```markdown
## Response Format
You MUST respond with valid JSON in this exact format:
```json
{
  "actions": [
    {
      "type": "move" | "spam" | "flag" | "read" | "delete" | "noop",
      "folder": "string (required for move action)",
      "flags": ["string array (required for flag action, e.g., 'Flagged', 'Seen')"],
      "reason": "string (optional, for audit log)"
    }
  ]
}
```

### 3. Email Content

The email metadata and body are appended:

```markdown
## Email to Classify

**From:** sender@example.com
**Subject:** Quarterly Report Q3
**Date:** 2024-01-15T10:30:00Z
**Attachments:** report.pdf, data.xlsx

**Body:**
[Email body content here...]
```

### 4. Thread Context (Optional)

If thread context is enabled and available:

```markdown
## Thread Context (Previous Messages)
[Previous emails in the conversation...]
```

## Writing Effective Prompts

Since Mailpilot injects folder lists and schemas automatically, your prompt should focus on:

### DO include:
- Classification logic and rules
- Priority guidelines (what's urgent vs normal)
- Sender-based rules (domains, specific addresses)
- Content keywords to look for
- When to use each action type

### DON'T include:
- Folder lists (injected automatically based on mode)
- JSON response format (always injected)
- Email content placeholders (injected per email)

### Example: Good Prompt

```markdown
You are an email classifier for a software developer.

## Classification Rules

### Priority
- GitHub notifications mentioning me → flag as important
- CI/CD failures → flag as important
- Everything from @mycompany.com executives → flag as important

### Categorization
- GitHub PR reviews → move to GitHub folder
- Newsletter/digest emails → move to Newsletters
- Recruiter emails → mark as spam
- Meeting invites → leave in inbox (noop)

### Actions
- Use "spam" for unsolicited marketing and phishing
- Use "flag" with "\Flagged" for urgent items
- Use "read" for automated notifications I don't need to see
- Use "noop" when unsure - I'll sort manually
```

Notice: No folder list, no JSON schema, no email placeholders. Mailpilot adds those.

## Token Limits

Email bodies are truncated to stay within configured limits:

```yaml
llm_providers:
  - name: openai
    max_body_tokens: 4000      # Email body limit
    max_thread_tokens: 2000    # Thread context limit
```

Truncation preserves the beginning of content and adds `[Content truncated...]` marker.

## Debugging Prompts

Enable debug logging to see the full constructed prompt:

```yaml
logging:
  level: debug
```

This logs the complete prompt sent to the LLM (excluding email body for privacy unless `include_subjects: true`).
