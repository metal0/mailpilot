# Web Dashboard

Mailpilot includes a modern Svelte-based web dashboard with real-time WebSocket updates for monitoring email processing activity.

## Enabling the Dashboard

The dashboard is **enabled by default**. To disable it, set in your `config.yaml`:

```yaml
dashboard:
  enabled: false
```

## First-Time Setup

When you first access the dashboard:

1. Navigate to `http://localhost:8080/`
2. You'll be redirected to `/setup`
3. Create your admin account (username + password)
4. You'll be logged in automatically

**Security Warning**: The first visitor to the dashboard can create the admin account. Only enable the dashboard on trusted networks, or create your account immediately after enabling.

## Configuration Options

```yaml
dashboard:
  enabled: true       # Enable/disable the dashboard (default: true)
  session_ttl: 24h    # How long login sessions last (default: 24h)
  api_keys:           # API keys for programmatic access
    - name: monitoring
      key: mp_your_secret_key_here  # Minimum 16 characters
      permissions:
        - read:stats
        - read:activity
```

## Dashboard Features

### Overview Page

The main overview page displays:

- **System Stats**: Uptime, version, dry run status
- **Totals**: Emails processed, actions taken, errors, dead letter count
- **Account Status Table**: Connection status, IDLE support, last scan, per-account stats
- **Sidebar Widgets**:
  - **LLM Providers**: Health status indicators for each provider (green=healthy, red=unhealthy, gray=unknown)
  - **Action Breakdown**: Count of each action type taken
  - **Processing Queue**: Currently active processing

### Account Controls

Each account has a dropdown menu with:

- **Pause/Resume**: Temporarily stop processing for an account
- **Reconnect**: Force reconnection to IMAP server
- **Process Now**: Manually trigger email processing

### Bulk Account Operations

Select multiple accounts using checkboxes and perform bulk actions:

- Pause all selected accounts
- Resume all selected accounts
- Reconnect all selected accounts
- Process all selected accounts

### Visual Configuration Editor

Edit all settings through the UI without manually editing YAML:

- Navigate to Settings page
- Edit configuration with helpful tooltips
- Validate changes before applying
- **Unsaved Changes Indicator**: Shows how many settings have been modified with a visual badge next to the save button. The save button is disabled until changes are made.
- **Live Config Reload**: Apply changes without restarting Mailpilot

### Raw YAML Editor

For advanced users who prefer direct YAML editing:

1. Navigate to Settings page
2. Click "Edit YAML" button next to the config file path
3. Edit the raw YAML directly in the browser
4. Save to apply changes (with optional config reload)

**Warning**: The raw YAML editor bypasses validation. Invalid YAML or incorrect configuration values may prevent Mailpilot from starting properly. Use with caution.

### Real-Time Updates

The dashboard uses WebSocket connections for instant updates:

- No manual refresh needed
- Activity feed updates as emails are processed
- Account status changes reflected immediately
- Log entries stream in real-time

### Dark/Light Mode

Toggle between dark and light themes using the button in the header. Your preference is saved in localStorage.

### Language Settings

The dashboard supports internationalization (i18n). To change the language:

1. Click on your username in the header
2. Select "User Settings"
3. Choose your preferred language from the dropdown
4. Click "Save"

Your language preference is saved in localStorage and persists across sessions. Currently, English is the only available language, but the infrastructure supports additional languages.

### Activity Log

The Activity tab shows processed emails with:

- Timestamp
- Account name
- Subject (if `audit_subjects: true` in config)
- Actions taken (move, flag, read, delete, etc.)

**Features**:

- **Search**: Filter by subject, message ID, or account name
- **Account Filter**: Show activity for a specific account
- **Action Filter**: Filter by action type
- **Date Range**: Filter by time period
- **Pagination**: Navigate through historical entries
- **Email Preview**: Click to preview email content before manual processing

### Log Viewer

Real-time system logs with:

- **Log Level Filter**: debug, info, warn, error
- **Account Filter**: Show logs for specific account
- **Search**: Search through log messages
- **Auto-scroll**: Automatically scroll to latest entries

### Debug Page

Detailed system information for troubleshooting:

- **Processing Statistics**: Emails processed, actions taken, error counts
- **IMAP Server View**: Accounts grouped by IMAP server for easier debugging
- **Provider Health**: Detailed LLM provider status with last check time
- **LLM Health Test**: Test provider connectivity on demand
- **System Info**: Database path, memory usage, uptime

### Dead Letter Queue

Emails that fail processing after multiple attempts:

- View failed emails with error messages
- Retry processing
- Dismiss entries

## API Key Authentication

For programmatic access to dashboard APIs (monitoring tools, scripts, etc.), configure API keys:

```yaml
dashboard:
  api_keys:
    - name: prometheus
      key: mp_prometheus_scraper_key
      permissions: [read:stats]
    - name: automation
      key: mp_automation_full_access
      permissions: [read:*, write:accounts]
```

### Available Permissions

| Permission | Endpoints | Description |
|------------|-----------|-------------|
| `read:stats` | `/api/stats` | Access metrics and account status |
| `read:activity` | `/api/activity` | Access audit log |
| `read:logs` | `/api/logs` | Access system logs |
| `read:export` | `/api/export` | Export audit data as CSV/JSON |
| `read:config` | `/api/config` | Read configuration |
| `write:accounts` | `/api/accounts/*` | Pause/resume/reconnect/process |
| `write:config` | `/api/config` | Update configuration |
| `read:*` | All read endpoints | Wildcard for all read permissions |
| `write:*` | All write endpoints | Wildcard for all write permissions |
| `*` | All endpoints | Full access |

### Using API Keys

```bash
# Fetch stats with API key
curl -H "Authorization: Bearer mp_your_api_key" \
  http://localhost:8080/api/stats

# Pause an account
curl -X POST -H "Authorization: Bearer mp_your_api_key" \
  http://localhost:8080/api/accounts/personal/pause
```

## WebSocket Connection

For real-time updates, connect to the WebSocket endpoint:

```
ws://localhost:8080/ws
```

Authentication via:

- Session cookie (browser)
- `Authorization: Bearer <api_key>` header (programmatic)

Message types:

- `stats` - Updated statistics
- `activity` - New audit entries
- `logs` - New log entries
- `account_update` - Account status changes
- `toast` - Notifications

## Authentication

### Dashboard Auth vs API Auth

| Endpoint | Auth Type | Purpose |
|----------|-----------|---------|
| `/health` | None | Health check for load balancers |
| `/status` | Bearer token | API access for monitoring tools |
| `/` | Session or API key | Human access via browser |
| `/api/*` | Session or API key | API access |
| `/ws` | Session or API key | WebSocket connection |

### Session-Based Auth

The dashboard uses session-based authentication with:

- Passwords hashed with bcrypt (12 rounds)
- Secure, HttpOnly cookies
- CSRF token protection
- 24-hour session expiry (configurable)
- Sessions extend on activity
- Rate limiting: 5 failed attempts = 15-minute lockout

### Logging In

1. Go to `/login`
2. Enter your username and password
3. Session cookie is set automatically

### Logging Out

Click the "Logout" button in the dashboard header.

### Dry Run Mode

When `dry_run: true` is set in config:

- Authentication is bypassed (auto-logged in as "dev")
- A prominent banner indicates no actions are being taken
- Ideal for testing classification rules

## Security Considerations

### First-Visitor Risk

When the dashboard is enabled but no account exists:

- **Anyone** can visit `/setup` and create the admin account
- Warnings are logged on startup and every 4 hours
- Create your account immediately after enabling

### Recommendations

1. **Local/trusted networks only**: Don't expose the dashboard to the public internet without additional protection (reverse proxy with auth, VPN, etc.)

2. **Strong passwords**: Use a password manager and generate a strong password

3. **Secure API keys**: Generate long, random API keys (minimum 16 characters)

4. **Least privilege**: Only grant necessary permissions to API keys

5. **Check logs**: Monitor for the security warning:
   ```
   SECURITY WARNING: Dashboard enabled but no admin account exists
   ```

6. **Disable when not needed**: If you only need API access, keep the dashboard disabled and use `/status` with token auth instead

## API Endpoints

### Authentication Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/` | GET | Session | Main dashboard view |
| `/setup` | GET | None* | Registration page |
| `/setup` | POST | None* | Create admin account |
| `/login` | GET | None | Login page |
| `/login` | POST | None | Authenticate |
| `/logout` | POST | Session | End session |

*`/setup` only accessible when no admin account exists

### API Routes

| Route | Method | Auth | Permission | Purpose |
|-------|--------|------|------------|---------|
| `/api/stats` | GET | Session/Key | `read:stats` | Get metrics |
| `/api/activity` | GET | Session/Key | `read:activity` | Get audit log |
| `/api/logs` | GET | Session/Key | `read:logs` | Get system logs |
| `/api/export` | GET | Session/Key | `read:export` | Export audit data |
| `/api/config` | GET | Session/Key | `read:config` | Get configuration |
| `/api/config` | PUT | Session/Key | `write:config` | Update configuration |
| `/api/config/raw` | GET | Session/Key | `write:accounts` | Get raw YAML config |
| `/api/config/raw` | PUT | Session/Key | `write:accounts` | Save raw YAML config |
| `/api/dead-letter` | GET | Session/Key | `read:activity` | Get dead letters |
| `/api/dead-letter/:id/retry` | POST | Session/Key | `write:accounts` | Retry failed email |
| `/api/dead-letter/:id/dismiss` | POST | Session/Key | `write:accounts` | Dismiss entry |
| `/api/emails/:account/:folder/:uid` | GET | Session/Key | `read:activity` | Email preview |
| `/api/accounts/:name/pause` | POST | Session/Key | `write:accounts` | Pause account |
| `/api/accounts/:name/resume` | POST | Session/Key | `write:accounts` | Resume account |
| `/api/accounts/:name/reconnect` | POST | Session/Key | `write:accounts` | Reconnect IMAP |
| `/api/accounts/:name/process` | POST | Session/Key | `write:accounts` | Trigger processing |

### Query Parameters

**Activity endpoint** (`/api/activity`):

- `page` - Page number (default: 1)
- `pageSize` - Items per page (default: 20)
- `accountName` - Filter by account
- `actionType` - Filter by action type
- `search` - Search subject/messageId/account
- `startDate` - Filter by start timestamp (ms)
- `endDate` - Filter by end timestamp (ms)

**Logs endpoint** (`/api/logs`):

- `limit` - Max entries (default: 100)
- `level` - Minimum log level (debug/info/warn/error)
- `accountName` - Filter by account context
- `search` - Search log messages

## Troubleshooting

### "Setup already completed" Error

This means an admin account already exists. Go to `/login` instead.

### Session Expired

Sessions expire after 24 hours of inactivity. Simply log in again.

### Forgot Password

Currently, there's no password reset flow. You'll need to:

1. Stop Mailpilot
2. Delete the user and session data from SQLite
3. Restart Mailpilot
4. Create a new account at `/setup`

```bash
sqlite3 ./data/mailpilot.db "DELETE FROM dashboard_sessions; DELETE FROM dashboard_users;"
```

### WebSocket Not Connecting

1. Ensure you're authenticated (session cookie or API key)
2. Check browser console for errors
3. Verify the WebSocket URL matches your server (ws:// vs wss://)

### API Key Not Working

1. Verify the key is at least 16 characters
2. Check the key has required permissions
3. Ensure the `Authorization: Bearer` header is correct

### LLM Provider Shows Unhealthy

1. Check the Debug page for detailed provider status
2. Use "Test LLM Health" button to diagnose
3. Verify API key and URL are correct
4. Check network connectivity to provider
