<script lang="ts">
  import { setup } from "../lib/stores/auth";

  let username = $state("");
  let password = $state("");
  let confirm = $state("");
  let loading = $state(false);
  let error = $state<string | null>(null);

  async function handleSubmit(e: Event) {
    e.preventDefault();

    if (!username || username.length < 3) {
      error = "Username must be at least 3 characters";
      return;
    }

    if (!password || password.length < 8) {
      error = "Password must be at least 8 characters";
      return;
    }

    if (password !== confirm) {
      error = "Passwords do not match";
      return;
    }

    loading = true;
    error = null;

    const result = await setup(username, password, confirm);

    if (result.success) {
      window.location.reload();
    } else {
      error = result.error ?? "Setup failed";
      loading = false;
    }
  }
</script>

<div class="auth-container">
  <div class="auth-card">
    <div class="logo">
      <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
      <h1 class="logo-text">Mailpilot Setup</h1>
    </div>
    <p class="subtitle">Create your admin account</p>

    {#if error}
      <div class="error">{error}</div>
    {/if}

    <form onsubmit={handleSubmit}>
      <div class="form-group">
        <label for="username">Username</label>
        <input
          type="text"
          id="username"
          name="username"
          bind:value={username}
          required
          minlength="3"
          autocomplete="username"
          disabled={loading}
        />
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input
          type="password"
          id="password"
          name="password"
          bind:value={password}
          required
          minlength="8"
          autocomplete="new-password"
          disabled={loading}
        />
      </div>

      <div class="form-group">
        <label for="confirm">Confirm Password</label>
        <input
          type="password"
          id="confirm"
          name="confirm"
          bind:value={confirm}
          required
          minlength="8"
          autocomplete="new-password"
          disabled={loading}
        />
      </div>

      <button type="submit" class="btn btn-primary" disabled={loading}>
        {loading ? "Creating Account..." : "Create Account"}
      </button>
    </form>
  </div>
</div>

<style>
  .auth-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .auth-card {
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    padding: 2rem;
    width: 100%;
    max-width: 400px;
  }

  .logo {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .logo-icon {
    width: 2rem;
    height: 2rem;
    color: var(--accent);
  }

  .logo-text {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
  }

  .subtitle {
    text-align: center;
    color: var(--text-secondary);
    margin-bottom: 1.5rem;
  }

  .error {
    background: #7f1d1d;
    color: #fecaca;
    padding: 0.75rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .form-group input {
    width: 100%;
    padding: 0.75rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    color: var(--text-primary);
    font-size: 1rem;
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .form-group input:disabled {
    opacity: 0.5;
  }

  .btn {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 1rem;
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

  .btn-primary:hover:not(:disabled) {
    background: var(--accent-hover);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
