<script lang="ts">
  import { stats } from "../stores/data";

  function getActionBadgeClass(type: string): string {
    const classes: Record<string, string> = {
      move: "badge-move",
      flag: "badge-flag",
      read: "badge-read",
      delete: "badge-delete",
      spam: "badge-delete",
      noop: "badge-noop",
    };
    return classes[type] ?? "";
  }
</script>

<div class="sidebar">
  <div class="panel">
    <h3 class="panel-title">LLM Providers</h3>
    {#if !$stats?.providerStats || $stats.providerStats.length === 0}
      <p class="muted">No providers configured</p>
    {:else}
      <div class="provider-list">
        {#each $stats.providerStats as provider}
          <div class="provider-card">
            <div class="provider-header">
              <span class="provider-name">
                <span class="health-indicator {provider.healthStale ? 'stale' : provider.healthy ? 'healthy' : 'unhealthy'}" title={provider.healthStale ? 'Unknown' : provider.healthy ? 'Healthy' : 'Unhealthy'}></span>
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
                  {provider.requestsLastMinute}{#if provider.rpmLimit}/{provider.rpmLimit}{/if}
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
    {/if}
  </div>

  <div class="panel">
    <h3 class="panel-title">Action Breakdown</h3>
    {#if !$stats?.actionBreakdown || $stats.actionBreakdown.length === 0}
      <p class="muted">No actions yet</p>
    {:else}
      <div class="breakdown-list">
        {#each $stats.actionBreakdown as item}
          <div class="breakdown-item">
            <span class="badge {getActionBadgeClass(item.type)}">{item.type}</span>
            <span class="breakdown-count">{item.count.toLocaleString()}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="panel">
    <h3 class="panel-title">Processing Queue</h3>
    {#if !$stats?.queueStatus || $stats.queueStatus.length === 0}
      <p class="muted">No active processing</p>
    {:else}
      <div class="queue-list">
        {#each $stats.queueStatus as item}
          <div class="queue-item">
            <span class="queue-name">{item.accountName}:{item.folder}</span>
            <span class="badge">Processing {item.pendingCount}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .panel {
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    padding: 1.25rem;
  }

  .panel-title {
    font-size: 0.875rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
    color: var(--text-secondary);
  }

  .muted {
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  .breakdown-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .breakdown-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color);
  }

  .breakdown-item:last-child {
    border-bottom: none;
  }

  .breakdown-count {
    font-weight: 500;
    color: var(--text-secondary);
  }

  .badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    background: var(--bg-tertiary);
    border-radius: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .badge-move {
    background: #1e3a5f;
    color: #60a5fa;
  }

  .badge-flag {
    background: #3f2f1d;
    color: #fbbf24;
  }

  .badge-read {
    background: #1a3329;
    color: #4ade80;
  }

  .badge-delete {
    background: #3b1c1c;
    color: #f87171;
  }

  .badge-noop {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }

  .queue-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .queue-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color);
  }

  .queue-item:last-child {
    border-bottom: none;
  }

  .queue-name {
    font-size: 0.875rem;
  }

  .provider-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .provider-card {
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
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .provider-model {
    font-size: 0.6875rem;
    color: var(--text-secondary);
  }

  .provider-metrics {
    display: flex;
    gap: 1rem;
  }

  .metric {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .metric-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .metric-value.rate-limited {
    color: var(--warning);
  }

  .metric-label {
    font-size: 0.625rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .rate-limit-warning {
    margin-top: 0.5rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.625rem;
    font-weight: 500;
    text-transform: uppercase;
    color: var(--warning);
    background: color-mix(in srgb, var(--warning) 15%, transparent);
    border-radius: 0.25rem;
    display: inline-block;
  }

  .health-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .health-indicator.healthy {
    background: #4ade80;
    box-shadow: 0 0 4px #4ade80;
  }

  .health-indicator.unhealthy {
    background: #f87171;
    box-shadow: 0 0 4px #f87171;
  }

  .health-indicator.stale {
    background: #94a3b8;
  }
</style>
