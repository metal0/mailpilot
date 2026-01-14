<script lang="ts">
  import { stats, deadLetters, serviceStatus } from "../stores/data";
  import { navigateTo } from "../stores/navigation";
  import { t } from "../i18n";
  import * as api from "../api";
  import { addToast } from "../stores/toast";

  let quickActionLoading = $state(false);

  function getRecentDeadLetters(): typeof $deadLetters {
    return $deadLetters.slice(0, 3);
  }

  function formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffMins < 1) return $t("time.justNow");
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function formatUtcTooltip(timestamp: number): string {
    return new Date(timestamp).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
  }

  async function processAllNow() {
    quickActionLoading = true;
    try {
      const accounts = $stats?.accounts ?? [];
      let succeeded = 0;
      for (const account of accounts) {
        if (account.connected && !account.paused) {
          try {
            await api.triggerProcess(account.name);
            succeeded++;
          } catch { /* continue */ }
        }
      }
      addToast(`Triggered processing for ${succeeded} accounts`, "success");
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed", "error");
    }
    quickActionLoading = false;
  }

  async function reconnectAll() {
    quickActionLoading = true;
    try {
      const disconnected = $stats?.accounts.filter(a => !a.connected && !a.paused) ?? [];
      let succeeded = 0;
      for (const account of disconnected) {
        try {
          await api.reconnectAccount(account.name);
          succeeded++;
        } catch { /* continue */ }
      }
      addToast(`Reconnected ${succeeded}/${disconnected.length} accounts`, "success");
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed", "error");
    }
    quickActionLoading = false;
  }

  async function pauseAll() {
    quickActionLoading = true;
    try {
      const active = $stats?.accounts.filter(a => a.connected && !a.paused) ?? [];
      let succeeded = 0;
      for (const account of active) {
        try {
          await api.pauseAccount(account.name);
          succeeded++;
        } catch { /* continue */ }
      }
      addToast(`Paused ${succeeded}/${active.length} accounts`, "success");
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed", "error");
    }
    quickActionLoading = false;
  }

  async function resumeAll() {
    quickActionLoading = true;
    try {
      const paused = $stats?.accounts.filter(a => a.paused) ?? [];
      let succeeded = 0;
      for (const account of paused) {
        try {
          await api.resumeAccount(account.name);
          succeeded++;
        } catch { /* continue */ }
      }
      addToast(`Resumed ${succeeded}/${paused.length} accounts`, "success");
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed", "error");
    }
    quickActionLoading = false;
  }

  function goToDeadLetters() {
    navigateTo("activity", { activityFilter: "errors" });
  }
</script>

<div class="sidebar">
  <!-- Quick Actions Panel -->
  <div class="panel">
    <h3 class="panel-title">{$t("sidebar.quickActions") ?? "Quick Actions"}</h3>
    <div class="quick-actions">
      <button class="action-button" onclick={processAllNow} disabled={quickActionLoading}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <span>Process All</span>
      </button>
      <button class="action-button" onclick={reconnectAll} disabled={quickActionLoading}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"/>
          <polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        <span>Reconnect All</span>
      </button>
      <button class="action-button" onclick={pauseAll} disabled={quickActionLoading}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="6" y="4" width="4" height="16"/>
          <rect x="14" y="4" width="4" height="16"/>
        </svg>
        <span>Pause All</span>
      </button>
      <button class="action-button" onclick={resumeAll} disabled={quickActionLoading}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <span>Resume All</span>
      </button>
    </div>
  </div>

  <!-- Services Status Panel -->
  {#if $serviceStatus}
    <div class="panel">
      <h3 class="panel-title">{$t("sidebar.services") ?? "Services"}</h3>
      <div class="services-list">
        <div class="service-item">
          <span class="service-indicator" class:healthy={$serviceStatus.tika.healthy} class:disabled={!$serviceStatus.tika.enabled}></span>
          <span class="service-name">Tika</span>
          <span class="service-status">
            {#if !$serviceStatus.tika.enabled}
              Disabled
            {:else if $serviceStatus.tika.healthy}
              Healthy
            {:else}
              Unhealthy
            {/if}
          </span>
        </div>
        <div class="service-item">
          <span class="service-indicator" class:healthy={$serviceStatus.clamav.healthy} class:disabled={!$serviceStatus.clamav.enabled}></span>
          <span class="service-name">ClamAV</span>
          <span class="service-status">
            {#if !$serviceStatus.clamav.enabled}
              Disabled
            {:else if $serviceStatus.clamav.healthy}
              Healthy
            {:else}
              Unhealthy
            {/if}
          </span>
        </div>
      </div>
    </div>
  {/if}

  <!-- LLM Providers Panel -->
  <div class="panel">
    <h3 class="panel-title">{$t("sidebar.llmProviders")}</h3>
    {#if !$stats?.providerStats || $stats.providerStats.length === 0}
      <p class="muted">{$t("accounts.noAccounts")}</p>
    {:else}
      <div class="provider-list">
        {#each $stats.providerStats as provider}
          <div class="provider-card">
            <div class="provider-header">
              <span class="provider-name">
                <span class="health-indicator {provider.healthStale ? 'stale' : provider.healthy ? 'healthy' : 'unhealthy'}" title={provider.healthStale ? $t("health.unknown") : provider.healthy ? $t("sidebar.healthy") : $t("sidebar.unhealthy")}></span>
                {provider.name}
              </span>
              <span class="provider-model">{provider.model}</span>
            </div>
            <div class="provider-metrics">
              <div class="metric">
                <span class="metric-value">{provider.requestsToday.toLocaleString()}</span>
                <span class="metric-label">{$t("common.today")}</span>
              </div>
              <div class="metric">
                <span class="metric-value">{provider.requestsTotal.toLocaleString()}</span>
                <span class="metric-label">{$t("common.total")}</span>
              </div>
              <div class="metric">
                <span class="metric-value" class:rate-limited={provider.rateLimited}>
                  {provider.requestsLastMinute}{#if provider.rpmLimit}/{provider.rpmLimit}{/if}
                </span>
                <span class="metric-label">{$t("sidebar.requestsPerMin")}</span>
              </div>
            </div>
            {#if provider.rateLimited}
              <div class="rate-limit-warning">{$t("sidebar.rateLimited")}</div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Recent Errors Panel -->
  {#if $deadLetters.length > 0}
    <div class="panel panel-warning">
      <h3 class="panel-title">{$t("sidebar.recentErrors") ?? "Recent Errors"}</h3>
      <div class="error-list">
        {#each getRecentDeadLetters() as item}
          <div class="error-item">
            <div class="error-header">
              <span class="error-account">{item.accountName}</span>
              <span class="error-time" title={formatUtcTooltip(item.createdAt)}>{formatTimeAgo(item.createdAt)}</span>
            </div>
            <div class="error-message">{item.error}</div>
          </div>
        {/each}
        {#if $deadLetters.length > 3}
          <button class="error-more-link" onclick={goToDeadLetters}>{$deadLetters.length - 3} more in Activity tab</button>
        {/if}
      </div>
    </div>
  {/if}

</div>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .panel {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
  }

  .panel-warning {
    border-color: color-mix(in srgb, var(--warning) 30%, transparent);
  }

  .panel-title {
    font-size: var(--text-xs);
    font-weight: 600;
    margin: 0 0 var(--space-3) 0;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .muted {
    color: var(--text-muted);
    font-size: var(--text-sm);
  }

  /* Quick Actions */
  .quick-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .action-button {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .action-button:hover:not(:disabled) {
    background: var(--border-color);
    border-color: var(--border-subtle);
  }

  .action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-button svg {
    width: 16px;
    height: 16px;
    color: var(--text-secondary);
  }

  /* Services */
  .services-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .service-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }

  .service-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--error);
    flex-shrink: 0;
  }

  .service-indicator.healthy {
    background: var(--success);
    box-shadow: 0 0 4px var(--success);
  }

  .service-indicator.disabled {
    background: var(--text-muted);
  }

  .service-name {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-primary);
    flex: 1;
  }

  .service-status {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  /* Errors */
  .error-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .error-item {
    padding: var(--space-2);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }

  .error-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-1);
  }

  .error-account {
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--text-primary);
  }

  .error-time {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .error-message {
    font-size: var(--text-xs);
    color: var(--warning);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .error-more-link {
    font-size: var(--text-xs);
    color: var(--accent);
    text-align: center;
    padding: var(--space-2);
    background: none;
    border: none;
    cursor: pointer;
    width: 100%;
    transition: color var(--transition-fast);
  }

  .error-more-link:hover {
    color: var(--accent-hover);
    text-decoration: underline;
  }

  .badge {
    display: inline-block;
    padding: var(--space-1) var(--space-2);
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  /* Providers */
  .provider-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .provider-card {
    padding: var(--space-3);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }

  .provider-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-2);
  }

  .provider-name {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .provider-model {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .provider-metrics {
    display: flex;
    gap: var(--space-4);
  }

  .metric {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .metric-value {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
  }

  .metric-value.rate-limited {
    color: var(--warning);
  }

  .metric-label {
    font-size: 0.625rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .rate-limit-warning {
    margin-top: var(--space-2);
    padding: var(--space-1) var(--space-2);
    font-size: 0.625rem;
    font-weight: 500;
    text-transform: uppercase;
    color: var(--warning);
    background: var(--warning-muted);
    border-radius: var(--radius-sm);
    display: inline-block;
  }

  .health-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .health-indicator.healthy {
    background: var(--success);
    box-shadow: 0 0 4px var(--success);
  }

  .health-indicator.unhealthy {
    background: var(--error);
    box-shadow: 0 0 4px var(--error);
  }

  .health-indicator.stale {
    background: var(--text-muted);
  }
</style>
