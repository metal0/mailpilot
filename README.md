# Mailpilot

AI-powered email processing daemon that uses LLM classification to automatically organize, flag, and manage your inbox.

## Features

- **IMAP Support**: Connects to any IMAP server with IDLE push notifications (falls back to polling)
- **LLM Classification**: Uses OpenAI-compatible APIs to classify emails and determine actions
- **Multiple Actions**: Move to folders, mark as spam, flag, mark read, delete, or take no action
- **Multi-Account**: Process multiple email accounts with per-account configuration
- **Rate Limiting**: Per-provider rate limiting with automatic 429 retry handling
- **Webhooks**: Configurable webhooks for events like errors, actions taken, connection status
- **Health/Status API**: HTTP endpoints for monitoring and health checks
- **Web Dashboard**: Modern Svelte SPA with real-time WebSocket updates
- **API Key Auth**: Programmatic access to dashboard APIs with granular permissions
- **Email Preview**: Preview email content before manual processing
- **Dead Letter Queue**: Track and retry failed email processing
- **Audit Logging**: SQLite-based audit trail with search and filtering
- **Processing Headers**: Optional X-Mailpilot-* headers injected into processed emails
- **Docker Ready**: Multi-arch Docker images for easy deployment

## Requirements

- Node.js >= 22.0.0
- pnpm (recommended) or npm
- An OpenAI-compatible LLM API (OpenAI, Anthropic, local Ollama, etc.)

## Installation

```bash
# Clone the repository
git clone https://github.com/youruser/mailpilot.git
cd mailpilot

# Install dependencies
pnpm install

# Build
pnpm build

# Copy and configure
cp config.example.yaml config.yaml
# Edit config.yaml with your settings

# Run
pnpm start
```

## Configuration

Mailpilot uses YAML configuration with environment variable substitution. Create a `config.yaml` based on the example:

```yaml
polling_interval: 30s
concurrency_limit: 5
dry_run: false

backlog:
  mode: new_only  # all | recent_count | recent_days | new_only

state:
  database_path: ./data/mailpilot.db
  processed_ttl: 24h
  audit_retention: 30d

llm_providers:
  - name: openai
    api_url: https://api.openai.com/v1/chat/completions
    api_key: ${LLM_OPENAI_API_KEY}
    default_model: gpt-4o-mini
    max_body_tokens: 4000
    rate_limit_rpm: 60

default_prompt: |
  You are an email classifier. Analyze the email and decide what action to take.

logging:
  level: info

server:
  port: 8080
  auth_token: ${STATUS_API_TOKEN}

accounts:
  - name: personal
    imap:
      host: imap.gmail.com
      port: 993
      auth: basic
      username: ${GMAIL_USER}
      password: ${GMAIL_APP_PASSWORD}
    llm:
      provider: openai
      model: gpt-4o-mini
    folders:
      watch: [INBOX]
      mode: predefined
      allowed: [Work, Personal, Finance, Archive]
```

### Environment Variables

Use `${VAR_NAME}` syntax in config.yaml to reference environment variables:

```bash
export LLM_OPENAI_API_KEY="sk-..."
export STATUS_API_TOKEN="your-secret-token"
export GMAIL_USER="you@gmail.com"
export GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"
```

### Provider Configuration

Mailpilot supports any OpenAI-compatible API:

```yaml
llm_providers:
  # OpenAI
  - name: openai
    api_url: https://api.openai.com/v1/chat/completions
    api_key: ${OPENAI_API_KEY}
    default_model: gpt-4o-mini

  # Anthropic Claude
  - name: anthropic
    api_url: https://api.anthropic.com/v1/messages
    api_key: ${ANTHROPIC_API_KEY}
    default_model: claude-3-haiku-20240307

  # Local Ollama
  - name: ollama
    api_url: http://localhost:11434/v1/chat/completions
    default_model: llama3.2
```

### Account Configuration

Each account specifies IMAP connection details and optional LLM/webhook overrides:

```yaml
accounts:
  - name: work-email
    imap:
      host: outlook.office365.com
      port: 993
      tls: auto           # auto | tls | starttls | insecure
      auth: oauth2        # basic | oauth2
      username: user@company.com
      oauth_client_id: ${OAUTH_CLIENT_ID}
      oauth_client_secret: ${OAUTH_CLIENT_SECRET}
      oauth_refresh_token: ${OAUTH_REFRESH_TOKEN}

    llm:
      provider: openai    # override default provider
      model: gpt-4o       # override provider's default model

    folders:
      watch: [INBOX, "Focused Inbox"]
      mode: auto_create   # predefined | auto_create

    prompt_override: |
      Custom classification rules for work email...

    webhooks:
      - url: https://hooks.slack.com/services/xxx
        events: [error, connection_lost]
```

### Backlog Modes

Configure how Mailpilot handles existing emails on startup:

- `new_only`: Only process new emails (default)
- `all`: Process all unread emails
- `recent_count`: Process last N unread emails (`count: 100`)
- `recent_days`: Process emails from last N days (`age: 7d`)

### Actions

The LLM can return these actions:

| Action | Description | Required Fields |
|--------|-------------|-----------------|
| `move` | Move to folder | `folder` |
| `spam` | Move to spam folder | - |
| `flag` | Add IMAP flags | `flags` (array) |
| `read` | Mark as read | - |
| `delete` | Delete message | - |
| `noop` | Take no action | - |

### Prompt System

Mailpilot automatically constructs prompts by combining:

1. **Your base prompt** - Classification rules from `default_prompt` or `prompt_override`
2. **Folder information** - Injected based on folder mode:
   - Predefined: list of allowed folders
   - Auto-create: existing folders (to prevent duplicates)
3. **Response schema** - JSON format the LLM must follow
4. **Email content** - From, Subject, Date, Body, Attachments

Your prompt should focus on classification logic - don't include folder lists or JSON schemas as these are injected automatically.

See [docs/prompt-system.md](docs/prompt-system.md) for detailed documentation on writing effective prompts.

## API Endpoints

### Health Check

```
GET /health
```

Returns detailed health status:

```json
{
  "status": "ok",
  "uptime": 3600,
  "accounts": {
    "connected": 2,
    "total": 3
  },
  "deadLetterCount": 0,
  "lastProcessed": "2026-01-14T12:00:00.000Z"
}
```

Used for Docker health checks and monitoring systems.

### Status

```
GET /status
Authorization: Bearer <auth_token>
```

Returns detailed status including:
- Uptime
- Per-account connection status
- Emails processed / actions taken counts
- LLM provider statistics
- Error counts

### Web Dashboard

The optional web dashboard provides a modern Svelte-based interface with real-time WebSocket updates. Enable it in your config:

```yaml
dashboard:
  enabled: true
  api_keys:
    - name: monitoring
      key: mp_your_secret_key_here_min_16_chars
      permissions: [read:stats, read:activity]
```

Then visit `http://localhost:8080/dashboard`. On first visit, you'll create an admin account.

**Features**:
- Real-time updates via WebSocket (no page refresh needed)
- Dark/light mode toggle
- Email preview before manual processing
- Search and filter audit logs
- Dead letter queue management
- Account pause/resume/reconnect controls

**API Key Permissions**:
- `read:stats` - Access stats endpoint
- `read:activity` - Access activity/audit endpoints
- `read:logs` - Access system logs
- `read:export` - Export audit data
- `write:accounts` - Pause/resume/reconnect accounts
- `read:*` / `write:*` / `*` - Wildcards

**Security Note**: The first visitor can create the admin account. Only enable on trusted networks.

See [docs/dashboard.md](docs/dashboard.md) for detailed documentation.

## Docker Deployment

### Using Docker Compose

```yaml
services:
  mailpilot:
    image: ghcr.io/youruser/mailpilot:latest
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - ./config.yaml:/app/config.yaml:ro
      - ./data:/app/data
    environment:
      - LLM_OPENAI_API_KEY=${LLM_OPENAI_API_KEY}
      - STATUS_API_TOKEN=${STATUS_API_TOKEN}
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

```bash
docker compose up -d
```

### Building Locally

```bash
docker build -t mailpilot .
docker run -v $(pwd)/config.yaml:/app/config.yaml:ro mailpilot
```

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode with hot reload
pnpm dev

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Lint
pnpm lint

# Type check
pnpm typecheck

# Build
pnpm build
```

## Project Structure

```
src/
  index.ts           # Entry point
  config/
    schema.ts        # Zod schemas for configuration
    loader.ts        # YAML loading with env var resolution
  accounts/
    manager.ts       # Account lifecycle management
    context.ts       # Per-account context
  imap/
    client.ts        # IMAP connection wrapper
    idle.ts          # IDLE/polling loop
    oauth.ts         # OAuth2 token handling
    detection.ts     # Provider detection (Gmail, Outlook, etc.)
  llm/
    client.ts        # LLM API client
    parser.ts        # Response parsing and validation
    prompt.ts        # Prompt building
    providers.ts     # Provider registry
    rate-limiter.ts  # Per-provider rate limiting
  processor/
    email.ts         # Email fetching and parsing
    worker.ts        # Processing pipeline
    headers.ts       # Processing header injection
    antivirus.ts     # ClamAV integration
  actions/
    executor.ts      # Action dispatch
    move.ts          # Move action
    flag.ts          # Flag action
    read.ts          # Mark read action
    folder.ts        # Folder creation
  storage/
    database.ts      # SQLite initialization
    processed.ts     # Processed message tracking
    audit.ts         # Audit log with search
    dashboard.ts     # Dashboard user/session storage
    dead-letter.ts   # Dead letter queue
  server/
    index.ts         # HTTP server with WebSocket
    health.ts        # Health endpoint
    status.ts        # Status endpoint
    dashboard.ts     # Dashboard API routes
    auth.ts          # Session + API key authentication
    websocket.ts     # WebSocket server
  webhooks/
    dispatcher.ts    # Webhook delivery
  utils/
    logger.ts        # Structured logging with broadcast
    duration.ts      # Duration parsing (30s, 5m, 24h)
    retry.ts         # Retry with backoff
    shutdown.ts      # Graceful shutdown

dashboard/           # Svelte SPA (built separately)
  src/
    lib/
      components/    # UI components
      stores/        # Svelte stores (WebSocket, theme, data)
      api.ts         # API client
    routes/          # Page components
```

## Troubleshooting

### Gmail App Passwords

For Gmail accounts with 2FA, create an app-specific password:
1. Go to Google Account > Security > 2-Step Verification > App passwords
2. Generate a new password for "Mail" on "Other (Custom name)"
3. Use this password in your config

### IDLE Not Supported

Some providers don't support IMAP IDLE. Mailpilot automatically falls back to polling using the configured `polling_interval`.

### Rate Limiting

If you hit LLM API rate limits, configure `rate_limit_rpm` in your provider settings. Mailpilot will queue requests and process them within the limit.

### Dry Run Mode

Set `dry_run: true` in config to log actions without executing them. Useful for testing classification rules.

## License

AGPL-3.0
