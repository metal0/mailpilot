<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { connectionState } from "../stores/websocket";
  import { stats, serviceStatus } from "../stores/data";
  import * as api from "../api";
  import type { HealthCheckResult } from "../api";

  interface BrowserInfo {
    userAgent: string;
    platform: string;
    language: string;
    languages: string[];
    screenWidth: number;
    screenHeight: number;
    windowWidth: number;
    windowHeight: number;
    devicePixelRatio: number;
    cookiesEnabled: boolean;
    onLine: boolean;
    timezone: string;
  }

  interface ServerInfo {
    uptime: number;
    nodeVersion: string;
    platform: string;
    memory: { used: number; total: number };
    configPath: string;
  }

  let browserInfo = $state<BrowserInfo | null>(null);
  let serverInfo = $state<ServerInfo | null>(null);
  let dnsCheck = $state<{ status: "pending" | "success" | "error"; latency?: number; error?: string }>({ status: "pending" });
  let apiCheck = $state<{ status: "pending" | "success" | "error"; latency?: number; error?: string }>({ status: "pending" });
  let healthCheck = $state<HealthCheckResult | null>(null);
  let llmCheckLoading = $state(false);
  let refreshInterval: ReturnType<typeof setInterval> | null = null;

  onMount(async () => {
    collectBrowserInfo();
    await runChecks();
    refreshInterval = setInterval(runChecks, 30000);
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  function collectBrowserInfo() {
    browserInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      languages: [...navigator.languages],
      screenWidth: screen.width,
      screenHeight: screen.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      cookiesEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

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
  <h2>Debug & Troubleshooting</h2>

  <div class="debug-grid">
    <section class="debug-section">
      <h3>Connection Status</h3>
      <div class="debug-items">
        <div class="debug-item">
          <span class="debug-label">WebSocket</span>
          <span class="debug-value status-{$connectionState}">
            <span class="status-dot"></span>
            {$connectionState}
          </span>
        </div>
        <div class="debug-item">
          <span class="debug-label">Browser Online</span>
          <span class="debug-value" class:success={browserInfo?.onLine} class:error={!browserInfo?.onLine}>
            {browserInfo?.onLine ? "Yes" : "No"}
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
        <button class="btn-small" onclick={runLlmCheck} disabled={llmCheckLoading}>
          {llmCheckLoading ? "Testing..." : "Test All"}
        </button>
      </h3>
      <div class="debug-items">
        {#if healthCheck?.llmProviders && healthCheck.llmProviders.length > 0}
          {#each healthCheck.llmProviders as provider}
            <div class="debug-item">
              <span class="debug-label">{provider.name}</span>
              <span class="debug-value">
                <span class="status-badge" class:healthy={provider.healthy}>
                  {provider.healthy ? "Connected" : "Unreachable"}
                </span>
                <span class="debug-meta">{provider.model}</span>
              </span>
            </div>
          {/each}
        {:else if healthCheck?.llmProviders?.length === 0}
          <div class="debug-item">
            <span class="debug-label">No providers tested</span>
            <span class="debug-value">
              <span class="debug-meta">Click "Test All" to check LLM connectivity</span>
            </span>
          </div>
        {:else if $stats?.providerStats}
          {#each $stats.providerStats as provider}
            <div class="debug-item">
              <span class="debug-label">{provider.name}</span>
              <span class="debug-value">
                <span class="status-badge pending">Not tested</span>
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
      <h3>IMAP Accounts</h3>
      <div class="debug-items">
        {#if healthCheck?.imapAccounts && healthCheck.imapAccounts.length > 0}
          {#each healthCheck.imapAccounts as account}
            <div class="debug-item">
              <span class="debug-label">{account.name}</span>
              <span class="debug-value">
                <span class="status-badge" class:healthy={account.connected}>
                  {account.connected ? "Connected" : "Disconnected"}
                </span>
                {#if account.idleSupported}
                  <span class="badge-idle">IDLE</span>
                {/if}
                {#if account.errors > 0}
                  <span class="badge-errors">{account.errors} errors</span>
                {/if}
              </span>
            </div>
          {/each}
        {:else if $stats?.accounts && $stats.accounts.length > 0}
          {#each $stats.accounts as account}
            <div class="debug-item">
              <span class="debug-label">{account.name}</span>
              <span class="debug-value">
                <span class="status-badge" class:healthy={account.connected}>
                  {account.connected ? "Connected" : "Disconnected"}
                </span>
                {#if account.idleSupported}
                  <span class="badge-idle">IDLE</span>
                {/if}
                {#if account.errors > 0}
                  <span class="badge-errors">{account.errors} errors</span>
                {/if}
              </span>
            </div>
          {/each}
        {:else}
          <div class="debug-item">
            <span class="debug-label">No accounts configured</span>
          </div>
        {/if}
      </div>
    </section>

    <section class="debug-section">
      <h3>Browser Information</h3>
      <div class="debug-items">
        <div class="debug-item">
          <span class="debug-label">Platform</span>
          <span class="debug-value">{browserInfo?.platform ?? "-"}</span>
        </div>
        <div class="debug-item">
          <span class="debug-label">Language</span>
          <span class="debug-value">{browserInfo?.language ?? "-"}</span>
        </div>
        <div class="debug-item">
          <span class="debug-label">Timezone</span>
          <span class="debug-value">{browserInfo?.timezone ?? "-"}</span>
        </div>
        <div class="debug-item">
          <span class="debug-label">Screen Size</span>
          <span class="debug-value">{browserInfo ? `${browserInfo.screenWidth}x${browserInfo.screenHeight}` : "-"}</span>
        </div>
        <div class="debug-item">
          <span class="debug-label">Window Size</span>
          <span class="debug-value">{browserInfo ? `${browserInfo.windowWidth}x${browserInfo.windowHeight}` : "-"}</span>
        </div>
        <div class="debug-item">
          <span class="debug-label">Pixel Ratio</span>
          <span class="debug-value">{browserInfo?.devicePixelRatio ?? "-"}x</span>
        </div>
        <div class="debug-item">
          <span class="debug-label">Cookies Enabled</span>
          <span class="debug-value">{browserInfo?.cookiesEnabled ? "Yes" : "No"}</span>
        </div>
      </div>
    </section>

    <section class="debug-section full-width">
      <h3>User Agent</h3>
      <pre class="user-agent">{browserInfo?.userAgent ?? "-"}</pre>
    </section>

    <section class="debug-section full-width">
      <h3>Processing Statistics</h3>
      <div class="debug-items stats-grid">
        <div class="debug-item">
          <span class="debug-label">Emails Processed</span>
          <span class="debug-value large">{$stats?.totals.emailsProcessed ?? 0}</span>
        </div>
        <div class="debug-item">
          <span class="debug-label">Actions Taken</span>
          <span class="debug-value large">{$stats?.totals.actionsTaken ?? 0}</span>
        </div>
        <div class="debug-item">
          <span class="debug-label">Errors</span>
          <span class="debug-value large" class:error={($stats?.totals.errors ?? 0) > 0}>
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

  .debug-section.full-width {
    grid-column: 1 / -1;
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

  .debug-items.stats-grid {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 2rem;
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

  .stats-grid .debug-item {
    flex-direction: column;
    align-items: flex-start;
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

  .debug-value.large {
    font-size: 1.5rem;
    font-weight: 600;
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

  .user-agent {
    background: var(--bg-tertiary);
    padding: 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    word-break: break-all;
    white-space: pre-wrap;
    margin: 0;
    font-family: monospace;
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
