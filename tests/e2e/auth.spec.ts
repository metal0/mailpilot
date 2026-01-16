import { test, expect } from '@playwright/test';
import {
  createTestReporter,
  navigateTo,
  TEST_USER,
  login,
  logout,
  isLoggedIn,
  waitForDashboard,
  SELECTORS,
} from './utils/index.js';

/**
 * Helper to check if running in dry run mode
 * In dry run mode, auth is bypassed so auth tests should be skipped
 */
async function checkDryRunMode(request: any): Promise<boolean> {
  const authResponse = await request.get('/api/auth');
  const authData = await authResponse.json();
  return authData.dryRun === true;
}

test.describe('Authentication - Setup Flow', () => {
  test.describe.configure({ mode: 'serial' });

  test('setup page displays correctly when no users exist', async ({ page, request }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      if (await checkDryRunMode(request)) {
        reporter.complete('skip', 'Auth tests skipped in dry run mode');
        test.skip();
        return;
      }

      await reporter.step('Check auth status');
      const authResponse = await request.get('/api/auth');
      const authData = await authResponse.json();
      await reporter.stepComplete();

      if (!authData.needsSetup) {
        reporter.complete('skip', 'Users already exist, cannot test setup page');
        return;
      }

      await reporter.step('Navigate to root');
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await reporter.stepComplete();

      await reporter.step('Verify setup page elements');
      await expect(page.locator(SELECTORS.AUTH.CARD)).toBeVisible();
      await expect(page.locator(SELECTORS.AUTH.LOGO)).toBeVisible();
      await expect(page.locator(SELECTORS.AUTH.SUBTITLE)).toContainText(/create.*account/i);
      await expect(page.locator(SELECTORS.AUTH.USERNAME_INPUT)).toBeVisible();
      await expect(page.locator(SELECTORS.AUTH.PASSWORD_INPUT)).toBeVisible();
      await expect(page.locator(SELECTORS.AUTH.CONFIRM_INPUT)).toBeVisible();
      await expect(page.locator(SELECTORS.AUTH.SUBMIT_BUTTON)).toBeVisible();
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('setup validates username minimum length', async ({ page, request }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      if (await checkDryRunMode(request)) {
        reporter.complete('skip', 'Auth tests skipped in dry run mode');
        test.skip();
        return;
      }

      const authResponse = await request.get('/api/auth');
      const authData = await authResponse.json();
      if (!authData.needsSetup) {
        reporter.complete('skip', 'Users already exist');
        return;
      }

      await navigateTo(page, '/', reporter);

      await reporter.step('Enter short username (2 chars)');
      await page.fill(SELECTORS.AUTH.USERNAME_INPUT, 'ab');
      await page.fill(SELECTORS.AUTH.PASSWORD_INPUT, 'password123');
      await page.fill(SELECTORS.AUTH.CONFIRM_INPUT, 'password123');
      await reporter.stepComplete();

      await reporter.step('Submit form');
      await page.click(SELECTORS.AUTH.SUBMIT_BUTTON);
      await reporter.stepComplete();

      await reporter.step('Verify validation error');
      await expect(page.locator(SELECTORS.AUTH.ERROR)).toBeVisible();
      await expect(page.locator(SELECTORS.AUTH.ERROR)).toContainText(/username/i);
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('setup validates password minimum length', async ({ page, request }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      if (await checkDryRunMode(request)) {
        reporter.complete('skip', 'Auth tests skipped in dry run mode');
        test.skip();
        return;
      }

      const authResponse = await request.get('/api/auth');
      const authData = await authResponse.json();
      if (!authData.needsSetup) {
        reporter.complete('skip', 'Users already exist');
        return;
      }

      await navigateTo(page, '/', reporter);

      await reporter.step('Enter short password (7 chars)');
      await page.fill(SELECTORS.AUTH.USERNAME_INPUT, 'testuser');
      await page.fill(SELECTORS.AUTH.PASSWORD_INPUT, 'pass123');
      await page.fill(SELECTORS.AUTH.CONFIRM_INPUT, 'pass123');
      await reporter.stepComplete();

      await reporter.step('Submit form');
      await page.click(SELECTORS.AUTH.SUBMIT_BUTTON);
      await reporter.stepComplete();

      await reporter.step('Verify validation error');
      await expect(page.locator(SELECTORS.AUTH.ERROR)).toBeVisible();
      await expect(page.locator(SELECTORS.AUTH.ERROR)).toContainText(/password/i);
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('setup validates password confirmation matches', async ({ page, request }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      if (await checkDryRunMode(request)) {
        reporter.complete('skip', 'Auth tests skipped in dry run mode');
        test.skip();
        return;
      }

      const authResponse = await request.get('/api/auth');
      const authData = await authResponse.json();
      if (!authData.needsSetup) {
        reporter.complete('skip', 'Users already exist');
        return;
      }

      await navigateTo(page, '/', reporter);

      await reporter.step('Enter mismatched passwords');
      await page.fill(SELECTORS.AUTH.USERNAME_INPUT, 'testuser');
      await page.fill(SELECTORS.AUTH.PASSWORD_INPUT, 'password123');
      await page.fill(SELECTORS.AUTH.CONFIRM_INPUT, 'different123');
      await reporter.stepComplete();

      await reporter.step('Submit form');
      await page.click(SELECTORS.AUTH.SUBMIT_BUTTON);
      await reporter.stepComplete();

      await reporter.step('Verify validation error');
      await expect(page.locator(SELECTORS.AUTH.ERROR)).toBeVisible();
      await expect(page.locator(SELECTORS.AUTH.ERROR)).toContainText(/match/i);
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('setup form disables during submission', async ({ page, request }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      if (await checkDryRunMode(request)) {
        reporter.complete('skip', 'Auth tests skipped in dry run mode');
        test.skip();
        return;
      }

      const authResponse = await request.get('/api/auth');
      const authData = await authResponse.json();
      if (!authData.needsSetup) {
        reporter.complete('skip', 'Users already exist');
        return;
      }

      await navigateTo(page, '/', reporter);

      await reporter.step('Fill valid setup form');
      await page.fill(SELECTORS.AUTH.USERNAME_INPUT, 'newuser');
      await page.fill(SELECTORS.AUTH.PASSWORD_INPUT, 'password123');
      await page.fill(SELECTORS.AUTH.CONFIRM_INPUT, 'password123');
      await reporter.stepComplete();

      await reporter.step('Verify button enables');
      const submitButton = page.locator(SELECTORS.AUTH.SUBMIT_BUTTON);
      await expect(submitButton).toBeEnabled();
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });
});

test.describe('Authentication - Login Flow', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login page displays correctly', async ({ page, context, request }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      if (await checkDryRunMode(request)) {
        reporter.complete('skip', 'Auth tests skipped in dry run mode');
        test.skip();
        return;
      }

      await context.clearCookies();
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await reporter.step('Verify login page elements');
      await expect(page.locator(SELECTORS.AUTH.CARD)).toBeVisible({ timeout: 10000 });
      await expect(page.locator(SELECTORS.AUTH.USERNAME_INPUT)).toBeVisible();
      await expect(page.locator(SELECTORS.AUTH.PASSWORD_INPUT)).toBeVisible();
      await expect(page.locator(SELECTORS.AUTH.SUBMIT_BUTTON)).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Verify confirm field is hidden (login mode)');
      await expect(page.locator(SELECTORS.AUTH.CONFIRM_INPUT)).not.toBeVisible();
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('login with valid credentials succeeds', async ({ page, context, request }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      if (await checkDryRunMode(request)) {
        reporter.complete('skip', 'Auth tests skipped in dry run mode');
        test.skip();
        return;
      }

      await context.clearCookies();
      await navigateTo(page, '/', reporter);
      await login(page, TEST_USER, reporter);

      await reporter.step('Verify dashboard loaded');
      await expect(page.locator(SELECTORS.NAV.TABS)).toBeVisible();
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('login with invalid credentials shows error', async ({ page, context, request }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      if (await checkDryRunMode(request)) {
        reporter.complete('skip', 'Auth tests skipped in dry run mode');
        test.skip();
        return;
      }

      await context.clearCookies();
      await navigateTo(page, '/', reporter);

      await reporter.step('Enter invalid credentials');
      await page.fill(SELECTORS.AUTH.USERNAME_INPUT, 'wronguser');
      await page.fill(SELECTORS.AUTH.PASSWORD_INPUT, 'wrongpassword');
      await reporter.stepComplete();

      await reporter.step('Submit login form');
      await page.click(SELECTORS.AUTH.SUBMIT_BUTTON);
      await reporter.stepComplete();

      await reporter.step('Verify error message');
      await expect(page.locator(SELECTORS.AUTH.ERROR)).toBeVisible({ timeout: 5000 });
      await reporter.stepComplete();

      await reporter.step('Verify still on login page');
      await expect(page.locator(SELECTORS.AUTH.USERNAME_INPUT)).toBeVisible();
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('login with empty fields shows validation', async ({ page, context, request }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      if (await checkDryRunMode(request)) {
        reporter.complete('skip', 'Auth tests skipped in dry run mode');
        test.skip();
        return;
      }

      await context.clearCookies();
      await navigateTo(page, '/', reporter);

      await reporter.step('Click submit without filling fields');
      await page.click(SELECTORS.AUTH.SUBMIT_BUTTON);
      await reporter.stepComplete();

      await reporter.step('Verify still on login page');
      await expect(page.locator(SELECTORS.AUTH.USERNAME_INPUT)).toBeVisible();
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('login form disables during submission', async ({ page, context, request }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      if (await checkDryRunMode(request)) {
        reporter.complete('skip', 'Auth tests skipped in dry run mode');
        test.skip();
        return;
      }

      await context.clearCookies();
      await navigateTo(page, '/', reporter);

      await reporter.step('Fill login form');
      await page.fill(SELECTORS.AUTH.USERNAME_INPUT, TEST_USER.username);
      await page.fill(SELECTORS.AUTH.PASSWORD_INPUT, TEST_USER.password);
      await reporter.stepComplete();

      await reporter.step('Submit and check button state');
      const submitButton = page.locator(SELECTORS.AUTH.SUBMIT_BUTTON);
      await submitButton.click();

      // Button should be disabled during submission or redirect should occur
      await page.waitForSelector(SELECTORS.NAV.TABS, { timeout: 10000 });
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('login form is keyboard navigable', async ({ page, context, request }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      if (await checkDryRunMode(request)) {
        reporter.complete('skip', 'Auth tests skipped in dry run mode');
        test.skip();
        return;
      }

      await context.clearCookies();
      await navigateTo(page, '/', reporter);

      await reporter.step('Focus username field');
      await page.focus(SELECTORS.AUTH.USERNAME_INPUT);
      await page.keyboard.type(TEST_USER.username);
      await reporter.stepComplete();

      await reporter.step('Tab to password field');
      await page.keyboard.press('Tab');
      await page.keyboard.type(TEST_USER.password);
      await reporter.stepComplete();

      await reporter.step('Tab to submit and press Enter');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await reporter.stepComplete();

      await reporter.step('Verify login succeeded');
      await page.waitForSelector(SELECTORS.NAV.TABS, { timeout: 10000 });
      await expect(page.locator(SELECTORS.NAV.TABS)).toBeVisible();
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });
});

test.describe('Authentication - Session Management', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('logout clears session and redirects to login', async ({ page, context, request }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      if (await checkDryRunMode(request)) {
        reporter.complete('skip', 'Auth tests skipped in dry run mode');
        test.skip();
        return;
      }

      await context.clearCookies();
      await navigateTo(page, '/', reporter);
      await login(page, TEST_USER, reporter);
      await waitForDashboard(page, reporter);

      await logout(page, reporter);

      await reporter.step('Verify redirected to login');
      await expect(page.locator(SELECTORS.AUTH.USERNAME_INPUT)).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Verify not logged in');
      const loggedIn = await isLoggedIn(page);
      expect(loggedIn).toBe(false);
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('protected routes redirect to login when not authenticated', async ({ page, context, request }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      if (await checkDryRunMode(request)) {
        reporter.complete('skip', 'Auth tests skipped in dry run mode');
        test.skip();
        return;
      }

      await reporter.step('Clear cookies');
      await context.clearCookies();
      await reporter.stepComplete();

      await reporter.step('Navigate to root');
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await reporter.stepComplete();

      await reporter.step('Verify login page shown');
      await expect(page.locator(SELECTORS.AUTH.USERNAME_INPUT)).toBeVisible();
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });

  test('session persists across page refresh', async ({ page, context, request }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      if (await checkDryRunMode(request)) {
        reporter.complete('skip', 'Auth tests skipped in dry run mode');
        test.skip();
        return;
      }

      await context.clearCookies();
      await navigateTo(page, '/', reporter);
      await login(page, TEST_USER, reporter);
      await waitForDashboard(page, reporter);

      await reporter.step('Refresh page');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await reporter.stepComplete();

      await reporter.step('Verify still logged in');
      await expect(page.locator(SELECTORS.NAV.TABS)).toBeVisible({ timeout: 10000 });
      const loggedIn = await isLoggedIn(page);
      expect(loggedIn).toBe(true);
      await reporter.stepComplete();

      reporter.complete('pass');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(msg);
      reporter.complete('fail', msg);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });
});
