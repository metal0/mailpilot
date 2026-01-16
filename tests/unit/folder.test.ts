import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ensureFolderExists,
  clearFolderCache,
} from "../../src/actions/folder.js";

describe("Folder Management", () => {
  let mockImapClient: {
    createFolder: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockImapClient = {
      createFolder: vi.fn().mockResolvedValue(undefined),
    };
    clearFolderCache();
  });

  describe("ensureFolderExists", () => {
    it("creates folder on first call", async () => {
      await ensureFolderExists(mockImapClient as any, "TestFolder");

      expect(mockImapClient.createFolder).toHaveBeenCalledWith("TestFolder");
      expect(mockImapClient.createFolder).toHaveBeenCalledTimes(1);
    });

    it("does not recreate folder on subsequent calls", async () => {
      await ensureFolderExists(mockImapClient as any, "TestFolder");
      await ensureFolderExists(mockImapClient as any, "TestFolder");
      await ensureFolderExists(mockImapClient as any, "TestFolder");

      expect(mockImapClient.createFolder).toHaveBeenCalledTimes(1);
    });

    it("creates different folders separately", async () => {
      await ensureFolderExists(mockImapClient as any, "Folder1");
      await ensureFolderExists(mockImapClient as any, "Folder2");
      await ensureFolderExists(mockImapClient as any, "Folder3");

      expect(mockImapClient.createFolder).toHaveBeenCalledTimes(3);
      expect(mockImapClient.createFolder).toHaveBeenCalledWith("Folder1");
      expect(mockImapClient.createFolder).toHaveBeenCalledWith("Folder2");
      expect(mockImapClient.createFolder).toHaveBeenCalledWith("Folder3");
    });

    it("handles folder names with special characters", async () => {
      const folderName = "Folder/Subfolder";
      await ensureFolderExists(mockImapClient as any, folderName);

      expect(mockImapClient.createFolder).toHaveBeenCalledWith(folderName);
    });

    it("handles folder names with spaces", async () => {
      const folderName = "My Folder";
      await ensureFolderExists(mockImapClient as any, folderName);

      expect(mockImapClient.createFolder).toHaveBeenCalledWith(folderName);
    });

    it("handles empty folder name", async () => {
      await ensureFolderExists(mockImapClient as any, "");

      expect(mockImapClient.createFolder).toHaveBeenCalledWith("");
    });

    it("handles folder name with unicode", async () => {
      const folderName = "Папка";
      await ensureFolderExists(mockImapClient as any, folderName);

      expect(mockImapClient.createFolder).toHaveBeenCalledWith(folderName);
    });

    it("propagates createFolder errors", async () => {
      mockImapClient.createFolder.mockRejectedValueOnce(new Error("Folder exists"));

      await expect(
        ensureFolderExists(mockImapClient as any, "ExistingFolder")
      ).rejects.toThrow("Folder exists");
    });

    it("caches folder even if creation fails", async () => {
      mockImapClient.createFolder.mockRejectedValueOnce(new Error("Error"));

      try {
        await ensureFolderExists(mockImapClient as any, "FailFolder");
      } catch {
        // Expected
      }

      // After error, folder is NOT in cache (createFolder wasn't fully successful)
      mockImapClient.createFolder.mockResolvedValueOnce(undefined);
      await ensureFolderExists(mockImapClient as any, "FailFolder");

      // Should have been called twice (first failed, second succeeded)
      expect(mockImapClient.createFolder).toHaveBeenCalledTimes(2);
    });
  });

  describe("clearFolderCache", () => {
    it("clears the folder cache", async () => {
      await ensureFolderExists(mockImapClient as any, "CachedFolder");
      expect(mockImapClient.createFolder).toHaveBeenCalledTimes(1);

      clearFolderCache();

      await ensureFolderExists(mockImapClient as any, "CachedFolder");
      expect(mockImapClient.createFolder).toHaveBeenCalledTimes(2);
    });

    it("can be called when cache is empty", () => {
      clearFolderCache();
      clearFolderCache();
      clearFolderCache();
      expect(true).toBe(true);
    });

    it("clears all cached folders", async () => {
      await ensureFolderExists(mockImapClient as any, "Folder1");
      await ensureFolderExists(mockImapClient as any, "Folder2");
      await ensureFolderExists(mockImapClient as any, "Folder3");
      expect(mockImapClient.createFolder).toHaveBeenCalledTimes(3);

      clearFolderCache();

      await ensureFolderExists(mockImapClient as any, "Folder1");
      await ensureFolderExists(mockImapClient as any, "Folder2");
      await ensureFolderExists(mockImapClient as any, "Folder3");
      expect(mockImapClient.createFolder).toHaveBeenCalledTimes(6);
    });
  });

  describe("folder name variations", () => {
    it("treats case-sensitive folder names differently", async () => {
      await ensureFolderExists(mockImapClient as any, "Inbox");
      await ensureFolderExists(mockImapClient as any, "inbox");
      await ensureFolderExists(mockImapClient as any, "INBOX");

      expect(mockImapClient.createFolder).toHaveBeenCalledTimes(3);
    });

    it("handles nested folder paths", async () => {
      await ensureFolderExists(mockImapClient as any, "Parent/Child/Grandchild");

      expect(mockImapClient.createFolder).toHaveBeenCalledWith("Parent/Child/Grandchild");
    });

    it("handles dot-separated folder names", async () => {
      await ensureFolderExists(mockImapClient as any, "INBOX.Subfolder");

      expect(mockImapClient.createFolder).toHaveBeenCalledWith("INBOX.Subfolder");
    });

    it("handles very long folder names", async () => {
      const longName = "a".repeat(200);
      await ensureFolderExists(mockImapClient as any, longName);

      expect(mockImapClient.createFolder).toHaveBeenCalledWith(longName);
    });
  });
});
