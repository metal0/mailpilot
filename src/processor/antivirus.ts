import * as net from "node:net";
import type { AntivirusConfig } from "../config/schema.js";
import { createLogger } from "../utils/logger.js";
import { parseDuration } from "../utils/duration.js";

const logger = createLogger("antivirus");

export interface ScanResult {
  infected: boolean;
  virus?: string;
  error?: string;
}

export interface AntivirusScanner {
  scan(data: Buffer, filename: string): Promise<ScanResult>;
  ping(): Promise<boolean>;
}

export function createAntivirusScanner(
  config: AntivirusConfig
): AntivirusScanner {
  const timeout = parseDuration(config.timeout);

  return {
    async scan(data: Buffer, filename: string): Promise<ScanResult> {
      logger.debug("Scanning attachment", {
        filename,
        size: data.length,
      });

      try {
        const result = await sendCommand(
          config.host,
          config.port,
          timeout,
          "INSTREAM",
          data
        );

        const parsed = parseResponse(result);

        if (parsed.infected) {
          logger.warn("Virus detected", {
            filename,
            virus: parsed.virus,
          });
        } else {
          logger.debug("Attachment clean", { filename });
        }

        return parsed;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Antivirus scan failed", { filename, error: message });
        return { infected: false, error: message };
      }
    },

    async ping(): Promise<boolean> {
      try {
        const result = await sendCommand(
          config.host,
          config.port,
          timeout,
          "PING"
        );
        return result.trim() === "PONG";
      } catch {
        return false;
      }
    },
  };
}

async function sendCommand(
  host: string,
  port: number,
  timeout: number,
  command: string,
  data?: Buffer
): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const chunks: Buffer[] = [];

    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`ClamAV connection timeout after ${timeout}ms`));
    }, timeout);

    socket.on("connect", () => {
      if (command === "INSTREAM" && data) {
        // Send INSTREAM command
        socket.write(`z${command}\0`);

        // Send data in chunks (max 2KB per chunk for safety)
        const chunkSize = 2048;
        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.subarray(i, i + chunkSize);
          const lengthBuffer = Buffer.alloc(4);
          lengthBuffer.writeUInt32BE(chunk.length, 0);
          socket.write(lengthBuffer);
          socket.write(chunk);
        }

        // Send zero-length chunk to signal end
        const endBuffer = Buffer.alloc(4);
        endBuffer.writeUInt32BE(0, 0);
        socket.write(endBuffer);
      } else {
        // Simple command (PING, VERSION, etc.)
        socket.write(`z${command}\0`);
      }
    });

    socket.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    socket.on("end", () => {
      clearTimeout(timer);
      const response = Buffer.concat(chunks).toString("utf8");
      resolve(response);
    });

    socket.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    socket.connect(port, host);
  });
}

function parseResponse(response: string): ScanResult {
  const trimmed = response.trim().replace(/\0/g, "");

  // Response format: "stream: OK" or "stream: VirusName FOUND"
  if (trimmed.endsWith("OK")) {
    return { infected: false };
  }

  const foundMatch = /^stream:\s*(.+)\s+FOUND$/i.exec(trimmed);
  if (foundMatch?.[1]) {
    return { infected: true, virus: foundMatch[1].trim() };
  }

  // Error response
  if (trimmed.includes("ERROR")) {
    return { infected: false, error: trimmed };
  }

  // Unknown response - treat as error but not infected
  return { infected: false, error: `Unknown response: ${trimmed}` };
}
