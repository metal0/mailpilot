<script lang="ts">
  import { stats } from "../stores/data";

  const actionColors: Record<string, string> = {
    move: "#3b82f6",
    flag: "#f59e0b",
    read: "#10b981",
    spam: "#ef4444",
    delete: "#dc2626",
    noop: "#6b7280",
  };

  function getActionColor(type: string): string {
    return actionColors[type.toLowerCase()] ?? "#6b7280";
  }

  function getTotalActions(): number {
    if (!$stats?.actionBreakdown?.length) return 0;
    return $stats.actionBreakdown.reduce((sum, a) => sum + a.count, 0);
  }

  function getPieSlices(): Array<{ type: string; color: string; percentage: number; offset: number }> {
    const total = getTotalActions();
    if (total === 0) return [];

    let offset = 0;
    return $stats!.actionBreakdown.map(action => {
      const percentage = (action.count / total) * 100;
      const slice = {
        type: action.type,
        color: getActionColor(action.type),
        percentage,
        offset,
      };
      offset += percentage;
      return slice;
    });
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
      <div class="pie-chart-container">
        <svg class="pie-chart" viewBox="0 0 42 42">
          <circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="var(--bg-tertiary)" stroke-width="6" />
          {#each getPieSlices() as slice}
            <circle
              cx="21"
              cy="21"
              r="15.9155"
              fill="transparent"
              stroke={slice.color}
              stroke-width="6"
              stroke-dasharray="{slice.percentage} {100 - slice.percentage}"
              stroke-dashoffset="{25 - slice.offset}"
              stroke-linecap="round"
            />
          {/each}
          <text x="21" y="21" class="pie-total" text-anchor="middle" dominant-baseline="central">
            {getTotalActions().toLocaleString()}
          </text>
        </svg>
        <div class="pie-legend">
          {#each $stats.actionBreakdown as item}
            <div class="legend-item">
              <span class="legend-dot" style="background: {getActionColor(item.type)}"></span>
              <span class="legend-label">{item.type}</span>
              <span class="legend-count">{item.count.toLocaleString()}</span>
            </div>
          {/each}
        </div>
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

  .pie-chart-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .pie-chart {
    width: 100px;
    height: 100px;
    transform: rotate(-90deg);
  }

  .pie-total {
    fill: var(--text-primary);
    font-size: 0.5rem;
    font-weight: 600;
    transform: rotate(90deg);
    transform-origin: center;
  }

  .pie-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    color: var(--text-secondary);
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .legend-label {
    text-transform: capitalize;
  }

  .legend-count {
    font-weight: 600;
    color: var(--text-primary);
  }

  .badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    background: var(--bg-tertiary);
    border-radius: 0.25rem;
    font-size: 0.75rem;
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
