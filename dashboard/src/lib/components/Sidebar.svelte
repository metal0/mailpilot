<script lang="ts">
  import { stats, serviceStatus } from "../stores/data";
  import { t } from "../i18n";
</script>

<div class="sidebar">
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
