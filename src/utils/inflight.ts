import { createLogger } from "./logger.js";

const logger = createLogger("inflight");

interface InFlightOperation {
  startedAt: Date;
  description: string;
}

class InFlightTracker {
  private operations = new Map<string, InFlightOperation>();

  start(id: string, description: string): void {
    this.operations.set(id, { startedAt: new Date(), description });
    logger.debug("Operation started", { id, description, active: this.operations.size });
  }

  complete(id: string): void {
    const op = this.operations.get(id);
    if (op) {
      const durationMs = Date.now() - op.startedAt.getTime();
      this.operations.delete(id);
      logger.debug("Operation completed", { id, durationMs, active: this.operations.size });
    }
  }

  getActive(): Array<{ id: string; description: string; durationMs: number }> {
    const now = Date.now();
    return Array.from(this.operations.entries()).map(([id, op]) => ({
      id,
      description: op.description,
      durationMs: now - op.startedAt.getTime(),
    }));
  }

  getCount(): number {
    return this.operations.size;
  }

  async waitForAll(timeoutMs: number): Promise<boolean> {
    if (this.operations.size === 0) {
      return true;
    }

    const startTime = Date.now();
    const checkInterval = 100;

    return new Promise((resolve) => {
      const check = (): void => {
        if (this.operations.size === 0) {
          resolve(true);
          return;
        }

        if (Date.now() - startTime >= timeoutMs) {
          resolve(false);
          return;
        }

        setTimeout(check, checkInterval);
      };

      check();
    });
  }
}

export const inflightTracker = new InFlightTracker();
