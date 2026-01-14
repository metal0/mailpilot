<script lang="ts">
  import { onMount } from "svelte";
  import { filteredActivity, searchQuery, selectedAccount, accountList, type AuditEntry } from "../stores/data";
  import * as api from "../api";
  import EmailPreview from "./EmailPreview.svelte";

  let loading = $state(false);
  let page = $state(1);
  let totalPages = $state(1);
  let actionTypeFilter = $state("");
  let showPreview = $state(false);
  let previewEntry: AuditEntry | null = $state(null);

  const actionTypes = ["move", "flag", "read", "delete", "spam", "noop"];

  async function loadActivity() {
    loading = true;
    try {
      const params: api.ActivityParams = {
        page,
        pageSize: 20,
      };
      if ($selectedAccount) params.accountName = $selectedAccount;
      if ($searchQuery) params.search = $searchQuery;
      if (actionTypeFilter) params.actionType = actionTypeFilter;

      const result = await api.fetchActivity(params);
      totalPages = result.totalPages;
    } catch (e) {
      console.error("Failed to load activity:", e);
    } finally {
      loading = false;
    }
  }

  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
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

  // Reload when filters change
  $effect(() => {
    if ($selectedAccount !== undefined || $searchQuery !== undefined || actionTypeFilter !== undefined) {
      page = 1;
      loadActivity();
    }
  });

  onMount(() => {
    loadActivity();
  });
</script>

<div class="card">
  <div class="card-header">
    <h2 class="card-title">Activity Log</h2>
    <div class="filters">
      <input
        type="text"
        class="search-input"
        placeholder="Search by subject or message ID..."
        bind:value={$searchQuery}
      />
      <select class="filter-select" bind:value={$selectedAccount}>
        <option value={null}>All Accounts</option>
        {#each $accountList as name}
          <option value={name}>{name}</option>
        {/each}
      </select>
      <select class="filter-select" bind:value={actionTypeFilter}>
        <option value="">All Actions</option>
        {#each actionTypes as type}
          <option value={type}>{type}</option>
        {/each}
      </select>
      <a href={api.exportCsvUrl({ accountName: $selectedAccount ?? undefined })} class="btn btn-secondary btn-sm">
        Export CSV
      </a>
    </div>
  </div>

  <div class="table-container">
    {#if loading}
      <div class="loading">Loading...</div>
    {:else if $filteredActivity.length === 0}
      <div class="empty">No activity yet</div>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Account</th>
            <th>Subject</th>
            <th>Actions</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each $filteredActivity as entry}
            <tr>
              <td class="time-cell">{formatTime(entry.createdAt)}</td>
              <td>{entry.accountName}</td>
              <td class="subject-cell">
                {#if entry.subject}
                  {entry.subject}
                {:else}
                  <span class="muted">-</span>
                {/if}
              </td>
              <td class="actions-cell">
                {#each entry.actions as action}
                  <span class="badge {getActionBadgeClass(action.type)}">
                    {formatAction(action)}
                  </span>
                {/each}
              </td>
              <td>
                <button class="btn-icon" onclick={() => openPreview(entry)} title="Preview">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  {#if totalPages > 1}
    <div class="pagination">
      <button class="btn btn-sm" disabled={page <= 1} onclick={() => { page--; loadActivity(); }}>
        Previous
      </button>
      <span class="page-info">Page {page} of {totalPages}</span>
      <button class="btn btn-sm" disabled={page >= totalPages} onclick={() => { page++; loadActivity(); }}>
        Next
      </button>
    </div>
  {/if}
</div>

{#if showPreview && previewEntry}
  <EmailPreview entry={previewEntry} onclose={() => { showPreview = false; previewEntry = null; }} />
{/if}

<style>
  .card {
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border-color);
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .card-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }

  .filters {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .search-input {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.375rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    min-width: 250px;
  }

  .search-input::placeholder {
    color: var(--text-muted);
  }

  .filter-select {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.375rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
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
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color);
  }

  th {
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .time-cell {
    color: var(--text-muted);
    font-size: 0.875rem;
    white-space: nowrap;
  }

  .subject-cell {
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .muted {
    color: var(--text-muted);
  }

  .actions-cell {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    background: var(--bg-tertiary);
    border-radius: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .badge-move {
    background: #1e3a5f;
    color: #60a5fa;
  }

  .badge-flag {
    background: #3f2f1d;
    color: #fbbf24;
  }

  .badge-read {
    background: #1a3329;
    color: #4ade80;
  }

  .badge-delete {
    background: #3b1c1c;
    color: #f87171;
  }

  .badge-noop {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }

  .btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 0.25rem;
  }

  .btn-icon:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn-icon svg {
    width: 1rem;
    height: 1rem;
  }

  .loading,
  .empty {
    padding: 2rem;
    text-align: center;
    color: var(--text-muted);
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    border-top: 1px solid var(--border-color);
  }

  .page-info {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: background 0.2s;
    text-decoration: none;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--border-color);
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }

  @media (max-width: 768px) {
    .filters {
      width: 100%;
    }

    .search-input {
      min-width: 100%;
    }
  }
</style>
