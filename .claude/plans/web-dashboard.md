# Web Dashboard Implementation Plan

## Goal
Add a basic web dashboard for viewing metrics at `/dashboard` with proper username/password authentication.

## Current State
- Hono HTTP server running on port 8080
- Existing endpoints: `/health`, `/status` (JSON API with optional token auth)
- SQLite database with `audit_log` and `processed_messages` tables

---

## Authentication Design

### Requirements
1. **Opt-in**: Dashboard disabled by default (`dashboard.enabled: false`)
2. **First-visit registration**: Create admin account on first dashboard visit
3. **Username + password auth**: Proper login, not just token
4. **Session-based**: HttpOnly cookies for security
5. **Warnings**: Alert if dashboard enabled but no account registered

### Why Not Token Auth?
- Tokens are meant for API/automation access
- Dashboard needs proper login UX with session management
- Separate concerns: API auth vs human auth

---

## Config Addition

```yaml
dashboard:
  enabled: false  # Opt-in, disabled by default
  session_secret: ${DASHBOARD_SECRET}  # Optional, auto-generated if not set
```

---

## Database Schema Additions

### Table: `dashboard_users`
```sql
CREATE TABLE dashboard_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

### Table: `dashboard_sessions`
```sql
CREATE TABLE dashboard_sessions (
  id TEXT PRIMARY KEY,  -- Random session ID
  user_id INTEGER NOT NULL REFERENCES dashboard_users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_sessions_expires ON dashboard_sessions(expires_at);
```

---

## Authentication Flow

### First Visit (No User Exists)
```
GET /dashboard
  → Check if any user exists in dashboard_users
  → If no user: redirect to /dashboard/setup

GET /dashboard/setup
  → Show registration form (username, password, confirm password)

POST /dashboard/setup
  → Validate passwords match
  → Hash password with bcrypt
  → Create user in dashboard_users
  → Create session
  → Redirect to /dashboard
```

### Subsequent Visits
```
GET /dashboard
  → Check session cookie
  → If valid session: show dashboard
  → If no/invalid session: redirect to /dashboard/login

GET /dashboard/login
  → Show login form

POST /dashboard/login
  → Verify credentials
  → Create session, set cookie
  → Redirect to /dashboard

POST /dashboard/logout
  → Delete session
  → Clear cookie
  → Redirect to /dashboard/login
```

---

## Warning System

### Startup Warning
```
if (config.dashboard.enabled) {
  const userCount = getUserCount();
  if (userCount === 0) {
    logger.warn("[dashboard] Dashboard enabled but no admin account exists!");
    logger.warn("[dashboard] Visit /dashboard to create an account");
    logger.warn("[dashboard] WARNING: First visitor can register the admin account");
  }
}
```

### Periodic Warning (Every 4 Hours)
```typescript
setInterval(() => {
  if (config.dashboard.enabled && getUserCount() === 0) {
    logger.warn("[dashboard] SECURITY WARNING: Dashboard enabled without admin account");
    logger.warn("[dashboard] Anyone can register at /dashboard/setup");
  }
}, 4 * 60 * 60 * 1000);
```

---

## Security Considerations

1. **Password Hashing**: bcrypt with cost factor 12
2. **Session Tokens**: Cryptographically random (crypto.randomUUID or similar)
3. **Session Expiry**: 24 hours, sliding window on activity
4. **HttpOnly Cookies**: Prevents XSS from stealing sessions
5. **CSRF Protection**: Check Origin/Referer on POST requests
6. **Rate Limiting**: Limit login attempts (optional, Phase 2)

---

## Files to Create/Modify

| File | Purpose |
|------|---------|
| `src/config/schema.ts` | Add `dashboard` config section |
| `src/storage/database.ts` | Add dashboard tables to schema |
| `src/storage/dashboard.ts` | **NEW** - User/session CRUD operations |
| `src/server/dashboard.ts` | **NEW** - Routes: setup, login, logout, main |
| `src/server/auth.ts` | **NEW** - Session middleware, password hashing |
| `src/server/index.ts` | Register dashboard routes, start warning timer |
| `src/server/templates.ts` | **NEW** - HTML templates for all pages |

---

## Dashboard Pages

### `/dashboard/setup` (Registration)
- Only accessible if no user exists
- Form: username, password, confirm password
- Redirects to `/dashboard` on success

### `/dashboard/login`
- Standard login form
- "Invalid credentials" error message
- Redirects to `/dashboard` on success

### `/dashboard` (Main)
- Requires authentication
- Shows metrics (same as original plan):
  - Uptime, emails processed, actions taken, errors
  - Per-account table
  - Recent activity feed
  - Action breakdown
- Logout button

---

## Dependencies

Need to add:
- `bcrypt` - Password hashing (has native bindings, already handling native modules)

Or use pure JS alternative:
- `bcryptjs` - Pure JS, slower but no native deps

**Recommendation**: Use `bcryptjs` to avoid more native module issues.

---

## Implementation Order

1. **Config**: Add `dashboard` section to schema
2. **Database**: Add `dashboard_users` and `dashboard_sessions` tables
3. **Storage**: Create `src/storage/dashboard.ts` with user/session operations
4. **Auth**: Create `src/server/auth.ts` with middleware and hashing
5. **Templates**: Create `src/server/templates.ts` with HTML for all pages
6. **Routes**: Create `src/server/dashboard.ts` with all endpoints
7. **Integration**: Register routes, add warning system
8. **Testing**: Manual testing of full auth flow
9. **Documentation**: Update docs with dashboard setup instructions

---

## API Routes Summary

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/health` | GET | None | Health check (unchanged) |
| `/status` | GET | Token | API metrics (unchanged) |
| `/dashboard` | GET | Session | Main dashboard |
| `/dashboard/setup` | GET | None* | Registration page |
| `/dashboard/setup` | POST | None* | Create account |
| `/dashboard/login` | GET | None | Login page |
| `/dashboard/login` | POST | None | Authenticate |
| `/dashboard/logout` | POST | Session | End session |

*`/dashboard/setup` only works if no user exists

---

## Verification

- [ ] Dashboard disabled by default
- [ ] First visit shows registration when no user exists
- [ ] Registration creates user and logs in
- [ ] Login works with correct credentials
- [ ] Login fails with wrong credentials
- [ ] Session persists across page loads
- [ ] Logout clears session
- [ ] `/dashboard/setup` returns 403 if user already exists
- [ ] Warning logged on startup if no user
- [ ] Warning logged every 4 hours if no user
- [ ] All pages work on mobile
- [ ] No TypeScript/lint errors
