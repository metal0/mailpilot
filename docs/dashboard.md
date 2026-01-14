# Web Dashboard

Mailpilot includes an optional web dashboard for viewing metrics and monitoring email processing activity.

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
```

## Dashboard Features

### Metrics Overview

- **Uptime**: How long Mailpilot has been running
- **Emails Processed**: Total count of emails analyzed
- **Actions Taken**: Total count of LLM-triggered actions
- **Errors**: Total error count across all accounts

### Account Status Table

For each configured email account:

- Connection status (Connected/Disconnected)
- IDLE support indicator
- Last scan timestamp
- Per-account processed/action/error counts
- LLM provider and model in use

### Recent Activity Feed

Shows the last 20 processed emails with:

- Timestamp
- Account name
- Subject (if `audit_subjects: true` in config)
- Actions taken (move, flag, read, delete, etc.)

## Authentication

### Dashboard Auth vs API Auth

| Endpoint | Auth Type | Purpose |
|----------|-----------|---------|
| `/health` | None | Health check for load balancers |
| `/status` | Bearer token | API access for monitoring tools |
| `/dashboard` | Username/password + session | Human access via web browser |

The dashboard uses session-based authentication with:

- Passwords hashed with bcrypt
- Secure, HttpOnly cookies
- 24-hour session expiry (configurable)
- Sessions extend on activity

### Logging In

1. Go to `/dashboard/login`
2. Enter your username and password
3. Session cookie is set automatically

### Logging Out

Click the "Logout" button in the dashboard header, or go to `/dashboard/logout`.

## Security Considerations

### First-Visitor Risk

When the dashboard is enabled but no account exists:

- **Anyone** can visit `/dashboard/setup` and create the admin account
- Warnings are logged on startup and every 4 hours
- Create your account immediately after enabling

### Recommendations

1. **Local/trusted networks only**: Don't expose the dashboard to the public internet without additional protection (reverse proxy with auth, VPN, etc.)

2. **Strong passwords**: Use a password manager and generate a strong password

3. **Check logs**: Monitor for the security warning:
   ```
   SECURITY WARNING: Dashboard enabled but no admin account exists
   ```

4. **Disable when not needed**: If you only need API access, keep the dashboard disabled and use `/status` with token auth instead

## Troubleshooting

### "Setup already completed" Error

This means an admin account already exists. Go to `/dashboard/login` instead.

### Session Expired

Sessions expire after 24 hours of inactivity. Simply log in again.

### Forgot Password

Currently, there's no password reset flow. You'll need to:

1. Stop Mailpilot
2. Delete the `dashboard_users` and `dashboard_sessions` tables from the SQLite database
3. Restart Mailpilot
4. Create a new account at `/dashboard/setup`

```bash
sqlite3 ./data/mailpilot.db "DELETE FROM dashboard_sessions; DELETE FROM dashboard_users;"
```

## API Endpoints

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/dashboard` | GET | Session | Main dashboard view |
| `/dashboard/setup` | GET | None* | Registration page |
| `/dashboard/setup` | POST | None* | Create admin account |
| `/dashboard/login` | GET | None | Login page |
| `/dashboard/login` | POST | None | Authenticate |
| `/dashboard/logout` | POST | Session | End session |

*`/dashboard/setup` only accessible when no admin account exists
