<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Header from "../lib/components/Header.svelte";
  import Stats from "../lib/components/Stats.svelte";
  import AccountsTable from "../lib/components/AccountsTable.svelte";
  import ActivityLog from "../lib/components/ActivityLog.svelte";
  import LogViewer from "../lib/components/LogViewer.svelte";
  import Sidebar from "../lib/components/Sidebar.svelte";
  import { connect, disconnect } from "../lib/stores/websocket";
  import { stats, activity, logs } from "../lib/stores/data";
  import * as api from "../lib/api";

  type Tab = "overview" | "activity" | "logs";
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
      </div>

      {#if currentTab === "overview"}
        <Stats />
        <div class="overview-grid">
          <div class="main-content">
            <AccountsTable />
          </div>
          <aside class="sidebar-content">
            <Sidebar />
          </aside>
        </div>
      {:else if currentTab === "activity"}
        <ActivityLog />
      {:else if currentTab === "logs"}
        <LogViewer />
      {/if}
    </div>
  </main>

  <footer class="footer">
    <p>Mailpilot Dashboard - Real-time updates enabled</p>
  </footer>
</div>

<style>
  .dashboard {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
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

  .footer {
    padding: 1rem 2rem;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.75rem;
    border-top: 1px solid var(--border-color);
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
</style>
