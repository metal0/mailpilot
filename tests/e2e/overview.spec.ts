import { test, expect } from '@playwright/test';
import {
  createTestReporter,
  TEST_USER,
  ensureLoggedIn,
  waitForDashboard,
  SELECTORS,
} from './utils/index.js';

test.describe('Overview - Stats Cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
  });

  test('displays stats grid', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify stats grid visible');
      await expect(page.locator(SELECTORS.STATS.GRID)).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Verify multiple stat cards exist');
      const cards = page.locator(SELECTORS.STATS.CARD);
      const count = await cards.count();
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

  test('displays accounts stat card', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Find accounts stat card');
      const accountsCard = page.locator(SELECTORS.STATS.CARD).filter({ hasText: /accounts/i });
      await expect(accountsCard).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Verify card has value');
      const value = accountsCard.locator(SELECTORS.STATS.VALUE);
      await expect(value).toBeVisible();
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

  test('displays uptime stat card', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Find uptime stat card');
      const uptimeCard = page.locator(SELECTORS.STATS.CARD).filter({ hasText: /uptime/i });
      await expect(uptimeCard).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Verify card shows duration format');
      const value = uptimeCard.locator(SELECTORS.STATS.VALUE);
      await expect(value).toBeVisible();
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

  test('displays processed emails stat card', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Find processed stat card');
      const processedCard = page.locator(SELECTORS.STATS.CARD).filter({ hasText: /processed/i });
      await expect(processedCard).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Verify card has numeric value');
      const value = processedCard.locator(SELECTORS.STATS.VALUE);
      await expect(value).toBeVisible();
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

  test('displays actions taken stat card', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Find actions stat card');
      const actionsCard = page.locator(SELECTORS.STATS.CARD).filter({ hasText: /actions/i });
      await expect(actionsCard).toBeVisible();
      await reporter.stepComplete();

      await reporter.step('Verify card has value');
      const value = actionsCard.locator(SELECTORS.STATS.VALUE);
      await expect(value).toBeVisible();
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

  test('stat cards have labels', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify all cards have labels');
      const cards = page.locator(SELECTORS.STATS.CARD);
      const count = await cards.count();

      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        const label = card.locator(SELECTORS.STATS.LABEL);
        await expect(label).toBeVisible();
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

  test('stat cards have icons', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify cards have icons');
      const icons = page.locator(SELECTORS.STATS.ICON);
      const count = await icons.count();
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

  test('stats values are numeric or formatted', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify stat values exist');
      const values = page.locator(SELECTORS.STATS.VALUE);
      const count = await values.count();
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const value = values.nth(i);
        const text = await value.textContent();
        expect(text).not.toBe('');
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
});

test.describe('Overview - Accounts Table', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
  });

  test('displays accounts card', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify accounts card visible');
      const accountsCard = page.locator('.overview-grid .card').first();
      await expect(accountsCard).toBeVisible();
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

  test('accounts card has table structure', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify table exists within accounts card');
      const accountsCard = page.locator('.overview-grid .card').first();
      const table = accountsCard.locator('table');
      await expect(table).toBeVisible();
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

  test('accounts card shows rows or empty table', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Check for account rows');
      const accountsCard = page.locator('.overview-grid .card').first();
      const rows = accountsCard.locator('tbody tr');
      const rowCount = await rows.count();

      await reporter.step(`Found ${rowCount} rows`);
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

  test('account rows have names (when accounts exist)', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Check account names');
      const accountsCard = page.locator('.overview-grid .card').first();
      const rows = accountsCard.locator('tbody tr');
      const rowCount = await rows.count();

      if (rowCount > 0) {
        const firstName = rows.first().locator(SELECTORS.ACCOUNTS.ACCOUNT_NAME);
        await expect(firstName).toBeVisible();
      } else {
        reporter.complete('skip', 'No accounts configured in test environment');
        return;
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

  test('account rows have status indicators (when accounts exist)', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Check status indicators');
      const accountsCard = page.locator('.overview-grid .card').first();
      const rows = accountsCard.locator('tbody tr');
      const rowCount = await rows.count();

      if (rowCount > 0) {
        const statusDot = rows.first().locator(SELECTORS.ACCOUNTS.STATUS_DOT);
        await expect(statusDot).toBeVisible();
      } else {
        reporter.complete('skip', 'No accounts configured in test environment');
        return;
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

  test('account rows have action buttons (when accounts exist)', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Check action buttons');
      const accountsCard = page.locator('.overview-grid .card').first();
      const rows = accountsCard.locator('tbody tr');
      const rowCount = await rows.count();

      if (rowCount > 0) {
        const actionBtn = rows.first().locator(SELECTORS.ACCOUNTS.ACTION_BUTTON);
        await expect(actionBtn).toBeVisible();
      } else {
        reporter.complete('skip', 'No accounts configured in test environment');
        return;
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

  test('clicking action button shows dropdown menu (when accounts exist)', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      const accountsCard = page.locator('.overview-grid .card').first();
      const rows = accountsCard.locator('tbody tr');
      const rowCount = await rows.count();

      if (rowCount === 0) {
        reporter.complete('skip', 'No accounts configured in test environment');
        return;
      }

      await reporter.step('Click action button');
      const actionBtn = rows.first().locator(SELECTORS.ACCOUNTS.ACTION_BUTTON);
      await actionBtn.click();
      await reporter.stepComplete();

      await reporter.step('Verify dropdown menu visible');
      await expect(page.locator(SELECTORS.ACCOUNTS.DROPDOWN_MENU)).toBeVisible();
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

  test('select all checkbox exists in accounts table', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify select all checkbox in accounts table');
      const accountsCard = page.locator('.overview-grid .card').first();
      const selectAll = accountsCard.locator('thead input[type="checkbox"]');
      await expect(selectAll).toBeVisible();
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

  test('clicking row checkbox selects row (when accounts exist)', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      const accountsCard = page.locator('.overview-grid .card').first();
      const rows = accountsCard.locator('tbody tr');
      const rowCount = await rows.count();

      if (rowCount === 0) {
        reporter.complete('skip', 'No accounts configured in test environment');
        return;
      }

      await reporter.step('Click row checkbox');
      const checkbox = rows.first().locator('input[type="checkbox"]');
      await checkbox.click();
      await reporter.stepComplete();

      await reporter.step('Verify checkbox is checked');
      await expect(checkbox).toBeChecked();
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

  test('select all checkbox selects all rows (when accounts exist)', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      const accountsCard = page.locator('.overview-grid .card').first();
      const rows = accountsCard.locator('tbody tr');
      const rowCount = await rows.count();

      if (rowCount === 0) {
        reporter.complete('skip', 'No accounts configured in test environment');
        return;
      }

      await reporter.step('Click select all checkbox');
      const selectAll = accountsCard.locator('thead input[type="checkbox"]');
      await selectAll.click();
      await reporter.stepComplete();

      await reporter.step('Verify all rows selected');
      for (let i = 0; i < rowCount; i++) {
        const checkbox = rows.nth(i).locator('input[type="checkbox"]');
        await expect(checkbox).toBeChecked();
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

  test('bulk actions bar appears on selection (when accounts exist)', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      const accountsCard = page.locator('.overview-grid .card').first();
      const rows = accountsCard.locator('tbody tr');
      const rowCount = await rows.count();

      if (rowCount === 0) {
        reporter.complete('skip', 'No accounts configured in test environment');
        return;
      }

      await reporter.step('Select a row');
      const checkbox = rows.first().locator('input[type="checkbox"]');
      await checkbox.click();
      await reporter.stepComplete();

      await reporter.step('Verify bulk actions bar visible');
      await expect(accountsCard.locator(SELECTORS.ACCOUNTS.BULK_ACTIONS_BAR)).toBeVisible();
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

  test('bulk actions bar shows selection count (when accounts exist)', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      const accountsCard = page.locator('.overview-grid .card').first();
      const rows = accountsCard.locator('tbody tr');
      const rowCount = await rows.count();

      if (rowCount === 0) {
        reporter.complete('skip', 'No accounts configured in test environment');
        return;
      }

      await reporter.step('Select multiple rows');
      const selectAll = accountsCard.locator('thead input[type="checkbox"]');
      await selectAll.click();
      await reporter.stepComplete();

      await reporter.step('Verify selection count shown');
      const selectionCount = accountsCard.locator(SELECTORS.ACCOUNTS.SELECTION_COUNT);
      await expect(selectionCount).toBeVisible();
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

test.describe('Overview - Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureLoggedIn(page, TEST_USER);
    await waitForDashboard(page);
  });

  test('sidebar is visible', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify sidebar visible');
      await expect(page.locator(SELECTORS.SIDEBAR.CONTAINER)).toBeVisible();
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

  test('sidebar shows services list', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify services list');
      const servicesList = page.locator(SELECTORS.SIDEBAR.SERVICES_LIST);
      const count = await servicesList.count();
      if (count > 0) {
        await expect(servicesList).toBeVisible();
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

  test('sidebar shows provider list or empty message', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      await reporter.step('Verify provider list or empty state');
      const providerList = page.locator(SELECTORS.SIDEBAR.PROVIDER_LIST);
      const count = await providerList.count();
      if (count > 0) {
        await expect(providerList).toBeVisible();
      } else {
        const sidebar = page.locator(SELECTORS.SIDEBAR.CONTAINER);
        await expect(sidebar).toBeVisible();
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
});
