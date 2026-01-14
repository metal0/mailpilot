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

interface SetupPageOptions {
  error?: string;
  csrfToken: string;
}

export function renderSetupPage(options: SetupPageOptions): string {
  const { error, csrfToken } = options;
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
          <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">
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

interface LoginPageOptions {
  error?: string;
  csrfToken: string;
  username?: string;
}

export function renderLoginPage(options: LoginPageOptions): string {
  const { error, csrfToken, username } = options;
  const errorHtml = error
    ? `<div class="error">${escapeHtml(error)}</div>`
    : "";
  const usernameValue = username ? escapeHtml(username) : "";

  return layout("Login", `
    <div class="auth-container">
      <div class="auth-card">
        <h1 class="auth-title">Mailpilot</h1>
        <p class="auth-subtitle">Sign in to your account</p>
        ${errorHtml}
        <form method="POST" action="/dashboard/login">
          <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">
          <div class="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" name="username" value="${usernameValue}" required autocomplete="username">
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
          <tbody id="activity-tbody">
            ${data.recentActivity.map(renderActivityRow).join("")}
          </tbody>
        </table>
      `;

  const dashboardScript = `
    <script>
      const POLL_INTERVAL = 10000;
      let pollTimer = null;
      let currentTab = 'overview';

      function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.textContent = message;
        document.getElementById('toast-container').appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
      }

      function formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const parts = [];
        if (days > 0) parts.push(days + 'd');
        if (hours > 0) parts.push(hours + 'h');
        if (minutes > 0 || parts.length === 0) parts.push(minutes + 'm');
        return parts.join(' ');
      }

      function formatTime(timestamp) {
        return new Date(timestamp).toLocaleString();
      }

      async function fetchStats() {
        try {
          const res = await fetch('/dashboard/api/stats');
          if (!res.ok) throw new Error('Failed to fetch stats');
          const data = await res.json();
          updateDashboard(data);
        } catch (err) {
          console.error('Poll error:', err);
        }
      }

      function updateDashboard(data) {
        document.getElementById('stat-uptime').textContent = formatUptime(data.uptime);
        document.getElementById('stat-processed').textContent = data.totals.emailsProcessed.toLocaleString();
        document.getElementById('stat-actions').textContent = data.totals.actionsTaken.toLocaleString();
        document.getElementById('stat-errors').textContent = data.totals.errors.toLocaleString();

        // Update accounts table
        const tbody = document.getElementById('accounts-tbody');
        if (tbody && data.accounts) {
          tbody.innerHTML = data.accounts.map(renderAccountRow).join('');
        }

        // Update action breakdown
        if (data.actionBreakdown) {
          const breakdownEl = document.getElementById('action-breakdown');
          if (breakdownEl) {
            breakdownEl.innerHTML = data.actionBreakdown.map(b =>
              '<div class="breakdown-item"><span class="badge badge-' + b.type + '">' + b.type + '</span><span>' + b.count + '</span></div>'
            ).join('');
          }
        }

        // Update provider stats
        if (data.providerStats) {
          const providerEl = document.getElementById('provider-stats');
          if (providerEl) {
            providerEl.innerHTML = data.providerStats.map(p =>
              '<div class="provider-card"><div class="provider-name">' + escapeHtml(p.name) + '</div>' +
              '<div class="provider-model">' + escapeHtml(p.model) + '</div>' +
              '<div class="provider-stat">Today: ' + p.requestsToday + '</div>' +
              '<div class="provider-stat">Last min: ' + p.requestsLastMinute + (p.rpmLimit ? '/' + p.rpmLimit : '') + '</div>' +
              (p.rateLimited ? '<div class="provider-limited">Rate Limited</div>' : '') +
              '</div>'
            ).join('');
          }
        }

        // Update queue status
        if (data.queueStatus) {
          const queueEl = document.getElementById('queue-status');
          if (queueEl) {
            if (data.queueStatus.length === 0) {
              queueEl.innerHTML = '<p class="muted">No active processing</p>';
            } else {
              queueEl.innerHTML = data.queueStatus.map(q =>
                '<div class="queue-item"><span>' + escapeHtml(q.accountName) + ':' + escapeHtml(q.folder) + '</span>' +
                '<span class="badge">Processing ' + q.pendingCount + '</span></div>'
              ).join('');
            }
          }
        }
      }

      function renderAccountRow(account) {
        const statusClass = account.connected ? 'status-connected' : 'status-disconnected';
        const statusText = account.connected ? 'Connected' : 'Disconnected';
        const idleBadge = account.idleSupported ? '<span class="badge" style="margin-left:0.5rem">IDLE</span>' : '';
        const pausedBadge = account.paused ? '<span class="badge badge-warn" style="margin-left:0.5rem">Paused</span>' : '';

        return '<tr>' +
          '<td>' + escapeHtml(account.name) + '</td>' +
          '<td><span class="status-dot ' + statusClass + '"></span>' + statusText + idleBadge + pausedBadge + '</td>' +
          '<td>' + escapeHtml(account.llmProvider) + '/' + escapeHtml(account.llmModel) + '</td>' +
          '<td class="time">' + (account.lastScan || 'Never') + '</td>' +
          '<td>' + account.emailsProcessed + '</td>' +
          '<td>' + account.actionsTaken + '</td>' +
          '<td>' + account.errors + '</td>' +
          '<td class="actions-cell">' +
            '<button class="btn-sm" onclick="togglePause(\\'' + escapeHtml(account.name) + '\\', ' + !account.paused + ')">' + (account.paused ? 'Resume' : 'Pause') + '</button>' +
            '<button class="btn-sm btn-secondary" onclick="reconnectAccount(\\'' + escapeHtml(account.name) + '\\')">Reconnect</button>' +
            '<button class="btn-sm btn-secondary" onclick="triggerProcess(\\'' + escapeHtml(account.name) + '\\')">Process</button>' +
          '</td>' +
        '</tr>';
      }

      function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      }

      async function togglePause(name, pause) {
        try {
          const endpoint = pause ? 'pause' : 'resume';
          const res = await fetch('/dashboard/api/accounts/' + encodeURIComponent(name) + '/' + endpoint, { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            showToast('Account ' + (pause ? 'paused' : 'resumed'), 'success');
            fetchStats();
          } else {
            showToast('Failed to ' + endpoint + ' account', 'error');
          }
        } catch (err) {
          showToast('Error: ' + err.message, 'error');
        }
      }

      async function reconnectAccount(name) {
        try {
          showToast('Reconnecting ' + name + '...', 'info');
          const res = await fetch('/dashboard/api/accounts/' + encodeURIComponent(name) + '/reconnect', { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            showToast('Account reconnected', 'success');
            fetchStats();
          } else {
            showToast('Failed to reconnect', 'error');
          }
        } catch (err) {
          showToast('Error: ' + err.message, 'error');
        }
      }

      async function triggerProcess(name) {
        try {
          showToast('Triggering processing for ' + name + '...', 'info');
          const res = await fetch('/dashboard/api/accounts/' + encodeURIComponent(name) + '/process', { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            showToast('Processing triggered', 'success');
            fetchStats();
          } else {
            showToast('Failed to trigger processing', 'error');
          }
        } catch (err) {
          showToast('Error: ' + err.message, 'error');
        }
      }

      async function loadLogs() {
        try {
          const level = document.getElementById('log-level')?.value || '';
          const url = '/dashboard/api/logs?limit=100' + (level ? '&level=' + level : '');
          const res = await fetch(url);
          const data = await res.json();
          const logsEl = document.getElementById('logs-content');
          if (logsEl && data.logs) {
            logsEl.innerHTML = data.logs.map(log =>
              '<div class="log-entry log-' + log.level + '">' +
              '<span class="log-time">' + log.timestamp.substring(11, 19) + '</span>' +
              '<span class="log-level">' + log.level.toUpperCase() + '</span>' +
              '<span class="log-context">[' + escapeHtml(log.context) + ']</span>' +
              '<span class="log-message">' + escapeHtml(log.message) + '</span>' +
              (log.meta ? '<span class="log-meta">' + escapeHtml(JSON.stringify(log.meta)) + '</span>' : '') +
              '</div>'
            ).join('');
          }
        } catch (err) {
          console.error('Failed to load logs:', err);
        }
      }

      function exportCsv() {
        window.location.href = '/dashboard/api/export?format=csv';
      }

      function switchTab(tab) {
        currentTab = tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector('[data-tab="' + tab + '"]').classList.add('active');
        document.getElementById('tab-' + tab).classList.add('active');

        if (tab === 'logs') {
          loadLogs();
        }
      }

      // Start polling
      pollTimer = setInterval(fetchStats, POLL_INTERVAL);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          clearInterval(pollTimer);
        } else {
          fetchStats();
          pollTimer = setInterval(fetchStats, POLL_INTERVAL);
        }
      });
    </script>
  `;

  const additionalStyles = `
    <style>
      .tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid #334155; padding-bottom: 0.5rem; }
      .tab-btn { background: none; border: none; color: #94a3b8; padding: 0.5rem 1rem; cursor: pointer; border-radius: 0.25rem; }
      .tab-btn:hover { background: #334155; }
      .tab-btn.active { background: #3b82f6; color: white; }
      .tab-content { display: none; }
      .tab-content.active { display: block; }
      .breakdown-item { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #334155; }
      .provider-card { background: #0f172a; padding: 1rem; border-radius: 0.375rem; margin-bottom: 0.5rem; }
      .provider-name { font-weight: 600; margin-bottom: 0.25rem; }
      .provider-model { color: #64748b; font-size: 0.875rem; margin-bottom: 0.5rem; }
      .provider-stat { font-size: 0.875rem; color: #94a3b8; }
      .provider-limited { color: #f87171; font-size: 0.875rem; margin-top: 0.25rem; }
      .queue-item { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #334155; }
      .muted { color: #64748b; }
      .btn-sm { padding: 0.25rem 0.5rem; font-size: 0.75rem; background: #3b82f6; color: white; border: none; border-radius: 0.25rem; cursor: pointer; margin-right: 0.25rem; }
      .btn-sm:hover { background: #2563eb; }
      .btn-sm.btn-secondary { background: #475569; }
      .btn-sm.btn-secondary:hover { background: #64748b; }
      .actions-cell { white-space: nowrap; }
      .badge-warn { background: #78350f; color: #fbbf24; }
      .log-entry { font-family: monospace; font-size: 0.75rem; padding: 0.25rem 0; border-bottom: 1px solid #1e293b; display: flex; gap: 0.5rem; flex-wrap: wrap; }
      .log-time { color: #64748b; }
      .log-level { width: 3rem; font-weight: 600; }
      .log-debug .log-level { color: #64748b; }
      .log-info .log-level { color: #60a5fa; }
      .log-warn .log-level { color: #fbbf24; }
      .log-error .log-level { color: #f87171; }
      .log-context { color: #94a3b8; }
      .log-message { flex: 1; }
      .log-meta { color: #64748b; font-size: 0.7rem; width: 100%; overflow: hidden; text-overflow: ellipsis; }
      #logs-content { max-height: 400px; overflow-y: auto; }
      .log-filter { margin-bottom: 1rem; display: flex; gap: 0.5rem; align-items: center; }
      .log-filter select { background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 0.5rem; border-radius: 0.25rem; }
      #toast-container { position: fixed; top: 1rem; right: 1rem; z-index: 1000; display: flex; flex-direction: column; gap: 0.5rem; }
      .toast { padding: 0.75rem 1rem; border-radius: 0.375rem; background: #1e293b; color: #e2e8f0; animation: slideIn 0.3s ease; }
      .toast-success { background: #166534; }
      .toast-error { background: #991b1b; }
      @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      .sidebar { display: grid; grid-template-columns: 1fr 300px; gap: 1rem; }
      .sidebar-panel { display: flex; flex-direction: column; gap: 1rem; }
      @media (max-width: 1024px) {
        .sidebar { grid-template-columns: 1fr; }
        .grid-4 { grid-template-columns: repeat(2, 1fr); }
        table { font-size: 0.875rem; }
        th, td { padding: 0.5rem; }
        .actions-cell { display: none; }
      }
      @media (max-width: 640px) {
        .container { padding: 1rem; }
        .grid-4 { grid-template-columns: 1fr; }
        .header { flex-direction: column; gap: 1rem; text-align: center; }
        .card { padding: 1rem; }
      }
    </style>
  `;

  return layout("Dashboard", `
    ${additionalStyles}
    <div id="toast-container"></div>
    <div class="container">
      <div class="header">
        <h1>Mailpilot Dashboard</h1>
        <div>
          <span style="color: #94a3b8; margin-right: 1rem;">Logged in as ${escapeHtml(data.username)}</span>
          <button class="btn btn-secondary" onclick="exportCsv()">Export CSV</button>
          <form method="POST" action="/dashboard/logout" style="display: inline;">
            <button type="submit" class="btn btn-secondary">Logout</button>
          </form>
        </div>
      </div>

      <div class="tabs">
        <button class="tab-btn active" data-tab="overview" onclick="switchTab('overview')">Overview</button>
        <button class="tab-btn" data-tab="activity" onclick="switchTab('activity')">Activity</button>
        <button class="tab-btn" data-tab="logs" onclick="switchTab('logs')">Logs</button>
      </div>

      <div id="tab-overview" class="tab-content active">
        <div class="grid grid-4">
          <div class="card">
            <div class="card-title">Uptime</div>
            <div class="card-value" id="stat-uptime">${formatUptime(data.uptime)}</div>
          </div>
          <div class="card">
            <div class="card-title">Emails Processed</div>
            <div class="card-value" id="stat-processed">${data.totals.emailsProcessed.toLocaleString()}</div>
          </div>
          <div class="card">
            <div class="card-title">Actions Taken</div>
            <div class="card-value" id="stat-actions">${data.totals.actionsTaken.toLocaleString()}</div>
          </div>
          <div class="card">
            <div class="card-title">Errors</div>
            <div class="card-value" id="stat-errors">${data.totals.errors.toLocaleString()}</div>
          </div>
        </div>

        <div class="sidebar">
          <div>
            <div class="card">
              <h2 style="font-size: 1.125rem; margin-bottom: 1rem;">Accounts</h2>
              <div style="overflow-x: auto;">
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
                      <th>Manage</th>
                    </tr>
                  </thead>
                  <tbody id="accounts-tbody">
                    ${accountRows}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="sidebar-panel">
            <div class="card">
              <h2 style="font-size: 1.125rem; margin-bottom: 1rem;">Action Breakdown</h2>
              <div id="action-breakdown">
                <p class="muted">Loading...</p>
              </div>
            </div>

            <div class="card">
              <h2 style="font-size: 1.125rem; margin-bottom: 1rem;">LLM Providers</h2>
              <div id="provider-stats">
                <p class="muted">Loading...</p>
              </div>
            </div>

            <div class="card">
              <h2 style="font-size: 1.125rem; margin-bottom: 1rem;">Processing Queue</h2>
              <div id="queue-status">
                <p class="muted">No active processing</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="tab-activity" class="tab-content">
        <div class="card">
          <h2 style="font-size: 1.125rem; margin-bottom: 1rem;">Recent Activity</h2>
          ${activityContent}
        </div>
      </div>

      <div id="tab-logs" class="tab-content">
        <div class="card">
          <h2 style="font-size: 1.125rem; margin-bottom: 1rem;">System Logs</h2>
          <div class="log-filter">
            <label>Level:</label>
            <select id="log-level" onchange="loadLogs()">
              <option value="">All</option>
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>
            <button class="btn-sm" onclick="loadLogs()">Refresh</button>
          </div>
          <div id="logs-content">
            <p class="muted">Click "Refresh" to load logs</p>
          </div>
        </div>
      </div>

      <p style="text-align: center; color: #475569; margin-top: 2rem; font-size: 0.875rem;">
        Auto-refreshing every 10 seconds
      </p>
    </div>
    ${dashboardScript}
  `);
}
