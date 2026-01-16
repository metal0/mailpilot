import { test, expect } from '@playwright/test';
import { createTestReporter } from './utils/index.js';

test.describe('API Endpoints', () => {
  test('health endpoint returns status ok', async ({ request }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      await reporter.step('GET /health');
      const response = await request.get('/health');
      await reporter.stepComplete();

      await reporter.step('Verify response status 200');
      expect(response.status()).toBe(200);
      await reporter.stepComplete();

      await reporter.step('Verify response body contains status: ok');
      const body = await response.json();
      expect(body).toHaveProperty('status', 'ok');
      await reporter.stepComplete();

      await reporter.step('Verify uptime is present');
      expect(body).toHaveProperty('uptime');
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(errorMessage);
      reporter.complete('fail', errorMessage);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('health endpoint returns accounts status', async ({ request }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      await reporter.step('GET /health');
      const response = await request.get('/health');
      await reporter.stepComplete();

      await reporter.step('Verify accounts info present');
      const body = await response.json();
      expect(body).toHaveProperty('accounts');
      expect(body.accounts).toHaveProperty('connected');
      expect(body.accounts).toHaveProperty('total');
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(errorMessage);
      reporter.complete('fail', errorMessage);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('non-existent endpoint returns 404', async ({ request }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      await reporter.step('GET /non-existent-endpoint');
      const response = await request.get('/non-existent-endpoint');
      await reporter.stepComplete();

      await reporter.step('Verify response status 404');
      expect(response.status()).toBe(404);
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(errorMessage);
      reporter.complete('fail', errorMessage);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });
});
