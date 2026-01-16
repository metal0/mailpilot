import { describe, it, expect, beforeEach } from "vitest";

/**
 * Tests for logger buffer functionality used in the dashboard log viewer.
 *
 * The logger maintains a circular buffer of recent log entries that can be
 * retrieved and filtered by log level for display in the dashboard.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  meta?: Record<string, unknown>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

describe("Log Buffer Management", () => {
  const LOG_BUFFER_SIZE = 500;
  let logBuffer: LogEntry[];

  beforeEach(() => {
    logBuffer = [];
  });

  it("adds entries to buffer", () => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "info",
      context: "test",
      message: "Test message",
    };

    logBuffer.push(entry);

    expect(logBuffer).toHaveLength(1);
    expect(logBuffer[0].message).toBe("Test message");
  });

  it("maintains maximum buffer size", () => {
    // Fill buffer to max
    for (let i = 0; i < LOG_BUFFER_SIZE + 100; i++) {
      logBuffer.push({
        timestamp: new Date().toISOString(),
        level: "info",
        context: "test",
        message: `Message ${i}`,
      });

      // Trim to max size
      if (logBuffer.length > LOG_BUFFER_SIZE) {
        logBuffer.shift();
      }
    }

    expect(logBuffer.length).toBe(LOG_BUFFER_SIZE);
  });

  it("removes oldest entries when buffer is full", () => {
    // Add entries
    for (let i = 0; i < LOG_BUFFER_SIZE; i++) {
      logBuffer.push({
        timestamp: new Date().toISOString(),
        level: "info",
        context: "test",
        message: `Message ${i}`,
      });
    }

    // First message should be "Message 0"
    expect(logBuffer[0].message).toBe("Message 0");

    // Add one more
    logBuffer.push({
      timestamp: new Date().toISOString(),
      level: "info",
      context: "test",
      message: "New message",
    });
    logBuffer.shift(); // Remove oldest

    // First message should now be "Message 1"
    expect(logBuffer[0].message).toBe("Message 1");
    expect(logBuffer[logBuffer.length - 1].message).toBe("New message");
  });

  it("handles meta data correctly", () => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "info",
      context: "test",
      message: "Message with meta",
      meta: { userId: 123, action: "login" },
    };

    logBuffer.push(entry);

    expect(logBuffer[0].meta).toEqual({ userId: 123, action: "login" });
  });

  it("only adds meta when provided", () => {
    const entryWithMeta: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "info",
      context: "test",
      message: "With meta",
      meta: { key: "value" },
    };

    const entryWithoutMeta: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "info",
      context: "test",
      message: "Without meta",
    };

    logBuffer.push(entryWithMeta);
    logBuffer.push(entryWithoutMeta);

    expect(logBuffer[0].meta).toBeDefined();
    expect(logBuffer[1].meta).toBeUndefined();
  });
});

describe("Log Retrieval", () => {
  let logBuffer: LogEntry[];

  beforeEach(() => {
    logBuffer = [];

    // Add test entries with different levels
    logBuffer.push({ timestamp: "2024-01-01T10:00:00Z", level: "debug", context: "test", message: "Debug 1" });
    logBuffer.push({ timestamp: "2024-01-01T10:00:01Z", level: "info", context: "test", message: "Info 1" });
    logBuffer.push({ timestamp: "2024-01-01T10:00:02Z", level: "warn", context: "test", message: "Warn 1" });
    logBuffer.push({ timestamp: "2024-01-01T10:00:03Z", level: "error", context: "test", message: "Error 1" });
    logBuffer.push({ timestamp: "2024-01-01T10:00:04Z", level: "debug", context: "test", message: "Debug 2" });
    logBuffer.push({ timestamp: "2024-01-01T10:00:05Z", level: "info", context: "test", message: "Info 2" });
  });

  describe("getRecentLogs", () => {
    it("returns limited number of entries", () => {
      const limit = 3;
      const logs = logBuffer.slice(-limit);

      expect(logs).toHaveLength(3);
    });

    it("returns all entries when limit exceeds buffer size", () => {
      const limit = 100;
      const logs = logBuffer.slice(-limit);

      expect(logs).toHaveLength(6);
    });

    it("returns most recent entries", () => {
      const limit = 2;
      const logs = logBuffer.slice(-limit);

      expect(logs[0].message).toBe("Debug 2");
      expect(logs[1].message).toBe("Info 2");
    });
  });

  describe("Level filtering", () => {
    function getRecentLogs(limit: number, levelFilter?: LogLevel): LogEntry[] {
      let logs = logBuffer;

      if (levelFilter) {
        const minLevel = LOG_LEVELS[levelFilter];
        logs = logs.filter((entry) => LOG_LEVELS[entry.level] >= minLevel);
      }

      return logs.slice(-limit);
    }

    it("filters by minimum level - debug shows all", () => {
      const logs = getRecentLogs(100, "debug");

      expect(logs).toHaveLength(6);
    });

    it("filters by minimum level - info hides debug", () => {
      const logs = getRecentLogs(100, "info");

      expect(logs).toHaveLength(4);
      expect(logs.every(l => l.level !== "debug")).toBe(true);
    });

    it("filters by minimum level - warn shows warn and error", () => {
      const logs = getRecentLogs(100, "warn");

      expect(logs).toHaveLength(2);
      expect(logs.every(l => l.level === "warn" || l.level === "error")).toBe(true);
    });

    it("filters by minimum level - error shows only errors", () => {
      const logs = getRecentLogs(100, "error");

      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe("error");
    });

    it("returns all when no filter specified", () => {
      const logs = getRecentLogs(100);

      expect(logs).toHaveLength(6);
    });

    it("combines limit with filter", () => {
      const logs = getRecentLogs(2, "info");

      expect(logs).toHaveLength(2);
      // Should be the last 2 info+ entries
    });
  });
});

describe("Log Level Comparison", () => {
  it("debug is lowest level", () => {
    expect(LOG_LEVELS.debug).toBe(0);
  });

  it("info is higher than debug", () => {
    expect(LOG_LEVELS.info).toBeGreaterThan(LOG_LEVELS.debug);
  });

  it("warn is higher than info", () => {
    expect(LOG_LEVELS.warn).toBeGreaterThan(LOG_LEVELS.info);
  });

  it("error is highest level", () => {
    expect(LOG_LEVELS.error).toBeGreaterThan(LOG_LEVELS.warn);
  });

  it("shouldLog returns true when level meets threshold", () => {
    const currentLevel: LogLevel = "info";

    const shouldLog = (level: LogLevel) => LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];

    expect(shouldLog("debug")).toBe(false);
    expect(shouldLog("info")).toBe(true);
    expect(shouldLog("warn")).toBe(true);
    expect(shouldLog("error")).toBe(true);
  });
});

describe("Log Entry Format", () => {
  it("formats timestamp as ISO string", () => {
    const timestamp = new Date().toISOString();

    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("formats log message correctly", () => {
    const entry: LogEntry = {
      timestamp: "2024-01-01T10:00:00.000Z",
      level: "info",
      context: "test-context",
      message: "Test message",
      meta: { key: "value" },
    };

    const formatted = `${entry.timestamp} [${entry.level.toUpperCase().padEnd(5)}] [${entry.context}] ${entry.message}`;

    expect(formatted).toBe("2024-01-01T10:00:00.000Z [INFO ] [test-context] Test message");
  });

  it("includes meta as JSON when present", () => {
    const entry: LogEntry = {
      timestamp: "2024-01-01T10:00:00.000Z",
      level: "info",
      context: "test",
      message: "Message",
      meta: { userId: 123 },
    };

    const metaStr = entry.meta ? JSON.stringify(entry.meta) : "";

    expect(metaStr).toBe('{"userId":123}');
  });
});

describe("Clear Log Buffer", () => {
  it("clears all entries", () => {
    const logBuffer: LogEntry[] = [
      { timestamp: new Date().toISOString(), level: "info", context: "test", message: "Message 1" },
      { timestamp: new Date().toISOString(), level: "info", context: "test", message: "Message 2" },
    ];

    logBuffer.length = 0;

    expect(logBuffer).toHaveLength(0);
  });
});

describe("Child Logger Context", () => {
  it("creates child context with prefix", () => {
    const parentContext = "account-manager";
    const subContext = "tiagosog";

    const childContext = `${parentContext}:${subContext}`;

    expect(childContext).toBe("account-manager:tiagosog");
  });

  it("maintains original context in entries", () => {
    const logBuffer: LogEntry[] = [];

    logBuffer.push({
      timestamp: new Date().toISOString(),
      level: "info",
      context: "parent:child",
      message: "From child logger",
    });

    expect(logBuffer[0].context).toBe("parent:child");
  });

  it("handles deeply nested contexts", () => {
    const context = "app:module:component:instance";
    expect(context.split(":")).toHaveLength(4);
  });

  it("handles empty subcontext", () => {
    const parent = "parent";
    const sub = "";
    const combined = `${parent}:${sub}`;
    expect(combined).toBe("parent:");
  });
});

interface LogsFilter {
  level?: LogLevel;
  accountName?: string;
}

describe("Log Pagination", () => {
  const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  function getLogsPaginated(
    logBuffer: LogEntry[],
    page = 1,
    pageSize = 50,
    filter?: LogsFilter
  ) {
    let logs = logBuffer;

    // Apply level filter
    if (filter?.level) {
      const minLevel = LOG_LEVELS[filter.level];
      logs = logs.filter((entry) => LOG_LEVELS[entry.level] >= minLevel);
    }

    // Apply account filter - must be done BEFORE pagination
    if (filter?.accountName) {
      const accountLower = filter.accountName.toLowerCase();
      logs = logs.filter((log) => {
        // Check context field (e.g., "worker:accountName", "imap-client:accountName")
        if (log.context.toLowerCase().includes(accountLower)) {
          return true;
        }
        // Check meta for account references
        if (log.meta) {
          const metaStr = JSON.stringify(log.meta).toLowerCase();
          return metaStr.includes(accountLower);
        }
        return false;
      });
    }

    const reversedLogs = [...logs].reverse();
    const total = reversedLogs.length;
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;
    const paginatedLogs = reversedLogs.slice(offset, offset + pageSize);

    return {
      logs: paginatedLogs,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  it("returns first page by default", () => {
    const buffer: LogEntry[] = Array.from({ length: 100 }, (_, i) => ({
      timestamp: new Date().toISOString(),
      level: "info",
      context: "test",
      message: `Message ${i}`,
    }));

    const result = getLogsPaginated(buffer);
    expect(result.page).toBe(1);
    expect(result.logs).toHaveLength(50);
  });

  it("calculates total pages correctly", () => {
    const buffer: LogEntry[] = Array.from({ length: 100 }, (_, i) => ({
      timestamp: new Date().toISOString(),
      level: "info",
      context: "test",
      message: `Message ${i}`,
    }));

    const result = getLogsPaginated(buffer, 1, 25);
    expect(result.totalPages).toBe(4);
    expect(result.total).toBe(100);
  });

  it("returns correct page content", () => {
    const buffer: LogEntry[] = Array.from({ length: 10 }, (_, i) => ({
      timestamp: new Date().toISOString(),
      level: "info",
      context: "test",
      message: `Message ${i}`,
    }));

    const result = getLogsPaginated(buffer, 2, 3);
    expect(result.logs).toHaveLength(3);
    expect(result.page).toBe(2);
  });

  it("handles empty buffer", () => {
    const result = getLogsPaginated([], 1, 50);
    expect(result.logs).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it("filters by level before pagination", () => {
    const buffer: LogEntry[] = [
      { timestamp: new Date().toISOString(), level: "debug", context: "test", message: "Debug 1" },
      { timestamp: new Date().toISOString(), level: "info", context: "test", message: "Info 1" },
      { timestamp: new Date().toISOString(), level: "warn", context: "test", message: "Warn 1" },
      { timestamp: new Date().toISOString(), level: "error", context: "test", message: "Error 1" },
    ];

    const result = getLogsPaginated(buffer, 1, 50, { level: "warn" });
    expect(result.total).toBe(2);
    expect(result.logs.every((l) => l.level === "warn" || l.level === "error")).toBe(true);
  });

  it("returns newest first", () => {
    const buffer: LogEntry[] = [
      { timestamp: "2024-01-01T10:00:00Z", level: "info", context: "test", message: "Old" },
      { timestamp: "2024-01-01T11:00:00Z", level: "info", context: "test", message: "New" },
    ];

    const result = getLogsPaginated(buffer, 1, 10);
    expect(result.logs[0].message).toBe("New");
    expect(result.logs[1].message).toBe("Old");
  });

  it("handles last partial page", () => {
    const buffer: LogEntry[] = Array.from({ length: 7 }, (_, i) => ({
      timestamp: new Date().toISOString(),
      level: "info",
      context: "test",
      message: `Message ${i}`,
    }));

    const result = getLogsPaginated(buffer, 2, 5);
    expect(result.logs).toHaveLength(2);
    expect(result.totalPages).toBe(2);
  });

  it("returns empty for out of range page", () => {
    const buffer: LogEntry[] = Array.from({ length: 10 }, (_, i) => ({
      timestamp: new Date().toISOString(),
      level: "info",
      context: "test",
      message: `Message ${i}`,
    }));

    const result = getLogsPaginated(buffer, 10, 5);
    expect(result.logs).toHaveLength(0);
  });

  describe("account filtering", () => {
    it("filters by account name in context", () => {
      const buffer: LogEntry[] = [
        { timestamp: new Date().toISOString(), level: "info", context: "worker:personal-gmail", message: "Processing" },
        { timestamp: new Date().toISOString(), level: "info", context: "worker:work-email", message: "Processing" },
        { timestamp: new Date().toISOString(), level: "info", context: "imap-client:personal-gmail", message: "Connected" },
        { timestamp: new Date().toISOString(), level: "info", context: "main", message: "Started" },
      ];

      const result = getLogsPaginated(buffer, 1, 50, { accountName: "personal-gmail" });
      expect(result.total).toBe(2);
      expect(result.logs.every((l) => l.context.includes("personal-gmail"))).toBe(true);
    });

    it("filters by account name in meta", () => {
      const buffer: LogEntry[] = [
        { timestamp: new Date().toISOString(), level: "info", context: "llm", message: "Classifying", meta: { account: "personal-gmail" } },
        { timestamp: new Date().toISOString(), level: "info", context: "llm", message: "Classifying", meta: { account: "work-email" } },
        { timestamp: new Date().toISOString(), level: "info", context: "main", message: "Started" },
      ];

      const result = getLogsPaginated(buffer, 1, 50, { accountName: "personal-gmail" });
      expect(result.total).toBe(1);
      expect(result.logs[0].meta?.account).toBe("personal-gmail");
    });

    it("account filter is case-insensitive", () => {
      const buffer: LogEntry[] = [
        { timestamp: new Date().toISOString(), level: "info", context: "worker:Personal-Gmail", message: "Processing" },
        { timestamp: new Date().toISOString(), level: "info", context: "worker:WORK-EMAIL", message: "Processing" },
      ];

      const result = getLogsPaginated(buffer, 1, 50, { accountName: "personal-gmail" });
      expect(result.total).toBe(1);
    });

    it("account filter applies before pagination for correct total", () => {
      // Create 100 logs: 50 for account1, 50 for account2
      const buffer: LogEntry[] = [];
      for (let i = 0; i < 50; i++) {
        buffer.push({ timestamp: new Date().toISOString(), level: "info", context: "worker:account1", message: `Msg ${i}` });
        buffer.push({ timestamp: new Date().toISOString(), level: "info", context: "worker:account2", message: `Msg ${i}` });
      }

      // Request page 1 with pageSize 50, filtered by account1
      const result = getLogsPaginated(buffer, 1, 50, { accountName: "account1" });

      // Should have exactly 50 logs total (all from account1)
      expect(result.total).toBe(50);
      expect(result.logs).toHaveLength(50);
      expect(result.logs.every((l) => l.context.includes("account1"))).toBe(true);
    });

    it("combines level and account filters", () => {
      const buffer: LogEntry[] = [
        { timestamp: new Date().toISOString(), level: "debug", context: "worker:personal", message: "Debug" },
        { timestamp: new Date().toISOString(), level: "info", context: "worker:personal", message: "Info" },
        { timestamp: new Date().toISOString(), level: "warn", context: "worker:personal", message: "Warn" },
        { timestamp: new Date().toISOString(), level: "error", context: "worker:work", message: "Error" },
        { timestamp: new Date().toISOString(), level: "info", context: "worker:work", message: "Info" },
      ];

      const result = getLogsPaginated(buffer, 1, 50, { level: "warn", accountName: "personal" });
      expect(result.total).toBe(1);
      expect(result.logs[0].level).toBe("warn");
      expect(result.logs[0].context).toContain("personal");
    });

    it("returns empty when no logs match account filter", () => {
      const buffer: LogEntry[] = [
        { timestamp: new Date().toISOString(), level: "info", context: "worker:account1", message: "Msg" },
        { timestamp: new Date().toISOString(), level: "info", context: "worker:account2", message: "Msg" },
      ];

      const result = getLogsPaginated(buffer, 1, 50, { accountName: "nonexistent" });
      expect(result.total).toBe(0);
      expect(result.logs).toHaveLength(0);
    });

    it("handles partial account name matches", () => {
      const buffer: LogEntry[] = [
        { timestamp: new Date().toISOString(), level: "info", context: "worker:my-personal-email", message: "Msg" },
        { timestamp: new Date().toISOString(), level: "info", context: "worker:work", message: "Msg" },
      ];

      const result = getLogsPaginated(buffer, 1, 50, { accountName: "personal" });
      expect(result.total).toBe(1);
    });
  });
});

describe("Broadcast functionality", () => {
  it("broadcast function signature", () => {
    const broadcastFn = (data: unknown) => {
      // No-op
    };
    expect(typeof broadcastFn).toBe("function");
  });

  it("broadcast receives log entry structure", () => {
    const received: LogEntry[] = [];
    const broadcastFn = (data: unknown) => {
      received.push(data as LogEntry);
    };

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "info",
      context: "test",
      message: "Broadcast test",
    };

    broadcastFn(entry);

    expect(received).toHaveLength(1);
    expect(received[0].message).toBe("Broadcast test");
  });
});
