import { test, expect } from '@playwright/test';
import { createTestReporter, navigateTo, assertVisible } from './utils/index.js';

test.describe('Dashboard', () => {
  // These tests require a fully configured app with auth setup
  // Skip in CI until we have proper test fixtures
  test.skip('loads and displays main navigation', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await navigateTo(page, '/', reporter);
      await reporter.step('Verify dashboard loaded');
      await expect(page).toHaveTitle(/Mailpilot/);
      await reporter.stepComplete(true);

      await assertVisible(page, 'nav', reporter);

      await reporter.step('Verify navigation links present');
      const nav = page.locator('nav');
      await expect(nav).toBeVisible();
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

  test.skip('navigates to settings page', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await navigateTo(page, '/', reporter);

      await reporter.step('Click settings link');
      await page.click('a[href="/settings"], button:has-text("Settings")');
      await page.waitForURL('**/settings**');
      await reporter.stepComplete(true);

      await reporter.step('Verify settings page loaded');
      await expect(page.locator('h1, h2')).toContainText(/settings/i);
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

test.describe('API Health', () => {
  test('health endpoint returns ok', async ({ request }, testInfo) => {
    const reporter = createTestReporter(testInfo);

    try {
      await reporter.step('GET /health');
      const response = await request.get('/health');
      await reporter.stepComplete();

      await reporter.step('Verify response status 200');
      expect(response.status()).toBe(200);
      await reporter.stepComplete();

      await reporter.step('Verify response body');
      const body = await response.json();
      expect(body).toHaveProperty('status', 'ok');
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
