import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Config, AccountConfig, LlmProviderConfig, BacklogConfig } from "../../src/config/schema.js";

/**
 * Tests for config loader validation logic.
 * These tests validate the configuration validation rules without needing to read actual files.
 */

// Type for validation function
type ValidationFn = (config: Config) => void;

// Minimal valid config factory
function createMinimalConfig(overrides: Partial<Config> = {}): Config {
  return {
    polling_interval: "30s",
    concurrency_limit: 5,
    dry_run: false,
    add_processing_headers: false,
    llm_providers: [],
    accounts: [],
    ...overrides,
  };
}

function createAccount(overrides: Partial<AccountConfig> = {}): AccountConfig {
  return {
    name: "test-account",
    imap: {
      host: "imap.example.com",
      port: 993,
      tls: "tls",
      auth: "basic",
      username: "test@example.com",
      password: "password123",
    },
    webhooks: [],
    ...overrides,
  };
}

function createProvider(overrides: Partial<LlmProviderConfig> = {}): LlmProviderConfig {
  return {
    name: "test-provider",
    api_url: "https://api.example.com/v1/chat/completions",
    default_model: "gpt-4o-mini",
    max_body_tokens: 4000,
    max_thread_tokens: 2000,
    supports_vision: false,
    ...overrides,
  };
}

describe("Config Validation", () => {
  // Recreate validateConfig logic for testing
  function validateConfig(config: Config): void {
    const providerNames = new Set(config.llm_providers.map((p) => p.name));

    // Allow empty accounts/providers for initial setup via dashboard
    if (config.accounts.length === 0 && config.llm_providers.length === 0) {
      return;
    }

    for (const account of config.accounts) {
      if (account.llm?.provider && !providerNames.has(account.llm.provider)) {
        throw new Error(
          `Account "${account.name}" references unknown LLM provider "${account.llm.provider}"`
        );
      }

      if (account.imap.auth === "basic" && !account.imap.password) {
        throw new Error(
          `Account "${account.name}" uses basic auth but no password is provided`
        );
      }

      if (account.imap.auth === "oauth2") {
        if (!account.imap.oauth_client_id) {
          throw new Error(
            `Account "${account.name}" uses OAuth2 but no client_id is provided`
          );
        }
        if (!account.imap.oauth_client_secret) {
          throw new Error(
            `Account "${account.name}" uses OAuth2 but no client_secret is provided`
          );
        }
        if (!account.imap.oauth_refresh_token) {
          throw new Error(
            `Account "${account.name}" uses OAuth2 but no refresh_token is provided`
          );
        }
      }

      if (account.prompt_file && account.prompt_override) {
        throw new Error(
          `Account "${account.name}" has both prompt_override and prompt_file - use only one`
        );
      }
    }

    if (config.default_prompt && config.default_prompt_file) {
      throw new Error(
        "Both default_prompt and default_prompt_file specified - use only one"
      );
    }

    if (config.backlog) {
      if (config.backlog.mode === "recent_count" && config.backlog.count === undefined) {
        throw new Error("Backlog mode 'recent_count' requires 'count' field");
      }

      if (config.backlog.mode === "recent_days" && config.backlog.age === undefined) {
        throw new Error("Backlog mode 'recent_days' requires 'age' field");
      }
    }
  }

  describe("empty config", () => {
    it("allows empty accounts and providers", () => {
      const config = createMinimalConfig();
      expect(() => validateConfig(config)).not.toThrow();
    });
  });

  describe("provider reference validation", () => {
    it("allows valid provider reference", () => {
      const config = createMinimalConfig({
        llm_providers: [createProvider({ name: "openai" })],
        accounts: [createAccount({ llm: { provider: "openai" } })],
      });
      expect(() => validateConfig(config)).not.toThrow();
    });

    it("throws for unknown provider reference", () => {
      const config = createMinimalConfig({
        llm_providers: [createProvider({ name: "openai" })],
        accounts: [createAccount({ llm: { provider: "unknown-provider" } })],
      });
      expect(() => validateConfig(config)).toThrow('references unknown LLM provider "unknown-provider"');
    });

    it("allows account without LLM selection", () => {
      const config = createMinimalConfig({
        llm_providers: [createProvider()],
        accounts: [createAccount()],
      });
      expect(() => validateConfig(config)).not.toThrow();
    });
  });

  describe("basic auth validation", () => {
    it("allows basic auth with password", () => {
      const config = createMinimalConfig({
        llm_providers: [createProvider()],
        accounts: [createAccount({
          imap: {
            host: "imap.example.com",
            port: 993,
            tls: "tls",
            auth: "basic",
            username: "test@example.com",
            password: "mypassword",
          },
        })],
      });
      expect(() => validateConfig(config)).not.toThrow();
    });

    it("throws for basic auth without password", () => {
      const config = createMinimalConfig({
        llm_providers: [createProvider()],
        accounts: [createAccount({
          imap: {
            host: "imap.example.com",
            port: 993,
            tls: "tls",
            auth: "basic",
            username: "test@example.com",
            password: undefined,
          },
        })],
      });
      expect(() => validateConfig(config)).toThrow("uses basic auth but no password is provided");
    });
  });

  describe("oauth2 validation", () => {
    it("allows oauth2 with all required fields", () => {
      const config = createMinimalConfig({
        llm_providers: [createProvider()],
        accounts: [createAccount({
          imap: {
            host: "imap.gmail.com",
            port: 993,
            tls: "tls",
            auth: "oauth2",
            username: "test@gmail.com",
            oauth_client_id: "client-id",
            oauth_client_secret: "client-secret",
            oauth_refresh_token: "refresh-token",
          },
        })],
      });
      expect(() => validateConfig(config)).not.toThrow();
    });

    it("throws for oauth2 without client_id", () => {
      const config = createMinimalConfig({
        llm_providers: [createProvider()],
        accounts: [createAccount({
          imap: {
            host: "imap.gmail.com",
            port: 993,
            tls: "tls",
            auth: "oauth2",
            username: "test@gmail.com",
            oauth_client_secret: "client-secret",
            oauth_refresh_token: "refresh-token",
          },
        })],
      });
      expect(() => validateConfig(config)).toThrow("uses OAuth2 but no client_id is provided");
    });

    it("throws for oauth2 without client_secret", () => {
      const config = createMinimalConfig({
        llm_providers: [createProvider()],
        accounts: [createAccount({
          imap: {
            host: "imap.gmail.com",
            port: 993,
            tls: "tls",
            auth: "oauth2",
            username: "test@gmail.com",
            oauth_client_id: "client-id",
            oauth_refresh_token: "refresh-token",
          },
        })],
      });
      expect(() => validateConfig(config)).toThrow("uses OAuth2 but no client_secret is provided");
    });

    it("throws for oauth2 without refresh_token", () => {
      const config = createMinimalConfig({
        llm_providers: [createProvider()],
        accounts: [createAccount({
          imap: {
            host: "imap.gmail.com",
            port: 993,
            tls: "tls",
            auth: "oauth2",
            username: "test@gmail.com",
            oauth_client_id: "client-id",
            oauth_client_secret: "client-secret",
          },
        })],
      });
      expect(() => validateConfig(config)).toThrow("uses OAuth2 but no refresh_token is provided");
    });
  });

  describe("prompt validation", () => {
    it("throws when account has both prompt_file and prompt_override", () => {
      const config = createMinimalConfig({
        llm_providers: [createProvider()],
        accounts: [createAccount({
          prompt_file: "/path/to/prompt.txt",
          prompt_override: "Custom prompt",
        })],
      });
      expect(() => validateConfig(config)).toThrow("has both prompt_override and prompt_file - use only one");
    });

    it("allows account with only prompt_override", () => {
      const config = createMinimalConfig({
        llm_providers: [createProvider()],
        accounts: [createAccount({
          prompt_override: "Custom prompt",
        })],
      });
      expect(() => validateConfig(config)).not.toThrow();
    });

    it("throws when both default_prompt and default_prompt_file specified", () => {
      const config = createMinimalConfig({
        llm_providers: [createProvider()],
        accounts: [createAccount()],
        default_prompt: "Default prompt",
        default_prompt_file: "/path/to/prompt.txt",
      });
      expect(() => validateConfig(config)).toThrow("Both default_prompt and default_prompt_file specified");
    });
  });

  describe("backlog validation", () => {
    it("allows backlog mode new_only without extra fields", () => {
      const config = createMinimalConfig({
        llm_providers: [createProvider()],
        accounts: [createAccount()],
        backlog: { mode: "new_only" },
      });
      expect(() => validateConfig(config)).not.toThrow();
    });

    it("allows backlog mode all without extra fields", () => {
      const config = createMinimalConfig({
        llm_providers: [createProvider()],
        accounts: [createAccount()],
        backlog: { mode: "all" },
      });
      expect(() => validateConfig(config)).not.toThrow();
    });

    it("allows backlog mode recent_count with count", () => {
      const config = createMinimalConfig({
        llm_providers: [createProvider()],
        accounts: [createAccount()],
        backlog: { mode: "recent_count", count: 100 },
      });
      expect(() => validateConfig(config)).not.toThrow();
    });

    it("throws for recent_count without count", () => {
      const config = createMinimalConfig({
        llm_providers: [createProvider()],
        accounts: [createAccount()],
        backlog: { mode: "recent_count" } as BacklogConfig,
      });
      expect(() => validateConfig(config)).toThrow("Backlog mode 'recent_count' requires 'count' field");
    });

    it("allows backlog mode recent_days with age", () => {
      const config = createMinimalConfig({
        llm_providers: [createProvider()],
        accounts: [createAccount()],
        backlog: { mode: "recent_days", age: "7d" },
      });
      expect(() => validateConfig(config)).not.toThrow();
    });

    it("throws for recent_days without age", () => {
      const config = createMinimalConfig({
        llm_providers: [createProvider()],
        accounts: [createAccount()],
        backlog: { mode: "recent_days" } as BacklogConfig,
      });
      expect(() => validateConfig(config)).toThrow("Backlog mode 'recent_days' requires 'age' field");
    });
  });

  describe("multiple accounts", () => {
    it("validates all accounts", () => {
      const config = createMinimalConfig({
        llm_providers: [createProvider({ name: "openai" })],
        accounts: [
          createAccount({ name: "account1" }),
          createAccount({
            name: "account2",
            imap: {
              host: "imap.example.com",
              port: 993,
              tls: "tls",
              auth: "basic",
              username: "test@example.com",
              password: undefined,
            },
          }),
        ],
      });
      expect(() => validateConfig(config)).toThrow('Account "account2" uses basic auth but no password is provided');
    });
  });
});

describe("Environment Variable Resolution", () => {
  const ENV_VAR_PATTERN = /\$\{([^}]+)\}/;

  function resolveEnvVars(value: string): string {
    return value.replace(/\$\{([^}]+)\}/g, (_, varName: string) => {
      const envValue = process.env[varName];
      if (envValue === undefined) {
        throw new Error(`Environment variable ${varName} is not set`);
      }
      return envValue;
    });
  }

  function resolveEnvVarsInObject(obj: unknown): unknown {
    if (typeof obj === "string") {
      if (ENV_VAR_PATTERN.test(obj)) {
        return resolveEnvVars(obj);
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => resolveEnvVarsInObject(item));
    }

    if (obj !== null && typeof obj === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = resolveEnvVarsInObject(value);
      }
      return result;
    }

    return obj;
  }

  beforeEach(() => {
    process.env.TEST_VAR = "test_value";
    process.env.TEST_API_KEY = "sk-test123";
  });

  afterEach(() => {
    delete process.env.TEST_VAR;
    delete process.env.TEST_API_KEY;
  });

  describe("string resolution", () => {
    it("resolves single env var in string", () => {
      const result = resolveEnvVarsInObject("${TEST_VAR}");
      expect(result).toBe("test_value");
    });

    it("resolves env var embedded in string", () => {
      const result = resolveEnvVarsInObject("prefix_${TEST_VAR}_suffix");
      expect(result).toBe("prefix_test_value_suffix");
    });

    it("returns string unchanged if no env var pattern", () => {
      const result = resolveEnvVarsInObject("plain string");
      expect(result).toBe("plain string");
    });

    it("throws for missing env var", () => {
      expect(() => resolveEnvVarsInObject("${MISSING_VAR}")).toThrow(
        "Environment variable MISSING_VAR is not set"
      );
    });
  });

  describe("object resolution", () => {
    it("resolves env vars in nested objects", () => {
      const obj = {
        api_key: "${TEST_API_KEY}",
        nested: {
          value: "${TEST_VAR}",
        },
      };
      const result = resolveEnvVarsInObject(obj);
      expect(result).toEqual({
        api_key: "sk-test123",
        nested: {
          value: "test_value",
        },
      });
    });

    it("preserves non-string values", () => {
      const obj = {
        port: 993,
        enabled: true,
        items: null,
      };
      const result = resolveEnvVarsInObject(obj);
      expect(result).toEqual(obj);
    });
  });

  describe("array resolution", () => {
    it("resolves env vars in arrays", () => {
      const arr = ["${TEST_VAR}", "plain", "${TEST_API_KEY}"];
      const result = resolveEnvVarsInObject(arr);
      expect(result).toEqual(["test_value", "plain", "sk-test123"]);
    });

    it("resolves env vars in nested arrays", () => {
      const obj = {
        items: [
          { key: "${TEST_VAR}" },
          { key: "plain" },
        ],
      };
      const result = resolveEnvVarsInObject(obj);
      expect(result).toEqual({
        items: [
          { key: "test_value" },
          { key: "plain" },
        ],
      });
    });
  });

  describe("edge cases", () => {
    it("handles null", () => {
      expect(resolveEnvVarsInObject(null)).toBe(null);
    });

    it("handles undefined", () => {
      expect(resolveEnvVarsInObject(undefined)).toBe(undefined);
    });

    it("handles numbers", () => {
      expect(resolveEnvVarsInObject(42)).toBe(42);
    });

    it("handles booleans", () => {
      expect(resolveEnvVarsInObject(true)).toBe(true);
      expect(resolveEnvVarsInObject(false)).toBe(false);
    });

    it("handles empty object", () => {
      expect(resolveEnvVarsInObject({})).toEqual({});
    });

    it("handles empty array", () => {
      expect(resolveEnvVarsInObject([])).toEqual([]);
    });

    it("handles deeply nested structures", () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              value: "${TEST_VAR}",
            },
          },
        },
      };
      const result = resolveEnvVarsInObject(obj) as { level1: { level2: { level3: { value: string } } } };
      expect(result.level1.level2.level3.value).toBe("test_value");
    });
  });
});

describe("Prompt Loading Logic", () => {
  function loadPrompt(config: Config, accountName?: string, readFile?: (path: string) => string): string {
    if (accountName) {
      const account = config.accounts.find((a) => a.name === accountName);
      if (account?.prompt_override) {
        return account.prompt_override;
      }
      if (account?.prompt_file && readFile) {
        return readFile(account.prompt_file);
      }
    }

    if (config.default_prompt) {
      return config.default_prompt;
    }

    if (config.default_prompt_file && readFile) {
      return readFile(config.default_prompt_file);
    }

    return "DEFAULT_PROMPT";
  }

  it("returns account prompt_override when specified", () => {
    const config = createMinimalConfig({
      accounts: [createAccount({ name: "test", prompt_override: "Account prompt" })],
    });
    expect(loadPrompt(config, "test")).toBe("Account prompt");
  });

  it("reads account prompt_file when specified", () => {
    const config = createMinimalConfig({
      accounts: [createAccount({ name: "test", prompt_file: "/path/to/prompt.txt" })],
    });
    const readFile = vi.fn().mockReturnValue("File content");
    expect(loadPrompt(config, "test", readFile)).toBe("File content");
    expect(readFile).toHaveBeenCalledWith("/path/to/prompt.txt");
  });

  it("returns default_prompt when no account specified", () => {
    const config = createMinimalConfig({
      default_prompt: "Default prompt",
    });
    expect(loadPrompt(config)).toBe("Default prompt");
  });

  it("reads default_prompt_file when specified", () => {
    const config = createMinimalConfig({
      default_prompt_file: "/path/to/default.txt",
    });
    const readFile = vi.fn().mockReturnValue("Default file content");
    expect(loadPrompt(config, undefined, readFile)).toBe("Default file content");
    expect(readFile).toHaveBeenCalledWith("/path/to/default.txt");
  });

  it("falls back to default when account has no custom prompt", () => {
    const config = createMinimalConfig({
      default_prompt: "Default prompt",
      accounts: [createAccount({ name: "test" })],
    });
    expect(loadPrompt(config, "test")).toBe("Default prompt");
  });

  it("falls back to builtin when no prompts configured", () => {
    const config = createMinimalConfig({
      accounts: [createAccount({ name: "test" })],
    });
    expect(loadPrompt(config, "test")).toBe("DEFAULT_PROMPT");
  });

  it("falls back to builtin when account not found", () => {
    const config = createMinimalConfig({
      accounts: [createAccount({ name: "other" })],
    });
    expect(loadPrompt(config, "nonexistent")).toBe("DEFAULT_PROMPT");
  });

  it("prioritizes account prompt over default", () => {
    const config = createMinimalConfig({
      default_prompt: "Default prompt",
      accounts: [createAccount({ name: "test", prompt_override: "Account prompt" })],
    });
    expect(loadPrompt(config, "test")).toBe("Account prompt");
  });
});
