<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Header from "../lib/components/Header.svelte";
  import Stats from "../lib/components/Stats.svelte";
  import AccountsTable from "../lib/components/AccountsTable.svelte";
  import ActionsBarChart from "../lib/components/ActionsBarChart.svelte";
  import ActivityLog from "../lib/components/ActivityLog.svelte";
  import LogViewer from "../lib/components/LogViewer.svelte";
  import Sidebar from "../lib/components/Sidebar.svelte";
  import Settings from "../lib/components/Settings.svelte";
  import Debug from "../lib/components/Debug.svelte";
  import { connect, disconnect } from "../lib/stores/websocket";
  import { stats, activity, logs } from "../lib/stores/data";
  import * as api from "../lib/api";

  type Tab = "overview" | "activity" | "logs" | "settings" | "debug";
  let currentTab: Tab = $state("overview");

  onMount(async () => {
    // Initial data load
    try {
      const [statsData, activityData, logsData] = await Promise.all([
        api.fetchStats(),
        api.fetchActivity({ pageSize: 50 }),
        api.fetchLogs({ limit: 200 }),
      ]);

      stats.set(statsData);
      activity.set(activityData.entries);
      logs.set(logsData.logs);
    } catch (e) {
      console.error("Failed to load initial data:", e);
    }

    // Connect WebSocket for real-time updates
    connect();
  });

  onDestroy(() => {
    disconnect();
  });

  function switchTab(tab: Tab) {
    currentTab = tab;
  }
</script>

<div class="dashboard">
  <Header />

  {#if $stats?.dryRun}
    <div class="dry-run-banner">
      <span class="banner-icon">&#9888;</span>
      <span class="banner-text">
        <strong>Dry Run Mode</strong> — No actions are being executed. Emails are classified but not modified.
      </span>
    </div>
  {/if}

  <main class="main">
    <div class="container">
      <div class="tabs">
        <button
          class="tab-btn"
          class:active={currentTab === "overview"}
          onclick={() => switchTab("overview")}
        >
          Overview
        </button>
        <button
          class="tab-btn"
          class:active={currentTab === "activity"}
          onclick={() => switchTab("activity")}
        >
          Activity
        </button>
        <button
          class="tab-btn"
          class:active={currentTab === "logs"}
          onclick={() => switchTab("logs")}
        >
          Logs
        </button>
        <button
          class="tab-btn"
          class:active={currentTab === "settings"}
          onclick={() => switchTab("settings")}
        >
          Settings
        </button>
        <button
          class="tab-btn"
          class:active={currentTab === "debug"}
          onclick={() => switchTab("debug")}
        >
          Debug
        </button>
      </div>

      {#if currentTab === "overview"}
        <Stats />
        <div class="overview-grid">
          <div class="main-content">
            <AccountsTable />
            <ActionsBarChart />
          </div>
          <aside class="sidebar-content">
            <Sidebar />
          </aside>
        </div>
      {:else if currentTab === "activity"}
        <ActivityLog />
      {:else if currentTab === "logs"}
        <LogViewer />
      {:else if currentTab === "settings"}
        <Settings />
      {:else if currentTab === "debug"}
        <Debug />
      {/if}
    </div>
  </main>

  <footer class="footer">
    <div class="footer-left">
      <span class="version">Mailpilot v{$stats?.version ?? "-"}</span>
      <span class="connection-url" title="Connection URL">{window.location.origin}</span>
    </div>
    <a
      href="https://github.com/metal0/mailpilot"
      target="_blank"
      rel="noopener noreferrer"
      class="github-link"
    >
      <svg class="github-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
      <span>View on GitHub</span>
    </a>
  </footer>
</div>

<style>
  .dashboard {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .dry-run-banner {
    background: color-mix(in srgb, var(--warning) 15%, var(--bg-secondary));
    border-bottom: 1px solid color-mix(in srgb, var(--warning) 40%, transparent);
    color: var(--text-secondary);
    padding: 0.5rem 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
  }

  .banner-icon {
    font-size: 1rem;
    color: var(--warning);
  }

  .banner-text strong {
    font-weight: 600;
    color: var(--warning);
  }

  .main {
    flex: 1;
    padding: 1.5rem 0;
  }

  .container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 2rem;
  }

  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.5rem;
  }

  .tab-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    padding: 0.5rem 1rem;
    cursor: pointer;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    transition: background 0.2s, color 0.2s;
  }

  .tab-btn:hover {
    background: var(--bg-tertiary);
  }

  .tab-btn.active {
    background: var(--accent);
    color: white;
  }

  .overview-grid {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 1.5rem;
  }

  .main-content {
    min-width: 0;
  }

  .sidebar-content {
    min-width: 0;
  }

  @media (max-width: 1200px) {
    .overview-grid {
      grid-template-columns: 1fr;
    }

    .sidebar-content {
      order: -1;
    }
  }

  @media (max-width: 768px) {
    .container {
      padding: 0 1rem;
    }

    .tabs {
      overflow-x: auto;
    }
  }

  .footer {
    padding: 1rem 2rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-secondary);
  }

  .footer-left {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .version {
    font-weight: 500;
  }

  .connection-url {
    filter: blur(4px);
    transition: filter 0.2s ease;
    cursor: pointer;
    user-select: none;
  }

  .connection-url:hover {
    filter: blur(0);
    user-select: auto;
  }

  .github-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.8125rem;
    text-decoration: none;
    transition: color 0.2s;
  }

  .github-link:hover {
    color: var(--text-primary);
  }

  .github-icon {
    width: 1.25rem;
    height: 1.25rem;
  }
</style>
