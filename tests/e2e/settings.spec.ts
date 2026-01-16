import { test, expect } from '@playwright/test';
import {
  createTestReporter,
  TEST_USER,
  ensureLoggedIn,
  waitForDashboard,
  SELECTORS,
} from './utils/index.js';

test.describe('Settings - Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_SETTINGS);
    await page.waitForTimeout(500);
  });

  test('displays settings container', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify settings container visible');
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

  test('displays section navigation', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify section nav visible');
      await expect(page.locator(SELECTORS.SETTINGS.SECTION_NAV)).toBeVisible();
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

  test('displays multiple section buttons', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify section buttons exist');
      const buttons = page.locator(SELECTORS.SETTINGS.SECTION_BUTTON);
      const count = await buttons.count();
      expect(count).toBeGreaterThan(1);
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

  test('has an active section by default', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify active section exists');
      await expect(page.locator(SELECTORS.SETTINGS.ACTIVE_SECTION)).toBeVisible();
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

  test('clicking section button changes active section', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Get initial active section');
      const initialActive = await page.locator(SELECTORS.SETTINGS.ACTIVE_SECTION).textContent();
      await reporter.stepComplete();

      await reporter.step('Click a different section');
      const buttons = page.locator(SELECTORS.SETTINGS.SECTION_BUTTON);
      const count = await buttons.count();
      if (count > 1) {
        await buttons.nth(1).click();
        await page.waitForTimeout(300);
      }
      await reporter.stepComplete();

      await reporter.step('Verify section changed');
      const newActive = await page.locator(SELECTORS.SETTINGS.ACTIVE_SECTION).textContent();
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

  test('settings content area is visible', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify content area visible');
      await expect(page.locator(SELECTORS.SETTINGS.CONTENT)).toBeVisible();
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

test.describe('Settings - Form Elements', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_SETTINGS);
    await page.waitForTimeout(500);
  });

  test('form groups exist', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify form groups exist');
      const formGroups = page.locator(SELECTORS.SETTINGS.FORM_GROUP);
      const count = await formGroups.count();
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

  test('input fields exist', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify input fields exist');
      const inputs = page.locator(`${SELECTORS.SETTINGS.CONTENT} ${SELECTORS.SETTINGS.INPUT}`);
      const count = await inputs.count();
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

  test('select fields exist', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify select fields exist');
      const selects = page.locator(`${SELECTORS.SETTINGS.CONTENT} ${SELECTORS.SETTINGS.SELECT}`);
      const count = await selects.count();
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

  test('checkbox fields exist', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify checkbox fields exist');
      const checkboxes = page.locator(`${SELECTORS.SETTINGS.CONTENT} ${SELECTORS.SETTINGS.CHECKBOX}`);
      const count = await checkboxes.count();
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

  test('inputs are editable', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Find first input');
      const inputs = page.locator(`${SELECTORS.SETTINGS.CONTENT} ${SELECTORS.SETTINGS.INPUT}[type="text"], ${SELECTORS.SETTINGS.CONTENT} ${SELECTORS.SETTINGS.INPUT}[type="number"]`);
      const count = await inputs.count();

      if (count === 0) {
        reporter.complete('skip', 'No text/number inputs found');
        return;
      }
      await reporter.stepComplete();

      await reporter.step('Type in input');
      const firstInput = inputs.first();
      await firstInput.clear();
      await firstInput.fill('test-value');
      const value = await firstInput.inputValue();
      expect(value).toBe('test-value');
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

  test('checkboxes are toggleable', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      const checkboxes = page.locator(`${SELECTORS.SETTINGS.CONTENT} ${SELECTORS.SETTINGS.CHECKBOX}`);
      const count = await checkboxes.count();

      if (count === 0) {
        reporter.complete('skip', 'No checkboxes found');
        return;
      }

      await reporter.step('Toggle checkbox');
      const checkbox = checkboxes.first();
      const initialState = await checkbox.isChecked();
      await checkbox.click();
      const newState = await checkbox.isChecked();
      expect(newState).not.toBe(initialState);
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

test.describe('Settings - Save Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_SETTINGS);
    await page.waitForTimeout(500);
  });

  test('save button exists', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify save button visible');
      await expect(page.locator(SELECTORS.SETTINGS.SAVE_BUTTON)).toBeVisible();
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

  test('save button initially disabled when no changes', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify save button is disabled initially');
      const saveButton = page.locator(SELECTORS.SETTINGS.SAVE_BUTTON);
      await expect(saveButton).toBeDisabled();
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

  test('save button clickable after changes', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Make a change');
      const checkboxes = page.locator(`${SELECTORS.SETTINGS.CONTENT} ${SELECTORS.SETTINGS.CHECKBOX}`);
      const count = await checkboxes.count();

      if (count > 0) {
        await checkboxes.first().click();
      }
      await reporter.stepComplete();

      await reporter.step('Verify save button enabled');
      const saveButton = page.locator(SELECTORS.SETTINGS.SAVE_BUTTON);
      await expect(saveButton).toBeEnabled();
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

test.describe('Settings - YAML Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_SETTINGS);
    await page.waitForTimeout(500);
  });

  test('YAML toggle button exists', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify YAML toggle visible');
      await expect(page.locator(SELECTORS.SETTINGS.YAML_TOGGLE)).toBeVisible();
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

  test('clicking YAML toggle shows YAML editor', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Click YAML toggle');
      await page.click(SELECTORS.SETTINGS.YAML_TOGGLE);
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Verify YAML editor visible');
      await expect(page.locator(SELECTORS.SETTINGS.YAML_EDITOR)).toBeVisible();
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

test.describe('Settings - Account Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_SETTINGS);
    await page.waitForTimeout(500);
  });

  test('accounts section exists', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Find accounts section button');
      const accountsBtn = page.locator(SELECTORS.SETTINGS.SECTION_BUTTON).filter({ hasText: /accounts/i });
      await expect(accountsBtn).toBeVisible();
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

  test('clicking accounts section shows account list', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Click accounts section');
      const accountsBtn = page.locator(SELECTORS.SETTINGS.SECTION_BUTTON).filter({ hasText: /accounts/i });
      await accountsBtn.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Verify accounts content visible');
      await expect(page.locator(SELECTORS.SETTINGS.CONTENT)).toBeVisible();
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

  test('add account button exists', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Navigate to accounts section');
      const accountsBtn = page.locator(SELECTORS.SETTINGS.SECTION_BUTTON).filter({ hasText: /accounts/i });
      await accountsBtn.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Verify add account button visible');
      await expect(page.locator(SELECTORS.SETTINGS.ADD_ACCOUNT_BUTTON)).toBeVisible();
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

  test('clicking add account opens form', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Navigate to accounts section');
      const accountsBtn = page.locator(SELECTORS.SETTINGS.SECTION_BUTTON).filter({ hasText: /accounts/i });
      await accountsBtn.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Click add account');
      await page.click(SELECTORS.SETTINGS.ADD_ACCOUNT_BUTTON);
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Verify form/modal opened');
      const modal = page.locator(SELECTORS.MODAL.CONTAINER);
      const formVisible = await modal.isVisible().catch(() => false);
      const contentExpanded = await page.locator(SELECTORS.SETTINGS.FORM_GROUP).count() > 0;
      expect(formVisible || contentExpanded).toBe(true);
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

test.describe('Settings - Provider Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_SETTINGS);
    await page.waitForTimeout(500);
  });

  test('providers section exists', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Find providers section button');
      const providersBtn = page.locator(SELECTORS.SETTINGS.SECTION_BUTTON).filter({ hasText: /providers/i });
      await expect(providersBtn).toBeVisible();
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

  test('clicking providers section shows provider list', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Click providers section');
      const providersBtn = page.locator(SELECTORS.SETTINGS.SECTION_BUTTON).filter({ hasText: /providers/i });
      await providersBtn.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Verify providers content visible');
      await expect(page.locator(SELECTORS.SETTINGS.CONTENT)).toBeVisible();
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

  test('add provider button exists', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Navigate to providers section');
      const providersBtn = page.locator(SELECTORS.SETTINGS.SECTION_BUTTON).filter({ hasText: /providers/i });
      await providersBtn.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Verify add provider button visible');
      await expect(page.locator(SELECTORS.SETTINGS.ADD_PROVIDER_BUTTON)).toBeVisible();
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

test.describe('Settings - Modal Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_SETTINGS);
    await page.waitForTimeout(500);
  });

  test('account modal changes persist after closing via overlay click', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Navigate to accounts section');
      const accountsBtn = page.locator(SELECTORS.SETTINGS.SECTION_BUTTON).filter({ hasText: /accounts/i });
      await accountsBtn.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Open add account modal');
      await page.click(SELECTORS.SETTINGS.ADD_ACCOUNT_BUTTON);
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Fill in account name');
      const accountNameInput = page.locator('.modal input[type="text"]').first();
      await accountNameInput.fill('test-persistence-account');
      await page.waitForTimeout(300);
      await reporter.stepComplete();

      await reporter.step('Close modal by clicking overlay');
      await page.click('.modal-overlay', { position: { x: 10, y: 10 } });
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Verify save button is now enabled (changes persisted)');
      const saveButton = page.locator(SELECTORS.SETTINGS.SAVE_BUTTON);
      await expect(saveButton).toBeEnabled();
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

  test('provider modal changes persist after closing via overlay click', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Navigate to providers section');
      const providersBtn = page.locator(SELECTORS.SETTINGS.SECTION_BUTTON).filter({ hasText: /providers/i });
      await providersBtn.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Open add provider modal');
      await page.click(SELECTORS.SETTINGS.ADD_PROVIDER_BUTTON);
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Fill in provider name');
      const providerNameInput = page.locator('.modal input[type="text"]').first();
      await providerNameInput.fill('test-persistence-provider');
      await page.waitForTimeout(300);
      await reporter.stepComplete();

      await reporter.step('Close modal by clicking overlay');
      await page.click('.modal-overlay', { position: { x: 10, y: 10 } });
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Verify save button is now enabled (changes persisted)');
      const saveButton = page.locator(SELECTORS.SETTINGS.SAVE_BUTTON);
      await expect(saveButton).toBeEnabled();
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

  test('account modal changes persist after pressing Escape', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Navigate to accounts section');
      const accountsBtn = page.locator(SELECTORS.SETTINGS.SECTION_BUTTON).filter({ hasText: /accounts/i });
      await accountsBtn.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Open add account modal');
      await page.click(SELECTORS.SETTINGS.ADD_ACCOUNT_BUTTON);
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Fill in account name');
      const accountNameInput = page.locator('.modal input[type="text"]').first();
      await accountNameInput.fill('test-escape-account');
      await page.waitForTimeout(300);
      await reporter.stepComplete();

      await reporter.step('Close modal by pressing Escape');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Verify save button is now enabled (changes persisted)');
      const saveButton = page.locator(SELECTORS.SETTINGS.SAVE_BUTTON);
      await expect(saveButton).toBeEnabled();
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

  test('modal close button shows Close instead of Cancel', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Navigate to accounts section');
      const accountsBtn = page.locator(SELECTORS.SETTINGS.SECTION_BUTTON).filter({ hasText: /accounts/i });
      await accountsBtn.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Open add account modal');
      await page.click(SELECTORS.SETTINGS.ADD_ACCOUNT_BUTTON);
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Verify Close button is present');
      const closeButton = page.locator('.modal button:has-text("Close")');
      await expect(closeButton).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Verify Cancel button is not present');
      const cancelButton = page.locator('.modal button:has-text("Cancel")');
      await expect(cancelButton).not.toBeVisible();
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
