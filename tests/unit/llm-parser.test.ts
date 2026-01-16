import { describe, it, expect } from "vitest";
import {
  parseLlmResponse,
  filterDisallowedActions,
  generateResponseSchema,
  RESPONSE_SCHEMA,
  ALL_ACTION_TYPES,
  DEFAULT_ALLOWED_ACTIONS,
  type LlmAction,
  type ActionType,
} from "../../src/llm/parser.js";

describe("LLM Parser", () => {
  describe("parseLlmResponse", () => {
    describe("valid JSON responses", () => {
      it("parses valid JSON with single action", () => {
        const response = JSON.stringify({
          actions: [{ type: "move", folder: "Archive", reason: "Old email" }],
        });

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe("move");
        expect(actions[0].folder).toBe("Archive");
        expect(actions[0].reason).toBe("Old email");
      });

      it("parses valid JSON with multiple actions", () => {
        const response = JSON.stringify({
          actions: [
            { type: "move", folder: "Archive" },
            { type: "flag", flags: ["\\Flagged"] },
          ],
        });

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(2);
        expect(actions[0].type).toBe("move");
        expect(actions[1].type).toBe("flag");
      });

      it("parses noop action", () => {
        const response = JSON.stringify({
          actions: [{ type: "noop", reason: "No action needed" }],
        });

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe("noop");
        expect(actions[0].reason).toBe("No action needed");
      });

      it("parses spam action", () => {
        const response = JSON.stringify({
          actions: [{ type: "spam" }],
        });

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe("spam");
      });

      it("parses read action", () => {
        const response = JSON.stringify({
          actions: [{ type: "read" }],
        });

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe("read");
      });

      it("parses delete action", () => {
        const response = JSON.stringify({
          actions: [{ type: "delete" }],
        });

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe("delete");
      });
    });

    describe("markdown code block extraction", () => {
      it("extracts JSON from markdown code block", () => {
        const response = `Here's my analysis:
\`\`\`json
{"actions": [{"type": "move", "folder": "Important"}]}
\`\`\`
That's my recommendation.`;

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe("move");
        expect(actions[0].folder).toBe("Important");
      });

      it("extracts JSON from code block without language specifier", () => {
        const response = `\`\`\`
{"actions": [{"type": "noop"}]}
\`\`\``;

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe("noop");
      });

      it("handles extra whitespace in code blocks", () => {
        const response = `\`\`\`json

{"actions": [{"type": "read"}]}

\`\`\``;

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe("read");
      });
    });

    describe("JSON recovery", () => {
      it("extracts JSON object from prose", () => {
        const response = `Based on my analysis, I recommend: {"actions": [{"type": "spam"}]} which should work.`;

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe("spam");
      });

      it("handles JSON with extra text before", () => {
        const response = `Let me process this email... {"actions": [{"type": "move", "folder": "Receipts"}]}`;

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe("move");
        expect(actions[0].folder).toBe("Receipts");
      });

      it("handles JSON with extra text after", () => {
        const response = `{"actions": [{"type": "flag", "flags": ["\\\\Seen"]}]} That completes the analysis.`;

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe("flag");
      });
    });

    describe("validation and conversion", () => {
      it("converts move without folder to noop", () => {
        const response = JSON.stringify({
          actions: [{ type: "move" }],
        });

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe("noop");
        expect(actions[0].reason).toBe("Move action missing folder");
      });

      it("converts flag without flags to noop", () => {
        const response = JSON.stringify({
          actions: [{ type: "flag" }],
        });

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe("noop");
        expect(actions[0].reason).toBe("Flag action missing flags");
      });

      it("converts flag with empty flags array to noop", () => {
        const response = JSON.stringify({
          actions: [{ type: "flag", flags: [] }],
        });

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe("noop");
        expect(actions[0].reason).toBe("Flag action missing flags");
      });

      it("validates each action independently", () => {
        const response = JSON.stringify({
          actions: [
            { type: "move", folder: "Archive" },
            { type: "move" }, // missing folder
            { type: "flag", flags: ["\\Flagged"] },
          ],
        });

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(3);
        expect(actions[0].type).toBe("move");
        expect(actions[1].type).toBe("noop");
        expect(actions[2].type).toBe("flag");
      });
    });

    describe("error handling", () => {
      it("returns noop on invalid JSON", () => {
        const response = "This is not JSON at all";

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe("noop");
      });

      it("returns noop on empty response", () => {
        const response = "";

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe("noop");
      });

      it("returns noop on whitespace only", () => {
        const response = "   \n\t  ";

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe("noop");
      });

      it("returns noop for JSON without actions array", () => {
        const response = JSON.stringify({ result: "success" });

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe("noop");
      });

      it("returns noop for JSON with empty actions array", () => {
        const response = JSON.stringify({ actions: [] });

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe("noop");
      });

      it("skips invalid actions and keeps valid ones", () => {
        const response = JSON.stringify({
          actions: [
            { type: "invalid_type" },
            { type: "move", folder: "Archive" },
            { notAnAction: true },
          ],
        });

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe("move");
      });

      it("returns noop when all actions are invalid", () => {
        const response = JSON.stringify({
          actions: [{ type: "unknown" }, { invalid: true }],
        });

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe("noop");
      });
    });

    describe("edge cases", () => {
      it("handles deeply nested JSON structure", () => {
        const response = JSON.stringify({
          actions: [
            {
              type: "move",
              folder: "Archive",
              reason: "Complex reason with nested {data}",
            },
          ],
        });

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe("move");
      });

      it("handles unicode in folder names", () => {
        const response = JSON.stringify({
          actions: [{ type: "move", folder: "Архив" }],
        });

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].folder).toBe("Архив");
      });

      it("handles special characters in reason", () => {
        const response = JSON.stringify({
          actions: [{ type: "noop", reason: "Email from <user@example.com> & others" }],
        });

        const actions = parseLlmResponse(response);

        expect(actions[0].reason).toBe("Email from <user@example.com> & others");
      });

      it("handles very long responses", () => {
        const longReason = "a".repeat(10000);
        const response = JSON.stringify({
          actions: [{ type: "noop", reason: longReason }],
        });

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(1);
        expect(actions[0].reason).toBe(longReason);
      });

      it("handles many actions", () => {
        const manyActions = Array.from({ length: 50 }, () => ({
          type: "flag",
          flags: ["\\Seen"],
        }));
        const response = JSON.stringify({ actions: manyActions });

        const actions = parseLlmResponse(response);

        expect(actions).toHaveLength(50);
      });
    });
  });

  describe("filterDisallowedActions", () => {
    it("allows all actions when all types are allowed", () => {
      const actions: LlmAction[] = [
        { type: "move", folder: "Archive" },
        { type: "spam" },
        { type: "delete" },
      ];

      const filtered = filterDisallowedActions(actions, ALL_ACTION_TYPES as unknown as ActionType[]);

      expect(filtered).toHaveLength(3);
      expect(filtered[0].type).toBe("move");
      expect(filtered[1].type).toBe("spam");
      expect(filtered[2].type).toBe("delete");
    });

    it("converts disallowed actions to noop", () => {
      const actions: LlmAction[] = [{ type: "delete" }];
      const allowed: ActionType[] = ["move", "noop"];

      const filtered = filterDisallowedActions(actions, allowed);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe("noop");
      expect(filtered[0].reason).toContain("delete");
      expect(filtered[0].reason).toContain("not allowed");
    });

    it("keeps allowed actions and converts disallowed", () => {
      const actions: LlmAction[] = [
        { type: "move", folder: "Archive" },
        { type: "delete" },
        { type: "flag", flags: ["\\Seen"] },
      ];
      const allowed: ActionType[] = ["move", "flag", "noop"];

      const filtered = filterDisallowedActions(actions, allowed);

      expect(filtered).toHaveLength(3);
      expect(filtered[0].type).toBe("move");
      expect(filtered[1].type).toBe("noop");
      expect(filtered[2].type).toBe("flag");
    });

    it("returns noop when empty actions provided", () => {
      const actions: LlmAction[] = [];
      const allowed: ActionType[] = ["move", "noop"];

      const filtered = filterDisallowedActions(actions, allowed);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe("noop");
    });

    it("returns noop when all actions are disallowed", () => {
      const actions: LlmAction[] = [{ type: "delete" }, { type: "spam" }];
      const allowed: ActionType[] = ["move", "noop"];

      const filtered = filterDisallowedActions(actions, allowed);

      // All converted to noop
      expect(filtered.every((a) => a.type === "noop")).toBe(true);
    });

    it("preserves action metadata on allowed actions", () => {
      const actions: LlmAction[] = [
        { type: "move", folder: "Important", reason: "Critical email" },
      ];
      const allowed: ActionType[] = ["move", "noop"];

      const filtered = filterDisallowedActions(actions, allowed);

      expect(filtered[0]).toEqual({
        type: "move",
        folder: "Important",
        reason: "Critical email",
      });
    });
  });

  describe("generateResponseSchema", () => {
    it("generates schema with all action types", () => {
      const schema = generateResponseSchema(ALL_ACTION_TYPES as unknown as ActionType[]);

      expect(schema).toContain('"move"');
      expect(schema).toContain('"spam"');
      expect(schema).toContain('"flag"');
      expect(schema).toContain('"read"');
      expect(schema).toContain('"delete"');
      expect(schema).toContain('"noop"');
    });

    it("generates schema with limited action types", () => {
      const schema = generateResponseSchema(["move", "noop"]);

      expect(schema).toContain('"move"');
      expect(schema).toContain('"noop"');
      expect(schema).not.toContain('"delete"');
      expect(schema).not.toContain('"spam"');
    });

    it("generates schema with single action type", () => {
      const schema = generateResponseSchema(["noop"]);

      expect(schema).toContain('"noop"');
    });

    it("includes folder documentation", () => {
      const schema = generateResponseSchema(["move", "noop"]);

      expect(schema).toContain("folder");
      expect(schema).toContain("required for move action");
    });

    it("includes flags documentation", () => {
      const schema = generateResponseSchema(["flag", "noop"]);

      expect(schema).toContain("flags");
      expect(schema).toContain("required for flag action");
    });

    it("includes reason documentation", () => {
      const schema = generateResponseSchema(["noop"]);

      expect(schema).toContain("reason");
      expect(schema).toContain("optional");
    });
  });

  describe("RESPONSE_SCHEMA constant", () => {
    it("is valid JSON structure description", () => {
      expect(RESPONSE_SCHEMA).toContain("actions");
      expect(RESPONSE_SCHEMA).toContain("type");
    });

    it("documents all action types", () => {
      expect(RESPONSE_SCHEMA).toContain("move");
      expect(RESPONSE_SCHEMA).toContain("spam");
      expect(RESPONSE_SCHEMA).toContain("flag");
      expect(RESPONSE_SCHEMA).toContain("read");
      expect(RESPONSE_SCHEMA).toContain("delete");
      expect(RESPONSE_SCHEMA).toContain("noop");
    });

    it("documents folder field", () => {
      expect(RESPONSE_SCHEMA).toContain("folder");
    });

    it("documents flags field", () => {
      expect(RESPONSE_SCHEMA).toContain("flags");
    });

    it("documents reason field", () => {
      expect(RESPONSE_SCHEMA).toContain("reason");
    });
  });

  describe("ALL_ACTION_TYPES constant", () => {
    it("contains all valid action types", () => {
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
  });

  describe("DEFAULT_ALLOWED_ACTIONS constant", () => {
    it("is an array", () => {
      expect(Array.isArray(DEFAULT_ALLOWED_ACTIONS)).toBe(true);
    });

    it("contains common safe actions", () => {
      expect(DEFAULT_ALLOWED_ACTIONS).toContain("move");
      expect(DEFAULT_ALLOWED_ACTIONS).toContain("noop");
    });

    it("is a subset of ALL_ACTION_TYPES", () => {
      const allSet = new Set(ALL_ACTION_TYPES);
      for (const action of DEFAULT_ALLOWED_ACTIONS) {
        expect(allSet.has(action)).toBe(true);
      }
    });
  });
});
