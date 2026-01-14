<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { connectionState } from "../stores/websocket";
  import { stats, serviceStatus } from "../stores/data";
  import { t } from "../i18n";
  import * as api from "../api";
  import type { HealthCheckResult } from "../api";

  interface ServerInfo {
    uptime: number;
    nodeVersion: string;
    platform: string;
    memory: { used: number; total: number };
    configPath: string;
  }

  interface ImapServer {
    host: string;
    port: number;
    accounts: Array<{
      name: string;
      connected: boolean;
      idleSupported: boolean;
      errors: number;
      paused: boolean;
    }>;
  }

  let serverInfo = $state<ServerInfo | null>(null);
  let dnsCheck = $state<{ status: "pending" | "success" | "error"; latency?: number; error?: string }>({ status: "pending" });
  let apiCheck = $state<{ status: "pending" | "success" | "error"; latency?: number; error?: string }>({ status: "pending" });
  let healthCheck = $state<HealthCheckResult | null>(null);
  let llmCheckLoading = $state(false);
  let llmTestingProvider = $state<string | null>(null);
  let refreshInterval: ReturnType<typeof setInterval> | null = null;

  // Group accounts by IMAP server
  const imapServers = $derived.by(() => {
    const accounts = $stats?.accounts ?? [];
    const serverMap = new Map<string, ImapServer>();

    for (const account of accounts) {
      const key = `${account.imapHost}:${account.imapPort}`;
      let server = serverMap.get(key);
      if (!server) {
        server = {
          host: account.imapHost,
          port: account.imapPort,
          accounts: [],
        };
        serverMap.set(key, server);
      }
      server.accounts.push({
        name: account.name,
        connected: account.connected,
        idleSupported: account.idleSupported,
        errors: account.errors,
        paused: account.paused,
      });
    }

    return Array.from(serverMap.values());
  });

  onMount(async () => {
    await runChecks();
    refreshInterval = setInterval(runChecks, 30000);
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  async function runChecks() {
    await Promise.all([
      checkDns(),
      checkApi(),
      loadServerInfo(),
      loadHealthCheck(),
    ]);
  }

  async function loadHealthCheck(checkLlm = false) {
    try {
      if (checkLlm) llmCheckLoading = true;
      healthCheck = await api.fetchHealthCheck(checkLlm);
    } catch {
      // Health check endpoint may fail
    } finally {
      llmCheckLoading = false;
    }
  }

  async function runLlmCheck() {
    await loadHealthCheck(true);
  }

  async function testSingleProvider(providerName: string) {
    llmTestingProvider = providerName;
    try {
      const result = await api.fetchHealthCheck(true);
      healthCheck = result;
    } catch {
      // Error handling
    } finally {
      llmTestingProvider = null;
    }
  }

  async function checkDns() {
    dnsCheck = { status: "pending" };
    const start = performance.now();
    try {
      await fetch("https://dns.google/resolve?name=example.com&type=A", { mode: "cors" });
      dnsCheck = { status: "success", latency: Math.round(performance.now() - start) };
    } catch (e) {
      dnsCheck = { status: "error", error: e instanceof Error ? e.message : "DNS check failed" };
    }
  }

  async function checkApi() {
    apiCheck = { status: "pending" };
    const start = performance.now();
    try {
      await api.fetchStats();
      apiCheck = { status: "success", latency: Math.round(performance.now() - start) };
    } catch (e) {
      apiCheck = { status: "error", error: e instanceof Error ? e.message : "API check failed" };
    }
  }

  async function loadServerInfo() {
    try {
      const response = await fetch("/api/debug");
      if (response.ok) {
        serverInfo = await response.json();
      }
    } catch {
      // Server info endpoint may not exist
    }
  }

  function formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let index = 0;
    let value = bytes;
    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index++;
    }
    return `${value.toFixed(1)} ${units[index]}`;
  }

  function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(" ");
  }
</script>

<div class="debug">
  <h2>{$t("debug.title")}</h2>

  <div class="debug-grid">
    <section class="debug-section">
      <h3>{$t("common.status")}</h3>
      <div class="debug-items">
        <div class="debug-item">
          <span class="debug-label">WebSocket</span>
          <span class="debug-value status-{$connectionState}">
            <span class="status-dot"></span>
            {$connectionState}
          </span>
        </div>
        <div class="debug-item">
          <span class="debug-label">DNS Check</span>
          <span class="debug-value status-{dnsCheck.status}">
            {#if dnsCheck.status === "pending"}
              Checking...
            {:else if dnsCheck.status === "success"}
              OK ({dnsCheck.latency}ms)
            {:else}
              Failed: {dnsCheck.error}
            {/if}
          </span>
        </div>
        <div class="debug-item">
          <span class="debug-label">API Check</span>
          <span class="debug-value status-{apiCheck.status}">
            {#if apiCheck.status === "pending"}
              Checking...
            {:else if apiCheck.status === "success"}
              OK ({apiCheck.latency}ms)
            {:else}
              Failed: {apiCheck.error}
            {/if}
          </span>
        </div>
      </div>
    </section>

    <section class="debug-section">
      <h3>Server Status</h3>
      <div class="debug-items">
        <div class="debug-item">
          <span class="debug-label">Uptime</span>
          <span class="debug-value">{$stats ? formatUptime($stats.uptime) : "-"}</span>
        </div>
        <div class="debug-item">
          <span class="debug-label">Accounts</span>
          <span class="debug-value">{$stats?.accounts.length ?? 0}</span>
        </div>
        <div class="debug-item">
          <span class="debug-label">Connected Accounts</span>
          <span class="debug-value">{$stats?.accounts.filter(a => a.connected).length ?? 0}</span>
        </div>
        <div class="debug-item">
          <span class="debug-label">Dry Run Mode</span>
          <span class="debug-value" class:warning={$stats?.dryRun}>
            {$stats?.dryRun ? "Enabled" : "Disabled"}
          </span>
        </div>
        <div class="debug-item">
          <span class="debug-label">Dead Letter Queue</span>
          <span class="debug-value" class:warning={($stats?.deadLetterCount ?? 0) > 0}>
            {$stats?.deadLetterCount ?? 0}
          </span>
        </div>
      </div>
    </section>

    <section class="debug-section">
      <h3>Service Health</h3>
      <div class="debug-items">
        <div class="debug-item">
          <span class="debug-label">Tika (Attachments)</span>
          <span class="debug-value">
            {#if $serviceStatus?.tika?.enabled}
              <span class="status-badge" class:healthy={$serviceStatus.tika.healthy}>
                {$serviceStatus.tika.healthy ? "Connected" : "Unreachable"}
              </span>
              <span class="debug-meta">{$serviceStatus.tika.url}</span>
            {:else}
              <span class="status-badge disabled">Disabled</span>
            {/if}
          </span>
        </div>
        <div class="debug-item">
          <span class="debug-label">ClamAV (Antivirus)</span>
          <span class="debug-value">
            {#if $serviceStatus?.clamav?.enabled}
              <span class="status-badge" class:healthy={$serviceStatus.clamav.healthy}>
                {$serviceStatus.clamav.healthy ? "Connected" : "Unreachable"}
              </span>
              <span class="debug-meta">{$serviceStatus.clamav.url}</span>
            {:else}
              <span class="status-badge disabled">Disabled</span>
            {/if}
          </span>
        </div>
      </div>
    </section>

    <section class="debug-section">
      <h3>
        LLM Providers
        <button class="btn-small" onclick={runLlmCheck} disabled={llmCheckLoading || llmTestingProvider !== null}>
          {llmCheckLoading ? "Testing..." : "Test All"}
        </button>
      </h3>
      <div class="debug-items">
        {#if $stats?.providerStats && $stats.providerStats.length > 0}
          {#each $stats.providerStats as provider}
            {@const testResult = healthCheck?.llmProviders?.find(p => p.name === provider.name)}
            {@const isTesting = llmTestingProvider === provider.name || llmCheckLoading}
            <div class="debug-item">
              <button
                class="provider-test-btn"
                onclick={() => testSingleProvider(provider.name)}
                disabled={isTesting}
                title="Click to test this provider"
              >
                {provider.name}
                {#if isTesting}
                  <span class="testing-spinner"></span>
                {/if}
              </button>
              <span class="debug-value">
                {#if isTesting}
                  <span class="status-badge testing">Testing...</span>
                {:else if testResult !== undefined}
                  <span class="status-badge" class:healthy={testResult.healthy}>
                    {testResult.healthy ? "Connected" : "Unreachable"}
                  </span>
                {:else}
                  <span class="status-badge" class:healthy={provider.healthy} class:stale={provider.healthStale}>
                    {provider.healthStale ? "Unknown" : provider.healthy ? "Healthy" : "Unhealthy"}
                  </span>
                {/if}
                <span class="debug-meta">{provider.model}</span>
              </span>
            </div>
          {/each}
        {:else}
          <div class="debug-item">
            <span class="debug-label">No providers configured</span>
          </div>
        {/if}
      </div>
    </section>

    <section class="debug-section">
      <h3>IMAP Servers</h3>
      <div class="debug-items">
        {#if imapServers.length > 0}
          {#each imapServers as server}
            {@const allConnected = server.accounts.every(a => a.connected)}
            {@const someConnected = server.accounts.some(a => a.connected)}
            {@const totalErrors = server.accounts.reduce((sum, a) => sum + a.errors, 0)}
            <div class="debug-item server-item">
              <div class="server-header">
                <span class="debug-label">{server.host}:{server.port}</span>
                <span class="debug-value">
                  <span class="status-badge" class:healthy={allConnected} class:partial={!allConnected && someConnected}>
                    {allConnected ? "Connected" : someConnected ? "Partial" : "Disconnected"}
                  </span>
                  {#if totalErrors > 0}
                    <span class="badge-errors">{totalErrors} errors</span>
                  {/if}
                </span>
              </div>
              <div class="server-accounts">
                {#each server.accounts as account}
                  <div class="account-row">
                    <span class="account-name">
                      <span class="status-dot" class:connected={account.connected} class:paused={account.paused}></span>
                      {account.name}
                    </span>
                    <span class="account-badges">
                      {#if account.paused}
                        <span class="badge-paused">Paused</span>
                      {/if}
                      {#if account.idleSupported}
                        <span class="badge-idle">IDLE</span>
                      {/if}
                    </span>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        {:else}
          <div class="debug-item">
            <span class="debug-label">No IMAP servers configured</span>
          </div>
        {/if}
      </div>
    </section>

    <section class="debug-section">
      <h3>Processing Statistics</h3>
      <div class="debug-items">
        <div class="debug-item">
          <span class="debug-label">Emails Processed</span>
          <span class="debug-value">{($stats?.totals.emailsProcessed ?? 0).toLocaleString()}</span>
        </div>
        <div class="debug-item">
          <span class="debug-label">Actions Taken</span>
          <span class="debug-value">{($stats?.totals.actionsTaken ?? 0).toLocaleString()}</span>
        </div>
        <div class="debug-item">
          <span class="debug-label">Errors</span>
          <span class="debug-value" class:error={($stats?.totals.errors ?? 0) > 0}>
            {$stats?.totals.errors ?? 0}
          </span>
        </div>
      </div>
    </section>
  </div>

  <div class="debug-actions">
    <button class="btn btn-secondary" onclick={runChecks}>
      Refresh Checks
    </button>
  </div>
</div>

<style>
  .debug {
    padding: 1rem;
  }

  .debug h2 {
    margin: 0 0 1.5rem;
    font-size: 1.5rem;
  }

  .debug-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
  }

  .debug-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .debug-section h3 {
    margin: 0 0 1rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .debug-items {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .debug-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.375rem 0;
    border-bottom: 1px solid var(--border-color);
  }

  .debug-item:last-child {
    border-bottom: none;
  }

  .debug-label {
    color: var(--text-secondary);
    font-size: 0.8125rem;
  }

  .debug-value {
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .debug-value.success {
    color: var(--success);
  }

  .debug-value.error {
    color: var(--error);
  }

  .debug-value.warning {
    color: var(--warning);
  }

  .debug-meta {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .status-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
  }

  .status-connected .status-dot {
    background: var(--success);
  }

  .status-connecting .status-dot,
  .status-pending .status-dot {
    background: var(--warning);
  }

  .status-disconnected .status-dot,
  .status-error .status-dot {
    background: var(--error);
  }

  .status-success {
    color: var(--success);
  }

  .status-error {
    color: var(--error);
  }

  .status-badge {
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    background: color-mix(in srgb, var(--error) 15%, transparent);
    color: var(--error);
  }

  .status-badge.healthy {
    background: color-mix(in srgb, var(--success) 15%, transparent);
    color: var(--success);
  }

  .status-badge.disabled {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }

  .status-badge.pending {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }

  .badge-idle {
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.625rem;
    font-weight: 600;
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent);
    text-transform: uppercase;
  }

  .badge-errors {
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.625rem;
    font-weight: 500;
    background: color-mix(in srgb, var(--error) 15%, transparent);
    color: var(--error);
  }

  .btn-small {
    padding: 0.25rem 0.5rem;
    font-size: 0.6875rem;
    font-weight: 500;
    border: 1px solid var(--border-color);
    border-radius: 0.25rem;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    cursor: pointer;
    margin-left: 0.5rem;
    transition: background 0.2s;
  }

  .btn-small:hover:not(:disabled) {
    background: var(--border-color);
  }

  .btn-small:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .debug-section h3 {
    display: flex;
    align-items: center;
  }

  .provider-test-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 0.8125rem;
    padding: 0.25rem 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: color 0.2s;
  }

  .provider-test-btn:hover:not(:disabled) {
    color: var(--accent);
  }

  .provider-test-btn:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .testing-spinner {
    width: 0.75rem;
    height: 0.75rem;
    border: 2px solid var(--border-color);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .status-badge.testing {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent);
  }

  .status-badge.stale {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }

  .status-badge.partial {
    background: color-mix(in srgb, var(--warning) 15%, transparent);
    color: var(--warning);
  }

  .server-item {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }

  .server-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .server-accounts {
    padding-left: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .account-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .account-name {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .account-badges {
    display: flex;
    gap: 0.25rem;
  }

  .status-dot {
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 50%;
    background: var(--error);
    flex-shrink: 0;
  }

  .status-dot.connected {
    background: var(--success);
  }

  .status-dot.paused {
    background: var(--warning);
  }

  .badge-paused {
    padding: 0.0625rem 0.25rem;
    border-radius: 0.125rem;
    font-size: 0.5625rem;
    font-weight: 500;
    background: color-mix(in srgb, var(--warning) 15%, transparent);
    color: var(--warning);
    text-transform: uppercase;
  }

  .debug-actions {
    margin-top: 1.5rem;
    display: flex;
    gap: 0.75rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn-secondary:hover {
    background: var(--border-color);
  }

  @media (max-width: 768px) {
    .debug-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
