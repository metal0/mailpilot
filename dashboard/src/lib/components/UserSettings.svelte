<script lang="ts">
  import { onMount } from "svelte";

  let { open = $bindable(false) }: { open?: boolean } = $props();

  interface UserPreferences {
    locale: string;
  }

  const STORAGE_KEY = "mailpilot_user_prefs";
  const SUPPORTED_LOCALES = [
    { code: "en", name: "English" },
  ];

  let preferences = $state<UserPreferences>({
    locale: "en",
  });

  onMount(() => {
    loadPreferences();
  });

  function loadPreferences() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        preferences = { ...preferences, ...JSON.parse(stored) };
      }
    } catch {
      // Ignore storage errors
    }
  }

  function savePreferences() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore storage errors
    }
    open = false;
  }

  function handleClose() {
    open = false;
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={handleClose}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <h3>User Settings</h3>

      <div class="form-group">
        <label>
          <span class="label-text">Language</span>
          <select bind:value={preferences.locale}>
            {#each SUPPORTED_LOCALES as locale}
              <option value={locale.code}>{locale.name}</option>
            {/each}
          </select>
        </label>
        <p class="help-text">More languages coming soon.</p>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" onclick={handleClose}>Cancel</button>
        <button class="btn btn-primary" onclick={savePreferences}>Save</button>
      </div>
    </div>
  </div>
{/if}

<style>
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
    max-width: 400px;
  }

  .modal h3 {
    margin: 0 0 1.5rem;
    font-size: 1.125rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
  }

  .label-text {
    display: block;
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 0.375rem;
  }

  .form-group select {
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .form-group select:focus {
    outline: none;
    border-color: var(--accent);
  }

  .help-text {
    margin: 0.5rem 0 0;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color);
  }

  .btn {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-primary {
    background: var(--accent);
    color: white;
  }

  .btn-primary:hover {
    background: color-mix(in srgb, var(--accent) 85%, black);
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn-secondary:hover {
    background: var(--border-color);
  }
</style>
