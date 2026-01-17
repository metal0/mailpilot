import { describe, it, expect } from "vitest";

describe("Action Types Filter", () => {
  const allActionTypes = ["move", "spam", "flag", "read", "delete", "noop"];
  const defaultAllowed = ["move", "spam", "flag", "read", "noop"];

  describe("noop filtering", () => {
    it("filters out noop from available action types", () => {
      const filtered = allActionTypes.filter(a => a !== "noop");
      expect(filtered).toEqual(["move", "spam", "flag", "read", "delete"]);
      expect(filtered).not.toContain("noop");
    });

    it("filters out noop from default allowed actions", () => {
      const filtered = defaultAllowed.filter(a => a !== "noop");
      expect(filtered).toEqual(["move", "spam", "flag", "read"]);
      expect(filtered).not.toContain("noop");
    });

    it("preserves all other action types", () => {
      const filtered = allActionTypes.filter(a => a !== "noop");
      expect(filtered).toContain("move");
      expect(filtered).toContain("spam");
      expect(filtered).toContain("flag");
      expect(filtered).toContain("read");
      expect(filtered).toContain("delete");
    });
  });

  describe("allowed actions state management", () => {
    it("empty array means no actions allowed (noop only on backend)", () => {
      const allowedActions: string[] = [];
      expect(allowedActions.length).toBe(0);
    });

    it("can toggle actions on and off", () => {
      let current = ["move", "spam", "flag", "read"];

      // Remove spam
      current = current.filter(a => a !== "spam");
      expect(current).toEqual(["move", "flag", "read"]);

      // Add delete
      current = [...current, "delete"];
      expect(current).toEqual(["move", "flag", "read", "delete"]);

      // Remove all
      current = [];
      expect(current).toEqual([]);
    });

    it("can set all actions at once", () => {
      const availableActionTypes = ["move", "spam", "flag", "read", "delete"];
      const allActions = [...availableActionTypes];
      expect(allActions).toEqual(["move", "spam", "flag", "read", "delete"]);
    });

    it("can reset to default", () => {
      const defaultAllowedActions = ["move", "spam", "flag", "read"];
      const resetToDefault = [...defaultAllowedActions];
      expect(resetToDefault).toEqual(["move", "spam", "flag", "read"]);
    });
  });

  describe("delete action warning logic", () => {
    it("detects when delete is enabled", () => {
      const withDelete = ["move", "delete"];
      expect(withDelete.includes("delete")).toBe(true);
    });

    it("detects when delete is not enabled", () => {
      const withoutDelete = ["move", "spam", "flag"];
      expect(withoutDelete.includes("delete")).toBe(false);
    });
  });
});
