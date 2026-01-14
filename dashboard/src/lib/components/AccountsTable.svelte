<script lang="ts">
  import { stats, type AccountStatus } from "../stores/data";
  import { addToast } from "../stores/toast";
  import { t } from "../i18n";
  import * as api from "../api";

  let openDropdown = $state<string | null>(null);
  let dropdownPosition = $state<{ top: number; right: number } | null>(null);
  let selectedAccounts = $state<Set<string>>(new Set());
  let bulkActionLoading = $state(false);

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
          <th>LLM</th>
          <th>{$t("accounts.lastScan")}</th>
          <th class="num">{$t("accounts.processed")}</th>
          <th class="num">{$t("common.actions")}</th>
          <th class="num">{$t("accounts.errorsCount")}</th>
          <th>{$t("common.actions")}</th>
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
                <span
                  class="status-indicator"
                  class:connected={account.connected}
                  class:paused={account.paused}
                  title={account.paused ? $t("accounts.paused") : account.connected ? $t("accounts.connected") : $t("accounts.disconnected")}
                ></span>
                {account.name}
                {#if account.idleSupported}
                  <span class="badge">{$t("accounts.idle")}</span>
                {/if}
                {#if account.paused}
                  <span class="badge badge-warning">{$t("accounts.paused")}</span>
                {/if}
              </td>
              <td class="llm-cell">{account.llmProvider}/{account.llmModel}</td>
              <td class="time-cell">{account.lastScan ?? $t("accounts.never")}</td>
              <td class="num">{account.emailsProcessed}</td>
              <td class="num">{account.actionsTaken}</td>
              <td class="num errors">{account.errors}</td>
              <td class="actions-cell">
                <div class="dropdown">
                  <button class="btn-sm btn-secondary dropdown-toggle" onclick={(e) => toggleDropdown(account.name, e)}>
                    {$t("common.actions")}
                  </button>
                  {#if openDropdown === account.name && dropdownPosition}
                    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                    <div class="dropdown-backdrop" onclick={closeDropdown}></div>
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
                </div>
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
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border-color);
  }

  .card-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }

  .bulk-actions-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.25rem;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);
  }

  .selection-count {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .bulk-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .checkbox-cell {
    width: 2.5rem;
    text-align: center;
  }

  .checkbox-cell input {
    cursor: pointer;
  }

  tr.selected {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
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

  .num {
    text-align: right;
  }

  .name-cell {
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-indicator {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--error);
    flex-shrink: 0;
  }

  .status-indicator.connected {
    background: var(--success);
  }

  .status-indicator.paused {
    background: var(--warning);
  }

  .llm-cell,
  .time-cell {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .errors {
    color: var(--error);
  }

  .badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    background: var(--bg-tertiary);
    border-radius: 0.25rem;
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
    margin-left: 0.5rem;
  }

  .badge-warning {
    background: #78350f;
    color: var(--warning);
  }

  .actions-cell {
    white-space: nowrap;
  }

  .btn-sm {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    margin-right: 0.25rem;
  }

  .btn-sm:hover {
    background: var(--accent-hover);
  }

  .btn-sm.btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn-sm.btn-secondary:hover {
    background: var(--border-color);
  }

  .dropdown {
    position: relative;
    display: inline-block;
  }

  .dropdown-toggle::after {
    content: "";
    display: inline-block;
    margin-left: 0.375rem;
    border-top: 0.3em solid;
    border-right: 0.3em solid transparent;
    border-left: 0.3em solid transparent;
  }

  .dropdown-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10;
  }

  .dropdown-menu {
    min-width: 120px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    overflow: hidden;
  }

  .dropdown-item {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
    text-align: left;
    background: none;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    transition: background 0.15s;
  }

  .dropdown-item:hover {
    background: var(--bg-tertiary);
  }

  @media (max-width: 1024px) {
    .actions-cell {
      display: none;
    }
  }
</style>
