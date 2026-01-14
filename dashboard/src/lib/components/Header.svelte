<script lang="ts">
  import { auth, logout } from "../stores/auth";
  import { connectionState } from "../stores/websocket";
  import { t } from "../i18n";
  import { generateSystemNotifications } from "../stores/notifications";
  import { stats, deadLetters } from "../stores/data";
  import { onMount } from "svelte";
  import ThemeToggle from "./ThemeToggle.svelte";
  import UserSettings from "./UserSettings.svelte";

  let userMenuOpen = $state(false);
  let userSettingsOpen = $state(false);

  async function handleLogout() {
    await logout();
    window.location.reload();
  }

  function closeMenu() {
    userMenuOpen = false;
  }

  function openUserSettings() {
    userMenuOpen = false;
    userSettingsOpen = true;
  }

  $effect(() => {
    if ($stats || $deadLetters) {
      generateSystemNotifications();
    }
  });
</script>

<header class="header">
  <div class="header-left">
    <h1 class="logo">
      <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
      {$t("header.title")}
    </h1>
    <div class="connection-status connection-{$connectionState}">
      <span class="status-dot"></span>
      <span class="status-text">
        {$connectionState === "connected" ? "" : $connectionState === "connecting" ? $t("accounts.connecting") : "Offline"}
      </span>
    </div>
  </div>

  <div class="header-right">
    <ThemeToggle />

    <div class="user-menu">
      <button
        class="user-menu-trigger"
        onclick={() => userMenuOpen = !userMenuOpen}
        onblur={() => setTimeout(closeMenu, 200)}
        title={$auth.username}
      >
        <svg class="user-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <svg class="chevron" class:open={userMenuOpen} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {#if userMenuOpen}
        <div class="user-dropdown">
          <div class="dropdown-user-header">
            <span class="dropdown-username">{$auth.username}</span>
          </div>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item" onclick={openUserSettings}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            {$t("header.userSettings")}
          </button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item" onclick={handleLogout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {$t("header.logout")}
          </button>
        </div>
      {/if}
    </div>
  </div>
</header>

<UserSettings bind:open={userSettingsOpen} />

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

  .user-menu {
    position: relative;
  }

  .user-menu-trigger {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    color: var(--text-primary);
    cursor: pointer;
    transition: background 0.2s;
  }

  .user-menu-trigger:hover {
    background: var(--border-color);
  }

  .user-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: var(--text-secondary);
  }

  .dropdown-user-header {
    padding: 0.75rem 0.875rem;
  }

  .dropdown-username {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .chevron {
    width: 1rem;
    height: 1rem;
    color: var(--text-secondary);
    transition: transform 0.2s;
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  .user-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.25rem;
    min-width: 150px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 50;
    overflow: hidden;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.625rem 0.875rem;
    background: none;
    border: none;
    color: var(--text-primary);
    font-size: 0.875rem;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s;
  }

  .dropdown-item:hover {
    background: var(--bg-tertiary);
  }

  .dropdown-item svg {
    width: 1rem;
    height: 1rem;
    color: var(--text-secondary);
  }

  .dropdown-divider {
    height: 1px;
    background: var(--border-color);
    margin: 0.25rem 0;
  }

  @media (max-width: 640px) {
    .header {
      padding: 0.75rem 1rem;
    }

    .notification-dropdown {
      width: 280px;
      right: -1rem;
    }
  }
</style>
