import { writable } from "svelte/store";

interface AuthState {
  authenticated: boolean;
  username: string | null;
}

function createAuthStore() {
  const { subscribe, set } = writable<AuthState>({
    authenticated: false,
    username: null,
  });

  return {
    subscribe,
    set,
    login: (username: string) => {
      set({ authenticated: true, username });
    },
    logout: () => {
      set({ authenticated: false, username: null });
    },
  };
}

export const auth = createAuthStore();

interface AuthCheckResult {
  needsSetup: boolean;
  authenticated: boolean;
  username?: string;
}

export async function checkAuth(): Promise<AuthCheckResult> {
  try {
    const res = await fetch("/dashboard/api/auth/check");
    if (!res.ok) {
      if (res.status === 401) {
        return { needsSetup: false, authenticated: false };
      }
      throw new Error("Auth check failed");
    }
    const data = await res.json();
    if (data.authenticated) {
      auth.login(data.username);
    }
    return data;
  } catch {
    return { needsSetup: false, authenticated: false };
  }
}

export async function login(username: string, password: string, csrfToken: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/dashboard/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password, _csrf: csrfToken }),
      redirect: "manual",
    });

    if (res.type === "opaqueredirect" || res.status === 302) {
      auth.login(username);
      return { success: true };
    }

    const text = await res.text();
    const errorMatch = text.match(/class="error">([^<]+)/);
    return { success: false, error: errorMatch?.[1] ?? "Login failed" };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Login failed" };
  }
}

export async function logout(): Promise<void> {
  await fetch("/dashboard/logout", { method: "POST" });
  auth.logout();
}
