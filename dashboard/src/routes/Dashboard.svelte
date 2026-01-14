<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Header from "../lib/components/Header.svelte";
  import Stats from "../lib/components/Stats.svelte";
  import AccountsTable from "../lib/components/AccountsTable.svelte";
  import ActionsBarChart from "../lib/components/ActionsBarChart.svelte";
  import ActionsPieChart from "../lib/components/ActionsPieChart.svelte";
  import ActivityLog from "../lib/components/ActivityLog.svelte";
  import LogViewer from "../lib/components/LogViewer.svelte";
  import Sidebar from "../lib/components/Sidebar.svelte";
  import Settings from "../lib/components/Settings.svelte";
  import Debug from "../lib/components/Debug.svelte";
  import { connect, disconnect } from "../lib/stores/websocket";
  import { stats, activity, logs, deadLetters } from "../lib/stores/data";
  import { navigation, settingsHasChanges, type Tab } from "../lib/stores/navigation";
  import { t, initLocale } from "../lib/i18n";
  import * as api from "../lib/api";

  let currentTab: Tab = $state("overview");
  let activityInitialFilter: "all" | "activity" | "errors" = $state("all");
  let showUnsavedModal = $state(false);
  let pendingTab: Tab | null = $state(null);

  $effect(() => {
    if ($navigation) {
      currentTab = $navigation.tab;
      if ($navigation.activityFilter) {
        activityInitialFilter = $navigation.activityFilter;
      }
      navigation.set(null);
    }
  });

  onMount(async () => {
    initLocale();
    // Initial data load
    try {
      const [statsData, activityData, logsData, deadLetterData] = await Promise.all([
        api.fetchStats(),
        api.fetchActivity({ pageSize: 50 }),
        api.fetchLogs({ limit: 200 }),
        api.fetchDeadLetters(),
      ]);

      stats.set(statsData);
      activity.set(activityData.entries);
      logs.set(logsData.logs);
      deadLetters.set(deadLetterData.entries);
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
    if (currentTab === "settings" && $settingsHasChanges && tab !== "settings") {
      pendingTab = tab;
      showUnsavedModal = true;
      return;
    }
    currentTab = tab;
  }

  function confirmLeaveSettings() {
    if (pendingTab) {
      settingsHasChanges.set(false);
      currentTab = pendingTab;
      pendingTab = null;
    }
    showUnsavedModal = false;
  }

  function cancelLeaveSettings() {
    pendingTab = null;
    showUnsavedModal = false;
  }
</script>

<div class="dashboard">
  {#if showUnsavedModal}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-overlay" onclick={cancelLeaveSettings}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="modal modal-warning" onclick={(e) => e.stopPropagation()}>
        <div class="warning-icon">&#9888;</div>
        <h3>{$t("settings.unsavedModal.title")}</h3>
        <p>{$t("settings.unsavedModal.message")}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick={cancelLeaveSettings}>{$t("common.cancel")}</button>
          <button class="btn btn-danger" onclick={confirmLeaveSettings}>{$t("settings.unsavedModal.discard")}</button>
        </div>
      </div>
    </div>
  {/if}

  <Header />

  {#if $stats?.dryRun}
    <div class="dry-run-banner">
      <span class="banner-icon">&#9888;</span>
      <span class="banner-text">
        <strong>{$t("stats.dryRunMode")}</strong> — {$t("stats.dryRunBanner")}
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
          {$t("nav.overview")}
        </button>
        <button
          class="tab-btn"
          class:active={currentTab === "activity"}
          onclick={() => switchTab("activity")}
        >
          {$t("nav.activity")}
        </button>
        <button
          class="tab-btn"
          class:active={currentTab === "logs"}
          onclick={() => switchTab("logs")}
        >
          {$t("nav.logs")}
        </button>
        <button
          class="tab-btn"
          class:active={currentTab === "settings"}
          onclick={() => switchTab("settings")}
        >
          {$t("nav.settings")}
        </button>
        <button
          class="tab-btn"
          class:active={currentTab === "debug"}
          onclick={() => switchTab("debug")}
        >
          {$t("nav.debug")}
        </button>
      </div>

      {#if currentTab === "overview"}
        <Stats />
        <div class="overview-grid">
          <div class="main-content">
            <AccountsTable />
            <div class="charts-row">
              <ActionsBarChart />
              <ActionsPieChart />
            </div>
          </div>
          <aside class="sidebar-content">
            <Sidebar />
          </aside>
        </div>
      {:else if currentTab === "activity"}
        <ActivityLog initialFilter={activityInitialFilter} />
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
      <span>{$t("footer.viewOnGithub")}</span>
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
    background: var(--warning-muted);
    border-bottom: 1px solid color-mix(in srgb, var(--warning) 40%, transparent);
    color: var(--text-secondary);
    padding: var(--space-2) var(--space-6);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }

  .banner-icon {
    font-size: var(--text-base);
    color: var(--warning);
  }

  .banner-text strong {
    font-weight: 600;
    color: var(--warning);
  }

  .main {
    flex: 1;
    padding: var(--space-5) 0;
  }

  .container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 var(--space-6);
  }

  .tabs {
    display: flex;
    gap: var(--space-1);
    margin-bottom: var(--space-5);
    background: var(--bg-secondary);
    padding: var(--space-1);
    border-radius: var(--radius-lg);
    width: fit-content;
  }

  .tab-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    padding: var(--space-2) var(--space-4);
    cursor: pointer;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: 500;
    transition: all var(--transition-fast);
  }

  .tab-btn:hover {
    color: var(--text-primary);
    background: var(--bg-tertiary);
  }

  .tab-btn.active {
    background: var(--accent);
    color: white;
    box-shadow: var(--shadow-sm);
  }

  .overview-grid {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: var(--space-5);
  }

  .main-content {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .charts-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }

  @media (max-width: 900px) {
    .charts-row {
      grid-template-columns: 1fr;
    }
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
      padding: 0 var(--space-4);
    }

    .tabs {
      width: 100%;
      overflow-x: auto;
    }
  }

  .footer {
    padding: var(--space-4) var(--space-6);
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-secondary);
  }

  .footer-left {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .version {
    font-weight: 500;
  }

  .connection-url {
    filter: blur(4px);
    transition: filter var(--transition-base);
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
    gap: var(--space-2);
    color: var(--text-secondary);
    font-size: var(--text-sm);
    text-decoration: none;
    transition: color var(--transition-fast);
  }

  .github-link:hover {
    color: var(--text-primary);
  }

  .github-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    width: 100%;
    max-width: 400px;
  }

  .modal-warning {
    text-align: center;
  }

  .modal-warning .warning-icon {
    font-size: 2.5rem;
    margin-bottom: var(--space-2);
    color: var(--warning);
  }

  .modal-warning h3 {
    margin: 0 0 var(--space-3);
    color: var(--warning);
    font-size: var(--text-lg);
  }

  .modal-warning p {
    margin: 0 0 var(--space-5);
    color: var(--text-secondary);
    font-size: var(--text-sm);
    line-height: 1.5;
  }

  .modal-actions {
    display: flex;
    justify-content: center;
    gap: var(--space-3);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-sm);
    font-weight: 500;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn-secondary:hover {
    background: var(--border-color);
  }

  .btn-danger {
    background: var(--error);
    color: white;
  }

  .btn-danger:hover {
    background: color-mix(in srgb, var(--error) 85%, black);
  }
</style>
