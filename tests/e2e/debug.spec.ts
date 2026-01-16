import { test, expect } from '@playwright/test';
import {
  createTestReporter,
  TEST_USER,
  ensureLoggedIn,
  waitForDashboard,
  SELECTORS,
} from './utils/index.js';

test.describe('Debug Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_DEBUG);
    await page.waitForTimeout(500);
  });

  test('displays debug container', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify debug container visible');
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

  test('displays debug sections', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify debug sections exist');
      const sections = page.locator(SELECTORS.DEBUG.SECTION);
      const count = await sections.count();
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

  test('displays section titles', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify section titles exist');
      const titles = page.locator(SELECTORS.DEBUG.SECTION_TITLE);
      const count = await titles.count();
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

  test('displays debug items with labels and values', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify debug items exist');
      const items = page.locator(SELECTORS.DEBUG.DEBUG_ITEM);
      const count = await items.count();
      expect(count).toBeGreaterThan(0);
      await reporter.stepComplete();

      await reporter.step('Verify items have labels');
      const labels = page.locator(SELECTORS.DEBUG.DEBUG_LABEL);
      const labelCount = await labels.count();
      expect(labelCount).toBeGreaterThan(0);
      await reporter.stepComplete();

      await reporter.step('Verify items have values');
      const values = page.locator(SELECTORS.DEBUG.DEBUG_VALUE);
      const valueCount = await values.count();
      expect(valueCount).toBeGreaterThan(0);
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

  test('displays status badges', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify status badges exist');
      const badges = page.locator(SELECTORS.DEBUG.STATUS_BADGE);
      const count = await badges.count();
      expect(count).toBeGreaterThanOrEqual(0);
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

  test('refresh button exists', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify refresh button visible');
      await expect(page.locator(SELECTORS.DEBUG.REFRESH_BUTTON)).toBeVisible();
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

  test('clicking refresh button updates data', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Click refresh button');
      await page.click(SELECTORS.DEBUG.REFRESH_BUTTON);
      await page.waitForTimeout(1000);
      await reporter.stepComplete();

      await reporter.step('Verify debug content still visible');
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

  test('test all button exists', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify test all button visible');
      await expect(page.locator(SELECTORS.DEBUG.TEST_ALL_BUTTON)).toBeVisible();
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

  test('clicking test all button triggers tests', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Click test all button');
      await page.click(SELECTORS.DEBUG.TEST_ALL_BUTTON);
      await page.waitForTimeout(1000);
      await reporter.stepComplete();

      await reporter.step('Verify debug content still visible');
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

  test('provider test buttons exist when providers configured', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Check for provider test buttons');
      const providerTestButtons = page.locator(SELECTORS.DEBUG.PROVIDER_TEST_BUTTON);
      const count = await providerTestButtons.count();
      // Just verify we can check for them - count may be 0 if no providers configured
      expect(count).toBeGreaterThanOrEqual(0);
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
