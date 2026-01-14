import { describe, it, expect } from "vitest";
import { parseResponse } from "../../src/processor/antivirus.js";

// EICAR Anti-Malware Test File
// This is a safe test string recognized by all antivirus products
// See: https://www.eicar.org/download-anti-malware-testfile/
const EICAR_TEST_STRING =
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

describe("parseResponse", () => {
  describe("clean files", () => {
    it("returns clean result for OK response", () => {
      const result = parseResponse("stream: OK\0");
      expect(result.infected).toBe(false);
      expect(result.virus).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it("handles OK response without null terminator", () => {
      const result = parseResponse("stream: OK");
      expect(result.infected).toBe(false);
    });

    it("handles OK response with whitespace", () => {
      const result = parseResponse("  stream: OK  \n");
      expect(result.infected).toBe(false);
    });
  });

  describe("virus detection", () => {
    it("detects EICAR test file signature", () => {
      const result = parseResponse("stream: Win.Test.EICAR_HDB-1 FOUND\0");
      expect(result.infected).toBe(true);
      expect(result.virus).toBe("Win.Test.EICAR_HDB-1");
    });

    it("detects generic malware", () => {
      const result = parseResponse("stream: Win.Malware.Generic FOUND\0");
      expect(result.infected).toBe(true);
      expect(result.virus).toBe("Win.Malware.Generic");
    });

    it("detects trojan", () => {
      const result = parseResponse("stream: Trojan.Agent-123456 FOUND\0");
      expect(result.infected).toBe(true);
      expect(result.virus).toBe("Trojan.Agent-123456");
    });

    it("handles virus name with spaces", () => {
      const result = parseResponse("stream: Some Virus Name FOUND\0");
      expect(result.infected).toBe(true);
      expect(result.virus).toBe("Some Virus Name");
    });

    it("handles FOUND without null terminator", () => {
      const result = parseResponse("stream: TestVirus FOUND");
      expect(result.infected).toBe(true);
      expect(result.virus).toBe("TestVirus");
    });
  });

  describe("error responses", () => {
    it("handles INSTREAM size limit exceeded error", () => {
      const result = parseResponse(
        "stream: INSTREAM size limit exceeded ERROR\0"
      );
      expect(result.infected).toBe(false);
      expect(result.error).toContain("ERROR");
    });

    it("handles generic error response", () => {
      const result = parseResponse("ERROR: Could not open file\0");
      expect(result.infected).toBe(false);
      expect(result.error).toContain("ERROR");
    });

    it("handles unknown response format", () => {
      const result = parseResponse("unexpected response format");
      expect(result.infected).toBe(false);
      expect(result.error).toContain("Unknown response");
    });

    it("handles empty response", () => {
      const result = parseResponse("");
      expect(result.infected).toBe(false);
      expect(result.error).toContain("Unknown response");
    });
  });
});

describe("EICAR Test File", () => {
  it("has correct format and length", () => {
    // EICAR test file must be exactly 68 bytes
    expect(EICAR_TEST_STRING.length).toBe(68);

    // Must start with X5O!P%@AP
    expect(EICAR_TEST_STRING.startsWith("X5O!P%@AP")).toBe(true);

    // Must end with H+H*
    expect(EICAR_TEST_STRING.endsWith("H+H*")).toBe(true);
  });

  it("contains required EICAR signature", () => {
    // The EICAR test file must contain this exact substring
    expect(EICAR_TEST_STRING).toContain("EICAR-STANDARD-ANTIVIRUS-TEST-FILE");
  });

  it("can be converted to buffer for scanning", () => {
    const buffer = Buffer.from(EICAR_TEST_STRING);
    expect(buffer.length).toBe(68);
    expect(buffer.toString()).toBe(EICAR_TEST_STRING);
  });
});

describe("ClamAV protocol", () => {
  it("INSTREAM command format is correct", () => {
    // ClamAV expects null-terminated commands prefixed with 'z'
    const command = "zINSTREAM\0";
    expect(command.startsWith("z")).toBe(true);
    expect(command.endsWith("\0")).toBe(true);
  });

  it("PING command format is correct", () => {
    const command = "zPING\0";
    expect(command.startsWith("z")).toBe(true);
    expect(command.endsWith("\0")).toBe(true);
  });

  it("chunk length header is 4 bytes big-endian", () => {
    const chunkSize = 2048;
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32BE(chunkSize, 0);

    expect(lengthBuffer.length).toBe(4);
    expect(lengthBuffer.readUInt32BE(0)).toBe(chunkSize);
  });

  it("zero-length chunk signals end of stream", () => {
    const endBuffer = Buffer.alloc(4);
    endBuffer.writeUInt32BE(0, 0);

    expect(endBuffer.readUInt32BE(0)).toBe(0);
  });
});
