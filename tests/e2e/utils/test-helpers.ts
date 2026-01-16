import { type Page, expect } from '@playwright/test';
import { TestReporter } from './test-reporter.js';

export async function navigateTo(
  page: Page,
  path: string,
  reporter?: TestReporter
): Promise<void> {
  if (reporter) {
    await reporter.step('Navigate', path);
  }
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  if (reporter) {
    await reporter.stepComplete(true);
  }
}

export async function clickElement(
  page: Page,
  selector: string,
  reporter?: TestReporter
): Promise<void> {
  if (reporter) {
    await reporter.step('Click', selector);
  }
  await page.click(selector);
  if (reporter) {
    await reporter.stepComplete();
  }
}

export async function fillInput(
  page: Page,
  selector: string,
  value: string,
  reporter?: TestReporter
): Promise<void> {
  if (reporter) {
    await reporter.step('Fill', selector, value);
  }
  await page.fill(selector, value);
  if (reporter) {
    await reporter.stepComplete();
  }
}

export async function selectOption(
  page: Page,
  selector: string,
  value: string,
  reporter?: TestReporter
): Promise<void> {
  if (reporter) {
    await reporter.step('Select', selector, value);
  }
  await page.selectOption(selector, value);
  if (reporter) {
    await reporter.stepComplete();
  }
}

export async function waitForElement(
  page: Page,
  selector: string,
  reporter?: TestReporter
): Promise<void> {
  if (reporter) {
    await reporter.step('Wait for element', selector);
  }
  await page.waitForSelector(selector);
  if (reporter) {
    await reporter.stepComplete();
  }
}

export async function assertVisible(
  page: Page,
  selector: string,
  reporter?: TestReporter
): Promise<void> {
  if (reporter) {
    await reporter.step('Assert visible', selector);
  }
  await expect(page.locator(selector)).toBeVisible();
  if (reporter) {
    await reporter.stepComplete();
  }
}

export async function assertText(
  page: Page,
  selector: string,
  expectedText: string,
  reporter?: TestReporter
): Promise<void> {
  if (reporter) {
    await reporter.step('Assert text', selector, expectedText);
  }
  await expect(page.locator(selector)).toContainText(expectedText);
  if (reporter) {
    await reporter.stepComplete();
  }
}

export async function assertNotVisible(
  page: Page,
  selector: string,
  reporter?: TestReporter
): Promise<void> {
  if (reporter) {
    await reporter.step('Assert not visible', selector);
  }
  await expect(page.locator(selector)).not.toBeVisible();
  if (reporter) {
    await reporter.stepComplete();
  }
}

export async function waitForNetworkIdle(page: Page, reporter?: TestReporter): Promise<void> {
  if (reporter) {
    await reporter.step('Wait for network idle');
  }
  await page.waitForLoadState('networkidle');
  if (reporter) {
    await reporter.stepComplete();
  }
}

export async function waitForResponse(
  page: Page,
  urlPattern: string | RegExp,
  reporter?: TestReporter
): Promise<void> {
  if (reporter) {
    await reporter.step('Wait for API response', urlPattern.toString());
  }
  await page.waitForResponse(urlPattern);
  if (reporter) {
    await reporter.stepComplete();
  }
}
