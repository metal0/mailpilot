<script lang="ts">
  import { theme, accentColor, type Theme } from "../stores/theme";

  let menuOpen = $state(false);

  function closeMenu() {
    menuOpen = false;
  }

  function setTheme(newTheme: Theme) {
    theme.set(newTheme);
    closeMenu();
  }

  const themeLabels: Record<Theme, string> = {
    light: "Light",
    dark: "Dark",
    oled: "OLED Dark",
    "high-contrast": "High Contrast",
    auto: "System",
  };

  const themeIcons: Record<Theme, string> = {
    light: "sun",
    dark: "moon",
    oled: "moon-stars",
    "high-contrast": "contrast",
    auto: "monitor",
  };

  const accentPresets = [
    { name: "blue", color: "#3b82f6" },
    { name: "purple", color: "#8b5cf6" },
    { name: "green", color: "#22c55e" },
    { name: "orange", color: "#f97316" },
    { name: "red", color: "#ef4444" },
  ] as const;
</script>

<div class="theme-menu">
  <button
    class="theme-trigger"
    onclick={() => menuOpen = !menuOpen}
    onblur={() => setTimeout(closeMenu, 200)}
    title="Theme settings"
    aria-label="Theme settings"
  >
    {#if $theme === "light"}
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    {:else if $theme === "auto"}
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    {:else}
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    {/if}
  </button>

  {#if menuOpen}
    <div class="theme-dropdown">
      <div class="dropdown-section">
        <div class="section-label">Theme</div>
        <div class="theme-options">
          {#each theme.themes as themeOption}
            <button
              class="theme-option"
              class:active={$theme === themeOption}
              onclick={() => setTheme(themeOption)}
            >
              <span class="theme-option-label">{themeLabels[themeOption]}</span>
              {#if $theme === themeOption}
                <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              {/if}
            </button>
          {/each}
        </div>
      </div>

      <div class="dropdown-divider"></div>

      <div class="dropdown-section">
        <div class="section-label">Accent Color</div>
        <div class="accent-options">
          {#each accentPresets as preset}
            <button
              class="accent-swatch"
              style="background: {preset.color}"
              onclick={() => accentColor.setPreset(preset.name)}
              title={preset.name}
            ></button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .theme-menu {
    position: relative;
  }

  .theme-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    cursor: pointer;
    color: var(--text-secondary);
    transition: all var(--transition-fast);
  }

  .theme-trigger:hover {
    background: var(--border-color);
    color: var(--text-primary);
  }

  .icon {
    width: 1.125rem;
    height: 1.125rem;
  }

  .theme-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.5rem;
    min-width: 180px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    z-index: 100;
    overflow: hidden;
  }

  .dropdown-section {
    padding: 0.75rem;
  }

  .section-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 0.5rem;
  }

  .theme-options {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .theme-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.625rem;
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: 0.8125rem;
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .theme-option:hover {
    background: var(--bg-tertiary);
  }

  .theme-option.active {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent);
  }

  .theme-option-label {
    flex: 1;
    text-align: left;
  }

  .check-icon {
    width: 1rem;
    height: 1rem;
  }

  .dropdown-divider {
    height: 1px;
    background: var(--border-color);
  }

  .accent-options {
    display: flex;
    gap: 0.5rem;
  }

  .accent-swatch {
    width: 24px;
    height: 24px;
    border: 2px solid transparent;
    border-radius: 50%;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .accent-swatch:hover {
    transform: scale(1.15);
  }

  .accent-swatch:focus {
    outline: none;
    border-color: var(--text-primary);
  }
</style>
