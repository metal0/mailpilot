<script lang="ts">
  import { stats } from "../stores/data";
  import { t } from "../i18n";

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

<div class="chart-card">
  <h3>{$t("chart.actionBreakdown")}</h3>
  {#if $stats?.actionBreakdown && $stats.actionBreakdown.length > 0}
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
  {:else}
    <div class="empty-state">
      <p>{$t("chart.noData")}</p>
    </div>
  {/if}
</div>

<style>
  .chart-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
  }

  .chart-card h3 {
    margin: 0 0 var(--space-3);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .pie-chart-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
  }

  .pie-chart {
    width: 120px;
    height: 120px;
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
    gap: var(--space-2);
    justify-content: center;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-xs);
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

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    text-align: center;
  }

  .empty-state p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
</style>
