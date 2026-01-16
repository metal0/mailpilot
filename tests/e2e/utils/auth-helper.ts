import { type Page } from '@playwright/test';
import { TestReporter } from './test-reporter.js';

export interface TestCredentials {
  username: string;
  password: string;
}

export const TEST_USER: TestCredentials = {
  username: 'testadmin',
  password: 'testpassword123',
};

export async function login(
  page: Page,
  credentials: TestCredentials = TEST_USER,
  reporter?: TestReporter
): Promise<void> {
  if (reporter) {
    await reporter.step('Login', credentials.username);
  }

  await page.fill('#username', credentials.username);
  await page.fill('#password', credentials.password);
  await page.click('button[type="submit"]');

  await page.waitForSelector('.tabs', { timeout: 10000 });

  if (reporter) {
    await reporter.stepComplete(true);
  }
}

export async function ensureLoggedIn(
  page: Page,
  credentials: TestCredentials = TEST_USER,
  reporter?: TestReporter
): Promise<void> {
  const currentUrl = page.url();

  if (currentUrl.includes('login') || currentUrl.includes('setup')) {
    await login(page, credentials, reporter);
  } else {
    const tabsVisible = await page.locator('.tabs').isVisible().catch(() => false);
    if (!tabsVisible) {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const needsLogin = await page.locator('#username').isVisible().catch(() => false);
      if (needsLogin) {
        await login(page, credentials, reporter);
      }
    }
  }
}

export async function logout(page: Page, reporter?: TestReporter): Promise<void> {
  if (reporter) {
    await reporter.step('Logout');
  }

  await page.click('.user-menu-trigger');
  await page.waitForSelector('.user-dropdown', { state: 'visible' });
  await page.click('button:has-text("Logout")');
  await page.waitForSelector('#username', { timeout: 10000 });

  if (reporter) {
    await reporter.stepComplete(true);
  }
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  return page.locator('.tabs').isVisible().catch(() => false);
}

export async function waitForDashboard(page: Page, reporter?: TestReporter): Promise<void> {
  if (reporter) {
    await reporter.step('Wait for dashboard');
  }

  await page.waitForSelector('.tabs', { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  if (reporter) {
    await reporter.stepComplete();
  }
}

export async function setupFirstUser(
  page: Page,
  credentials: TestCredentials = TEST_USER,
  reporter?: TestReporter
): Promise<void> {
  if (reporter) {
    await reporter.step('Setup first user', credentials.username);
  }

  await page.fill('#username', credentials.username);
  await page.fill('#password', credentials.password);
  await page.fill('#confirm', credentials.password);
  await page.click('button[type="submit"]');

  await page.waitForSelector('.tabs', { timeout: 10000 });

  if (reporter) {
    await reporter.stepComplete(true);
  }
}
