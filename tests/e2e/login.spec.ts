import { test, expect } from '@playwright/test';
import { createTestReporter, navigateTo } from './utils/index.js';

test.describe('Login Page', () => {
  // These tests require a fully configured app with auth setup
  // Skip in CI until we have proper test fixtures
  test.skip('redirects unauthenticated users to login', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Navigate to root');
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await reporter.stepComplete(true);

      await reporter.step('Verify redirected to login or setup');
      const url = page.url();
      const isLoginOrSetup = url.includes('/login') || url.includes('/setup');
      expect(isLoginOrSetup).toBe(true);
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

  test.skip('login form is displayed', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await navigateTo(page, '/', reporter);

      await reporter.step('Check for username/password inputs');
      const hasUsernameInput = await page.locator('input[type="text"], input[name="username"]').count();
      const hasPasswordInput = await page.locator('input[type="password"]').count();
      await reporter.stepComplete(true);

      await reporter.step('Verify form elements present');
      expect(hasUsernameInput + hasPasswordInput).toBeGreaterThanOrEqual(1);
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

  test.skip('empty credentials show validation error', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await navigateTo(page, '/', reporter);

      await reporter.step('Click submit without entering credentials');
      const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
      if (await submitButton.count() > 0) {
        await submitButton.first().click();
        await page.waitForTimeout(500);
      }
      await reporter.stepComplete(true);

      await reporter.step('Verify still on login page');
      const url = page.url();
      const stillOnAuth = url.includes('/login') || url.includes('/setup') || url === 'http://localhost:8085/';
      expect(stillOnAuth).toBe(true);
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
