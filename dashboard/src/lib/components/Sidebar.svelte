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
    <h3 class="panel-title">LLM Providers</h3>
    {#if !$stats?.providerStats || $stats.providerStats.length === 0}
      <p class="muted">No providers configured</p>
    {:else}
      <div class="providers-list">
        {#each $stats.providerStats as provider}
          <div class="provider-card">
            <div class="provider-header">
              <span class="provider-name">{provider.name}</span>
              {#if provider.rateLimited}
                <span class="badge badge-error">Rate Limited</span>
              {/if}
            </div>
            <div class="provider-model">{provider.model}</div>
            <div class="provider-stats">
              <div class="provider-stat">
                <span class="stat-label">Today:</span>
                <span class="stat-value">{provider.requestsToday}</span>
              </div>
              <div class="provider-stat">
                <span class="stat-label">Last min:</span>
                <span class="stat-value">
                  {provider.requestsLastMinute}{provider.rpmLimit ? `/${provider.rpmLimit}` : ""}
                </span>
              </div>
              <div class="provider-stat">
                <span class="stat-label">Total:</span>
                <span class="stat-value">{provider.requestsTotal.toLocaleString()}</span>
              </div>
            </div>
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

  .badge-error {
    background: #991b1b;
    color: #fecaca;
  }

  .providers-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .provider-card {
    background: var(--bg-primary);
    padding: 0.75rem;
    border-radius: 0.375rem;
  }

  .provider-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }

  .provider-name {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .provider-model {
    color: var(--text-muted);
    font-size: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .provider-stats {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .provider-stat {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
  }

  .stat-label {
    color: var(--text-secondary);
  }

  .stat-value {
    color: var(--text-primary);
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
</style>
