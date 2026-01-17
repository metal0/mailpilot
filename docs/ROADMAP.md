# Mailpilot Roadmap

## Feature Plans

---

## 1. OAuth Authentication UI Flow (Gmail/Outlook)

### Overview
**Note:** Backend OAuth support already exists (`src/imap/oauth.ts`). Users can configure OAuth via config.yaml with `auth: oauth2` and manually-obtained refresh tokens.

This plan adds an **in-app OAuth consent flow** so users can click "Connect with Google/Microsoft" instead of manually obtaining tokens from developer consoles.

**Important:** Basic auth (app passwords) will remain fully supported as a fallback. Users can choose either:
- **OAuth** - Recommended for Gmail/Outlook, handles token refresh automatically
- **App Password** - Works with any IMAP provider, simpler setup for self-hosted mail

### Backend Changes

**New files:**
- `src/auth/oauth-flow.ts` - OAuth consent flow handlers

**OAuth flow:**
1. User clicks "Connect with Google/Microsoft" in Settings
2. Backend generates OAuth URL with state parameter
3. Redirect to provider's consent screen
4. Provider redirects back to `/api/oauth/callback`
5. Exchange code for tokens, store in config
6. IMAP connection uses existing XOAUTH2 mechanism

**New API endpoints:**
- `GET /api/oauth/start?provider=gmail&account=xxx` - Initiate OAuth flow
- `GET /api/oauth/callback` - Handle OAuth callback

### Frontend Changes

**Settings.svelte - Account editor:**
- Add auth type selector: "Password" | "OAuth (Google)" | "OAuth (Microsoft)"
- **Password selected:** Show username/password fields (current behavior)
- **OAuth selected:** Show "Connect with Google/Microsoft" button
- Display OAuth connection status (connected/expired/not connected)
- Add "Disconnect" button to revoke OAuth and switch back to password
- Auto-detect provider from IMAP host and suggest appropriate auth method

**OAuth popup flow:**
1. Click "Connect with Google"
2. Open popup window to `/api/oauth/start?provider=gmail&account=xxx`
3. User completes OAuth in popup
4. Popup closes, parent window receives message
5. Refresh account status

### Environment Variables
```
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
MICROSOFT_CLIENT_ID=xxx
MICROSOFT_CLIENT_SECRET=xxx
OAUTH_REDIRECT_URI=http://localhost:8085/api/oauth/callback
```

### Security Considerations
- Store tokens encrypted at rest
- PKCE flow for added security
- Minimal scopes: `https://mail.google.com/` for Gmail IMAP

### Other Considerations
- This entire flow should be disabled on the dashboard if the respective environment variables are not found (per service), and in that case only app passwords should be allowed

---

## 4. Smart Retry for Dead Letters ✅

> **Status: Complete** - Implemented January 2026

### Overview
Automatically retry failed emails with exponential backoff instead of requiring manual intervention.

### Backend Changes

**Database schema update:**
```sql
ALTER TABLE dead_letter ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE dead_letter ADD COLUMN next_retry_at INTEGER;
ALTER TABLE dead_letter ADD COLUMN max_retries INTEGER DEFAULT 3;
```

**New file: `src/processing/retry-manager.ts`**
```typescript
interface RetryConfig {
  maxRetries: number;        // Default: 3
  initialDelayMs: number;    // Default: 5 minutes
  maxDelayMs: number;        // Default: 24 hours
  backoffMultiplier: number; // Default: 2
}
```

**Retry logic:**
1. Every minute, check for dead letters where `next_retry_at < now`
2. Re-fetch email from IMAP, re-run classification
3. If success: remove from dead_letter, add to audit_log
4. If fail: increment retry_count, update next_retry_at
5. If retry_count >= max_retries: mark as `permanently_failed`

**Config schema:**
```yaml
state:
  retry:
    enabled: true
    max_retries: 3
    initial_delay: "5m"
    max_delay: "24h"
    backoff_multiplier: 2
```

### Frontend Changes

**Dead Letter UI enhancements:**
- Show retry count: "Retry 2/3"
- Show next retry time: "Next retry in 23m"
- Manual "Retry Now" button
- "Stop Retrying" button to mark as permanent failure
- Bulk actions: "Retry All", "Dismiss All"

**Settings - Retry configuration:**
- Enable/disable auto-retry toggle
- Max retries slider (1-10)
- Initial delay input
- Max delay input

---

## 7. Notification System ✅

> **Status: Complete** - Implemented January 2026

### Overview
Alert users about errors, processing milestones, and important events via browser notifications and optional email alerts.

### Backend Changes

**New file: `src/notifications/notifier.ts`**
```typescript
interface NotificationConfig {
  browser: {
    enabled: boolean;
    events: ('error' | 'dead_letter' | 'milestone')[];
  };
  email: {
    enabled: boolean;
    recipient: string;
    events: ('error_spike' | 'daily_summary')[];
    errorThreshold: number;
  };
}
```

**WebSocket notification broadcast:**
- Add new message type: `{ type: 'notification', data: Notification }`
- Trigger on: new dead letter, error spike, milestone reached

**Config schema:**
```yaml
notifications:
  browser:
    enabled: true
    events: [error, dead_letter]
  email:
    enabled: false
    recipient: "admin@example.com"
    daily_summary: true
    error_spike_threshold: 5
```

### Frontend Changes

**New component: `NotificationCenter.svelte`**
- Bell icon in header with unread count badge
- Dropdown showing recent notifications
- Click to navigate to relevant page
- Browser notification permission request

**Settings - Notifications tab:**
- Browser notifications toggle + permission status
- Event type checkboxes
- Email notifications toggle
- Test notification button

---

## 9. Rule Testing Sandbox

### Overview
Allow users to test classification prompts against sample emails before deploying to production.

### Backend Changes

**New API endpoints:**

**`POST /api/test-classification`** - Test with structured email data
```typescript
interface TestRequest {
  prompt: string;
  email: {
    from: string;
    subject: string;
    body: string;
  };
  provider?: string;
  model?: string;
}

interface TestResponse {
  success: boolean;
  classification: {
    actions: Action[];
    reasoning: string;
    raw_response: string;
  };
  tokens_used: number;
  latency_ms: number;
}
```

**`POST /api/test-classification/raw`** - Test with raw email (EML/RFC822)
```typescript
interface RawTestRequest {
  prompt: string;
  rawEmail: string;  // Raw RFC822 email content
  provider?: string;
  model?: string;
}

interface RawTestResponse extends TestResponse {
  parsed: {
    from: string;
    to: string;
    subject: string;
    date: string;
    body: string;
    attachments: { filename: string; contentType: string; size: number }[];
  };
}
```

**Implementation:**
- Use `mailparser` to parse raw email content
- Extract headers, body, and attachment metadata
- Pass parsed content to existing classification logic
- Return both parsed email info and classification results

### Frontend Changes

**New component: `RuleTestingSandbox.svelte`**

Layout:
```
┌─────────────────────────────────────────────────────────────┐
│  Rule Testing Sandbox                                       │
├─────────────────────────┬───────────────────────────────────┤
│  Classification Prompt  │  Sample Email                     │
│  ┌───────────────────┐  │  From: [________________]         │
│  │ <textarea>        │  │  Subject: [______________]        │
│  │                   │  │  Body: <textarea>                 │
│  └───────────────────┘  │                                   │
│  Provider: [ollama ▼]   │  [Load from template ▼]           │
│                         │                                   │
│        [Test Classification]                                │
├─────────────────────────┴───────────────────────────────────┤
│  Results                                                    │
│  Actions: move → "Receipts", flag → "important"             │
│  Reasoning: This appears to be a purchase receipt...        │
│  Tokens: 342 | Latency: 1.2s                                │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Load current account's prompt as starting point
- Email templates: "Newsletter", "Receipt", "Spam", "Personal"
- History of recent tests (localStorage)
- "Use this prompt" button to update account config

**Raw Email Upload:**
```
┌─────────────────────────────────────────────────────────────┐
│  Sample Email                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ [Manual Entry] [Upload Raw Email]                       ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  [If Upload Raw Email selected:]                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Drop .eml file here or click to browse                  ││
│  │ ─────────────────────────────────────────────────────── ││
│  │ Or paste raw email content:                             ││
│  │ ┌─────────────────────────────────────────────────────┐ ││
│  │ │ <textarea placeholder="Paste RFC822 content...">   │ ││
│  │ └─────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  [After parsing, show preview:]                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Parsed Email Preview                                    ││
│  │ From: sender@example.com                                ││
│  │ To: recipient@example.com                               ││
│  │ Subject: Your order has shipped                         ││
│  │ Date: 2024-01-15 10:30:00                               ││
│  │ Attachments: invoice.pdf (24 KB)                        ││
│  │ Body: [truncated preview...]                            ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Raw email sources:**
- Export from email client (Thunderbird, Apple Mail → "Save As")
- Gmail: "Show Original" → "Download Original"
- Outlook: "View Message Source"
- Drag & drop .eml files directly into browser

---

## 13. Accessibility (A11y) Fixes ✅

> **Status: Complete** - Implemented January 2026

### Overview
Fix accessibility warnings in modal overlays - add proper ARIA roles and keyboard handlers.

### Files to Fix
- `Dashboard.svelte` - modal overlays
- `ActivityLog.svelte` - filter dropdown, error preview modal
- `AccountsTable.svelte` - dropdown backdrop
- `Settings.svelte` - multiple modals and dropdowns
- `UserSettings.svelte` - modal overlay

### Solution: Reusable Modal Component

**Create `Modal.svelte`:**
```svelte
<script lang="ts">
  interface Props {
    open: boolean;
    title: string;
    onclose: () => void;
    variant?: 'default' | 'warning' | 'danger';
  }

  let { open, title, onclose, variant = 'default' }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
    if (e.key === 'Tab') trapFocus(e);
  }
</script>

{#if open}
  <div
    class="modal-overlay"
    role="presentation"
    onclick={onclose}
    onkeydown={handleKeydown}
  >
    <div
      class="modal modal-{variant}"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onclick={(e) => e.stopPropagation()}
      tabindex="-1"
    >
      <h3 id="modal-title">{title}</h3>
      <slot />
      <button class="btn-close" onclick={onclose} aria-label="Close modal">
        &times;
      </button>
    </div>
  </div>
{/if}
```

### Implementation Checklist
- [x] Create reusable Modal component with focus trapping
- [x] Update Dashboard.svelte to use Modal
- [x] Update ActivityLog.svelte filter dropdown and error preview
- [x] Update AccountsTable.svelte dropdown backdrop
- [x] Update Settings.svelte modals (account, provider, api-key editors)
- [x] Update UserSettings.svelte to use Modal
- [x] Add aria-label to all icon-only buttons

---

## 14. Config Validation UI

### Overview
Visual editor for classification prompts with syntax highlighting and real-time validation.

### Backend Changes

**New API endpoint: `POST /api/validate-prompt`**
```typescript
interface ValidationResponse {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}
```

**Validation rules:**
1. Must include placeholders: `{{subject}}`, `{{from}}`, `{{body}}`
2. Must request JSON output format
3. Must specify valid action types
4. Warn if prompt is too long (>4000 chars)
5. Warn if no examples provided

### Frontend Changes

**New component: `PromptEditor.svelte`**

Features:
- CodeMirror or Monaco editor integration
- Syntax highlighting for:
  - Placeholders: `{{variable}}` in blue
  - JSON blocks in prompt
  - Action types: `move`, `flag`, `read`, etc.
- Line numbers
- Real-time validation with error markers
- Autocomplete for placeholders and action types
- Character count with warning at limit
- Expand/collapse to fullscreen

**Integration:**
- Replace textarea in Settings → Account → Classification Prompt
- Replace textarea in Settings → Global Settings → Default Prompt
- Add in Rule Testing Sandbox

---

## 16. Docker Health Checks

### Overview
Add proper health check endpoint for container orchestration and monitoring.

### Backend Changes

**New file: `src/server/health.ts`**
```typescript
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    imap: HealthCheck;
    llm: HealthCheck;
  };
}
```

**Endpoints:**
- `GET /health` - Full health status (returns 503 if unhealthy)
- `GET /health/live` - Kubernetes liveness probe (simple OK)
- `GET /health/ready` - Kubernetes readiness probe (checks dependencies)

**Health checks:**
- Database: `SELECT 1` query
- IMAP: Count of connected accounts vs total
- LLM: Count of healthy providers vs total

### Dockerfile Update
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8085/health/live || exit 1
```

### Kubernetes Probes
```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 8085
  initialDelaySeconds: 5
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 8085
  initialDelaySeconds: 5
  periodSeconds: 10
```

---

## Real-time Streaming Toggle (Activity & Logs) ✅

> **Status: Complete** - Implemented January 2026

### Overview
Add pause/resume toggle button to Activity and Logs pages for real-time streaming via WebSocket.
- Activity: streaming ON by default
- Logs: streaming OFF by default

### Frontend Changes

**New component: `StreamToggle.svelte`**
```svelte
<script lang="ts">
  interface Props {
    streaming: boolean;
    onchange: (streaming: boolean) => void;
    label?: string;
  }

  let { streaming, onchange, label = 'Live' }: Props = $props();
</script>

<button
  class="stream-toggle"
  class:active={streaming}
  onclick={() => onchange(!streaming)}
  title={streaming ? 'Pause live updates' : 'Resume live updates'}
  aria-pressed={streaming}
>
  {#if streaming}
    <svg class="icon-pause"><!-- pause icon --></svg>
  {:else}
    <svg class="icon-play"><!-- play icon --></svg>
  {/if}
  <span class="label">{label}</span>
  {#if streaming}
    <span class="pulse"></span>
  {/if}
</button>
```

**ActivityLog.svelte:**
- Streaming ON by default
- Buffer entries when paused
- Show pending count: "Paused (5 new)"
- Merge buffered entries on resume

**Logs.svelte:**
- Streaming OFF by default
- Same buffering behavior

### Backend Changes

**WebSocket activity streaming:**
Add `activity` broadcast type when audit entries are created:
```typescript
// After addAuditEntry()
broadcastActivity(entry);
```

**New WebSocket message type:**
```typescript
{ type: 'activity', data: AuditEntry }
```

---

## 17. Keyboard Shortcuts

### Overview
Add keyboard navigation to the dashboard for power users. Quick navigation between tabs, actions on lists, and global shortcuts.

### Frontend Changes

**New file: `dashboard/src/lib/stores/shortcuts.ts`**
```typescript
interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
  scope: 'global' | 'activity' | 'logs' | 'settings';
}
```

**New component: `KeyboardShortcuts.svelte`**
- Global keydown listener (attached to window)
- Shortcut help modal (triggered by `?`)
- Scope-aware shortcuts (different shortcuts active per tab)

**Shortcuts to implement:**

| Key | Action | Scope |
|-----|--------|-------|
| `1-5` | Switch tabs (Overview, Activity, Logs, Settings, Debug) | Global |
| `?` | Show shortcuts help modal | Global |
| `Escape` | Close any open modal | Global |
| `j/k` | Navigate up/down in list | Activity, Logs |
| `Enter` | Open selected item details | Activity, Logs |
| `r` | Retry selected dead letter | Activity (dead letters) |
| `d` | Dismiss selected dead letter | Activity (dead letters) |
| `f` | Focus search/filter input | Activity, Logs |
| `/` | Focus search/filter input (alternative) | Activity, Logs |
| `p` | Toggle streaming pause/resume | Activity, Logs |
| `Ctrl+,` | Open settings | Global |

**Integration points:**
- `Dashboard.svelte` - Global shortcuts, tab switching
- `ActivityLog.svelte` - List navigation, retry/dismiss actions
- `LogViewer.svelte` - List navigation, filtering
- `App.svelte` - Mount global listener

**User settings (localStorage):**
- `shortcuts.enabled` - Toggle shortcuts on/off

---

## 18. Classification Confidence Scores ✅ IMPLEMENTED

### Overview
Request confidence percentage from LLM. Route low-confidence classifications to dead letter queue for manual review instead of auto-executing potentially wrong actions.

### Implementation Status

**Backend - DONE:**
- ✅ Global `confidence.enabled` and `confidence.request_reasoning` config options
- ✅ Per-account `minimum_confidence` threshold (0.0-1.0)
- ✅ LLM response parsing for confidence and reasoning fields
- ✅ Prompt injection for confidence/reasoning requests
- ✅ Dead letter queue routing for low-confidence classifications
- ✅ Audit log stores confidence and reasoning

**Frontend - DONE:**
- ✅ Confidence scoring toggle in Settings → Providers section
- ✅ Request reasoning toggle (conditional on confidence enabled)
- ✅ Per-account minimum confidence slider in Advanced Settings
- ✅ Hint text explaining dead letter queue routing

**Remaining UI enhancements (optional):**
- [ ] Show confidence badge on activity entries (color-coded)
- [ ] Show reasoning in expandable activity details
- [ ] Filter activity by confidence range
- [ ] Show confidence in dead letter queue entries

---

## 19. Graceful Shutdown Improvements

### Overview
Current shutdown has 5-second timeout. Improve to track in-flight operations and wait for completion (with configurable timeout).

### Backend Changes

**New file: `src/utils/inflight.ts`**
```typescript
class InFlightTracker {
  private operations = new Map<string, { startedAt: Date; description: string }>();

  start(id: string, description: string): void;
  complete(id: string): void;
  getActive(): { id: string; description: string; duration: number }[];
  waitForAll(timeoutMs: number): Promise<boolean>;
}

export const inflightTracker = new InFlightTracker();
```

**Worker integration (`src/processor/worker.ts`):**
```typescript
// In processMessage()
const opId = `${accountName}:${messageId}`;
inflightTracker.start(opId, `Processing ${messageId}`);
try {
  // ... existing processing logic
} finally {
  inflightTracker.complete(opId);
}
```

**Shutdown update (`src/utils/shutdown.ts`):**
```typescript
async function executeShutdown(signal: string): Promise<void> {
  // Wait for in-flight operations
  const active = inflightTracker.getActive();
  if (active.length > 0) {
    logger.info(`Waiting for ${active.length} in-flight operations to complete`);
    const completed = await inflightTracker.waitForAll(shutdownTimeoutMs);
    if (!completed) {
      logger.warn("Some operations did not complete before timeout", {
        remaining: inflightTracker.getActive().map(op => op.description),
      });
    }
  }
  // ... continue with handler execution
}
```

**Config schema update:**
```yaml
shutdown:
  timeout: "30s"              # Total shutdown timeout
  wait_for_inflight: true     # Wait for in-flight operations
  force_after: "25s"          # Force shutdown after this duration
```

**WebSocket notification:**
- Broadcast shutdown warning to dashboard
- Show countdown/status in UI

### Frontend Changes

**ConnectionBlocker enhancement:**
- Show "Server shutting down" state
- Display in-flight operation count if available
- Auto-reconnect after server restart

---

## Implementation Priority

| Feature | Complexity | Impact | Priority | Status |
|---------|------------|--------|----------|--------|
| 13. A11y Fixes | Low | Medium | P1 | ✅ Complete |
| 16. Docker Health | Low | High | P1 | |
| Streaming Toggle | Medium | High | P1 | ✅ Complete |
| 4. Smart Retry | Medium | High | P2 | ✅ Complete |
| 7. Notifications | Medium | Medium | P2 | ✅ Complete |
| 17. Keyboard Shortcuts | Medium | Medium | P2 | |
| 18. Confidence Scores | Medium | High | P2 | |
| 19. Graceful Shutdown | Low | Medium | P2 | |
| 14. Config Editor | Medium | Medium | P3 | |
| 9. Rule Sandbox | High | Medium | P3 | |
| 1. OAuth UI | High | High | P4 | |
