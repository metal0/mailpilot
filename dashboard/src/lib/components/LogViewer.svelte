<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { selectedAccount, accountList, logs, logsSearchQuery, logsSelectedLevels, type LogEntry } from "../stores/data";
  import { selectedIndex } from "../stores/shortcuts";
  import { t } from "../i18n";
  import * as api from "../api";
  import StreamToggle from "./StreamToggle.svelte";
  import Backdrop from "./Backdrop.svelte";
  import Modal from "./Modal.svelte";

  // Windowed scroll configuration
  const PAGE_SIZE = 10;       // Fetch smaller batches from API
  const MAX_VISIBLE = 50;     // Max entries visible at once
  const ENTRY_ADD_DELAY = 50; // ms between adding each entry

  let loading = $state(false);
  let loadingMore = $state(false);
  let currentPage = $state(1);
  let totalPages = $state(1);
  let hasMore = $state(true);
  let pendingEntries: LogEntry[] = []; // Queue for gradual addition
  let addingEntries = false;

  // All loaded log entries (windowed view)
  let allLogs = $state<LogEntry[]>([]);

  // Scrollable container and sentinel refs
  let scrollContainer: HTMLDivElement | null = $state(null);
  let bottomSentinel: HTMLDivElement | null = $state(null);
  let observer: IntersectionObserver | null = null;

  // Streaming state (ON by default for Logs)
  let streaming = $state(true);
  let bufferedLogs = $state<LogEntry[]>([]);
  let lastSeenTimestamp = $state<string>("");
  let unsubscribeLogs: (() => void) | null = null;

  // Multi-select log level filter (using store for persistence)
  const allLogLevels = ["debug", "info", "warn", "error"];
  let showFilterDropdown = $state(false);

  function toggleLevel(level: string) {
    logsSelectedLevels.update(current => {
      const newSet = new Set(current);
      if (newSet.has(level)) {
        newSet.delete(level);
      } else {
        newSet.add(level);
      }
      return newSet;
    });
  }

  function selectAllLevels() {
    logsSelectedLevels.set(new Set(allLogLevels));
  }

  function clearAllLevels() {
    logsSelectedLevels.set(new Set());
  }

  // Subscribe to logs store for real-time updates when streaming is ON
  function setupLogsSubscription() {
    if (unsubscribeLogs) return;

    unsubscribeLogs = logs.subscribe((entries) => {
      if (!streaming || entries.length === 0) return;

      const newEntries = entries.filter(e => e.timestamp > lastSeenTimestamp);
      if (newEntries.length > 0) {
        lastSeenTimestamp = newEntries.reduce((max, e) => e.timestamp > max ? e.timestamp : max, lastSeenTimestamp);
        // Add new entries at top one by one (for streaming, add immediately since they come in small batches)
        for (const entry of newEntries) {
          if (allLogs.length >= MAX_VISIBLE) {
            // Remove from bottom, add to top
            allLogs = [entry, ...allLogs.slice(0, -1)];
          } else {
            allLogs = [entry, ...allLogs];
          }
        }
      }
    });
  }

  function handleStreamToggle(isStreaming: boolean) {
    streaming = isStreaming;

    if (isStreaming) {
      if (bufferedLogs.length > 0) {
        const combined = [...bufferedLogs, ...allLogs];
        allLogs = combined.slice(0, MAX_VISIBLE);
        bufferedLogs = [];
      }
      setupLogsSubscription();
    } else {
      if (unsubscribeLogs) {
        unsubscribeLogs();
        unsubscribeLogs = null;
      }
      unsubscribeLogs = logs.subscribe((entries) => {
        if (streaming || entries.length === 0) return;
        const newEntries = entries.filter(e => e.timestamp > lastSeenTimestamp);
        if (newEntries.length > 0) {
          lastSeenTimestamp = newEntries.reduce((max, e) => e.timestamp > max ? e.timestamp : max, lastSeenTimestamp);
          bufferedLogs = [...newEntries, ...bufferedLogs].slice(0, 50);
        }
      });
    }
  }

  // Filtered logs for display
  const displayLogs = $derived.by(() => {
    let filtered = allLogs;

    // Apply level filter (only show selected levels)
    if ($logsSelectedLevels.size < allLogLevels.length) {
      filtered = filtered.filter(log => $logsSelectedLevels.has(log.level));
    }

    // Apply account filter - check both context and meta
    if ($selectedAccount) {
      filtered = filtered.filter(log => {
        // Check if account name appears in context (e.g., "[worker:accountName]")
        if (log.context.toLowerCase().includes($selectedAccount!.toLowerCase())) {
          return true;
        }
        // Also check meta for account references
        if (log.meta) {
          const metaStr = JSON.stringify(log.meta).toLowerCase();
          return metaStr.includes($selectedAccount!.toLowerCase());
        }
        return false;
      });
    }

    // Apply search filter
    if ($logsSearchQuery) {
      const query = $logsSearchQuery.toLowerCase();
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(query) ||
        log.context.toLowerCase().includes(query) ||
        (log.meta && JSON.stringify(log.meta).toLowerCase().includes(query))
      );
    }

    return filtered;
  });

  async function loadInitial() {
    loading = true;
    currentPage = 1;
    hasMore = true;
    // Clear any pending gradual additions
    pendingEntries = [];
    addingEntries = false;

    try {
      const params: api.LogParams = {
        page: 1,
        pageSize: MAX_VISIBLE,
      };
      if ($selectedAccount) params.accountName = $selectedAccount;

      const result = await api.fetchLogs(params);
      allLogs = result.logs.slice(0, MAX_VISIBLE);
      totalPages = result.totalPages;
      hasMore = currentPage < totalPages;

      if (allLogs.length > 0) {
        lastSeenTimestamp = allLogs.reduce((max, e) => e.timestamp > max ? e.timestamp : max, "");
      }
    } catch (e) {
      console.error("Failed to load logs:", e);
    } finally {
      loading = false;
    }
  }

  // Gradually add entries one by one to prevent scrollbar jumps
  function processEntryQueue() {
    if (addingEntries || pendingEntries.length === 0) return;
    addingEntries = true;

    function addNextEntry() {
      if (pendingEntries.length === 0) {
        addingEntries = false;
        loadingMore = false;
        return;
      }

      const entry = pendingEntries.shift()!;

      // Add to bottom, remove from top if over limit
      if (allLogs.length >= MAX_VISIBLE) {
        allLogs = [...allLogs.slice(1), entry];
      } else {
        allLogs = [...allLogs, entry];
      }

      // Schedule next entry with small delay
      if (pendingEntries.length > 0) {
        setTimeout(addNextEntry, ENTRY_ADD_DELAY);
      } else {
        addingEntries = false;
        loadingMore = false;
      }
    }

    addNextEntry();
  }

  async function loadMore() {
    if (loadingMore || !hasMore || currentPage >= totalPages) return;

    loadingMore = true;
    try {
      const nextPage = currentPage + 1;
      const params: api.LogParams = {
        page: nextPage,
        pageSize: PAGE_SIZE,
      };
      if ($selectedAccount) params.accountName = $selectedAccount;

      const result = await api.fetchLogs(params);

      // Filter out duplicates
      const existingKeys = new Set(allLogs.map(e => `${e.timestamp}-${e.context}-${e.message}`));
      const newLogs = result.logs.filter(e => !existingKeys.has(`${e.timestamp}-${e.context}-${e.message}`));

      if (newLogs.length > 0) {
        // Add to queue for gradual processing
        pendingEntries.push(...newLogs);
        processEntryQueue();
      } else {
        loadingMore = false;
      }

      currentPage = nextPage;
      totalPages = result.totalPages;
      hasMore = currentPage < totalPages;

    } catch (e) {
      console.error("Failed to load more logs:", e);
      loadingMore = false;
    }
  }

  function setupIntersectionObserver() {
    if (observer) observer.disconnect();
    if (!bottomSentinel) return;

    observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      {
        root: scrollContainer,
        rootMargin: "100px",
        threshold: 0,
      }
    );

    observer.observe(bottomSentinel);
  }

  $effect(() => {
    if (bottomSentinel && scrollContainer) {
      setupIntersectionObserver();
    }
  });

  // Track filter changes to reload
  let prevAccount = $state<string | null>(null);

  $effect(() => {
    const filtersChanged = $selectedAccount !== prevAccount;

    if (filtersChanged) {
      prevAccount = $selectedAccount;
      loadInitial();
    }
  });

  function formatTime(timestamp: string): string {
    return timestamp.substring(11, 19);
  }

  function formatUtcTooltip(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
  }

  function getLevelClass(level: string): string {
    return `level-${level}`;
  }

  onMount(async () => {
    await loadInitial();
    if (streaming) {
      setupLogsSubscription();
    }
  });

  onDestroy(() => {
    // Clear pending entries queue
    pendingEntries = [];
    addingEntries = false;

    if (unsubscribeLogs) {
      unsubscribeLogs();
      unsubscribeLogs = null;
    }
    if (observer) {
      observer.disconnect();
    }
  });

  // Ref to search input for keyboard focus
  let searchInputRef: HTMLInputElement | null = $state(null);

  // Log detail modal
  let showLogDetail = $state(false);
  let detailLog: LogEntry | null = $state(null);

  function openLogDetail(log: LogEntry) {
    detailLog = log;
    showLogDetail = true;
  }

  // Exported methods for keyboard shortcuts
  export function toggleStreaming() {
    handleStreamToggle(!streaming);
  }

  export function focusSearch() {
    searchInputRef?.focus();
  }

  export function openSelected() {
    const idx = $selectedIndex;
    if (idx >= 0 && idx < displayLogs.length) {
      openLogDetail(displayLogs[idx]);
    }
  }
</script>

<div class="card">
  <div class="card-header">
    <h2 class="card-title">{$t("logs.title")}</h2>
    <div class="header-controls">
      <StreamToggle
        {streaming}
        onchange={handleStreamToggle}
        pendingCount={bufferedLogs.length}
        label={$t("common.live") ?? "Live"}
      />
      <div class="filter-dropdown-container">
        <button class="filter-dropdown-btn" onclick={() => showFilterDropdown = !showFilterDropdown}>
          Filter ({$logsSelectedLevels.size}/{allLogLevels.length})
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        {#if showFilterDropdown}
          <Backdrop onclose={() => showFilterDropdown = false} zIndex={10} />
          <div class="filter-dropdown-menu">
            <div class="filter-dropdown-actions">
              <button class="filter-action-btn" onclick={selectAllLevels}>All</button>
              <button class="filter-action-btn" onclick={clearAllLevels}>None</button>
            </div>
            <div class="filter-dropdown-options">
              {#each allLogLevels as level}
                <label class="filter-option">
                  <input type="checkbox" checked={$logsSelectedLevels.has(level)} onchange={() => toggleLevel(level)} />
                  <span class="filter-option-label level-{level}">{level.toUpperCase()}</span>
                </label>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <div class="filters-bar">
    <input
      type="text"
      class="search-input"
      placeholder={$t("common.search")}
      bind:value={$logsSearchQuery}
      bind:this={searchInputRef}
    />
    <select class="filter-select" value={$selectedAccount ?? ""} onchange={(e) => selectedAccount.set(e.currentTarget.value || null)}>
      <option value="">{$t("common.all")} {$t("common.accounts")}</option>
      {#each $accountList as name}
        <option value={name}>{name}</option>
      {/each}
    </select>
    <span class="entry-count">{displayLogs.length} entries loaded</span>
  </div>

  <div class="logs-container" bind:this={scrollContainer}>
    {#if loading}
      <div class="loading">{$t("common.loading")}</div>
    {:else if displayLogs.length === 0}
      <div class="empty">{$t("logs.noLogs")}</div>
    {:else}
      {#each displayLogs as log, idx}
        <div
          class="log-entry {getLevelClass(log.level)}"
          class:selected={$selectedIndex === idx}
          onclick={() => openLogDetail(log)}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && openLogDetail(log)}
        >
          <span class="log-time" title={formatUtcTooltip(log.timestamp)}>{formatTime(log.timestamp)}</span>
          <span class="log-level">{log.level.toUpperCase()}</span>
          <span class="log-context">[{log.context}]</span>
          <span class="log-message">{log.message}</span>
          {#if log.meta}
            <span class="log-meta">{JSON.stringify(log.meta)}</span>
          {/if}
        </div>
      {/each}

      <!-- Sentinel for infinite scroll -->
      <div bind:this={bottomSentinel} class="scroll-sentinel">
        {#if loadingMore}
          <div class="loading-more">
            <span class="spinner"></span>
            Loading more...
          </div>
        {:else if !hasMore}
          <div class="end-of-list">End of logs</div>
        {/if}
      </div>
    {/if}
  </div>
</div>

{#if showLogDetail && detailLog}
  <Modal
    open={showLogDetail}
    title="Log Entry Details"
    onclose={() => { showLogDetail = false; detailLog = null; }}
    maxWidth="600px"
  >
    {#snippet children()}
      <div class="log-detail-content">
        <div class="log-detail-row">
          <span class="log-detail-label">Timestamp</span>
          <span class="log-detail-value">{detailLog.timestamp}</span>
        </div>
        <div class="log-detail-row">
          <span class="log-detail-label">Level</span>
          <span class="log-detail-value log-detail-level level-{detailLog.level}">{detailLog.level.toUpperCase()}</span>
        </div>
        <div class="log-detail-row">
          <span class="log-detail-label">Context</span>
          <span class="log-detail-value">{detailLog.context}</span>
        </div>
        <div class="log-detail-row log-detail-row-full">
          <span class="log-detail-label">Message</span>
          <div class="log-detail-message">{detailLog.message}</div>
        </div>
        {#if detailLog.meta}
          <div class="log-detail-row log-detail-row-full">
            <span class="log-detail-label">Metadata</span>
            <pre class="log-detail-meta">{JSON.stringify(detailLog.meta, null, 2)}</pre>
          </div>
        {/if}
      </div>
    {/snippet}
  </Modal>
{/if}

<style>
  .card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-8);
    display: flex;
    flex-direction: column;
    height: calc(100vh - 280px);
    min-height: 400px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .card-title {
    font-size: var(--text-base);
    font-weight: 600;
    margin: 0;
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .filter-dropdown-container {
    position: relative;
  }

  .filter-dropdown-btn {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .filter-dropdown-btn svg {
    width: 14px;
    height: 14px;
  }

  .filter-dropdown-btn:hover {
    border-color: var(--accent);
  }

  .filter-dropdown-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: var(--space-1);
    background: var(--bg-elevated);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    z-index: 100;
    min-width: 140px;
  }

  .filter-dropdown-actions {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-2);
    border-bottom: 1px solid var(--border-color);
  }

  .filter-action-btn {
    flex: 1;
    padding: var(--space-1);
    background: var(--bg-tertiary);
    border: none;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    color: var(--text-secondary);
    cursor: pointer;
  }

  .filter-action-btn:hover {
    background: var(--border-color);
    color: var(--text-primary);
  }

  .filter-dropdown-options {
    padding: var(--space-2);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .filter-option {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .filter-option:hover {
    background: var(--bg-tertiary);
  }

  .filter-option input {
    accent-color: var(--accent);
  }

  .filter-option-label {
    font-size: var(--text-sm);
    font-weight: 500;
  }

  .filter-option-label.level-debug {
    color: var(--text-muted);
  }

  .filter-option-label.level-info {
    color: #60a5fa;
  }

  .filter-option-label.level-warn {
    color: var(--warning);
  }

  .filter-option-label.level-error {
    color: var(--error);
  }

  .filters-bar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-5);
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);
    flex-wrap: wrap;
    flex-shrink: 0;
  }

  .search-input {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    min-width: 250px;
    transition: border-color var(--transition-fast);
  }

  .search-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .search-input::placeholder {
    color: var(--text-muted);
  }

  .filter-select {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .entry-count {
    font-size: var(--text-xs);
    color: var(--text-muted);
    margin-left: auto;
  }

  .logs-container {
    flex: 1;
    overflow-y: auto;
    font-family: monospace;
    font-size: var(--text-xs);
  }

  .loading,
  .empty {
    padding: var(--space-8);
    text-align: center;
    color: var(--text-muted);
  }

  .log-entry {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    border-bottom: 1px solid var(--bg-primary);
  }

  .log-entry:hover {
    background: var(--bg-tertiary);
    cursor: pointer;
  }

  .log-entry.selected {
    background: color-mix(in srgb, var(--accent) 15%, var(--bg-secondary));
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .log-entry.selected:hover {
    background: color-mix(in srgb, var(--accent) 20%, var(--bg-secondary));
  }

  .log-time {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .log-level {
    width: 3.5rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  .level-debug .log-level {
    color: var(--text-muted);
  }

  .level-info .log-level {
    color: #60a5fa;
  }

  .level-warn .log-level {
    color: var(--warning);
  }

  .level-error .log-level {
    color: var(--error);
  }

  .log-context {
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .log-message {
    flex: 1;
    color: var(--text-primary);
    word-break: break-word;
  }

  .log-meta {
    width: 100%;
    color: var(--text-muted);
    font-size: 0.625rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-left: 8rem;
  }

  .scroll-sentinel {
    padding: var(--space-4);
    text-align: center;
  }

  .loading-more {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    color: var(--text-muted);
    font-size: var(--text-sm);
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border-color);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .end-of-list {
    color: var(--text-muted);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Log Detail Modal Content */
  .log-detail-content {
    display: flex;
    flex-direction: column;
  }

  .log-detail-row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--border-color);
  }

  .log-detail-row:last-child {
    border-bottom: none;
  }

  .log-detail-row-full {
    flex-direction: column;
    gap: var(--space-2);
  }

  .log-detail-label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-muted);
    min-width: 80px;
    flex-shrink: 0;
  }

  .log-detail-value {
    font-size: var(--text-sm);
    color: var(--text-primary);
    word-break: break-word;
  }

  .log-detail-level {
    font-weight: 600;
    font-family: var(--font-mono);
  }

  .log-detail-level.level-debug {
    color: var(--text-muted);
  }

  .log-detail-level.level-info {
    color: #60a5fa;
  }

  .log-detail-level.level-warn {
    color: var(--warning);
  }

  .log-detail-level.level-error {
    color: var(--error);
  }

  .log-detail-message {
    background: var(--bg-tertiary);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-family: var(--font-mono);
    word-break: break-word;
    white-space: pre-wrap;
  }

  .log-detail-meta {
    background: var(--bg-tertiary);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    overflow-x: auto;
    margin: 0;
    color: var(--text-secondary);
  }

  @media (max-width: 768px) {
    .card-header {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-3);
    }

    .filters-bar {
      flex-direction: column;
      align-items: stretch;
    }

    .search-input {
      min-width: 100%;
    }

    .filter-select {
      width: 100%;
    }
  }
</style>
