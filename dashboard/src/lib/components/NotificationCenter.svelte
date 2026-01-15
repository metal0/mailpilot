<script lang="ts">
  import { onMount } from "svelte";
  import {
    notifications,
    unreadCount,
    browserNotificationPermission,
    requestBrowserNotificationPermission,
    initBrowserNotificationPermission,
  } from "../stores/notifications";
  import { t } from "../i18n";
  import Backdrop from "./Backdrop.svelte";

  let showDropdown = $state(false);
  let showPermissionBanner = $state(false);

  onMount(() => {
    initBrowserNotificationPermission();
    if ($browserNotificationPermission === "default") {
      showPermissionBanner = true;
    }
  });

  function formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffMins < 1) return $t("time.justNow");
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function getNotificationIcon(type: string): string {
    switch (type) {
      case "error":
        return "&#9888;";
      case "warning":
        return "&#9888;";
      default:
        return "&#8505;";
    }
  }

  function handleToggle() {
    showDropdown = !showDropdown;
  }

  function handleMarkAllRead() {
    notifications.markAllRead();
  }

  function handleClearAll() {
    notifications.clearAll();
  }

  async function handleEnableNotifications() {
    await requestBrowserNotificationPermission();
    showPermissionBanner = false;
  }

  function handleDismissBanner() {
    showPermissionBanner = false;
  }

  function handleBackdropClick() {
    showDropdown = false;
  }
</script>

<div class="notification-center">
  <button
    class="notification-bell"
    class:has-unread={$unreadCount > 0}
    onclick={handleToggle}
    aria-label="Notifications"
    aria-expanded={showDropdown}
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
    {#if $unreadCount > 0}
      <span class="unread-badge">{$unreadCount > 9 ? "9+" : $unreadCount}</span>
    {/if}
  </button>

  {#if showDropdown}
    <Backdrop onclose={handleBackdropClick} />
    <div class="notification-dropdown" role="menu">
      {#if showPermissionBanner && $browserNotificationPermission === "default"}
        <div class="permission-banner">
          <p>Enable browser notifications to stay updated</p>
          <div class="permission-actions">
            <button class="btn-enable" onclick={handleEnableNotifications}>Enable</button>
            <button class="btn-dismiss" onclick={handleDismissBanner}>Not now</button>
          </div>
        </div>
      {/if}

      <div class="dropdown-header">
        <h3>Notifications</h3>
        <div class="header-actions">
          {#if $unreadCount > 0}
            <button class="header-btn" onclick={handleMarkAllRead}>Mark all read</button>
          {/if}
          {#if $notifications.length > 0}
            <button class="header-btn" onclick={handleClearAll}>Clear all</button>
          {/if}
        </div>
      </div>

      <div class="notification-list">
        {#if $notifications.length === 0}
          <div class="empty-state">No notifications</div>
        {:else}
          {#each $notifications as notification}
            <button
              type="button"
              class="notification-item"
              class:unread={!notification.read}
              class:type-error={notification.type === "error"}
              class:type-warning={notification.type === "warning"}
              onclick={() => notifications.markRead(notification.id)}
            >
              <span class="notification-icon">{@html getNotificationIcon(notification.type)}</span>
              <div class="notification-content">
                <div class="notification-title">{notification.title}</div>
                <div class="notification-message">{notification.message}</div>
                <div class="notification-time">{formatTimeAgo(notification.timestamp)}</div>
              </div>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .notification-center {
    position: relative;
  }

  .notification-bell {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    cursor: pointer;
    position: relative;
    transition: all var(--transition-fast);
  }

  .notification-bell:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .notification-bell svg {
    width: 20px;
    height: 20px;
  }

  .notification-bell.has-unread svg {
    color: var(--accent);
  }

  .unread-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    background: var(--error);
    color: white;
    font-size: 10px;
    font-weight: 600;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .notification-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: var(--space-2);
    width: 360px;
    max-height: 480px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    z-index: 100;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .permission-banner {
    padding: var(--space-3);
    background: color-mix(in srgb, var(--accent) 10%, var(--bg-secondary));
    border-bottom: 1px solid var(--border-color);
  }

  .permission-banner p {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .permission-actions {
    display: flex;
    gap: var(--space-2);
  }

  .btn-enable {
    padding: var(--space-1) var(--space-3);
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: 500;
    cursor: pointer;
  }

  .btn-enable:hover {
    background: var(--accent-hover);
  }

  .btn-dismiss {
    padding: var(--space-1) var(--space-3);
    background: transparent;
    color: var(--text-secondary);
    border: none;
    font-size: var(--text-xs);
    cursor: pointer;
  }

  .btn-dismiss:hover {
    color: var(--text-primary);
  }

  .dropdown-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border-color);
  }

  .dropdown-header h3 {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    gap: var(--space-2);
  }

  .header-btn {
    background: none;
    border: none;
    color: var(--accent);
    font-size: var(--text-xs);
    cursor: pointer;
  }

  .header-btn:hover {
    text-decoration: underline;
  }

  .notification-list {
    flex: 1;
    overflow-y: auto;
  }

  .empty-state {
    padding: var(--space-8);
    text-align: center;
    color: var(--text-muted);
    font-size: var(--text-sm);
  }

  .notification-item {
    display: flex;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border: none;
    border-bottom: 1px solid var(--border-color);
    background: transparent;
    width: 100%;
    text-align: left;
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .notification-item:last-child {
    border-bottom: none;
  }

  .notification-item:hover {
    background: var(--bg-tertiary);
  }

  .notification-item.unread {
    background: color-mix(in srgb, var(--accent) 5%, transparent);
  }

  .notification-item.type-error .notification-icon {
    color: var(--error);
  }

  .notification-item.type-warning .notification-icon {
    color: var(--warning);
  }

  .notification-icon {
    font-size: var(--text-base);
    flex-shrink: 0;
    width: 20px;
    text-align: center;
  }

  .notification-content {
    flex: 1;
    min-width: 0;
  }

  .notification-title {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 2px;
  }

  .notification-message {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .notification-time {
    font-size: 10px;
    color: var(--text-muted);
    margin-top: var(--space-1);
  }

  @media (max-width: 480px) {
    .notification-dropdown {
      width: calc(100vw - 2rem);
      right: -1rem;
    }
  }
</style>
