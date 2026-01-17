<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import * as api from "../api";
  import { stats, serviceStatus, type ServicesStatus } from "../stores/data";
  import { settingsHasChanges } from "../stores/navigation";
  import { t } from "../i18n";
  import Modal from "./Modal.svelte";
  import Backdrop from "./Backdrop.svelte";

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
    notifications?: NotificationsConfig;
    confidence?: ConfidenceConfig;
  }

  interface LlmProvider {
    name: string;
    api_url: string;
    api_key?: string;
    default_model?: string;
    headers?: Record<string, string>;
    rate_limit?: number;
    max_body_tokens?: number;
    max_thread_tokens?: number;
    supports_vision?: boolean;
  }

  interface Account {
    name: string;
    imap: ImapConfig;
    llm?: { provider?: string; model?: string };
    folders?: { watch?: string[]; mode?: string; allowed?: string[] };
    webhooks?: Webhook[];
    prompt_override?: string;
    prompt_file?: string;
    allowed_actions?: string[];
    minimum_confidence?: number;
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

  interface NotificationsConfig {
    enabled?: boolean;
    events?: ("error" | "connection_lost" | "dead_letter" | "retry_exhausted" | "daily_summary")[];
    daily_summary_time?: string;
    quiet_hours?: {
      enabled?: boolean;
      start?: string;
      end?: string;
    };
  }

  interface ConfidenceConfig {
    enabled?: boolean;
    request_reasoning?: boolean;
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

  // Real-time sync: editing modal changes immediately persist to config
  // This prevents data loss if user accidentally closes the modal
  $effect(() => {
    if (!config || !editingAccount) return;
    const account = editingAccount;
    const index = editingAccountIndex;

    if (index !== null && index >= 0 && index < config.accounts.length) {
      config.accounts[index] = JSON.parse(JSON.stringify(account));
    } else if (index === null && account.name) {
      const existingIdx = config.accounts.findIndex(a => a.name === account.name);
      if (existingIdx === -1) {
        config.accounts = [...config.accounts, JSON.parse(JSON.stringify(account))];
        editingAccountIndex = config.accounts.length - 1;
      }
    }
  });

  $effect(() => {
    if (!config || !editingProvider) return;
    const provider = editingProvider;
    const index = editingProviderIndex;

    if (index !== null && index >= 0 && index < config.llm_providers.length) {
      config.llm_providers[index] = JSON.parse(JSON.stringify(provider));
    } else if (index === null && provider.name) {
      const existingIdx = config.llm_providers.findIndex(p => p.name === provider.name);
      if (existingIdx === -1) {
        config.llm_providers = [...config.llm_providers, JSON.parse(JSON.stringify(provider))];
        editingProviderIndex = config.llm_providers.length - 1;
      }
    }
  });

  $effect(() => {
    if (!config || !editingApiKey) return;
    const apiKey = editingApiKey;
    const index = editingApiKeyIndex;

    config.dashboard = config.dashboard ?? { api_keys: [] };
    config.dashboard.api_keys = config.dashboard.api_keys ?? [];

    if (index !== null && index >= 0 && index < config.dashboard.api_keys.length) {
      config.dashboard.api_keys[index] = JSON.parse(JSON.stringify(apiKey));
    } else if (index === null && apiKey.name) {
      const existingIdx = config.dashboard.api_keys.findIndex(k => k.name === apiKey.name);
      if (existingIdx === -1) {
        config.dashboard.api_keys = [...config.dashboard.api_keys, JSON.parse(JSON.stringify(apiKey))];
        editingApiKeyIndex = config.dashboard.api_keys.length - 1;
      }
    }
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
      if (JSON.stringify(config.notifications) !== JSON.stringify(original.notifications)) count++;
      if (JSON.stringify(config.confidence) !== JSON.stringify(original.confidence)) count++;

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

  // Editing state - track both the item and its index for real-time syncing
  let editingAccount = $state<Account | null>(null);
  let editingAccountIndex = $state<number | null>(null);
  let editingProvider = $state<LlmProvider | null>(null);
  let editingProviderIndex = $state<number | null>(null);
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

  // Action types state (noop filtered out - always allowed by backend)
  let availableActionTypes = $state<api.ActionType[]>([]);
  let defaultAllowedActions = $state<api.ActionType[]>([]);
  let showAllowedActionsDropdown = $state(false);

  // Advanced section state
  let showAdvancedSection = $state(false);

  // Side modals state
  let showWebhooksModal = $state(false);
  let showFoldersModal = $state(false);
  let editingWebhookIndex = $state<number | null>(null);
  let editingWebhook = $state<Webhook | null>(null);
  let testingWebhook = $state(false);
  let webhookTestResult = $state<{ success: boolean; error?: string } | null>(null);
  let webhookTested = $state(false);
  const webhookEventOptions = ["startup", "shutdown", "error", "action_taken", "connection_lost", "connection_restored"] as const;

  // LLM provider wizard state
  let llmPresets = $state<api.LlmPreset[]>([]);
  let showLlmPresetDropdown = $state(false);
  let testingLlmConnection = $state(false);
  let llmTestResult = $state<{ success: boolean; error?: string } | null>(null);
  let llmConnectionTested = $state(false);

  // Service status
  let services = $state<ServicesStatus | null>(null);
  let serviceCheckInterval: ReturnType<typeof setInterval> | null = null;

  // Port change tracking
  let originalPort = $state<number>(8080);
  let showPortWarning = $state(false);
  let pendingPortChange = $state<number | null>(null);

  const sectionIds = ["global", "accounts", "providers", "apikeys", "modules"] as const;

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
    prompt_override: "Overrides the global default prompt",
    "account.minimum_confidence": "Minimum confidence threshold for this account. Classifications below this go to dead letter queue.",
    "llm.provider": "Which LLM provider to use for this account",
    "llm.model": "Model to use (overrides provider default)",
    "provider.api_url": "API endpoint URL for the LLM provider",
    "provider.api_key": "API key for authentication",
    "provider.default_model": "Default model to use (e.g., gpt-4o, claude-3-5-sonnet)",
    "provider.rate_limit": "Maximum requests per minute",
    "provider.max_body_tokens": "Maximum tokens for email body content (default: 4000)",
    "provider.max_thread_tokens": "Maximum tokens for email thread context (default: 2000)",
    "provider.supports_vision": "Enable if this provider supports vision/image analysis (e.g., GPT-4o, Claude 3)",
    "webhook.url": "URL to send webhook notifications to",
    "webhook.events": "Events that trigger this webhook",
    "webhook.headers": "Custom HTTP headers to include in webhook requests",
    process_existing: "Process existing emails in watched folders when adding this account",
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
    "notifications.enabled": "Enable notifications for important events",
    "notifications.events": "Which events trigger notifications",
    "notifications.daily_summary_time": "When to send daily summary (24h format, e.g., 09:00)",
    "notifications.quiet_hours": "Suppress notifications during these hours",
    "confidence.enabled": "Enable confidence scoring to route low-confidence classifications to the dead letter queue",
    "confidence.minimum_threshold": "Classifications below this threshold go to dead letter queue (0.0-1.0)",
    "confidence.request_reasoning": "Ask the LLM to explain its classification reasoning",
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
    // Load LLM presets
    try {
      const llmPresetsResult = await api.fetchLlmPresets();
      llmPresets = llmPresetsResult.presets;
    } catch {
      // Presets are optional, ignore errors
    }
    // Load action types (filter out 'noop' - always allowed by backend)
    try {
      const actionTypesResult = await api.fetchActionTypes();
      availableActionTypes = actionTypesResult.actionTypes.filter(a => a !== "noop");
      defaultAllowedActions = actionTypesResult.defaultAllowed.filter(a => a !== "noop");
    } catch {
      // Use fallback defaults if fetch fails
      availableActionTypes = ["move", "spam", "flag", "read", "delete"];
      defaultAllowedActions = ["move", "spam", "flag", "read"];
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
      loadedConfig.notifications = loadedConfig.notifications ?? {
        enabled: true,
        events: ["error", "connection_lost"],
        quiet_hours: { enabled: false, start: "22:00", end: "08:00" },
      };
      loadedConfig.confidence = loadedConfig.confidence ?? {
        enabled: false,
        request_reasoning: true,
      };

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
    showAdvancedSection = false;
    editingWebhookIndex = null;
    editingWebhook = null;
    testingWebhook = false;
    webhookTestResult = null;
    webhookTested = false;
  }

  function addAccount() {
    resetWizardState();
    editingAccountIndex = null;
    // Default to first LLM provider if available
    const defaultProvider = config?.llm_providers?.[0]?.name;
    editingAccount = {
      name: "",
      imap: { host: "", port: 993, tls: "tls", auth: "basic", username: "", password: "" },
      folders: { watch: ["INBOX"] },
      llm: defaultProvider ? { provider: defaultProvider } : undefined,
    };
  }

  async function editAccount(account: Account) {
    if (!config) return;
    resetWizardState();
    const index = config.accounts.findIndex(a => a.name === account.name);
    editingAccountIndex = index >= 0 ? index : null;
    editingAccount = JSON.parse(JSON.stringify(account));
    // Set default LLM provider if not configured
    if (!editingAccount.llm?.provider && config.llm_providers?.length > 0) {
      editingAccount.llm = { provider: config.llm_providers[0].name };
    }
    // Auto-test connection for existing accounts
    if (account.name) {
      await testImapConnection();
      // If test fails, apply same locks as new account with failed test
      if (!connectionTested) {
        connectionFieldsLocked = false;
        wizardState = "idle";
      }
    }
  }

  function closeAccountModal() {
    editingAccount = null;
    editingAccountIndex = null;
    showWebhooksModal = false;
    showFoldersModal = false;
    editingWebhook = null;
    editingWebhookIndex = null;
    resetWizardState();
  }

  function saveAccount() {
    // With real-time syncing, changes are already in config
    // This function now just closes the modal
    closeAccountModal();
  }

  // Webhook management functions
  function addWebhook() {
    editingWebhook = {
      url: "",
      events: ["action_taken"],
      headers: {},
    };
    editingWebhookIndex = null;
    webhookTested = false;
    webhookTestResult = null;
  }

  function editWebhook(webhook: Webhook, index: number) {
    editingWebhook = JSON.parse(JSON.stringify(webhook));
    editingWebhookIndex = index;
    webhookTested = true; // Existing webhooks are assumed tested
    webhookTestResult = null;
  }

  function saveWebhook() {
    if (!editingAccount || !editingWebhook) return;

    editingAccount.webhooks = editingAccount.webhooks ?? [];
    if (editingWebhookIndex !== null) {
      editingAccount.webhooks[editingWebhookIndex] = editingWebhook;
    } else {
      editingAccount.webhooks.push(editingWebhook);
    }
    editingWebhook = null;
    editingWebhookIndex = null;
    webhookTested = false;
    webhookTestResult = null;
  }

  function removeWebhook(index: number) {
    if (!editingAccount?.webhooks) return;
    editingAccount.webhooks.splice(index, 1);
    editingAccount = { ...editingAccount };
  }

  async function testWebhookConnection() {
    if (!editingWebhook?.url) return;

    testingWebhook = true;
    webhookTestResult = null;

    try {
      const result = await api.testWebhook({
        url: editingWebhook.url,
        headers: editingWebhook.headers,
      });

      webhookTestResult = result;
      webhookTested = result.success;
    } catch (err) {
      webhookTestResult = {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
      webhookTested = false;
    } finally {
      testingWebhook = false;
    }
  }

  function toggleWebhookEvent(event: string) {
    if (!editingWebhook) return;
    const idx = editingWebhook.events.indexOf(event);
    if (idx >= 0) {
      editingWebhook.events = editingWebhook.events.filter(e => e !== event);
    } else {
      editingWebhook.events = [...editingWebhook.events, event];
    }
    webhookTested = false;
    webhookTestResult = null;
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
    editingProviderIndex = null;
    editingProvider = {
      name: "",
      api_url: "https://api.openai.com/v1/chat/completions",
      api_key: "",
      default_model: "gpt-4o",
    };
    llmConnectionTested = false;
    llmTestResult = null;
    showLlmPresetDropdown = false;
  }

  async function editProvider(provider: LlmProvider) {
    if (!config) return;
    const index = config.llm_providers.findIndex(p => p.name === provider.name);
    editingProviderIndex = index >= 0 ? index : null;
    editingProvider = JSON.parse(JSON.stringify(provider));
    llmTestResult = null;
    showLlmPresetDropdown = false;
    // Auto-test connection for existing providers
    await testLlmProviderConnection();
  }

  function closeProviderModal() {
    editingProvider = null;
    editingProviderIndex = null;
    llmConnectionTested = false;
    llmTestResult = null;
  }

  function saveProvider() {
    // With real-time syncing, changes are already in config
    // This function now just closes the modal
    closeProviderModal();
  }

  function selectLlmPreset(preset: api.LlmPreset) {
    if (!editingProvider) return;
    editingProvider.name = preset.name.toLowerCase().replace(/\s+/g, "-");
    editingProvider.api_url = preset.api_url;
    editingProvider.default_model = preset.default_model;
    editingProvider = { ...editingProvider };
    showLlmPresetDropdown = false;
    llmConnectionTested = false;
    llmTestResult = null;
  }

  async function testLlmProviderConnection() {
    if (!editingProvider) return;

    testingLlmConnection = true;
    llmTestResult = null;

    try {
      const result = await api.testLlmConnection({
        api_url: editingProvider.api_url,
        api_key: editingProvider.api_key,
        default_model: editingProvider.default_model || "gpt-4o",
        name: editingProvider.name || undefined, // Pass name for masked API key lookup
      });

      llmTestResult = result;
      llmConnectionTested = result.success;
    } catch (err) {
      llmTestResult = {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
      llmConnectionTested = false;
    } finally {
      testingLlmConnection = false;
    }
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
    editingApiKeyIndex = null;
    editingApiKey = {
      name: "",
      key: generateApiKey(),
      permissions: ["read:stats"],
    };
  }

  function editApiKey(apiKey: ApiKey, index: number) {
    editingApiKeyIndex = index;
    editingApiKey = JSON.parse(JSON.stringify(apiKey));
  }

  function closeApiKeyModal() {
    editingApiKey = null;
    editingApiKeyIndex = null;
  }

  function saveApiKey() {
    // With real-time syncing, changes are already in config
    // This function now just closes the modal
    closeApiKeyModal();
  }

  function removeApiKey(index: number) {
    if (!config?.dashboard?.api_keys) return;
    const apiKey = config.dashboard.api_keys[index];
    if (confirm($t("settings.apiKeys.removeConfirm", { name: apiKey.name }))) {
      config.dashboard.api_keys.splice(index, 1);
      config = { ...config };
    }
  }

  const permissionNodes = ["stats", "activity", "logs", "export", "accounts"] as const;
  type PermissionNode = typeof permissionNodes[number];
  type PermissionLevel = "none" | "read" | "write";

  function getPermissionLevel(node: PermissionNode): PermissionLevel {
    if (!editingApiKey) return "none";
    if (editingApiKey.permissions.includes("*")) return "write";
    if (editingApiKey.permissions.includes(`write:${node}`)) return "write";
    if (editingApiKey.permissions.includes("write:*")) return "write";
    if (editingApiKey.permissions.includes(`read:${node}`)) return "read";
    if (editingApiKey.permissions.includes("read:*")) return "read";
    return "none";
  }

  function setPermissionLevel(node: PermissionNode, level: PermissionLevel) {
    if (!editingApiKey) return;

    // Remove existing permissions for this node
    editingApiKey.permissions = editingApiKey.permissions.filter(
      p => p !== `read:${node}` && p !== `write:${node}`
    );

    // Add the new permission level
    if (level === "read") {
      editingApiKey.permissions.push(`read:${node}`);
    } else if (level === "write") {
      editingApiKey.permissions.push(`write:${node}`);
    }

    editingApiKey = { ...editingApiKey };
  }

  function toggleFullAccess() {
    if (!editingApiKey) return;
    if (editingApiKey.permissions.includes("*")) {
      editingApiKey.permissions = ["read:stats"];
    } else {
      editingApiKey.permissions = ["*"];
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
        name: editingAccount.name || undefined, // Pass name for masked credential lookup
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

<Modal
  open={showPortWarning}
  title={$t("settings.portWarning.title")}
  onclose={cancelPortChange}
  variant="warning"
  maxWidth="400px"
  showCloseButton={false}
>
  {#snippet children()}
    <p class="modal-message">{$t("settings.portWarning.message")}</p>
    <code class="new-url">{`${window.location.protocol}//${window.location.hostname}:${pendingPortChange}`}</code>
  {/snippet}
  {#snippet actions()}
    <button class="btn btn-secondary" onclick={cancelPortChange}>{$t("common.cancel")}</button>
    <button class="btn btn-warning" onclick={confirmPortChange}>{$t("settings.portWarning.confirm")}</button>
  {/snippet}
</Modal>

<div class="settings">
  <div class="settings-header">
    <h2>{$t("settings.title")}</h2>
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
              <div
                class="modal-overlay"
                onclick={closeAccountModal}
                onkeydown={(e) => e.key === "Escape" && closeAccountModal()}
                role="presentation"
              >
                <div class="modal-with-side" onclick={(e) => e.stopPropagation()}>
                  <div
                    class="modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="account-modal-title"
                  >
                    <div class="modal-header-row">
                      <h3 id="account-modal-title">{editingAccount.name ? $t("settings.accounts.editAccountTitle", { name: editingAccount.name }) : $t("settings.accounts.newAccount")}</h3>
                      <div class="modal-header-actions">
                        <!-- Allowed Actions Dropdown -->
                        <div class="header-dropdown-wrapper">
                          <button
                            type="button"
                            class="btn btn-icon header-action-btn"
                            class:has-items={(editingAccount.allowed_actions ?? defaultAllowedActions).length > 0}
                            disabled={!connectionTested}
                            title={connectionTested ? ($t("settings.accounts.allowedActions") ?? "Allowed Actions") : $t("settings.accounts.testToUnlock")}
                            onclick={() => showAllowedActionsDropdown = !showAllowedActionsDropdown}
                          >
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                              <polyline points="9 12 11 14 15 10"/>
                            </svg>
                            {#if (editingAccount.allowed_actions ?? defaultAllowedActions).length > 0}
                              <span class="header-badge">{(editingAccount.allowed_actions ?? defaultAllowedActions).length}</span>
                            {/if}
                          </button>
                          {#if showAllowedActionsDropdown && connectionTested}
                            <Backdrop onclose={() => showAllowedActionsDropdown = false} zIndex={150} />
                            <div class="header-dropdown-menu">
                              <div class="dropdown-actions">
                                <button type="button" class="dropdown-action-btn" onclick={() => {
                                  editingAccount!.allowed_actions = [...availableActionTypes];
                                }}>All</button>
                                <button type="button" class="dropdown-action-btn" onclick={() => {
                                  editingAccount!.allowed_actions = [...defaultAllowedActions];
                                }}>Default</button>
                                <button type="button" class="dropdown-action-btn" onclick={() => {
                                  editingAccount!.allowed_actions = [];
                                }}>None</button>
                              </div>
                              {#each availableActionTypes as actionType}
                                <label class="dropdown-item" class:action-delete={actionType === "delete"}>
                                  <input
                                    type="checkbox"
                                    checked={(editingAccount.allowed_actions ?? defaultAllowedActions).includes(actionType)}
                                    onchange={() => {
                                      const current = editingAccount!.allowed_actions ?? [...defaultAllowedActions];
                                      if (current.includes(actionType)) {
                                        editingAccount!.allowed_actions = current.filter(a => a !== actionType);
                                      } else {
                                        editingAccount!.allowed_actions = [...current, actionType];
                                      }
                                    }}
                                  />
                                  <span class="action-type-label">{actionType}</span>
                                  {#if actionType === "delete"}
                                    <span class="action-warning">⚠️</span>
                                  {/if}
                                </label>
                              {/each}
                            </div>
                          {/if}
                        </div>

                        <!-- Folders Button -->
                        <button
                          type="button"
                          class="btn btn-icon header-action-btn"
                          class:has-items={(editingAccount.folders?.watch?.length ?? 1) > 1 || (editingAccount.folders?.allowed?.length ?? 0) > 0}
                          disabled={!connectionTested}
                          title={connectionTested ? ($t("settings.accounts.foldersSection") ?? "Folders") : $t("settings.accounts.testToUnlock")}
                          onclick={() => showFoldersModal = !showFoldersModal}
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                          </svg>
                        </button>

                        <!-- Webhooks Button -->
                        <button
                          type="button"
                          class="btn btn-icon header-action-btn"
                          class:has-items={(editingAccount.webhooks?.length ?? 0) > 0}
                          disabled={!connectionTested}
                          title={connectionTested ? $t("settings.accounts.webhooksSection") : $t("settings.accounts.testToUnlock")}
                          onclick={() => showWebhooksModal = !showWebhooksModal}
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                          </svg>
                          {#if (editingAccount.webhooks?.length ?? 0) > 0}
                            <span class="header-badge">{editingAccount.webhooks?.length}</span>
                          {/if}
                        </button>
                      </div>
                    </div>

                  <div class="form-group" class:field-required={!editingAccount.name}>
                    <label>
                      <span class="label-text">{$t("settings.accounts.name")} <span class="required-asterisk">*</span></span>
                      <input type="text" bind:value={editingAccount.name} placeholder="personal-gmail" required />
                      {#if !editingAccount.name}
                        <span class="required-hint">{$t("settings.requiredField")}</span>
                      {/if}
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
                            <Backdrop onclose={() => { showPresetDropdown = false; handleHostBlur(); }} zIndex={50} />
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

                  {#if editingAccount.imap.auth === "basic"}
                    <div class="form-row">
                      <div class="form-group">
                        <label>
                          <span class="label-text">{$t("settings.accounts.user")} <span class="help-icon" title={helpTexts["imap.username"]}>?</span></span>
                          <input type="text" bind:value={editingAccount.imap.username} placeholder="user@gmail.com" />
                        </label>
                      </div>
                      <div class="form-group">
                        <label>
                          <span class="label-text">{$t("settings.accounts.password")} <span class="help-icon" title={helpTexts["imap.password"]}>?</span></span>
                          <input type="password" bind:value={editingAccount.imap.password} placeholder={$t("settings.accounts.passwordHelp")} />
                        </label>
                      </div>
                    </div>
                  {:else}
                    <div class="form-group">
                      <label>
                        <span class="label-text">{$t("settings.accounts.user")} <span class="help-icon" title={helpTexts["imap.username"]}>?</span></span>
                        <input type="text" bind:value={editingAccount.imap.username} placeholder="user@gmail.com" />
                      </label>
                    </div>
                    <div class="form-row">
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

                  <div class="collapsible-section" class:section-locked={!connectionTested}>
                    <button
                      type="button"
                      class="collapsible-header"
                      disabled={!connectionTested}
                      onclick={() => connectionTested && (showAdvancedSection = !showAdvancedSection)}
                    >
                      <span class="collapsible-title">
                        {#if !connectionTested}
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0110 0v4"/>
                          </svg>
                        {:else}
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" class:rotated={showAdvancedSection}>
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        {/if}
                        {$t("settings.accounts.advancedSection")}
                      </span>
                      {#if !connectionTested}
                        <span class="locked-hint">{$t("settings.accounts.testToUnlock")}</span>
                      {/if}
                    </button>

                    {#if showAdvancedSection && connectionTested}
                      <div class="collapsible-content">
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
                        </div>
                        {#if config.confidence?.enabled}
                          <div class="form-group">
                            <label>
                              <span class="label-text">
                                {$t("settings.accounts.minimumConfidence")}
                                <span class="help-icon" title={helpTexts["account.minimum_confidence"]}>?</span>
                              </span>
                              <div class="slider-input">
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  step="5"
                                  value={(editingAccount.minimum_confidence ?? 0.7) * 100}
                                  oninput={(e) => {
                                    editingAccount!.minimum_confidence = Number((e.target as HTMLInputElement).value) / 100;
                                  }}
                                />
                                <span class="slider-value">{Math.round((editingAccount.minimum_confidence ?? 0.7) * 100)}%</span>
                              </div>
                              <span class="field-hint">{$t("settings.accounts.minimumConfidenceHint")}</span>
                            </label>
                          </div>
                        {/if}
                      </div><!-- end collapsible-content -->
                    {/if}
                  </div><!-- end collapsible-section -->

                    <div class="modal-actions">
                      <button class="btn btn-secondary" onclick={closeAccountModal}>{$t("common.close")}</button>
                    </div>
                  </div>

                  <!-- Webhooks Side Modal -->
                  {#if showWebhooksModal}
                  <div
                    class="side-modal"
                    onclick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="webhooks-modal-title"
                  >
                    <div class="side-modal-header">
                      <h4 id="webhooks-modal-title">{$t("settings.accounts.webhooksSection")}</h4>
                      <button type="button" class="btn btn-icon btn-sm" onclick={() => showWebhooksModal = false}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>

                    <div class="side-modal-content">
                      <button type="button" class="btn btn-secondary btn-sm" onclick={addWebhook}>
                        + {$t("settings.accounts.addWebhook")}
                      </button>

                      {#if editingWebhook}
                        <div class="webhook-editor">
                          <div class="form-group">
                            <label>
                              <span class="label-text">{$t("settings.accounts.webhookUrl")}</span>
                              <input
                                type="url"
                                bind:value={editingWebhook.url}
                                placeholder="https://example.com/webhook"
                                oninput={() => { webhookTested = false; webhookTestResult = null; }}
                              />
                            </label>
                          </div>

                          <div class="form-group">
                            <span class="label-text">{$t("settings.accounts.webhookEvents")}</span>
                            <div class="checkbox-group vertical">
                              {#each webhookEventOptions as event}
                                <label class="checkbox-inline">
                                  <input
                                    type="checkbox"
                                    checked={editingWebhook.events.includes(event)}
                                    onchange={() => toggleWebhookEvent(event)}
                                  />
                                  <span>{$t(`settings.accounts.webhookEvent.${event}`)}</span>
                                </label>
                              {/each}
                            </div>
                          </div>

                          <div class="connection-test-section">
                            <button
                              type="button"
                              class="btn btn-secondary btn-sm"
                              onclick={testWebhookConnection}
                              disabled={testingWebhook || !editingWebhook.url || editingWebhook.events.length === 0}
                            >
                              {#if testingWebhook}
                                <span class="spinner-inline"></span>
                                {$t("settings.accounts.testingWebhook")}
                              {:else}
                                {$t("settings.accounts.testWebhook")}
                              {/if}
                            </button>
                            {#if webhookTestResult}
                              <span class="test-result" class:success={webhookTestResult.success} class:error={!webhookTestResult.success}>
                                {#if webhookTestResult.success}
                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="20 6 9 17 4 12"/>
                                  </svg>
                                  {$t("settings.accounts.webhookTestSuccess")}
                                {:else}
                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="15" y1="9" x2="9" y2="15"/>
                                    <line x1="9" y1="9" x2="15" y2="15"/>
                                  </svg>
                                  {webhookTestResult.error ?? $t("settings.accounts.webhookTestFailed")}
                                {/if}
                              </span>
                            {/if}
                          </div>

                          <div class="webhook-actions">
                            <button type="button" class="btn btn-secondary btn-sm" onclick={() => { editingWebhook = null; editingWebhookIndex = null; }}>
                              {$t("common.cancel")}
                            </button>
                            <button
                              type="button"
                              class="btn btn-primary btn-sm"
                              onclick={saveWebhook}
                              disabled={!webhookTested || !editingWebhook.url || editingWebhook.events.length === 0}
                              title={!webhookTested ? $t("settings.accounts.testWebhookFirst") : ""}
                            >
                              {$t("settings.accounts.saveWebhook")}
                            </button>
                          </div>
                        </div>
                      {/if}

                      {#if (editingAccount.webhooks?.length ?? 0) > 0}
                        <div class="webhooks-list">
                          {#each editingAccount.webhooks ?? [] as webhook, idx}
                            <div class="webhook-item">
                              <div class="webhook-info">
                                <span class="webhook-url">{webhook.url}</span>
                                <span class="webhook-events">{webhook.events.join(", ")}</span>
                              </div>
                              <div class="webhook-item-actions">
                                <button type="button" class="btn btn-sm" onclick={() => editWebhook(webhook, idx)}>
                                  {$t("common.edit")}
                                </button>
                                <button type="button" class="btn btn-sm btn-danger" onclick={() => removeWebhook(idx)}>
                                  {$t("common.remove")}
                                </button>
                              </div>
                            </div>
                          {/each}
                        </div>
                      {:else if !editingWebhook}
                        <p class="empty-note">{$t("settings.accounts.noWebhooks")}</p>
                      {/if}
                    </div>
                  </div>
                  {/if}

                  <!-- Folders Side Modal -->
                  {#if showFoldersModal}
                  <div
                    class="side-modal"
                    onclick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="folders-modal-title"
                  >
                    <div class="side-modal-header">
                      <h4 id="folders-modal-title">{$t("settings.accounts.foldersSection")}</h4>
                      <button type="button" class="btn btn-icon btn-sm" onclick={() => showFoldersModal = false}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>

                    <div class="side-modal-content">
                      <div class="form-group">
                        <label>
                          <span class="label-text">{$t("settings.accounts.watchFolders")} <span class="help-icon" title={helpTexts["folders.watch"]}>?</span></span>
                          {#if availableFolders.length > 0}
                            <div class="multi-select-dropdown">
                              <button type="button" class="dropdown-trigger" onclick={() => showWatchFolderDropdown = !showWatchFolderDropdown}>
                                {(editingAccount.folders?.watch ?? ["INBOX"]).join(", ") || "Select folders"}
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                  <polyline points="6 9 12 15 18 9"/>
                                </svg>
                              </button>
                              {#if showWatchFolderDropdown}
                                <Backdrop onclose={() => showWatchFolderDropdown = false} zIndex={150} />
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
                                  <Backdrop onclose={() => showAllowedFolderDropdown = false} zIndex={150} />
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
                  </div>
                  {/if}
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
              <div
                class="modal-overlay"
                onclick={closeProviderModal}
                onkeydown={(e) => e.key === "Escape" && closeProviderModal()}
                role="presentation"
              >
                <div
                  class="modal"
                  onclick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="provider-modal-title"
                >
                  <h3 id="provider-modal-title">{editingProvider.name ? $t("settings.providers.editProviderTitle", { name: editingProvider.name }) : $t("settings.providers.newProvider")}</h3>

                  {#if llmPresets.length > 0}
                    <div class="form-group">
                      <span class="label-text">{$t("settings.providers.quickSetup")}</span>
                      <div class="preset-selector">
                        <button
                          type="button"
                          class="preset-trigger"
                          onclick={() => showLlmPresetDropdown = !showLlmPresetDropdown}
                        >
                          Select a provider preset...
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </button>
                        {#if showLlmPresetDropdown}
                          <Backdrop onclose={() => showLlmPresetDropdown = false} zIndex={50} />
                          <div class="preset-dropdown">
                            {#each llmPresets as preset}
                              <button
                                type="button"
                                class="preset-option"
                                onclick={() => selectLlmPreset(preset)}
                              >
                                <strong>{preset.name}</strong>
                                <span class="preset-meta">{preset.default_model}</span>
                              </button>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/if}

                  <div class="form-group" class:field-required={!editingProvider.name}>
                    <label>
                      <span class="label-text">{$t("settings.providers.name")} <span class="required-asterisk">*</span></span>
                      <input
                        type="text"
                        bind:value={editingProvider.name}
                        placeholder="openai"
                        required
                        oninput={() => { llmConnectionTested = false; llmTestResult = null; }}
                      />
                      {#if !editingProvider.name}
                        <span class="required-hint">{$t("settings.requiredField")}</span>
                      {/if}
                    </label>
                  </div>

                  <div class="form-group">
                    <label>
                      <span class="label-text">{$t("settings.providers.apiUrl")} <span class="help-icon" title={helpTexts["provider.api_url"]}>?</span></span>
                      <input
                        type="text"
                        bind:value={editingProvider.api_url}
                        placeholder="https://api.openai.com/v1/chat/completions"
                        oninput={() => { llmConnectionTested = false; llmTestResult = null; }}
                      />
                    </label>
                  </div>

                  <div class="form-group">
                    <label>
                      <span class="label-text">{$t("settings.providers.apiKey")} <span class="help-icon" title={helpTexts["provider.api_key"]}>?</span></span>
                      <input
                        type="password"
                        bind:value={editingProvider.api_key}
                        placeholder="sk-..."
                        oninput={() => { llmConnectionTested = false; llmTestResult = null; }}
                      />
                    </label>
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label>
                        <span class="label-text">{$t("settings.providers.defaultModel")} <span class="help-icon" title={helpTexts["provider.default_model"]}>?</span></span>
                        <input
                          type="text"
                          bind:value={editingProvider.default_model}
                          placeholder="gpt-4o"
                          oninput={() => { llmConnectionTested = false; llmTestResult = null; }}
                        />
                      </label>
                    </div>
                    <div class="form-group">
                      <label>
                        <span class="label-text">{$t("settings.providers.rateLimit")} <span class="help-icon" title={helpTexts["provider.rate_limit"]}>?</span></span>
                        <input type="number" bind:value={editingProvider.rate_limit} placeholder="60" />
                      </label>
                    </div>
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label>
                        <span class="label-text">{$t("settings.providers.maxBodyTokens")} <span class="help-icon" title={helpTexts["provider.max_body_tokens"]}>?</span></span>
                        <input type="number" bind:value={editingProvider.max_body_tokens} placeholder="4000" />
                      </label>
                    </div>
                    <div class="form-group">
                      <label>
                        <span class="label-text">{$t("settings.providers.maxThreadTokens")} <span class="help-icon" title={helpTexts["provider.max_thread_tokens"]}>?</span></span>
                        <input type="number" bind:value={editingProvider.max_thread_tokens} placeholder="2000" />
                      </label>
                    </div>
                  </div>

                  <div class="form-group checkbox">
                    <label>
                      <input type="checkbox" bind:checked={editingProvider.supports_vision} />
                      <span class="label-text">
                        {$t("settings.providers.supportsVision")}
                        <span class="help-icon" title={helpTexts["provider.supports_vision"]}>?</span>
                      </span>
                    </label>
                  </div>

                  <div class="connection-test-section">
                    <button
                      class="btn btn-secondary"
                      onclick={testLlmProviderConnection}
                      disabled={testingLlmConnection || !editingProvider.api_url || !editingProvider.default_model}
                    >
                      {#if testingLlmConnection}
                        <span class="spinner-inline"></span>
                        Testing...
                      {:else}
                        Test Connection
                      {/if}
                    </button>
                    {#if llmTestResult}
                      <div class="test-result" class:success={llmTestResult.success} class:error={!llmTestResult.success}>
                        {#if llmTestResult.success}
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                          Connection successful
                        {:else}
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                          </svg>
                          {llmTestResult.error || "Connection failed"}
                        {/if}
                      </div>
                    {/if}
                  </div>

                  <div class="modal-actions">
                    <button class="btn btn-secondary" onclick={closeProviderModal}>{$t("common.close")}</button>
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

            <h4>{$t("settings.confidence.sectionTitle")}</h4>
            <p class="section-note">{$t("settings.confidence.description")}</p>

            <div class="form-group checkbox">
              <label>
                <input type="checkbox" bind:checked={config.confidence.enabled} />
                <span class="label-text">
                  {$t("settings.confidence.enableLabel")}
                  <span class="help-icon" title={helpTexts["confidence.enabled"]}>?</span>
                </span>
              </label>
            </div>

            {#if config.confidence?.enabled}
              <div class="form-group checkbox">
                <label>
                  <input type="checkbox" bind:checked={config.confidence.request_reasoning} />
                  <span class="label-text">
                    {$t("settings.confidence.requestReasoning")}
                    <span class="help-icon" title={helpTexts["confidence.request_reasoning"]}>?</span>
                  </span>
                </label>
              </div>
              <p class="section-note">{$t("settings.confidence.thresholdNote")}</p>
            {/if}
          </section>

        {:else if activeSection === "apikeys"}
          <section class="config-section">
            <h3>{$t("settings.apiKeys.sectionTitle")}</h3>
            <p class="section-note">{$t("settings.apiKeys.description")}</p>

            {#if editingApiKey}
              <div
                class="modal-overlay"
                onclick={closeApiKeyModal}
                onkeydown={(e) => e.key === "Escape" && closeApiKeyModal()}
                role="presentation"
              >
                <div
                  class="modal"
                  onclick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="apikey-modal-title"
                >
                  <h3 id="apikey-modal-title">{editingApiKeyIndex !== null ? $t("settings.apiKeys.editApiKey") : $t("settings.apiKeys.newApiKey")}</h3>

                  <div class="form-group" class:field-required={!editingApiKey.name}>
                    <label>
                      <span class="label-text">{$t("settings.apiKeys.name")} <span class="required-asterisk">*</span></span>
                      <input type="text" bind:value={editingApiKey.name} placeholder="My Integration" required />
                      {#if !editingApiKey.name}
                        <span class="required-hint">{$t("settings.requiredField")}</span>
                      {/if}
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
                    <table class="permissions-table">
                      <thead>
                        <tr>
                          <th>Resource</th>
                          <th>None</th>
                          <th>Read</th>
                          <th>Write</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each permissionNodes as node}
                          <tr class:disabled={editingApiKey.permissions.includes("*")}>
                            <td class="resource-name">{node.charAt(0).toUpperCase() + node.slice(1)}</td>
                            <td>
                              <input
                                type="radio"
                                name={`perm-${node}`}
                                checked={getPermissionLevel(node) === "none"}
                                disabled={editingApiKey.permissions.includes("*")}
                                onchange={() => setPermissionLevel(node, "none")}
                              />
                            </td>
                            <td>
                              <input
                                type="radio"
                                name={`perm-${node}`}
                                checked={getPermissionLevel(node) === "read"}
                                disabled={editingApiKey.permissions.includes("*")}
                                onchange={() => setPermissionLevel(node, "read")}
                              />
                            </td>
                            <td>
                              <input
                                type="radio"
                                name={`perm-${node}`}
                                checked={getPermissionLevel(node) === "write"}
                                disabled={editingApiKey.permissions.includes("*")}
                                onchange={() => setPermissionLevel(node, "write")}
                              />
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                    <label class="permission-toggle permission-admin">
                      <input
                        type="checkbox"
                        checked={editingApiKey.permissions.includes("*")}
                        onchange={toggleFullAccess}
                      />
                      <span>Full Access</span>
                      <small>(grants all permissions)</small>
                    </label>
                  </div>

                  <div class="modal-actions">
                    <button class="btn btn-secondary" onclick={closeApiKeyModal}>{$t("common.close")}</button>
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

        {:else if activeSection === "modules"}
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

          <section class="config-section">
            <div class="section-header">
              <h3>{$t("settings.notifications.sectionTitle")}</h3>
            </div>

            <div class="form-group checkbox">
              <label>
                <input type="checkbox" bind:checked={config.notifications.enabled} />
                <span class="label-text">
                  {$t("settings.notifications.enableLabel")}
                  <span class="help-icon" title={helpTexts["notifications.enabled"]}>?</span>
                </span>
              </label>
            </div>

            {#if config.notifications?.enabled}
              <div class="form-group">
                <label>
                  <span class="label-text">
                    {$t("settings.notifications.events")}
                    <span class="help-icon" title={helpTexts["notifications.events"]}>?</span>
                  </span>
                  <div class="checkbox-group vertical">
                    {#each [
                      { value: "error", label: $t("settings.notifications.eventError") },
                      { value: "connection_lost", label: $t("settings.notifications.eventConnectionLost") },
                      { value: "dead_letter", label: $t("settings.notifications.eventDeadLetter") },
                      { value: "retry_exhausted", label: $t("settings.notifications.eventRetryExhausted") },
                      { value: "daily_summary", label: $t("settings.notifications.eventDailySummary") },
                    ] as event}
                      <label class="checkbox-inline">
                        <input
                          type="checkbox"
                          checked={config.notifications.events?.includes(event.value as "error" | "connection_lost" | "dead_letter" | "retry_exhausted" | "daily_summary")}
                          onchange={(e) => {
                            const checked = (e.target as HTMLInputElement).checked;
                            if (checked) {
                              config.notifications.events = [...(config.notifications.events ?? []), event.value as "error" | "connection_lost" | "dead_letter" | "retry_exhausted" | "daily_summary"];
                            } else {
                              config.notifications.events = (config.notifications.events ?? []).filter(ev => ev !== event.value);
                            }
                          }}
                        />
                        <span>{event.label}</span>
                      </label>
                    {/each}
                  </div>
                </label>
              </div>

              {#if config.notifications.events?.includes("daily_summary")}
                <div class="form-group">
                  <label>
                    <span class="label-text">
                      {$t("settings.notifications.dailySummaryTime")}
                      <span class="help-icon" title={helpTexts["notifications.daily_summary_time"]}>?</span>
                    </span>
                    <input type="time" bind:value={config.notifications.daily_summary_time} />
                  </label>
                </div>
              {/if}

              <div class="form-group">
                <label>
                  <span class="label-text">
                    {$t("settings.notifications.quietHours")}
                    <span class="help-icon" title={helpTexts["notifications.quiet_hours"]}>?</span>
                  </span>
                </label>
                <div class="form-group checkbox">
                  <label>
                    <input type="checkbox" bind:checked={config.notifications.quiet_hours.enabled} />
                    <span class="label-text">{$t("settings.notifications.enableQuietHours")}</span>
                  </label>
                </div>
                {#if config.notifications.quiet_hours?.enabled}
                  <div class="form-row">
                    <div class="form-group">
                      <label>
                        <span class="label-text">{$t("settings.notifications.quietStart")}</span>
                        <input type="time" bind:value={config.notifications.quiet_hours.start} />
                      </label>
                    </div>
                    <div class="form-group">
                      <label>
                        <span class="label-text">{$t("settings.notifications.quietEnd")}</span>
                        <input type="time" bind:value={config.notifications.quiet_hours.end} />
                      </label>
                    </div>
                  </div>
                {/if}
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

  .spinner-inline {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid var(--border-color);
    border-top-color: currentColor;
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

  .connection-test-section {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    margin-bottom: 1rem;
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

  .warning-note {
    margin-top: 0.375rem;
    padding: 0.375rem 0.625rem;
    font-size: 0.6875rem;
    color: var(--warning);
    background: color-mix(in srgb, var(--warning) 10%, transparent);
    border-left: 2px solid var(--warning);
    border-radius: 0.25rem;
  }

  .dropdown-item.action-delete {
    color: var(--error);
  }

  .action-warning {
    margin-left: auto;
    font-size: 0.75rem;
  }

  .action-type-label {
    text-transform: capitalize;
  }

  .dropdown-actions {
    display: flex;
    gap: 0.25rem;
    padding: 0.375rem;
    border-bottom: 1px solid var(--border-color);
  }

  .dropdown-action-btn {
    flex: 1;
    padding: 0.25rem 0.5rem;
    font-size: 0.6875rem;
    background: var(--bg-tertiary);
    border: none;
    border-radius: 0.25rem;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .dropdown-action-btn:hover {
    background: var(--border-color);
    color: var(--text-primary);
  }

  .form-group-full {
    grid-column: 1 / -1;
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

  .slider-input {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .slider-input input[type="range"] {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: var(--bg-tertiary);
    cursor: pointer;
    accent-color: var(--accent);
  }

  .slider-value {
    min-width: 3rem;
    text-align: right;
    font-weight: 500;
    color: var(--text-primary);
  }

  .field-hint {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
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

  .modal-with-side {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
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

  .permissions-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 0.5rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    overflow: hidden;
  }

  .permissions-table th,
  .permissions-table td {
    padding: 0.625rem 0.75rem;
    text-align: center;
    border-bottom: 1px solid var(--border-color);
  }

  .permissions-table th {
    background: var(--bg-tertiary);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    color: var(--text-secondary);
  }

  .permissions-table th:first-child,
  .permissions-table td.resource-name {
    text-align: left;
  }

  .permissions-table td.resource-name {
    font-weight: 500;
    font-size: 0.875rem;
  }

  .permissions-table tbody tr:last-child td {
    border-bottom: none;
  }

  .permissions-table tbody tr:hover:not(.disabled) {
    background: var(--bg-secondary);
  }

  .permissions-table tbody tr.disabled {
    opacity: 0.5;
  }

  .permissions-table input[type="radio"] {
    width: 1rem;
    height: 1rem;
    accent-color: var(--accent);
    cursor: pointer;
  }

  .permissions-table input[type="radio"]:disabled {
    cursor: default;
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

  /* Collapsible Advanced Section */
  .collapsible-section {
    margin-top: 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .collapsible-section.section-locked {
    opacity: 0.7;
  }

  .collapsible-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.75rem 1rem;
    background: var(--bg-tertiary);
    border: none;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
    cursor: pointer;
    transition: background 0.15s;
  }

  .collapsible-header:hover:not(:disabled) {
    background: color-mix(in srgb, var(--bg-tertiary) 80%, var(--accent) 20%);
  }

  .collapsible-header:disabled {
    cursor: not-allowed;
    color: var(--text-secondary);
  }

  .collapsible-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .collapsible-title svg {
    transition: transform 0.2s;
  }

  .collapsible-title svg.rotated {
    transform: rotate(90deg);
  }

  .locked-hint {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-weight: 400;
  }

  .collapsible-content {
    padding: 1rem;
    background: var(--bg-secondary);
  }

  /* Webhook styles */
  .webhooks-header {
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .webhooks-header h4 {
    margin: 0;
  }

  .webhook-editor {
    padding: 1rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    margin-bottom: 1rem;
  }

  .webhook-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-color);
  }

  .webhooks-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .webhook-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
  }

  .webhook-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    flex: 1;
  }

  .webhook-url {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .webhook-events {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .webhook-item-actions {
    display: flex;
    gap: 0.5rem;
    margin-left: 1rem;
  }

  .empty-note {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    text-align: center;
    padding: 1rem;
    margin: 0;
  }

  /* Legacy wizard section locking - keep for backwards compat */
  .wizard-section {
    position: relative;
    padding: 0.75rem;
    margin: 0 -0.75rem;
    border-radius: 0.375rem;
    transition: opacity 0.2s;
  }

  .wizard-section.section-locked {
    pointer-events: none;
    background: var(--bg-tertiary);
  }

  .wizard-section.section-locked > *:not(.section-lock-overlay) {
    filter: blur(4px);
    opacity: 0.6;
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

  .preset-selector {
    position: relative;
  }

  .preset-trigger {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    color: var(--text-secondary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .preset-trigger:hover {
    border-color: var(--accent);
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
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 100;
    max-height: 250px;
    overflow-y: auto;
    margin-top: 0.25rem;
  }

  .preset-option {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 0.625rem 0.75rem;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 0.875rem;
    cursor: pointer;
    text-align: left;
    border-bottom: 1px solid var(--border-subtle);
  }

  .preset-option:last-child {
    border-bottom: none;
  }

  .preset-option:hover {
    background: var(--bg-tertiary);
  }

  .preset-option strong {
    font-weight: 500;
  }

  .preset-meta {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-top: 0.125rem;
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

  .checkbox-group {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 0.5rem;
  }

  .checkbox-group.vertical {
    flex-direction: column;
    gap: 0.5rem;
  }

  .checkbox-inline {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .checkbox-inline input[type="checkbox"] {
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

  .required-asterisk {
    color: var(--error, #ef4444);
    font-weight: bold;
  }

  .field-required input {
    border-color: var(--error, #ef4444);
    background-color: rgba(239, 68, 68, 0.05);
  }

  .required-hint {
    display: block;
    font-size: 0.75rem;
    color: var(--error, #ef4444);
    margin-top: 0.25rem;
  }

  .modal-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .modal-header-row h3 {
    margin: 0;
    flex: 1;
  }

  .modal-header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .header-action-btn {
    position: relative;
    padding: 0.5rem;
  }

  .header-action-btn.has-items {
    color: var(--accent);
  }

  .header-action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .header-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: var(--accent);
    color: white;
    font-size: 0.625rem;
    font-weight: bold;
    padding: 0.125rem 0.375rem;
    border-radius: 9999px;
    min-width: 1rem;
    text-align: center;
  }

  .header-dropdown-wrapper {
    position: relative;
  }

  .header-dropdown-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.5rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 200px;
    z-index: 200;
    padding: 0.5rem;
  }

  .header-dropdown-menu .dropdown-actions {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .header-dropdown-menu .dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    cursor: pointer;
    border-radius: 0.25rem;
  }

  .header-dropdown-menu .dropdown-item:hover {
    background: var(--bg-hover);
  }

  .header-dropdown-menu .dropdown-item.action-delete {
    color: var(--error);
  }

  .side-modal {
    width: 320px;
    max-height: 90vh;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }

  .side-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color);
  }

  .side-modal-header h4 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .side-modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
