# Configuration Reference

Mailpilot uses YAML configuration with environment variable substitution.

## File Location

By default, Mailpilot looks for `config.yaml` in the current directory. Override with:

```bash
CONFIG_PATH=/path/to/config.yaml pnpm start
```

## Environment Variables

Use `${VAR_NAME}` syntax to reference environment variables:

```yaml
api_key: ${OPENAI_API_KEY}  # Resolved from environment
password: ${EMAIL_PASSWORD}  # Resolved from environment
```

If a referenced variable is not set, Mailpilot fails at startup with a clear error.

## Global Settings

```yaml
# Polling interval when IDLE not supported (default: 30s)
polling_interval: 30s

# Emails processed in parallel per account (default: 5)
concurrency_limit: 5

# Log actions without executing (default: false)
dry_run: false
```

## Backlog Configuration

How to handle existing emails on startup:

```yaml
backlog:
  # Mode: all | recent_count | recent_days | new_only (default)
  mode: new_only

  # For recent_count mode: process last N emails
  count: 100

  # For recent_days mode: process emails newer than duration
  age: 7d
```

| Mode | Description |
|------|-------------|
| `new_only` | Only process new arrivals (default) |
| `all` | Process all unread emails |
| `recent_count` | Process last N unread emails |
| `recent_days` | Process emails from last N days |

## State Configuration

```yaml
state:
  # SQLite database location (default: ./data/mailpilot.db)
  database_path: ./data/mailpilot.db

  # How long to remember processed messages (default: 24h)
  processed_ttl: 24h

  # How long to keep audit log (default: 30d)
  audit_retention: 30d

  # Store email subjects in audit (privacy tradeoff, default: false)
  audit_subjects: false
```

## Logging Configuration

```yaml
logging:
  # Log level: debug | info | warn | error (default: info)
  level: info

  # Optional file logging (in addition to stdout)
  file: ./logs/mailpilot.log

  # Log subjects at debug level (privacy tradeoff, default: false)
  include_subjects: false
```

## Server Configuration

```yaml
server:
  # HTTP port for health/status endpoints (default: 8080)
  port: 8080

  # Required for /status endpoint (optional but recommended)
  auth_token: ${STATUS_API_TOKEN}
```

## Antivirus Configuration

Optional ClamAV integration:

```yaml
antivirus:
  # Enable ClamAV scanning (default: false)
  enabled: false

  # ClamAV daemon host (default: localhost)
  host: localhost

  # ClamAV daemon port (default: 3310)
  port: 3310

  # Scan timeout per attachment (default: 30s)
  timeout: 30s

  # Action on virus: quarantine | delete | flag_only (default: quarantine)
  on_virus_detected: quarantine
```

## LLM Providers

Array of available LLM providers. Accounts select which one to use.

```yaml
llm_providers:
  - name: openai
    api_url: https://api.openai.com/v1/chat/completions
    api_key: ${OPENAI_API_KEY}
    default_model: gpt-4o-mini
    max_body_tokens: 4000      # Max tokens for email body
    max_thread_tokens: 2000    # Max tokens for thread context
    rate_limit_rpm: 60         # Optional manual rate limit
```

See [LLM Providers Guide](./llm-providers.md) for detailed provider setup.

## Account Configuration

Each account has its own IMAP connection, LLM selection, and settings:

```yaml
accounts:
  - name: my-account           # Unique identifier

    imap:
      host: imap.example.com
      port: 993                # Default: 993
      tls: auto                # auto | tls | starttls | insecure
      auth: basic              # basic | oauth2
      username: user@example.com
      password: ${EMAIL_PASSWORD}

      # For OAuth2:
      # oauth_client_id: ${OAUTH_CLIENT_ID}
      # oauth_client_secret: ${OAUTH_CLIENT_SECRET}
      # oauth_refresh_token: ${OAUTH_REFRESH_TOKEN}

    llm:
      provider: openai         # References llm_providers[].name
      model: gpt-4o-mini       # Optional: override provider default

    folders:
      watch: [INBOX]           # Folders to monitor
      mode: predefined         # predefined | auto_create
      allowed:                 # For predefined mode
        - Work
        - Personal
        - Archive

    webhooks:                  # Optional per-account webhooks
      - url: https://hooks.example.com/mailpilot
        events: [error, action_taken]
        headers:
          Authorization: Bearer ${WEBHOOK_TOKEN}

    # Custom prompt (optional)
    prompt_override: |
      Custom classification rules...

    # Or load from file
    prompt_file: ./prompts/custom.md
```

## Duration Format

All duration fields use human-readable strings:

| Format | Example | Meaning |
|--------|---------|---------|
| `Nms` | `500ms` | 500 milliseconds |
| `Ns` | `30s` | 30 seconds |
| `Nm` | `5m` | 5 minutes |
| `Nh` | `24h` | 24 hours |
| `Nd` | `30d` | 30 days |
| `Nw` | `2w` | 2 weeks |
| `Ny` | `1y` | 1 year |

## Defaults Summary

| Field | Default |
|-------|---------|
| `polling_interval` | `30s` |
| `concurrency_limit` | `5` |
| `dry_run` | `false` |
| `backlog.mode` | `new_only` |
| `state.database_path` | `./data/mailpilot.db` |
| `state.processed_ttl` | `24h` |
| `state.audit_retention` | `30d` |
| `logging.level` | `info` |
| `server.port` | `8080` |
| `imap.port` | `993` |
| `imap.tls` | `auto` |
| `imap.auth` | `basic` |
| `folders.watch` | `["INBOX"]` |
| `folders.mode` | `predefined` |
