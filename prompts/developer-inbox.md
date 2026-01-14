# Developer Inbox Organizer

Organize my developer-focused inbox efficiently.

## Available Folders

- GitHub/PRs
- GitHub/Issues
- GitHub/Actions
- GitHub/Dependabot
- CI-CD/Builds
- CI-CD/Deployments
- Alerts/Errors
- Alerts/Warnings
- Work/Team
- Work/Management
- Newsletters/Tech
- Newsletters/Jobs

## Classification Rules

### GitHub Notifications
- Pull request notifications -> GitHub/PRs
  - Flag if I'm requested reviewer
- Issue notifications -> GitHub/Issues
  - Flag if assigned to me
- GitHub Actions failures -> GitHub/Actions + flag
- Dependabot alerts -> GitHub/Dependabot

### CI/CD
- Build failures -> CI-CD/Builds + flag
- Build successes -> CI-CD/Builds (mark as read)
- Deployment notifications -> CI-CD/Deployments
  - Flag production deployments

### Monitoring Alerts
- Error alerts (PagerDuty, Sentry, etc.) -> Alerts/Errors + flag
- Warning alerts -> Alerts/Warnings
- Info/resolved -> Alerts/Warnings (mark as read)

### Work Communication
- From engineering team -> Work/Team
- From management/HR -> Work/Management
- Meeting invites -> noop (leave in inbox)

### Newsletters
- Tech newsletters (TLDR, Hacker Newsletter, etc.) -> Newsletters/Tech
- Job-related -> Newsletters/Jobs

### Spam
- Recruiter spam -> spam
- Marketing -> spam (unless subscribed)

## Special Behaviors

- Mark successful CI builds as read to reduce noise
- Always flag production errors and deployment failures
- GitHub notifications from my own actions -> mark as read
