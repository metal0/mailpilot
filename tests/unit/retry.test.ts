import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { retry, retryIndefinitely, RetryError } from "../../src/utils/retry.js";

describe("Retry Utilities", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("retry", () => {
    describe("successful execution", () => {
      it("returns result on first attempt success", async () => {
        const fn = vi.fn().mockResolvedValue("success");
        const promise = retry(fn);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result).toBe("success");
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it("returns result after multiple failed attempts", async () => {
        const fn = vi.fn()
          .mockRejectedValueOnce(new Error("fail 1"))
          .mockRejectedValueOnce(new Error("fail 2"))
          .mockResolvedValue("success");

        const promise = retry(fn, { maxAttempts: 5, baseDelayMs: 100 });
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result).toBe("success");
        expect(fn).toHaveBeenCalledTimes(3);
      });

      it("handles various return types", async () => {
        const objectResult = { data: "test" };
        const arrayResult = [1, 2, 3];
        const nullResult = null;
        const undefinedResult = undefined;

        expect(await retry(() => Promise.resolve(objectResult))).toEqual(objectResult);
        expect(await retry(() => Promise.resolve(arrayResult))).toEqual(arrayResult);
        expect(await retry(() => Promise.resolve(nullResult))).toBe(null);
        expect(await retry(() => Promise.resolve(undefinedResult))).toBe(undefined);
      });

      it("passes function arguments correctly", async () => {
        const fn = vi.fn().mockResolvedValue("result");
        await retry(fn);
        expect(fn).toHaveBeenCalledWith();
      });
    });

    describe("exhausted retries", () => {
      it("throws RetryError after max attempts", async () => {
        vi.useRealTimers();
        const fn = vi.fn().mockRejectedValue(new Error("always fails"));

        await expect(retry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow(RetryError);
        expect(fn).toHaveBeenCalledTimes(3);
        vi.useFakeTimers();
      });

      it("RetryError contains attempt count", async () => {
        vi.useRealTimers();
        const fn = vi.fn().mockRejectedValue(new Error("fail"));

        try {
          await retry(fn, { maxAttempts: 5, baseDelayMs: 1 });
          expect.fail("Should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(RetryError);
          expect((error as RetryError).attempts).toBe(5);
        }
        vi.useFakeTimers();
      });

      it("RetryError contains last error", async () => {
        vi.useRealTimers();
        const lastError = new Error("final failure");
        const fn = vi.fn().mockRejectedValue(lastError);

        try {
          await retry(fn, { maxAttempts: 2, baseDelayMs: 1 });
        } catch (error) {
          expect((error as RetryError).lastError).toBe(lastError);
        }
        vi.useFakeTimers();
      });

      it("RetryError has correct message format", async () => {
        vi.useRealTimers();
        const fn = vi.fn().mockRejectedValue(new Error("fail"));

        try {
          await retry(fn, { maxAttempts: 4, baseDelayMs: 1 });
        } catch (error) {
          expect((error as RetryError).message).toBe("Failed after 4 attempts");
        }
        vi.useFakeTimers();
      });
    });

    describe("retryIf predicate", () => {
      it("retries when predicate returns true", async () => {
        const fn = vi.fn()
          .mockRejectedValueOnce(new Error("retriable"))
          .mockResolvedValue("success");

        const retryIf = vi.fn().mockReturnValue(true);

        const promise = retry(fn, {
          maxAttempts: 3,
          baseDelayMs: 100,
          retryIf,
        });
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result).toBe("success");
        expect(retryIf).toHaveBeenCalled();
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it("throws immediately when predicate returns false", async () => {
        const error = new Error("non-retriable");
        const fn = vi.fn().mockRejectedValue(error);
        const retryIf = vi.fn().mockReturnValue(false);

        await expect(retry(fn, {
          maxAttempts: 5,
          baseDelayMs: 100,
          retryIf,
        })).rejects.toThrow("non-retriable");

        expect(fn).toHaveBeenCalledTimes(1);
        expect(retryIf).toHaveBeenCalledWith(error);
      });

      it("predicate receives the error object", async () => {
        const error = new Error("test error");
        const fn = vi.fn().mockRejectedValue(error);
        const retryIf = vi.fn().mockReturnValue(false);

        await expect(retry(fn, { retryIf })).rejects.toThrow();

        expect(retryIf).toHaveBeenCalledWith(error);
      });

      it("predicate can use error type for filtering", async () => {
        class RetriableError extends Error {}
        class FatalError extends Error {}

        const retryIf = (err: unknown) => err instanceof RetriableError;

        const fn1 = vi.fn()
          .mockRejectedValueOnce(new RetriableError("retry me"))
          .mockResolvedValue("success");

        const promise1 = retry(fn1, {
          maxAttempts: 3,
          baseDelayMs: 100,
          retryIf,
        });
        await vi.runAllTimersAsync();
        expect(await promise1).toBe("success");

        const fn2 = vi.fn().mockRejectedValue(new FatalError("fatal"));
        await expect(retry(fn2, {
          maxAttempts: 3,
          baseDelayMs: 100,
          retryIf,
        })).rejects.toThrow("fatal");
        expect(fn2).toHaveBeenCalledTimes(1);
      });
    });

    describe("exponential backoff", () => {
      it("uses default backoff multiplier of 2", async () => {
        const fn = vi.fn()
          .mockRejectedValueOnce(new Error("1"))
          .mockRejectedValueOnce(new Error("2"))
          .mockRejectedValueOnce(new Error("3"))
          .mockResolvedValue("success");

        const promise = retry(fn, {
          maxAttempts: 4,
          baseDelayMs: 1000,
          backoffMultiplier: 2,
        });

        // After first failure, wait 1000ms
        expect(fn).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1000);
        expect(fn).toHaveBeenCalledTimes(2);

        // After second failure, wait 2000ms
        await vi.advanceTimersByTimeAsync(2000);
        expect(fn).toHaveBeenCalledTimes(3);

        // After third failure, wait 4000ms
        await vi.advanceTimersByTimeAsync(4000);
        expect(fn).toHaveBeenCalledTimes(4);

        expect(await promise).toBe("success");
      });

      it("respects maxDelayMs cap", async () => {
        const fn = vi.fn()
          .mockRejectedValueOnce(new Error("1"))
          .mockRejectedValueOnce(new Error("2"))
          .mockRejectedValueOnce(new Error("3"))
          .mockResolvedValue("success");

        const promise = retry(fn, {
          maxAttempts: 4,
          baseDelayMs: 1000,
          maxDelayMs: 1500,
          backoffMultiplier: 10,
        });

        // First delay: 1000ms
        await vi.advanceTimersByTimeAsync(1000);
        expect(fn).toHaveBeenCalledTimes(2);

        // Second delay: would be 10000ms but capped at 1500ms
        await vi.advanceTimersByTimeAsync(1500);
        expect(fn).toHaveBeenCalledTimes(3);

        // Third delay: still capped at 1500ms
        await vi.advanceTimersByTimeAsync(1500);
        expect(fn).toHaveBeenCalledTimes(4);

        expect(await promise).toBe("success");
      });

      it("uses custom backoff multiplier", async () => {
        const fn = vi.fn()
          .mockRejectedValueOnce(new Error("1"))
          .mockRejectedValueOnce(new Error("2"))
          .mockResolvedValue("success");

        const promise = retry(fn, {
          maxAttempts: 3,
          baseDelayMs: 100,
          backoffMultiplier: 3,
          maxDelayMs: 10000,
        });

        // First delay: 100ms
        await vi.advanceTimersByTimeAsync(100);
        expect(fn).toHaveBeenCalledTimes(2);

        // Second delay: 300ms (100 * 3)
        await vi.advanceTimersByTimeAsync(300);
        expect(fn).toHaveBeenCalledTimes(3);

        expect(await promise).toBe("success");
      });
    });

    describe("default options", () => {
      it("uses default maxAttempts of 3", async () => {
        vi.useRealTimers();
        const fn = vi.fn().mockRejectedValue(new Error("fail"));

        try {
          await retry(fn, { baseDelayMs: 1 });
        } catch (error) {
          expect((error as RetryError).attempts).toBe(3);
        }
        vi.useFakeTimers();
      });

      it("uses default baseDelayMs of 1000", async () => {
        const fn = vi.fn()
          .mockRejectedValueOnce(new Error("1"))
          .mockResolvedValue("success");

        const promise = retry(fn, { maxAttempts: 2 });

        expect(fn).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(999);
        expect(fn).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(fn).toHaveBeenCalledTimes(2);

        expect(await promise).toBe("success");
      });
    });

    describe("edge cases", () => {
      it("handles maxAttempts of 1", async () => {
        const fn = vi.fn().mockRejectedValue(new Error("fail"));

        await expect(retry(fn, { maxAttempts: 1 })).rejects.toThrow(RetryError);
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it("handles async function that throws synchronously", async () => {
        vi.useRealTimers();
        const fn = vi.fn().mockImplementation(() => {
          throw new Error("sync error");
        });

        try {
          await retry(fn, { maxAttempts: 2, baseDelayMs: 1 });
          expect.fail("Should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(RetryError);
          expect((error as RetryError).lastError).toBeInstanceOf(Error);
          expect(((error as RetryError).lastError as Error).message).toBe("sync error");
        }
        vi.useFakeTimers();
      });

      it("handles function returning rejected promise directly", async () => {
        vi.useRealTimers();
        const fn = vi.fn().mockImplementation(() => Promise.reject(new Error("rejected")));

        try {
          await retry(fn, { maxAttempts: 2, baseDelayMs: 1 });
          expect.fail("Should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(RetryError);
          expect((error as RetryError).lastError).toBeInstanceOf(Error);
          expect(((error as RetryError).lastError as Error).message).toBe("rejected");
        }
        vi.useFakeTimers();
      });

      it("handles non-Error objects thrown", async () => {
        vi.useRealTimers();
        const fn = vi.fn().mockRejectedValue("string error");

        try {
          await retry(fn, { maxAttempts: 2, baseDelayMs: 1 });
          expect.fail("Should have thrown");
        } catch (error) {
          expect((error as RetryError).lastError).toBe("string error");
        }
        vi.useFakeTimers();
      });

      it("handles null thrown", async () => {
        vi.useRealTimers();
        const fn = vi.fn().mockRejectedValue(null);

        try {
          await retry(fn, { maxAttempts: 2, baseDelayMs: 1 });
          expect.fail("Should have thrown");
        } catch (error) {
          expect((error as RetryError).lastError).toBe(null);
        }
        vi.useFakeTimers();
      });

      it("handles undefined thrown", async () => {
        vi.useRealTimers();
        const fn = vi.fn().mockRejectedValue(undefined);

        try {
          await retry(fn, { maxAttempts: 2, baseDelayMs: 1 });
          expect.fail("Should have thrown");
        } catch (error) {
          expect((error as RetryError).lastError).toBe(undefined);
        }
        vi.useFakeTimers();
      });
    });
  });

  describe("retryIndefinitely", () => {
    describe("network error handling", () => {
      it("retries on ECONNREFUSED", async () => {
        const error = new Error("Connection refused") as NodeJS.ErrnoException;
        error.code = "ECONNREFUSED";

        const fn = vi.fn()
          .mockRejectedValueOnce(error)
          .mockRejectedValueOnce(error)
          .mockResolvedValue("success");

        const promise = retryIndefinitely(fn, { baseDelayMs: 100 });
        await vi.runAllTimersAsync();

        expect(await promise).toBe("success");
        expect(fn).toHaveBeenCalledTimes(3);
      });

      it("retries on ECONNRESET", async () => {
        const error = new Error("Connection reset") as NodeJS.ErrnoException;
        error.code = "ECONNRESET";

        const fn = vi.fn()
          .mockRejectedValueOnce(error)
          .mockResolvedValue("success");

        const promise = retryIndefinitely(fn, { baseDelayMs: 100 });
        await vi.runAllTimersAsync();

        expect(await promise).toBe("success");
      });

      it("retries on ETIMEDOUT", async () => {
        const error = new Error("Connection timed out") as NodeJS.ErrnoException;
        error.code = "ETIMEDOUT";

        const fn = vi.fn()
          .mockRejectedValueOnce(error)
          .mockResolvedValue("success");

        const promise = retryIndefinitely(fn, { baseDelayMs: 100 });
        await vi.runAllTimersAsync();

        expect(await promise).toBe("success");
      });

      it("retries on ENOTFOUND", async () => {
        const error = new Error("DNS lookup failed") as NodeJS.ErrnoException;
        error.code = "ENOTFOUND";

        const fn = vi.fn()
          .mockRejectedValueOnce(error)
          .mockResolvedValue("success");

        const promise = retryIndefinitely(fn, { baseDelayMs: 100 });
        await vi.runAllTimersAsync();

        expect(await promise).toBe("success");
      });

      it("retries on EAI_AGAIN", async () => {
        const error = new Error("DNS temporary failure") as NodeJS.ErrnoException;
        error.code = "EAI_AGAIN";

        const fn = vi.fn()
          .mockRejectedValueOnce(error)
          .mockResolvedValue("success");

        const promise = retryIndefinitely(fn, { baseDelayMs: 100 });
        await vi.runAllTimersAsync();

        expect(await promise).toBe("success");
      });
    });

    describe("non-network error handling", () => {
      it("throws immediately on non-network errors", async () => {
        const error = new Error("Application error");
        const fn = vi.fn().mockRejectedValue(error);

        await expect(retryIndefinitely(fn, { baseDelayMs: 100 })).rejects.toThrow("Application error");
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it("throws immediately on Error without code", async () => {
        const error = new Error("Generic error");
        const fn = vi.fn().mockRejectedValue(error);

        await expect(retryIndefinitely(fn)).rejects.toThrow("Generic error");
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it("throws immediately on unknown error codes", async () => {
        const error = new Error("Unknown") as NodeJS.ErrnoException;
        error.code = "UNKNOWN_CODE";

        const fn = vi.fn().mockRejectedValue(error);

        await expect(retryIndefinitely(fn)).rejects.toThrow();
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it("throws immediately on non-Error objects", async () => {
        const fn = vi.fn().mockRejectedValue("string error");

        await expect(retryIndefinitely(fn)).rejects.toBe("string error");
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it("throws immediately on null", async () => {
        const fn = vi.fn().mockRejectedValue(null);

        await expect(retryIndefinitely(fn)).rejects.toBe(null);
        expect(fn).toHaveBeenCalledTimes(1);
      });
    });

    describe("exponential backoff", () => {
      it("uses exponential backoff with default multiplier", async () => {
        const error = new Error("Network error") as NodeJS.ErrnoException;
        error.code = "ECONNREFUSED";

        const fn = vi.fn()
          .mockRejectedValueOnce(error)
          .mockRejectedValueOnce(error)
          .mockRejectedValueOnce(error)
          .mockResolvedValue("success");

        const promise = retryIndefinitely(fn, {
          baseDelayMs: 1000,
          backoffMultiplier: 2,
          maxDelayMs: 30000,
        });

        // First delay: 1000ms
        await vi.advanceTimersByTimeAsync(1000);
        expect(fn).toHaveBeenCalledTimes(2);

        // Second delay: 2000ms
        await vi.advanceTimersByTimeAsync(2000);
        expect(fn).toHaveBeenCalledTimes(3);

        // Third delay: 4000ms
        await vi.advanceTimersByTimeAsync(4000);
        expect(fn).toHaveBeenCalledTimes(4);

        expect(await promise).toBe("success");
      });

      it("respects maxDelayMs cap", async () => {
        const error = new Error("Network error") as NodeJS.ErrnoException;
        error.code = "ECONNREFUSED";

        const fn = vi.fn()
          .mockRejectedValueOnce(error)
          .mockRejectedValueOnce(error)
          .mockResolvedValue("success");

        const promise = retryIndefinitely(fn, {
          baseDelayMs: 1000,
          maxDelayMs: 1200,
          backoffMultiplier: 10,
        });

        // First delay: 1000ms
        await vi.advanceTimersByTimeAsync(1000);
        expect(fn).toHaveBeenCalledTimes(2);

        // Second delay: would be 10000ms but capped at 1200ms
        await vi.advanceTimersByTimeAsync(1200);
        expect(fn).toHaveBeenCalledTimes(3);

        expect(await promise).toBe("success");
      });
    });

    describe("successful execution", () => {
      it("returns result on first success", async () => {
        const fn = vi.fn().mockResolvedValue({ data: "test" });

        const result = await retryIndefinitely(fn);

        expect(result).toEqual({ data: "test" });
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it("handles various return types", async () => {
        expect(await retryIndefinitely(() => Promise.resolve(42))).toBe(42);
        expect(await retryIndefinitely(() => Promise.resolve("string"))).toBe("string");
        expect(await retryIndefinitely(() => Promise.resolve(null))).toBe(null);
        expect(await retryIndefinitely(() => Promise.resolve([1, 2, 3]))).toEqual([1, 2, 3]);
      });
    });
  });

  describe("RetryError class", () => {
    it("is an instance of Error", () => {
      const error = new RetryError("message", 3, new Error("last"));
      expect(error).toBeInstanceOf(Error);
    });

    it("has correct name property", () => {
      const error = new RetryError("message", 3, new Error("last"));
      expect(error.name).toBe("RetryError");
    });

    it("has correct message", () => {
      const error = new RetryError("Custom message", 3, new Error("last"));
      expect(error.message).toBe("Custom message");
    });

    it("stores attempts count", () => {
      const error = new RetryError("message", 5, new Error("last"));
      expect(error.attempts).toBe(5);
    });

    it("stores last error", () => {
      const lastError = new Error("The last error");
      const error = new RetryError("message", 3, lastError);
      expect(error.lastError).toBe(lastError);
    });

    it("can store non-Error as lastError", () => {
      const lastError = { custom: "error object" };
      const error = new RetryError("message", 3, lastError);
      expect(error.lastError).toBe(lastError);
    });

    it("can store null as lastError", () => {
      const error = new RetryError("message", 3, null);
      expect(error.lastError).toBe(null);
    });

    it("can store undefined as lastError", () => {
      const error = new RetryError("message", 3, undefined);
      expect(error.lastError).toBe(undefined);
    });
  });
});
