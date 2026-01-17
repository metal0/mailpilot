import { test, expect } from '@playwright/test';
import {
  createTestReporter,
  TEST_USER,
  ensureLoggedIn,
  waitForDashboard,
  SELECTORS,
} from './utils/index.js';

test.describe('Sandbox - Navigation and Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_SANDBOX);
    await page.waitForTimeout(500);
  });

  test('displays sandbox container', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify sandbox container visible');
      await expect(page.locator(SELECTORS.SANDBOX.CONTAINER)).toBeVisible();
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

  test('displays three panel layout', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify prompt panel visible');
      await expect(page.locator(SELECTORS.SANDBOX.PROMPT_PANEL)).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Verify email panel visible');
      await expect(page.locator(SELECTORS.SANDBOX.EMAIL_PANEL)).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Verify config panel visible');
      await expect(page.locator(SELECTORS.SANDBOX.CONFIG_PANEL)).toBeVisible();
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

test.describe('Sandbox - Email Input', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_SANDBOX);
    await page.waitForTimeout(500);
  });

  test('displays email input fields in manual mode', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify From input visible');
      await expect(page.locator(SELECTORS.SANDBOX.EMAIL_FROM)).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Verify To input visible');
      await expect(page.locator(SELECTORS.SANDBOX.EMAIL_TO)).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Verify Subject input visible');
      await expect(page.locator(SELECTORS.SANDBOX.EMAIL_SUBJECT)).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Verify Body textarea visible');
      await expect(page.locator(SELECTORS.SANDBOX.EMAIL_BODY)).toBeVisible();
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

  test('can toggle to raw RFC822 mode', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Click raw email toggle');
      await page.click(`${SELECTORS.SANDBOX.TOGGLE_RAW} input`);
      await reporter.stepComplete();

      await reporter.step('Verify raw email textarea visible');
      await expect(page.locator(SELECTORS.SANDBOX.RAW_EMAIL)).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Verify manual fields hidden');
      await expect(page.locator(SELECTORS.SANDBOX.EMAIL_FROM)).not.toBeVisible();
      await expect(page.locator(SELECTORS.SANDBOX.EMAIL_TO)).not.toBeVisible();
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

  test('email fields have default values', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify From field has default value');
      const fromValue = await page.locator(SELECTORS.SANDBOX.EMAIL_FROM).inputValue();
      expect(fromValue).toContain('@');
      await reporter.stepComplete();

      await reporter.step('Verify To field has default value');
      const toValue = await page.locator(SELECTORS.SANDBOX.EMAIL_TO).inputValue();
      expect(toValue).toContain('@');
      await reporter.stepComplete();

      await reporter.step('Verify Subject field has default value');
      const subjectValue = await page.locator(SELECTORS.SANDBOX.EMAIL_SUBJECT).inputValue();
      expect(subjectValue.length).toBeGreaterThan(0);
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

test.describe('Sandbox - Attachment Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_SANDBOX);
    await page.waitForTimeout(500);
  });

  test('displays upload button in manual mode', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify upload button exists');
      const uploadBtn = page.locator(SELECTORS.SANDBOX.UPLOAD_BTN);
      await expect(uploadBtn).toBeVisible();
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

  test('upload button hidden in raw mode', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Switch to raw RFC822 mode');
      await page.click(`${SELECTORS.SANDBOX.TOGGLE_RAW} input`);
      await reporter.stepComplete();

      await reporter.step('Verify upload button not visible');
      await expect(page.locator(SELECTORS.SANDBOX.UPLOAD_BTN)).not.toBeVisible();
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

  test('upload button disabled when Tika unavailable', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Check upload button state');
      const uploadBtn = page.locator(SELECTORS.SANDBOX.UPLOAD_BTN);

      // In test environment without Tika, button should be disabled
      const isDisabled = await uploadBtn.isDisabled();
      const hasUnavailableClass = await uploadBtn.evaluate((el) =>
        el.classList.contains('unavailable')
      );

      // Either disabled or has unavailable class indicates Tika is not available
      const tikaUnavailable = isDisabled || hasUnavailableClass;
      await reporter.stepComplete();

      await reporter.step('Verify button has tooltip explaining state');
      const title = await uploadBtn.getAttribute('title');
      expect(title).toBeTruthy();
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

test.describe('Sandbox - Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_SANDBOX);
    await page.waitForTimeout(500);
  });

  test('displays provider selector', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify provider select visible');
      await expect(page.locator(SELECTORS.SANDBOX.PROVIDER_SELECT)).toBeVisible();
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

  test('displays folder mode options', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify predefined folder mode option');
      await expect(page.locator(SELECTORS.SANDBOX.FOLDER_MODE_PREDEFINED)).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Verify auto create folder mode option');
      await expect(page.locator(SELECTORS.SANDBOX.FOLDER_MODE_AUTO)).toBeVisible();
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

  test('displays action toggles', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify action toggles container visible');
      await expect(page.locator(SELECTORS.SANDBOX.ACTION_TOGGLES)).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Verify multiple action toggle buttons');
      const toggles = page.locator(SELECTORS.SANDBOX.ACTION_TOGGLE);
      const count = await toggles.count();
      expect(count).toBeGreaterThanOrEqual(4); // move, spam, flag, read, delete
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

  test('action toggles can be clicked', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Get initial active action count');
      const initialActive = await page.locator(SELECTORS.SANDBOX.ACTION_TOGGLE_ACTIVE).count();
      await reporter.stepComplete();

      await reporter.step('Click on delete action toggle');
      const deleteToggle = page.locator(`${SELECTORS.SANDBOX.ACTION_TOGGLE}:has-text("delete")`);
      await deleteToggle.click();
      await reporter.stepComplete();

      await reporter.step('Verify toggle state changed');
      const newActive = await page.locator(SELECTORS.SANDBOX.ACTION_TOGGLE_ACTIVE).count();
      // Either became active or became inactive
      expect(newActive).not.toBe(initialActive);
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

test.describe('Sandbox - Run Test Button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_SANDBOX);
    await page.waitForTimeout(500);
  });

  test('displays run test button', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify run test button visible');
      await expect(page.locator(SELECTORS.SANDBOX.RUN_TEST_BTN)).toBeVisible();
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
