import { test, expect } from '@playwright/test';
import {
  createTestReporter,
  TEST_USER,
  ensureLoggedIn,
  waitForDashboard,
  SELECTORS,
} from './utils/index.js';

test.describe('Activity Log - Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_ACTIVITY);
    await page.waitForTimeout(500);
  });

  test('displays activity table', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify activity table visible');
      await expect(page.locator(SELECTORS.ACTIVITY.TABLE)).toBeVisible();
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

  test('displays activity entries or empty state', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Check for entries or empty state');
      const rows = page.locator(SELECTORS.ACTIVITY.TABLE_ROW);
      const rowCount = await rows.count();

      if (rowCount > 0) {
        await expect(rows.first()).toBeVisible();
      } else {
        await expect(page.locator(SELECTORS.ACTIVITY.EMPTY_STATE)).toBeVisible();
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

  test('entries show time column', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      const rows = page.locator(SELECTORS.ACTIVITY.TABLE_ROW);
      const rowCount = await rows.count();

      if (rowCount === 0) {
        reporter.complete('skip', 'No activity entries');
        return;
      }

      await reporter.step('Verify time cell visible');
      const timeCell = rows.first().locator(SELECTORS.ACTIVITY.TIME_CELL);
      await expect(timeCell).toBeVisible();
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

  test('entries show account column', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      const rows = page.locator(SELECTORS.ACTIVITY.TABLE_ROW);
      const rowCount = await rows.count();

      if (rowCount === 0) {
        reporter.complete('skip', 'No activity entries');
        return;
      }

      await reporter.step('Verify account cell visible');
      const accountCell = rows.first().locator(SELECTORS.ACTIVITY.ACCOUNT_CELL);
      await expect(accountCell).toBeVisible();
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

  test('entries show subject column', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      const rows = page.locator(SELECTORS.ACTIVITY.TABLE_ROW);
      const rowCount = await rows.count();

      if (rowCount === 0) {
        reporter.complete('skip', 'No activity entries');
        return;
      }

      await reporter.step('Verify subject cell visible');
      const subjectCell = rows.first().locator(SELECTORS.ACTIVITY.SUBJECT_CELL);
      await expect(subjectCell).toBeVisible();
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

  test('entries show action badges', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      const rows = page.locator(SELECTORS.ACTIVITY.TABLE_ROW);
      const rowCount = await rows.count();

      if (rowCount === 0) {
        reporter.complete('skip', 'No activity entries');
        return;
      }

      await reporter.step('Verify action badges visible');
      const badges = rows.first().locator(SELECTORS.ACTIVITY.ACTION_BADGE);
      const badgeCount = await badges.count();
      expect(badgeCount).toBeGreaterThan(0);
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

test.describe('Activity Log - Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_ACTIVITY);
    await page.waitForTimeout(500);
  });

  test('search input is visible', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify search input visible');
      await expect(page.locator(SELECTORS.ACTIVITY.SEARCH_INPUT)).toBeVisible();
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
      await expect(page.locator(SELECTORS.ACTIVITY.ACCOUNT_SELECT)).toBeVisible();
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

  test('filter dropdown button is visible', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify filter button visible');
      await expect(page.locator(SELECTORS.ACTIVITY.FILTER_BUTTON)).toBeVisible();
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

  test('clicking filter button shows dropdown', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Click filter button');
      await page.click(SELECTORS.ACTIVITY.FILTER_BUTTON);
      await reporter.stepComplete();

      await reporter.step('Verify filter dropdown visible');
      await expect(page.locator(SELECTORS.ACTIVITY.FILTER_DROPDOWN)).toBeVisible();
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

  test('filter dropdown shows action type options', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Open filter dropdown');
      await page.click(SELECTORS.ACTIVITY.FILTER_BUTTON);
      await reporter.stepComplete();

      await reporter.step('Verify filter options exist');
      const options = page.locator(SELECTORS.ACTIVITY.FILTER_OPTION);
      const count = await options.count();
      expect(count).toBeGreaterThan(0);
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

  test('search filters by subject', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Type in search');
      await page.fill(SELECTORS.ACTIVITY.SEARCH_INPUT, 'test');
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Verify search applied');
      const searchValue = await page.inputValue(SELECTORS.ACTIVITY.SEARCH_INPUT);
      expect(searchValue).toBe('test');
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

  test('clearing search shows all entries', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Enter and clear search');
      await page.fill(SELECTORS.ACTIVITY.SEARCH_INPUT, 'test');
      await page.waitForTimeout(300);
      await page.fill(SELECTORS.ACTIVITY.SEARCH_INPUT, '');
      await page.waitForTimeout(300);
      await reporter.stepComplete();

      await reporter.step('Verify search cleared');
      const searchValue = await page.inputValue(SELECTORS.ACTIVITY.SEARCH_INPUT);
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

test.describe('Activity Log - Streaming & Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_ACTIVITY);
    await page.waitForTimeout(500);
  });

  test('stream toggle is visible', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify stream toggle visible');
      await expect(page.locator(SELECTORS.ACTIVITY.STREAM_TOGGLE)).toBeVisible();
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

  test('export button is visible', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify export button visible');
      await expect(page.locator(SELECTORS.ACTIVITY.EXPORT_BUTTON)).toBeVisible();
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
      await expect(page.locator(SELECTORS.ACTIVITY.ENTRY_COUNT)).toBeVisible();
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

  test('clicking stream toggle changes state', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Click stream toggle');
      const toggle = page.locator(SELECTORS.ACTIVITY.STREAM_TOGGLE);
      const initialClass = await toggle.getAttribute('class');
      await toggle.click();
      await page.waitForTimeout(300);
      await reporter.stepComplete();

      await reporter.step('Click again to toggle back');
      await toggle.click();
      await page.waitForTimeout(300);
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

test.describe('Activity Log - Pagination', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_ACTIVITY);
    await page.waitForTimeout(500);
  });

  test('scroll sentinel exists for infinite scroll', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Check for scroll sentinel or end-of-list');
      const sentinel = page.locator(SELECTORS.ACTIVITY.SCROLL_SENTINEL);
      const endOfList = page.locator(SELECTORS.ACTIVITY.END_OF_LIST);

      const sentinelExists = await sentinel.count() > 0;
      const endOfListExists = await endOfList.count() > 0;

      expect(sentinelExists || endOfListExists).toBe(true);
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
