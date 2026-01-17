<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Modal from "./Modal.svelte";
  import {
    SHORTCUTS,
    shortcutsEnabled,
    showShortcutsHelp,
    currentScope,
    selectedIndex,
    matchesShortcut,
    isInputElement,
    getShortcutsForScope,
    formatShortcutKey,
  } from "../stores/shortcuts";

  interface Props {
    onTabSwitch?: (tab: number) => void;
    onToggleStream?: () => void;
    onFocusSearch?: () => void;
    onRetry?: () => void;
    onDismiss?: () => void;
    onOpenSelected?: () => void;
    itemCount?: number;
  }

  let {
    onTabSwitch,
    onToggleStream,
    onFocusSearch,
    onRetry,
    onDismiss,
    onOpenSelected,
    itemCount = 0,
  }: Props = $props();

  function safeCall<T>(fn: (() => T) | undefined): void {
    if (!fn) return;
    try {
      fn();
    } catch (error) {
      console.error("Keyboard shortcut handler error:", error);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!$shortcutsEnabled) return;
    if (isInputElement(event.target)) return;

    try {
      const scope = $currentScope;

      // Tab navigation (1-5)
      if (!event.ctrlKey && !event.altKey && !event.metaKey) {
        const num = parseInt(event.key, 10);
        if (num >= 1 && num <= 5) {
          event.preventDefault();
          safeCall(() => onTabSwitch?.(num));
          return;
        }
      }

      // Help modal
      if (matchesShortcut(event, SHORTCUTS.help)) {
        event.preventDefault();
        showShortcutsHelp.set(true);
        return;
      }

      // Escape - close modal or clear selection
      if (matchesShortcut(event, SHORTCUTS.escape)) {
        if ($showShortcutsHelp) {
          event.preventDefault();
          showShortcutsHelp.set(false);
          return;
        }
        if ($selectedIndex >= 0) {
          event.preventDefault();
          selectedIndex.set(-1);
          return;
        }
        return;
      }

      // Ctrl+, - Open settings
      if (matchesShortcut(event, SHORTCUTS.settings)) {
        event.preventDefault();
        safeCall(() => onTabSwitch?.(4));
        return;
      }

      // Scope-specific shortcuts
      if (scope === "activity" || scope === "logs") {
        // j/k - List navigation
        if (matchesShortcut(event, SHORTCUTS.down)) {
          event.preventDefault();
          if (itemCount > 0) {
            selectedIndex.update((i) => Math.min(i + 1, itemCount - 1));
          }
          return;
        }

        if (matchesShortcut(event, SHORTCUTS.up)) {
          event.preventDefault();
          if (itemCount > 0) {
            selectedIndex.update((i) => Math.max(i - 1, 0));
          }
          return;
        }

        // Enter - Open selected
        if (matchesShortcut(event, SHORTCUTS.open)) {
          if ($selectedIndex >= 0) {
            event.preventDefault();
            safeCall(onOpenSelected);
          }
          return;
        }

        // f or / - Focus search
        if (matchesShortcut(event, SHORTCUTS.search) || matchesShortcut(event, SHORTCUTS.searchAlt)) {
          event.preventDefault();
          safeCall(onFocusSearch);
          return;
        }

        // p - Toggle streaming
        if (matchesShortcut(event, SHORTCUTS.toggleStream)) {
          event.preventDefault();
          safeCall(onToggleStream);
          return;
        }

        // Activity-specific: r and d for dead letters
        if (scope === "activity") {
          if (matchesShortcut(event, SHORTCUTS.retry)) {
            if ($selectedIndex >= 0) {
              event.preventDefault();
              safeCall(onRetry);
            }
            return;
          }

          if (matchesShortcut(event, SHORTCUTS.dismiss)) {
            if ($selectedIndex >= 0) {
              event.preventDefault();
              safeCall(onDismiss);
            }
            return;
          }
        }
      }
    } catch (error) {
      console.error("Keyboard shortcut handler error:", error);
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener("keydown", handleKeydown);
  });

  // Group shortcuts by scope for display
  const groupedShortcuts = $derived(() => {
    const groups: Record<string, Array<{ id: string; key: string; description: string }>> = {
      Navigation: [],
      "List Actions": [],
      Other: [],
    };

    Object.entries(SHORTCUTS).forEach(([id, shortcut]) => {
      const formatted = {
        id,
        key: formatShortcutKey(shortcut),
        description: shortcut.description,
      };

      if (id.startsWith("tab") || id === "settings") {
        groups["Navigation"].push(formatted);
      } else if (["down", "up", "open", "retry", "dismiss", "search", "searchAlt", "toggleStream"].includes(id)) {
        groups["List Actions"].push(formatted);
      } else {
        groups["Other"].push(formatted);
      }
    });

    return groups;
  });
</script>

<Modal
  open={$showShortcutsHelp}
  title="Keyboard Shortcuts"
  onclose={() => showShortcutsHelp.set(false)}
  maxWidth="500px"
>
  {#snippet children()}
    <div class="shortcuts-content">
      {#each Object.entries(groupedShortcuts()) as [group, shortcuts]}
        {#if shortcuts.length > 0}
          <div class="shortcut-group">
            <h4 class="group-title">{group}</h4>
            <div class="shortcut-list">
              {#each shortcuts as { key, description }}
                <div class="shortcut-row">
                  <span class="shortcut-key">{key}</span>
                  <span class="shortcut-desc">{description}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      {/each}

      <div class="shortcuts-footer">
        <label class="toggle-label">
          <input
            type="checkbox"
            checked={$shortcutsEnabled}
            onchange={() => shortcutsEnabled.toggle()}
          />
          <span>Enable keyboard shortcuts</span>
        </label>
      </div>
    </div>
  {/snippet}
</Modal>

<style>
  .shortcuts-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .shortcut-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .group-title {
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin: 0;
  }

  .shortcut-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-1) 0;
  }

  .shortcut-key {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    background: var(--bg-tertiary);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    min-width: 60px;
    text-align: center;
  }

  .shortcut-desc {
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .shortcuts-footer {
    border-top: 1px solid var(--border-color);
    padding-top: var(--space-3);
    margin-top: var(--space-2);
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .toggle-label input {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }
</style>
