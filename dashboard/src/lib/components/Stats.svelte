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
</style>
