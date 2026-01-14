<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import * as api from "../api";
  import { stats, serviceStatus, type ServicesStatus } from "../stores/data";
  import { settingsHasChanges } from "../stores/navigation";
  import { t } from "../i18n";

  interface Config {
    polling_interval?: string;
    concurrency_limit?: number;
    dry_run?: boolean;
    add_processing_headers?: boolean;
    default_prompt?: string;
    llm_providers: LlmProvider[];
    accounts: Account[];
    logging?: { level?: string };
    server?: { port?: number; auth_token?: string };
    dashboard?: DashboardConfig;
    antivirus?: AntivirusConfig;
    attachments?: AttachmentsConfig;
  }

  interface LlmProvider {
    name: string;
    api_url: string;
    api_key?: string;
    default_model?: string;
    headers?: Record<string, string>;
    rate_limit?: number;
  }

  interface Account {
    name: string;
    imap: ImapConfig;
    llm?: { provider?: string; model?: string };
    folders?: { watch?: string[]; mode?: string; allowed?: string[] };
    webhooks?: Webhook[];
    prompt_override?: string;
    prompt_file?: string;
  }

  interface ImapConfig {
    host: string;
    port?: number;
    tls?: string;
    auth?: string;
    username: string;
    password?: string;
    oauth_client_id?: string;
    oauth_client_secret?: string;
    oauth_refresh_token?: string;
  }

  interface Webhook {
    url: string;
    events: string[];
    headers?: Record<string, string>;
  }

  interface DashboardConfig {
    enabled?: boolean;
    session_ttl?: string;
    api_keys?: ApiKey[];
  }

  interface ApiKey {
    name: string;
    key: string;
    permissions: string[];
  }

  interface AntivirusConfig {
    enabled?: boolean;
    host?: string;
    port?: number;
    timeout?: string;
    on_virus_detected?: string;
  }

  interface AttachmentsConfig {
    enabled?: boolean;
    tika_url?: string;
    timeout?: string;
    max_size_mb?: number;
    max_extracted_chars?: number;
    allowed_types?: string[];
    extract_images?: boolean;
  }

  let config = $state<Config | null>(null);
  let originalConfig = $state<string>(""); // JSON string for deep comparison
  let configPath = $state<string>("");
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let saveMessage = $state<{ type: "success" | "error"; text: string } | null>(null);
  let activeSection = $state<string>("global");

  // Track unsaved changes
  const hasChanges = $derived(() => {
    if (!config || !originalConfig) return false;
    return JSON.stringify(config) !== originalConfig;
  });

  // Sync hasChanges with global store for cross-component awareness
  $effect(() => {
    settingsHasChanges.set(hasChanges());
  });

  const changeCount = $derived(() => {
    if (!config || !originalConfig) return 0;
    try {
      const original = JSON.parse(originalConfig) as Config;
      let count = 0;

      // Compare top-level simple fields
      if (config.polling_interval !== original.polling_interval) count++;
      if (config.concurrency_limit !== original.concurrency_limit) count++;
      if (config.dry_run !== original.dry_run) count++;
      if (config.add_processing_headers !== original.add_processing_headers) count++;
      if (config.default_prompt !== original.default_prompt) count++;

      // Compare nested objects
      if (JSON.stringify(config.logging) !== JSON.stringify(original.logging)) count++;
      if (JSON.stringify(config.server) !== JSON.stringify(original.server)) count++;
      if (JSON.stringify(config.dashboard) !== JSON.stringify(original.dashboard)) count++;
      if (JSON.stringify(config.attachments) !== JSON.stringify(original.attachments)) count++;
      if (JSON.stringify(config.antivirus) !== JSON.stringify(original.antivirus)) count++;

      // Compare arrays
      if (JSON.stringify(config.accounts) !== JSON.stringify(original.accounts)) count++;
      if (JSON.stringify(config.llm_providers) !== JSON.stringify(original.llm_providers)) count++;

      return count;
    } catch {
      return 0;
    }
  });

  // YAML editor state
  let yamlMode = $state(false);
  let yamlContent = $state("");
  let yamlLoading = $state(false);

  // Editing state
  let editingAccount = $state<Account | null>(null);
  let editingProvider = $state<LlmProvider | null>(null);
  let editingApiKey = $state<ApiKey | null>(null);
  let editingApiKeyIndex = $state<number | null>(null);
  let showApiKey = $state<string | null>(null);

  // IMAP test state
  let testingConnection = $state(false);
  let testResult = $state<{ success: boolean; error?: string; capabilities?: string[]; folders?: string[] } | null>(null);

  // Account wizard state
  type WizardState = "host_port" | "auth_ready" | "connected" | "complete";
  let wizardState = $state<WizardState>("host_port");
  let probeResult = $state<api.ImapProbeResult | null>(null);
  let probingImap = $state(false);
  let availableFolders = $state<string[]>([]);
  let connectionTested = $state(false);
  let imapPresets = $state<api.ImapPreset[]>([]);
  let showPresetDropdown = $state(false);
  let portLocked = $state(false);
  let connectionFieldsLocked = $state(true); // Lock port/tls/auth until host is probed

  // Folder multi-select dropdown state
  let showWatchFolderDropdown = $state(false);
  let showAllowedFolderDropdown = $state(false);

  // Service status
  let services = $state<ServicesStatus | null>(null);
  let serviceCheckInterval: ReturnType<typeof setInterval> | null = null;

  // Port change tracking
  let originalPort = $state<number>(8080);
  let showPortWarning = $state(false);
  let pendingPortChange = $state<number | null>(null);

  const sectionIds = ["global", "accounts", "providers", "apikeys", "attachments", "antivirus"] as const;

  const helpTexts: Record<string, string> = {
    polling_interval: "How often to check for new emails when IDLE is not supported (e.g., 30s, 5m)",
    concurrency_limit: "Maximum number of emails to process simultaneously",
    dry_run: "When enabled, emails are classified but no actions are taken. Dashboard auth is also disabled.",
    add_processing_headers: "Add X-Mailpilot headers to processed emails",
    default_prompt: "System prompt used for LLM email classification",
    "imap.host": "IMAP server hostname (e.g., imap.gmail.com)",
    "imap.port": "IMAP server port (usually 993 for TLS)",
    "imap.tls": "TLS mode: auto, tls, starttls, or insecure",
    "imap.auth": "Authentication type: basic or oauth2",
    "imap.username": "Email address or username for authentication",
    "imap.password": "Password for basic authentication",
    "folders.watch": "Folders to monitor for new emails (comma-separated)",
    "folders.mode": "Predefined: only allow moves to specified folders. Auto-create: create folders as needed",
    "folders.allowed": "Folders LLM can move emails to. Leave empty to auto-discover all existing folders via IMAP",
    prompt_override: "Custom classification prompt for this account (overrides global default)",
    "llm.provider": "Which LLM provider to use for this account",
    "llm.model": "Model to use (overrides provider default)",
    "provider.api_url": "API endpoint URL for the LLM provider",
    "provider.api_key": "API key for authentication",
    "provider.default_model": "Default model to use (e.g., gpt-4o, claude-3-5-sonnet)",
    "provider.rate_limit": "Maximum requests per minute",
    "attachments.enabled": "Enable attachment text extraction via Apache Tika",
    "attachments.tika_url": "URL of the Tika server (e.g., http://tika:9998)",
    "attachments.max_size_mb": "Maximum attachment size to process (MB)",
    "attachments.max_extracted_chars": "Maximum characters to extract from each attachment",
    "attachments.extract_images": "Also extract and send images to vision-capable LLMs",
    "antivirus.enabled": "Enable virus scanning via ClamAV",
    "antivirus.host": "ClamAV server hostname",
    "antivirus.port": "ClamAV server port (usually 3310)",
    "antivirus.on_virus_detected": "Action when virus detected: quarantine, delete, or flag_only",
    "dashboard.enabled": "Enable the web dashboard",
    "dashboard.session_ttl": "How long dashboard sessions last (e.g., 24h, 7d)",
    "logging.level": "Log level: debug, info, warn, or error",
    "server.port": "HTTP server port for health checks and dashboard",
  };

  onMount(async () => {
    await loadConfig();
    await checkServices();
    // Load IMAP presets
    try {
      const presetsResult = await api.fetchImapPresets();
      imapPresets = presetsResult.presets;
    } catch {
      // Presets are optional, ignore errors
    }
    // Poll service status every 30 seconds
    serviceCheckInterval = setInterval(checkServices, 30000);
  });

  onDestroy(() => {
    if (serviceCheckInterval) {
      clearInterval(serviceCheckInterval);
    }
  });

  async function checkServices() {
    try {
      services = await api.fetchServices();
      serviceStatus.set(services);
    } catch {
      // Silently fail - services might not be available
    }
  }

  async function loadConfig() {
    loading = true;
    error = null;
    try {
      const result = await api.fetchConfig();
      const loadedConfig = result.config as Config;

      // Initialize nested objects to avoid bind issues
      loadedConfig.logging = loadedConfig.logging ?? { level: "info" };
      loadedConfig.server = loadedConfig.server ?? { port: 8080 };
      loadedConfig.dashboard = loadedConfig.dashboard ?? { enabled: true, session_ttl: "24h" };
      loadedConfig.attachments = loadedConfig.attachments ?? { enabled: false };
      loadedConfig.antivirus = loadedConfig.antivirus ?? { enabled: false };

      config = loadedConfig;
      originalConfig = JSON.stringify(loadedConfig);
      configPath = result.configPath;
      originalPort = loadedConfig.server.port ?? 8080;
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load config";
    } finally {
      loading = false;
    }
  }

  async function handleSave() {
    if (!config) return;

    const newPort = config.server?.port ?? 8080;
    const portChanged = newPort !== originalPort;

    // Show warning if port is changing
    if (portChanged && !showPortWarning) {
      pendingPortChange = newPort;
      showPortWarning = true;
      return;
    }

    saving = true;
    saveMessage = null;

    try {
      const result = await api.saveConfig(config);
      if (result.success) {
        // Update original config to reflect saved state
        originalConfig = JSON.stringify(config);
        originalPort = config.server?.port ?? 8080;

        if (portChanged) {
          saveMessage = { type: "success", text: $t("settings.savedNeedsRestart") };
        } else {
          saveMessage = { type: "success", text: $t("settings.saved") };
          // Refresh stats
          const newStats = await api.fetchStats();
          stats.set(newStats);
        }
      } else {
        saveMessage = { type: "error", text: $t("settings.saveError") };
      }
    } catch (e) {
      saveMessage = { type: "error", text: e instanceof Error ? e.message : $t("settings.saveError") };
    } finally {
      saving = false;
      showPortWarning = false;
      pendingPortChange = null;
      if (!config.server || config.server.port === originalPort) {
        setTimeout(() => { saveMessage = null; }, 5000);
      }
    }
  }

  function cancelPortChange() {
    showPortWarning = false;
    pendingPortChange = null;
    if (config?.server) {
      config.server.port = originalPort;
      config = { ...config }; // Trigger reactivity
    }
  }

  function confirmPortChange() {
    handleSave();
  }

  async function toggleYamlMode() {
    if (!yamlMode) {
      // Switching to YAML mode - load raw config
      yamlLoading = true;
      try {
        const result = await api.fetchRawConfig();
        yamlContent = result.yaml;
        yamlMode = true;
      } catch (e) {
        saveMessage = { type: "error", text: e instanceof Error ? e.message : "Failed to load raw config" };
      } finally {
        yamlLoading = false;
      }
    } else {
      // Switching back to form mode - reload config
      yamlMode = false;
      await loadConfig();
    }
  }

  async function handleYamlSave() {
    saving = true;
    saveMessage = null;

    try {
      const result = await api.saveRawConfig(yamlContent);
      if (result.success) {
        saveMessage = { type: "success", text: "YAML saved and configuration reloaded" };
        // Refresh stats
        const newStats = await api.fetchStats();
        stats.set(newStats);
        setTimeout(() => { saveMessage = null; }, 5000);
      } else {
        saveMessage = { type: "error", text: "Failed to save YAML" };
      }
    } catch (e) {
      saveMessage = { type: "error", text: e instanceof Error ? e.message : "Failed to save YAML" };
    } finally {
      saving = false;
    }
  }

  function resetWizardState() {
    wizardState = "host_port";
    probeResult = null;
    probingImap = false;
    availableFolders = [];
    connectionTested = false;
    testResult = null;
    showWatchFolderDropdown = false;
    showAllowedFolderDropdown = false;
    showPresetDropdown = false;
    portLocked = false;
    connectionFieldsLocked = true;
  }

  function addAccount() {
    resetWizardState();
    editingAccount = {
      name: "",
      imap: { host: "", port: 993, tls: "tls", auth: "basic", username: "", password: "" },
      folders: { watch: ["INBOX"] },
    };
  }

  function editAccount(account: Account) {
    resetWizardState();
    editingAccount = JSON.parse(JSON.stringify(account));
    // If editing existing account, assume it's already been tested
    if (account.name) {
      connectionTested = true;
      wizardState = "connected";
      connectionFieldsLocked = false; // Unlock for existing accounts
    }
  }

  function saveAccount() {
    if (!config || !editingAccount) return;

    const existingIndex = config.accounts.findIndex(a => a.name === editingAccount!.name);
    if (existingIndex >= 0) {
      config.accounts[existingIndex] = editingAccount;
    } else {
      config.accounts.push(editingAccount);
    }
    config = { ...config };
    editingAccount = null;
    resetWizardState();
  }

  async function probeImapServer() {
    if (!editingAccount?.imap.host) return;

    probingImap = true;
    probeResult = null;
    portLocked = false;
    connectionFieldsLocked = true; // Lock during probe

    try {
      const result = await api.probeImap({
        host: editingAccount.imap.host,
      });
      probeResult = result;

      // If we detected a provider (even if connection failed), we can still use defaults
      const hasProvider = !!result.provider;
      const hasAvailablePorts = (result.availablePorts?.length ?? 0) > 0;

      if (editingAccount) {
        if (result.success && result.suggestedPort) {
          editingAccount.imap.port = result.suggestedPort;
        }
        if (result.success && result.suggestedTls) {
          editingAccount.imap.tls = result.suggestedTls === "none" ? "insecure" : result.suggestedTls;
        }
        // Lock port if we detected available ports OR if we have a provider (use defaults)
        // This allows TLS mode changes to rotate ports even with default mappings
        portLocked = hasAvailablePorts || hasProvider;
        connectionFieldsLocked = false; // Unlock after probe attempt
        // Auto-select auth type if only one is available
        if (result.authMethods && result.authMethods.length === 1) {
          editingAccount.imap.auth = result.authMethods[0];
        }
        wizardState = "auth_ready";
      }
    } catch (e) {
      probeResult = { success: false, error: e instanceof Error ? e.message : "Probe failed" };
      portLocked = false;
      connectionFieldsLocked = false; // Unlock on error for manual fallback
    } finally {
      probingImap = false;
    }
  }

  function handleHostBlur() {
    if (editingAccount?.imap.host) {
      probeImapServer();
    }
  }

  // Default port mappings for when probe can't determine available ports
  const DEFAULT_PORT_MAP: Record<string, number> = {
    tls: 993,
    starttls: 143,
    none: 143,
    insecure: 143,
  };

  function handleTlsModeChange() {
    if (!editingAccount) return;
    // When TLS mode changes, update port to match
    const selectedTls = editingAccount.imap.tls === "insecure" ? "none" : editingAccount.imap.tls;

    // First try to find from probe results
    const matchingPort = probeResult?.availablePorts?.find(p => p.tls === selectedTls);
    if (matchingPort) {
      editingAccount.imap.port = matchingPort.port;
    } else {
      // Use default port mapping as fallback
      const tlsMode = editingAccount.imap.tls ?? "tls";
      editingAccount.imap.port = DEFAULT_PORT_MAP[tlsMode] ?? 993;
    }
  }

  // Get available TLS modes from probe result
  function getAvailableTlsModes(): { value: string; label: string }[] {
    if (!probeResult?.availablePorts || probeResult.availablePorts.length === 0) {
      // No probe result - show all options except Auto (manual fallback)
      return [
        { value: "tls", label: $t("settings.accounts.tlsTls") },
        { value: "starttls", label: $t("settings.accounts.tlsStarttls") },
        { value: "insecure", label: $t("settings.accounts.tlsInsecure") },
      ];
    }
    // Map probe results to form options
    const modes: { value: string; label: string }[] = [];
    for (const port of probeResult.availablePorts) {
      const value = port.tls === "none" ? "insecure" : port.tls;
      const labelKey = port.tls === "tls" ? "tlsTls" : port.tls === "starttls" ? "tlsStarttls" : "tlsInsecure";
      if (!modes.some(m => m.value === value)) {
        modes.push({ value, label: $t(`settings.accounts.${labelKey}`) });
      }
    }
    return modes;
  }

  function removeAccount(name: string) {
    if (!config) return;
    if (confirm(`Remove account "${name}"? This cannot be undone.`)) {
      config.accounts = config.accounts.filter(a => a.name !== name);
      config = { ...config };
    }
  }

  function addProvider() {
    editingProvider = {
      name: "",
      api_url: "https://api.openai.com/v1/chat/completions",
      api_key: "",
      default_model: "gpt-4o",
    };
  }

  function editProvider(provider: LlmProvider) {
    editingProvider = JSON.parse(JSON.stringify(provider));
  }

  function saveProvider() {
    if (!config || !editingProvider) return;

    const existingIndex = config.llm_providers.findIndex(p => p.name === editingProvider!.name);
    if (existingIndex >= 0) {
      config.llm_providers[existingIndex] = editingProvider;
    } else {
      config.llm_providers.push(editingProvider);
    }
    config = { ...config };
    editingProvider = null;
  }

  function removeProvider(name: string) {
    if (!config) return;
    if (confirm(`Remove provider "${name}"? This cannot be undone.`)) {
      config.llm_providers = config.llm_providers.filter(p => p.name !== name);
      config = { ...config };
    }
  }

  function generateApiKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const prefix = 'mp_';
    let key = prefix;
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  }

  function addApiKey() {
    editingApiKey = {
      name: "",
      key: generateApiKey(),
      permissions: ["read:stats"],
    };
    editingApiKeyIndex = null;
  }

  function editApiKey(apiKey: ApiKey, index: number) {
    editingApiKey = JSON.parse(JSON.stringify(apiKey));
    editingApiKeyIndex = index;
  }

  function saveApiKey() {
    if (!config || !editingApiKey) return;

    config.dashboard = config.dashboard ?? { api_keys: [] };
    config.dashboard.api_keys = config.dashboard.api_keys ?? [];

    if (editingApiKeyIndex !== null) {
      config.dashboard.api_keys[editingApiKeyIndex] = editingApiKey;
    } else {
      config.dashboard.api_keys.push(editingApiKey);
    }
    config = { ...config };
    editingApiKey = null;
    editingApiKeyIndex = null;
  }

  function removeApiKey(index: number) {
    if (!config?.dashboard?.api_keys) return;
    const apiKey = config.dashboard.api_keys[index];
    if (confirm($t("settings.apiKeys.removeConfirm", { name: apiKey.name }))) {
      config.dashboard.api_keys.splice(index, 1);
      config = { ...config };
    }
  }

  function toggleApiKeyPermission(permission: string) {
    if (!editingApiKey) return;

    const idx = editingApiKey.permissions.indexOf(permission);
    if (idx >= 0) {
      editingApiKey.permissions.splice(idx, 1);
    } else {
      editingApiKey.permissions.push(permission);
    }
    editingApiKey = { ...editingApiKey };
  }

  function copyApiKey(key: string) {
    navigator.clipboard.writeText(key);
  }

  async function testImapConnection() {
    if (!editingAccount) return;

    testingConnection = true;
    testResult = null;

    try {
      const result = await api.testImapConnection({
        host: editingAccount.imap.host,
        port: editingAccount.imap.port ?? 993,
        tls: editingAccount.imap.tls ?? "auto",
        auth: editingAccount.imap.auth ?? "basic",
        username: editingAccount.imap.username,
        password: editingAccount.imap.password,
        oauth_client_id: editingAccount.imap.oauth_client_id,
        oauth_client_secret: editingAccount.imap.oauth_client_secret,
        oauth_refresh_token: editingAccount.imap.oauth_refresh_token,
      });
      testResult = result;

      if (result.success) {
        connectionTested = true;
        wizardState = "connected";
        // Store available folders from server
        if (result.folders && result.folders.length > 0) {
          availableFolders = result.folders;
        }
      }
    } catch (e) {
      testResult = { success: false, error: e instanceof Error ? e.message : "Test failed" };
    } finally {
      testingConnection = false;
    }
  }
</script>

{#if showPortWarning}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={cancelPortChange}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal modal-warning" onclick={(e) => e.stopPropagation()}>
      <div class="warning-icon">&#9888;</div>
      <h3>{$t("settings.portWarning.title")}</h3>
      <p>
        {$t("settings.portWarning.message")}
      </p>
      <code class="new-url">{`${window.location.protocol}//${window.location.hostname}:${pendingPortChange}`}</code>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick={cancelPortChange}>{$t("common.cancel")}</button>
        <button class="btn btn-warning" onclick={confirmPortChange}>{$t("settings.portWarning.confirm")}</button>
      </div>
    </div>
  </div>
{/if}

<div class="settings">
  <div class="settings-header">
    <h2>{$t("settings.title")}</h2>
    {#if configPath}
      <div class="config-path-row">
        <span class="config-path">{configPath}</span>
        <button
          class="btn btn-icon"
          class:btn-active={yamlMode}
          onclick={toggleYamlMode}
          disabled={yamlLoading || saving}
          title={yamlMode ? $t("settings.backToForm") : $t("settings.editYaml")}
        >
          {#if yamlLoading}
            <span class="spinner-small"></span>
          {:else}
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
          {/if}
        </button>
      </div>
    {/if}
    <div class="header-actions">
      {#if saveMessage}
        <span class="save-message save-{saveMessage.type}">{saveMessage.text}</span>
      {:else if !yamlMode && hasChanges()}
        <span class="unsaved-indicator">
          {$t("settings.unsavedChanges")} ({changeCount()})
        </span>
      {/if}
      {#if yamlMode}
        <button class="btn btn-primary" onclick={handleYamlSave} disabled={saving || yamlLoading}>
          {saving ? $t("settings.saving") : $t("common.save")}
        </button>
      {:else}
        <button class="btn btn-primary" onclick={handleSave} disabled={saving || loading || !hasChanges()}>
          {saving ? $t("settings.saving") : $t("settings.saveChanges")}
        </button>
      {/if}
    </div>
  </div>

  {#if loading}
    <div class="loading">{$t("common.loading")}</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if yamlMode}
    <div class="yaml-editor-container">
      <div class="yaml-warning">
        {$t("settings.yaml.warning")}
      </div>
      <textarea
        class="yaml-editor"
        bind:value={yamlContent}
        spellcheck="false"
        placeholder="YAML configuration..."
      ></textarea>
    </div>
  {:else if config}
    <div class="settings-layout">
      <nav class="settings-nav">
        {#each sectionIds as sectionId}
          <button
            class="nav-item"
            class:active={activeSection === sectionId}
            onclick={() => activeSection = sectionId}
          >
            {$t(`settings.sections.${sectionId}`)}
          </button>
        {/each}
      </nav>

      <div class="settings-content">
        {#if activeSection === "global"}
          <section class="config-section">
            <h3>{$t("settings.general")}</h3>

            <div class="form-group">
              <label>
                <span class="label-text">
                  {$t("settings.global.pollingInterval")}
                  <span class="help-icon" title={helpTexts.polling_interval}>?</span>
                </span>
                <input type="text" bind:value={config.polling_interval} placeholder="30s" />
              </label>
            </div>

            <div class="form-group">
              <label>
                <span class="label-text">
                  {$t("settings.general.concurrencyLimit")}
                  <span class="help-icon" title={helpTexts.concurrency_limit}>?</span>
                </span>
                <input type="number" bind:value={config.concurrency_limit} min="1" max="20" />
              </label>
            </div>

            <div class="form-group checkbox">
              <label>
                <input type="checkbox" bind:checked={config.dry_run} />
                <span class="label-text">
                  {$t("settings.global.dryRunMode")}
                  <span class="help-icon" title={helpTexts.dry_run}>?</span>
                </span>
              </label>
            </div>

            <div class="form-group checkbox">
              <label>
                <input type="checkbox" bind:checked={config.add_processing_headers} />
                <span class="label-text">
                  {$t("settings.global.addProcessingHeadersLabel")}
                  <span class="help-icon" title={helpTexts.add_processing_headers}>?</span>
                </span>
              </label>
            </div>
            {#if config.add_processing_headers}
              <div class="warning-callout">
                <strong>Warning:</strong> Enabling processing headers adds X-Mailpilot-* headers to every processed email. This can:
                <ul>
                  <li>Expose that you're using email automation software</li>
                  <li>Reveal classification decisions to email recipients if forwarded</li>
                  <li>Increase email size slightly</li>
                </ul>
                <em>Only enable if you need to track or debug email processing and understand the privacy implications.</em>
              </div>
            {/if}

            <div class="form-group">
              <label>
                <span class="label-text">
                  {$t("settings.global.logLevel")}
                  <span class="help-icon" title={helpTexts["logging.level"]}>?</span>
                </span>
                <select
                  value={config.logging?.level ?? "info"}
                  onchange={(e) => {
                    config.logging = config.logging ?? {};
                    config.logging.level = (e.target as HTMLSelectElement).value;
                    config = { ...config };
                  }}
                >
                  <option value="debug">{$t("logs.debug")}</option>
                  <option value="info">{$t("logs.info")}</option>
                  <option value="warn">{$t("logs.warn")}</option>
                  <option value="error">{$t("logs.error")}</option>
                </select>
              </label>
            </div>

            <div class="form-group">
              <label>
                <span class="label-text">
                  {$t("settings.global.serverPort")}
                  <span class="help-icon" title={helpTexts["server.port"]}>?</span>
                </span>
                <input
                  type="number"
                  value={config.server?.port ?? 8080}
                  oninput={(e) => {
                    config.server = config.server ?? {};
                    config.server.port = parseInt((e.target as HTMLInputElement).value) || 8080;
                    config = { ...config };
                  }}
                  placeholder="8080"
                />
              </label>
            </div>

            <div class="form-group">
              <label>
                <span class="label-text">
                  {$t("settings.dashboard.sessionTtl")}
                  <span class="help-icon" title={helpTexts["dashboard.session_ttl"]}>?</span>
                </span>
                <input
                  type="text"
                  value={config.dashboard?.session_ttl ?? "24h"}
                  oninput={(e) => {
                    config.dashboard = config.dashboard ?? {};
                    config.dashboard.session_ttl = (e.target as HTMLInputElement).value || "24h";
                    config = { ...config };
                  }}
                  placeholder="24h"
                />
              </label>
            </div>
          </section>

        {:else if activeSection === "accounts"}
          <section class="config-section">
            <div class="section-header">
              <h3>{$t("settings.accounts")}</h3>
              <button class="btn btn-secondary btn-sm" onclick={addAccount}>+ {$t("settings.accounts.add")}</button>
            </div>

            {#if editingAccount}
              <div class="modal-overlay" onclick={() => editingAccount = null}>
                <div class="modal" onclick={(e) => e.stopPropagation()}>
                  <h3>{editingAccount.name ? $t("settings.accounts.editAccountTitle", { name: editingAccount.name }) : $t("settings.accounts.newAccount")}</h3>

                  <div class="form-group">
                    <label>
                      <span class="label-text">{$t("settings.accounts.name")}</span>
                      <input type="text" bind:value={editingAccount.name} placeholder="personal-gmail" />
                    </label>
                  </div>

                  <h4>{$t("settings.accounts.imapSettings")}</h4>
                  <div class="form-row">
                    <div class="form-group form-group-host">
                      <label>
                        <span class="label-text">{$t("settings.accounts.host")} <span class="help-icon" title={helpTexts["imap.host"]}>?</span></span>
                        <div class="host-input-wrapper">
                          <input
                            type="text"
                            bind:value={editingAccount.imap.host}
                            placeholder="imap.gmail.com"
                            onfocus={() => showPresetDropdown = imapPresets.length > 0}
                            onkeydown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                showPresetDropdown = false;
                                probeImapServer();
                              }
                            }}
                          />
                          {#if showPresetDropdown && imapPresets.length > 0}
                            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                            <div class="preset-backdrop" onmousedown={() => { showPresetDropdown = false; handleHostBlur(); }}></div>
                            <div class="preset-dropdown">
                              {#each imapPresets as preset}
                                <button
                                  type="button"
                                  class="preset-item"
                                  onmousedown={() => {
                                    if (editingAccount) {
                                      editingAccount.imap.host = preset.host;
                                      showPresetDropdown = false;
                                      probeImapServer();
                                    }
                                  }}
                                >
                                  {preset.name}
                                  <span class="preset-host">{preset.host}</span>
                                </button>
                              {/each}
                            </div>
                          {/if}
                        </div>
                      </label>
                    </div>
                    <div class="form-group">
                      <label>
                        <span class="label-text">
                          {$t("settings.accounts.port")}
                          {#if portLocked || connectionFieldsLocked}
                            <span class="locked-icon" title={connectionFieldsLocked ? "Enter IMAP host first" : "Auto-detected from server"}>🔒</span>
                          {/if}
                          <span class="help-icon" title={helpTexts["imap.port"]}>?</span>
                        </span>
                        <input
                          type="number"
                          bind:value={editingAccount.imap.port}
                          placeholder="993"
                          disabled={portLocked || connectionFieldsLocked}
                          class:field-locked={portLocked || connectionFieldsLocked}
                        />
                      </label>
                    </div>
                    {#if probingImap}
                      <div class="probe-status">
                        <span class="spinner-small"></span>
                        <span>Detecting server...</span>
                      </div>
                    {:else if probeResult?.provider}
                      <div class="probe-status probe-success">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <span>{probeResult.provider.name}</span>
                        {#if probeResult.authMethods?.includes("oauth2")}
                          <span class="badge">OAuth supported</span>
                        {/if}
                      </div>
                    {:else if connectionFieldsLocked && !probingImap}
                      <div class="probe-status">
                        <span>Enter IMAP host to auto-detect</span>
                      </div>
                    {/if}
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label>
                        <span class="label-text">
                          {$t("settings.accounts.tlsMode")}
                          {#if connectionFieldsLocked}
                            <span class="locked-icon" title="Enter IMAP host first">🔒</span>
                          {/if}
                          <span class="help-icon" title={helpTexts["imap.tls"]}>?</span>
                        </span>
                        <select bind:value={editingAccount.imap.tls} onchange={handleTlsModeChange} disabled={connectionFieldsLocked} class:field-locked={connectionFieldsLocked}>
                          {#each getAvailableTlsModes() as mode}
                            <option value={mode.value}>{mode.label}</option>
                          {/each}
                        </select>
                      </label>
                    </div>
                    <div class="form-group">
                      <label>
                        <span class="label-text">
                          {$t("settings.accounts.authTypeLabel")}
                          {#if connectionFieldsLocked}
                            <span class="locked-icon" title="Enter IMAP host first">🔒</span>
                          {/if}
                          <span class="help-icon" title={helpTexts["imap.auth"]}>?</span>
                        </span>
                        <select bind:value={editingAccount.imap.auth} disabled={connectionFieldsLocked} class:field-locked={connectionFieldsLocked}>
                          <option value="basic">{$t("settings.accounts.authBasic")}</option>
                          {#if !probeResult?.authMethods || probeResult.authMethods.includes("oauth2")}
                            <option value="oauth2">{$t("settings.accounts.authOauth2")}</option>
                          {/if}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div class="form-group">
                    <label>
                      <span class="label-text">{$t("settings.accounts.user")} <span class="help-icon" title={helpTexts["imap.username"]}>?</span></span>
                      <input type="text" bind:value={editingAccount.imap.username} placeholder="user@gmail.com" />
                    </label>
                  </div>

                  {#if editingAccount.imap.auth === "basic"}
                    <div class="form-group">
                      <label>
                        <span class="label-text">{$t("settings.accounts.password")} <span class="help-icon" title={helpTexts["imap.password"]}>?</span></span>
                        <input type="password" bind:value={editingAccount.imap.password} placeholder={$t("settings.accounts.passwordHelp")} />
                      </label>
                    </div>
                  {:else}
                    <div class="form-group">
                      <label>
                        <span class="label-text">{$t("settings.accounts.clientId")}</span>
                        <input type="text" bind:value={editingAccount.imap.oauth_client_id} />
                      </label>
                    </div>
                    <div class="form-group">
                      <label>
                        <span class="label-text">{$t("settings.accounts.clientSecret")}</span>
                        <input type="password" bind:value={editingAccount.imap.oauth_client_secret} />
                      </label>
                    </div>
                    <div class="form-group">
                      <label>
                        <span class="label-text">{$t("settings.accounts.refreshToken")}</span>
                        <input type="password" bind:value={editingAccount.imap.oauth_refresh_token} />
                      </label>
                    </div>
                  {/if}

                  <div class="test-connection-row">
                    <button
                      class="btn btn-secondary btn-sm"
                      onclick={testImapConnection}
                      disabled={testingConnection || !editingAccount.imap.host || !editingAccount.imap.username}
                    >
                      {#if testingConnection}
                        <span class="spinner"></span>
                        Testing...
                      {:else}
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                          <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        Test Connection
                      {/if}
                    </button>
                    {#if testResult}
                      <span class="test-result" class:success={testResult.success} class:error={!testResult.success}>
                        {#if testResult.success}
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Connection successful
                        {:else}
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="15" y1="9" x2="9" y2="15"/>
                            <line x1="9" y1="9" x2="15" y2="15"/>
                          </svg>
                          {testResult.error ?? "Connection failed"}
                        {/if}
                      </span>
                    {/if}
                  </div>

                  <div class="wizard-section" class:section-locked={!connectionTested}>
                    {#if !connectionTested}
                      <div class="section-lock-overlay">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0110 0v4"/>
                        </svg>
                        <span>Test connection to unlock</span>
                      </div>
                    {/if}
                    <h4>{$t("settings.accounts.foldersSection")}</h4>
                    <div class="form-group">
                      <label>
                        <span class="label-text">{$t("settings.accounts.watchFolders")} <span class="help-icon" title={helpTexts["folders.watch"]}>?</span></span>
                        {#if availableFolders.length > 0}
                          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                          <div class="multi-select-dropdown">
                            <button type="button" class="dropdown-trigger" onclick={() => showWatchFolderDropdown = !showWatchFolderDropdown}>
                              {(editingAccount.folders?.watch ?? ["INBOX"]).join(", ") || "Select folders"}
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"/>
                              </svg>
                            </button>
                            {#if showWatchFolderDropdown}
                              <div class="dropdown-menu" onclick={(e) => e.stopPropagation()}>
                                {#each availableFolders as folder}
                                  <label class="dropdown-item">
                                    <input
                                      type="checkbox"
                                      checked={(editingAccount.folders?.watch ?? ["INBOX"]).includes(folder)}
                                      onchange={() => {
                                        editingAccount!.folders ??= {};
                                        const current = editingAccount!.folders.watch ?? ["INBOX"];
                                        if (current.includes(folder)) {
                                          editingAccount!.folders.watch = current.filter(f => f !== folder);
                                        } else {
                                          editingAccount!.folders.watch = [...current, folder];
                                        }
                                      }}
                                    />
                                    <span>{folder}</span>
                                  </label>
                                {/each}
                              </div>
                            {/if}
                          </div>
                        {:else}
                          <input
                            type="text"
                            value={editingAccount.folders?.watch?.join(", ") ?? "INBOX"}
                            oninput={(e) => {
                              editingAccount!.folders ??= {};
                              editingAccount!.folders.watch = (e.target as HTMLInputElement).value.split(",").map(s => s.trim()).filter(Boolean);
                            }}
                            placeholder="INBOX, Work"
                          />
                        {/if}
                      </label>
                    </div>
                    <div class="form-row">
                      <div class="form-group">
                        <label>
                          <span class="label-text">{$t("settings.accounts.folderMode")} <span class="help-icon" title={helpTexts["folders.mode"]}>?</span></span>
                          <select
                            value={editingAccount.folders?.mode ?? "predefined"}
                            onchange={(e) => {
                              editingAccount!.folders = editingAccount!.folders ?? {};
                              editingAccount!.folders.mode = (e.target as HTMLSelectElement).value;
                            }}
                          >
                            <option value="predefined">{$t("settings.accounts.predefinedOnly")}</option>
                            <option value="auto_create">{$t("settings.accounts.autoCreateFolders")}</option>
                          </select>
                        </label>
                      </div>
                      {#if (editingAccount.folders?.mode ?? "predefined") === "predefined"}
                        <div class="form-group">
                          <label>
                            <span class="label-text">{$t("settings.accounts.allowedFolders")} <span class="help-icon" title={helpTexts["folders.allowed"]}>?</span></span>
                            {#if availableFolders.length > 0}
                              <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                              <div class="multi-select-dropdown">
                                <button type="button" class="dropdown-trigger" onclick={() => showAllowedFolderDropdown = !showAllowedFolderDropdown}>
                                  {(editingAccount.folders?.allowed ?? []).length > 0
                                    ? (editingAccount.folders?.allowed ?? []).join(", ")
                                    : "All folders (auto-discover)"}
                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="6 9 12 15 18 9"/>
                                  </svg>
                                </button>
                                {#if showAllowedFolderDropdown}
                                  <div class="dropdown-menu" onclick={(e) => e.stopPropagation()}>
                                    {#each availableFolders as folder}
                                      <label class="dropdown-item">
                                        <input
                                          type="checkbox"
                                          checked={(editingAccount.folders?.allowed ?? []).includes(folder)}
                                          onchange={() => {
                                            editingAccount!.folders ??= {};
                                            const current = editingAccount!.folders.allowed ?? [];
                                            if (current.includes(folder)) {
                                              editingAccount!.folders.allowed = current.filter(f => f !== folder);
                                            } else {
                                              editingAccount!.folders.allowed = [...current, folder];
                                            }
                                          }}
                                        />
                                        <span>{folder}</span>
                                      </label>
                                    {/each}
                                  </div>
                                {/if}
                              </div>
                            {:else}
                              <input
                                type="text"
                                value={editingAccount.folders?.allowed?.join(", ") ?? ""}
                                oninput={(e) => {
                                  editingAccount!.folders = editingAccount!.folders ?? {};
                                  const value = (e.target as HTMLInputElement).value;
                                  editingAccount!.folders.allowed = value ? value.split(",").map(s => s.trim()).filter(Boolean) : undefined;
                                }}
                                placeholder="Archive, Work/Important"
                              />
                            {/if}
                          </label>
                          {#if !editingAccount.folders?.allowed || editingAccount.folders.allowed.length === 0}
                            <div class="info-note">{$t("settings.accounts.autoDiscoverNote")}</div>
                          {/if}
                        </div>
                      {/if}
                    </div>

                    <h4>{$t("settings.accounts.llmSettings")}</h4>
                  <div class="form-row">
                    <div class="form-group">
                      <label>
                        <span class="label-text">{$t("settings.accounts.provider")} <span class="help-icon" title={helpTexts["llm.provider"]}>?</span></span>
                        <select
                          value={editingAccount.llm?.provider ?? ""}
                          onchange={(e) => {
                            editingAccount!.llm = editingAccount!.llm ?? {};
                            editingAccount!.llm.provider = (e.target as HTMLSelectElement).value || undefined;
                          }}
                        >
                          {#each config?.llm_providers ?? [] as provider}
                            <option value={provider.name}>{provider.name}</option>
                          {/each}
                        </select>
                      </label>
                    </div>
                    <div class="form-group">
                      <label>
                        <span class="label-text">{$t("settings.accounts.model")} <span class="help-icon" title={helpTexts["llm.model"]}>?</span></span>
                        <input
                          type="text"
                          value={editingAccount.llm?.model ?? ""}
                          oninput={(e) => {
                            editingAccount!.llm = editingAccount!.llm ?? {};
                            editingAccount!.llm.model = (e.target as HTMLInputElement).value || undefined;
                          }}
                          placeholder={$t("settings.accounts.useProviderDefault")}
                        />
                      </label>
                    </div>
                  </div>
                  <div class="form-group">
                    <label>
                      <span class="label-text">{$t("settings.accounts.promptOverride")} <span class="help-icon" title={helpTexts.prompt_override}>?</span></span>
                      <textarea
                        value={editingAccount.prompt_override ?? ""}
                        oninput={(e) => {
                          editingAccount!.prompt_override = (e.target as HTMLTextAreaElement).value || undefined;
                        }}
                        rows="4"
                        placeholder={$t("settings.accounts.leaveEmptyForDefault")}
                      ></textarea>
                    </label>
                    <p class="help-text">{$t("settings.accounts.promptOverrideHelp")}</p>
                  </div>
                  </div><!-- end wizard-section -->

                  <div class="modal-actions">
                    <button class="btn btn-secondary" onclick={() => editingAccount = null}>{$t("common.cancel")}</button>
                    <button
                      class="btn btn-primary"
                      onclick={saveAccount}
                      disabled={!connectionTested && !editingAccount.name}
                      title={!connectionTested && !editingAccount.name ? "Test connection first" : ""}
                    >
                      {$t("settings.accounts.saveAccount")}
                    </button>
                  </div>
                </div>
              </div>
            {/if}

            <div class="items-list">
              {#each config.accounts as account}
                <div class="list-item">
                  <div class="item-info">
                    <strong>{account.name}</strong>
                    <span class="item-meta">{account.imap.username} @ {account.imap.host}</span>
                  </div>
                  <div class="item-actions">
                    <button class="btn btn-sm" onclick={() => editAccount(account)}>{$t("common.edit")}</button>
                    <button class="btn btn-sm btn-danger" onclick={() => removeAccount(account.name)}>{$t("common.remove")}</button>
                  </div>
                </div>
              {/each}
            </div>
          </section>

        {:else if activeSection === "providers"}
          <section class="config-section">
            <div class="section-header">
              <h3>{$t("settings.providers")}</h3>
              <button class="btn btn-secondary btn-sm" onclick={addProvider}>+ {$t("settings.providers.add")}</button>
            </div>

            {#if editingProvider}
              <div class="modal-overlay" onclick={() => editingProvider = null}>
                <div class="modal" onclick={(e) => e.stopPropagation()}>
                  <h3>{editingProvider.name ? $t("settings.providers.editProviderTitle", { name: editingProvider.name }) : $t("settings.providers.newProvider")}</h3>

                  <div class="form-group">
                    <label>
                      <span class="label-text">{$t("settings.providers.name")}</span>
                      <input type="text" bind:value={editingProvider.name} placeholder="openai" />
                    </label>
                  </div>

                  <div class="form-group">
                    <label>
                      <span class="label-text">{$t("settings.providers.apiUrl")} <span class="help-icon" title={helpTexts["provider.api_url"]}>?</span></span>
                      <input type="text" bind:value={editingProvider.api_url} placeholder="https://api.openai.com/v1/chat/completions" />
                    </label>
                  </div>

                  <div class="form-group">
                    <label>
                      <span class="label-text">{$t("settings.providers.apiKey")} <span class="help-icon" title={helpTexts["provider.api_key"]}>?</span></span>
                      <input type="password" bind:value={editingProvider.api_key} placeholder="sk-..." />
                    </label>
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label>
                        <span class="label-text">{$t("settings.providers.defaultModel")} <span class="help-icon" title={helpTexts["provider.default_model"]}>?</span></span>
                        <input type="text" bind:value={editingProvider.default_model} placeholder="gpt-4o" />
                      </label>
                    </div>
                    <div class="form-group">
                      <label>
                        <span class="label-text">{$t("settings.providers.rateLimit")} <span class="help-icon" title={helpTexts["provider.rate_limit"]}>?</span></span>
                        <input type="number" bind:value={editingProvider.rate_limit} placeholder="60" />
                      </label>
                    </div>
                  </div>

                  <div class="modal-actions">
                    <button class="btn btn-secondary" onclick={() => editingProvider = null}>{$t("common.cancel")}</button>
                    <button class="btn btn-primary" onclick={saveProvider}>{$t("settings.providers.saveProvider")}</button>
                  </div>
                </div>
              </div>
            {/if}

            <div class="items-list">
              {#each config.llm_providers as provider}
                <div class="list-item">
                  <div class="item-info">
                    <strong>{provider.name}</strong>
                    <span class="item-meta">{provider.default_model} - {provider.api_url}</span>
                  </div>
                  <div class="item-actions">
                    <button class="btn btn-sm" onclick={() => editProvider(provider)}>{$t("common.edit")}</button>
                    <button class="btn btn-sm btn-danger" onclick={() => removeProvider(provider.name)}>{$t("common.remove")}</button>
                  </div>
                </div>
              {/each}
            </div>

            <h4>{$t("settings.global.defaultPromptLabel")}</h4>
            <div class="form-group">
              <label>
                <span class="label-text">
                  {$t("settings.global.classificationPrompt")}
                  <span class="help-icon" title={helpTexts.default_prompt}>?</span>
                </span>
                <textarea bind:value={config.default_prompt} rows="8" placeholder={$t("settings.prompt.placeholder")}></textarea>
              </label>
            </div>
          </section>

        {:else if activeSection === "apikeys"}
          <section class="config-section">
            <h3>{$t("settings.apiKeys.sectionTitle")}</h3>
            <p class="section-note">{$t("settings.apiKeys.description")}</p>

            {#if editingApiKey}
              <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
              <div class="modal-overlay" onclick={() => { editingApiKey = null; editingApiKeyIndex = null; }}>
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                <div class="modal" onclick={(e) => e.stopPropagation()}>
                  <h3>{editingApiKeyIndex !== null ? $t("settings.apiKeys.editApiKey") : $t("settings.apiKeys.newApiKey")}</h3>

                  <div class="form-group">
                    <label>
                      <span class="label-text">{$t("settings.apiKeys.name")}</span>
                      <input type="text" bind:value={editingApiKey.name} placeholder="My Integration" />
                    </label>
                  </div>

                  <div class="form-group">
                    <label>
                      <span class="label-text">{$t("settings.apiKeys.key")}</span>
                      <div class="api-key-input-row">
                        <input
                          type="text"
                          value={editingApiKey.key}
                          readonly
                          class="api-key-input"
                        />
                        <button
                          class="btn btn-secondary btn-sm"
                          onclick={() => { editingApiKey!.key = generateApiKey(); editingApiKey = { ...editingApiKey! }; }}
                          title={$t("settings.apiKeys.regenerate")}
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M23 4v6h-6"/>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                          </svg>
                        </button>
                        <button
                          class="btn btn-secondary btn-sm"
                          onclick={() => copyApiKey(editingApiKey!.key)}
                          title={$t("settings.apiKeys.copy")}
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                        </button>
                      </div>
                      <p class="help-text">{$t("settings.apiKeys.keyNote")}</p>
                    </label>
                  </div>

                  <div class="form-group">
                    <span class="label-text">{$t("settings.apiKeys.permissions")}</span>
                    <div class="permissions-simple">
                      <label class="permission-toggle" class:disabled={editingApiKey.permissions.includes("*")}>
                        <input
                          type="checkbox"
                          checked={editingApiKey.permissions.includes("read:stats") || editingApiKey.permissions.includes("read:*") || editingApiKey.permissions.includes("*")}
                          disabled={editingApiKey.permissions.includes("*")}
                          onchange={() => toggleApiKeyPermission("read:stats")}
                        />
                        <span>Read Stats</span>
                      </label>
                      <label class="permission-toggle" class:disabled={editingApiKey.permissions.includes("*")}>
                        <input
                          type="checkbox"
                          checked={editingApiKey.permissions.includes("read:activity") || editingApiKey.permissions.includes("read:*") || editingApiKey.permissions.includes("*")}
                          disabled={editingApiKey.permissions.includes("*")}
                          onchange={() => toggleApiKeyPermission("read:activity")}
                        />
                        <span>Read Activity</span>
                      </label>
                      <label class="permission-toggle" class:disabled={editingApiKey.permissions.includes("*")}>
                        <input
                          type="checkbox"
                          checked={editingApiKey.permissions.includes("read:logs") || editingApiKey.permissions.includes("read:*") || editingApiKey.permissions.includes("*")}
                          disabled={editingApiKey.permissions.includes("*")}
                          onchange={() => toggleApiKeyPermission("read:logs")}
                        />
                        <span>Read Logs</span>
                      </label>
                      <label class="permission-toggle" class:disabled={editingApiKey.permissions.includes("*")}>
                        <input
                          type="checkbox"
                          checked={editingApiKey.permissions.includes("read:export") || editingApiKey.permissions.includes("read:*") || editingApiKey.permissions.includes("*")}
                          disabled={editingApiKey.permissions.includes("*")}
                          onchange={() => toggleApiKeyPermission("read:export")}
                        />
                        <span>Export Data</span>
                      </label>
                      <label class="permission-toggle permission-admin">
                        <input
                          type="checkbox"
                          checked={editingApiKey.permissions.includes("*")}
                          onchange={() => {
                            if (editingApiKey!.permissions.includes("*")) {
                              editingApiKey!.permissions = ["read:stats"];
                            } else {
                              editingApiKey!.permissions = ["*"];
                            }
                            editingApiKey = { ...editingApiKey! };
                          }}
                        />
                        <span>Full Access</span>
                        <small>(grants all permissions including account management)</small>
                      </label>
                    </div>
                  </div>

                  <div class="modal-actions">
                    <button class="btn btn-secondary" onclick={() => { editingApiKey = null; editingApiKeyIndex = null; }}>{$t("common.cancel")}</button>
                    <button class="btn btn-primary" onclick={saveApiKey} disabled={!editingApiKey.name}>{$t("settings.apiKeys.saveApiKey")}</button>
                  </div>
                </div>
              </div>
            {/if}

            <div class="section-header api-keys-header">
              <span></span>
              <button class="btn btn-secondary btn-sm" onclick={addApiKey}>+ {$t("settings.apiKeys.add")}</button>
            </div>

            {#if config.dashboard?.api_keys && config.dashboard.api_keys.length > 0}
              <div class="items-list">
                {#each config.dashboard.api_keys as apiKey, index}
                  <div class="list-item api-key-item">
                    <div class="item-info">
                      <strong>{apiKey.name}</strong>
                      <div class="api-key-meta">
                        <span class="api-key-value" class:blurred={showApiKey !== apiKey.key}>
                          {showApiKey === apiKey.key ? apiKey.key : apiKey.key.slice(0, 8) + '••••••••'}
                        </span>
                        <button
                          class="btn-icon-tiny"
                          onclick={() => showApiKey = showApiKey === apiKey.key ? null : apiKey.key}
                          title={showApiKey === apiKey.key ? $t("settings.apiKeys.hide") : $t("settings.apiKeys.show")}
                        >
                          {#if showApiKey === apiKey.key}
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                              <line x1="1" y1="1" x2="23" y2="23"/>
                            </svg>
                          {:else}
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          {/if}
                        </button>
                        <button
                          class="btn-icon-tiny"
                          onclick={() => copyApiKey(apiKey.key)}
                          title={$t("settings.apiKeys.copy")}
                        >
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                        </button>
                      </div>
                      <span class="item-meta permissions-meta">
                        {apiKey.permissions.includes("*") ? "Full access" : `${apiKey.permissions.length} permission${apiKey.permissions.length === 1 ? '' : 's'}`}
                      </span>
                    </div>
                    <div class="item-actions">
                      <button class="btn btn-sm" onclick={() => editApiKey(apiKey, index)}>{$t("common.edit")}</button>
                      <button class="btn btn-sm btn-danger" onclick={() => removeApiKey(index)}>{$t("common.remove")}</button>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="empty-state">
                <p>{$t("settings.apiKeys.noApiKeys")}</p>
              </div>
            {/if}
          </section>

        {:else if activeSection === "attachments"}
          <section class="config-section">
            <div class="section-header">
              <h3>{$t("settings.attachments.sectionTitle")}</h3>
              {#if services?.tika?.enabled}
                <span class="service-status" class:healthy={services.tika.healthy}>
                  <span class="status-dot"></span>
                  {services.tika.healthy ? $t("settings.attachments.tikaConnected") : $t("settings.attachments.tikaUnreachable")}
                </span>
              {/if}
            </div>

            <div class="form-group checkbox">
              <label>
                <input type="checkbox" bind:checked={config.attachments.enabled} />
                <span class="label-text">
                  {$t("settings.attachments.enableLabel")}
                  <span class="help-icon" title={helpTexts["attachments.enabled"]}>?</span>
                </span>
              </label>
            </div>

            {#if config.attachments?.enabled}
              <div class="form-group">
                <label>
                  <span class="label-text">
                    {$t("settings.attachments.tikaUrl")}
                    <span class="help-icon" title={helpTexts["attachments.tika_url"]}>?</span>
                  </span>
                  <input type="text" bind:value={config.attachments.tika_url} placeholder="http://tika:9998" />
                </label>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>
                    <span class="label-text">
                      {$t("settings.attachments.maxSizeMb")}
                      <span class="help-icon" title={helpTexts["attachments.max_size_mb"]}>?</span>
                    </span>
                    <input type="number" bind:value={config.attachments.max_size_mb} placeholder="10" />
                  </label>
                </div>
                <div class="form-group">
                  <label>
                    <span class="label-text">
                      {$t("settings.attachments.maxExtractedChars")}
                      <span class="help-icon" title={helpTexts["attachments.max_extracted_chars"]}>?</span>
                    </span>
                    <input type="number" bind:value={config.attachments.max_extracted_chars} placeholder="10000" />
                  </label>
                </div>
              </div>

              <div class="form-group checkbox">
                <label>
                  <input type="checkbox" bind:checked={config.attachments.extract_images} />
                  <span class="label-text">
                    {$t("settings.attachments.extractImagesForVision")}
                    <span class="help-icon" title={helpTexts["attachments.extract_images"]}>?</span>
                  </span>
                </label>
              </div>
            {/if}
          </section>

        {:else if activeSection === "antivirus"}
          <section class="config-section">
            <div class="section-header">
              <h3>{$t("settings.antivirus.sectionTitle")}</h3>
              {#if services?.clamav?.enabled}
                <span class="service-status" class:healthy={services.clamav.healthy}>
                  <span class="status-dot"></span>
                  {services.clamav.healthy ? $t("settings.antivirus.clamavConnected") : $t("settings.antivirus.clamavUnreachable")}
                </span>
              {/if}
            </div>

            <div class="form-group checkbox">
              <label>
                <input type="checkbox" bind:checked={config.antivirus.enabled} />
                <span class="label-text">
                  {$t("settings.antivirus.enableVirusScanning")}
                  <span class="help-icon" title={helpTexts["antivirus.enabled"]}>?</span>
                </span>
              </label>
            </div>

            {#if config.antivirus?.enabled}
              <div class="form-row">
                <div class="form-group">
                  <label>
                    <span class="label-text">
                      {$t("settings.antivirus.host")}
                      <span class="help-icon" title={helpTexts["antivirus.host"]}>?</span>
                    </span>
                    <input type="text" bind:value={config.antivirus.host} placeholder="localhost" />
                  </label>
                </div>
                <div class="form-group">
                  <label>
                    <span class="label-text">
                      {$t("settings.antivirus.port")}
                      <span class="help-icon" title={helpTexts["antivirus.port"]}>?</span>
                    </span>
                    <input type="number" bind:value={config.antivirus.port} placeholder="3310" />
                  </label>
                </div>
              </div>

              <div class="form-group">
                <label>
                  <span class="label-text">
                    {$t("settings.antivirus.onVirusDetected")}
                    <span class="help-icon" title={helpTexts["antivirus.on_virus_detected"]}>?</span>
                  </span>
                  <select bind:value={config.antivirus.on_virus_detected}>
                    <option value="quarantine">{$t("settings.antivirus.quarantine")}</option>
                    <option value="delete">{$t("settings.antivirus.delete")}</option>
                    <option value="flag_only">{$t("settings.antivirus.flagOnly")}</option>
                  </select>
                </label>
              </div>
            {/if}
          </section>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .settings {
    padding: 1rem;
  }

  .settings-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .settings-header h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .config-path-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .config-path {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-family: monospace;
    background: var(--bg-tertiary);
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
  }

  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.375rem;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.25rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-icon:hover:not(:disabled) {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .btn-icon.btn-active {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  .btn-icon:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner-small {
    width: 14px;
    height: 14px;
    border: 2px solid var(--border-color);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .yaml-editor-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    height: calc(100vh - 250px);
    min-height: 400px;
  }

  .yaml-warning {
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    color: var(--warning);
    background: color-mix(in srgb, var(--warning) 10%, transparent);
    border-left: 3px solid var(--warning);
    border-radius: 0.25rem;
  }

  .yaml-editor {
    flex: 1;
    width: 100%;
    padding: 1rem;
    font-family: monospace;
    font-size: 0.8125rem;
    line-height: 1.5;
    color: var(--text-primary);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    resize: none;
    tab-size: 2;
  }

  .yaml-editor:focus {
    outline: none;
    border-color: var(--accent);
  }

  .header-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .save-message {
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
  }

  .save-success {
    background: color-mix(in srgb, var(--success) 20%, transparent);
    color: var(--success);
  }

  .save-error {
    background: color-mix(in srgb, var(--error) 20%, transparent);
    color: var(--error);
  }

  .unsaved-indicator {
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    background: color-mix(in srgb, var(--warning) 20%, transparent);
    color: var(--warning);
    font-weight: 500;
  }

  .loading, .error {
    padding: 2rem;
    text-align: center;
    color: var(--text-secondary);
  }

  .error {
    color: var(--error);
  }

  .settings-layout {
    display: flex;
    gap: 1.5rem;
  }

  .settings-nav {
    width: 200px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .nav-item {
    background: none;
    border: none;
    text-align: left;
    padding: 0.75rem 1rem;
    border-radius: 0.375rem;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.875rem;
    transition: background 0.2s, color 0.2s;
  }

  .nav-item:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .nav-item.active {
    background: var(--accent);
    color: white;
  }

  .settings-content {
    flex: 1;
    min-width: 0;
  }

  .config-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
  }

  .config-section h3 {
    margin: 0 0 1.5rem;
    font-size: 1.125rem;
  }

  .config-section h4 {
    margin: 1.5rem 0 1rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-note {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    background: var(--bg-tertiary);
    padding: 0.75rem 1rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
    border-left: 3px solid var(--warning);
  }

  .warning-callout {
    font-size: 0.8125rem;
    color: var(--warning);
    background: color-mix(in srgb, var(--warning) 10%, transparent);
    padding: 0.75rem 1rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
    border-left: 3px solid var(--warning);
  }

  .warning-callout ul {
    margin: 0.5rem 0;
    padding-left: 1.25rem;
  }

  .warning-callout li {
    margin: 0.25rem 0;
    color: var(--text-secondary);
  }

  .warning-callout em {
    display: block;
    margin-top: 0.5rem;
    font-style: normal;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .test-connection-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
  }

  .test-connection-row .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }

  .test-connection-row .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--border-color);
    border-top-color: var(--text-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .test-result {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .test-result.success {
    color: var(--success);
  }

  .test-result.error {
    color: var(--error);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  .section-header h3 {
    margin: 0;
  }

  .service-status {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--error);
    background: color-mix(in srgb, var(--error) 15%, transparent);
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
  }

  .service-status.healthy {
    color: var(--success);
    background: color-mix(in srgb, var(--success) 15%, transparent);
  }

  .service-status .status-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: currentColor;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
  }

  .form-group.checkbox label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .form-group.checkbox input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
    accent-color: var(--accent);
  }

  .label-text {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 0.375rem;
  }

  .form-group.checkbox .label-text {
    margin-bottom: 0;
  }

  .help-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    font-size: 0.625rem;
    font-weight: 600;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    border-radius: 50%;
    cursor: help;
  }

  .info-note {
    margin-top: 0.375rem;
    padding: 0.375rem 0.625rem;
    font-size: 0.6875rem;
    color: var(--text-secondary);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    border-left: 2px solid var(--accent);
    border-radius: 0.25rem;
  }

  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .form-group textarea {
    resize: vertical;
    font-family: monospace;
  }

  .form-group input:focus,
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--accent);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .items-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .list-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
  }

  .item-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .item-meta {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .item-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: background 0.2s, opacity 0.2s;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--accent);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent) 85%, black);
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--border-color);
  }

  .btn-danger {
    background: var(--error);
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--error) 85%, black);
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-warning {
    max-width: 450px;
    text-align: center;
  }

  .modal-warning .warning-icon {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
    color: var(--warning);
  }

  .modal-warning h3 {
    margin: 0 0 1rem;
    color: var(--warning);
  }

  .modal-warning p {
    margin: 0 0 0.75rem;
    color: var(--text-secondary);
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .modal-warning .warning-text {
    font-size: 0.8125rem;
  }

  .modal-warning .new-url {
    display: block;
    padding: 0.5rem 0.75rem;
    background: var(--bg-tertiary);
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    color: var(--text-primary);
    margin-bottom: 1.5rem;
  }

  .modal-warning .modal-actions {
    display: flex;
    justify-content: center;
    gap: 0.75rem;
  }

  .btn-warning {
    background: var(--warning);
    color: #1f2937;
  }

  .btn-warning:hover {
    background: color-mix(in srgb, var(--warning) 85%, black);
  }

  .modal h3 {
    margin: 0 0 1.5rem;
  }

  .modal h4 {
    margin: 1.5rem 0 1rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color);
  }

  /* API Keys Section */
  .api-keys-help {
    margin: 0 0 1rem;
    color: var(--text-secondary);
  }

  .api-keys-header {
    margin-bottom: 0.75rem;
  }

  .api-key-input-row {
    display: flex;
    gap: 0.5rem;
  }

  .api-key-input {
    flex: 1;
    font-family: monospace;
    font-size: 0.8125rem;
  }

  .permissions-simple {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .permission-toggle {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 1rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
  }

  .permission-toggle:hover:not(.disabled) {
    background: var(--bg-tertiary);
  }

  .permission-toggle.disabled {
    opacity: 0.6;
    cursor: default;
  }

  .permission-toggle.disabled input {
    cursor: default;
  }

  .permission-toggle span {
    font-size: 0.875rem;
  }

  .permission-toggle small {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-left: 0.25rem;
  }

  .permission-toggle.permission-admin {
    background: var(--bg-tertiary);
    border-color: var(--accent);
    margin-top: 0.5rem;
  }

  .permission-toggle.permission-admin span {
    font-weight: 500;
  }

  .api-key-item {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }

  .api-key-item .item-info {
    flex-direction: column;
    gap: 0.375rem;
  }

  .api-key-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .api-key-value {
    font-family: monospace;
    font-size: 0.75rem;
    color: var(--text-secondary);
    background: var(--bg-tertiary);
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    transition: filter 0.15s;
  }

  .api-key-value.blurred {
    filter: blur(3px);
    user-select: none;
  }

  .api-key-value.blurred:hover {
    filter: blur(1px);
  }

  .btn-icon-tiny {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 0.25rem;
    transition: background 0.15s, color 0.15s;
  }

  .btn-icon-tiny:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .permissions-meta {
    font-size: 0.6875rem;
  }

  .api-key-item .item-actions {
    justify-content: flex-end;
    border-top: 1px solid var(--border-color);
    padding-top: 0.5rem;
  }

  .empty-state {
    padding: 2rem;
    text-align: center;
    color: var(--text-secondary);
    background: var(--bg-primary);
    border: 1px dashed var(--border-color);
    border-radius: 0.5rem;
  }

  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
  }

  /* Wizard section locking */
  .wizard-section {
    position: relative;
    padding: 0.75rem;
    margin: 0 -0.75rem;
    border-radius: 0.375rem;
    transition: opacity 0.2s;
  }

  .wizard-section.section-locked {
    opacity: 0.5;
    pointer-events: none;
    background: var(--bg-tertiary);
  }

  .section-lock-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
    z-index: 10;
    white-space: nowrap;
  }

  /* Probe status */
  /* Host input with preset dropdown */
  .form-group-host {
    flex: 2;
  }

  .host-input-wrapper {
    position: relative;
  }

  .preset-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 99;
  }

  .preset-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 100;
    max-height: 200px;
    overflow-y: auto;
  }

  .preset-item {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 0.875rem;
    cursor: pointer;
    text-align: left;
  }

  .preset-item:hover {
    background: var(--bg-tertiary);
  }

  .preset-host {
    color: var(--text-secondary);
    font-size: 0.75rem;
  }

  /* Locked field indicator */
  .locked-icon {
    font-size: 0.75rem;
    margin-left: 0.25rem;
  }

  .field-locked {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .probe-status {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
    padding: 0.25rem 0.5rem;
    background: var(--bg-tertiary);
    border-radius: 0.25rem;
    align-self: flex-end;
    margin-bottom: 0.25rem;
  }

  .probe-status.probe-success {
    color: var(--success);
  }

  .probe-status .badge {
    font-size: 0.65rem;
    padding: 0.125rem 0.375rem;
    background: var(--accent);
    color: white;
    border-radius: 0.25rem;
  }

  /* Multi-select dropdown */
  .multi-select-dropdown {
    position: relative;
    width: 100%;
  }

  .dropdown-trigger {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: var(--text);
    cursor: pointer;
    text-align: left;
  }

  .dropdown-trigger:hover {
    border-color: var(--accent);
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 200px;
    overflow-y: auto;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 100;
    margin-top: 0.25rem;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .dropdown-item:hover {
    background: var(--bg-tertiary);
  }

  .dropdown-item input[type="checkbox"] {
    width: auto;
    margin: 0;
  }

  @media (max-width: 768px) {
    .settings-layout {
      flex-direction: column;
    }

    .settings-nav {
      width: 100%;
      flex-direction: row;
      flex-wrap: wrap;
    }

    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>
