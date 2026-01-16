import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeAction, type ActionContext } from "../../src/actions/executor.js";

describe("Action Executor", () => {
  let mockImapClient: {
    moveMessage: ReturnType<typeof vi.fn>;
    markAsSpam: ReturnType<typeof vi.fn>;
    flagMessage: ReturnType<typeof vi.fn>;
    markAsRead: ReturnType<typeof vi.fn>;
    deleteMessage: ReturnType<typeof vi.fn>;
    createFolder: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockImapClient = {
      moveMessage: vi.fn().mockResolvedValue(undefined),
      markAsSpam: vi.fn().mockResolvedValue(undefined),
      flagMessage: vi.fn().mockResolvedValue(undefined),
      markAsRead: vi.fn().mockResolvedValue(undefined),
      deleteMessage: vi.fn().mockResolvedValue(undefined),
      createFolder: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe("move action", () => {
    it("moves message to specified folder", async () => {
      const ctx: ActionContext = {
        action: { type: "move", folder: "Archive" },
        imapClient: mockImapClient as any,
        folder: "INBOX",
        uid: 123,
        accountConfig: {} as any,
      };

      await executeAction(ctx);

      expect(mockImapClient.moveMessage).toHaveBeenCalledWith(123, "INBOX", "Archive");
    });

    it("creates folder before moving", async () => {
      const ctx: ActionContext = {
        action: { type: "move", folder: "NewFolder" },
        imapClient: mockImapClient as any,
        folder: "INBOX",
        uid: 456,
        accountConfig: {} as any,
      };

      await executeAction(ctx);

      expect(mockImapClient.createFolder).toHaveBeenCalledWith("NewFolder");
      expect(mockImapClient.moveMessage).toHaveBeenCalled();
    });

    it("skips move when folder is missing", async () => {
      const ctx: ActionContext = {
        action: { type: "move" },
        imapClient: mockImapClient as any,
        folder: "INBOX",
        uid: 123,
        accountConfig: {} as any,
      };

      await executeAction(ctx);

      expect(mockImapClient.moveMessage).not.toHaveBeenCalled();
    });

    it("respects predefined folder restrictions", async () => {
      const ctx: ActionContext = {
        action: { type: "move", folder: "NotAllowed" },
        imapClient: mockImapClient as any,
        folder: "INBOX",
        uid: 123,
        accountConfig: {
          folders: {
            mode: "predefined",
            allowed: ["Archive", "Important"],
          },
        } as any,
      };

      await executeAction(ctx);

      expect(mockImapClient.moveMessage).not.toHaveBeenCalled();
    });

    it("allows move when folder is in allowed list", async () => {
      const ctx: ActionContext = {
        action: { type: "move", folder: "Archive" },
        imapClient: mockImapClient as any,
        folder: "INBOX",
        uid: 123,
        accountConfig: {
          folders: {
            mode: "predefined",
            allowed: ["Archive", "Important"],
          },
        } as any,
      };

      await executeAction(ctx);

      expect(mockImapClient.moveMessage).toHaveBeenCalled();
    });

    it("allows any folder when mode is not predefined", async () => {
      const ctx: ActionContext = {
        action: { type: "move", folder: "AnyFolder" },
        imapClient: mockImapClient as any,
        folder: "INBOX",
        uid: 123,
        accountConfig: {
          folders: {
            mode: "dynamic",
          },
        } as any,
      };

      await executeAction(ctx);

      expect(mockImapClient.moveMessage).toHaveBeenCalled();
    });
  });

  describe("spam action", () => {
    it("marks message as spam", async () => {
      const ctx: ActionContext = {
        action: { type: "spam" },
        imapClient: mockImapClient as any,
        folder: "INBOX",
        uid: 789,
        accountConfig: {} as any,
      };

      await executeAction(ctx);

      expect(mockImapClient.markAsSpam).toHaveBeenCalledWith(789, "INBOX");
    });
  });

  describe("flag action", () => {
    it("applies flags to message", async () => {
      const ctx: ActionContext = {
        action: { type: "flag", flags: ["\\Flagged", "\\Seen"] },
        imapClient: mockImapClient as any,
        folder: "INBOX",
        uid: 101,
        accountConfig: {} as any,
      };

      await executeAction(ctx);

      expect(mockImapClient.flagMessage).toHaveBeenCalledWith(101, "INBOX", ["\\Flagged", "\\Seen"]);
    });

    it("skips when flags are missing", async () => {
      const ctx: ActionContext = {
        action: { type: "flag" },
        imapClient: mockImapClient as any,
        folder: "INBOX",
        uid: 101,
        accountConfig: {} as any,
      };

      await executeAction(ctx);

      expect(mockImapClient.flagMessage).not.toHaveBeenCalled();
    });

    it("skips when flags array is empty", async () => {
      const ctx: ActionContext = {
        action: { type: "flag", flags: [] },
        imapClient: mockImapClient as any,
        folder: "INBOX",
        uid: 101,
        accountConfig: {} as any,
      };

      await executeAction(ctx);

      expect(mockImapClient.flagMessage).not.toHaveBeenCalled();
    });
  });

  describe("read action", () => {
    it("marks message as read", async () => {
      const ctx: ActionContext = {
        action: { type: "read" },
        imapClient: mockImapClient as any,
        folder: "INBOX",
        uid: 202,
        accountConfig: {} as any,
      };

      await executeAction(ctx);

      expect(mockImapClient.markAsRead).toHaveBeenCalledWith(202, "INBOX");
    });
  });

  describe("delete action", () => {
    it("deletes message", async () => {
      const ctx: ActionContext = {
        action: { type: "delete" },
        imapClient: mockImapClient as any,
        folder: "INBOX",
        uid: 303,
        accountConfig: {} as any,
      };

      await executeAction(ctx);

      expect(mockImapClient.deleteMessage).toHaveBeenCalledWith(303, "INBOX");
    });
  });

  describe("noop action", () => {
    it("does nothing", async () => {
      const ctx: ActionContext = {
        action: { type: "noop", reason: "No action needed" },
        imapClient: mockImapClient as any,
        folder: "INBOX",
        uid: 404,
        accountConfig: {} as any,
      };

      await executeAction(ctx);

      expect(mockImapClient.moveMessage).not.toHaveBeenCalled();
      expect(mockImapClient.markAsSpam).not.toHaveBeenCalled();
      expect(mockImapClient.flagMessage).not.toHaveBeenCalled();
      expect(mockImapClient.markAsRead).not.toHaveBeenCalled();
      expect(mockImapClient.deleteMessage).not.toHaveBeenCalled();
    });
  });

  describe("unknown action", () => {
    it("handles unknown action type gracefully", async () => {
      const ctx: ActionContext = {
        action: { type: "unknown_type" as any },
        imapClient: mockImapClient as any,
        folder: "INBOX",
        uid: 505,
        accountConfig: {} as any,
      };

      // Should not throw
      await expect(executeAction(ctx)).resolves.toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("propagates IMAP errors for move", async () => {
      mockImapClient.moveMessage.mockRejectedValue(new Error("IMAP error"));

      const ctx: ActionContext = {
        action: { type: "move", folder: "Archive" },
        imapClient: mockImapClient as any,
        folder: "INBOX",
        uid: 123,
        accountConfig: {} as any,
      };

      await expect(executeAction(ctx)).rejects.toThrow("IMAP error");
    });

    it("propagates IMAP errors for spam", async () => {
      mockImapClient.markAsSpam.mockRejectedValue(new Error("IMAP error"));

      const ctx: ActionContext = {
        action: { type: "spam" },
        imapClient: mockImapClient as any,
        folder: "INBOX",
        uid: 123,
        accountConfig: {} as any,
      };

      await expect(executeAction(ctx)).rejects.toThrow("IMAP error");
    });

    it("propagates IMAP errors for flag", async () => {
      mockImapClient.flagMessage.mockRejectedValue(new Error("IMAP error"));

      const ctx: ActionContext = {
        action: { type: "flag", flags: ["\\Seen"] },
        imapClient: mockImapClient as any,
        folder: "INBOX",
        uid: 123,
        accountConfig: {} as any,
      };

      await expect(executeAction(ctx)).rejects.toThrow("IMAP error");
    });

    it("propagates IMAP errors for read", async () => {
      mockImapClient.markAsRead.mockRejectedValue(new Error("IMAP error"));

      const ctx: ActionContext = {
        action: { type: "read" },
        imapClient: mockImapClient as any,
        folder: "INBOX",
        uid: 123,
        accountConfig: {} as any,
      };

      await expect(executeAction(ctx)).rejects.toThrow("IMAP error");
    });

    it("propagates IMAP errors for delete", async () => {
      mockImapClient.deleteMessage.mockRejectedValue(new Error("IMAP error"));

      const ctx: ActionContext = {
        action: { type: "delete" },
        imapClient: mockImapClient as any,
        folder: "INBOX",
        uid: 123,
        accountConfig: {} as any,
      };

      await expect(executeAction(ctx)).rejects.toThrow("IMAP error");
    });
  });

  describe("action with reason", () => {
    it("processes move action with reason", async () => {
      const ctx: ActionContext = {
        action: { type: "move", folder: "Archive", reason: "Old email" },
        imapClient: mockImapClient as any,
        folder: "INBOX",
        uid: 123,
        accountConfig: {} as any,
      };

      await executeAction(ctx);

      expect(mockImapClient.moveMessage).toHaveBeenCalled();
    });

    it("processes noop action with reason", async () => {
      const ctx: ActionContext = {
        action: { type: "noop", reason: "Email needs manual review" },
        imapClient: mockImapClient as any,
        folder: "INBOX",
        uid: 123,
        accountConfig: {} as any,
      };

      // Should complete without error
      await expect(executeAction(ctx)).resolves.toBeUndefined();
    });
  });
});
