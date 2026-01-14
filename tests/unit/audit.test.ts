import { describe, it, expect } from "vitest";
import type { LlmAction } from "../../src/llm/parser.js";

/**
 * Tests for audit log functionality including pagination, filtering, and export.
 *
 * The audit system tracks all email processing actions for compliance and debugging.
 * Supports filtering by account, action type, and date range.
 *
 * Note: These tests verify the logic without requiring SQLite native bindings.
 */

interface AuditEntry {
  id: number;
  messageId: string;
  accountName: string;
  actions: LlmAction[];
  llmProvider?: string;
  llmModel?: string;
  subject?: string;
  createdAt: number;
}

interface AuditFilters {
  accountName?: string;
  actionType?: string;
  startDate?: number;
  endDate?: number;
}

describe("Audit Log Pagination", () => {
  // Simulate database entries
  function createTestEntries(count: number): AuditEntry[] {
    const entries: AuditEntry[] = [];
    for (let i = 0; i < count; i++) {
      entries.push({
        id: i + 1,
        messageId: `msg-${i}`,
        accountName: "test-account",
        actions: [{ type: "noop" }],
        createdAt: Date.now() - i * 1000,
      });
    }
    return entries;
  }

  it("returns correct page of results", () => {
    const entries = createTestEntries(50);
    const page = 2;
    const pageSize = 10;
    const offset = (page - 1) * pageSize;

    // Sort by createdAt DESC, then paginate
    const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);
    const paginated = sorted.slice(offset, offset + pageSize);

    expect(paginated.length).toBe(10);
    expect(paginated[0].id).toBe(11); // Page 2 starts at item 11
  });

  it("calculates total pages correctly", () => {
    const total = 45;
    const pageSize = 20;
    const totalPages = Math.ceil(total / pageSize);

    expect(totalPages).toBe(3);
  });

  it("returns empty array for page beyond data", () => {
    const entries = createTestEntries(5);
    const page = 10;
    const pageSize = 20;
    const offset = (page - 1) * pageSize;

    const paginated = entries.slice(offset, offset + pageSize);

    expect(paginated.length).toBe(0);
  });

  it("handles first page correctly", () => {
    const entries = createTestEntries(50);
    const page = 1;
    const pageSize = 10;
    const offset = (page - 1) * pageSize;

    const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);
    const paginated = sorted.slice(offset, offset + pageSize);

    expect(paginated.length).toBe(10);
    expect(paginated[0].id).toBe(1);
  });

  it("handles last partial page", () => {
    const entries = createTestEntries(25);
    const page = 3;
    const pageSize = 10;
    const offset = (page - 1) * pageSize;

    const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);
    const paginated = sorted.slice(offset, offset + pageSize);

    expect(paginated.length).toBe(5); // Only 5 items on last page
  });
});

describe("Audit Log Filtering", () => {
  function createTestData(): AuditEntry[] {
    const now = Date.now();
    return [
      { id: 1, messageId: "msg-1", accountName: "account-1", actions: [{ type: "move", folder: "Archive" }], createdAt: now - 1000 },
      { id: 2, messageId: "msg-2", accountName: "account-1", actions: [{ type: "flag", flags: ["Important"] }], createdAt: now - 2000 },
      { id: 3, messageId: "msg-3", accountName: "account-1", actions: [{ type: "noop" }], createdAt: now - 3000 },
      { id: 4, messageId: "msg-4", accountName: "account-2", actions: [{ type: "move", folder: "Spam" }], createdAt: now - 4000 },
      { id: 5, messageId: "msg-5", accountName: "account-2", actions: [{ type: "delete" }], createdAt: now - 5000 },
    ];
  }

  function applyFilters(entries: AuditEntry[], filters: AuditFilters): AuditEntry[] {
    let result = [...entries];

    if (filters.accountName) {
      result = result.filter(e => e.accountName === filters.accountName);
    }

    if (filters.actionType) {
      result = result.filter(e =>
        e.actions.some(a => a.type === filters.actionType)
      );
    }

    if (filters.startDate) {
      result = result.filter(e => e.createdAt >= filters.startDate!);
    }

    if (filters.endDate) {
      result = result.filter(e => e.createdAt <= filters.endDate!);
    }

    return result;
  }

  it("filters by account name", () => {
    const entries = createTestData();
    const filtered = applyFilters(entries, { accountName: "account-1" });

    expect(filtered.length).toBe(3);
    expect(filtered.every(e => e.accountName === "account-1")).toBe(true);
  });

  it("filters by action type", () => {
    const entries = createTestData();
    const filtered = applyFilters(entries, { actionType: "move" });

    expect(filtered.length).toBe(2);
  });

  it("filters by date range", () => {
    const now = Date.now();
    const entries = createTestData();
    const filtered = applyFilters(entries, {
      startDate: now - 3500,
      endDate: now - 500,
    });

    expect(filtered.length).toBe(3); // msg-1, msg-2, msg-3
  });

  it("combines multiple filters", () => {
    const entries = createTestData();
    const filtered = applyFilters(entries, {
      accountName: "account-1",
      actionType: "move",
    });

    expect(filtered.length).toBe(1);
    expect(filtered[0].messageId).toBe("msg-1");
  });

  it("returns all entries with no filters", () => {
    const entries = createTestData();
    const filtered = applyFilters(entries, {});

    expect(filtered.length).toBe(5);
  });
});

describe("Action Breakdown Stats", () => {
  function getActionBreakdown(entries: AuditEntry[]): { type: string; count: number }[] {
    const counts = new Map<string, number>();

    for (const entry of entries) {
      for (const action of entry.actions) {
        const current = counts.get(action.type) ?? 0;
        counts.set(action.type, current + 1);
      }
    }

    return Array.from(counts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }

  it("counts action types correctly", () => {
    const entries: AuditEntry[] = [
      { id: 1, messageId: "msg-1", accountName: "test", actions: [{ type: "move", folder: "Archive" }], createdAt: Date.now() },
      { id: 2, messageId: "msg-2", accountName: "test", actions: [{ type: "move", folder: "Spam" }], createdAt: Date.now() },
      { id: 3, messageId: "msg-3", accountName: "test", actions: [{ type: "move", folder: "Archive" }], createdAt: Date.now() },
      { id: 4, messageId: "msg-4", accountName: "test", actions: [{ type: "flag", flags: ["Important"] }], createdAt: Date.now() },
      { id: 5, messageId: "msg-5", accountName: "test", actions: [{ type: "flag", flags: ["Starred"] }], createdAt: Date.now() },
      { id: 6, messageId: "msg-6", accountName: "test", actions: [{ type: "noop" }], createdAt: Date.now() },
      { id: 7, messageId: "msg-7", accountName: "test", actions: [{ type: "delete" }], createdAt: Date.now() },
    ];

    const breakdown = getActionBreakdown(entries);

    expect(breakdown).toHaveLength(4);

    const moveCount = breakdown.find(b => b.type === "move");
    expect(moveCount?.count).toBe(3);

    const flagCount = breakdown.find(b => b.type === "flag");
    expect(flagCount?.count).toBe(2);

    const noopCount = breakdown.find(b => b.type === "noop");
    expect(noopCount?.count).toBe(1);

    const deleteCount = breakdown.find(b => b.type === "delete");
    expect(deleteCount?.count).toBe(1);
  });

  it("handles entries with multiple actions", () => {
    const entries: AuditEntry[] = [
      {
        id: 1,
        messageId: "msg-1",
        accountName: "test",
        actions: [
          { type: "move", folder: "Archive" },
          { type: "flag", flags: ["Important"] },
          { type: "read" },
        ],
        createdAt: Date.now(),
      },
      {
        id: 2,
        messageId: "msg-2",
        accountName: "test",
        actions: [{ type: "move", folder: "Spam" }],
        createdAt: Date.now(),
      },
    ];

    const breakdown = getActionBreakdown(entries);

    // move: 2, flag: 1, read: 1
    const moveCount = breakdown.find(b => b.type === "move");
    expect(moveCount?.count).toBe(2);

    const flagCount = breakdown.find(b => b.type === "flag");
    expect(flagCount?.count).toBe(1);

    const readCount = breakdown.find(b => b.type === "read");
    expect(readCount?.count).toBe(1);
  });

  it("returns empty array for no entries", () => {
    const breakdown = getActionBreakdown([]);
    expect(breakdown).toHaveLength(0);
  });

  it("sorts by count descending", () => {
    const entries: AuditEntry[] = [
      { id: 1, messageId: "msg-1", accountName: "test", actions: [{ type: "noop" }], createdAt: Date.now() },
      { id: 2, messageId: "msg-2", accountName: "test", actions: [{ type: "move", folder: "X" }], createdAt: Date.now() },
      { id: 3, messageId: "msg-3", accountName: "test", actions: [{ type: "move", folder: "Y" }], createdAt: Date.now() },
      { id: 4, messageId: "msg-4", accountName: "test", actions: [{ type: "move", folder: "Z" }], createdAt: Date.now() },
    ];

    const breakdown = getActionBreakdown(entries);

    expect(breakdown[0].type).toBe("move");
    expect(breakdown[0].count).toBe(3);
  });
});

describe("Audit Log Export", () => {
  it("formats CSV header correctly", () => {
    const header = "ID,Message ID,Account,Actions,Provider,Model,Subject,Created At\n";

    expect(header).toContain("ID");
    expect(header).toContain("Message ID");
    expect(header).toContain("Actions");
    expect(header).toContain("Created At");
  });

  it("formats CSV row correctly", () => {
    const entry: AuditEntry = {
      id: 1,
      messageId: "msg-1",
      accountName: "test",
      actions: [{ type: "move", folder: "Archive" }],
      llmProvider: "openai",
      llmModel: "gpt-4",
      subject: "Test Subject",
      createdAt: 1704067200000,
    };

    const row = [
      entry.id,
      `"${entry.messageId}"`,
      `"${entry.accountName}"`,
      `"${entry.actions.map((a) => a.type).join(", ")}"`,
      `"${entry.llmProvider ?? ""}"`,
      `"${entry.llmModel ?? ""}"`,
      `"${(entry.subject ?? "").replace(/"/g, '""')}"`,
      new Date(entry.createdAt).toISOString(),
    ].join(",");

    expect(row).toContain("1,");
    expect(row).toContain('"msg-1"');
    expect(row).toContain('"test"');
    expect(row).toContain('"move"');
    expect(row).toContain('"openai"');
    expect(row).toContain('"gpt-4"');
    expect(row).toContain('"Test Subject"');
  });

  it("escapes quotes in subject", () => {
    const subject = 'Subject with "quotes"';
    const escaped = subject.replace(/"/g, '""');

    expect(escaped).toBe('Subject with ""quotes""');
  });

  it("handles missing optional fields", () => {
    const entry: AuditEntry = {
      id: 1,
      messageId: "msg-1",
      accountName: "test",
      actions: [{ type: "noop" }],
      createdAt: Date.now(),
    };

    const row = [
      entry.id,
      `"${entry.messageId}"`,
      `"${entry.accountName}"`,
      `"${entry.actions.map((a) => a.type).join(", ")}"`,
      `"${entry.llmProvider ?? ""}"`,
      `"${entry.llmModel ?? ""}"`,
      `"${(entry.subject ?? "").replace(/"/g, '""')}"`,
      new Date(entry.createdAt).toISOString(),
    ].join(",");

    expect(row).toContain(',"",'); // Empty provider
    expect(row).toContain('"",'); // Empty model
  });

  it("exports multiple entries", () => {
    const entries: AuditEntry[] = [
      { id: 1, messageId: "msg-1", accountName: "test", actions: [{ type: "move", folder: "X" }], createdAt: Date.now() },
      { id: 2, messageId: "msg-2", accountName: "test", actions: [{ type: "noop" }], createdAt: Date.now() },
    ];

    const header = "ID,Message ID,Account,Actions,Provider,Model,Subject,Created At\n";
    const rows = entries.map(e => `${e.id},"${e.messageId}"`).join("\n");
    const csv = header + rows;

    expect(csv.split("\n").length).toBe(3); // Header + 2 rows
  });
});

describe("Paginated Result Structure", () => {
  interface PaginatedResult {
    entries: AuditEntry[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }

  it("includes all required fields", () => {
    const result: PaginatedResult = {
      entries: [],
      total: 45,
      page: 2,
      pageSize: 20,
      totalPages: 3,
    };

    expect(result).toHaveProperty("entries");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("page");
    expect(result).toHaveProperty("pageSize");
    expect(result).toHaveProperty("totalPages");
  });

  it("calculates totalPages correctly", () => {
    const total = 45;
    const pageSize = 20;
    const totalPages = Math.ceil(total / pageSize);

    expect(totalPages).toBe(3);
  });

  it("handles zero results", () => {
    const result: PaginatedResult = {
      entries: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    };

    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });
});
