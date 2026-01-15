<script lang="ts">
  import { onMount } from "svelte";
  import { searchQuery, selectedAccount, accountList, deadLetters, type AuditEntry, type DeadLetterEntry } from "../stores/data";
  import { t } from "../i18n";
  import * as api from "../api";
  import EmailPreview from "./EmailPreview.svelte";

  type Density = "compact" | "normal" | "comfortable";
  type UnifiedEntry =
    | { type: "activity"; data: AuditEntry }
    | { type: "error"; data: DeadLetterEntry };

  let { initialFilter = "all" as "all" | "errors" } = $props();

  let loading = $state(false);
  let page = $state(1);
  let totalPages = $state(1);
  let lineLimit = $state<number>(
    (typeof localStorage !== "undefined" && parseInt(localStorage.getItem("activity-line-limit") || "25", 10)) || 25
  );

  const allFilterTypes = ["move", "flag", "read", "delete", "spam", "noop", "errors"];
  let selectedFilters = $state<Set<string>>(new Set(initialFilter === "errors" ? ["errors"] : allFilterTypes));
  let showFilterDropdown = $state(false);

  $effect(() => {
    if (initialFilter === "errors") {
      selectedFilters = new Set(["errors"]);
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

  function setLineLimit(limit: number) {
    lineLimit = limit;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("activity-line-limit", limit.toString());
    }
  }

  function toggleFilter(filter: string) {
    const newSet = new Set(selectedFilters);
    if (newSet.has(filter)) {
      newSet.delete(filter);
    } else {
      newSet.add(filter);
    }
    selectedFilters = newSet;
  }

  function selectAllFilters() {
    selectedFilters = new Set(allFilterTypes);
  }

  function clearAllFilters() {
    selectedFilters = new Set();
  }

  const actionFilterTypes = ["move", "flag", "read", "delete", "spam", "noop"];
  const hasActionFilters = $derived(actionFilterTypes.some(t => selectedFilters.has(t)));
  const hasErrorFilter = $derived(selectedFilters.has("errors"));
  const selectedActionTypes = $derived(actionFilterTypes.filter(t => selectedFilters.has(t)));

  const unifiedEntries = $derived.by(() => {
    const entries: UnifiedEntry[] = [];

    if (hasActionFilters) {
      // Use paginated entries from API (already filtered by backend)
      for (const entry of paginatedEntries) {
        entries.push({ type: "activity", data: entry });
      }
    }

    if (hasErrorFilter) {
      for (const deadLetter of $deadLetters) {
        const matchesAccount = !$selectedAccount || deadLetter.accountName === $selectedAccount;
        const matchesSearch = !$searchQuery ||
          deadLetter.error.toLowerCase().includes($searchQuery.toLowerCase()) ||
          deadLetter.messageId.toLowerCase().includes($searchQuery.toLowerCase()) ||
          deadLetter.accountName.toLowerCase().includes($searchQuery.toLowerCase());

        if (matchesAccount && matchesSearch) {
          entries.push({ type: "error", data: deadLetter });
        }
      }
    }

    // Sort by time, newest first
    return entries.sort((a, b) => {
      const timeA = a.type === "activity" ? a.data.createdAt : a.data.createdAt;
      const timeB = b.type === "activity" ? b.data.createdAt : b.data.createdAt;
      return timeB - timeA;
    });
  });

  // Local state for paginated activity entries
  let paginatedEntries = $state<AuditEntry[]>([]);

  async function loadActivity() {
    loading = true;
    try {
      const params: api.ActivityParams = {
        page,
        pageSize: lineLimit,
      };
      if ($selectedAccount) params.accountName = $selectedAccount;
      if ($searchQuery) params.search = $searchQuery;

      // Send action type filters to backend for proper pagination
      const actionTypes = actionFilterTypes.filter(t => selectedFilters.has(t));
      if (actionTypes.length > 0 && actionTypes.length < actionFilterTypes.length) {
        params.actionTypes = actionTypes;
      }

      const result = await api.fetchActivity(params);
      paginatedEntries = result.entries;
      totalPages = result.totalPages;
    } catch (e) {
      console.error("Failed to load activity:", e);
    } finally {
      loading = false;
    }
  }

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

  // Reload when filters or line limit change
  $effect(() => {
    // Track dependencies
    const _account = $selectedAccount;
    const _search = $searchQuery;
    const _limit = lineLimit;
    const _filters = [...selectedFilters]; // Track filter changes

    page = 1;
    loadActivity();
  });

  onMount(() => {
    loadActivity();
  });
</script>

<div class="card" class:density-compact={density === "compact"} class:density-comfortable={density === "comfortable"}>
  <div class="card-header">
    <h2 class="card-title">{$t("activity.title")}</h2>
    <div class="header-controls">
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
          Filter ({selectedFilters.size}/{allFilterTypes.length})
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        {#if showFilterDropdown}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <div class="filter-dropdown-backdrop" onclick={() => showFilterDropdown = false}></div>
          <div class="filter-dropdown-menu">
            <div class="filter-dropdown-actions">
              <button class="filter-action-btn" onclick={selectAllFilters}>All</button>
              <button class="filter-action-btn" onclick={clearAllFilters}>None</button>
            </div>
            <div class="filter-dropdown-options">
              {#each allFilterTypes as filter}
                <label class="filter-option">
                  <input type="checkbox" checked={selectedFilters.has(filter)} onchange={() => toggleFilter(filter)} />
                  <span class="filter-option-label" class:is-error={filter === "errors"}>{filter}</span>
                </label>
              {/each}
            </div>
          </div>
        {/if}
      </div>
      <select class="line-limit-select" bind:value={lineLimit} onchange={(e) => setLineLimit(parseInt(e.currentTarget.value, 10))}>
        <option value={10}>10 rows</option>
        <option value={25}>25 rows</option>
        <option value={50}>50 rows</option>
        <option value={100}>100 rows</option>
      </select>
    </div>
  </div>

  <div class="filters-bar">
    <input
      type="text"
      class="search-input"
      placeholder={$t("activity.searchPlaceholder")}
      bind:value={$searchQuery}
    />
    <select class="filter-select" bind:value={$selectedAccount}>
      <option value={null}>{$t("common.all")} {$t("common.accounts")}</option>
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
  </div>

  <div class="table-container">
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
                <td class="subject-cell error-subject">
                  <span class="error-indicator">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </span>
                  <span class="error-text">{entry.data.error}</span>
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
    {/if}
  </div>

  {#if totalPages > 1}
    <div class="pagination">
      <button class="btn btn-sm" disabled={page <= 1} onclick={() => { page--; loadActivity(); }}>
        &laquo;
      </button>
      <span class="page-info">{$t("activity.page")} {page} {$t("activity.of")} {totalPages}</span>
      <button class="btn btn-sm" disabled={page >= totalPages} onclick={() => { page++; loadActivity(); }}>
        &raquo;
      </button>
    </div>
  {/if}
</div>

{#if showPreview && previewEntry}
  <EmailPreview entry={previewEntry} onclose={() => { showPreview = false; previewEntry = null; }} />
{/if}

{#if showErrorPreview && errorPreviewEntry}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="error-preview-overlay" onclick={() => { showErrorPreview = false; errorPreviewEntry = null; }}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="error-preview-modal" onclick={(e) => e.stopPropagation()}>
      <div class="error-preview-header">
        <h3>Dead Letter Details</h3>
        <button class="btn-close" onclick={() => { showErrorPreview = false; errorPreviewEntry = null; }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
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
        <div class="error-preview-row error-preview-row-full">
          <span class="error-preview-label">Error Message</span>
          <div class="error-preview-error">{errorPreviewEntry.error}</div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-5);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--border-color);
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


  .line-limit-select {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .line-limit-select:focus {
    outline: none;
    border-color: var(--accent);
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

  .filter-dropdown-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10;
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

  .filters-bar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-5);
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);
    flex-wrap: wrap;
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

  .table-container {
    overflow-x: auto;
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
  }

  /* Density variations */
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
  }

  tbody tr {
    transition: background var(--transition-fast);
  }

  tbody tr:hover {
    background: var(--bg-tertiary);
  }

  tbody tr:last-child td {
    border-bottom: none;
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

  .error-subject {
    display: flex;
    align-items: center;
    gap: var(--space-2);
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

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4);
    border-top: 1px solid var(--border-color);
  }

  .page-info {
    color: var(--text-secondary);
    font-size: var(--text-sm);
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
    transition: all var(--transition-fast);
    text-decoration: none;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--border-color);
  }

  .btn-sm {
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-xs);
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

  /* Error Preview Modal */
  .error-preview-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: var(--space-4);
  }

  .error-preview-modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 500px;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-lg);
  }

  .error-preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4);
    border-bottom: 1px solid var(--border-color);
  }

  .error-preview-header h3 {
    margin: 0;
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--text-primary);
  }

  .btn-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    color: var(--text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-close:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn-close svg {
    width: 18px;
    height: 18px;
  }

  .error-preview-content {
    padding: var(--space-4);
    overflow-y: auto;
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
</style>
