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

  function getMaxActionCount(): number {
    if (!$stats?.actionBreakdown?.length) return 1;
    return Math.max(...$stats.actionBreakdown.map(a => a.count), 1);
  }
</script>

<div class="chart-card">
  <h3>Actions by Type</h3>
  {#if $stats?.actionBreakdown && $stats.actionBreakdown.length > 0}
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
  {:else}
    <div class="empty-state">
      <p>No actions recorded yet</p>
      <span>Process emails to see action breakdown</span>
    </div>
  {/if}
</div>

<style>
  .chart-card {
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-top: 1rem;
  }

  .chart-card h3 {
    margin: 0 0 0.75rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .bar-chart {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .bar-item {
    display: grid;
    grid-template-columns: 60px 1fr 50px;
    align-items: center;
    gap: 0.5rem;
  }

  .bar-label {
    font-size: 0.6875rem;
    color: var(--text-secondary);
    text-transform: capitalize;
  }

  .bar-container {
    height: 0.875rem;
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
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--text-primary);
    text-align: right;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    text-align: center;
  }

  .empty-state p {
    margin: 0 0 0.25rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .empty-state span {
    font-size: 0.625rem;
    color: var(--text-muted);
  }
</style>
