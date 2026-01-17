import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  configSchema,
  resolveEnvVars,
  actionTypeSchema,
  ALL_ACTION_TYPES,
  DEFAULT_ALLOWED_ACTIONS,
  type ActionType,
  type Config,
  type AccountConfig,
  type ImapConfig,
  type LlmProviderConfig,
} from "../../src/config/schema.js";

describe("Config Schema", () => {
  describe("resolveEnvVars", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("resolves single env var", () => {
      process.env.TEST_VAR = "test_value";
      const result = resolveEnvVars("prefix_${TEST_VAR}_suffix");
      expect(result).toBe("prefix_test_value_suffix");
    });

    it("resolves multiple env vars", () => {
      process.env.VAR1 = "first";
      process.env.VAR2 = "second";
      const result = resolveEnvVars("${VAR1}_${VAR2}");
      expect(result).toBe("first_second");
    });

    it("returns string unchanged if no env vars", () => {
      const result = resolveEnvVars("plain string");
      expect(result).toBe("plain string");
    });

    it("throws for missing env var", () => {
      delete process.env.MISSING_VAR;
      expect(() => resolveEnvVars("${MISSING_VAR}")).toThrow(
        "Environment variable MISSING_VAR is not set"
      );
    });

    it("handles empty string env var", () => {
      process.env.EMPTY_VAR = "";
      const result = resolveEnvVars("${EMPTY_VAR}");
      expect(result).toBe("");
    });

    it("handles env var with special characters", () => {
      process.env.SPECIAL_VAR = "value!@#$%^&*()";
      const result = resolveEnvVars("${SPECIAL_VAR}");
      expect(result).toBe("value!@#$%^&*()");
    });

    it("handles env var with newlines", () => {
      process.env.NEWLINE_VAR = "line1\nline2";
      const result = resolveEnvVars("${NEWLINE_VAR}");
      expect(result).toBe("line1\nline2");
    });

    it("handles nested-looking but not actually nested vars", () => {
      process.env.OUTER = "outer_value";
      const result = resolveEnvVars("${OUTER}");
      expect(result).toBe("outer_value");
    });

    it("handles multiple same env var", () => {
      process.env.REPEAT = "repeated";
      const result = resolveEnvVars("${REPEAT}_${REPEAT}_${REPEAT}");
      expect(result).toBe("repeated_repeated_repeated");
    });

    it("handles env var at start", () => {
      process.env.START = "beginning";
      const result = resolveEnvVars("${START}end");
      expect(result).toBe("beginningend");
    });

    it("handles env var at end", () => {
      process.env.END = "ending";
      const result = resolveEnvVars("start${END}");
      expect(result).toBe("startending");
    });

    it("handles only env var", () => {
      process.env.ONLY = "only_value";
      const result = resolveEnvVars("${ONLY}");
      expect(result).toBe("only_value");
    });

    it("handles underscore in env var name", () => {
      process.env.MY_LONG_VAR_NAME = "value";
      const result = resolveEnvVars("${MY_LONG_VAR_NAME}");
      expect(result).toBe("value");
    });

    it("handles numbers in env var name", () => {
      process.env.VAR123 = "numeric";
      const result = resolveEnvVars("${VAR123}");
      expect(result).toBe("numeric");
    });
  });

  describe("actionTypeSchema", () => {
    it("accepts valid action types", () => {
      const validTypes = ["move", "spam", "flag", "read", "delete", "noop"];
      for (const type of validTypes) {
        const result = actionTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid action types", () => {
      const invalidTypes = ["invalid", "MOVE", "Move", "", "archive", "forward"];
      for (const type of invalidTypes) {
        const result = actionTypeSchema.safeParse(type);
        expect(result.success).toBe(false);
      }
    });
  });

  describe("ALL_ACTION_TYPES", () => {
    it("contains all expected action types", () => {
      expect(ALL_ACTION_TYPES).toContain("move");
      expect(ALL_ACTION_TYPES).toContain("spam");
      expect(ALL_ACTION_TYPES).toContain("flag");
      expect(ALL_ACTION_TYPES).toContain("read");
      expect(ALL_ACTION_TYPES).toContain("delete");
      expect(ALL_ACTION_TYPES).toContain("noop");
    });

    it("has exactly 6 action types", () => {
      expect(ALL_ACTION_TYPES).toHaveLength(6);
    });

    it("is defined as readonly array", () => {
      // TypeScript enforces immutability at compile time via `as const`
      // At runtime, we can verify it's an array with expected values
      expect(Array.isArray(ALL_ACTION_TYPES)).toBe(true);
      expect(ALL_ACTION_TYPES.length).toBe(6);
    });
  });

  describe("DEFAULT_ALLOWED_ACTIONS", () => {
    it("excludes delete for safety", () => {
      expect(DEFAULT_ALLOWED_ACTIONS).not.toContain("delete");
    });

    it("includes safe actions", () => {
      expect(DEFAULT_ALLOWED_ACTIONS).toContain("move");
      expect(DEFAULT_ALLOWED_ACTIONS).toContain("spam");
      expect(DEFAULT_ALLOWED_ACTIONS).toContain("flag");
      expect(DEFAULT_ALLOWED_ACTIONS).toContain("read");
      expect(DEFAULT_ALLOWED_ACTIONS).toContain("noop");
    });

    it("has exactly 5 action types", () => {
      expect(DEFAULT_ALLOWED_ACTIONS).toHaveLength(5);
    });
  });

  describe("configSchema validation", () => {
    it("accepts minimal valid config", () => {
      const config = {
        accounts: [],
      };
      const result = configSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("applies default values", () => {
      const result = configSchema.parse({});
      expect(result.polling_interval).toBe("30s");
      expect(result.concurrency_limit).toBe(5);
      expect(result.dry_run).toBe(false);
      expect(result.accounts).toEqual([]);
    });

    it("validates polling_interval format", () => {
      const validIntervals = ["30s", "5m", "1h", "24h", "7d", "2w", "1y"];
      for (const interval of validIntervals) {
        const result = configSchema.safeParse({ polling_interval: interval });
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid polling_interval", () => {
      const invalidIntervals = ["30", "5 minutes", "1hour", "invalid"];
      for (const interval of invalidIntervals) {
        const result = configSchema.safeParse({ polling_interval: interval });
        expect(result.success).toBe(false);
      }
    });

    it("validates concurrency_limit is positive", () => {
      expect(configSchema.safeParse({ concurrency_limit: 0 }).success).toBe(false);
      expect(configSchema.safeParse({ concurrency_limit: -1 }).success).toBe(false);
      expect(configSchema.safeParse({ concurrency_limit: 1 }).success).toBe(true);
      expect(configSchema.safeParse({ concurrency_limit: 100 }).success).toBe(true);
    });

    it("validates dry_run is boolean", () => {
      expect(configSchema.safeParse({ dry_run: true }).success).toBe(true);
      expect(configSchema.safeParse({ dry_run: false }).success).toBe(true);
      expect(configSchema.safeParse({ dry_run: "true" }).success).toBe(false);
    });
  });

  describe("account config validation", () => {
    const minimalAccount = {
      name: "Test Account",
      imap: {
        host: "imap.example.com",
        username: "user@example.com",
      },
    };

    it("accepts minimal account config", () => {
      const result = configSchema.safeParse({
        accounts: [minimalAccount],
      });
      expect(result.success).toBe(true);
    });

    it("requires account name", () => {
      const result = configSchema.safeParse({
        accounts: [{ ...minimalAccount, name: "" }],
      });
      expect(result.success).toBe(false);
    });

    it("requires imap host", () => {
      const result = configSchema.safeParse({
        accounts: [{ name: "Test", imap: { username: "user" } }],
      });
      expect(result.success).toBe(false);
    });

    it("requires imap username", () => {
      const result = configSchema.safeParse({
        accounts: [{ name: "Test", imap: { host: "imap.example.com" } }],
      });
      expect(result.success).toBe(false);
    });

    it("applies default imap port", () => {
      const result = configSchema.parse({
        accounts: [minimalAccount],
      });
      expect(result.accounts[0].imap.port).toBe(993);
    });

    it("applies default tls mode", () => {
      const result = configSchema.parse({
        accounts: [minimalAccount],
      });
      expect(result.accounts[0].imap.tls).toBe("auto");
    });

    it("applies default auth type", () => {
      const result = configSchema.parse({
        accounts: [minimalAccount],
      });
      expect(result.accounts[0].imap.auth).toBe("basic");
    });

    it("validates tls mode enum", () => {
      const validModes = ["auto", "tls", "starttls", "insecure"];
      for (const mode of validModes) {
        const result = configSchema.safeParse({
          accounts: [{ ...minimalAccount, imap: { ...minimalAccount.imap, tls: mode } }],
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid tls mode", () => {
      const result = configSchema.safeParse({
        accounts: [{ ...minimalAccount, imap: { ...minimalAccount.imap, tls: "invalid" } }],
      });
      expect(result.success).toBe(false);
    });

    it("validates auth type enum", () => {
      expect(
        configSchema.safeParse({
          accounts: [{ ...minimalAccount, imap: { ...minimalAccount.imap, auth: "basic" } }],
        }).success
      ).toBe(true);
      expect(
        configSchema.safeParse({
          accounts: [{ ...minimalAccount, imap: { ...minimalAccount.imap, auth: "oauth2" } }],
        }).success
      ).toBe(true);
    });

    it("validates allowed_actions array", () => {
      const result = configSchema.safeParse({
        accounts: [{ ...minimalAccount, allowed_actions: ["move", "flag"] }],
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid action in allowed_actions", () => {
      const result = configSchema.safeParse({
        accounts: [{ ...minimalAccount, allowed_actions: ["move", "invalid"] }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("llm provider config validation", () => {
    const minimalProvider = {
      name: "Test Provider",
      api_url: "https://api.example.com",
      default_model: "gpt-4",
    };

    it("accepts minimal provider config", () => {
      const result = configSchema.safeParse({
        llm_providers: [minimalProvider],
      });
      expect(result.success).toBe(true);
    });

    it("requires provider name", () => {
      const result = configSchema.safeParse({
        llm_providers: [{ ...minimalProvider, name: "" }],
      });
      expect(result.success).toBe(false);
    });

    it("requires valid api_url", () => {
      const result = configSchema.safeParse({
        llm_providers: [{ ...minimalProvider, api_url: "not-a-url" }],
      });
      expect(result.success).toBe(false);
    });

    it("requires default_model", () => {
      const result = configSchema.safeParse({
        llm_providers: [{ name: "Test", api_url: "https://api.example.com" }],
      });
      expect(result.success).toBe(false);
    });

    it("applies default max_body_tokens", () => {
      const result = configSchema.parse({
        llm_providers: [minimalProvider],
      });
      expect(result.llm_providers[0].max_body_tokens).toBe(4000);
    });

    it("applies default max_thread_tokens", () => {
      const result = configSchema.parse({
        llm_providers: [minimalProvider],
      });
      expect(result.llm_providers[0].max_thread_tokens).toBe(2000);
    });

    it("applies default supports_vision", () => {
      const result = configSchema.parse({
        llm_providers: [minimalProvider],
      });
      expect(result.llm_providers[0].supports_vision).toBe(false);
    });

    it("validates rate_limit_rpm is positive", () => {
      expect(
        configSchema.safeParse({
          llm_providers: [{ ...minimalProvider, rate_limit_rpm: 0 }],
        }).success
      ).toBe(false);
      expect(
        configSchema.safeParse({
          llm_providers: [{ ...minimalProvider, rate_limit_rpm: 60 }],
        }).success
      ).toBe(true);
    });
  });

  describe("webhook config validation", () => {
    const minimalAccount = {
      name: "Test",
      imap: { host: "imap.example.com", username: "user" },
    };

    it("accepts valid webhook config", () => {
      const result = configSchema.safeParse({
        accounts: [
          {
            ...minimalAccount,
            webhooks: [
              {
                url: "https://webhook.example.com",
                events: ["action_taken"],
              },
            ],
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("requires valid webhook URL", () => {
      const result = configSchema.safeParse({
        accounts: [
          {
            ...minimalAccount,
            webhooks: [{ url: "not-a-url", events: ["action_taken"] }],
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("requires at least one event", () => {
      const result = configSchema.safeParse({
        accounts: [
          {
            ...minimalAccount,
            webhooks: [{ url: "https://webhook.example.com", events: [] }],
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("validates webhook events enum", () => {
      const validEvents = ["startup", "shutdown", "error", "action_taken", "connection_lost", "connection_restored"];
      const result = configSchema.safeParse({
        accounts: [
          {
            ...minimalAccount,
            webhooks: [{ url: "https://webhook.example.com", events: validEvents }],
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid webhook event", () => {
      const result = configSchema.safeParse({
        accounts: [
          {
            ...minimalAccount,
            webhooks: [{ url: "https://webhook.example.com", events: ["invalid_event"] }],
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("allows optional headers", () => {
      const result = configSchema.safeParse({
        accounts: [
          {
            ...minimalAccount,
            webhooks: [
              {
                url: "https://webhook.example.com",
                events: ["action_taken"],
                headers: { Authorization: "Bearer token" },
              },
            ],
          },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("state config validation", () => {
    it("state is optional at top level", () => {
      const result = configSchema.parse({});
      expect(result.state).toBeUndefined();
    });

    it("applies default database_path when state is provided", () => {
      const result = configSchema.parse({ state: {} });
      expect(result.state?.database_path).toBe("./data/mailpilot.db");
    });

    it("applies default processed_ttl", () => {
      const result = configSchema.parse({ state: {} });
      expect(result.state?.processed_ttl).toBe("24h");
    });

    it("applies default audit_retention", () => {
      const result = configSchema.parse({ state: {} });
      expect(result.state?.audit_retention).toBe("30d");
    });

    it("validates duration format for ttl", () => {
      expect(configSchema.safeParse({ state: { processed_ttl: "invalid" } }).success).toBe(false);
      expect(configSchema.safeParse({ state: { processed_ttl: "1h" } }).success).toBe(true);
    });
  });

  describe("dashboard config validation", () => {
    it("applies default enabled", () => {
      const result = configSchema.parse({ dashboard: {} });
      expect(result.dashboard?.enabled).toBe(true);
    });

    it("applies default session_ttl", () => {
      const result = configSchema.parse({ dashboard: {} });
      expect(result.dashboard?.session_ttl).toBe("24h");
    });

    it("validates api key permissions", () => {
      const validPermissions = [
        "read:stats",
        "read:activity",
        "read:logs",
        "read:export",
        "read:accounts",
        "read:*",
        "write:stats",
        "write:*",
        "*",
      ];
      const result = configSchema.safeParse({
        dashboard: {
          api_keys: [{ name: "Test", key: "0123456789abcdef", permissions: validPermissions }],
        },
      });
      expect(result.success).toBe(true);
    });

    it("requires api key name", () => {
      const result = configSchema.safeParse({
        dashboard: {
          api_keys: [{ name: "", key: "0123456789abcdef" }],
        },
      });
      expect(result.success).toBe(false);
    });

    it("requires api key to be at least 16 characters", () => {
      const result = configSchema.safeParse({
        dashboard: {
          api_keys: [{ name: "Test", key: "short" }],
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("antivirus config validation", () => {
    it("applies default values", () => {
      const result = configSchema.parse({ antivirus: {} });
      expect(result.antivirus?.enabled).toBe(false);
      expect(result.antivirus?.host).toBe("localhost");
      expect(result.antivirus?.port).toBe(3310);
      expect(result.antivirus?.timeout).toBe("30s");
      expect(result.antivirus?.on_virus_detected).toBe("quarantine");
    });

    it("validates virus action enum", () => {
      expect(configSchema.safeParse({ antivirus: { on_virus_detected: "quarantine" } }).success).toBe(true);
      expect(configSchema.safeParse({ antivirus: { on_virus_detected: "delete" } }).success).toBe(true);
      expect(configSchema.safeParse({ antivirus: { on_virus_detected: "flag_only" } }).success).toBe(true);
      expect(configSchema.safeParse({ antivirus: { on_virus_detected: "invalid" } }).success).toBe(false);
    });
  });

  describe("retry config validation", () => {
    it("applies default values", () => {
      const result = configSchema.parse({ retry: {} });
      expect(result.retry?.enabled).toBe(true);
      expect(result.retry?.max_attempts).toBe(5);
      expect(result.retry?.initial_delay).toBe("5m");
      expect(result.retry?.max_delay).toBe("24h");
      expect(result.retry?.backoff_multiplier).toBe(2);
    });

    it("validates max_attempts range", () => {
      expect(configSchema.safeParse({ retry: { max_attempts: 0 } }).success).toBe(false);
      expect(configSchema.safeParse({ retry: { max_attempts: 11 } }).success).toBe(false);
      expect(configSchema.safeParse({ retry: { max_attempts: 1 } }).success).toBe(true);
      expect(configSchema.safeParse({ retry: { max_attempts: 10 } }).success).toBe(true);
    });

    it("validates backoff_multiplier is positive", () => {
      expect(configSchema.safeParse({ retry: { backoff_multiplier: 0 } }).success).toBe(false);
      expect(configSchema.safeParse({ retry: { backoff_multiplier: -1 } }).success).toBe(false);
      expect(configSchema.safeParse({ retry: { backoff_multiplier: 1.5 } }).success).toBe(true);
    });
  });

  describe("notification config validation", () => {
    it("applies default values", () => {
      const result = configSchema.parse({ notifications: {} });
      expect(result.notifications?.enabled).toBe(true);
      expect(result.notifications?.channels).toEqual(["browser"]);
      expect(result.notifications?.events).toEqual(["error", "connection_lost"]);
    });

    it("validates notification events", () => {
      const validEvents = ["error", "connection_lost", "dead_letter", "retry_exhausted", "daily_summary"];
      const result = configSchema.safeParse({
        notifications: { events: validEvents },
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid notification event", () => {
      const result = configSchema.safeParse({
        notifications: { events: ["invalid_event"] },
      });
      expect(result.success).toBe(false);
    });

    it("validates daily_summary_time format", () => {
      // The regex validates HH:MM format (two digits colon two digits)
      expect(configSchema.safeParse({ notifications: { daily_summary_time: "09:00" } }).success).toBe(true);
      expect(configSchema.safeParse({ notifications: { daily_summary_time: "23:59" } }).success).toBe(true);
      // Single digit hour/minute should fail
      expect(configSchema.safeParse({ notifications: { daily_summary_time: "9:00" } }).success).toBe(false);
      expect(configSchema.safeParse({ notifications: { daily_summary_time: "09:0" } }).success).toBe(false);
      // Invalid format
      expect(configSchema.safeParse({ notifications: { daily_summary_time: "invalid" } }).success).toBe(false);
    });
  });

  describe("confidence config validation", () => {
    it("applies default values", () => {
      const result = configSchema.parse({ confidence: {} });
      expect(result.confidence?.enabled).toBe(false);
      expect(result.confidence?.minimum_threshold).toBe(0.7);
      expect(result.confidence?.request_reasoning).toBe(true);
    });

    it("validates minimum_threshold range", () => {
      expect(configSchema.safeParse({ confidence: { minimum_threshold: -0.1 } }).success).toBe(false);
      expect(configSchema.safeParse({ confidence: { minimum_threshold: 1.1 } }).success).toBe(false);
      expect(configSchema.safeParse({ confidence: { minimum_threshold: 0 } }).success).toBe(true);
      expect(configSchema.safeParse({ confidence: { minimum_threshold: 1 } }).success).toBe(true);
      expect(configSchema.safeParse({ confidence: { minimum_threshold: 0.5 } }).success).toBe(true);
    });

    it("is disabled by default", () => {
      const result = configSchema.parse({ confidence: {} });
      expect(result.confidence?.enabled).toBe(false);
    });
  });

  describe("shutdown config validation", () => {
    it("applies default values", () => {
      const result = configSchema.parse({ shutdown: {} });
      expect(result.shutdown?.timeout).toBe("30s");
      expect(result.shutdown?.wait_for_inflight).toBe(true);
      expect(result.shutdown?.force_after).toBe("25s");
    });

    it("validates duration format", () => {
      expect(configSchema.safeParse({ shutdown: { timeout: "invalid" } }).success).toBe(false);
      expect(configSchema.safeParse({ shutdown: { timeout: "60s" } }).success).toBe(true);
      expect(configSchema.safeParse({ shutdown: { timeout: "5m" } }).success).toBe(true);
    });

    it("accepts custom values", () => {
      const result = configSchema.parse({
        shutdown: {
          timeout: "60s",
          wait_for_inflight: false,
          force_after: "50s",
        },
      });
      expect(result.shutdown?.timeout).toBe("60s");
      expect(result.shutdown?.wait_for_inflight).toBe(false);
      expect(result.shutdown?.force_after).toBe("50s");
    });
  });
});
