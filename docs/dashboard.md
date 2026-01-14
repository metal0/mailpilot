# Web Dashboard

Mailpilot includes a modern Svelte-based web dashboard with real-time WebSocket updates for monitoring email processing activity.

## Enabling the Dashboard

The dashboard is **disabled by default** for security reasons. To enable it, add to your `config.yaml`:

```yaml
dashboard:
  enabled: true
```

## First-Time Setup

When you first access the dashboard:

1. Navigate to `http://localhost:8080/dashboard`
2. You'll be redirected to `/dashboard/setup`
3. Create your admin account (username + password)
4. You'll be logged in automatically

**Security Warning**: The first visitor to the dashboard can create the admin account. Only enable the dashboard on trusted networks, or create your account immediately after enabling.

## Configuration Options

```yaml
dashboard:
  enabled: false      # Enable/disable the dashboard (default: false)
  session_ttl: 24h    # How long login sessions last (default: 24h)
  api_keys:           # API keys for programmatic access
    - name: monitoring
      key: mp_your_secret_key_here  # Minimum 16 characters
      permissions:
        - read:stats
        - read:activity
```

## Dashboard Features

### Real-Time Updates

The dashboard uses WebSocket connections for instant updates:
- No manual refresh needed
- Activity feed updates as emails are processed
- Account status changes reflected immediately
- Log entries stream in real-time

### Dark/Light Mode

Toggle between dark and light themes using the button in the header. Your preference is saved in localStorage.

### Metrics Overview

- **Uptime**: How long Mailpilot has been running
- **Emails Processed**: Total count of emails analyzed
- **Actions Taken**: Total count of LLM-triggered actions
- **Errors**: Total error count across all accounts
- **Dead Letter Count**: Emails that failed processing

### Account Status Table

For each configured email account:

- Connection status (Connected/Disconnected)
- IDLE support indicator
- Last scan timestamp
- Per-account processed/action/error counts
- LLM provider and model in use
- Pause/Resume controls
- Reconnect button
- Manual process trigger

### Activity Log

The activity tab shows processed emails with:

- Timestamp
- Account name
- Subject (if `audit_subjects: true` in config)
- Actions taken (move, flag, read, delete, etc.)

**Features**:
- **Search**: Filter by subject, message ID, or account name
- **Account Filter**: Show activity for a specific account
- **Action Filter**: Filter by action type
- **Pagination**: Navigate through historical entries
- **Email Preview**: Click to preview email content before manual processing

### Log Viewer

Real-time system logs with:

- Log level filtering (debug, info, warn, error)
- Account name filtering
- Auto-scroll to latest entries

### Dead Letter Queue

Emails that fail processing after multiple attempts are added to the dead letter queue:

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
| `read:stats` | `/dashboard/api/stats` | Access metrics and account status |
| `read:activity` | `/dashboard/api/activity` | Access audit log |
| `read:logs` | `/dashboard/api/logs` | Access system logs |
| `read:export` | `/dashboard/api/export` | Export audit data as CSV/JSON |
| `write:accounts` | `/dashboard/api/accounts/*` | Pause/resume/reconnect/process |
| `read:*` | All read endpoints | Wildcard for all read permissions |
| `write:*` | All write endpoints | Wildcard for all write permissions |
| `*` | All endpoints | Full access |

### Using API Keys

```bash
# Fetch stats with API key
curl -H "Authorization: Bearer mp_your_api_key" \
  http://localhost:8080/dashboard/api/stats

# Pause an account
curl -X POST -H "Authorization: Bearer mp_your_api_key" \
  http://localhost:8080/dashboard/api/accounts/personal/pause
```

## WebSocket Connection

For real-time updates, connect to the WebSocket endpoint:

```
ws://localhost:8080/dashboard/ws
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
| `/dashboard` | Session or API key | Human access via browser |
| `/dashboard/api/*` | Session or API key | API access |
| `/dashboard/ws` | Session or API key | WebSocket connection |

### Session-Based Auth

The dashboard uses session-based authentication with:

- Passwords hashed with bcrypt (12 rounds)
- Secure, HttpOnly cookies
- CSRF token protection
- 24-hour session expiry (configurable)
- Sessions extend on activity
- Rate limiting: 5 failed attempts = 15-minute lockout

### Logging In

1. Go to `/dashboard/login`
2. Enter your username and password
3. Session cookie is set automatically

### Logging Out

Click the "Logout" button in the dashboard header.

## Security Considerations

### First-Visitor Risk

When the dashboard is enabled but no account exists:

- **Anyone** can visit `/dashboard/setup` and create the admin account
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
| `/dashboard` | GET | Session | Main dashboard view |
| `/dashboard/setup` | GET | None* | Registration page |
| `/dashboard/setup` | POST | None* | Create admin account |
| `/dashboard/login` | GET | None | Login page |
| `/dashboard/login` | POST | None | Authenticate |
| `/dashboard/logout` | POST | Session | End session |

*`/dashboard/setup` only accessible when no admin account exists

### API Routes

| Route | Method | Auth | Permission | Purpose |
|-------|--------|------|------------|---------|
| `/dashboard/api/stats` | GET | Session/Key | `read:stats` | Get metrics |
| `/dashboard/api/activity` | GET | Session/Key | `read:activity` | Get audit log |
| `/dashboard/api/logs` | GET | Session/Key | `read:logs` | Get system logs |
| `/dashboard/api/export` | GET | Session/Key | `read:export` | Export audit data |
| `/dashboard/api/dead-letter` | GET | Session/Key | `read:activity` | Get dead letters |
| `/dashboard/api/dead-letter/:id/retry` | POST | Session/Key | `write:accounts` | Retry failed email |
| `/dashboard/api/dead-letter/:id/dismiss` | POST | Session/Key | `write:accounts` | Dismiss entry |
| `/dashboard/api/emails/:account/:folder/:uid` | GET | Session/Key | `read:activity` | Email preview |
| `/dashboard/api/accounts/:name/pause` | POST | Session/Key | `write:accounts` | Pause account |
| `/dashboard/api/accounts/:name/resume` | POST | Session/Key | `write:accounts` | Resume account |
| `/dashboard/api/accounts/:name/reconnect` | POST | Session/Key | `write:accounts` | Reconnect IMAP |
| `/dashboard/api/accounts/:name/process` | POST | Session/Key | `write:accounts` | Trigger processing |

### Query Parameters

**Activity endpoint** (`/dashboard/api/activity`):
- `page` - Page number (default: 1)
- `pageSize` - Items per page (default: 20)
- `accountName` - Filter by account
- `actionType` - Filter by action type
- `search` - Search subject/messageId/account
- `startDate` - Filter by start timestamp (ms)
- `endDate` - Filter by end timestamp (ms)

**Logs endpoint** (`/dashboard/api/logs`):
- `limit` - Max entries (default: 100)
- `level` - Minimum log level (debug/info/warn/error)
- `accountName` - Filter by account context

## Troubleshooting

### "Setup already completed" Error

This means an admin account already exists. Go to `/dashboard/login` instead.

### Session Expired

Sessions expire after 24 hours of inactivity. Simply log in again.

### Forgot Password

Currently, there's no password reset flow. You'll need to:

1. Stop Mailpilot
2. Delete the user and session data from SQLite
3. Restart Mailpilot
4. Create a new account at `/dashboard/setup`

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
