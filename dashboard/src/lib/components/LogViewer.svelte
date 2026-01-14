<script lang="ts">
  import { onMount } from "svelte";
  import { filteredLogs, logLevel, selectedAccount, accountList } from "../stores/data";
  import { t } from "../i18n";
  import * as api from "../api";

  let loading = $state(false);
  let searchQuery = $state("");
  let lineLimit = $state<number>(
    (typeof localStorage !== "undefined" && parseInt(localStorage.getItem("logs-line-limit") || "25", 10)) || 25
  );

  function setLineLimit(limit: number) {
    lineLimit = limit;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("logs-line-limit", limit.toString());
    }
  }

  const searchedLogs = $derived.by(() => {
    const filtered = searchQuery
      ? $filteredLogs.filter(log =>
          log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.context.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (log.meta && JSON.stringify(log.meta).toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : $filteredLogs;
    return filtered.slice(0, lineLimit);
  });

  async function loadLogs() {
    loading = true;
    try {
      const params: api.LogParams = { limit: 200 };
      if ($logLevel) params.level = $logLevel;

      const result = await api.fetchLogs(params);
      // Logs are also updated via WebSocket, but this is for initial load
    } catch (e) {
      console.error("Failed to load logs:", e);
    } finally {
      loading = false;
    }
  }

  function formatTime(timestamp: string): string {
    // Extract just the time portion (HH:MM:SS)
    return timestamp.substring(11, 19);
  }

  function formatUtcTooltip(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
  }

  function getLevelClass(level: string): string {
    return `level-${level}`;
  }

  onMount(() => {
    loadLogs();
  });
</script>

<div class="card">
  <div class="card-header">
    <h2 class="card-title">{$t("logs.title")}</h2>
    <div class="filters">
      <input
        type="text"
        class="search-input"
        placeholder={$t("common.search")}
        bind:value={searchQuery}
      />
      <select class="filter-select" bind:value={$selectedAccount}>
        <option value={null}>{$t("common.all")} {$t("common.accounts")}</option>
        {#each $accountList as name}
          <option value={name}>{name}</option>
        {/each}
      </select>
      <select class="filter-select" bind:value={$logLevel}>
        <option value="">{$t("common.all")}</option>
        <option value="debug">{$t("logs.debug")}</option>
        <option value="info">{$t("logs.info")}</option>
        <option value="warn">{$t("logs.warn")}</option>
        <option value="error">{$t("logs.error")}</option>
      </select>
      <select class="filter-select" bind:value={lineLimit} onchange={(e) => setLineLimit(parseInt(e.currentTarget.value, 10))}>
        <option value={10}>10 rows</option>
        <option value={25}>25 rows</option>
        <option value={50}>50 rows</option>
        <option value={100}>100 rows</option>
      </select>
      <button class="btn btn-sm" onclick={loadLogs}>{$t("common.refresh")}</button>
    </div>
  </div>

  <div class="logs-container">
    {#if loading}
      <div class="loading">{$t("common.loading")}</div>
    {:else if searchedLogs.length === 0}
      <div class="empty">{$t("logs.noLogs")}</div>
    {:else}
      {#each searchedLogs as log}
        <div class="log-entry {getLevelClass(log.level)}">
          <span class="log-time" title={formatUtcTooltip(log.timestamp)}>{formatTime(log.timestamp)}</span>
          <span class="log-level">{log.level.toUpperCase()}</span>
          <span class="log-context">[{log.context}]</span>
          <span class="log-message">{log.message}</span>
          {#if log.meta}
            <span class="log-meta">{JSON.stringify(log.meta)}</span>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .card {
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    display: flex;
    flex-direction: column;
    min-height: calc(100vh - 220px);
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
    width: 200px;
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

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
  }

  .btn:hover {
    background: var(--accent-hover);
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }

  .logs-container {
    flex: 1;
    overflow-y: auto;
    font-family: monospace;
    font-size: 0.75rem;
  }

  .loading,
  .empty {
    padding: 2rem;
    text-align: center;
    color: var(--text-muted);
  }

  .log-entry {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.375rem 1rem;
    border-bottom: 1px solid var(--bg-primary);
  }

  .log-entry:hover {
    background: var(--bg-tertiary);
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
</style>
