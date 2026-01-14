<script lang="ts">
  import { onMount } from "svelte";
  import type { AuditEntry } from "../stores/data";
  import type { EmailPreview as EmailPreviewType } from "../api";
  import * as api from "../api";
  import { addToast } from "../stores/toast";
  import { t } from "../i18n";

  interface Props {
    entry: AuditEntry;
    onclose: () => void;
  }

  let { entry, onclose }: Props = $props();

  let loading = $state(true);
  let error = $state<string | null>(null);
  let email = $state<EmailPreviewType | null>(null);

  onMount(async () => {
    // Try to fetch email preview - this requires the email to still exist in the mailbox
    // which won't always be the case for moved/deleted emails
    try {
      // We don't have folder/uid info in the audit entry, so we'll show what we have
      loading = false;
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load preview";
      loading = false;
    }
  });

  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onclose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onclose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" onclick={handleBackdropClick} onkeydown={handleKeydown} role="dialog" aria-modal="true" tabindex="-1">
  <div class="modal">
    <div class="modal-header">
      <h2 class="modal-title">{$t("emailPreview.title")}</h2>
      <button class="close-btn" onclick={onclose} aria-label={$t("common.close")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>

    <div class="modal-body">
      {#if loading}
        <div class="loading">{$t("common.loading")}</div>
      {:else if error}
        <div class="error">{error}</div>
      {:else}
        <div class="email-details">
          <div class="detail-row">
            <span class="detail-label">{$t("emailPreview.messageId")}:</span>
            <span class="detail-value mono">{entry.messageId}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">{$t("emailPreview.account")}:</span>
            <span class="detail-value">{entry.accountName}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">{$t("emailPreview.time")}:</span>
            <span class="detail-value">{formatTime(entry.createdAt)}</span>
          </div>

          {#if entry.subject}
            <div class="detail-row">
              <span class="detail-label">{$t("emailPreview.subject")}:</span>
              <span class="detail-value">{entry.subject}</span>
            </div>
          {/if}

          <div class="detail-row">
            <span class="detail-label">{$t("emailPreview.llm")}:</span>
            <span class="detail-value">{entry.llmProvider ?? "-"} / {entry.llmModel ?? "-"}</span>
          </div>

          <div class="detail-section">
            <h3 class="section-title">{$t("emailPreview.actionsTaken")}</h3>
            <div class="actions-list">
              {#each entry.actions as action}
                <div class="action-item">
                  <span class="action-type">{action.type}</span>
                  {#if action.folder}
                    <span class="action-detail">{$t("emailPreview.folder")}: {action.folder}</span>
                  {/if}
                  {#if action.flags}
                    <span class="action-detail">{$t("emailPreview.flags")}: {action.flags.join(", ")}</span>
                  {/if}
                  {#if action.reason}
                    <span class="action-detail">{$t("emailPreview.reason")}: {action.reason}</span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>

          {#if email?.body}
            <div class="detail-section">
              <h3 class="section-title">{$t("emailPreview.body")}</h3>
              <pre class="email-body">{email.body}</pre>
            </div>
          {/if}

          {#if email?.attachments && email.attachments.length > 0}
            <div class="detail-section">
              <h3 class="section-title">{$t("emailPreview.attachments")}</h3>
              <ul class="attachments-list">
                {#each email.attachments as att}
                  <li>{att.filename} ({(att.size / 1024).toFixed(1)} KB)</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal {
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    width: 100%;
    max-width: 600px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
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
    border-radius: 0.25rem;
  }

  .close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .close-btn svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
  }

  .loading,
  .error {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
  }

  .error {
    color: var(--error);
  }

  .email-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .detail-row {
    display: flex;
    gap: 0.75rem;
  }

  .detail-label {
    color: var(--text-secondary);
    font-size: 0.875rem;
    min-width: 100px;
  }

  .detail-value {
    color: var(--text-primary);
    font-size: 0.875rem;
    word-break: break-word;
  }

  .mono {
    font-family: monospace;
    font-size: 0.75rem;
  }

  .detail-section {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }

  .section-title {
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    color: var(--text-secondary);
  }

  .actions-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .action-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem;
    background: var(--bg-primary);
    border-radius: 0.375rem;
  }

  .action-type {
    font-weight: 500;
    text-transform: uppercase;
    font-size: 0.75rem;
    color: var(--accent);
  }

  .action-detail {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .email-body {
    background: var(--bg-primary);
    padding: 1rem;
    border-radius: 0.375rem;
    font-family: monospace;
    font-size: 0.75rem;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 200px;
    overflow-y: auto;
    color: var(--text-secondary);
  }

  .attachments-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .attachments-list li {
    padding: 0.5rem 0;
    color: var(--text-secondary);
    font-size: 0.875rem;
    border-bottom: 1px solid var(--border-color);
  }

  .attachments-list li:last-child {
    border-bottom: none;
  }
</style>
