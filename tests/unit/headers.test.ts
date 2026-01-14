import { describe, it, expect } from "vitest";
import { isPGPEncrypted, injectHeaders } from "../../src/processor/headers.js";
import type { LlmAction } from "../../src/llm/parser.js";

describe("isPGPEncrypted", () => {
  it("detects multipart/encrypted content type", () => {
    const source = Buffer.from(
      "Content-Type: multipart/encrypted; protocol=\"application/pgp-encrypted\"\r\n\r\nBody"
    );
    expect(isPGPEncrypted(source)).toBe(true);
  });

  it("detects application/pgp-encrypted content type", () => {
    const source = Buffer.from(
      "Content-Type: application/pgp-encrypted\r\n\r\nVersion: 1"
    );
    expect(isPGPEncrypted(source)).toBe(true);
  });

  it("detects application/pgp-signature content type", () => {
    const source = Buffer.from(
      "Content-Type: multipart/signed; protocol=\"application/pgp-signature\"\r\n\r\nSigned content"
    );
    expect(isPGPEncrypted(source)).toBe(true);
  });

  it("detects PGP message marker in body", () => {
    const source = Buffer.from(
      "Content-Type: text/plain\r\n\r\n-----BEGIN PGP MESSAGE-----\r\nhQEMA...\r\n-----END PGP MESSAGE-----"
    );
    expect(isPGPEncrypted(source)).toBe(true);
  });

  it("returns false for plain text email", () => {
    const source = Buffer.from(
      "Content-Type: text/plain\r\n\r\nHello, this is a plain text email."
    );
    expect(isPGPEncrypted(source)).toBe(false);
  });

  it("returns false for HTML email", () => {
    const source = Buffer.from(
      "Content-Type: text/html\r\n\r\n<html><body>Hello</body></html>"
    );
    expect(isPGPEncrypted(source)).toBe(false);
  });

  it("returns false for multipart/alternative", () => {
    const source = Buffer.from(
      "Content-Type: multipart/alternative; boundary=\"boundary\"\r\n\r\n--boundary\r\nContent-Type: text/plain\r\n\r\nText\r\n--boundary--"
    );
    expect(isPGPEncrypted(source)).toBe(false);
  });

  it("handles case-insensitive detection", () => {
    const source = Buffer.from(
      "CONTENT-TYPE: MULTIPART/ENCRYPTED\r\n\r\nBody"
    );
    expect(isPGPEncrypted(source)).toBe(true);
  });
});

describe("injectHeaders", () => {
  const sampleEmail = Buffer.from(
    "From: sender@example.com\r\n" +
    "To: recipient@example.com\r\n" +
    "Subject: Test Email\r\n" +
    "\r\n" +
    "This is the body."
  );

  it("injects X-Mailpilot-Processed header", () => {
    const actions: LlmAction[] = [{ type: "noop", reason: "test" }];
    const result = injectHeaders(sampleEmail, { actions, model: "gpt-4o-mini" });
    const resultStr = result.toString("utf-8");

    expect(resultStr).toContain("X-Mailpilot-Processed:");
    expect(resultStr).toMatch(/X-Mailpilot-Processed: \d{4}-\d{2}-\d{2}T/);
  });

  it("injects X-Mailpilot-Actions header", () => {
    const actions: LlmAction[] = [
      { type: "move", folder: "Archive" },
      { type: "flag", flags: ["Important", "Work"] },
    ];
    const result = injectHeaders(sampleEmail, { actions, model: "gpt-4o-mini" });
    const resultStr = result.toString("utf-8");

    expect(resultStr).toContain("X-Mailpilot-Actions: move:Archive, flag:Important+Work");
  });

  it("injects X-Mailpilot-Model header", () => {
    const actions: LlmAction[] = [{ type: "noop" }];
    const result = injectHeaders(sampleEmail, { actions, model: "gpt-4o-mini" });
    const resultStr = result.toString("utf-8");

    expect(resultStr).toContain("X-Mailpilot-Model: gpt-4o-mini");
  });

  it("injects X-Mailpilot-Analysis header when provided", () => {
    const actions: LlmAction[] = [{ type: "noop" }];
    const analysis = "This is the LLM analysis of the email.";
    const result = injectHeaders(sampleEmail, { actions, model: "gpt-4o-mini", analysis });
    const resultStr = result.toString("utf-8");

    expect(resultStr).toContain("X-Mailpilot-Analysis:");
    // Analysis should be base64 encoded
    const expectedB64 = Buffer.from(analysis).toString("base64");
    expect(resultStr).toContain(`X-Mailpilot-Analysis: ${expectedB64}`);
  });

  it("preserves original email body", () => {
    const actions: LlmAction[] = [{ type: "noop" }];
    const result = injectHeaders(sampleEmail, { actions, model: "gpt-4o-mini" });
    const resultStr = result.toString("utf-8");

    expect(resultStr).toContain("This is the body.");
  });

  it("preserves original headers", () => {
    const actions: LlmAction[] = [{ type: "noop" }];
    const result = injectHeaders(sampleEmail, { actions, model: "gpt-4o-mini" });
    const resultStr = result.toString("utf-8");

    expect(resultStr).toContain("From: sender@example.com");
    expect(resultStr).toContain("To: recipient@example.com");
    expect(resultStr).toContain("Subject: Test Email");
  });

  it("formats read action correctly", () => {
    const actions: LlmAction[] = [{ type: "read" }];
    const result = injectHeaders(sampleEmail, { actions, model: "gpt-4o-mini" });
    const resultStr = result.toString("utf-8");

    expect(resultStr).toContain("X-Mailpilot-Actions: read");
  });

  it("formats delete action correctly", () => {
    const actions: LlmAction[] = [{ type: "delete" }];
    const result = injectHeaders(sampleEmail, { actions, model: "gpt-4o-mini" });
    const resultStr = result.toString("utf-8");

    expect(resultStr).toContain("X-Mailpilot-Actions: delete");
  });

  it("formats spam action correctly", () => {
    const actions: LlmAction[] = [{ type: "spam" }];
    const result = injectHeaders(sampleEmail, { actions, model: "gpt-4o-mini" });
    const resultStr = result.toString("utf-8");

    expect(resultStr).toContain("X-Mailpilot-Actions: spam");
  });

  it("formats noop with reason correctly", () => {
    const actions: LlmAction[] = [{ type: "noop", reason: "Not sure what to do" }];
    const result = injectHeaders(sampleEmail, { actions, model: "gpt-4o-mini" });
    const resultStr = result.toString("utf-8");

    expect(resultStr).toContain("X-Mailpilot-Actions: noop:Not sure what to do");
  });

  it("formats multiple actions correctly", () => {
    const actions: LlmAction[] = [
      { type: "read" },
      { type: "flag", flags: ["Important"] },
      { type: "move", folder: "Work" },
    ];
    const result = injectHeaders(sampleEmail, { actions, model: "gpt-4o-mini" });
    const resultStr = result.toString("utf-8");

    expect(resultStr).toContain("X-Mailpilot-Actions: read, flag:Important, move:Work");
  });

  it("returns original buffer for malformed email without CRLF", () => {
    const malformed = Buffer.from("No CRLF in this email");
    const actions: LlmAction[] = [{ type: "noop" }];
    const result = injectHeaders(malformed, { actions, model: "gpt-4o-mini" });

    expect(result).toEqual(malformed);
  });
});
