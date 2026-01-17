import { describe, it, expect } from "vitest";
import { parseLlmResponse, generateResponseSchemaWithConfidence } from "../../src/llm/parser.js";

describe("parseLlmResponse", () => {
  it("parses valid JSON response", () => {
    const response = JSON.stringify({
      actions: [{ type: "move", folder: "Work", reason: "Work email" }],
    });

    const result = parseLlmResponse(response);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toEqual({
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

    const result = parseLlmResponse(response);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]?.type).toBe("spam");
  });

  it("handles multiple actions", () => {
    const response = JSON.stringify({
      actions: [
        { type: "move", folder: "Work" },
        { type: "flag", flags: ["\\Flagged"] },
        { type: "read" },
      ],
    });

    const result = parseLlmResponse(response);

    expect(result.actions).toHaveLength(3);
    expect(result.actions.map((a) => a.type)).toEqual(["move", "flag", "read"]);
  });

  it("returns noop for invalid JSON", () => {
    const result = parseLlmResponse("this is not json");

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]?.type).toBe("noop");
  });

  it("converts move without folder to noop", () => {
    const response = JSON.stringify({
      actions: [{ type: "move" }],
    });

    const result = parseLlmResponse(response);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]?.type).toBe("noop");
  });

  it("converts flag without flags to noop", () => {
    const response = JSON.stringify({
      actions: [{ type: "flag" }],
    });

    const result = parseLlmResponse(response);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]?.type).toBe("noop");
  });

  it("skips invalid actions but keeps valid ones", () => {
    const response = JSON.stringify({
      actions: [
        { type: "move", folder: "Work" },
        { type: "invalid_type" },
        { type: "noop" },
      ],
    });

    const result = parseLlmResponse(response);

    expect(result.actions).toHaveLength(2);
    expect(result.actions[0]?.type).toBe("move");
    expect(result.actions[1]?.type).toBe("noop");
  });

  it("parses confidence score when present", () => {
    const response = JSON.stringify({
      actions: [{ type: "move", folder: "Work" }],
      confidence: 0.85,
    });

    const result = parseLlmResponse(response);

    expect(result.actions).toHaveLength(1);
    expect(result.confidence).toBe(0.85);
  });

  it("parses reasoning when present", () => {
    const response = JSON.stringify({
      actions: [{ type: "spam" }],
      confidence: 0.95,
      reasoning: "Email contains typical spam patterns",
    });

    const result = parseLlmResponse(response);

    expect(result.actions).toHaveLength(1);
    expect(result.confidence).toBe(0.95);
    expect(result.reasoning).toBe("Email contains typical spam patterns");
  });

  it("handles missing confidence gracefully", () => {
    const response = JSON.stringify({
      actions: [{ type: "noop" }],
    });

    const result = parseLlmResponse(response);

    expect(result.actions).toHaveLength(1);
    expect(result.confidence).toBeUndefined();
    expect(result.reasoning).toBeUndefined();
  });

  it("validates confidence is within 0-1 range", () => {
    const response = JSON.stringify({
      actions: [{ type: "noop" }],
      confidence: 1.5,
    });

    const result = parseLlmResponse(response);

    expect(result.actions).toHaveLength(1);
    expect(result.confidence).toBeUndefined();
  });

  it("extracts confidence and reasoning even with partial action failures", () => {
    const response = JSON.stringify({
      actions: [
        { type: "move", folder: "Work" },
        { type: "invalid" },
      ],
      confidence: 0.7,
      reasoning: "Partial match",
    });

    const result = parseLlmResponse(response);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]?.type).toBe("move");
    expect(result.confidence).toBe(0.7);
    expect(result.reasoning).toBe("Partial match");
  });
});

describe("generateResponseSchemaWithConfidence", () => {
  it("generates schema without confidence fields by default", () => {
    const schema = generateResponseSchemaWithConfidence(["move", "noop"]);

    expect(schema).toContain('"move" | "noop"');
    expect(schema).not.toContain("confidence");
    expect(schema).not.toContain("reasoning");
  });

  it("includes confidence field when requested", () => {
    const schema = generateResponseSchemaWithConfidence(["move", "noop"], true);

    expect(schema).toContain("confidence");
    expect(schema).toContain("0.0-1.0");
  });

  it("includes reasoning field when requested", () => {
    const schema = generateResponseSchemaWithConfidence(["move", "noop"], false, true);

    expect(schema).toContain("reasoning");
  });

  it("includes both confidence and reasoning when both requested", () => {
    const schema = generateResponseSchemaWithConfidence(["move", "spam", "noop"], true, true);

    expect(schema).toContain("confidence");
    expect(schema).toContain("reasoning");
    expect(schema).toContain('"move" | "spam" | "noop"');
  });
});
