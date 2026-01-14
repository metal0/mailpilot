<script lang="ts">
  import { stats } from "../stores/data";

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

  const actionColors: Record<string, string> = {
    move: "#3b82f6",
    flag: "#f59e0b",
    read: "#10b981",
    spam: "#ef4444",
    delete: "#dc2626",
    noop: "#6b7280",
  };

  function getActionColor(action: string): string {
    return actionColors[action.toLowerCase()] ?? "#6b7280";
  }

  function getMaxActionCount(): number {
    if (!$stats?.actionBreakdown?.length) return 1;
    return Math.max(...$stats.actionBreakdown.map(a => a.count), 1);
  }
</script>

<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-label">Uptime</div>
    <div class="stat-value">{$stats ? formatUptime($stats.uptime) : "-"}</div>
  </div>

  <div class="stat-card">
    <div class="stat-label">Emails Processed</div>
    <div class="stat-value">{$stats?.totals.emailsProcessed.toLocaleString() ?? "-"}</div>
  </div>

  <div class="stat-card">
    <div class="stat-label">Actions Taken</div>
    <div class="stat-value">{$stats?.totals.actionsTaken.toLocaleString() ?? "-"}</div>
  </div>

  <div class="stat-card">
    <div class="stat-label">Errors</div>
    <div class="stat-value stat-errors">{$stats?.totals.errors.toLocaleString() ?? "-"}</div>
  </div>

  {#if $stats?.deadLetterCount !== undefined && $stats.deadLetterCount > 0}
    <div class="stat-card stat-warning">
      <div class="stat-label">Dead Letters</div>
      <div class="stat-value">{$stats.deadLetterCount}</div>
    </div>
  {/if}
</div>

<div class="charts-row">
  {#if $stats?.actionBreakdown && $stats.actionBreakdown.length > 0}
    <div class="chart-card">
      <h3>Actions by Type</h3>
      <div class="bar-chart">
        {#each $stats.actionBreakdown as action}
          <div class="bar-item">
            <div class="bar-label">{action.type}</div>
            <div class="bar-container">
              <div
                class="bar-fill"
                style="width: {(action.count / getMaxActionCount()) * 100}%; background: {getActionColor(action.type)}"
              ></div>
            </div>
            <div class="bar-value">{action.count.toLocaleString()}</div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if $stats?.providerStats && $stats.providerStats.length > 0}
    <div class="chart-card">
      <h3>LLM Providers</h3>
      <div class="provider-stats">
        {#each $stats.providerStats as provider}
          <div class="provider-item">
            <div class="provider-header">
              <span class="provider-name">
                <span
                  class="health-indicator"
                  class:healthy={provider.healthy}
                  class:stale={provider.healthStale}
                  title={provider.healthStale ? "Status unknown" : provider.healthy ? "Healthy" : "Unhealthy"}
                ></span>
                {provider.name}
              </span>
              <span class="provider-model">{provider.model}</span>
            </div>
            <div class="provider-metrics">
              <div class="metric">
                <span class="metric-value">{provider.requestsToday.toLocaleString()}</span>
                <span class="metric-label">Today</span>
              </div>
              <div class="metric">
                <span class="metric-value">{provider.requestsTotal.toLocaleString()}</span>
                <span class="metric-label">Total</span>
              </div>
              <div class="metric">
                <span class="metric-value" class:rate-limited={provider.rateLimited}>
                  {provider.requestsLastMinute}
                  {#if provider.rpmLimit}/ {provider.rpmLimit}{/if}
                </span>
                <span class="metric-label">RPM</span>
              </div>
            </div>
            {#if provider.rateLimited}
              <div class="rate-limit-warning">Rate limited</div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-card {
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    padding: 1.25rem;
  }

  .stat-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .stat-value {
    font-size: 1.75rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .stat-errors {
    color: var(--error);
  }

  .stat-warning {
    border: 1px solid var(--warning);
  }

  .stat-warning .stat-value {
    color: var(--warning);
  }

  .charts-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .chart-card {
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    padding: 1.25rem;
  }

  .chart-card h3 {
    margin: 0 0 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .bar-chart {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .bar-item {
    display: grid;
    grid-template-columns: 80px 1fr 60px;
    align-items: center;
    gap: 0.75rem;
  }

  .bar-label {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    text-transform: capitalize;
  }

  .bar-container {
    height: 1.25rem;
    background: var(--bg-tertiary);
    border-radius: 0.25rem;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 0.25rem;
    transition: width 0.3s ease;
  }

  .bar-value {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-primary);
    text-align: right;
  }

  .provider-stats {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .provider-item {
    padding: 0.75rem;
    background: var(--bg-tertiary);
    border-radius: 0.375rem;
  }

  .provider-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .provider-name {
    font-weight: 600;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .health-indicator {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--error);
    flex-shrink: 0;
  }

  .health-indicator.healthy {
    background: var(--success);
  }

  .health-indicator.stale {
    background: var(--text-secondary);
    opacity: 0.5;
  }

  .provider-model {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .provider-metrics {
    display: flex;
    gap: 1.5rem;
  }

  .metric {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .metric-value {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .metric-value.rate-limited {
    color: var(--warning);
  }

  .metric-label {
    font-size: 0.6875rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .rate-limit-warning {
    margin-top: 0.5rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.6875rem;
    font-weight: 500;
    text-transform: uppercase;
    color: var(--warning);
    background: color-mix(in srgb, var(--warning) 15%, transparent);
    border-radius: 0.25rem;
    display: inline-block;
  }
</style>
