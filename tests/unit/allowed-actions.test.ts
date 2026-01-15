import { describe, it, expect } from "vitest";
import {
  DEFAULT_ALLOWED_ACTIONS,
  ALL_ACTION_TYPES,
} from "../../src/config/schema.js";
import {
  generateResponseSchema,
  filterDisallowedActions,
  type LlmAction,
  type ActionType,
} from "../../src/llm/parser.js";
import { buildPrompt, type EmailContext, type PromptOptions } from "../../src/llm/prompt.js";

describe("Allowed Actions - Safety Defaults", () => {
  describe("DEFAULT_ALLOWED_ACTIONS", () => {
    it("does NOT include delete action", () => {
      expect(DEFAULT_ALLOWED_ACTIONS).not.toContain("delete");
    });

    it("includes safe actions: move, spam, flag, read, noop", () => {
      expect(DEFAULT_ALLOWED_ACTIONS).toContain("move");
      expect(DEFAULT_ALLOWED_ACTIONS).toContain("spam");
      expect(DEFAULT_ALLOWED_ACTIONS).toContain("flag");
      expect(DEFAULT_ALLOWED_ACTIONS).toContain("read");
      expect(DEFAULT_ALLOWED_ACTIONS).toContain("noop");
    });

    it("has exactly 5 actions (all except delete)", () => {
      expect(DEFAULT_ALLOWED_ACTIONS).toHaveLength(5);
    });

    it("is a strict subset of ALL_ACTION_TYPES", () => {
      for (const action of DEFAULT_ALLOWED_ACTIONS) {
        expect(ALL_ACTION_TYPES).toContain(action);
      }
    });
  });

  describe("ALL_ACTION_TYPES", () => {
    it("includes delete action", () => {
      expect(ALL_ACTION_TYPES).toContain("delete");
    });

    it("has exactly 6 actions", () => {
      expect(ALL_ACTION_TYPES).toHaveLength(6);
    });
  });
});

describe("generateResponseSchema", () => {
  it("generates schema with only allowed action types", () => {
    const allowed: ActionType[] = ["move", "flag", "noop"];
    const schema = generateResponseSchema(allowed);

    expect(schema).toContain('"move"');
    expect(schema).toContain('"flag"');
    expect(schema).toContain('"noop"');
    expect(schema).not.toContain('"delete"');
    expect(schema).not.toContain('"spam"');
    expect(schema).not.toContain('"read"');
  });

  it("excludes delete when not in allowed list", () => {
    const schema = generateResponseSchema([...DEFAULT_ALLOWED_ACTIONS] as ActionType[]);

    expect(schema).not.toContain('"delete"');
  });

  it("includes delete only when explicitly allowed", () => {
    const allowed: ActionType[] = ["move", "delete", "noop"];
    const schema = generateResponseSchema(allowed);

    expect(schema).toContain('"delete"');
  });

  it("generates valid schema structure", () => {
    const allowed: ActionType[] = ["move", "noop"];
    const schema = generateResponseSchema(allowed);

    expect(schema).toContain('"actions"');
    expect(schema).toContain('"type"');
    expect(schema).toContain('"folder"');
    expect(schema).toContain('"flags"');
    expect(schema).toContain('"reason"');
  });

  it("uses pipe separator for multiple action types", () => {
    const allowed: ActionType[] = ["move", "flag", "noop"];
    const schema = generateResponseSchema(allowed);

    expect(schema).toContain('"move" | "flag" | "noop"');
  });
});

describe("filterDisallowedActions", () => {
  describe("delete action blocking", () => {
    it("blocks delete when not in allowed list", () => {
      const actions: LlmAction[] = [{ type: "delete", reason: "Delete this" }];
      const allowed: ActionType[] = ["move", "spam", "flag", "read", "noop"];

      const filtered = filterDisallowedActions(actions, allowed);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe("noop");
      expect(filtered[0].reason).toContain("delete");
      expect(filtered[0].reason).toContain("not allowed");
    });

    it("blocks delete when using DEFAULT_ALLOWED_ACTIONS", () => {
      const actions: LlmAction[] = [{ type: "delete", reason: "Delete spam" }];

      const filtered = filterDisallowedActions(actions, [...DEFAULT_ALLOWED_ACTIONS] as ActionType[]);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe("noop");
      expect(filtered[0].reason).toContain("delete");
    });

    it("allows delete only when explicitly in allowed list", () => {
      const actions: LlmAction[] = [{ type: "delete", reason: "Delete this" }];
      const allowed: ActionType[] = ["move", "delete", "noop"];

      const filtered = filterDisallowedActions(actions, allowed);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe("delete");
      expect(filtered[0].reason).toBe("Delete this");
    });

    it("blocks delete in mixed action list", () => {
      const actions: LlmAction[] = [
        { type: "move", folder: "Archive", reason: "Archive email" },
        { type: "delete", reason: "Also delete" },
        { type: "flag", flags: ["\\Flagged"], reason: "Flag it" },
      ];
      const allowed: ActionType[] = ["move", "flag", "noop"];

      const filtered = filterDisallowedActions(actions, allowed);

      expect(filtered).toHaveLength(3);
      expect(filtered[0].type).toBe("move");
      expect(filtered[1].type).toBe("noop");
      expect(filtered[1].reason).toContain("delete");
      expect(filtered[2].type).toBe("flag");
    });
  });

  describe("general action filtering", () => {
    it("allows all actions when all are in allowed list", () => {
      const actions: LlmAction[] = [
        { type: "move", folder: "Work" },
        { type: "flag", flags: ["\\Seen"] },
      ];
      const allowed: ActionType[] = ["move", "flag", "noop"];

      const filtered = filterDisallowedActions(actions, allowed);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].type).toBe("move");
      expect(filtered[1].type).toBe("flag");
    });

    it("converts all disallowed actions to noop", () => {
      const actions: LlmAction[] = [
        { type: "spam", reason: "Mark as spam" },
        { type: "delete", reason: "Delete" },
        { type: "read", reason: "Mark read" },
      ];
      const allowed: ActionType[] = ["move", "noop"];

      const filtered = filterDisallowedActions(actions, allowed);

      expect(filtered).toHaveLength(3);
      expect(filtered.every((a) => a.type === "noop")).toBe(true);
    });

    it("returns noop when empty actions array and no allowed actions match", () => {
      const actions: LlmAction[] = [];
      const allowed: ActionType[] = ["move", "noop"];

      const filtered = filterDisallowedActions(actions, allowed);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe("noop");
    });

    it("preserves action properties when allowed", () => {
      const actions: LlmAction[] = [
        { type: "move", folder: "Important", reason: "Critical email" },
        { type: "flag", flags: ["\\Flagged", "\\Seen"], reason: "Mark important" },
      ];
      const allowed: ActionType[] = ["move", "flag", "noop"];

      const filtered = filterDisallowedActions(actions, allowed);

      expect(filtered[0]).toEqual(actions[0]);
      expect(filtered[1]).toEqual(actions[1]);
    });
  });

  describe("edge cases", () => {
    it("handles single noop action", () => {
      const actions: LlmAction[] = [{ type: "noop", reason: "No action needed" }];
      const allowed: ActionType[] = ["noop"];

      const filtered = filterDisallowedActions(actions, allowed);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe("noop");
    });

    it("blocks noop when not allowed (edge case)", () => {
      const actions: LlmAction[] = [{ type: "noop", reason: "No action" }];
      const allowed: ActionType[] = ["move", "flag"];

      const filtered = filterDisallowedActions(actions, allowed);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe("noop");
      expect(filtered[0].reason).toContain("noop");
      expect(filtered[0].reason).toContain("not allowed");
    });

    it("handles all actions being blocked", () => {
      const actions: LlmAction[] = [
        { type: "delete", reason: "Delete" },
        { type: "spam", reason: "Spam" },
      ];
      const allowed: ActionType[] = ["move", "noop"];

      const filtered = filterDisallowedActions(actions, allowed);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].type).toBe("noop");
      expect(filtered[1].type).toBe("noop");
    });
  });
});

describe("buildPrompt - Allowed Actions", () => {
  const baseEmail: EmailContext = {
    from: "sender@example.com",
    subject: "Test Email",
    date: "2026-01-15T12:00:00Z",
    body: "This is a test email body.",
  };

  const baseOptions: PromptOptions = {
    basePrompt: "You are an email classifier.",
    folderMode: "predefined",
  };

  describe("action restrictions in prompt", () => {
    it("includes allowed actions section when actions are restricted", () => {
      const options: PromptOptions = {
        ...baseOptions,
        allowedActions: ["move", "flag", "noop"],
      };

      const prompt = buildPrompt(baseEmail, options);

      expect(prompt).toContain("## Allowed Actions");
      expect(prompt).toContain("You may ONLY use these action types:");
      expect(prompt).toContain("- move");
      expect(prompt).toContain("- flag");
      expect(prompt).toContain("- noop");
    });

    it("excludes delete from prompt when using DEFAULT_ALLOWED_ACTIONS", () => {
      const options: PromptOptions = {
        ...baseOptions,
        allowedActions: [...DEFAULT_ALLOWED_ACTIONS] as ActionType[],
      };

      const prompt = buildPrompt(baseEmail, options);

      expect(prompt).toContain("## Allowed Actions");
      expect(prompt).not.toContain("- delete");
      expect(prompt).toContain("DO NOT use these action types: delete");
    });

    it("mentions disallowed actions explicitly", () => {
      const options: PromptOptions = {
        ...baseOptions,
        allowedActions: ["move", "noop"],
      };

      const prompt = buildPrompt(baseEmail, options);

      expect(prompt).toContain("DO NOT use these action types:");
      expect(prompt).toContain("spam");
      expect(prompt).toContain("flag");
      expect(prompt).toContain("read");
      expect(prompt).toContain("delete");
    });

    it("does not include allowed actions section when all actions allowed", () => {
      const options: PromptOptions = {
        ...baseOptions,
        allowedActions: [...ALL_ACTION_TYPES] as ActionType[],
      };

      const prompt = buildPrompt(baseEmail, options);

      expect(prompt).not.toContain("## Allowed Actions");
      expect(prompt).not.toContain("DO NOT use these action types");
    });

    it("does not include allowed actions section when allowedActions is undefined", () => {
      const options: PromptOptions = {
        ...baseOptions,
      };

      const prompt = buildPrompt(baseEmail, options);

      expect(prompt).not.toContain("## Allowed Actions");
    });
  });

  describe("response schema in prompt", () => {
    it("uses restricted schema when actions are limited", () => {
      const options: PromptOptions = {
        ...baseOptions,
        allowedActions: ["move", "flag", "noop"],
      };

      const prompt = buildPrompt(baseEmail, options);

      expect(prompt).toContain('"move" | "flag" | "noop"');
      expect(prompt).not.toContain('"delete"');
      expect(prompt).not.toContain('"spam"');
    });

    it("schema excludes delete when using defaults", () => {
      const options: PromptOptions = {
        ...baseOptions,
        allowedActions: [...DEFAULT_ALLOWED_ACTIONS] as ActionType[],
      };

      const prompt = buildPrompt(baseEmail, options);

      expect(prompt).toContain('"move"');
      expect(prompt).toContain('"spam"');
      expect(prompt).toContain('"flag"');
      expect(prompt).toContain('"read"');
      expect(prompt).toContain('"noop"');
      expect(prompt).not.toMatch(/"delete"/);
    });

    it("uses full schema when all actions allowed", () => {
      const options: PromptOptions = {
        ...baseOptions,
        allowedActions: [...ALL_ACTION_TYPES] as ActionType[],
      };

      const prompt = buildPrompt(baseEmail, options);

      expect(prompt).toContain('"move" | "spam" | "flag" | "read" | "delete" | "noop"');
    });
  });
});

describe("Integration: Delete Action Safety", () => {
  it("delete is blocked by default workflow", () => {
    // Simulate LLM returning delete action
    const llmResponse: LlmAction[] = [
      { type: "delete", reason: "Delete this spam" },
    ];

    // When account has no allowed_actions configured, use defaults
    const accountAllowedActions = undefined;
    const effectiveAllowed = accountAllowedActions ?? [...DEFAULT_ALLOWED_ACTIONS];

    // Filter the actions
    const filtered = filterDisallowedActions(llmResponse, effectiveAllowed as ActionType[]);

    // Verify delete was blocked
    expect(filtered).toHaveLength(1);
    expect(filtered[0].type).toBe("noop");
    expect(filtered[0].reason).toContain("delete");
    expect(filtered[0].reason).toContain("not allowed");
  });

  it("delete is blocked when allowed_actions is empty array", () => {
    const llmResponse: LlmAction[] = [
      { type: "delete", reason: "Delete this" },
    ];

    // Empty array means nothing is allowed
    const accountAllowedActions: ActionType[] = [];
    const effectiveAllowed = accountAllowedActions.length > 0
      ? accountAllowedActions
      : [...DEFAULT_ALLOWED_ACTIONS];

    const filtered = filterDisallowedActions(llmResponse, effectiveAllowed as ActionType[]);

    expect(filtered[0].type).toBe("noop");
  });

  it("delete is only allowed when explicitly configured", () => {
    const llmResponse: LlmAction[] = [
      { type: "delete", reason: "User wants this deleted" },
    ];

    // Account explicitly allows delete
    const accountAllowedActions: ActionType[] = ["move", "delete", "noop"];

    const filtered = filterDisallowedActions(llmResponse, accountAllowedActions);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].type).toBe("delete");
    expect(filtered[0].reason).toBe("User wants this deleted");
  });

  it("prompt never shows delete option when using defaults", () => {
    const email: EmailContext = {
      from: "test@example.com",
      subject: "Test",
      date: "2026-01-15",
      body: "Test body",
    };

    const options: PromptOptions = {
      basePrompt: "Classify this email.",
      folderMode: "predefined",
      allowedActions: [...DEFAULT_ALLOWED_ACTIONS] as ActionType[],
    };

    const prompt = buildPrompt(email, options);

    // The schema should not contain delete as an option
    const schemaMatch = prompt.match(/"type":\s*([^,]+)/);
    expect(schemaMatch).toBeTruthy();
    expect(schemaMatch![1]).not.toContain("delete");
  });

  it("full workflow: unconfigured account blocks delete end-to-end", () => {
    // Step 1: Build prompt with defaults (no delete in schema)
    const email: EmailContext = {
      from: "spammer@example.com",
      subject: "You won!",
      date: "2026-01-15",
      body: "Click here to claim your prize",
    };

    const promptOptions: PromptOptions = {
      basePrompt: "Classify this email.",
      folderMode: "predefined",
      allowedActions: [...DEFAULT_ALLOWED_ACTIONS] as ActionType[],
    };

    const prompt = buildPrompt(email, promptOptions);

    // Verify prompt doesn't offer delete
    expect(prompt).toContain("DO NOT use these action types: delete");
    expect(prompt).not.toMatch(/"type":[^}]*"delete"/);

    // Step 2: Even if LLM somehow returns delete, it gets blocked
    const llmResponse: LlmAction[] = [
      { type: "delete", reason: "Obvious spam, delete it" },
    ];

    const filtered = filterDisallowedActions(llmResponse, [...DEFAULT_ALLOWED_ACTIONS] as ActionType[]);

    expect(filtered[0].type).toBe("noop");
    expect(filtered[0].type).not.toBe("delete");
  });
});
