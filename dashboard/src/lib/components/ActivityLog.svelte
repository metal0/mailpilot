<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { activitySearchQuery, activitySelectedFilters, selectedAccount, accountList, deadLetters, activity, type AuditEntry, type DeadLetterEntry } from "../stores/data";
  import { t } from "../i18n";
  import * as api from "../api";
  import EmailPreview from "./EmailPreview.svelte";
  import Modal from "./Modal.svelte";
  import Backdrop from "./Backdrop.svelte";
  import StreamToggle from "./StreamToggle.svelte";

  type Density = "compact" | "normal" | "comfortable";
  type UnifiedEntry =
    | { type: "activity"; data: AuditEntry }
    | { type: "error"; data: DeadLetterEntry };

  let { initialFilter = "all" as "all" | "errors" } = $props();

  const PAGE_SIZE = 50;
  const MAX_ENTRIES = 300;

  let loading = $state(false);
  let loadingMore = $state(false);
  let currentPage = $state(1);
  let totalPages = $state(1);
  let hasMore = $state(true);

  // Streaming state (ON by default for Activity)
  let streaming = $state(true);
  let bufferedEntries = $state<AuditEntry[]>([]);
  let lastSeenTimestamp = $state<number>(0);
  let unsubscribeActivity: (() => void) | null = null;

  // Scrollable container and sentinel refs
  let scrollContainer: HTMLDivElement | null = $state(null);
  let bottomSentinel: HTMLDivElement | null = $state(null);
  let observer: IntersectionObserver | null = null;

  // Subscribe to activity store for real-time updates
  function setupActivitySubscription() {
    if (unsubscribeActivity) return;

    unsubscribeActivity = activity.subscribe((entries) => {
      if (!streaming || entries.length === 0) return;

      const newEntries = entries.filter(e => e.createdAt > lastSeenTimestamp);
      if (newEntries.length > 0) {
        lastSeenTimestamp = Math.max(...newEntries.map(e => e.createdAt));
        // Prepend new entries at the top
        allEntries = [...newEntries, ...allEntries];
        trimEntries();
      }
    });
  }

  function handleStreamToggle(isStreaming: boolean) {
    streaming = isStreaming;

    if (isStreaming) {
      if (bufferedEntries.length > 0) {
        allEntries = [...bufferedEntries, ...allEntries];
        bufferedEntries = [];
        trimEntries();
      }
      setupActivitySubscription();
    } else {
      if (unsubscribeActivity) {
        unsubscribeActivity();
        unsubscribeActivity = null;
      }
      unsubscribeActivity = activity.subscribe((entries) => {
        if (streaming || entries.length === 0) return;
        const newEntries = entries.filter(e => e.createdAt > lastSeenTimestamp);
        if (newEntries.length > 0) {
          lastSeenTimestamp = Math.max(...newEntries.map(e => e.createdAt));
          bufferedEntries = [...newEntries, ...bufferedEntries].slice(0, 100);
        }
      });
    }
  }

  const allFilterTypes = ["move", "flag", "read", "delete", "spam", "noop", "errors"];
  let showFilterDropdown = $state(false);

  // Use store value, but apply initial filter on first mount if set
  $effect(() => {
    if (initialFilter === "errors") {
      activitySelectedFilters.set(new Set(["errors"]));
    }
  });

  let showPreview = $state(false);
  let previewEntry: AuditEntry | null = $state(null);
  let showErrorPreview = $state(false);
  let errorPreviewEntry: DeadLetterEntry | null = $state(null);
  let density = $state<Density>(
    (typeof localStorage !== "undefined" && localStorage.getItem("activity-density") as Density) || "normal"
  );

  function setDensity(newDensity: Density) {
    density = newDensity;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("activity-density", newDensity);
    }
  }

  function toggleFilter(filter: string) {
    activitySelectedFilters.update(current => {
      const newSet = new Set(current);
      if (newSet.has(filter)) {
        newSet.delete(filter);
      } else {
        newSet.add(filter);
      }
      return newSet;
    });
  }

  function selectAllFilters() {
    activitySelectedFilters.set(new Set(allFilterTypes));
  }

  function clearAllFilters() {
    activitySelectedFilters.set(new Set());
  }

  const actionFilterTypes = ["move", "flag", "read", "delete", "spam", "noop"];
  const hasActionFilters = $derived(actionFilterTypes.some(t => $activitySelectedFilters.has(t)));
  const hasErrorFilter = $derived($activitySelectedFilters.has("errors"));

  // All loaded activity entries (accumulated across pages)
  let allEntries = $state<AuditEntry[]>([]);

  // Merge activity entries with dead letters based on time range
  const unifiedEntries = $derived.by(() => {
    const entries: UnifiedEntry[] = [];

    if (hasActionFilters) {
      for (const entry of allEntries) {
        entries.push({ type: "activity", data: entry });
      }
    }

    if (hasErrorFilter && allEntries.length > 0) {
      const timestamps = allEntries.map(e => e.createdAt);
      const newestTime = Math.max(...timestamps);
      const oldestTime = Math.min(...timestamps);

      for (const deadLetter of $deadLetters) {
        const matchesAccount = !$selectedAccount || deadLetter.accountName === $selectedAccount;
        const matchesSearch = !$activitySearchQuery ||
          deadLetter.error.toLowerCase().includes($activitySearchQuery.toLowerCase()) ||
          deadLetter.messageId.toLowerCase().includes($activitySearchQuery.toLowerCase()) ||
          deadLetter.accountName.toLowerCase().includes($activitySearchQuery.toLowerCase());
        const inTimeRange = deadLetter.createdAt <= newestTime && deadLetter.createdAt >= oldestTime;

        if (matchesAccount && matchesSearch && inTimeRange) {
          entries.push({ type: "error", data: deadLetter });
        }
      }
    } else if (hasErrorFilter && !hasActionFilters) {
      for (const deadLetter of $deadLetters) {
        const matchesAccount = !$selectedAccount || deadLetter.accountName === $selectedAccount;
        const matchesSearch = !$activitySearchQuery ||
          deadLetter.error.toLowerCase().includes($activitySearchQuery.toLowerCase()) ||
          deadLetter.messageId.toLowerCase().includes($activitySearchQuery.toLowerCase()) ||
          deadLetter.accountName.toLowerCase().includes($activitySearchQuery.toLowerCase());

        if (matchesAccount && matchesSearch) {
          entries.push({ type: "error", data: deadLetter });
        }
      }
    }

    return entries.sort((a, b) => {
      const timeA = a.type === "activity" ? a.data.createdAt : a.data.createdAt;
      const timeB = b.type === "activity" ? b.data.createdAt : b.data.createdAt;
      return timeB - timeA;
    });
  });

  function trimEntries() {
    if (allEntries.length > MAX_ENTRIES) {
      allEntries = allEntries.slice(0, MAX_ENTRIES);
    }
  }

  async function loadInitial() {
    loading = true;
    currentPage = 1;
    hasMore = true;
    try {
      const params: api.ActivityParams = {
        page: 1,
        pageSize: PAGE_SIZE,
      };
      if ($selectedAccount) params.accountName = $selectedAccount;
      if ($activitySearchQuery) params.search = $activitySearchQuery;

      const actionTypes = actionFilterTypes.filter(t => $activitySelectedFilters.has(t));
      if (actionTypes.length > 0 && actionTypes.length < actionFilterTypes.length) {
        params.actionTypes = actionTypes;
      }

      const result = await api.fetchActivity(params);
      allEntries = result.entries;
      totalPages = result.totalPages;
      hasMore = currentPage < totalPages;

      if (allEntries.length > 0) {
        lastSeenTimestamp = Math.max(...allEntries.map(e => e.createdAt));
      }
    } catch (e) {
      console.error("Failed to load activity:", e);
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore || currentPage >= totalPages) return;

    loadingMore = true;
    try {
      const nextPage = currentPage + 1;
      const params: api.ActivityParams = {
        page: nextPage,
        pageSize: PAGE_SIZE,
      };
      if ($selectedAccount) params.accountName = $selectedAccount;
      if ($activitySearchQuery) params.search = $activitySearchQuery;

      const actionTypes = actionFilterTypes.filter(t => $activitySelectedFilters.has(t));
      if (actionTypes.length > 0 && actionTypes.length < actionFilterTypes.length) {
        params.actionTypes = actionTypes;
      }

      const result = await api.fetchActivity(params);

      // Append new entries (avoiding duplicates by id)
      const existingIds = new Set(allEntries.map(e => e.id));
      const newEntries = result.entries.filter(e => !existingIds.has(e.id));
      allEntries = [...allEntries, ...newEntries];

      currentPage = nextPage;
      totalPages = result.totalPages;
      hasMore = currentPage < totalPages;

      trimEntries();
    } catch (e) {
      console.error("Failed to load more activity:", e);
    } finally {
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

  function formatTime(timestamp: number): string {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMs < 24 * 60 * 60 * 1000) {
      if (diffMins < 1) return $t("time.justNow");
      if (diffMins < 60) return `${diffMins}m ago`;
      return `${diffHours}h ago`;
    }

    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatUtcTooltip(timestamp: number): string {
    return new Date(timestamp).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
  }

  function getActionBadgeClass(type: string): string {
    const classes: Record<string, string> = {
      move: "badge-move",
      flag: "badge-flag",
      read: "badge-read",
      delete: "badge-delete",
      spam: "badge-delete",
      noop: "badge-noop",
    };
    return classes[type] ?? "";
  }

  function formatAction(action: { type: string; folder?: string; flags?: string[]; reason?: string }): string {
    switch (action.type) {
      case "move":
        return `move:${action.folder}`;
      case "flag":
        return `flag:${action.flags?.join("+")}`;
      case "noop":
        return action.reason ? `noop:${action.reason}` : "noop";
      default:
        return action.type;
    }
  }

  function openPreview(entry: AuditEntry) {
    previewEntry = entry;
    showPreview = true;
  }

  function openErrorPreview(entry: DeadLetterEntry) {
    errorPreviewEntry = entry;
    showErrorPreview = true;
  }

  // Track filter changes to reload
  let prevAccount = $state<string | null>(null);
  let prevSearch = $state<string>("");
  let prevFilters = $state<string>("");

  $effect(() => {
    const currentFilters = [...$activitySelectedFilters].sort().join(",");
    const filtersChanged =
      $selectedAccount !== prevAccount ||
      $activitySearchQuery !== prevSearch ||
      currentFilters !== prevFilters;

    if (filtersChanged) {
      prevAccount = $selectedAccount;
      prevSearch = $activitySearchQuery;
      prevFilters = currentFilters;
      loadInitial();
    }
  });

  onMount(async () => {
    await loadInitial();
    if (streaming) {
      setupActivitySubscription();
    }
  });

  onDestroy(() => {
    if (unsubscribeActivity) {
      unsubscribeActivity();
      unsubscribeActivity = null;
    }
    if (observer) {
      observer.disconnect();
    }
  });
</script>

<div class="card" class:density-compact={density === "compact"} class:density-comfortable={density === "comfortable"}>
  <div class="card-header">
    <h2 class="card-title">{$t("activity.title")}</h2>
    <div class="header-controls">
      <StreamToggle
        {streaming}
        onchange={handleStreamToggle}
        pendingCount={bufferedEntries.length}
        label={$t("common.live") ?? "Live"}
      />
      <div class="density-toggle">
        <button class="density-btn" class:active={density === "compact"} onclick={() => setDensity("compact")} title="Compact">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <button class="density-btn" class:active={density === "normal"} onclick={() => setDensity("normal")} title="Normal">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="4" x2="21" y2="4"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="20" x2="21" y2="20"/>
          </svg>
        </button>
        <button class="density-btn" class:active={density === "comfortable"} onclick={() => setDensity("comfortable")} title="Comfortable">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="3" x2="21" y2="3"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="21" x2="21" y2="21"/>
          </svg>
        </button>
      </div>
      <div class="filter-dropdown-container">
        <button class="filter-dropdown-btn" onclick={() => showFilterDropdown = !showFilterDropdown}>
          Filter ({$activitySelectedFilters.size}/{allFilterTypes.length})
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        {#if showFilterDropdown}
          <Backdrop onclose={() => showFilterDropdown = false} zIndex={10} />
          <div class="filter-dropdown-menu">
            <div class="filter-dropdown-actions">
              <button class="filter-action-btn" onclick={selectAllFilters}>All</button>
              <button class="filter-action-btn" onclick={clearAllFilters}>None</button>
            </div>
            <div class="filter-dropdown-options">
              {#each allFilterTypes as filter}
                <label class="filter-option">
                  <input type="checkbox" checked={$activitySelectedFilters.has(filter)} onchange={() => toggleFilter(filter)} />
                  <span class="filter-option-label" class:is-error={filter === "errors"}>{filter}</span>
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
      placeholder={$t("activity.searchPlaceholder")}
      bind:value={$activitySearchQuery}
    />
    <select class="filter-select" value={$selectedAccount ?? ""} onchange={(e) => selectedAccount.set(e.currentTarget.value || null)}>
      <option value="">{$t("common.all")} {$t("common.accounts")}</option>
      {#each $accountList as name}
        <option value={name}>{name}</option>
      {/each}
    </select>
    <a href={api.exportCsvUrl({ accountName: $selectedAccount ?? undefined })} class="export-btn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      {$t("activity.exportCsv")}
    </a>
    <span class="entry-count">{unifiedEntries.length} entries loaded</span>
  </div>

  <div class="scroll-container" bind:this={scrollContainer}>
    {#if loading}
      <div class="loading">{$t("common.loading")}</div>
    {:else if unifiedEntries.length === 0}
      <div class="empty">{$t("activity.noActivity")}</div>
    {:else}
      <table>
        <thead>
          <tr>
            <th>{$t("common.time")}</th>
            <th>{$t("common.account")}</th>
            <th>{$t("activity.subject")}</th>
            <th>{$t("common.actions")}</th>
            <th class="action-col"></th>
          </tr>
        </thead>
        <tbody>
          {#each unifiedEntries as entry}
            {#if entry.type === "activity"}
              <tr>
                <td class="time-cell" title={formatUtcTooltip(entry.data.createdAt)}>{formatTime(entry.data.createdAt)}</td>
                <td class="account-cell">{entry.data.accountName}</td>
                <td class="subject-cell">
                  {#if entry.data.subject}
                    {entry.data.subject}
                  {:else}
                    <span class="muted">-</span>
                  {/if}
                </td>
                <td class="actions-cell">
                  {#each entry.data.actions as action}
                    <span class="badge {getActionBadgeClass(action.type)}">
                      {formatAction(action)}
                    </span>
                  {/each}
                </td>
                <td class="action-col">
                  <button class="btn-icon" onclick={() => openPreview(entry.data)} title={$t("activity.preview")}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </td>
              </tr>
            {:else}
              <tr class="error-row">
                <td class="time-cell" title={formatUtcTooltip(entry.data.createdAt)}>{formatTime(entry.data.createdAt)}</td>
                <td class="account-cell">{entry.data.accountName}</td>
                <td class="subject-cell">
                  <span class="error-content">
                    <span class="error-indicator">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                    </span>
                    <span class="error-text">{entry.data.error}</span>
                  </span>
                </td>
                <td class="actions-cell">
                  <span class="badge badge-error">
                    Failed ({entry.data.attempts})
                  </span>
                </td>
                <td class="action-col">
                  <button class="btn-icon" onclick={() => openErrorPreview(entry.data)} title="View details">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>

      <!-- Sentinel for infinite scroll -->
      <div bind:this={bottomSentinel} class="scroll-sentinel">
        {#if loadingMore}
          <div class="loading-more">
            <span class="spinner"></span>
            Loading more...
          </div>
        {:else if !hasMore}
          <div class="end-of-list">End of activity log</div>
        {/if}
      </div>
    {/if}
  </div>
</div>

{#if showPreview && previewEntry}
  <EmailPreview entry={previewEntry} onclose={() => { showPreview = false; previewEntry = null; }} />
{/if}

{#if showErrorPreview && errorPreviewEntry}
  <Modal
    open={showErrorPreview}
    title="Dead Letter Details"
    onclose={() => { showErrorPreview = false; errorPreviewEntry = null; }}
    maxWidth="500px"
  >
    {#snippet children()}
      {#if errorPreviewEntry}
        <div class="error-preview-content">
          <div class="error-preview-row">
            <span class="error-preview-label">Account</span>
            <span class="error-preview-value">{errorPreviewEntry.accountName}</span>
          </div>
          <div class="error-preview-row">
            <span class="error-preview-label">Folder</span>
            <span class="error-preview-value">{errorPreviewEntry.folder}</span>
          </div>
          <div class="error-preview-row">
            <span class="error-preview-label">Message ID</span>
            <span class="error-preview-value error-preview-mono">{errorPreviewEntry.messageId}</span>
          </div>
          <div class="error-preview-row">
            <span class="error-preview-label">UID</span>
            <span class="error-preview-value">{errorPreviewEntry.uid}</span>
          </div>
          <div class="error-preview-row">
            <span class="error-preview-label">Attempts</span>
            <span class="error-preview-value">{errorPreviewEntry.attempts}</span>
          </div>
          <div class="error-preview-row">
            <span class="error-preview-label">First Failed</span>
            <span class="error-preview-value">{new Date(errorPreviewEntry.createdAt).toLocaleString()}</span>
          </div>
          <div class="error-preview-row">
            <span class="error-preview-label">Retry Status</span>
            <span class="error-preview-value">
              {#if errorPreviewEntry.retryStatus === "pending"}
                <span class="retry-status-badge retry-pending">Pending</span>
              {:else if errorPreviewEntry.retryStatus === "retrying"}
                <span class="retry-status-badge retry-active">Retrying</span>
              {:else if errorPreviewEntry.retryStatus === "exhausted"}
                <span class="retry-status-badge retry-exhausted">Exhausted</span>
              {:else if errorPreviewEntry.retryStatus === "success"}
                <span class="retry-status-badge retry-success">Success</span>
              {:else}
                <span class="retry-status-badge">Unknown</span>
              {/if}
            </span>
          </div>
          {#if errorPreviewEntry.nextRetryAt}
            <div class="error-preview-row">
              <span class="error-preview-label">Next Retry</span>
              <span class="error-preview-value">{new Date(errorPreviewEntry.nextRetryAt).toLocaleString()}</span>
            </div>
          {/if}
          {#if errorPreviewEntry.lastRetryAt}
            <div class="error-preview-row">
              <span class="error-preview-label">Last Retry</span>
              <span class="error-preview-value">{new Date(errorPreviewEntry.lastRetryAt).toLocaleString()}</span>
            </div>
          {/if}
          <div class="error-preview-row error-preview-row-full">
            <span class="error-preview-label">Error Message</span>
            <div class="error-preview-error">{errorPreviewEntry.error}</div>
          </div>
        </div>
      {/if}
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

  .density-toggle {
    display: flex;
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    padding: 2px;
  }

  .density-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .density-btn:hover {
    color: var(--text-primary);
  }

  .density-btn.active {
    background: var(--bg-secondary);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm);
  }

  .density-btn svg {
    width: 16px;
    height: 16px;
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
    left: 0;
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
    text-transform: capitalize;
  }

  .filter-option-label.is-error {
    color: var(--error);
  }

  .export-btn {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--text-primary);
    text-decoration: none;
    transition: all var(--transition-fast);
  }

  .export-btn:hover {
    background: var(--border-color);
    border-color: var(--border-subtle);
  }

  .export-btn svg {
    width: 16px;
    height: 16px;
    color: var(--text-secondary);
  }

  .entry-count {
    font-size: var(--text-xs);
    color: var(--text-muted);
    margin-left: auto;
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

  .scroll-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: auto;
    min-height: 300px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    text-align: left;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border-color);
    vertical-align: middle;
  }

  .density-compact th,
  .density-compact td {
    padding: var(--space-2) var(--space-3);
  }

  .density-comfortable th,
  .density-comfortable td {
    padding: var(--space-4) var(--space-5);
  }

  th {
    color: var(--text-muted);
    font-weight: 500;
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: var(--bg-tertiary);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  tbody tr {
    transition: background var(--transition-fast);
  }

  tbody tr:hover {
    background: var(--bg-tertiary);
  }

  .error-row {
    background: color-mix(in srgb, var(--warning) 5%, transparent);
  }

  .error-row:hover {
    background: color-mix(in srgb, var(--warning) 10%, transparent);
  }

  .time-cell {
    color: var(--text-muted);
    font-size: var(--text-sm);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .account-cell {
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .subject-cell {
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .error-content {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    max-width: 100%;
  }

  .error-indicator {
    display: flex;
    color: var(--warning);
    flex-shrink: 0;
  }

  .error-indicator svg {
    width: 16px;
    height: 16px;
  }

  .error-text {
    color: var(--warning);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .muted {
    color: var(--text-muted);
  }

  .actions-cell {
    white-space: nowrap;
  }

  .actions-cell .badge {
    margin-right: var(--space-1);
  }

  .actions-cell .badge:last-child {
    margin-right: 0;
  }

  .action-col {
    width: 48px;
    text-align: center;
    vertical-align: middle;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: var(--space-1) var(--space-2);
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .badge-move {
    background: var(--info-muted);
    color: var(--info);
  }

  .badge-flag {
    background: var(--warning-muted);
    color: var(--warning);
  }

  .badge-read {
    background: var(--success-muted);
    color: var(--success);
  }

  .badge-delete {
    background: var(--error-muted);
    color: var(--error);
  }

  .badge-noop {
    background: var(--bg-tertiary);
    color: var(--text-muted);
  }

  .badge-error {
    background: var(--warning-muted);
    color: var(--warning);
  }

  .btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
  }

  .btn-icon:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn-icon svg {
    width: 16px;
    height: 16px;
  }

  .loading,
  .empty {
    padding: var(--space-8);
    text-align: center;
    color: var(--text-muted);
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

  /* Error Preview Modal Content */
  .error-preview-content {
    display: flex;
    flex-direction: column;
  }

  .error-preview-row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--border-color);
  }

  .error-preview-row:last-child {
    border-bottom: none;
  }

  .error-preview-row-full {
    flex-direction: column;
    gap: var(--space-2);
  }

  .error-preview-label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-muted);
    min-width: 100px;
    flex-shrink: 0;
  }

  .error-preview-value {
    font-size: var(--text-sm);
    color: var(--text-primary);
    word-break: break-word;
  }

  .error-preview-mono {
    font-family: monospace;
    font-size: var(--text-xs);
  }

  .error-preview-error {
    background: var(--warning-muted);
    color: var(--warning);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-family: monospace;
    word-break: break-word;
    white-space: pre-wrap;
  }

  .retry-status-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px var(--space-2);
    font-size: var(--text-xs);
    font-weight: 500;
    border-radius: var(--radius-sm);
    text-transform: uppercase;
  }

  .retry-pending {
    background: var(--info-muted);
    color: var(--info);
  }

  .retry-active {
    background: color-mix(in srgb, var(--accent) 20%, transparent);
    color: var(--accent);
  }

  .retry-exhausted {
    background: var(--error-muted);
    color: var(--error);
  }

  .retry-success {
    background: var(--success-muted);
    color: var(--success);
  }
</style>
