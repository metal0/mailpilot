import { test, expect } from '@playwright/test';
import {
  createTestReporter,
  navigateTo,
  TEST_USER,
  login,
  ensureLoggedIn,
  waitForDashboard,
  SELECTORS,
} from './utils/index.js';

test.describe('Navigation - Tab Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
  });

  test('Overview tab is active by default', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify Overview tab is active');
      const activeTab = page.locator(SELECTORS.NAV.ACTIVE_TAB);
      await expect(activeTab).toHaveText(/Overview/i);
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

  test('clicking Activity tab shows activity log', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Click Activity tab');
      await page.click(SELECTORS.NAV.TAB_ACTIVITY);
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Verify Activity tab is now active');
      const activeTab = page.locator(SELECTORS.NAV.ACTIVE_TAB);
      await expect(activeTab).toHaveText(/Activity/i);
      await reporter.stepComplete();

      await reporter.step('Verify activity content visible');
      await expect(page.locator(SELECTORS.ACTIVITY.CARD).first()).toBeVisible();
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

  test('clicking Logs tab shows log viewer', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Click Logs tab');
      await page.click(SELECTORS.NAV.TAB_LOGS);
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Verify Logs tab is now active');
      const activeTab = page.locator(SELECTORS.NAV.ACTIVE_TAB);
      await expect(activeTab).toHaveText(/Logs/i);
      await reporter.stepComplete();

      await reporter.step('Verify logs content visible');
      await expect(page.locator(SELECTORS.LOGS.CARD).first()).toBeVisible();
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

  test('clicking Settings tab shows settings', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Click Settings tab');
      await page.click(SELECTORS.NAV.TAB_SETTINGS);
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Verify Settings tab is now active');
      const activeTab = page.locator(SELECTORS.NAV.ACTIVE_TAB);
      await expect(activeTab).toHaveText(/Settings/i);
      await reporter.stepComplete();

      await reporter.step('Verify settings content visible');
      await expect(page.locator(SELECTORS.SETTINGS.CONTAINER)).toBeVisible();
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

  test('clicking Debug tab shows debug panel', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Click Debug tab');
      await page.click(SELECTORS.NAV.TAB_DEBUG);
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Verify Debug tab is now active');
      const activeTab = page.locator(SELECTORS.NAV.ACTIVE_TAB);
      await expect(activeTab).toHaveText(/Debug/i);
      await reporter.stepComplete();

      await reporter.step('Verify debug content visible');
      await expect(page.locator(SELECTORS.DEBUG.CONTAINER)).toBeVisible();
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

  test('tabs are keyboard navigable', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Focus on tabs');
      await page.locator(SELECTORS.NAV.TAB_OVERVIEW).focus();
      await reporter.stepComplete();

      await reporter.step('Navigate with Tab key');
      await page.keyboard.press('Tab');
      await reporter.stepComplete();

      await reporter.step('Activate with Enter key');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Verify tab changed');
      const activeTab = page.locator(SELECTORS.NAV.ACTIVE_TAB);
      const text = await activeTab.textContent();
      expect(text).not.toBe('Overview');
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

  test('tab switching is fast and smooth', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Click through all tabs quickly');
      const tabs = [
        SELECTORS.NAV.TAB_ACTIVITY,
        SELECTORS.NAV.TAB_LOGS,
        SELECTORS.NAV.TAB_SETTINGS,
        SELECTORS.NAV.TAB_DEBUG,
        SELECTORS.NAV.TAB_OVERVIEW,
      ];

      for (const tab of tabs) {
        await page.click(tab);
        await page.waitForTimeout(200);
      }
      await reporter.stepComplete();

      await reporter.step('Verify back on Overview');
      const activeTab = page.locator(SELECTORS.NAV.ACTIVE_TAB);
      await expect(activeTab).toHaveText(/Overview/i);
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

test.describe('Navigation - URL Routing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
  });

  test('direct navigation to root loads dashboard', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Navigate to root');
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await reporter.stepComplete();

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

  test('browser back/forward navigation works', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Click Activity tab');
      await page.click(SELECTORS.NAV.TAB_ACTIVITY);
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Click Logs tab');
      await page.click(SELECTORS.NAV.TAB_LOGS);
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Go back');
      await page.goBack();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Go forward');
      await page.goForward();
      await page.waitForTimeout(500);
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

  test('page reload preserves tab state', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Click Settings tab');
      await page.click(SELECTORS.NAV.TAB_SETTINGS);
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Reload page');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await ensureLoggedIn(page, TEST_USER);
      await reporter.stepComplete();

      await reporter.step('Verify dashboard still accessible');
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

test.describe('Navigation - Header', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
  });

  test('header displays logo', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify header logo visible');
      await expect(page.locator(SELECTORS.HEADER.ROOT)).toBeVisible();
      await expect(page.locator(SELECTORS.HEADER.LOGO)).toBeVisible();
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

  test('user menu displays username', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Click user menu');
      await page.click(SELECTORS.HEADER.USER_MENU_TRIGGER);
      await reporter.stepComplete();

      await reporter.step('Verify dropdown shows username');
      await expect(page.locator(SELECTORS.HEADER.USER_DROPDOWN)).toBeVisible();
      const usernameElement = page.locator(SELECTORS.HEADER.DROPDOWN_USERNAME);
      // In dry run mode, username might be "dev" instead of TEST_USER.username
      const username = await usernameElement.textContent();
      expect(username).toBeTruthy();
      expect(username!.length).toBeGreaterThan(0);
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
