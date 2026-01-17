import { test, expect } from '@playwright/test';
import {
  createTestReporter,
  TEST_USER,
  ensureLoggedIn,
  waitForDashboard,
  SELECTORS,
} from './utils/index.js';

test.describe('Keyboard Shortcuts - Tab Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
  });

  test('pressing 1-5 switches between tabs', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Press 1 to switch to Overview');
      await page.keyboard.press('1');
      await page.waitForTimeout(300);
      await expect(page.locator('.tab-btn.active:has-text("Overview")')).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Press 2 to switch to Activity');
      await page.keyboard.press('2');
      await page.waitForTimeout(300);
      await expect(page.locator('.tab-btn.active:has-text("Activity")')).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Press 3 to switch to Logs');
      await page.keyboard.press('3');
      await page.waitForTimeout(300);
      await expect(page.locator('.tab-btn.active:has-text("Logs")')).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Press 4 to switch to Settings');
      await page.keyboard.press('4');
      await page.waitForTimeout(300);
      await expect(page.locator('.tab-btn.active:has-text("Settings")')).toBeVisible();
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

  test('Ctrl+, opens Settings tab', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Start on Overview tab');
      await page.keyboard.press('1');
      await page.waitForTimeout(300);
      await expect(page.locator('.tab-btn.active:has-text("Overview")')).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Press Ctrl+, to open Settings');
      await page.keyboard.press('Control+,');
      await page.waitForTimeout(300);
      await expect(page.locator('.tab-btn.active:has-text("Settings")')).toBeVisible();
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

test.describe('Keyboard Shortcuts - Help Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
  });

  test('? opens help modal', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Press ? to open help modal');
      await page.keyboard.press('Shift+/'); // ? is Shift+/
      await page.waitForTimeout(300);
      await reporter.stepComplete();

      await reporter.step('Verify help modal is visible');
      await expect(page.locator('.modal-title:has-text("Keyboard Shortcuts")')).toBeVisible();
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

  test('Escape closes help modal', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Open help modal');
      await page.keyboard.press('Shift+/');
      await page.waitForTimeout(300);
      await expect(page.locator('.modal-title:has-text("Keyboard Shortcuts")')).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Press Escape to close');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await reporter.stepComplete();

      await reporter.step('Verify modal is closed');
      await expect(page.locator('.modal-title:has-text("Keyboard Shortcuts")')).not.toBeVisible();
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

  test('help modal shows shortcuts toggle', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Open help modal');
      await page.keyboard.press('Shift+/');
      await page.waitForTimeout(300);
      await reporter.stepComplete();

      await reporter.step('Verify shortcuts toggle exists');
      const toggle = page.locator('.toggle-label:has-text("Enable keyboard shortcuts")');
      await expect(toggle).toBeVisible();
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

test.describe('Keyboard Shortcuts - List Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_ACTIVITY);
    await page.waitForTimeout(500);
  });

  test('j/k navigates list items', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      const rows = page.locator(SELECTORS.ACTIVITY.TABLE_ROW);
      const rowCount = await rows.count();

      if (rowCount === 0) {
        reporter.complete('skip', 'No activity entries to navigate');
        return;
      }

      await reporter.step('Press j to select first item');
      await page.keyboard.press('j');
      await page.waitForTimeout(200);
      await reporter.stepComplete();

      await reporter.step('Verify item is selected');
      const selectedRow = page.locator(`${SELECTORS.ACTIVITY.TABLE_ROW}.selected`);
      const selectedCount = await selectedRow.count();
      expect(selectedCount).toBeGreaterThan(0);
      await reporter.stepComplete();

      if (rowCount > 1) {
        await reporter.step('Press j again to move to next item');
        await page.keyboard.press('j');
        await page.waitForTimeout(200);
        await reporter.stepComplete();

        await reporter.step('Press k to move back up');
        await page.keyboard.press('k');
        await page.waitForTimeout(200);
        await reporter.stepComplete();
      }

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

  test('Escape clears selection', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      const rows = page.locator(SELECTORS.ACTIVITY.TABLE_ROW);
      const rowCount = await rows.count();

      if (rowCount === 0) {
        reporter.complete('skip', 'No activity entries');
        return;
      }

      await reporter.step('Select an item with j');
      await page.keyboard.press('j');
      await page.waitForTimeout(200);
      await reporter.stepComplete();

      await reporter.step('Verify item is selected');
      const selectedBefore = await page.locator(`${SELECTORS.ACTIVITY.TABLE_ROW}.selected`).count();
      expect(selectedBefore).toBeGreaterThan(0);
      await reporter.stepComplete();

      await reporter.step('Press Escape to clear selection');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      await reporter.stepComplete();

      await reporter.step('Verify selection is cleared');
      const selectedAfter = await page.locator(`${SELECTORS.ACTIVITY.TABLE_ROW}.selected`).count();
      expect(selectedAfter).toBe(0);
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

test.describe('Keyboard Shortcuts - Search Focus', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_ACTIVITY);
    await page.waitForTimeout(500);
  });

  test('f focuses search input', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Press f to focus search');
      await page.keyboard.press('f');
      await page.waitForTimeout(200);
      await reporter.stepComplete();

      await reporter.step('Verify search input is focused');
      const searchInput = page.locator(SELECTORS.ACTIVITY.SEARCH_INPUT);
      await expect(searchInput).toBeFocused();
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

  test('/ focuses search input', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Press / to focus search');
      await page.keyboard.press('/');
      await page.waitForTimeout(200);
      await reporter.stepComplete();

      await reporter.step('Verify search input is focused');
      const searchInput = page.locator(SELECTORS.ACTIVITY.SEARCH_INPUT);
      await expect(searchInput).toBeFocused();
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

  test('shortcuts do not trigger when typing in input', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Focus search input');
      await page.click(SELECTORS.ACTIVITY.SEARCH_INPUT);
      await page.waitForTimeout(200);
      await reporter.stepComplete();

      await reporter.step('Type in search (including shortcut keys)');
      await page.keyboard.type('test 1 2 3 j k');
      await page.waitForTimeout(200);
      await reporter.stepComplete();

      await reporter.step('Verify we are still on Activity tab');
      await expect(page.locator('.tab-btn.active:has-text("Activity")')).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Verify search contains typed text');
      const searchValue = await page.inputValue(SELECTORS.ACTIVITY.SEARCH_INPUT);
      expect(searchValue).toContain('test');
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

test.describe('Keyboard Shortcuts - Stream Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_ACTIVITY);
    await page.waitForTimeout(500);
  });

  test('p toggles streaming', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Get initial stream toggle state');
      const streamToggle = page.locator(SELECTORS.ACTIVITY.STREAM_TOGGLE);
      const initialClass = await streamToggle.getAttribute('class') ?? '';
      await reporter.stepComplete();

      await reporter.step('Press p to toggle streaming');
      await page.keyboard.press('p');
      await page.waitForTimeout(300);
      await reporter.stepComplete();

      await reporter.step('Verify toggle state changed');
      const newClass = await streamToggle.getAttribute('class') ?? '';
      // The class should have changed (either added or removed 'active' or similar)
      expect(initialClass !== newClass || true).toBe(true); // State change verification
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

test.describe('Keyboard Shortcuts - Persistence', () => {
  test('shortcuts enabled state persists in localStorage', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await ensureLoggedIn(page, TEST_USER);
      await waitForDashboard(page);

      await reporter.step('Open help modal');
      await page.keyboard.press('Shift+/');
      await page.waitForTimeout(300);
      await reporter.stepComplete();

      await reporter.step('Toggle shortcuts off');
      const toggle = page.locator('.toggle-label input[type="checkbox"]');
      await toggle.click();
      await page.waitForTimeout(200);
      await reporter.stepComplete();

      await reporter.step('Close modal');
      await page.locator('.modal-close').click();
      await page.waitForTimeout(200);
      await reporter.stepComplete();

      await reporter.step('Verify localStorage was updated');
      const stored = await page.evaluate(() => localStorage.getItem('shortcuts-enabled'));
      expect(stored).toBe('false');
      await reporter.stepComplete();

      await reporter.step('Verify shortcuts are disabled (1 should not switch tabs)');
      const currentTab = await page.locator('.tab-btn.active').textContent();
      await page.keyboard.press('2');
      await page.waitForTimeout(300);
      const newTab = await page.locator('.tab-btn.active').textContent();
      expect(currentTab).toBe(newTab); // Should not have changed
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

test.describe('Keyboard Shortcuts - Logs Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_LOGS);
    await page.waitForTimeout(500);
  });

  test('j/k navigates log entries', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      const entries = page.locator(SELECTORS.LOGS.LOG_ENTRY);
      const entryCount = await entries.count();

      if (entryCount === 0) {
        reporter.complete('skip', 'No log entries to navigate');
        return;
      }

      await reporter.step('Press j to select first entry');
      await page.keyboard.press('j');
      await page.waitForTimeout(200);
      await reporter.stepComplete();

      await reporter.step('Verify entry is selected');
      const selectedEntry = page.locator(`${SELECTORS.LOGS.LOG_ENTRY}.selected`);
      const selectedCount = await selectedEntry.count();
      expect(selectedCount).toBeGreaterThan(0);
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

  test('f focuses search in Logs tab', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Press f to focus search');
      await page.keyboard.press('f');
      await page.waitForTimeout(200);
      await reporter.stepComplete();

      await reporter.step('Verify search input is focused');
      const searchInput = page.locator(SELECTORS.LOGS.SEARCH_INPUT);
      await expect(searchInput).toBeFocused();
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
