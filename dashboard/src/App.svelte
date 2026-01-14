<script lang="ts">
  import { onMount } from "svelte";
  import { theme } from "./lib/stores/theme";
  import { auth, checkAuth } from "./lib/stores/auth";
  import Login from "./routes/Login.svelte";
  import Setup from "./routes/Setup.svelte";
  import Dashboard from "./routes/Dashboard.svelte";
  import Toast from "./lib/components/Toast.svelte";

  let loading = $state(true);
  let needsSetup = $state(false);

  onMount(async () => {
    // Apply saved theme
    const savedTheme = localStorage.getItem("theme") ?? "dark";
    theme.set(savedTheme as "dark" | "light");
    document.documentElement.setAttribute("data-theme", savedTheme);

    // Check auth status
    const result = await checkAuth();
    needsSetup = result.needsSetup;
    loading = false;
  });
</script>

<svelte:head>
  <style>
    :root {
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-tertiary: #334155;
      --text-primary: #e2e8f0;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --border-color: #334155;
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --success: #22c55e;
      --warning: #fbbf24;
      --error: #ef4444;
    }

    [data-theme="light"] {
      --bg-primary: #ffffff;
      --bg-secondary: #f1f5f9;
      --bg-tertiary: #e2e8f0;
      --text-primary: #1e293b;
      --text-secondary: #475569;
      --text-muted: #94a3b8;
      --border-color: #cbd5e1;
      --accent: #2563eb;
      --accent-hover: #1d4ed8;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      line-height: 1.5;
    }

    a {
      color: var(--accent);
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
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
