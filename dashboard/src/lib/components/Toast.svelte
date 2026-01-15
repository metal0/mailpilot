<script lang="ts">
  import { toasts, removeToast } from "../stores/toast";
</script>

<div class="toast-container">
  {#each $toasts as toast (toast.id)}
    <div class="toast toast-{toast.type}" role="alert">
      <span class="toast-message">{toast.message}</span>
      <button class="toast-close" onclick={() => removeToast(toast.id)} aria-label="Close">
        &times;
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 400px;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
    animation: slideIn 0.3s ease;
  }

  .toast-info {
    border-left: 4px solid var(--accent);
  }

  .toast-success {
    border-left: 4px solid var(--success);
    background: #166534;
  }

  .toast-error {
    border-left: 4px solid var(--error);
    background: #991b1b;
  }

  .toast-warning {
    border-left: 4px solid var(--warning);
    background: #78350f;
  }

  .toast-message {
    flex: 1;
  }

  .toast-close {
    background: none;
    border: none;
    color: inherit;
    font-size: 1.25rem;
    cursor: pointer;
    opacity: 0.7;
    padding: 0;
    line-height: 1;
  }

  .toast-close:hover {
    opacity: 1;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
</style>
