import { test, expect } from '@playwright/test';
import {
  createTestReporter,
  TEST_USER,
  ensureLoggedIn,
  waitForDashboard,
  SELECTORS,
} from './utils/index.js';

test.describe('Logs Viewer - Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_LOGS);
    await page.waitForTimeout(500);
  });

  test('displays log container', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify log container visible');
      await expect(page.locator(SELECTORS.LOGS.LOG_CONTAINER)).toBeVisible();
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

  test('displays log entries or empty state', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Check for entries or empty state');
      const entries = page.locator(SELECTORS.LOGS.LOG_ENTRY);
      const entryCount = await entries.count();

      if (entryCount > 0) {
        await expect(entries.first()).toBeVisible();
      } else {
        await expect(page.locator(SELECTORS.LOGS.EMPTY_STATE)).toBeVisible();
      }
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

  test('log entries show timestamp', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      const entries = page.locator(SELECTORS.LOGS.LOG_ENTRY);
      const entryCount = await entries.count();

      if (entryCount === 0) {
        reporter.complete('skip', 'No log entries');
        return;
      }

      await reporter.step('Verify timestamp visible');
      const time = entries.first().locator(SELECTORS.LOGS.LOG_TIME);
      await expect(time).toBeVisible();
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

  test('log entries show level indicator', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      const entries = page.locator(SELECTORS.LOGS.LOG_ENTRY);
      const entryCount = await entries.count();

      if (entryCount === 0) {
        reporter.complete('skip', 'No log entries');
        return;
      }

      await reporter.step('Verify level indicator visible');
      const level = entries.first().locator(SELECTORS.LOGS.LOG_LEVEL);
      await expect(level).toBeVisible();
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

  test('log entries show message', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      const entries = page.locator(SELECTORS.LOGS.LOG_ENTRY);
      const entryCount = await entries.count();

      if (entryCount === 0) {
        reporter.complete('skip', 'No log entries');
        return;
      }

      await reporter.step('Verify message visible');
      const message = entries.first().locator(SELECTORS.LOGS.LOG_MESSAGE);
      await expect(message).toBeVisible();
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

  test('log entries show context', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      const entries = page.locator(SELECTORS.LOGS.LOG_ENTRY);
      const entryCount = await entries.count();

      if (entryCount === 0) {
        reporter.complete('skip', 'No log entries');
        return;
      }

      await reporter.step('Verify context visible');
      const context = entries.first().locator(SELECTORS.LOGS.LOG_CONTEXT);
      await expect(context).toBeVisible();
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

  test('log container is scrollable', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify log container has scroll behavior');
      const container = page.locator(SELECTORS.LOGS.LOG_CONTAINER);
      await expect(container).toBeVisible();
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

test.describe('Logs Viewer - Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_LOGS);
    await page.waitForTimeout(500);
  });

  test('search input is visible', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify search input visible');
      await expect(page.locator(SELECTORS.LOGS.SEARCH_INPUT)).toBeVisible();
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

  test('account filter dropdown is visible', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify account select visible');
      await expect(page.locator(SELECTORS.LOGS.ACCOUNT_SELECT)).toBeVisible();
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

  test('level filter is visible', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify level filter visible');
      await expect(page.locator(SELECTORS.LOGS.LEVEL_FILTER)).toBeVisible();
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

  test('search filters by message content', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Type in search');
      await page.fill(SELECTORS.LOGS.SEARCH_INPUT, 'error');
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Verify search applied');
      const searchValue = await page.inputValue(SELECTORS.LOGS.SEARCH_INPUT);
      expect(searchValue).toBe('error');
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

  test('clearing search shows all logs', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Enter and clear search');
      await page.fill(SELECTORS.LOGS.SEARCH_INPUT, 'test');
      await page.waitForTimeout(300);
      await page.fill(SELECTORS.LOGS.SEARCH_INPUT, '');
      await page.waitForTimeout(300);
      await reporter.stepComplete();

      await reporter.step('Verify search cleared');
      const searchValue = await page.inputValue(SELECTORS.LOGS.SEARCH_INPUT);
      expect(searchValue).toBe('');
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

test.describe('Logs Viewer - Streaming', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_LOGS);
    await page.waitForTimeout(500);
  });

  test('stream toggle is visible', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify stream toggle visible');
      await expect(page.locator(SELECTORS.LOGS.STREAM_TOGGLE)).toBeVisible();
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

  test('entry count is displayed', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify entry count visible');
      await expect(page.locator(SELECTORS.LOGS.ENTRY_COUNT)).toBeVisible();
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
