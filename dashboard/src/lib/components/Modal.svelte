<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    open: boolean;
    title: string;
    onclose: () => void;
    variant?: "default" | "warning" | "danger";
    maxWidth?: string;
    showCloseButton?: boolean;
    children: Snippet;
    actions?: Snippet;
  }

  let {
    open,
    title,
    onclose,
    variant = "default",
    maxWidth = "500px",
    showCloseButton = true,
    children,
    actions,
  }: Props = $props();

  let modalRef: HTMLDivElement | null = $state(null);
  let previouslyFocused: HTMLElement | null = null;

  function handleKeydown(e: KeyboardEvent) {
    if (!open) return;

    if (e.key === "Escape") {
      e.preventDefault();
      onclose();
      return;
    }

    if (e.key === "Tab" && modalRef) {
      trapFocus(e);
    }
  }

  function trapFocus(e: KeyboardEvent) {
    if (!modalRef) return;

    const focusableElements = modalRef.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const focusable = Array.from(focusableElements).filter(
      (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
    );

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onclose();
    }
  }

  $effect(() => {
    if (open) {
      previouslyFocused = document.activeElement as HTMLElement;
      // Focus the modal on next tick
      setTimeout(() => {
        modalRef?.focus();
      }, 0);
    } else if (previouslyFocused) {
      previouslyFocused.focus();
      previouslyFocused = null;
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div
    class="modal-overlay"
    onclick={handleBackdropClick}
    role="presentation"
  >
    <div
      bind:this={modalRef}
      class="modal modal-{variant}"
      class:has-icon={variant !== "default"}
      style="max-width: {maxWidth}"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      tabindex="-1"
    >
      {#if variant === "warning"}
        <div class="modal-icon warning-icon">&#9888;</div>
      {:else if variant === "danger"}
        <div class="modal-icon danger-icon">&#9888;</div>
      {/if}

      <div class="modal-header">
        <h3 id="modal-title">{title}</h3>
        {#if showCloseButton && variant === "default"}
          <button class="close-btn" onclick={onclose} aria-label="Close modal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        {/if}
      </div>

      <div class="modal-body">
        {@render children()}
      </div>

      {#if actions}
        <div class="modal-actions">
          {@render actions()}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 1rem;
  }

  .modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg, 0.5rem);
    width: 100%;
    display: flex;
    flex-direction: column;
    max-height: 90vh;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  }

  .modal:focus {
    outline: none;
  }

  .modal.has-icon {
    text-align: center;
    padding-top: var(--space-4, 1rem);
  }

  .modal-icon {
    font-size: 2.5rem;
    margin-bottom: var(--space-2, 0.5rem);
  }

  .warning-icon {
    color: var(--warning);
  }

  .danger-icon {
    color: var(--error);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4, 1rem) var(--space-5, 1.25rem);
    border-bottom: 1px solid var(--border-color);
  }

  .has-icon .modal-header {
    border-bottom: none;
    padding-top: 0;
    justify-content: center;
  }

  .modal-header h3 {
    margin: 0;
    font-size: var(--text-lg, 1.125rem);
    font-weight: 600;
    color: var(--text-primary);
  }

  .modal-warning .modal-header h3 {
    color: var(--warning);
  }

  .modal-danger .modal-header h3 {
    color: var(--error);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: var(--radius-sm, 0.25rem);
    flex-shrink: 0;
  }

  .close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .close-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .close-btn svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-5, 1.25rem);
  }

  .has-icon .modal-body {
    padding-top: 0;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3, 0.75rem);
    padding: var(--space-4, 1rem) var(--space-5, 1.25rem);
    border-top: 1px solid var(--border-color);
  }

  .has-icon .modal-actions {
    justify-content: center;
    border-top: none;
    padding-top: var(--space-3, 0.75rem);
  }
</style>
