import { describe, it, expect } from "vitest";
import {
  renderSetupPage,
  renderLoginPage,
  renderDashboard,
} from "../../src/server/templates.js";

describe("Server Templates", () => {
  describe("renderSetupPage", () => {
    it("renders setup page HTML", () => {
      const html = renderSetupPage({ csrfToken: "test-csrf" });

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Mailpilot Setup");
      expect(html).toContain("Create your admin account");
    });

    it("includes CSRF token in form", () => {
      const html = renderSetupPage({ csrfToken: "csrf-token-123" });

      expect(html).toContain('name="_csrf"');
      expect(html).toContain('value="csrf-token-123"');
    });

    it("renders error message when provided", () => {
      const html = renderSetupPage({
        csrfToken: "test",
        error: "Passwords do not match",
      });

      expect(html).toContain("Passwords do not match");
      expect(html).toContain('class="error"');
    });

    it("does not render error section without error", () => {
      const html = renderSetupPage({ csrfToken: "test" });

      expect(html).not.toContain('class="error"');
    });

    it("escapes HTML in error message", () => {
      const html = renderSetupPage({
        csrfToken: "test",
        error: '<script>alert("xss")</script>',
      });

      expect(html).toContain("&lt;script&gt;");
      expect(html).not.toContain("<script>alert");
    });

    it("escapes HTML in CSRF token", () => {
      const html = renderSetupPage({
        csrfToken: '"><script>xss</script>',
      });

      expect(html).toContain("&quot;");
      expect(html).not.toContain('"><script>');
    });

    it("includes username input field", () => {
      const html = renderSetupPage({ csrfToken: "test" });

      expect(html).toContain('name="username"');
      expect(html).toContain("minlength");
    });

    it("includes password input field", () => {
      const html = renderSetupPage({ csrfToken: "test" });

      expect(html).toContain('name="password"');
      expect(html).toContain('type="password"');
    });

    it("includes confirm password field", () => {
      const html = renderSetupPage({ csrfToken: "test" });

      expect(html).toContain('name="confirm"');
    });

    it("form posts to setup endpoint", () => {
      const html = renderSetupPage({ csrfToken: "test" });

      expect(html).toContain('action="/dashboard/setup"');
      expect(html).toContain('method="POST"');
    });
  });

  describe("renderLoginPage", () => {
    it("renders login page HTML", () => {
      const html = renderLoginPage({ csrfToken: "test-csrf" });

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Mailpilot");
      expect(html).toContain("Sign in to your account");
    });

    it("includes CSRF token in form", () => {
      const html = renderLoginPage({ csrfToken: "csrf-login-456" });

      expect(html).toContain('name="_csrf"');
      expect(html).toContain('value="csrf-login-456"');
    });

    it("renders error message when provided", () => {
      const html = renderLoginPage({
        csrfToken: "test",
        error: "Invalid credentials",
      });

      expect(html).toContain("Invalid credentials");
      expect(html).toContain('class="error"');
    });

    it("pre-fills username when provided", () => {
      const html = renderLoginPage({
        csrfToken: "test",
        username: "admin",
      });

      expect(html).toContain('value="admin"');
    });

    it("escapes username in form", () => {
      const html = renderLoginPage({
        csrfToken: "test",
        username: '"><script>alert(1)</script>',
      });

      expect(html).toContain("&quot;");
      expect(html).not.toContain('"><script>');
    });

    it("escapes error message", () => {
      const html = renderLoginPage({
        csrfToken: "test",
        error: '<img src=x onerror=alert(1)>',
      });

      expect(html).toContain("&lt;img");
      expect(html).not.toContain("<img src=x");
    });

    it("form posts to login endpoint", () => {
      const html = renderLoginPage({ csrfToken: "test" });

      expect(html).toContain('action="/dashboard/login"');
      expect(html).toContain('method="POST"');
    });

    it("has empty username by default", () => {
      const html = renderLoginPage({ csrfToken: "test" });

      expect(html).toContain('value=""');
    });
  });

  describe("renderDashboard", () => {
    const basicData = {
      username: "admin",
      uptime: 3600,
      totals: {
        emailsProcessed: 100,
        actionsTaken: 50,
        errors: 2,
      },
      accounts: [],
      recentActivity: [],
    };

    it("renders dashboard HTML", () => {
      const html = renderDashboard(basicData);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Mailpilot Dashboard");
    });

    it("displays username", () => {
      const html = renderDashboard(basicData);

      expect(html).toContain("Logged in as admin");
    });

    it("escapes username", () => {
      const html = renderDashboard({
        ...basicData,
        username: '<script>alert(1)</script>',
      });

      expect(html).toContain("&lt;script&gt;");
      expect(html).not.toContain("<script>alert");
    });

    it("displays uptime in formatted form", () => {
      const html = renderDashboard({
        ...basicData,
        uptime: 90061, // 1d 1h 1m
      });

      expect(html).toContain("1d");
      expect(html).toContain("1h");
      expect(html).toContain("1m");
    });

    it("displays totals", () => {
      const html = renderDashboard(basicData);

      expect(html).toContain("100");
      expect(html).toContain("50");
      expect(html).toContain("2");
    });

    it("formats large numbers with locale", () => {
      const html = renderDashboard({
        ...basicData,
        totals: {
          emailsProcessed: 1000000,
          actionsTaken: 500000,
          errors: 0,
        },
      });

      expect(html).toContain("1,000,000");
    });

    it("renders account rows", () => {
      const html = renderDashboard({
        ...basicData,
        accounts: [
          {
            name: "test@example.com",
            llmProvider: "openai",
            llmModel: "gpt-4",
            connected: true,
            idleSupported: true,
            lastScan: "2024-01-01T12:00:00Z",
            emailsProcessed: 10,
            actionsTaken: 5,
            errors: 0,
            imapHost: "imap.example.com",
            imapPort: 993,
            paused: false,
          },
        ],
      });

      expect(html).toContain("test@example.com");
      expect(html).toContain("openai");
      expect(html).toContain("gpt-4");
      expect(html).toContain("Connected");
      expect(html).toContain("IDLE");
    });

    it("shows disconnected status", () => {
      const html = renderDashboard({
        ...basicData,
        accounts: [
          {
            name: "offline@example.com",
            llmProvider: "test",
            llmModel: "model",
            connected: false,
            idleSupported: false,
            lastScan: null,
            emailsProcessed: 0,
            actionsTaken: 0,
            errors: 0,
            imapHost: "imap.example.com",
            imapPort: 993,
            paused: false,
          },
        ],
      });

      expect(html).toContain("Disconnected");
      expect(html).toContain("status-disconnected");
    });

    it("handles null lastScan", () => {
      const html = renderDashboard({
        ...basicData,
        accounts: [
          {
            name: "new@example.com",
            llmProvider: "test",
            llmModel: "model",
            connected: false,
            idleSupported: false,
            lastScan: null,
            emailsProcessed: 0,
            actionsTaken: 0,
            errors: 0,
            imapHost: "imap.example.com",
            imapPort: 993,
            paused: false,
          },
        ],
      });

      expect(html).toContain("Never");
    });

    it("shows no activity message when empty", () => {
      const html = renderDashboard({
        ...basicData,
        recentActivity: [],
      });

      expect(html).toContain("No activity yet");
    });

    it("renders activity entries", () => {
      const html = renderDashboard({
        ...basicData,
        recentActivity: [
          {
            id: 1,
            accountName: "test@example.com",
            messageId: "<msg123>",
            subject: "Test Subject",
            from: "sender@example.com",
            folder: "INBOX",
            actions: [{ type: "move" as const, folder: "Archive" }],
            createdAt: Date.now(),
          },
        ],
      });

      expect(html).toContain("Test Subject");
      expect(html).toContain("move:Archive");
      expect(html).toContain("badge-move");
    });

    it("escapes subject in activity", () => {
      const html = renderDashboard({
        ...basicData,
        recentActivity: [
          {
            id: 1,
            accountName: "test",
            messageId: "<msg>",
            subject: '<script>alert("xss")</script>',
            from: "sender@example.com",
            folder: "INBOX",
            actions: [{ type: "noop" as const }],
            createdAt: Date.now(),
          },
        ],
      });

      expect(html).toContain("&lt;script&gt;");
      expect(html).not.toContain("<script>alert");
    });

    it("renders flag action with flags", () => {
      const html = renderDashboard({
        ...basicData,
        recentActivity: [
          {
            id: 1,
            accountName: "test",
            messageId: "<msg>",
            subject: "Flagged",
            from: "sender@example.com",
            folder: "INBOX",
            actions: [{ type: "flag" as const, flags: ["\\Seen", "\\Flagged"] }],
            createdAt: Date.now(),
          },
        ],
      });

      expect(html).toContain("flag:\\Seen+\\Flagged");
      expect(html).toContain("badge-flag");
    });

    it("includes logout form", () => {
      const html = renderDashboard(basicData);

      expect(html).toContain('action="/dashboard/logout"');
      expect(html).toContain("Logout");
    });

    it("includes export button", () => {
      const html = renderDashboard(basicData);

      expect(html).toContain("Export CSV");
      expect(html).toContain("exportCsv");
    });

    it("includes tab navigation", () => {
      const html = renderDashboard(basicData);

      expect(html).toContain('data-tab="overview"');
      expect(html).toContain('data-tab="activity"');
      expect(html).toContain('data-tab="logs"');
    });

    it("includes auto-refresh script", () => {
      const html = renderDashboard(basicData);

      expect(html).toContain("POLL_INTERVAL");
      expect(html).toContain("fetchStats");
    });
  });

  describe("uptime formatting", () => {
    it("formats seconds only", () => {
      const html = renderDashboard({
        username: "test",
        uptime: 30,
        totals: { emailsProcessed: 0, actionsTaken: 0, errors: 0 },
        accounts: [],
        recentActivity: [],
      });

      expect(html).toContain("0m");
    });

    it("formats minutes", () => {
      const html = renderDashboard({
        username: "test",
        uptime: 300,
        totals: { emailsProcessed: 0, actionsTaken: 0, errors: 0 },
        accounts: [],
        recentActivity: [],
      });

      expect(html).toContain("5m");
    });

    it("formats hours", () => {
      const html = renderDashboard({
        username: "test",
        uptime: 7200,
        totals: { emailsProcessed: 0, actionsTaken: 0, errors: 0 },
        accounts: [],
        recentActivity: [],
      });

      expect(html).toContain("2h");
    });

    it("formats days", () => {
      const html = renderDashboard({
        username: "test",
        uptime: 172800,
        totals: { emailsProcessed: 0, actionsTaken: 0, errors: 0 },
        accounts: [],
        recentActivity: [],
      });

      expect(html).toContain("2d");
    });

    it("formats mixed units", () => {
      const html = renderDashboard({
        username: "test",
        uptime: 93784, // 1d 2h 3m
        totals: { emailsProcessed: 0, actionsTaken: 0, errors: 0 },
        accounts: [],
        recentActivity: [],
      });

      expect(html).toContain("1d");
      expect(html).toContain("2h");
      expect(html).toContain("3m");
    });
  });

  describe("action badges", () => {
    it("renders move badge", () => {
      const html = renderDashboard({
        username: "test",
        uptime: 0,
        totals: { emailsProcessed: 0, actionsTaken: 0, errors: 0 },
        accounts: [],
        recentActivity: [
          {
            id: 1,
            accountName: "test",
            messageId: "<msg>",
            subject: "Test",
            from: "from@test.com",
            folder: "INBOX",
            actions: [{ type: "move" as const, folder: "Folder" }],
            createdAt: Date.now(),
          },
        ],
      });

      expect(html).toContain("badge-move");
      expect(html).toContain("move:Folder");
    });

    it("renders spam badge", () => {
      const html = renderDashboard({
        username: "test",
        uptime: 0,
        totals: { emailsProcessed: 0, actionsTaken: 0, errors: 0 },
        accounts: [],
        recentActivity: [
          {
            id: 1,
            accountName: "test",
            messageId: "<msg>",
            subject: "Test",
            from: "from@test.com",
            folder: "INBOX",
            actions: [{ type: "spam" as const }],
            createdAt: Date.now(),
          },
        ],
      });

      expect(html).toContain("badge-spam");
    });

    it("renders read badge", () => {
      const html = renderDashboard({
        username: "test",
        uptime: 0,
        totals: { emailsProcessed: 0, actionsTaken: 0, errors: 0 },
        accounts: [],
        recentActivity: [
          {
            id: 1,
            accountName: "test",
            messageId: "<msg>",
            subject: "Test",
            from: "from@test.com",
            folder: "INBOX",
            actions: [{ type: "read" as const }],
            createdAt: Date.now(),
          },
        ],
      });

      expect(html).toContain("badge-read");
    });

    it("renders delete badge", () => {
      const html = renderDashboard({
        username: "test",
        uptime: 0,
        totals: { emailsProcessed: 0, actionsTaken: 0, errors: 0 },
        accounts: [],
        recentActivity: [
          {
            id: 1,
            accountName: "test",
            messageId: "<msg>",
            subject: "Test",
            from: "from@test.com",
            folder: "INBOX",
            actions: [{ type: "delete" as const }],
            createdAt: Date.now(),
          },
        ],
      });

      expect(html).toContain("badge-delete");
    });

    it("renders noop badge", () => {
      const html = renderDashboard({
        username: "test",
        uptime: 0,
        totals: { emailsProcessed: 0, actionsTaken: 0, errors: 0 },
        accounts: [],
        recentActivity: [
          {
            id: 1,
            accountName: "test",
            messageId: "<msg>",
            subject: "Test",
            from: "from@test.com",
            folder: "INBOX",
            actions: [{ type: "noop" as const }],
            createdAt: Date.now(),
          },
        ],
      });

      expect(html).toContain("badge-noop");
    });

    it("renders multiple action badges", () => {
      const html = renderDashboard({
        username: "test",
        uptime: 0,
        totals: { emailsProcessed: 0, actionsTaken: 0, errors: 0 },
        accounts: [],
        recentActivity: [
          {
            id: 1,
            accountName: "test",
            messageId: "<msg>",
            subject: "Test",
            from: "from@test.com",
            folder: "INBOX",
            actions: [
              { type: "move" as const, folder: "Archive" },
              { type: "flag" as const, flags: ["\\Seen"] },
            ],
            createdAt: Date.now(),
          },
        ],
      });

      expect(html).toContain("badge-move");
      expect(html).toContain("badge-flag");
    });
  });

  describe("responsive design", () => {
    it("includes responsive CSS", () => {
      const html = renderDashboard({
        username: "test",
        uptime: 0,
        totals: { emailsProcessed: 0, actionsTaken: 0, errors: 0 },
        accounts: [],
        recentActivity: [],
      });

      expect(html).toContain("@media");
      expect(html).toContain("max-width");
    });

    it("includes grid layout", () => {
      const html = renderDashboard({
        username: "test",
        uptime: 0,
        totals: { emailsProcessed: 0, actionsTaken: 0, errors: 0 },
        accounts: [],
        recentActivity: [],
      });

      expect(html).toContain("grid");
      expect(html).toContain("grid-4");
    });
  });
});
