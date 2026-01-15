<script lang="ts">
  import { onMount } from "svelte";
  import { theme, accentColor, type Theme } from "./lib/stores/theme";
  import { auth, checkAuth } from "./lib/stores/auth";
  import Login from "./routes/Login.svelte";
  import Setup from "./routes/Setup.svelte";
  import Dashboard from "./routes/Dashboard.svelte";
  import Toast from "./lib/components/Toast.svelte";
  import ConnectionBlocker from "./lib/components/ConnectionBlocker.svelte";

  let loading = $state(true);
  let needsSetup = $state(false);

  onMount(async () => {
    // Apply saved theme
    const savedTheme = (localStorage.getItem("theme") ?? "dark") as Theme;
    theme.set(savedTheme);

    // Initialize accent color
    accentColor.init();

    // Check auth status
    const result = await checkAuth();
    needsSetup = result.needsSetup;
    loading = false;
  });
</script>

<svelte:head>
  <style>
    :root {
      /* Accent color (customizable via HSL) */
      --accent-h: 220;
      --accent-s: 80%;
      --accent-l: 50%;
      --accent: hsl(var(--accent-h), var(--accent-s), var(--accent-l));
      --accent-hover: hsl(var(--accent-h), var(--accent-s), calc(var(--accent-l) - 8%));
      --accent-muted: hsl(var(--accent-h), calc(var(--accent-s) - 20%), calc(var(--accent-l) + 10%));

      /* Spacing scale */
      --space-1: 0.25rem;
      --space-2: 0.5rem;
      --space-3: 0.75rem;
      --space-4: 1rem;
      --space-5: 1.5rem;
      --space-6: 2rem;
      --space-7: 3rem;
      --space-8: 4rem;

      /* Border radius */
      --radius-sm: 0.25rem;
      --radius-md: 0.5rem;
      --radius-lg: 0.75rem;
      --radius-xl: 1rem;
      --radius-full: 9999px;

      /* Shadows */
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
      --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
      --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);

      /* Typography */
      --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: "JetBrains Mono", "Fira Code", monospace;

      --text-xs: 0.75rem;
      --text-sm: 0.875rem;
      --text-base: 1rem;
      --text-lg: 1.125rem;
      --text-xl: 1.25rem;
      --text-2xl: 1.5rem;

      /* Semantic colors */
      --success: #22c55e;
      --success-muted: rgba(34, 197, 94, 0.15);
      --warning: #f59e0b;
      --warning-muted: rgba(245, 158, 11, 0.15);
      --error: #ef4444;
      --error-muted: rgba(239, 68, 68, 0.15);
      --info: #3b82f6;
      --info-muted: rgba(59, 130, 246, 0.15);

      /* Transitions */
      --transition-fast: 0.1s ease;
      --transition-base: 0.2s ease;
      --transition-slow: 0.3s ease;

      /* Default dark theme colors */
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-tertiary: #334155;
      --bg-elevated: #1e293b;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --border-color: #334155;
      --border-subtle: rgba(255, 255, 255, 0.06);
    }

    /* Light theme */
    [data-theme="light"] {
      --bg-primary: #f8f9fa;
      --bg-secondary: #f1f3f5;
      --bg-tertiary: #e9ecef;
      --bg-elevated: #ffffff;
      --text-primary: #1a1a2e;
      --text-secondary: #4a5568;
      --text-muted: #718096;
      --border-color: #dee2e6;
      --border-subtle: rgba(0, 0, 0, 0.08);
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.06);
      --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
    }

    /* OLED dark theme (true black) */
    [data-theme="oled"] {
      --bg-primary: #000000;
      --bg-secondary: #0a0a0a;
      --bg-tertiary: #171717;
      --bg-elevated: #0f0f0f;
      --text-primary: #fafafa;
      --text-secondary: #a1a1aa;
      --text-muted: #71717a;
      --border-color: #27272a;
      --border-subtle: rgba(255, 255, 255, 0.08);
    }

    /* High contrast theme */
    [data-theme="high-contrast"] {
      --bg-primary: #000000;
      --bg-secondary: #1a1a1a;
      --bg-tertiary: #333333;
      --bg-elevated: #1a1a1a;
      --text-primary: #ffffff;
      --text-secondary: #e0e0e0;
      --text-muted: #b0b0b0;
      --border-color: #ffffff;
      --border-subtle: rgba(255, 255, 255, 0.3);
      --accent: hsl(var(--accent-h), 100%, 60%);
      --success: #00ff00;
      --warning: #ffff00;
      --error: #ff0000;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--font-sans);
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      line-height: 1.5;
      font-size: var(--text-sm);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    a {
      color: var(--accent);
      text-decoration: none;
      transition: color var(--transition-fast);
    }

    a:hover {
      color: var(--accent-hover);
    }

    /* Utility classes */
    .card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: var(--space-4);
      box-shadow: var(--shadow-sm);
    }

    .card-elevated {
      background: var(--bg-elevated);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: var(--space-4);
      box-shadow: var(--shadow-md);
    }

    /* Button base styles */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      font-size: var(--text-sm);
      font-weight: 500;
      border-radius: var(--radius-md);
      border: none;
      cursor: pointer;
      transition: all var(--transition-fast);
      font-family: inherit;
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
      background: var(--accent-hover);
      box-shadow: var(--shadow-md);
    }

    .btn-secondary {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }

    .btn-secondary:hover:not(:disabled) {
      background: var(--border-color);
    }

    .btn-ghost {
      background: transparent;
      color: var(--text-secondary);
    }

    .btn-ghost:hover:not(:disabled) {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }

    /* Badge styles */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: var(--space-1) var(--space-2);
      font-size: var(--text-xs);
      font-weight: 500;
      border-radius: var(--radius-full);
    }

    .badge-success {
      background: var(--success-muted);
      color: var(--success);
    }

    .badge-warning {
      background: var(--warning-muted);
      color: var(--warning);
    }

    .badge-error {
      background: var(--error-muted);
      color: var(--error);
    }

    .badge-info {
      background: var(--info-muted);
      color: var(--info);
    }

    .badge-neutral {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
    }

    /* Input styles */
    input, textarea, select {
      font-family: inherit;
      font-size: var(--text-sm);
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: var(--space-2) var(--space-3);
      color: var(--text-primary);
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }

    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--info-muted);
    }

    input::placeholder, textarea::placeholder {
      color: var(--text-muted);
    }

    /* Scrollbar styling */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: var(--bg-secondary);
    }

    ::-webkit-scrollbar-thumb {
      background: var(--bg-tertiary);
      border-radius: var(--radius-full);
    }

    ::-webkit-scrollbar-thumb:hover {
      background: var(--text-muted);
    }
  </style>
</svelte:head>

{#if loading}
  <div class="loading">
    <div class="spinner"></div>
  </div>
{:else if needsSetup}
  <Setup />
{:else if !$auth.authenticated}
  <Login />
{:else}
  <Dashboard />
  <ConnectionBlocker />
{/if}

<Toast />

<style>
  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: var(--bg-primary);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--bg-tertiary);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
