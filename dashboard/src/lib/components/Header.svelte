<script lang="ts">
  import { theme } from "../stores/theme";
  import { auth, logout } from "../stores/auth";
  import { connectionState } from "../stores/websocket";
  import ThemeToggle from "./ThemeToggle.svelte";

  async function handleLogout() {
    await logout();
    window.location.reload();
  }
</script>

<header class="header">
  <div class="header-left">
    <h1 class="logo">
      <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
      Mailpilot
    </h1>
    <div class="connection-status connection-{$connectionState}">
      <span class="status-dot"></span>
      <span class="status-text">
        {$connectionState === "connected" ? "Live" : $connectionState === "connecting" ? "Connecting..." : "Offline"}
      </span>
    </div>
  </div>

  <div class="header-right">
    <a
      href="https://github.com/metal0/mailpilot"
      target="_blank"
      rel="noopener noreferrer"
      class="github-link"
      title="View on GitHub"
    >
      <svg class="github-icon" viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
        />
      </svg>
    </a>

    <ThemeToggle />

    <div class="user-info">
      <span class="username">{$auth.username}</span>
      <button class="btn btn-secondary btn-sm" onclick={handleLogout}>Logout</button>
    </div>
  </div>
</header>

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .logo-icon {
    width: 1.5rem;
    height: 1.5rem;
    color: var(--accent);
  }

  .connection-status {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .status-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
  }

  .connection-connected .status-dot {
    background: var(--success);
  }

  .connection-connecting .status-dot {
    background: var(--warning);
    animation: pulse 1s infinite;
  }

  .connection-disconnected .status-dot,
  .connection-error .status-dot {
    background: var(--error);
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .github-link {
    display: flex;
    align-items: center;
    color: var(--text-secondary);
    transition: color 0.2s;
  }

  .github-link:hover {
    color: var(--text-primary);
  }

  .github-icon {
    width: 1.5rem;
    height: 1.5rem;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .username {
    color: var(--text-secondary);
    font-size: 0.875rem;
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
    transition: background 0.2s;
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn-secondary:hover {
    background: var(--border-color);
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }

  @media (max-width: 640px) {
    .header {
      padding: 0.75rem 1rem;
    }

    .username {
      display: none;
    }
  }
</style>
