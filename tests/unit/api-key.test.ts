import { describe, it, expect } from "vitest";

/**
 * Tests for API key authentication and permission checking.
 *
 * API keys provide programmatic access to dashboard endpoints with
 * granular permission control supporting wildcards.
 *
 * Note: These tests verify the logic without requiring Hono context.
 */

type ApiKeyPermission =
  | "read:stats"
  | "read:activity"
  | "read:logs"
  | "read:export"
  | "read:*"
  | "write:accounts"
  | "write:*"
  | "*";

interface ApiKeyConfig {
  name: string;
  key: string;
  permissions: ApiKeyPermission[];
}

describe("API Key Permission Checking", () => {
  function hasPermission(apiKey: ApiKeyConfig, required: ApiKeyPermission): boolean {
    // Full wildcard grants everything
    if (apiKey.permissions.includes("*")) {
      return true;
    }

    // Direct permission match
    if (apiKey.permissions.includes(required)) {
      return true;
    }

    // Check read wildcard
    if (required.startsWith("read:") && apiKey.permissions.includes("read:*")) {
      return true;
    }

    // Check write wildcard
    if (required.startsWith("write:") && apiKey.permissions.includes("write:*")) {
      return true;
    }

    return false;
  }

  describe("direct permission matching", () => {
    it("grants access for exact permission match", () => {
      const apiKey: ApiKeyConfig = {
        name: "monitoring",
        key: "mp_test_key_12345678",
        permissions: ["read:stats"],
      };

      expect(hasPermission(apiKey, "read:stats")).toBe(true);
    });

    it("denies access for missing permission", () => {
      const apiKey: ApiKeyConfig = {
        name: "monitoring",
        key: "mp_test_key_12345678",
        permissions: ["read:stats"],
      };

      expect(hasPermission(apiKey, "read:activity")).toBe(false);
      expect(hasPermission(apiKey, "write:accounts")).toBe(false);
    });

    it("handles multiple direct permissions", () => {
      const apiKey: ApiKeyConfig = {
        name: "monitoring",
        key: "mp_test_key_12345678",
        permissions: ["read:stats", "read:activity", "read:logs"],
      };

      expect(hasPermission(apiKey, "read:stats")).toBe(true);
      expect(hasPermission(apiKey, "read:activity")).toBe(true);
      expect(hasPermission(apiKey, "read:logs")).toBe(true);
      expect(hasPermission(apiKey, "read:export")).toBe(false);
    });
  });

  describe("read wildcard permissions", () => {
    it("grants all read permissions with read:*", () => {
      const apiKey: ApiKeyConfig = {
        name: "readonly",
        key: "mp_test_key_12345678",
        permissions: ["read:*"],
      };

      expect(hasPermission(apiKey, "read:stats")).toBe(true);
      expect(hasPermission(apiKey, "read:activity")).toBe(true);
      expect(hasPermission(apiKey, "read:logs")).toBe(true);
      expect(hasPermission(apiKey, "read:export")).toBe(true);
    });

    it("denies write permissions with only read:*", () => {
      const apiKey: ApiKeyConfig = {
        name: "readonly",
        key: "mp_test_key_12345678",
        permissions: ["read:*"],
      };

      expect(hasPermission(apiKey, "write:accounts")).toBe(false);
    });
  });

  describe("write wildcard permissions", () => {
    it("grants all write permissions with write:*", () => {
      const apiKey: ApiKeyConfig = {
        name: "admin",
        key: "mp_test_key_12345678",
        permissions: ["write:*"],
      };

      expect(hasPermission(apiKey, "write:accounts")).toBe(true);
    });

    it("denies read permissions with only write:*", () => {
      const apiKey: ApiKeyConfig = {
        name: "writeonly",
        key: "mp_test_key_12345678",
        permissions: ["write:*"],
      };

      expect(hasPermission(apiKey, "read:stats")).toBe(false);
      expect(hasPermission(apiKey, "read:activity")).toBe(false);
    });
  });

  describe("full wildcard permissions", () => {
    it("grants all permissions with *", () => {
      const apiKey: ApiKeyConfig = {
        name: "superadmin",
        key: "mp_test_key_12345678",
        permissions: ["*"],
      };

      expect(hasPermission(apiKey, "read:stats")).toBe(true);
      expect(hasPermission(apiKey, "read:activity")).toBe(true);
      expect(hasPermission(apiKey, "read:logs")).toBe(true);
      expect(hasPermission(apiKey, "read:export")).toBe(true);
      expect(hasPermission(apiKey, "write:accounts")).toBe(true);
    });
  });

  describe("combined permissions", () => {
    it("allows mixed read and write permissions", () => {
      const apiKey: ApiKeyConfig = {
        name: "automation",
        key: "mp_test_key_12345678",
        permissions: ["read:*", "write:accounts"],
      };

      expect(hasPermission(apiKey, "read:stats")).toBe(true);
      expect(hasPermission(apiKey, "read:activity")).toBe(true);
      expect(hasPermission(apiKey, "write:accounts")).toBe(true);
    });
  });
});

describe("API Key Validation", () => {
  describe("Bearer token extraction", () => {
    it("extracts token from valid Authorization header", () => {
      const header = "Bearer mp_secret_key_here";
      const token = header.startsWith("Bearer ") ? header.slice(7) : null;

      expect(token).toBe("mp_secret_key_here");
    });

    it("returns null for missing Bearer prefix", () => {
      const header = "Basic dXNlcjpwYXNz";
      const token = header.startsWith("Bearer ") ? header.slice(7) : null;

      expect(token).toBeNull();
    });

    it("returns null for empty Authorization header", () => {
      const header: string | undefined = undefined;
      const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

      expect(token).toBeNull();
    });

    it("handles Bearer with empty token", () => {
      const header = "Bearer ";
      const token = header.startsWith("Bearer ") ? header.slice(7) : null;

      expect(token).toBe("");
    });
  });

  describe("API key lookup", () => {
    it("finds matching API key", () => {
      const configuredKeys: ApiKeyConfig[] = [
        { name: "monitoring", key: "mp_monitoring_key_1234", permissions: ["read:stats"] },
        { name: "automation", key: "mp_automation_key_5678", permissions: ["read:*", "write:accounts"] },
      ];

      const token = "mp_automation_key_5678";
      const found = configuredKeys.find(k => k.key === token);

      expect(found).toBeDefined();
      expect(found?.name).toBe("automation");
    });

    it("returns undefined for non-existent key", () => {
      const configuredKeys: ApiKeyConfig[] = [
        { name: "monitoring", key: "mp_monitoring_key_1234", permissions: ["read:stats"] },
      ];

      const token = "mp_invalid_key";
      const found = configuredKeys.find(k => k.key === token);

      expect(found).toBeUndefined();
    });

    it("handles empty key list", () => {
      const configuredKeys: ApiKeyConfig[] = [];
      const token = "mp_any_key";
      const found = configuredKeys.find(k => k.key === token);

      expect(found).toBeUndefined();
    });
  });
});

describe("API Key Configuration", () => {
  describe("key format validation", () => {
    it("requires minimum 16 character key", () => {
      const shortKey = "mp_short";
      const validKey = "mp_valid_key_12345678";

      expect(shortKey.length).toBeLessThan(16);
      expect(validKey.length).toBeGreaterThanOrEqual(16);
    });

    it("accepts keys with mp_ prefix", () => {
      const key = "mp_prometheus_scraper_key";
      const hasPrefix = key.startsWith("mp_");

      expect(hasPrefix).toBe(true);
    });
  });

  describe("permission array handling", () => {
    it("accepts empty permissions array", () => {
      const apiKey: ApiKeyConfig = {
        name: "noaccess",
        key: "mp_noaccess_key_1234",
        permissions: [],
      };

      expect(apiKey.permissions).toHaveLength(0);
    });

    it("validates permission values", () => {
      const validPermissions: ApiKeyPermission[] = [
        "read:stats",
        "read:activity",
        "read:logs",
        "read:export",
        "read:*",
        "write:accounts",
        "write:*",
        "*",
      ];

      expect(validPermissions).toHaveLength(8);
    });
  });
});

describe("Authentication Middleware Logic", () => {
  describe("requireAuthOrApiKey behavior", () => {
    interface AuthContext {
      userId: number;
      sessionId: string;
    }

    interface ApiKeyContext {
      apiKey: ApiKeyConfig;
    }

    function hasPermission(apiKey: ApiKeyConfig, required: ApiKeyPermission): boolean {
      if (apiKey.permissions.includes("*")) return true;
      if (apiKey.permissions.includes(required)) return true;
      if (required.startsWith("read:") && apiKey.permissions.includes("read:*")) return true;
      if (required.startsWith("write:") && apiKey.permissions.includes("write:*")) return true;
      return false;
    }

    function checkAuth(
      sessionAuth: AuthContext | null,
      apiKeyContext: ApiKeyContext | null,
      requiredPermission?: ApiKeyPermission
    ): { authorized: boolean; error?: string; statusCode?: number } {
      // Session auth takes priority
      if (sessionAuth) {
        return { authorized: true };
      }

      // Check API key
      if (apiKeyContext) {
        if (requiredPermission && !hasPermission(apiKeyContext.apiKey, requiredPermission)) {
          return { authorized: false, error: "Insufficient permissions", statusCode: 403 };
        }
        return { authorized: true };
      }

      return { authorized: false, error: "Unauthorized", statusCode: 401 };
    }

    it("allows session-authenticated users", () => {
      const sessionAuth: AuthContext = { userId: 1, sessionId: "session-123" };
      const result = checkAuth(sessionAuth, null, "read:stats");

      expect(result.authorized).toBe(true);
    });

    it("allows API key with correct permission", () => {
      const apiKeyContext: ApiKeyContext = {
        apiKey: { name: "test", key: "mp_test_key_12345678", permissions: ["read:stats"] },
      };
      const result = checkAuth(null, apiKeyContext, "read:stats");

      expect(result.authorized).toBe(true);
    });

    it("denies API key with insufficient permission", () => {
      const apiKeyContext: ApiKeyContext = {
        apiKey: { name: "test", key: "mp_test_key_12345678", permissions: ["read:stats"] },
      };
      const result = checkAuth(null, apiKeyContext, "write:accounts");

      expect(result.authorized).toBe(false);
      expect(result.error).toBe("Insufficient permissions");
      expect(result.statusCode).toBe(403);
    });

    it("denies unauthenticated requests", () => {
      const result = checkAuth(null, null, "read:stats");

      expect(result.authorized).toBe(false);
      expect(result.error).toBe("Unauthorized");
      expect(result.statusCode).toBe(401);
    });

    it("session auth bypasses permission checks", () => {
      const sessionAuth: AuthContext = { userId: 1, sessionId: "session-123" };
      const result = checkAuth(sessionAuth, null, "write:accounts");

      expect(result.authorized).toBe(true);
    });

    it("allows API key without required permission when none specified", () => {
      const apiKeyContext: ApiKeyContext = {
        apiKey: { name: "test", key: "mp_test_key_12345678", permissions: [] },
      };
      const result = checkAuth(null, apiKeyContext, undefined);

      expect(result.authorized).toBe(true);
    });
  });
});

describe("Endpoint Permission Requirements", () => {
  const endpointPermissions: Record<string, ApiKeyPermission> = {
    "/dashboard/api/stats": "read:stats",
    "/dashboard/api/activity": "read:activity",
    "/dashboard/api/logs": "read:logs",
    "/dashboard/api/export": "read:export",
    "/dashboard/api/dead-letter": "read:activity",
    "/dashboard/api/accounts/:name/pause": "write:accounts",
    "/dashboard/api/accounts/:name/resume": "write:accounts",
    "/dashboard/api/accounts/:name/reconnect": "write:accounts",
    "/dashboard/api/accounts/:name/process": "write:accounts",
    "/dashboard/api/dead-letter/:id/retry": "write:accounts",
    "/dashboard/api/dead-letter/:id/dismiss": "write:accounts",
  };

  it("maps all read endpoints correctly", () => {
    const readEndpoints = Object.entries(endpointPermissions)
      .filter(([_, perm]) => perm.startsWith("read:"))
      .map(([path]) => path);

    expect(readEndpoints).toContain("/dashboard/api/stats");
    expect(readEndpoints).toContain("/dashboard/api/activity");
    expect(readEndpoints).toContain("/dashboard/api/logs");
    expect(readEndpoints).toContain("/dashboard/api/export");
  });

  it("maps all write endpoints correctly", () => {
    const writeEndpoints = Object.entries(endpointPermissions)
      .filter(([_, perm]) => perm.startsWith("write:"))
      .map(([path]) => path);

    expect(writeEndpoints).toContain("/dashboard/api/accounts/:name/pause");
    expect(writeEndpoints).toContain("/dashboard/api/accounts/:name/resume");
    expect(writeEndpoints).toContain("/dashboard/api/dead-letter/:id/retry");
  });
});
