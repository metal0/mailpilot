import type { AuditEntry } from "../storage/audit.js";
import type { AccountStatus } from "./status.js";
import type { LlmAction } from "../llm/parser.js";

const baseStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    min-height: 100vh;
    line-height: 1.5;
  }
  a { color: #60a5fa; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
  .card {
    background: #1e293b;
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }
  .card-title {
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
    margin-bottom: 0.5rem;
  }
  .card-value {
    font-size: 2rem;
    font-weight: 600;
    color: #f8fafc;
  }
  .grid { display: grid; gap: 1rem; }
  .grid-4 { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #334155;
  }
  .header h1 { font-size: 1.5rem; font-weight: 600; }
  .btn {
    display: inline-block;
    padding: 0.5rem 1rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
  }
  .btn:hover { background: #2563eb; text-decoration: none; }
  .btn-secondary { background: #475569; }
  .btn-secondary:hover { background: #64748b; }
  table { width: 100%; border-collapse: collapse; }
  th, td {
    text-align: left;
    padding: 0.75rem;
    border-bottom: 1px solid #334155;
  }
  th { color: #94a3b8; font-weight: 500; font-size: 0.875rem; }
  .status-dot {
    display: inline-block;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    margin-right: 0.5rem;
  }
  .status-connected { background: #22c55e; }
  .status-disconnected { background: #ef4444; }
  .form-group { margin-bottom: 1rem; }
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: #94a3b8;
    font-size: 0.875rem;
  }
  .form-group input {
    width: 100%;
    padding: 0.75rem;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 0.375rem;
    color: #e2e8f0;
    font-size: 1rem;
  }
  .form-group input:focus {
    outline: none;
    border-color: #3b82f6;
  }
  .error {
    background: #7f1d1d;
    color: #fecaca;
    padding: 0.75rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
  }
  .auth-container {
    max-width: 400px;
    margin: 4rem auto;
    padding: 2rem;
  }
  .auth-card {
    background: #1e293b;
    border-radius: 0.5rem;
    padding: 2rem;
  }
  .auth-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    text-align: center;
  }
  .auth-subtitle {
    color: #94a3b8;
    text-align: center;
    margin-bottom: 1.5rem;
  }
  .badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    background: #334155;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    color: #94a3b8;
    margin-right: 0.25rem;
  }
  .badge-move { background: #1e3a5f; color: #60a5fa; }
  .badge-flag { background: #3f2f1d; color: #fbbf24; }
  .badge-read { background: #1a3329; color: #4ade80; }
  .badge-delete { background: #3b1c1c; color: #f87171; }
  .badge-spam { background: #3b1c1c; color: #f87171; }
  .badge-noop { background: #334155; color: #94a3b8; }
  .time { color: #64748b; font-size: 0.875rem; }
`;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function layout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Mailpilot</title>
  <style>${baseStyles}</style>
</head>
<body>
  ${content}
</body>
</html>`;
}

export function renderSetupPage(error?: string): string {
  const errorHtml = error
    ? `<div class="error">${escapeHtml(error)}</div>`
    : "";

  return layout("Setup", `
    <div class="auth-container">
      <div class="auth-card">
        <h1 class="auth-title">Mailpilot Setup</h1>
        <p class="auth-subtitle">Create your admin account</p>
        ${errorHtml}
        <form method="POST" action="/dashboard/setup">
          <div class="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" name="username" required minlength="3" autocomplete="username">
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required minlength="8" autocomplete="new-password">
          </div>
          <div class="form-group">
            <label for="confirm">Confirm Password</label>
            <input type="password" id="confirm" name="confirm" required minlength="8" autocomplete="new-password">
          </div>
          <button type="submit" class="btn" style="width: 100%;">Create Account</button>
        </form>
      </div>
    </div>
  `);
}

export function renderLoginPage(error?: string): string {
  const errorHtml = error
    ? `<div class="error">${escapeHtml(error)}</div>`
    : "";

  return layout("Login", `
    <div class="auth-container">
      <div class="auth-card">
        <h1 class="auth-title">Mailpilot</h1>
        <p class="auth-subtitle">Sign in to your account</p>
        ${errorHtml}
        <form method="POST" action="/dashboard/login">
          <div class="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" name="username" required autocomplete="username">
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required autocomplete="current-password">
          </div>
          <button type="submit" class="btn" style="width: 100%;">Sign In</button>
        </form>
      </div>
    </div>
  `);
}

interface DashboardData {
  username: string;
  uptime: number;
  totals: {
    emailsProcessed: number;
    actionsTaken: number;
    errors: number;
  };
  accounts: AccountStatus[];
  recentActivity: AuditEntry[];
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

  return parts.join(" ");
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function actionBadge(action: LlmAction): string {
  const badgeClass = `badge badge-${action.type}`;
  let label: string = action.type;

  if (action.type === "move" && action.folder) {
    label = `move:${action.folder}`;
  } else if (action.type === "flag" && action.flags) {
    label = `flag:${action.flags.join("+")}`;
  }

  return `<span class="${badgeClass}">${escapeHtml(label)}</span>`;
}

function renderAccountRow(account: AccountStatus): string {
  const statusClass = account.connected ? "status-connected" : "status-disconnected";
  const statusText = account.connected ? "Connected" : "Disconnected";
  const idleBadge = account.idleSupported
    ? `<span class="badge" style="margin-left: 0.5rem;">IDLE</span>`
    : "";

  return `
    <tr>
      <td>${escapeHtml(account.name)}</td>
      <td>
        <span class="status-dot ${statusClass}"></span>
        ${statusText}
        ${idleBadge}
      </td>
      <td>${escapeHtml(account.llmProvider)}/${escapeHtml(account.llmModel)}</td>
      <td class="time">${account.lastScan ?? "Never"}</td>
      <td>${account.emailsProcessed}</td>
      <td>${account.actionsTaken}</td>
      <td>${account.errors}</td>
    </tr>
  `;
}

function renderActivityRow(entry: AuditEntry): string {
  const subject = entry.subject
    ? escapeHtml(entry.subject)
    : `<span style="color: #64748b;">—</span>`;

  const actionBadges = entry.actions.map(actionBadge).join(" ");

  return `
    <tr>
      <td class="time">${formatTime(entry.createdAt)}</td>
      <td>${escapeHtml(entry.accountName)}</td>
      <td>${subject}</td>
      <td>${actionBadges}</td>
    </tr>
  `;
}

export function renderDashboard(data: DashboardData): string {
  const accountRows = data.accounts.map(renderAccountRow).join("");

  const activityContent =
    data.recentActivity.length === 0
      ? `<p style="color: #64748b;">No activity yet</p>`
      : `
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Account</th>
              <th>Subject</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${data.recentActivity.map(renderActivityRow).join("")}
          </tbody>
        </table>
      `;

  return layout("Dashboard", `
    <div class="container">
      <div class="header">
        <h1>Mailpilot Dashboard</h1>
        <div>
          <span style="color: #94a3b8; margin-right: 1rem;">Logged in as ${escapeHtml(data.username)}</span>
          <form method="POST" action="/dashboard/logout" style="display: inline;">
            <button type="submit" class="btn btn-secondary">Logout</button>
          </form>
        </div>
      </div>

      <div class="grid grid-4">
        <div class="card">
          <div class="card-title">Uptime</div>
          <div class="card-value">${formatUptime(data.uptime)}</div>
        </div>
        <div class="card">
          <div class="card-title">Emails Processed</div>
          <div class="card-value">${data.totals.emailsProcessed.toLocaleString()}</div>
        </div>
        <div class="card">
          <div class="card-title">Actions Taken</div>
          <div class="card-value">${data.totals.actionsTaken.toLocaleString()}</div>
        </div>
        <div class="card">
          <div class="card-title">Errors</div>
          <div class="card-value">${data.totals.errors.toLocaleString()}</div>
        </div>
      </div>

      <div class="card">
        <h2 style="font-size: 1.125rem; margin-bottom: 1rem;">Accounts</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>LLM</th>
              <th>Last Scan</th>
              <th>Processed</th>
              <th>Actions</th>
              <th>Errors</th>
            </tr>
          </thead>
          <tbody>
            ${accountRows}
          </tbody>
        </table>
      </div>

      <div class="card">
        <h2 style="font-size: 1.125rem; margin-bottom: 1rem;">Recent Activity</h2>
        ${activityContent}
      </div>

      <p style="text-align: center; color: #475569; margin-top: 2rem;">
        Auto-refresh in 30 seconds
      </p>
    </div>
    <meta http-equiv="refresh" content="30">
  `);
}
