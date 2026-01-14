<script lang="ts">
  import { stats, selectedAccount, type AccountStatus } from "../stores/data";
  import { addToast } from "../stores/toast";
  import * as api from "../api";

  async function handlePause(account: AccountStatus) {
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
    <h2 class="card-title">Accounts</h2>
    <select class="filter-select" bind:value={$selectedAccount}>
      <option value={null}>All Accounts</option>
      {#each $stats?.accounts ?? [] as account}
        <option value={account.name}>{account.name}</option>
      {/each}
    </select>
  </div>

  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Status</th>
          <th>LLM</th>
          <th>Last Scan</th>
          <th class="num">Processed</th>
          <th class="num">Actions</th>
          <th class="num">Errors</th>
          <th>Manage</th>
        </tr>
      </thead>
      <tbody>
        {#each $stats?.accounts ?? [] as account}
          {#if !$selectedAccount || $selectedAccount === account.name}
            <tr>
              <td class="name-cell">{account.name}</td>
              <td>
                <span class="status status-{account.connected ? 'connected' : 'disconnected'}">
                  <span class="status-dot"></span>
                  {account.connected ? "Connected" : "Disconnected"}
                </span>
                {#if account.idleSupported}
                  <span class="badge">IDLE</span>
                {/if}
                {#if account.paused}
                  <span class="badge badge-warning">Paused</span>
                {/if}
              </td>
              <td class="llm-cell">{account.llmProvider}/{account.llmModel}</td>
              <td class="time-cell">{account.lastScan ?? "Never"}</td>
              <td class="num">{account.emailsProcessed}</td>
              <td class="num">{account.actionsTaken}</td>
              <td class="num errors">{account.errors}</td>
              <td class="actions-cell">
                <button class="btn-sm" onclick={() => handlePause(account)}>
                  {account.paused ? "Resume" : "Pause"}
                </button>
                <button class="btn-sm btn-secondary" onclick={() => handleReconnect(account.name)}>
                  Reconnect
                </button>
                <button class="btn-sm btn-secondary" onclick={() => handleProcess(account.name)}>
                  Process
                </button>
              </td>
            </tr>
          {/if}
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

  .num {
    text-align: right;
  }

  .name-cell {
    font-weight: 500;
  }

  .llm-cell,
  .time-cell {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .errors {
    color: var(--error);
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }

  .status-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
  }

  .status-connected .status-dot {
    background: var(--success);
  }

  .status-disconnected .status-dot {
    background: var(--error);
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

  @media (max-width: 1024px) {
    .actions-cell {
      display: none;
    }
  }
</style>
