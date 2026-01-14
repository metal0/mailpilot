import { describe, it, expect } from "vitest";
import { parseLlmResponse } from "../../src/llm/parser.js";

describe("parseLlmResponse", () => {
  it("parses valid JSON response", () => {
    const response = JSON.stringify({
      actions: [{ type: "move", folder: "Work", reason: "Work email" }],
    });

    const actions = parseLlmResponse(response);

    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({
      type: "move",
      folder: "Work",
      reason: "Work email",
    });
  });

  it("parses JSON wrapped in markdown code blocks", () => {
    const response = `
Here's my analysis:

\`\`\`json
{
  "actions": [{"type": "spam", "reason": "Obvious spam"}]
}
\`\`\`
    `;

    const actions = parseLlmResponse(response);

    expect(actions).toHaveLength(1);
    expect(actions[0]?.type).toBe("spam");
  });

  it("handles multiple actions", () => {
    const response = JSON.stringify({
      actions: [
        { type: "move", folder: "Work" },
        { type: "flag", flags: ["\\Flagged"] },
        { type: "read" },
      ],
    });

    const actions = parseLlmResponse(response);

    expect(actions).toHaveLength(3);
    expect(actions.map((a) => a.type)).toEqual(["move", "flag", "read"]);
  });

  it("returns noop for invalid JSON", () => {
    const actions = parseLlmResponse("this is not json");

    expect(actions).toHaveLength(1);
    expect(actions[0]?.type).toBe("noop");
  });

  it("converts move without folder to noop", () => {
    const response = JSON.stringify({
      actions: [{ type: "move" }],
    });

    const actions = parseLlmResponse(response);

    expect(actions).toHaveLength(1);
    expect(actions[0]?.type).toBe("noop");
  });

  it("converts flag without flags to noop", () => {
    const response = JSON.stringify({
      actions: [{ type: "flag" }],
    });

    const actions = parseLlmResponse(response);

    expect(actions).toHaveLength(1);
    expect(actions[0]?.type).toBe("noop");
  });

  it("skips invalid actions but keeps valid ones", () => {
    const response = JSON.stringify({
      actions: [
        { type: "move", folder: "Work" },
        { type: "invalid_type" },
        { type: "noop" },
      ],
    });

    const actions = parseLlmResponse(response);

    expect(actions).toHaveLength(2);
    expect(actions[0]?.type).toBe("move");
    expect(actions[1]?.type).toBe("noop");
  });
});
