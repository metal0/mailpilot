<script lang="ts">
  import { stats, type AccountStatus } from "../stores/data";
  import { addToast } from "../stores/toast";
  import { t } from "../i18n";
  import * as api from "../api";
  import Backdrop from "./Backdrop.svelte";

  let openDropdown = $state<string | null>(null);
  let dropdownPosition = $state<{ top: number; right: number } | null>(null);
  let selectedAccounts = $state<Set<string>>(new Set());
  let bulkActionLoading = $state(false);

  // Smart hybrid timestamp formatting
  function formatLastScan(timestamp: string | null): string {
    if (!timestamp) return $t("accounts.never");

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    // Less than 24 hours: show relative time
    if (diffMs < 24 * 60 * 60 * 1000) {
      if (diffMins < 1) return $t("time.justNow");
      if (diffMins < 60) return `${diffMins}m ago`;
      return `${diffHours}h ago`;
    }

    // More than 24 hours: show date
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function formatUtcTooltip(timestamp: string | null): string {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
  }

  function getActionRate(account: AccountStatus): string | null {
    if (account.emailsProcessed === 0) return null;
    return Math.round((account.actionsTaken / account.emailsProcessed) * 100) + "%";
  }

  function hasRecentErrors(account: AccountStatus): boolean {
    return account.errors > 0;
  }

  function toggleDropdown(accountName: string, event: MouseEvent) {
    if (openDropdown === accountName) {
      openDropdown = null;
      dropdownPosition = null;
    } else {
      const button = event.currentTarget as HTMLElement;
      const rect = button.getBoundingClientRect();
      dropdownPosition = {
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      };
      openDropdown = accountName;
    }
  }

  function closeDropdown() {
    openDropdown = null;
    dropdownPosition = null;
  }

  function toggleAccountSelection(name: string) {
    const newSet = new Set(selectedAccounts);
    if (newSet.has(name)) {
      newSet.delete(name);
    } else {
      newSet.add(name);
    }
    selectedAccounts = newSet;
  }

  function toggleSelectAll() {
    const accounts = $stats?.accounts ?? [];

    if (selectedAccounts.size === accounts.length && accounts.length > 0) {
      selectedAccounts = new Set();
    } else {
      selectedAccounts = new Set(accounts.map(a => a.name));
    }
  }

  function clearSelection() {
    selectedAccounts = new Set();
  }

  async function bulkPause() {
    bulkActionLoading = true;
    const names = Array.from(selectedAccounts);
    let succeeded = 0;
    for (const name of names) {
      try {
        await api.pauseAccount(name);
        succeeded++;
      } catch { /* continue */ }
    }
    addToast(`Paused ${succeeded}/${names.length} accounts`, succeeded === names.length ? "success" : "warning");
    bulkActionLoading = false;
    clearSelection();
  }

  async function bulkResume() {
    bulkActionLoading = true;
    const names = Array.from(selectedAccounts);
    let succeeded = 0;
    for (const name of names) {
      try {
        await api.resumeAccount(name);
        succeeded++;
      } catch { /* continue */ }
    }
    addToast(`Resumed ${succeeded}/${names.length} accounts`, succeeded === names.length ? "success" : "warning");
    bulkActionLoading = false;
    clearSelection();
  }

  async function bulkReconnect() {
    bulkActionLoading = true;
    const names = Array.from(selectedAccounts);
    let succeeded = 0;
    for (const name of names) {
      try {
        await api.reconnectAccount(name);
        succeeded++;
      } catch { /* continue */ }
    }
    addToast(`Reconnected ${succeeded}/${names.length} accounts`, succeeded === names.length ? "success" : "warning");
    bulkActionLoading = false;
    clearSelection();
  }

  async function bulkProcess() {
    bulkActionLoading = true;
    const names = Array.from(selectedAccounts);
    let succeeded = 0;
    for (const name of names) {
      try {
        await api.triggerProcess(name);
        succeeded++;
      } catch { /* continue */ }
    }
    addToast(`Triggered processing for ${succeeded}/${names.length} accounts`, succeeded === names.length ? "success" : "warning");
    bulkActionLoading = false;
    clearSelection();
  }

  async function handlePause(account: AccountStatus) {
    closeDropdown();
    try {
      const result = account.paused
        ? await api.resumeAccount(account.name)
        : await api.pauseAccount(account.name);

      if (result.success) {
        addToast(`Account ${account.paused ? "resumed" : "paused"}`, "success");
      } else {
        addToast(`Failed to ${account.paused ? "resume" : "pause"} account`, "error");
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Operation failed", "error");
    }
  }

  async function handleReconnect(name: string) {
    closeDropdown();
    try {
      addToast(`Reconnecting ${name}...`, "info");
      const result = await api.reconnectAccount(name);
      if (result.success) {
        addToast(`Account reconnected`, "success");
      } else {
        addToast(`Failed to reconnect`, "error");
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Reconnect failed", "error");
    }
  }

  async function handleProcess(name: string) {
    closeDropdown();
    try {
      addToast(`Triggering processing for ${name}...`, "info");
      const result = await api.triggerProcess(name);
      if (result.success) {
        addToast(`Processing triggered`, "success");
      } else {
        addToast(`Failed to trigger processing`, "error");
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Process failed", "error");
    }
  }
</script>

<div class="card">
  <div class="card-header">
    <h2 class="card-title">{$t("common.accounts")}</h2>
  </div>

  {#if selectedAccounts.size > 0}
    <div class="bulk-actions-bar">
      <span class="selection-count">{selectedAccounts.size} selected</span>
      <div class="bulk-buttons">
        <button class="btn-sm" onclick={bulkPause} disabled={bulkActionLoading}>{$t("accounts.pauseSelected")}</button>
        <button class="btn-sm" onclick={bulkResume} disabled={bulkActionLoading}>{$t("accounts.resumeSelected")}</button>
        <button class="btn-sm btn-secondary" onclick={bulkReconnect} disabled={bulkActionLoading}>{$t("accounts.reconnectSelected")}</button>
        <button class="btn-sm btn-secondary" onclick={bulkProcess} disabled={bulkActionLoading}>{$t("accounts.processSelected")}</button>
        <button class="btn-sm btn-secondary" onclick={clearSelection}>{$t("common.cancel")}</button>
      </div>
    </div>
  {/if}

  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th class="checkbox-cell">
            <input type="checkbox" checked={selectedAccounts.size > 0} onchange={toggleSelectAll} />
          </th>
          <th>{$t("common.name")}</th>
          <th>Action Rate</th>
          <th>{$t("accounts.lastScan")}</th>
          <th class="actions-header"></th>
        </tr>
      </thead>
      <tbody>
        {#each $stats?.accounts ?? [] as account}
          <tr class:selected={selectedAccounts.has(account.name)}>
              <td class="checkbox-cell">
                <input
                  type="checkbox"
                  checked={selectedAccounts.has(account.name)}
                  onchange={() => toggleAccountSelection(account.name)}
                />
              </td>
              <td class="name-cell">
              <div class="name-cell-content">
                <span
                  class="status-dot-inline"
                  class:connected={account.connected && !account.paused}
                  class:paused={account.paused}
                  class:disconnected={!account.connected && !account.paused}
                  title={account.paused ? $t("accounts.paused") : account.connected ? $t("accounts.connected") : $t("accounts.disconnected")}
                ></span>
                {#if account.paused}
                  <span class="status-text paused">{$t("accounts.paused")}</span>
                {/if}
                {#if hasRecentErrors(account)}
                  <span class="error-indicator" title="{account.errors} errors - check logs">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </span>
                {/if}
                <span class="account-name">{account.name}</span>
                {#if account.idleSupported && account.connected && !account.paused}
                  <span class="idle-badge">{$t("accounts.idle")}</span>
                {/if}
                <span class="llm-info">{account.llmProvider}/{account.llmModel}</span>
              </div>
            </td>
              <td class="rate-cell">
                {#if getActionRate(account)}
                  <span class="rate-value">{getActionRate(account)}</span>
                {:else}
                  <span class="rate-empty">—</span>
                {/if}
              </td>
              <td class="time-cell">
                <span class="time-value" title={formatUtcTooltip(account.lastScan)}>{formatLastScan(account.lastScan)}</span>
              </td>
              <td class="actions-cell">
                <button class="action-btn" onclick={(e) => toggleDropdown(account.name, e)} title={$t("common.actions")}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="6" r="2"/>
                    <circle cx="12" cy="12" r="2"/>
                    <circle cx="12" cy="18" r="2"/>
                  </svg>
                </button>
                {#if openDropdown === account.name && dropdownPosition}
                  <Backdrop onclose={closeDropdown} zIndex={10} />
                  <div
                    class="dropdown-menu"
                    style="position: fixed; top: {dropdownPosition.top}px; right: {dropdownPosition.right}px;"
                  >
                    <button class="dropdown-item" onclick={() => handlePause(account)}>
                      {account.paused ? $t("accounts.resume") : $t("accounts.pause")}
                    </button>
                    <button class="dropdown-item" onclick={() => handleReconnect(account.name)}>
                      {$t("accounts.reconnect")}
                    </button>
                    <button class="dropdown-item" onclick={() => handleProcess(account.name)}>
                      {$t("accounts.processNow")}
                    </button>
                  </div>
                {/if}
              </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
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

  .bulk-actions-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-5);
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);
  }

  .selection-count {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--accent);
  }

  .bulk-buttons {
    display: flex;
    gap: var(--space-2);
  }

  .checkbox-cell {
    width: 2.5rem;
    text-align: center;
  }

  .checkbox-cell input {
    cursor: pointer;
    accent-color: var(--accent);
  }

  tr.selected {
    background: color-mix(in srgb, var(--accent) 8%, transparent);
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

  .name-cell-content {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .status-dot-inline {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-dot-inline.connected {
    background: var(--success);
    box-shadow: 0 0 4px var(--success);
  }

  .status-dot-inline.paused {
    background: var(--warning);
  }

  .status-dot-inline.disconnected {
    background: var(--error);
  }

  .status-text {
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .status-text.paused {
    color: var(--warning);
  }

  .status-text.disconnected {
    color: var(--error);
  }

  .error-indicator {
    display: flex;
    align-items: center;
    color: var(--warning);
    flex-shrink: 0;
  }

  .error-indicator svg {
    width: 16px;
    height: 16px;
  }

  .account-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .idle-badge {
    padding: var(--space-1) var(--space-2);
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .llm-info {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .rate-cell {
    font-variant-numeric: tabular-nums;
  }

  .rate-value {
    font-weight: 600;
    color: var(--text-primary);
  }

  .rate-empty {
    color: var(--text-muted);
  }

  .time-cell {
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }

  .time-value {
    font-variant-numeric: tabular-nums;
  }

  .actions-header {
    width: 48px;
  }

  .actions-cell {
    text-align: center;
    position: relative;
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    color: var(--text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .action-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .action-btn svg {
    width: 18px;
    height: 18px;
  }

  .btn-sm {
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-xs);
    font-weight: 500;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-sm:hover:not(:disabled) {
    background: var(--accent-hover);
  }

  .btn-sm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-sm.btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn-sm.btn-secondary:hover:not(:disabled) {
    background: var(--border-color);
  }

  .dropdown-menu {
    min-width: 140px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    overflow: hidden;
  }

  .dropdown-item {
    display: block;
    width: 100%;
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    text-align: left;
    background: none;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .dropdown-item:hover {
    background: var(--bg-tertiary);
  }

  @media (max-width: 768px) {
    .llm-info {
      display: none;
    }

    .idle-badge {
      display: none;
    }
  }
</style>
