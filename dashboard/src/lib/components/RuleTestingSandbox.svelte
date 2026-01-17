<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import * as api from "../api";
  import type { ActionType, TestClassificationResult, ValidatePromptResult } from "../api";
  import { t } from "../i18n";
  import PromptEditor from "./PromptEditor.svelte";
  import { sandboxState, type SandboxState } from "../stores/sandbox";

  interface LlmProvider {
    name: string;
    default_model?: string;
  }

  interface ConfidenceConfig {
    enabled?: boolean;
    request_reasoning?: boolean;
  }

  interface Config {
    llm_providers: LlmProvider[];
    default_prompt?: string;
    confidence?: ConfidenceConfig;
  }

  let config: Config | null = $state(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Form state - initialized from store
  let prompt = $state("");
  let emailFrom = $state("");
  let emailTo = $state("");
  let emailSubject = $state("");
  let emailBody = $state("");
  let folderMode = $state<"predefined" | "auto_create">("predefined");
  let allowedFolders = $state("");
  let existingFolders = $state("");
  let selectedProvider = $state("");
  let selectedModel = $state("");
  let allowedActions = $state<ActionType[]>([]);

  // Raw email mode
  let useRawEmail = $state(false);
  let rawEmail = $state("");

  // Attachment upload (Tika)
  let uploadedAttachment = $state<{ filename: string; text: string; truncated: boolean; size: number } | null>(null);

  // Results
  let testResult = $state<TestClassificationResult | null>(null);
  let validation = $state<ValidatePromptResult | null>(null);
  let testing = $state(false);
  let validating = $state(false);
  let validationTimeout: ReturnType<typeof setTimeout> | null = null;

  // Tika status
  let tikaEnabled = $state(false);
  let tikaHealthy = $state(false);
  let uploading = $state(false);
  let uploadError = $state<string | null>(null);
  let fileInputRef: HTMLInputElement | null = $state(null);

  // Tabs
  let activeResultTab = $state<"actions" | "prompt" | "raw">("actions");

  // Initialize state from store
  let storeInitialized = false;
  const unsubscribe = sandboxState.subscribe((state) => {
    if (!storeInitialized) {
      prompt = state.prompt;
      emailFrom = state.emailFrom;
      emailTo = state.emailTo;
      emailSubject = state.emailSubject;
      emailBody = state.emailBody;
      useRawEmail = state.useRawEmail;
      rawEmail = state.rawEmail;
      folderMode = state.folderMode;
      allowedFolders = state.allowedFolders;
      existingFolders = state.existingFolders;
      selectedProvider = state.selectedProvider;
      selectedModel = state.selectedModel;
      allowedActions = [...state.allowedActions];
      uploadedAttachment = state.uploadedAttachment;
      storeInitialized = true;
    }
  });

  // Save state to store when component unmounts
  onDestroy(() => {
    unsubscribe();
    // Clear validation timeout to prevent memory leaks
    if (validationTimeout) clearTimeout(validationTimeout);
    sandboxState.set({
      prompt,
      emailFrom,
      emailTo,
      emailSubject,
      emailBody,
      useRawEmail,
      rawEmail,
      folderMode,
      allowedFolders,
      existingFolders,
      selectedProvider,
      selectedModel,
      allowedActions,
      uploadedAttachment,
    });
  });

  // Note: 'noop' is excluded since it's always allowed by the backend
  const allActionTypes: ActionType[] = ["move", "spam", "flag", "read", "delete"];

  async function loadConfig() {
    try {
      loading = true;
      error = null;
      const result = await api.fetchConfig();
      config = result.config as Config;

      // Only set prompt from config if store has empty prompt (first load)
      if (config?.default_prompt && !prompt) {
        prompt = config.default_prompt;
      }

      // Only set provider if store has empty provider (first load)
      if (config?.llm_providers?.length > 0 && !selectedProvider) {
        selectedProvider = config.llm_providers[0].name;
        selectedModel = config.llm_providers[0].default_model || "";
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  async function checkTikaStatus() {
    try {
      const services = await api.fetchServicesStatus();
      tikaEnabled = services.tika.enabled;
      tikaHealthy = services.tika.healthy;
    } catch {
      tikaEnabled = false;
      tikaHealthy = false;
    }
  }

  async function handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      uploading = true;
      uploadError = null;
      const result = await api.extractAttachment(file);

      if (result.success && result.text) {
        uploadedAttachment = {
          filename: result.filename || file.name,
          text: result.text,
          truncated: result.truncated || false,
          size: result.size || file.size,
        };
      } else {
        uploadError = result.error || $t("sandbox.uploadFailed");
      }
    } catch (e) {
      uploadError = e instanceof Error ? e.message : String(e);
    } finally {
      uploading = false;
      if (input) input.value = "";
    }
  }

  function triggerFileUpload() {
    fileInputRef?.click();
  }

  function removeAttachment() {
    uploadedAttachment = null;
    uploadError = null;
  }

  async function runValidation() {
    if (!prompt.trim()) {
      validation = null;
      return;
    }

    try {
      validating = true;

      // Calculate folder count for token estimation
      const foldersArray = (folderMode === "predefined" ? allowedFolders : existingFolders)
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);

      // Get confidence settings from config
      const requestConfidence = config?.confidence?.enabled ?? false;
      const requestReasoning = config?.confidence?.request_reasoning ?? true;

      validation = await api.validatePrompt({
        prompt,
        allowedActions,
        folderMode,
        folderCount: foldersArray.length,
        requestConfidence,
        requestReasoning: requestConfidence && requestReasoning,
      });
    } catch (e) {
      console.error("Validation failed:", e);
      validation = {
        valid: false,
        errors: [{ message: "Validation service unavailable" }],
        warnings: [],
        stats: { charCount: 0, wordCount: 0, estimatedTokens: 0, fullPromptEstimatedTokens: 0 },
      };
    } finally {
      validating = false;
    }
  }

  async function runTest() {
    if (!selectedProvider) {
      error = $t("sandbox.errorNoProvider");
      return;
    }

    if (!prompt.trim()) {
      error = $t("sandbox.errorNoPrompt");
      return;
    }

    try {
      testing = true;
      error = null;
      testResult = null;

      const foldersArray = (folderMode === "predefined" ? allowedFolders : existingFolders)
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);

      // Pass confidence settings from config
      const requestConfidence = config?.confidence?.enabled ?? false;
      const requestReasoning = config?.confidence?.request_reasoning ?? true;

      if (useRawEmail) {
        testResult = await api.testClassificationRaw({
          prompt,
          rawEmail,
          folderMode,
          allowedFolders: folderMode === "predefined" ? foldersArray : undefined,
          existingFolders: folderMode === "auto_create" ? foldersArray : undefined,
          allowedActions,
          providerName: selectedProvider,
          model: selectedModel || undefined,
          requestConfidence,
          requestReasoning: requestConfidence && requestReasoning,
        });
      } else {
        testResult = await api.testClassification({
          prompt,
          email: {
            from: emailFrom,
            to: emailTo,
            subject: emailSubject,
            body: emailBody,
            attachments: uploadedAttachment ? [uploadedAttachment.filename] : undefined,
          },
          folderMode,
          allowedFolders: folderMode === "predefined" ? foldersArray : undefined,
          existingFolders: folderMode === "auto_create" ? foldersArray : undefined,
          allowedActions,
          providerName: selectedProvider,
          model: selectedModel || undefined,
          attachmentText: uploadedAttachment?.text,
          requestConfidence,
          requestReasoning: requestConfidence && requestReasoning,
        });
      }

      if (!testResult.success && testResult.error) {
        error = testResult.error;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      testing = false;
    }
  }

  function toggleAction(action: ActionType) {
    if (allowedActions.includes(action)) {
      if (allowedActions.length > 1) {
        allowedActions = allowedActions.filter((a) => a !== action);
      }
    } else {
      allowedActions = [...allowedActions, action];
    }
  }

  function handlePromptChange(newValue: string) {
    prompt = newValue;
  }

  function getActionIcon(type: string): string {
    switch (type) {
      case "move": return "folder";
      case "spam": return "shield-alert";
      case "flag": return "flag";
      case "read": return "mail-open";
      case "delete": return "trash";
      case "noop": return "circle-slash";
      default: return "help-circle";
    }
  }

  function getActionColor(type: string): string {
    switch (type) {
      case "move": return "var(--accent)";
      case "spam": return "var(--warning)";
      case "flag": return "var(--info)";
      case "read": return "var(--success)";
      case "delete": return "var(--error)";
      case "noop": return "var(--text-muted)";
      default: return "var(--text-secondary)";
    }
  }

  $effect(() => {
    if (selectedProvider && config?.llm_providers) {
      const provider = config.llm_providers.find((p) => p.name === selectedProvider);
      if (provider) {
        selectedModel = provider.default_model || "";
      }
    }
  });

  // Debounce validation - read reactive values synchronously to establish dependencies
  $effect(() => {
    // Read reactive values to track them as dependencies (Svelte 5 requirement)
    const _prompt = prompt;
    const _actions = allowedActions;
    const _folderMode = folderMode;
    const _allowedFolders = allowedFolders;
    const _existingFolders = existingFolders;
    void (_prompt, _actions, _folderMode, _allowedFolders, _existingFolders);

    if (validationTimeout) clearTimeout(validationTimeout);
    validationTimeout = setTimeout(() => {
      runValidation();
    }, 500);
  });

  onMount(() => {
    loadConfig();
    checkTikaStatus();
  });
</script>

<div class="sandbox-container">
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>{$t("common.loading")}</p>
    </div>
  {:else if !config}
    <div class="error-state">
      <p>{error || $t("sandbox.errorLoadingConfig")}</p>
      <button class="btn btn-primary" onclick={loadConfig}>{$t("common.retry")}</button>
    </div>
  {:else}
    <div class="sandbox-layout">
      <!-- Left Panel: Prompt Editor -->
      <div class="panel prompt-panel">
        <div class="panel-header">
          <h3>{$t("sandbox.promptTitle")}</h3>
        </div>
        <div class="panel-content">
          <PromptEditor
            value={prompt}
            onchange={handlePromptChange}
            placeholder={$t("sandbox.promptPlaceholder")}
            {validation}
          />
        </div>
      </div>

      <!-- Center Panel: Test Email -->
      <div class="panel email-panel">
        <div class="panel-header">
          <h3>{$t("sandbox.emailTitle")}</h3>
          <div class="header-controls">
            {#if !useRawEmail}
              <button
                type="button"
                class="upload-btn"
                class:unavailable={!tikaEnabled || !tikaHealthy}
                onclick={triggerFileUpload}
                disabled={uploading || !tikaEnabled || !tikaHealthy}
                title={!tikaEnabled ? $t("sandbox.tikaNotEnabled") : !tikaHealthy ? $t("sandbox.tikaNotHealthy") : $t("sandbox.uploadAttachment")}
              >
                {#if uploading}
                  <span class="spinner-tiny"></span>
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                {/if}
                <span>{$t("sandbox.uploadFile")}</span>
              </button>
              <input
                type="file"
                bind:this={fileInputRef}
                onchange={handleFileUpload}
                style="display: none"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.rtf,.odt,.ods,.ppt,.pptx,.html,.xml,.json,.csv"
              />
            {/if}
            <button
              type="button"
              class="toggle-raw-btn"
              class:active={useRawEmail}
              onclick={() => (useRawEmail = !useRawEmail)}
              title={useRawEmail ? $t("sandbox.formMode") : $t("sandbox.rawEmailMode")}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="panel-content">
          {#if useRawEmail}
            <div class="form-group">
              <label for="raw-email">{$t("sandbox.rawEmailLabel")}</label>
              <textarea
                id="raw-email"
                class="raw-email-input"
                bind:value={rawEmail}
                placeholder={$t("sandbox.rawEmailPlaceholder")}
              ></textarea>
            </div>
          {:else}
            <div class="form-group">
              <label for="email-from">{$t("sandbox.from")}</label>
              <input id="email-from" type="text" bind:value={emailFrom} />
            </div>
            <div class="form-group">
              <label for="email-to">{$t("sandbox.to")}</label>
              <input id="email-to" type="text" bind:value={emailTo} />
            </div>
            <div class="form-group">
              <label for="email-subject">{$t("sandbox.subject")}</label>
              <input id="email-subject" type="text" bind:value={emailSubject} />
            </div>
            <div class="form-group">
              <label for="email-body">{$t("sandbox.body")}</label>
              <textarea
                id="email-body"
                class="email-body-input"
                bind:value={emailBody}
                rows="8"
              ></textarea>
            </div>

            {#if uploadedAttachment}
              <div class="attachment-preview">
                <div class="attachment-header">
                  <div class="attachment-info">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                    </svg>
                    <span class="attachment-name">{uploadedAttachment.filename}</span>
                    <span class="attachment-size">({Math.round(uploadedAttachment.size / 1024)}KB)</span>
                    {#if uploadedAttachment.truncated}
                      <span class="attachment-truncated">{$t("sandbox.truncated")}</span>
                    {/if}
                  </div>
                  <button type="button" class="remove-attachment" onclick={removeAttachment} title={$t("sandbox.removeAttachment")}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                <div class="attachment-text">
                  <pre>{uploadedAttachment.text.slice(0, 500)}{uploadedAttachment.text.length > 500 ? '...' : ''}</pre>
                </div>
              </div>
            {/if}

            {#if uploadError}
              <div class="upload-error">{uploadError}</div>
            {/if}
          {/if}
        </div>
      </div>

      <!-- Right Panel: Configuration & Results -->
      <div class="panel config-panel">
        <div class="panel-header">
          <h3>{$t("sandbox.configTitle")}</h3>
        </div>
        <div class="panel-content">
          <!-- Provider Selection -->
          <div class="form-group">
            <label for="provider">{$t("sandbox.provider")}</label>
            <select id="provider" bind:value={selectedProvider}>
              {#each config.llm_providers as provider}
                <option value={provider.name}>{provider.name}</option>
              {/each}
            </select>
          </div>

          <div class="form-group">
            <label for="model">{$t("sandbox.model")}</label>
            <input id="model" type="text" bind:value={selectedModel} placeholder={$t("sandbox.modelPlaceholder")} />
          </div>

          <!-- Folder Mode -->
          <div class="form-group">
            <label>{$t("sandbox.folderMode")}</label>
            <div class="radio-group">
              <label class="radio-label">
                <input type="radio" bind:group={folderMode} value="predefined" />
                <span>{$t("sandbox.predefined")}</span>
              </label>
              <label class="radio-label">
                <input type="radio" bind:group={folderMode} value="auto_create" />
                <span>{$t("sandbox.autoCreate")}</span>
              </label>
            </div>
          </div>

          {#if folderMode === "predefined"}
            <div class="form-group">
              <label for="allowed-folders">{$t("sandbox.allowedFolders")}</label>
              <input id="allowed-folders" type="text" bind:value={allowedFolders} placeholder={$t("sandbox.foldersPlaceholder")} />
            </div>
          {:else}
            <div class="form-group">
              <label for="existing-folders">{$t("sandbox.existingFolders")}</label>
              <input id="existing-folders" type="text" bind:value={existingFolders} placeholder={$t("sandbox.foldersPlaceholder")} />
            </div>
          {/if}

          <!-- Allowed Actions -->
          <div class="form-group">
            <label>{$t("sandbox.allowedActions")}</label>
            <div class="action-toggles">
              {#each allActionTypes as action}
                <button
                  type="button"
                  class="action-toggle"
                  class:active={allowedActions.includes(action)}
                  onclick={() => toggleAction(action)}
                >
                  {action}
                </button>
              {/each}
            </div>
          </div>

          <!-- Run Button -->
          <button
            class="btn btn-primary btn-run"
            onclick={runTest}
            disabled={testing || !selectedProvider || !prompt.trim()}
          >
            {#if testing}
              <span class="spinner-small"></span>
              {$t("sandbox.testing")}
            {:else}
              {$t("sandbox.runTest")}
            {/if}
          </button>

          {#if error}
            <div class="error-message">{error}</div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Results Section -->
    {#if testResult}
      <div class="results-section">
        <div class="results-header">
          <h3>{$t("sandbox.resultsTitle")}</h3>
          <div class="results-meta">
            <span class="latency">{testResult.latencyMs}ms</span>
            {#if testResult.success}
              <span class="status success">{$t("sandbox.success")}</span>
            {:else}
              <span class="status error">{$t("sandbox.failed")}</span>
            {/if}
          </div>
        </div>

        <div class="results-tabs">
          <button
            class="tab"
            class:active={activeResultTab === "actions"}
            onclick={() => (activeResultTab = "actions")}
          >
            {$t("sandbox.tabActions")}
          </button>
          <button
            class="tab"
            class:active={activeResultTab === "prompt"}
            onclick={() => (activeResultTab = "prompt")}
          >
            {$t("sandbox.tabPrompt")}
          </button>
          <button
            class="tab"
            class:active={activeResultTab === "raw"}
            onclick={() => (activeResultTab = "raw")}
          >
            {$t("sandbox.tabRaw")}
          </button>
        </div>

        <div class="results-content">
          {#if activeResultTab === "actions" && testResult.classification}
            {#if testResult.classification.confidence !== undefined || testResult.classification.reasoning}
              <div class="confidence-section">
                {#if testResult.classification.confidence !== undefined}
                  <div class="confidence-score">
                    <span class="confidence-label">{$t("sandbox.confidence")}</span>
                    <span class="confidence-value" class:high={testResult.classification.confidence >= 0.8} class:medium={testResult.classification.confidence >= 0.5 && testResult.classification.confidence < 0.8} class:low={testResult.classification.confidence < 0.5}>
                      {Math.round(testResult.classification.confidence * 100)}%
                    </span>
                  </div>
                {/if}
                {#if testResult.classification.reasoning}
                  <div class="reasoning">
                    <span class="reasoning-label">{$t("sandbox.reasoning")}</span>
                    <span class="reasoning-text">{testResult.classification.reasoning}</span>
                  </div>
                {/if}
              </div>
            {/if}
            <div class="actions-list">
              {#each testResult.classification.actions as action}
                <div class="action-card" style="--action-color: {getActionColor(action.type)}">
                  <div class="action-header">
                    <span class="action-type">{action.type}</span>
                    {#if action.folder}
                      <span class="action-folder">{action.folder}</span>
                    {/if}
                    {#if action.flags}
                      <span class="action-flags">{action.flags.join(", ")}</span>
                    {/if}
                  </div>
                  {#if action.reason}
                    <div class="action-reason">{action.reason}</div>
                  {/if}
                </div>
              {/each}
            </div>
          {:else if activeResultTab === "prompt"}
            <pre class="prompt-preview">{testResult.promptUsed}</pre>
          {:else if activeResultTab === "raw"}
            {#if testResult.classification?.usage}
              <div class="usage-info">
                <span class="usage-item">
                  <span class="usage-label">{$t("sandbox.promptTokens")}</span>
                  <span class="usage-value">{testResult.classification.usage.promptTokens.toLocaleString()}</span>
                </span>
                <span class="usage-item">
                  <span class="usage-label">{$t("sandbox.completionTokens")}</span>
                  <span class="usage-value">{testResult.classification.usage.completionTokens.toLocaleString()}</span>
                </span>
                <span class="usage-item">
                  <span class="usage-label">{$t("sandbox.totalTokens")}</span>
                  <span class="usage-value">{testResult.classification.usage.totalTokens.toLocaleString()}</span>
                </span>
              </div>
            {/if}
            <pre class="raw-response">{testResult.classification?.rawResponse || $t("sandbox.noResponse")}</pre>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .sandbox-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    height: 100%;
    overflow-y: auto;
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 3rem;
    color: var(--text-secondary);
  }

  .sandbox-layout {
    display: grid;
    grid-template-columns: 1fr 1fr 300px;
    gap: 1.5rem;
    min-height: 400px;
  }

  @media (max-width: 1200px) {
    .sandbox-layout {
      grid-template-columns: 1fr 1fr;
    }
    .config-panel {
      grid-column: span 2;
    }
  }

  @media (max-width: 768px) {
    .sandbox-layout {
      grid-template-columns: 1fr;
    }
    .config-panel {
      grid-column: span 1;
    }
  }

  .panel {
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg, 0.5rem);
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);
  }

  .panel-header h3 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .panel-content {
    flex: 1;
    padding: 1rem;
    overflow-y: auto;
  }

  .prompt-panel .panel-content {
    padding: 0;
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .upload-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm, 0.25rem);
    color: var(--text-secondary);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .upload-btn:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }

  .upload-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .upload-btn.unavailable {
    opacity: 0.4;
    border-style: dashed;
  }

  .upload-btn.unavailable:hover {
    border-color: var(--border-color);
    color: var(--text-secondary);
  }

  .spinner-tiny {
    width: 0.75rem;
    height: 0.75rem;
    border: 1.5px solid var(--border-color);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .toggle-raw-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm, 0.25rem);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toggle-raw-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .toggle-raw-btn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .toggle-raw-btn svg {
    width: 14px;
    height: 14px;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.375rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .form-group input[type="text"],
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md, 0.375rem);
    color: var(--text-primary);
    font-size: 0.875rem;
    font-family: inherit;
  }

  .form-group input[type="text"]:focus,
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .email-body-input,
  .raw-email-input {
    min-height: 150px;
    resize: vertical;
    font-family: var(--font-mono, monospace);
    font-size: 0.8125rem;
    line-height: 1.5;
  }

  .raw-email-input {
    min-height: 300px;
  }

  .attachment-preview {
    margin-top: 0.75rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md, 0.375rem);
    overflow: hidden;
  }

  .attachment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .attachment-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .attachment-name {
    color: var(--text-primary);
    font-weight: 500;
  }

  .attachment-size {
    color: var(--text-muted);
    font-size: 0.75rem;
  }

  .attachment-truncated {
    padding: 0.125rem 0.375rem;
    background: rgba(245, 158, 11, 0.1);
    border-radius: var(--radius-sm, 0.25rem);
    color: var(--warning);
    font-size: 0.6875rem;
    font-weight: 500;
  }

  .remove-attachment {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: var(--radius-sm, 0.25rem);
    transition: all 0.15s ease;
  }

  .remove-attachment:hover {
    color: var(--error);
    background: rgba(239, 68, 68, 0.1);
  }

  .attachment-text {
    padding: 0.5rem 0.75rem;
    max-height: 100px;
    overflow-y: auto;
  }

  .attachment-text pre {
    margin: 0;
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    line-height: 1.5;
    color: var(--text-secondary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .upload-error {
    margin-top: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid var(--error);
    border-radius: var(--radius-md, 0.375rem);
    color: var(--error);
    font-size: 0.8125rem;
  }

  .radio-group {
    display: flex;
    gap: 1rem;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    color: var(--text-primary);
    cursor: pointer;
  }

  .action-toggles {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .action-toggle {
    padding: 0.375rem 0.75rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm, 0.25rem);
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .action-toggle:hover {
    border-color: var(--accent);
  }

  .action-toggle.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    border: none;
    border-radius: var(--radius-md, 0.375rem);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--accent);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--accent-hover, #2563eb);
  }

  .btn-run {
    width: 100%;
    margin-top: 1rem;
  }

  .error-message {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid var(--error);
    border-radius: var(--radius-md, 0.375rem);
    color: var(--error);
    font-size: 0.8125rem;
  }

  .spinner,
  .spinner-small {
    width: 1.5rem;
    height: 1.5rem;
    border: 2px solid var(--border-color);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .spinner-small {
    width: 1rem;
    height: 1rem;
    border-width: 2px;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Results Section */
  .results-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg, 0.5rem);
    overflow: hidden;
  }

  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);
  }

  .results-header h3 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .results-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .latency {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: var(--font-mono, monospace);
  }

  .status {
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm, 0.25rem);
    font-size: 0.75rem;
    font-weight: 500;
  }

  .status.success {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success);
  }

  .status.error {
    background: rgba(239, 68, 68, 0.1);
    color: var(--error);
  }

  .results-tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color);
  }

  .tab {
    padding: 0.625rem 1rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-secondary);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .tab:hover {
    color: var(--text-primary);
  }

  .tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .results-content {
    padding: 1rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .confidence-section {
    margin-bottom: 1rem;
    padding: 0.75rem 1rem;
    background: var(--bg-tertiary);
    border-radius: var(--radius-md, 0.375rem);
    border: 1px solid var(--border-color);
  }

  .confidence-score {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .confidence-label,
  .reasoning-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .confidence-value {
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm, 0.25rem);
  }

  .confidence-value.high {
    background: var(--success-muted, rgba(34, 197, 94, 0.15));
    color: var(--success);
  }

  .confidence-value.medium {
    background: var(--warning-muted, rgba(234, 179, 8, 0.15));
    color: var(--warning);
  }

  .confidence-value.low {
    background: var(--error-muted, rgba(239, 68, 68, 0.15));
    color: var(--error);
  }

  .reasoning {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .reasoning-text {
    font-size: 0.8125rem;
    color: var(--text-primary);
    line-height: 1.5;
  }

  .actions-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .action-card {
    padding: 0.75rem 1rem;
    background: var(--bg-tertiary);
    border-left: 3px solid var(--action-color, var(--accent));
    border-radius: 0 var(--radius-md, 0.375rem) var(--radius-md, 0.375rem) 0;
  }

  .action-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.375rem;
  }

  .action-type {
    font-weight: 600;
    color: var(--action-color, var(--text-primary));
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.05em;
  }

  .action-folder,
  .action-flags {
    font-size: 0.875rem;
    color: var(--text-primary);
    font-family: var(--font-mono, monospace);
  }

  .action-reason {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .usage-info {
    display: flex;
    gap: 1.5rem;
    margin-bottom: 1rem;
    padding: 0.75rem 1rem;
    background: var(--bg-tertiary);
    border-radius: var(--radius-md, 0.375rem);
    border: 1px solid var(--border-color);
  }

  .usage-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .usage-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .usage-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
    font-family: var(--font-mono, monospace);
  }

  .prompt-preview,
  .raw-response {
    margin: 0;
    padding: 1rem;
    background: var(--bg-tertiary);
    border-radius: var(--radius-md, 0.375rem);
    font-family: var(--font-mono, monospace);
    font-size: 0.8125rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--text-primary);
    overflow-x: auto;
  }
</style>
