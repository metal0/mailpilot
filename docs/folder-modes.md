# Folder Modes

Mailpilot supports two folder targeting modes for the `move` action.

## Predefined Mode (Default)

The LLM picks from a list of allowed folders you define.

```yaml
folders:
  watch: [INBOX]
  mode: predefined
  allowed:
    - Work
    - Personal
    - Finance/Bills
    - Finance/Receipts
    - Newsletters
    - Archive
```

**Behavior:**
- LLM can only move emails to folders in the `allowed` list
- If LLM suggests a folder not in the list, the action is skipped
- Folders are created automatically if they don't exist

### Auto-Discovery (No Allowed Folders)

If you use predefined mode but don't specify any `allowed` folders, Mailpilot will automatically discover existing folders via IMAP and use them as the allowed list:

```yaml
folders:
  watch: [INBOX]
  mode: predefined
  # No 'allowed' list - existing folders are auto-discovered
```

This is useful when:
- You want to restrict to existing folders without manually listing them
- You're migrating from another system with an existing folder structure
- You want predefined behavior without the maintenance overhead

**Best for:**
- Structured folder hierarchies
- Compliance requirements
- Preventing folder sprawl

**Prompt example:**
```markdown
Move emails to one of these folders:
- Work: work-related emails
- Personal: personal correspondence
- Finance/Bills: bills and statements
- Finance/Receipts: purchase receipts
- Newsletters: subscriptions and digests
- Archive: everything else worth keeping
```

## Auto-Create Mode

The LLM decides folder names freely, creating them as needed.

```yaml
folders:
  watch: [INBOX]
  mode: auto_create
```

**Behavior:**
- LLM can specify any folder name
- Non-existent folders are created automatically
- Existing folders are auto-discovered and injected into prompt
- Supports hierarchical names: `Clients/Acme Corp`

**Best for:**
- Flexible organization
- Business email with many clients/projects
- Power users who want AI-driven structure

**Prompt example:**
```markdown
Organize emails by creating appropriate folders:
- Use "Clients/{ClientName}" for client communication
- Use "Projects/{ProjectName}" for project-related emails
- Use "Accounting/Invoices" and "Accounting/Receipts" for financial
- Be consistent - reuse existing folders when appropriate
```

## Folder Naming Conventions

When using auto-create mode, guide the LLM with naming conventions:

```yaml
prompt_override: |
  Folder naming rules:
  - Use Title Case: "Client Name" not "client name"
  - Use "/" for hierarchy: "Work/Projects" not "Work - Projects"
  - Be specific: "Clients/Acme Corp" not just "Acme"
  - Be consistent: don't create both "Invoices" and "Bills"
```

## Watching Multiple Folders

Monitor folders beyond INBOX:

```yaml
folders:
  watch:
    - INBOX
    - Sent
    - Drafts
    - "[Gmail]/Important"
```

Note: Gmail special folders use the `[Gmail]/` prefix.

## Combining with Webhooks

Track folder creation with webhooks:

```yaml
webhooks:
  - url: https://hooks.example.com/mailpilot
    events: [action_taken]
```

The `action_taken` webhook includes the folder name for move actions.
