<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    connectionBlocked,
    blockReason,
    startConnectionMonitor,
    stopConnectionMonitor,
  } from "../stores/connection";
  import { t } from "../i18n";

  onMount(() => {
    startConnectionMonitor();
  });

  onDestroy(() => {
    stopConnectionMonitor();
  });
</script>

{#if $connectionBlocked}
  <div class="connection-blocker">
    <div class="blocker-content">
      <div class="blocker-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
        </svg>
      </div>
      <h2>{$t("connection.lost.title")}</h2>
      <p>
        {#if $blockReason === "both"}
          {$t("connection.lost.bothDown")}
        {:else}
          {$t("connection.lost.wsDown")}
        {/if}
      </p>
      <div class="blocker-spinner"></div>
      <p class="blocker-hint">{$t("connection.lost.retrying")}</p>
    </div>
  </div>
{/if}

<style>
  .connection-blocker {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .blocker-content {
    text-align: center;
    padding: var(--space-8);
    max-width: 400px;
  }

  .blocker-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto var(--space-5);
    color: var(--error);
    opacity: 0.9;
  }

  .blocker-icon svg {
    width: 100%;
    height: 100%;
  }

  h2 {
    margin: 0 0 var(--space-3);
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--text-primary);
  }

  p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-secondary);
    line-height: 1.6;
  }

  .blocker-spinner {
    width: 32px;
    height: 32px;
    margin: var(--space-5) auto;
    border: 3px solid var(--bg-tertiary);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .blocker-hint {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
