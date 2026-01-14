# Gmail Setup

This guide explains how to configure Mailpilot with a Gmail account using App Passwords.

## Why App Passwords?

Gmail requires either:
- **OAuth 2.0** - Complex setup requiring client credentials and refresh tokens
- **App Passwords** - Simple 16-character passwords for IMAP access

App Passwords are the recommended approach for self-hosted applications like Mailpilot.

## Prerequisites

- A Google account with **2-Factor Authentication enabled**
- App Passwords are only available when 2FA is active

## Step 1: Enable 2-Factor Authentication

If you haven't already:

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Under "How you sign in to Google", click **2-Step Verification**
3. Follow the prompts to enable 2FA

## Step 2: Generate an App Password

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Under "How you sign in to Google", click **2-Step Verification**
3. Scroll down and click **App passwords**
4. You may need to sign in again
5. Under "Select app", choose **Mail**
6. Under "Select device", choose **Other** and enter "Mailpilot"
7. Click **Generate**
8. Copy the 16-character password (shown with spaces, but spaces are optional)

**Important:** Save this password securely. You won't be able to see it again.

## Step 3: Enable IMAP Access

1. Open [Gmail Settings](https://mail.google.com/mail/u/0/#settings/fwdandpop)
2. Click the **Forwarding and POP/IMAP** tab
3. Under "IMAP access", select **Enable IMAP**
4. Click **Save Changes**

## Step 4: Configure Mailpilot

Add your Gmail account to `config.yaml`:

```yaml
accounts:
  - name: personal-gmail
    imap:
      host: imap.gmail.com
      port: 993
      tls: auto
      auth: basic
      username: your-email@gmail.com
      password: xxxx xxxx xxxx xxxx  # Your App Password (spaces optional)

    folders:
      watch: [INBOX]
      mode: predefined
      allowed:
        - Work
        - Personal
        - Finance
        - Archive
```

Or use environment variables for the password:

```yaml
accounts:
  - name: personal-gmail
    imap:
      host: imap.gmail.com
      port: 993
      tls: auto
      auth: basic
      username: your-email@gmail.com
      password: ${GMAIL_APP_PASSWORD}
```

Then set the environment variable:
```bash
export GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"
```

## Gmail-Specific Folders

Gmail uses labels that appear as IMAP folders with special prefixes:

| Gmail Label | IMAP Folder |
|-------------|-------------|
| Inbox | `INBOX` |
| Sent | `[Gmail]/Sent Mail` |
| Drafts | `[Gmail]/Drafts` |
| Spam | `[Gmail]/Spam` |
| Trash | `[Gmail]/Trash` |
| All Mail | `[Gmail]/All Mail` |
| Starred | `[Gmail]/Starred` |

Custom labels appear as regular folders (e.g., `Work`, `Personal`).

## Example: Watch Multiple Folders

```yaml
accounts:
  - name: personal-gmail
    imap:
      host: imap.gmail.com
      port: 993
      tls: auto
      auth: basic
      username: your-email@gmail.com
      password: ${GMAIL_APP_PASSWORD}

    folders:
      watch:
        - INBOX
        - "[Gmail]/Spam"  # Quote paths with special characters
      mode: auto_create  # Create folders as needed
```

## Troubleshooting

### "Invalid credentials" Error

1. Verify you're using the App Password, not your Google account password
2. Check that IMAP is enabled in Gmail settings
3. Ensure the App Password was generated for "Mail" application

### "Too many simultaneous connections"

Gmail limits IMAP connections. Reduce `concurrency_limit` in config:

```yaml
concurrency_limit: 3  # Default is 5
```

### Messages Not Appearing

Gmail may delay IMAP sync. Also check:
- The message is in a watched folder
- The message hasn't been processed before (check audit log)
- IDLE is working (Gmail supports IDLE)

### App Password Not Available

App Passwords require 2-Factor Authentication. If you don't see the option:
1. Ensure 2FA is fully enabled (not just started)
2. Check if your Google Workspace admin has disabled App Passwords
3. Try a different browser or incognito mode

## Security Notes

- App Passwords grant full access to your Gmail account via IMAP
- Store App Passwords securely (use environment variables, not plain text)
- Revoke unused App Passwords at [Google Security](https://myaccount.google.com/apppasswords)
- Consider using a dedicated Gmail account for Mailpilot if processing sensitive emails
