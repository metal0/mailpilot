import { describe, it, expect, vi } from "vitest";
import { moveToFolder } from "../../src/actions/move.js";
import { applyFlags } from "../../src/actions/flag.js";
import { markRead } from "../../src/actions/read.js";

describe("Action Modules", () => {
  describe("moveToFolder", () => {
    it("calls imapClient.moveMessage with correct parameters", async () => {
      const mockClient = {
        moveMessage: vi.fn().mockResolvedValue(undefined),
      };

      await moveToFolder(mockClient as any, "INBOX", 123, "Archive");

      expect(mockClient.moveMessage).toHaveBeenCalledWith(123, "INBOX", "Archive");
    });

    it("passes through source folder correctly", async () => {
      const mockClient = {
        moveMessage: vi.fn().mockResolvedValue(undefined),
      };

      await moveToFolder(mockClient as any, "Sent", 456, "Backup");

      expect(mockClient.moveMessage).toHaveBeenCalledWith(456, "Sent", "Backup");
    });

    it("propagates errors from imapClient", async () => {
      const mockClient = {
        moveMessage: vi.fn().mockRejectedValue(new Error("Move failed")),
      };

      await expect(
        moveToFolder(mockClient as any, "INBOX", 123, "Archive")
      ).rejects.toThrow("Move failed");
    });

    it("handles special folder names", async () => {
      const mockClient = {
        moveMessage: vi.fn().mockResolvedValue(undefined),
      };

      await moveToFolder(mockClient as any, "INBOX", 789, "Folder/Subfolder");

      expect(mockClient.moveMessage).toHaveBeenCalledWith(789, "INBOX", "Folder/Subfolder");
    });

    it("handles unicode folder names", async () => {
      const mockClient = {
        moveMessage: vi.fn().mockResolvedValue(undefined),
      };

      await moveToFolder(mockClient as any, "INBOX", 101, "日本語");

      expect(mockClient.moveMessage).toHaveBeenCalledWith(101, "INBOX", "日本語");
    });

    it("handles folder names with spaces", async () => {
      const mockClient = {
        moveMessage: vi.fn().mockResolvedValue(undefined),
      };

      await moveToFolder(mockClient as any, "INBOX", 202, "My Archive");

      expect(mockClient.moveMessage).toHaveBeenCalledWith(202, "INBOX", "My Archive");
    });
  });

  describe("applyFlags", () => {
    it("calls imapClient.flagMessage with correct parameters", async () => {
      const mockClient = {
        flagMessage: vi.fn().mockResolvedValue(undefined),
      };

      await applyFlags(mockClient as any, "INBOX", 123, ["\\Flagged"]);

      expect(mockClient.flagMessage).toHaveBeenCalledWith(123, "INBOX", ["\\Flagged"]);
    });

    it("applies multiple flags", async () => {
      const mockClient = {
        flagMessage: vi.fn().mockResolvedValue(undefined),
      };

      await applyFlags(mockClient as any, "INBOX", 456, ["\\Seen", "\\Flagged", "\\Answered"]);

      expect(mockClient.flagMessage).toHaveBeenCalledWith(456, "INBOX", ["\\Seen", "\\Flagged", "\\Answered"]);
    });

    it("propagates errors from imapClient", async () => {
      const mockClient = {
        flagMessage: vi.fn().mockRejectedValue(new Error("Flag failed")),
      };

      await expect(
        applyFlags(mockClient as any, "INBOX", 123, ["\\Seen"])
      ).rejects.toThrow("Flag failed");
    });

    it("handles custom flags", async () => {
      const mockClient = {
        flagMessage: vi.fn().mockResolvedValue(undefined),
      };

      await applyFlags(mockClient as any, "INBOX", 789, ["$Important", "$CustomTag"]);

      expect(mockClient.flagMessage).toHaveBeenCalledWith(789, "INBOX", ["$Important", "$CustomTag"]);
    });

    it("handles different folders", async () => {
      const mockClient = {
        flagMessage: vi.fn().mockResolvedValue(undefined),
      };

      await applyFlags(mockClient as any, "Sent", 101, ["\\Answered"]);

      expect(mockClient.flagMessage).toHaveBeenCalledWith(101, "Sent", ["\\Answered"]);
    });
  });

  describe("markRead", () => {
    it("calls imapClient.markAsRead with correct parameters", async () => {
      const mockClient = {
        markAsRead: vi.fn().mockResolvedValue(undefined),
      };

      await markRead(mockClient as any, "INBOX", 123);

      expect(mockClient.markAsRead).toHaveBeenCalledWith(123, "INBOX");
    });

    it("propagates errors from imapClient", async () => {
      const mockClient = {
        markAsRead: vi.fn().mockRejectedValue(new Error("Mark read failed")),
      };

      await expect(
        markRead(mockClient as any, "INBOX", 123)
      ).rejects.toThrow("Mark read failed");
    });

    it("handles different folders", async () => {
      const mockClient = {
        markAsRead: vi.fn().mockResolvedValue(undefined),
      };

      await markRead(mockClient as any, "Archive", 456);

      expect(mockClient.markAsRead).toHaveBeenCalledWith(456, "Archive");
    });

    it("handles special folder names", async () => {
      const mockClient = {
        markAsRead: vi.fn().mockResolvedValue(undefined),
      };

      await markRead(mockClient as any, "INBOX/Subfolder", 789);

      expect(mockClient.markAsRead).toHaveBeenCalledWith(789, "INBOX/Subfolder");
    });
  });
});
