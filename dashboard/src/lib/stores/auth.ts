import { writable } from "svelte/store";

interface AuthState {
  authenticated: boolean;
  needsSetup: boolean;
  username: string | null;
  loading: boolean;
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    authenticated: false,
    needsSetup: false,
    username: null,
    loading: true,
  });

  return {
    subscribe,
    set,
    update,
    login: (username: string) => {
      set({ authenticated: true, needsSetup: false, username, loading: false });
    },
    logout: () => {
      set({ authenticated: false, needsSetup: false, username: null, loading: false });
    },
    setLoading: (loading: boolean) => {
      update((state) => ({ ...state, loading }));
    },
    setNeedsSetup: (needsSetup: boolean) => {
      update((state) => ({ ...state, needsSetup, loading: false }));
    },
  };
}

export const auth = createAuthStore();

interface AuthCheckResult {
  needsSetup: boolean;
  authenticated: boolean;
  user?: { username: string };
}

export async function checkAuth(): Promise<AuthCheckResult> {
  try {
    const res = await fetch("/dashboard/api/auth");
    if (!res.ok) {
      auth.logout();
      return { needsSetup: false, authenticated: false };
    }
    const data: AuthCheckResult = await res.json();

    if (data.needsSetup) {
      auth.setNeedsSetup(true);
    } else if (data.authenticated && data.user) {
      auth.login(data.user.username);
    } else {
      auth.logout();
    }

    return data;
  } catch {
    auth.logout();
    return { needsSetup: false, authenticated: false };
  }
}

interface LoginResult {
  success: boolean;
  error?: string;
  user?: { username: string };
}

export async function login(username: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetch("/dashboard/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      auth.login(data.user.username);
      return { success: true, user: data.user };
    }

    return { success: false, error: data.error ?? "Login failed" };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Login failed" };
  }
}

interface SetupResult {
  success: boolean;
  error?: string;
  user?: { username: string };
}

export async function setup(username: string, password: string, confirm: string): Promise<SetupResult> {
  try {
    const res = await fetch("/dashboard/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, confirm }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      auth.login(data.user.username);
      return { success: true, user: data.user };
    }

    return { success: false, error: data.error ?? "Setup failed" };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Setup failed" };
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch("/dashboard/api/logout", { method: "POST" });
  } finally {
    auth.logout();
  }
}
