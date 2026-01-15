<script lang="ts">
  import { onMount } from "svelte";
  import { t, locale, locales, setLocale } from "../i18n";
  import Modal from "./Modal.svelte";

  let { open = $bindable(false) }: { open?: boolean } = $props();

  const LOCALE_NAMES: Record<string, string> = {
    en: "English",
  };

  let selectedLocale = $state<string>("en");

  onMount(() => {
    selectedLocale = $locale;
  });

  function savePreferences() {
    setLocale(selectedLocale);
    open = false;
  }

  function handleClose() {
    open = false;
  }
</script>

<Modal
  {open}
  title={$t("userSettings.title")}
  onclose={handleClose}
  maxWidth="400px"
>
  {#snippet children()}
    <div class="form-group">
      <label>
        <span class="label-text">Language</span>
        <select bind:value={selectedLocale}>
          {#each locales as code}
            <option value={code}>{LOCALE_NAMES[code] ?? code}</option>
          {/each}
        </select>
      </label>
    </div>
  {/snippet}
  {#snippet actions()}
    <button class="btn btn-secondary" onclick={handleClose}>{$t("common.cancel")}</button>
    <button class="btn btn-primary" onclick={savePreferences}>{$t("common.save")}</button>
  {/snippet}
</Modal>

<style>
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
