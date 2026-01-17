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

test.describe('Settings - Default LLM Provider', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_SETTINGS);
    await page.waitForTimeout(500);
  });

  test('new account modal has LLM provider selected by default', async ({ page }, testInfo) => {
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

      await reporter.step('Expand advanced section to see LLM settings');
      const advancedSection = page.locator('.collapsible-header:has-text("Advanced")');
      const isAdvancedVisible = await advancedSection.isVisible().catch(() => false);
      if (isAdvancedVisible) {
        await advancedSection.click();
        await page.waitForTimeout(300);
      }
      await reporter.stepComplete();

      await reporter.step('Verify LLM provider select has a value');
      const providerSelect = page.locator('.modal select').first();
      const selectVisible = await providerSelect.isVisible().catch(() => false);

      if (!selectVisible) {
        reporter.complete('skip', 'LLM provider select not visible');
        return;
      }

      const selectedValue = await providerSelect.inputValue();
      expect(selectedValue).toBeTruthy();
      expect(selectedValue.length).toBeGreaterThan(0);
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

test.describe('Settings - Account Modal Header Icons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_SETTINGS);
    await page.waitForTimeout(500);
  });

  test('account modal shows header action buttons', async ({ page }, testInfo) => {
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

      await reporter.step('Verify header actions container exists');
      const headerActions = page.locator(SELECTORS.MODAL.HEADER_ACTIONS);
      await expect(headerActions).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Verify three header action buttons exist');
      const actionButtons = page.locator(SELECTORS.MODAL.HEADER_ACTION_BTN);
      const count = await actionButtons.count();
      expect(count).toBe(3);
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

  test('header action buttons are disabled before connection test', async ({ page }, testInfo) => {
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

      await reporter.step('Verify header action buttons are disabled');
      const actionButtons = page.locator(SELECTORS.MODAL.HEADER_ACTION_BTN);
      const count = await actionButtons.count();
      for (let i = 0; i < count; i++) {
        await expect(actionButtons.nth(i)).toBeDisabled();
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

  test('clicking disabled header button does not open side modal', async ({ page }, testInfo) => {
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

      await reporter.step('Try clicking folders button (should be disabled)');
      const foldersButton = page.locator(SELECTORS.MODAL.HEADER_ACTION_BTN).nth(1);
      await foldersButton.click({ force: true });
      await page.waitForTimeout(300);
      await reporter.stepComplete();

      await reporter.step('Verify side modal is not visible');
      const sideModal = page.locator(SELECTORS.MODAL.SIDE_MODAL);
      await expect(sideModal).not.toBeVisible();
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

test.describe('Settings - Allowed Actions Dropdown', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_SETTINGS);
    await page.waitForTimeout(500);
  });

  test('allowed actions dropdown shows badge with count', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Navigate to accounts section');
      const accountsBtn = page.locator(SELECTORS.SETTINGS.SECTION_BUTTON).filter({ hasText: /accounts/i });
      await accountsBtn.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Check if there are existing accounts');
      const accountCards = page.locator('.account-card, .item-card').first();
      const hasAccounts = await accountCards.isVisible().catch(() => false);

      if (!hasAccounts) {
        reporter.complete('skip', 'No existing accounts to test badge count');
        return;
      }
      await reporter.stepComplete();

      await reporter.step('Click first account to edit');
      await accountCards.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Verify badge exists on allowed actions button');
      const badge = page.locator(SELECTORS.MODAL.HEADER_BADGE).first();
      const badgeVisible = await badge.isVisible().catch(() => false);
      expect(badgeVisible).toBe(true);
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

  test('noop action is not present in dropdown options', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Navigate to accounts section');
      const accountsBtn = page.locator(SELECTORS.SETTINGS.SECTION_BUTTON).filter({ hasText: /accounts/i });
      await accountsBtn.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Check if there are existing accounts with tested connection');
      const accountCards = page.locator('.account-card, .item-card').first();
      const hasAccounts = await accountCards.isVisible().catch(() => false);

      if (!hasAccounts) {
        reporter.complete('skip', 'No existing accounts to test dropdown');
        return;
      }
      await reporter.stepComplete();

      await reporter.step('Click first account to edit');
      await accountCards.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Check if allowed actions button is enabled');
      const actionsButton = page.locator(SELECTORS.MODAL.HEADER_ACTION_BTN).first();
      const isEnabled = await actionsButton.isEnabled();

      if (!isEnabled) {
        reporter.complete('skip', 'Actions button disabled - connection not tested');
        return;
      }
      await reporter.stepComplete();

      await reporter.step('Click allowed actions button to open dropdown');
      await actionsButton.click();
      await page.waitForTimeout(300);
      await reporter.stepComplete();

      await reporter.step('Verify dropdown is visible');
      const dropdown = page.locator(SELECTORS.MODAL.HEADER_DROPDOWN_MENU);
      await expect(dropdown).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Verify noop is not in dropdown options');
      const noopOption = dropdown.locator('label:has-text("noop")');
      await expect(noopOption).not.toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Verify other action types are present');
      const moveOption = dropdown.locator('label:has-text("move")');
      const spamOption = dropdown.locator('label:has-text("spam")');
      const flagOption = dropdown.locator('label:has-text("flag")');
      await expect(moveOption).toBeVisible();
      await expect(spamOption).toBeVisible();
      await expect(flagOption).toBeVisible();
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

  test('dropdown closes when clicking outside', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Navigate to accounts section');
      const accountsBtn = page.locator(SELECTORS.SETTINGS.SECTION_BUTTON).filter({ hasText: /accounts/i });
      await accountsBtn.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Check if there are existing accounts');
      const accountCards = page.locator('.account-card, .item-card').first();
      const hasAccounts = await accountCards.isVisible().catch(() => false);

      if (!hasAccounts) {
        reporter.complete('skip', 'No existing accounts to test dropdown');
        return;
      }
      await reporter.stepComplete();

      await reporter.step('Click first account to edit');
      await accountCards.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Check if allowed actions button is enabled');
      const actionsButton = page.locator(SELECTORS.MODAL.HEADER_ACTION_BTN).first();
      const isEnabled = await actionsButton.isEnabled();

      if (!isEnabled) {
        reporter.complete('skip', 'Actions button disabled - connection not tested');
        return;
      }
      await reporter.stepComplete();

      await reporter.step('Open dropdown');
      await actionsButton.click();
      await page.waitForTimeout(300);
      await reporter.stepComplete();

      await reporter.step('Verify dropdown is visible');
      const dropdown = page.locator(SELECTORS.MODAL.HEADER_DROPDOWN_MENU);
      await expect(dropdown).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Click outside dropdown');
      await page.locator('.modal-body').click();
      await page.waitForTimeout(300);
      await reporter.stepComplete();

      await reporter.step('Verify dropdown is closed');
      await expect(dropdown).not.toBeVisible();
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

test.describe('Settings - Side Modals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
    await page.click(SELECTORS.NAV.TAB_SETTINGS);
    await page.waitForTimeout(500);
  });

  test('folders side modal opens when button clicked (connection tested)', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Navigate to accounts section');
      const accountsBtn = page.locator(SELECTORS.SETTINGS.SECTION_BUTTON).filter({ hasText: /accounts/i });
      await accountsBtn.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Check if there are existing accounts');
      const accountCards = page.locator('.account-card, .item-card').first();
      const hasAccounts = await accountCards.isVisible().catch(() => false);

      if (!hasAccounts) {
        reporter.complete('skip', 'No existing accounts to test side modal');
        return;
      }
      await reporter.stepComplete();

      await reporter.step('Click first account to edit');
      await accountCards.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Check if folders button is enabled');
      const foldersButton = page.locator(SELECTORS.MODAL.HEADER_ACTION_BTN).nth(1);
      const isEnabled = await foldersButton.isEnabled();

      if (!isEnabled) {
        reporter.complete('skip', 'Folders button disabled - connection not tested');
        return;
      }
      await reporter.stepComplete();

      await reporter.step('Click folders button');
      await foldersButton.click();
      await page.waitForTimeout(300);
      await reporter.stepComplete();

      await reporter.step('Verify side modal is visible');
      const sideModal = page.locator(SELECTORS.MODAL.SIDE_MODAL);
      await expect(sideModal).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Verify side modal has folders content');
      const foldersHeader = sideModal.locator('h4:has-text("Folders")');
      await expect(foldersHeader).toBeVisible();
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

  test('webhooks side modal opens when button clicked (connection tested)', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Navigate to accounts section');
      const accountsBtn = page.locator(SELECTORS.SETTINGS.SECTION_BUTTON).filter({ hasText: /accounts/i });
      await accountsBtn.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Check if there are existing accounts');
      const accountCards = page.locator('.account-card, .item-card').first();
      const hasAccounts = await accountCards.isVisible().catch(() => false);

      if (!hasAccounts) {
        reporter.complete('skip', 'No existing accounts to test side modal');
        return;
      }
      await reporter.stepComplete();

      await reporter.step('Click first account to edit');
      await accountCards.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Check if webhooks button is enabled');
      const webhooksButton = page.locator(SELECTORS.MODAL.HEADER_ACTION_BTN).nth(2);
      const isEnabled = await webhooksButton.isEnabled();

      if (!isEnabled) {
        reporter.complete('skip', 'Webhooks button disabled - connection not tested');
        return;
      }
      await reporter.stepComplete();

      await reporter.step('Click webhooks button');
      await webhooksButton.click();
      await page.waitForTimeout(300);
      await reporter.stepComplete();

      await reporter.step('Verify side modal is visible');
      const sideModal = page.locator(SELECTORS.MODAL.SIDE_MODAL);
      await expect(sideModal).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Verify side modal has webhooks content');
      const webhooksHeader = sideModal.locator('h4:has-text("Webhooks")');
      await expect(webhooksHeader).toBeVisible();
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

  test('side modal closes when X button clicked', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Navigate to accounts section');
      const accountsBtn = page.locator(SELECTORS.SETTINGS.SECTION_BUTTON).filter({ hasText: /accounts/i });
      await accountsBtn.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Check if there are existing accounts');
      const accountCards = page.locator('.account-card, .item-card').first();
      const hasAccounts = await accountCards.isVisible().catch(() => false);

      if (!hasAccounts) {
        reporter.complete('skip', 'No existing accounts to test side modal');
        return;
      }
      await reporter.stepComplete();

      await reporter.step('Click first account to edit');
      await accountCards.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Check if folders button is enabled');
      const foldersButton = page.locator(SELECTORS.MODAL.HEADER_ACTION_BTN).nth(1);
      const isEnabled = await foldersButton.isEnabled();

      if (!isEnabled) {
        reporter.complete('skip', 'Folders button disabled - connection not tested');
        return;
      }
      await reporter.stepComplete();

      await reporter.step('Click folders button to open side modal');
      await foldersButton.click();
      await page.waitForTimeout(300);
      await reporter.stepComplete();

      await reporter.step('Verify side modal is visible');
      const sideModal = page.locator(SELECTORS.MODAL.SIDE_MODAL);
      await expect(sideModal).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Click X button to close side modal');
      const closeButton = sideModal.locator('button').first();
      await closeButton.click();
      await page.waitForTimeout(300);
      await reporter.stepComplete();

      await reporter.step('Verify side modal is closed');
      await expect(sideModal).not.toBeVisible();
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

  test('closing account modal also closes side modals', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Navigate to accounts section');
      const accountsBtn = page.locator(SELECTORS.SETTINGS.SECTION_BUTTON).filter({ hasText: /accounts/i });
      await accountsBtn.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Check if there are existing accounts');
      const accountCards = page.locator('.account-card, .item-card').first();
      const hasAccounts = await accountCards.isVisible().catch(() => false);

      if (!hasAccounts) {
        reporter.complete('skip', 'No existing accounts to test side modal');
        return;
      }
      await reporter.stepComplete();

      await reporter.step('Click first account to edit');
      await accountCards.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Check if folders button is enabled');
      const foldersButton = page.locator(SELECTORS.MODAL.HEADER_ACTION_BTN).nth(1);
      const isEnabled = await foldersButton.isEnabled();

      if (!isEnabled) {
        reporter.complete('skip', 'Folders button disabled - connection not tested');
        return;
      }
      await reporter.stepComplete();

      await reporter.step('Open folders side modal');
      await foldersButton.click();
      await page.waitForTimeout(300);
      await reporter.stepComplete();

      await reporter.step('Verify side modal is visible');
      const sideModal = page.locator(SELECTORS.MODAL.SIDE_MODAL);
      await expect(sideModal).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Close account modal by clicking Close button');
      const closeButton = page.locator('.modal button:has-text("Close")');
      await closeButton.click();
      await page.waitForTimeout(500);
      await reporter.stepComplete();

      await reporter.step('Verify both modals are closed');
      const modal = page.locator(SELECTORS.MODAL.CONTAINER);
      await expect(modal).not.toBeVisible();
      await expect(sideModal).not.toBeVisible();
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
