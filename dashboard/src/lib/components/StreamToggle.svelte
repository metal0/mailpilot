<script lang="ts">
  interface Props {
    streaming: boolean;
    onchange: (streaming: boolean) => void;
    pendingCount?: number;
    label?: string;
  }

  let {
    streaming,
    onchange,
    pendingCount = 0,
    label = "Live",
  }: Props = $props();
</script>

<button
  class="stream-toggle"
  class:active={streaming}
  onclick={() => onchange(!streaming)}
  title={streaming ? "Pause live updates" : "Resume live updates"}
  aria-pressed={streaming}
  aria-label={streaming ? `${label} - streaming, click to pause` : `${label} - paused, click to resume`}
>
  {#if streaming}
    <svg class="icon icon-pause" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  {:else}
    <svg class="icon icon-play" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  {/if}
  <span class="label">{label}</span>
  {#if streaming}
    <span class="pulse"></span>
  {:else if pendingCount > 0}
    <span class="pending-badge">{pendingCount}</span>
  {/if}
</button>

<style>
  .stream-toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md, 0.375rem);
    font-size: var(--text-sm, 0.875rem);
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast, 0.15s ease);
    position: relative;
  }

  .stream-toggle:hover {
    background: var(--border-color);
    color: var(--text-primary);
  }

  .stream-toggle:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .stream-toggle.active {
    background: color-mix(in srgb, var(--success, #22c55e) 15%, var(--bg-tertiary));
    border-color: color-mix(in srgb, var(--success, #22c55e) 50%, var(--border-color));
    color: var(--success, #22c55e);
  }

  .stream-toggle.active:hover {
    background: color-mix(in srgb, var(--success, #22c55e) 25%, var(--bg-tertiary));
  }

  .icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .label {
    line-height: 1;
  }

  .pulse {
    width: 8px;
    height: 8px;
    background: var(--success, #22c55e);
    border-radius: 50%;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(0.8);
    }
  }

  .pending-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 var(--space-1, 0.25rem);
    background: var(--accent);
    color: white;
    font-size: var(--text-xs, 0.75rem);
    font-weight: 600;
    border-radius: 9999px;
    line-height: 1;
  }
</style>
