<script lang="ts">
  import { stats } from "../stores/data";
  import { t } from "../i18n";

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

  function getActionRate(): string | null {
    if (!$stats) return null;
    const processed = $stats.totals.emailsProcessed;
    const emailsWithActions = $stats.totals.actionsTaken;
    if (processed === 0) return null;
    const rate = (emailsWithActions / processed) * 100;
    return Math.round(rate) + "%";
  }

  function getConnectedCount(): { connected: number; total: number } {
    const accounts = $stats?.accounts ?? [];
    return {
      connected: accounts.filter(a => a.connected && !a.paused).length,
      total: accounts.length
    };
  }

  function getHealthStatus(): "healthy" | "warning" | "error" {
    const { connected, total } = getConnectedCount();
    if (total === 0) return "healthy";
    if (connected === total) return "healthy";
    if (connected > 0) return "warning";
    return "error";
  }

</script>

<div class="stats-grid">
  <!-- Connected Accounts -->
  <div class="stat-card" class:stat-card-warning={getHealthStatus() === "warning"} class:stat-card-error={getHealthStatus() === "error"}>
    <div class="stat-icon" class:stat-icon-success={getHealthStatus() === "healthy"} class:stat-icon-warning={getHealthStatus() === "warning"} class:stat-icon-error={getHealthStatus() === "error"}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    </div>
    <div class="stat-content">
      <div class="stat-value">{getConnectedCount().connected}/{getConnectedCount().total}</div>
      <div class="stat-label">{$t("common.accounts")}</div>
    </div>
  </div>

  <!-- Uptime -->
  <div class="stat-card">
    <div class="stat-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    </div>
    <div class="stat-content">
      <div class="stat-value">{$stats ? formatUptime($stats.uptime) : "-"}</div>
      <div class="stat-label">{$t("stats.uptime")}</div>
    </div>
  </div>

  <!-- Emails Processed -->
  <div class="stat-card">
    <div class="stat-icon stat-icon-accent">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    </div>
    <div class="stat-content">
      <div class="stat-value">{$stats?.totals.emailsProcessed.toLocaleString() ?? "-"}</div>
      <div class="stat-label">{$t("stats.emailsProcessed")}</div>
    </div>
  </div>

  <!-- Actions Taken -->
  <div class="stat-card">
    <div class="stat-icon stat-icon-success">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 11 12 14 22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    </div>
    <div class="stat-content">
      <div class="stat-value">{$stats?.totals.actionsTaken.toLocaleString() ?? "-"}</div>
      <div class="stat-label">{$t("stats.actionsTaken")}</div>
    </div>
  </div>

  <!-- Action Rate -->
  {#if getActionRate()}
    <div class="stat-card">
      <div class="stat-icon stat-icon-info">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
      </div>
      <div class="stat-content">
        <div class="stat-value">{getActionRate()}</div>
        <div class="stat-label">Action Rate</div>
      </div>
    </div>
  {/if}

  <!-- Errors -->
  {#if $stats && $stats.totals.errors > 0}
    <div class="stat-card stat-card-error">
      <div class="stat-icon stat-icon-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div class="stat-content">
        <div class="stat-value">{$stats.totals.errors.toLocaleString()}</div>
        <div class="stat-label">{$t("stats.errors")}</div>
      </div>
    </div>
  {/if}

  <!-- Dead Letters -->
  {#if $stats?.deadLetterCount !== undefined && $stats.deadLetterCount > 0}
    <div class="stat-card stat-card-warning">
      <div class="stat-icon stat-icon-warning">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <div class="stat-content">
        <div class="stat-value">{$stats.deadLetterCount}</div>
        <div class="stat-label">{$t("stats.deadLetters")}</div>
      </div>
    </div>
  {/if}
</div>

<style>
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-4);
    margin-bottom: var(--space-5);
  }

  .stat-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    display: flex;
    align-items: center;
    gap: var(--space-4);
    transition: all var(--transition-fast);
  }

  .stat-card:hover {
    border-color: var(--border-subtle);
    box-shadow: var(--shadow-md);
  }

  .stat-icon {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-lg);
    background: var(--bg-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--text-secondary);
  }

  .stat-icon svg {
    width: 24px;
    height: 24px;
  }

  .stat-icon-accent {
    background: var(--info-muted);
    color: var(--accent);
  }

  .stat-icon-success {
    background: var(--success-muted);
    color: var(--success);
  }

  .stat-icon-info {
    background: var(--info-muted);
    color: var(--info);
  }

  .stat-icon-warning {
    background: var(--warning-muted);
    color: var(--warning);
  }

  .stat-icon-error {
    background: var(--error-muted);
    color: var(--error);
  }

  .stat-content {
    flex: 1;
    min-width: 0;
  }

  .stat-label {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-top: var(--space-1);
  }

  .stat-value {
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.2;
  }

  .stat-card-error {
    border-color: color-mix(in srgb, var(--error) 30%, transparent);
  }

  .stat-card-error .stat-value {
    color: var(--error);
  }

  .stat-card-warning {
    border-color: color-mix(in srgb, var(--warning) 30%, transparent);
  }

  .stat-card-warning .stat-value {
    color: var(--warning);
  }

  .stat-card-extended {
    grid-column: span 1;
  }

  .badge {
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .badge-warning {
    background: var(--warning-muted);
    color: var(--warning);
  }

  .mini-chart {
    display: flex;
    height: 4px;
    border-radius: 2px;
    overflow: hidden;
    margin-top: var(--space-2);
    background: var(--bg-tertiary);
  }

  .mini-bar {
    height: 100%;
    min-width: 2px;
  }

  .mini-bar:first-child {
    border-radius: 2px 0 0 2px;
  }

  .mini-bar:last-child {
    border-radius: 0 2px 2px 0;
  }

  .mini-bar:only-child {
    border-radius: 2px;
  }
</style>
