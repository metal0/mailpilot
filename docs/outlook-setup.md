# Outlook / Microsoft 365 Setup

This guide explains how to configure Mailpilot with Outlook.com, Hotmail, or Microsoft 365 accounts.

## Account Types

| Account Type | IMAP Host | Notes |
|--------------|-----------|-------|
| Outlook.com / Hotmail | `outlook.office365.com` | Personal Microsoft accounts |
| Microsoft 365 (Business) | `outlook.office365.com` | Work/school accounts |
| Exchange On-Premises | Your server address | May require admin configuration |

## Authentication Options

### Option 1: App Passwords (Recommended)

App Passwords work for accounts with 2-Factor Authentication enabled.

### Option 2: Regular Password

Some accounts (especially older Outlook.com accounts) may work with regular passwords if:
- 2FA is not enabled, AND
- "Less secure apps" access is allowed (being phased out)

### Option 3: OAuth 2.0

Required for Microsoft 365 accounts with security defaults or conditional access policies.

## Setup with App Passwords

### Step 1: Enable 2-Factor Authentication

1. Go to [Microsoft Account Security](https://account.microsoft.com/security)
2. Click **Two-step verification**
3. Follow the prompts to enable 2FA

### Step 2: Generate an App Password

1. Go to [Microsoft Account Security](https://account.microsoft.com/security)
2. Click **Advanced security options**
3. Under "App passwords", click **Create a new app password**
4. Copy the generated password

**Note:** Microsoft 365 work accounts may require admin approval for App Passwords.

### Step 3: Configure Mailpilot

Add your Outlook account to `config.yaml`:

```yaml
accounts:
  - name: outlook
    imap:
      host: outlook.office365.com
      port: 993
      tls: auto
      auth: basic
      username: your-email@outlook.com
      password: ${OUTLOOK_APP_PASSWORD}

    folders:
      watch: [INBOX]
      mode: predefined
      allowed:
        - Archive
        - Work
        - Personal
```

## Outlook-Specific Folders

| Outlook Folder | IMAP Path |
|----------------|-----------|
| Inbox | `INBOX` |
| Sent Items | `Sent Items` or `Sent` |
| Drafts | `Drafts` |
| Junk Email | `Junk Email` or `Junk` |
| Deleted Items | `Deleted Items` or `Trash` |
| Archive | `Archive` |

Custom folders appear with their display name.

## Microsoft 365 Business Accounts

### If App Passwords Are Disabled

Your organization may have disabled App Passwords. Options:

1. **Ask your IT admin** to enable App Passwords for your account
2. **Use OAuth 2.0** (requires registering an Azure AD application)

### OAuth 2.0 Setup (Advanced)

For organizations requiring OAuth:

1. Register an application in [Azure Portal](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Grant IMAP permissions: `IMAP.AccessAsUser.All`
3. Generate a client secret
4. Use the OAuth flow to get a refresh token

```yaml
accounts:
  - name: work-outlook
    imap:
      host: outlook.office365.com
      port: 993
      tls: auto
      auth: oauth2
      username: your-email@company.com
      oauth_client_id: ${AZURE_CLIENT_ID}
      oauth_client_secret: ${AZURE_CLIENT_SECRET}
      oauth_refresh_token: ${AZURE_REFRESH_TOKEN}
```

## Troubleshooting

### "Authentication failed"

1. Verify you're using the App Password, not your regular password
2. Check if your organization allows IMAP access
3. For Microsoft 365: check with IT if additional security policies apply

### "IMAP is disabled"

Microsoft 365 admins can disable IMAP. Contact your IT department.

To check yourself (if you have admin access):
1. Go to [Microsoft 365 Admin Center](https://admin.microsoft.com)
2. Users → Active users → Select user
3. Mail → Manage email apps
4. Ensure IMAP is enabled

### "Too many connections"

Outlook limits concurrent IMAP connections. Reduce concurrency:

```yaml
concurrency_limit: 3
```

### Rate Limiting

Microsoft may temporarily block access after too many requests. Increase polling interval:

```yaml
polling_interval: 60s  # Default is 30s
```

## Multiple Outlook Accounts

You can configure multiple Outlook accounts:

```yaml
accounts:
  - name: personal-outlook
    imap:
      host: outlook.office365.com
      port: 993
      tls: auto
      auth: basic
      username: personal@outlook.com
      password: ${OUTLOOK_PERSONAL_PASSWORD}
    folders:
      watch: [INBOX]

  - name: work-microsoft365
    imap:
      host: outlook.office365.com
      port: 993
      tls: auto
      auth: basic
      username: work@company.com
      password: ${OUTLOOK_WORK_PASSWORD}
    folders:
      watch: [INBOX]
```

## Security Notes

- App Passwords grant full mailbox access via IMAP
- Store passwords securely using environment variables
- Microsoft 365 accounts may have additional compliance requirements
- Consider using dedicated service accounts for automated access
- Review and revoke unused App Passwords regularly
