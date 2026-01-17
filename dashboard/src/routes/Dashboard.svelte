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
  import Modal from "../lib/components/Modal.svelte";
  import KeyboardShortcuts from "../lib/components/KeyboardShortcuts.svelte";
  import { connect, disconnect, versionMismatch, dismissVersionMismatch, refreshForNewVersion } from "../lib/stores/websocket";
  import { stats, activity, logs, deadLetters } from "../lib/stores/data";
  import { navigation, settingsHasChanges, type Tab } from "../lib/stores/navigation";
  import { currentScope, selectedIndex } from "../lib/stores/shortcuts";
  import { t, initLocale } from "../lib/i18n";
  import * as api from "../lib/api";

  let currentTab: Tab = $state("overview");
  let activityInitialFilter: "all" | "errors" = $state("all");
  let showUnsavedModal = $state(false);
  let pendingTab: Tab | null = $state(null);
  let latestRelease: api.GitHubRelease | null = $state(null);
  let bannersEl: HTMLDivElement | null = $state(null);
  let bannerHeight = $state(0);
  let isOutdated = $derived(() => {
    if (!latestRelease || !$stats?.version) return false;
    return api.compareVersions(latestRelease.tag_name, $stats.version) > 0;
  });

  $effect(() => {
    if (bannersEl) {
      const updateHeight = () => {
        bannerHeight = bannersEl?.offsetHeight ?? 0;
      };
      updateHeight();
      const observer = new ResizeObserver(updateHeight);
      observer.observe(bannersEl);
      return () => observer.disconnect();
    }
  });

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
        api.fetchLogs({ page: 1, pageSize: 50 }),
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

    // Check for updates from GitHub (non-blocking)
    api.fetchLatestGitHubRelease().then((release) => {
      if (release) {
        latestRelease = release;
        console.log("[update-check] Latest GitHub release:", release.tag_name);
      }
    });
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
    currentScope.set(tab);
    selectedIndex.set(-1);
  }

  // Keyboard shortcut handlers
  function handleTabSwitch(tabNum: number) {
    const tabs: Tab[] = ["overview", "activity", "logs", "settings", "debug"];
    if (tabNum >= 1 && tabNum <= 5) {
      switchTab(tabs[tabNum - 1]);
    }
  }

  // References to child components for keyboard actions
  let activityLogRef: ActivityLog | null = $state(null);
  let logViewerRef: LogViewer | null = $state(null);

  function handleToggleStream() {
    if (currentTab === "activity") {
      activityLogRef?.toggleStreaming?.();
    } else if (currentTab === "logs") {
      logViewerRef?.toggleStreaming?.();
    }
  }

  function handleFocusSearch() {
    if (currentTab === "activity") {
      activityLogRef?.focusSearch?.();
    } else if (currentTab === "logs") {
      logViewerRef?.focusSearch?.();
    }
  }

  function handleRetry() {
    if (currentTab === "activity") {
      activityLogRef?.retrySelected?.();
    }
  }

  function handleDismiss() {
    if (currentTab === "activity") {
      activityLogRef?.dismissSelected?.();
    }
  }

  function handleOpenSelected() {
    if (currentTab === "activity") {
      activityLogRef?.openSelected?.();
    } else if (currentTab === "logs") {
      logViewerRef?.openSelected?.();
    }
  }

  // Get item count for keyboard navigation
  let itemCount = $derived(() => {
    if (currentTab === "activity") {
      return $activity.length + $deadLetters.length;
    } else if (currentTab === "logs") {
      return $logs.length;
    }
    return 0;
  });

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
  <KeyboardShortcuts
    onTabSwitch={handleTabSwitch}
    onToggleStream={handleToggleStream}
    onFocusSearch={handleFocusSearch}
    onRetry={handleRetry}
    onDismiss={handleDismiss}
    onOpenSelected={handleOpenSelected}
    itemCount={itemCount()}
  />

  <Modal
    open={showUnsavedModal}
    title={$t("settings.unsavedModal.title")}
    onclose={cancelLeaveSettings}
    variant="warning"
    maxWidth="400px"
    showCloseButton={false}
  >
    {#snippet children()}
      <p class="modal-message">{$t("settings.unsavedModal.message")}</p>
    {/snippet}
    {#snippet actions()}
      <button class="btn btn-secondary" onclick={cancelLeaveSettings}>{$t("common.cancel")}</button>
      <button class="btn btn-danger" onclick={confirmLeaveSettings}>{$t("settings.unsavedModal.discard")}</button>
    {/snippet}
  </Modal>

  <Header />

  <div class="sticky-banners" bind:this={bannersEl}>
    {#if $versionMismatch}
      <div class="update-banner">
        <span class="banner-icon">&#8635;</span>
        <span class="banner-text">
          {#if $versionMismatch.serverRestarted}
            <strong>Server Restarted</strong> — The backend server has been restarted. Refresh to reconnect properly.
          {:else}
            <strong>Update Available</strong> — Version {$versionMismatch.new} is available (current: {$versionMismatch.current}).
          {/if}
        </span>
        <div class="banner-actions">
          <button class="banner-btn banner-btn-primary" onclick={refreshForNewVersion}>
            Refresh Now
          </button>
          <button class="banner-btn banner-btn-secondary" onclick={dismissVersionMismatch}>
            Dismiss
          </button>
        </div>
      </div>
    {/if}

    {#if $stats?.dryRun}
      <div class="dry-run-banner">
        <span class="banner-icon">&#9888;</span>
        <span class="banner-text">
          <strong>{$t("stats.dryRunMode")}</strong> — {$t("stats.dryRunBanner")}
        </span>
      </div>
    {/if}
  </div>

  <main class="main" style:padding-top="{bannerHeight + 20}px">
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
      {/if}

      <!-- Activity and Logs are always mounted, hidden via CSS for seamless tab switching -->
      <div class="tab-content" class:hidden={currentTab !== "activity"}>
        <ActivityLog bind:this={activityLogRef} initialFilter={activityInitialFilter} />
      </div>
      <div class="tab-content" class:hidden={currentTab !== "logs"}>
        <LogViewer bind:this={logViewerRef} />
      </div>

      {#if currentTab === "settings"}
        <Settings />
      {:else if currentTab === "debug"}
        <Debug />
      {/if}
    </div>
  </main>

  <footer class="footer">
    <div class="footer-left">
      <a
        href="https://github.com/metal0/mailpilot"
        target="_blank"
        rel="noopener noreferrer"
        class="github-link"
        title="View on GitHub"
      >
        <svg class="github-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      </a>
      <span class="version">v{$stats?.version ?? "-"}</span>
      {#if isOutdated() && latestRelease}
        <a
          href={latestRelease.html_url}
          target="_blank"
          rel="noopener noreferrer"
          class="update-available"
          title="Click to view release notes"
        >
          <span class="update-icon">&#8593;</span>
          <span>{latestRelease.tag_name} available</span>
        </a>
      {/if}
    </div>
  </footer>
</div>

<style>
  .dashboard {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    padding-top: 60px; /* Space for fixed header */
  }

  .sticky-banners {
    position: fixed;
    top: 72px; /* Below header with spacing */
    left: 0;
    right: 0;
    z-index: 99;
  }

  .update-banner {
    background: color-mix(in srgb, var(--accent) 15%, var(--bg-secondary));
    border-bottom: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
    color: var(--text-secondary);
    padding: var(--space-2) var(--space-6);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    font-size: var(--text-sm);
  }

  .update-banner .banner-icon {
    font-size: var(--text-lg);
    color: var(--accent);
  }

  .update-banner .banner-text strong {
    font-weight: 600;
    color: var(--accent);
  }

  .banner-actions {
    display: flex;
    gap: var(--space-2);
    margin-left: var(--space-2);
  }

  .banner-btn {
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-xs);
    font-weight: 500;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .banner-btn-primary {
    background: var(--accent);
    color: white;
  }

  .banner-btn-primary:hover {
    background: color-mix(in srgb, var(--accent) 85%, black);
  }

  .banner-btn-secondary {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
  }

  .banner-btn-secondary:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
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

  .dry-run-banner .banner-icon {
    font-size: var(--text-base);
    color: var(--warning);
  }

  .dry-run-banner .banner-text strong {
    font-weight: 600;
    color: var(--warning);
  }

  .main {
    flex: 1;
    padding: var(--space-5) 0;
    padding-bottom: 60px; /* Space for fixed footer */
  }

  .container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 var(--space-6);
  }

  .tabs {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-5);
    background: var(--bg-secondary);
    padding: var(--space-2);
    border-radius: var(--radius-lg);
    width: fit-content;
  }

  .tab-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    padding: var(--space-2) var(--space-5);
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

  .tab-content {
    display: block;
  }

  .tab-content.hidden {
    display: none;
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
    padding: var(--space-2) var(--space-6);
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: center;
    align-items: center;
    background: var(--bg-secondary);
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 99;
  }

  .footer-left {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--text-base);
    color: var(--text-secondary);
  }

  .version {
    font-weight: 600;
    font-size: var(--text-base);
  }

  .update-available {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    background: color-mix(in srgb, #22c55e 20%, var(--bg-tertiary));
    border: 1px solid #22c55e;
    border-radius: var(--radius-sm);
    color: #4ade80;
    font-size: var(--text-sm);
    font-weight: 600;
    text-decoration: none;
    transition: all var(--transition-fast);
  }

  .update-available:hover {
    background: color-mix(in srgb, #22c55e 30%, var(--bg-tertiary));
    color: #86efac;
  }

  .update-icon {
    font-weight: bold;
    font-size: 0.875rem;
  }

  .github-link {
    display: flex;
    align-items: center;
    color: var(--text-secondary);
    text-decoration: none;
    transition: color var(--transition-fast);
  }

  .github-link:hover {
    color: var(--text-primary);
  }

  .github-icon {
    width: 1.5rem;
    height: 1.5rem;
  }

  .modal-message {
    margin: 0;
    color: var(--text-secondary);
    font-size: var(--text-sm);
    line-height: 1.5;
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
