<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import * as api from "../api";
  import { stats, serviceStatus, type ServicesStatus } from "../stores/data";

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
    api_keys?: { name: string; key: string; permissions: string[] }[];
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
  let configPath = $state<string>("");
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let saveMessage = $state<{ type: "success" | "error"; text: string } | null>(null);
  let activeSection = $state<string>("global");

  // Editing state
  let editingAccount = $state<Account | null>(null);
  let editingProvider = $state<LlmProvider | null>(null);

  // Service status
  let services = $state<ServicesStatus | null>(null);
  let serviceCheckInterval: ReturnType<typeof setInterval> | null = null;

  // Port change tracking
  let originalPort = $state<number>(8080);
  let showPortWarning = $state(false);
  let pendingPortChange = $state<number | null>(null);

  const sections = [
    { id: "global", label: "Global Settings", icon: "cog" },
    { id: "accounts", label: "Email Accounts", icon: "mail" },
    { id: "providers", label: "LLM Providers", icon: "cpu" },
    { id: "attachments", label: "Attachments", icon: "paperclip" },
    { id: "antivirus", label: "Antivirus", icon: "shield" },
    { id: "dashboard", label: "Dashboard", icon: "layout" },
  ];

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
    "folders.allowed": "List of folders that LLM can move emails to (for predefined mode)",
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
        // Handle port change redirect
        if (portChanged) {
          saveMessage = { type: "success", text: `Configuration saved. Redirecting to port ${newPort}...` };
          setTimeout(() => {
            const currentUrl = new URL(window.location.href);
            currentUrl.port = String(newPort);
            window.location.href = currentUrl.toString();
          }, 2000);
        } else {
          saveMessage = { type: "success", text: "Configuration saved and reloaded successfully" };
          // Refresh stats
          const newStats = await api.fetchStats();
          stats.set(newStats);
        }
      } else {
        saveMessage = { type: "error", text: "Failed to save configuration" };
      }
    } catch (e) {
      saveMessage = { type: "error", text: e instanceof Error ? e.message : "Failed to save" };
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

  function addAccount() {
    editingAccount = {
      name: "",
      imap: { host: "", port: 993, tls: "auto", auth: "basic", username: "", password: "" },
      folders: { watch: ["INBOX"] },
    };
  }

  function editAccount(account: Account) {
    editingAccount = JSON.parse(JSON.stringify(account));
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
</script>

{#if showPortWarning}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={cancelPortChange}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal modal-warning" onclick={(e) => e.stopPropagation()}>
      <div class="warning-icon">&#9888;</div>
      <h3>Port Change Warning</h3>
      <p>
        You are changing the server port from <strong>{originalPort}</strong> to <strong>{pendingPortChange}</strong>.
      </p>
      <p class="warning-text">
        After saving, the server will restart on the new port. Your browser will be automatically
        redirected to the new address. If the redirect fails, manually navigate to:
      </p>
      <code class="new-url">{`${window.location.protocol}//${window.location.hostname}:${pendingPortChange}`}</code>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick={cancelPortChange}>Cancel</button>
        <button class="btn btn-warning" onclick={confirmPortChange}>Change Port</button>
      </div>
    </div>
  </div>
{/if}

<div class="settings">
  <div class="settings-header">
    <h2>Configuration</h2>
    {#if configPath}
      <span class="config-path">{configPath}</span>
    {/if}
    <div class="header-actions">
      {#if saveMessage}
        <span class="save-message save-{saveMessage.type}">{saveMessage.text}</span>
      {/if}
      <button class="btn btn-primary" onclick={handleSave} disabled={saving || loading}>
        {saving ? "Saving..." : "Save & Reload"}
      </button>
    </div>
  </div>

  {#if loading}
    <div class="loading">Loading configuration...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if config}
    <div class="settings-layout">
      <nav class="settings-nav">
        {#each sections as section}
          <button
            class="nav-item"
            class:active={activeSection === section.id}
            onclick={() => activeSection = section.id}
          >
            {section.label}
          </button>
        {/each}
      </nav>

      <div class="settings-content">
        {#if activeSection === "global"}
          <section class="config-section">
            <h3>Global Settings</h3>

            <div class="form-group">
              <label>
                <span class="label-text">
                  Polling Interval
                  <span class="help-icon" title={helpTexts.polling_interval}>?</span>
                </span>
                <input type="text" bind:value={config.polling_interval} placeholder="30s" />
              </label>
            </div>

            <div class="form-group">
              <label>
                <span class="label-text">
                  Concurrency Limit
                  <span class="help-icon" title={helpTexts.concurrency_limit}>?</span>
                </span>
                <input type="number" bind:value={config.concurrency_limit} min="1" max="20" />
              </label>
            </div>

            <div class="form-group checkbox">
              <label>
                <input type="checkbox" bind:checked={config.dry_run} />
                <span class="label-text">
                  Dry Run Mode
                  <span class="help-icon" title={helpTexts.dry_run}>?</span>
                </span>
              </label>
            </div>

            <div class="form-group checkbox">
              <label>
                <input type="checkbox" bind:checked={config.add_processing_headers} />
                <span class="label-text">
                  Add Processing Headers
                  <span class="help-icon" title={helpTexts.add_processing_headers}>?</span>
                </span>
              </label>
            </div>

            <div class="form-group">
              <label>
                <span class="label-text">
                  Log Level
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
                  <option value="debug">Debug</option>
                  <option value="info">Info</option>
                  <option value="warn">Warning</option>
                  <option value="error">Error</option>
                </select>
              </label>
            </div>

            <div class="form-group">
              <label>
                <span class="label-text">
                  Server Port
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

            <h4>Default Prompt</h4>
            <div class="form-group">
              <label>
                <span class="label-text">
                  Classification Prompt
                  <span class="help-icon" title={helpTexts.default_prompt}>?</span>
                </span>
                <textarea bind:value={config.default_prompt} rows="8" placeholder="Enter your classification prompt..."></textarea>
              </label>
            </div>
          </section>

        {:else if activeSection === "accounts"}
          <section class="config-section">
            <div class="section-header">
              <h3>Email Accounts</h3>
              <button class="btn btn-secondary btn-sm" onclick={addAccount}>+ Add Account</button>
            </div>

            {#if editingAccount}
              <div class="modal-overlay" onclick={() => editingAccount = null}>
                <div class="modal" onclick={(e) => e.stopPropagation()}>
                  <h3>{editingAccount.name ? `Edit ${editingAccount.name}` : "New Account"}</h3>

                  <div class="form-group">
                    <label>
                      <span class="label-text">Account Name</span>
                      <input type="text" bind:value={editingAccount.name} placeholder="personal-gmail" />
                    </label>
                  </div>

                  <h4>IMAP Settings</h4>
                  <div class="form-row">
                    <div class="form-group">
                      <label>
                        <span class="label-text">Host <span class="help-icon" title={helpTexts["imap.host"]}>?</span></span>
                        <input type="text" bind:value={editingAccount.imap.host} placeholder="imap.gmail.com" />
                      </label>
                    </div>
                    <div class="form-group">
                      <label>
                        <span class="label-text">Port <span class="help-icon" title={helpTexts["imap.port"]}>?</span></span>
                        <input type="number" bind:value={editingAccount.imap.port} placeholder="993" />
                      </label>
                    </div>
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label>
                        <span class="label-text">TLS Mode <span class="help-icon" title={helpTexts["imap.tls"]}>?</span></span>
                        <select bind:value={editingAccount.imap.tls}>
                          <option value="auto">Auto</option>
                          <option value="tls">TLS</option>
                          <option value="starttls">STARTTLS</option>
                          <option value="insecure">Insecure</option>
                        </select>
                      </label>
                    </div>
                    <div class="form-group">
                      <label>
                        <span class="label-text">Auth Type <span class="help-icon" title={helpTexts["imap.auth"]}>?</span></span>
                        <select bind:value={editingAccount.imap.auth}>
                          <option value="basic">Basic (Password)</option>
                          <option value="oauth2">OAuth2</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  <div class="form-group">
                    <label>
                      <span class="label-text">Username <span class="help-icon" title={helpTexts["imap.username"]}>?</span></span>
                      <input type="text" bind:value={editingAccount.imap.username} placeholder="user@gmail.com" />
                    </label>
                  </div>

                  {#if editingAccount.imap.auth === "basic"}
                    <div class="form-group">
                      <label>
                        <span class="label-text">Password <span class="help-icon" title={helpTexts["imap.password"]}>?</span></span>
                        <input type="password" bind:value={editingAccount.imap.password} placeholder="Enter password or app-specific password" />
                      </label>
                    </div>
                  {:else}
                    <div class="form-group">
                      <label>
                        <span class="label-text">OAuth Client ID</span>
                        <input type="text" bind:value={editingAccount.imap.oauth_client_id} />
                      </label>
                    </div>
                    <div class="form-group">
                      <label>
                        <span class="label-text">OAuth Client Secret</span>
                        <input type="password" bind:value={editingAccount.imap.oauth_client_secret} />
                      </label>
                    </div>
                    <div class="form-group">
                      <label>
                        <span class="label-text">OAuth Refresh Token</span>
                        <input type="password" bind:value={editingAccount.imap.oauth_refresh_token} />
                      </label>
                    </div>
                  {/if}

                  <h4>Folders</h4>
                  <div class="form-group">
                    <label>
                      <span class="label-text">Watch Folders <span class="help-icon" title={helpTexts["folders.watch"]}>?</span></span>
                      <input
                        type="text"
                        value={editingAccount.folders?.watch?.join(", ") ?? "INBOX"}
                        oninput={(e) => {
                          editingAccount!.folders ??= {};
                          editingAccount!.folders.watch = (e.target as HTMLInputElement).value.split(",").map(s => s.trim()).filter(Boolean);
                        }}
                        placeholder="INBOX, Work"
                      />
                    </label>
                  </div>
                  <div class="form-row">
                    <div class="form-group">
                      <label>
                        <span class="label-text">Folder Mode <span class="help-icon" title={helpTexts["folders.mode"]}>?</span></span>
                        <select
                          value={editingAccount.folders?.mode ?? "predefined"}
                          onchange={(e) => {
                            editingAccount!.folders = editingAccount!.folders ?? {};
                            editingAccount!.folders.mode = (e.target as HTMLSelectElement).value;
                          }}
                        >
                          <option value="predefined">Predefined only</option>
                          <option value="auto_create">Auto-create folders</option>
                        </select>
                      </label>
                    </div>
                    <div class="form-group">
                      <label>
                        <span class="label-text">Allowed Folders <span class="help-icon" title={helpTexts["folders.allowed"]}>?</span></span>
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
                      </label>
                    </div>
                  </div>

                  <h4>LLM Settings</h4>
                  <div class="form-row">
                    <div class="form-group">
                      <label>
                        <span class="label-text">Provider <span class="help-icon" title={helpTexts["llm.provider"]}>?</span></span>
                        <select
                          value={editingAccount.llm?.provider ?? ""}
                          onchange={(e) => {
                            editingAccount!.llm = editingAccount!.llm ?? {};
                            editingAccount!.llm.provider = (e.target as HTMLSelectElement).value || undefined;
                          }}
                        >
                          <option value="">Default</option>
                          {#each config?.llm_providers ?? [] as provider}
                            <option value={provider.name}>{provider.name}</option>
                          {/each}
                        </select>
                      </label>
                    </div>
                    <div class="form-group">
                      <label>
                        <span class="label-text">Model <span class="help-icon" title={helpTexts["llm.model"]}>?</span></span>
                        <input
                          type="text"
                          value={editingAccount.llm?.model ?? ""}
                          oninput={(e) => {
                            editingAccount!.llm = editingAccount!.llm ?? {};
                            editingAccount!.llm.model = (e.target as HTMLInputElement).value || undefined;
                          }}
                          placeholder="Use provider default"
                        />
                      </label>
                    </div>
                  </div>
                  <div class="form-group">
                    <label>
                      <span class="label-text">Custom Prompt <span class="help-icon" title={helpTexts.prompt_override}>?</span></span>
                      <textarea
                        value={editingAccount.prompt_override ?? ""}
                        oninput={(e) => {
                          editingAccount!.prompt_override = (e.target as HTMLTextAreaElement).value || undefined;
                        }}
                        rows="4"
                        placeholder="Leave empty to use the default prompt"
                      ></textarea>
                    </label>
                    <p class="help-text">Overrides the global default prompt for this account only.</p>
                  </div>

                  <div class="modal-actions">
                    <button class="btn btn-secondary" onclick={() => editingAccount = null}>Cancel</button>
                    <button class="btn btn-primary" onclick={saveAccount}>Save Account</button>
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
                    <button class="btn btn-sm" onclick={() => editAccount(account)}>Edit</button>
                    <button class="btn btn-sm btn-danger" onclick={() => removeAccount(account.name)}>Remove</button>
                  </div>
                </div>
              {/each}
            </div>
          </section>

        {:else if activeSection === "providers"}
          <section class="config-section">
            <div class="section-header">
              <h3>LLM Providers</h3>
              <button class="btn btn-secondary btn-sm" onclick={addProvider}>+ Add Provider</button>
            </div>

            {#if editingProvider}
              <div class="modal-overlay" onclick={() => editingProvider = null}>
                <div class="modal" onclick={(e) => e.stopPropagation()}>
                  <h3>{editingProvider.name ? `Edit ${editingProvider.name}` : "New Provider"}</h3>

                  <div class="form-group">
                    <label>
                      <span class="label-text">Provider Name</span>
                      <input type="text" bind:value={editingProvider.name} placeholder="openai" />
                    </label>
                  </div>

                  <div class="form-group">
                    <label>
                      <span class="label-text">API URL <span class="help-icon" title={helpTexts["provider.api_url"]}>?</span></span>
                      <input type="text" bind:value={editingProvider.api_url} placeholder="https://api.openai.com/v1/chat/completions" />
                    </label>
                  </div>

                  <div class="form-group">
                    <label>
                      <span class="label-text">API Key <span class="help-icon" title={helpTexts["provider.api_key"]}>?</span></span>
                      <input type="password" bind:value={editingProvider.api_key} placeholder="sk-..." />
                    </label>
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label>
                        <span class="label-text">Default Model <span class="help-icon" title={helpTexts["provider.default_model"]}>?</span></span>
                        <input type="text" bind:value={editingProvider.default_model} placeholder="gpt-4o" />
                      </label>
                    </div>
                    <div class="form-group">
                      <label>
                        <span class="label-text">Rate Limit (RPM) <span class="help-icon" title={helpTexts["provider.rate_limit"]}>?</span></span>
                        <input type="number" bind:value={editingProvider.rate_limit} placeholder="60" />
                      </label>
                    </div>
                  </div>

                  <div class="modal-actions">
                    <button class="btn btn-secondary" onclick={() => editingProvider = null}>Cancel</button>
                    <button class="btn btn-primary" onclick={saveProvider}>Save Provider</button>
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
                    <button class="btn btn-sm" onclick={() => editProvider(provider)}>Edit</button>
                    <button class="btn btn-sm btn-danger" onclick={() => removeProvider(provider.name)}>Remove</button>
                  </div>
                </div>
              {/each}
            </div>
          </section>

        {:else if activeSection === "attachments"}
          <section class="config-section">
            <div class="section-header">
              <h3>Attachment Extraction</h3>
              {#if services?.tika?.enabled}
                <span class="service-status" class:healthy={services.tika.healthy}>
                  <span class="status-dot"></span>
                  Tika {services.tika.healthy ? "Connected" : "Unreachable"}
                </span>
              {/if}
            </div>

            <div class="form-group checkbox">
              <label>
                <input type="checkbox" bind:checked={config.attachments.enabled} />
                <span class="label-text">
                  Enable Attachment Extraction
                  <span class="help-icon" title={helpTexts["attachments.enabled"]}>?</span>
                </span>
              </label>
            </div>

            {#if config.attachments?.enabled}
              <div class="form-group">
                <label>
                  <span class="label-text">
                    Tika Server URL
                    <span class="help-icon" title={helpTexts["attachments.tika_url"]}>?</span>
                  </span>
                  <input type="text" bind:value={config.attachments.tika_url} placeholder="http://tika:9998" />
                </label>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>
                    <span class="label-text">
                      Max Size (MB)
                      <span class="help-icon" title={helpTexts["attachments.max_size_mb"]}>?</span>
                    </span>
                    <input type="number" bind:value={config.attachments.max_size_mb} placeholder="10" />
                  </label>
                </div>
                <div class="form-group">
                  <label>
                    <span class="label-text">
                      Max Extracted Chars
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
                    Extract Images for Vision LLMs
                    <span class="help-icon" title={helpTexts["attachments.extract_images"]}>?</span>
                  </span>
                </label>
              </div>
            {/if}
          </section>

        {:else if activeSection === "antivirus"}
          <section class="config-section">
            <div class="section-header">
              <h3>Antivirus Scanning</h3>
              {#if services?.clamav?.enabled}
                <span class="service-status" class:healthy={services.clamav.healthy}>
                  <span class="status-dot"></span>
                  ClamAV {services.clamav.healthy ? "Connected" : "Unreachable"}
                </span>
              {/if}
            </div>

            <div class="form-group checkbox">
              <label>
                <input type="checkbox" bind:checked={config.antivirus.enabled} />
                <span class="label-text">
                  Enable Virus Scanning
                  <span class="help-icon" title={helpTexts["antivirus.enabled"]}>?</span>
                </span>
              </label>
            </div>

            {#if config.antivirus?.enabled}
              <div class="form-row">
                <div class="form-group">
                  <label>
                    <span class="label-text">
                      ClamAV Host
                      <span class="help-icon" title={helpTexts["antivirus.host"]}>?</span>
                    </span>
                    <input type="text" bind:value={config.antivirus.host} placeholder="localhost" />
                  </label>
                </div>
                <div class="form-group">
                  <label>
                    <span class="label-text">
                      ClamAV Port
                      <span class="help-icon" title={helpTexts["antivirus.port"]}>?</span>
                    </span>
                    <input type="number" bind:value={config.antivirus.port} placeholder="3310" />
                  </label>
                </div>
              </div>

              <div class="form-group">
                <label>
                  <span class="label-text">
                    On Virus Detected
                    <span class="help-icon" title={helpTexts["antivirus.on_virus_detected"]}>?</span>
                  </span>
                  <select bind:value={config.antivirus.on_virus_detected}>
                    <option value="quarantine">Quarantine</option>
                    <option value="delete">Delete</option>
                    <option value="flag_only">Flag Only</option>
                  </select>
                </label>
              </div>
            {/if}
          </section>

        {:else if activeSection === "dashboard"}
          <section class="config-section">
            <h3>Dashboard Settings</h3>
            <p class="section-note">Note: The dashboard cannot be disabled from here to prevent lockout. Edit config.yaml directly to disable.</p>

            <div class="form-group">
              <label>
                <span class="label-text">
                  Session TTL
                  <span class="help-icon" title={helpTexts["dashboard.session_ttl"]}>?</span>
                </span>
                <input type="text" bind:value={config.dashboard.session_ttl} placeholder="24h" />
              </label>
            </div>
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

  .config-path {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-family: monospace;
    background: var(--bg-tertiary);
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
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
