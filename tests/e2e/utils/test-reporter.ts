import { type Page, type TestInfo } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPORTS_DIR = 'tests/e2e/reports';

export interface TestStep {
  timestamp: string;
  action: string;
  target?: string;
  value?: string;
  screenshot?: string;
  status: 'pass' | 'fail' | 'skip';
  error?: string;
  duration?: number;
}

export interface TestResult {
  testName: string;
  testFile: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: 'pass' | 'fail' | 'skip';
  steps: TestStep[];
  screenshots: string[];
  error?: string;
}

export class TestReporter {
  private result: TestResult;
  private stepStartTime?: number;
  private page?: Page;

  constructor(testInfo: TestInfo) {
    this.result = {
      testName: testInfo.title,
      testFile: path.basename(testInfo.file),
      startTime: new Date().toISOString(),
      status: 'pass',
      steps: [],
      screenshots: [],
    };
  }

  setPage(page: Page): void {
    this.page = page;
  }

  async step(action: string, target?: string, value?: string): Promise<void> {
    this.stepStartTime = Date.now();
    const step: TestStep = {
      timestamp: new Date().toISOString(),
      action,
      target,
      value,
      status: 'pass',
    };
    this.result.steps.push(step);
  }

  async stepComplete(captureScreenshot = false): Promise<void> {
    const lastStep = this.result.steps[this.result.steps.length - 1];
    if (lastStep && this.stepStartTime) {
      lastStep.duration = Date.now() - this.stepStartTime;
    }
    if (captureScreenshot && this.page) {
      const screenshotPath = await this.captureScreenshot(`step-${this.result.steps.length}`);
      if (lastStep && screenshotPath) {
        lastStep.screenshot = screenshotPath;
      }
    }
  }

  async stepFailed(error: string): Promise<void> {
    const lastStep = this.result.steps[this.result.steps.length - 1];
    if (lastStep) {
      lastStep.status = 'fail';
      lastStep.error = error;
      if (this.stepStartTime) {
        lastStep.duration = Date.now() - this.stepStartTime;
      }
    }
    this.result.status = 'fail';
    if (this.page) {
      await this.captureScreenshot('error');
    }
  }

  async captureScreenshot(name: string): Promise<string | undefined> {
    if (!this.page) return undefined;

    const timestamp = Date.now();
    const filename = `${this.result.testFile.replace('.spec.ts', '')}-${name}-${timestamp}.png`;
    const screenshotDir = path.join(REPORTS_DIR, 'screenshots');

    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const screenshotPath = path.join(screenshotDir, filename);
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
    this.result.screenshots.push(filename);
    return filename;
  }

  complete(status?: 'pass' | 'fail' | 'skip', error?: string): void {
    this.result.endTime = new Date().toISOString();
    this.result.duration =
      new Date(this.result.endTime).getTime() - new Date(this.result.startTime).getTime();
    if (status) {
      this.result.status = status;
    }
    if (error) {
      this.result.error = error;
    }
  }

  getResult(): TestResult {
    return this.result;
  }

  saveJsonReport(): string {
    const jsonDir = path.join(REPORTS_DIR, 'json');
    if (!fs.existsSync(jsonDir)) {
      fs.mkdirSync(jsonDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${this.result.testFile.replace('.spec.ts', '')}-${timestamp}.json`;
    const filepath = path.join(jsonDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(this.result, null, 2));
    return filepath;
  }

  saveMarkdownReport(): string {
    const mdDir = path.join(REPORTS_DIR, 'markdown');
    if (!fs.existsSync(mdDir)) {
      fs.mkdirSync(mdDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${this.result.testFile.replace('.spec.ts', '')}-${timestamp}.md`;
    const filepath = path.join(mdDir, filename);

    const statusEmoji = this.result.status === 'pass' ? '✅' : this.result.status === 'fail' ? '❌' : '⏭️';
    const duration = this.result.duration ? `${(this.result.duration / 1000).toFixed(2)}s` : 'N/A';

    let content = `# E2E Test Report: ${this.result.testName}

## Summary

| Property | Value |
|----------|-------|
| **Status** | ${statusEmoji} ${this.result.status.toUpperCase()} |
| **Test File** | \`${this.result.testFile}\` |
| **Start Time** | ${this.result.startTime} |
| **End Time** | ${this.result.endTime || 'N/A'} |
| **Duration** | ${duration} |

`;

    if (this.result.error) {
      content += `## Error

\`\`\`
${this.result.error}
\`\`\`

`;
    }

    content += `## Test Steps

| # | Action | Target | Status | Duration |
|---|--------|--------|--------|----------|
`;

    this.result.steps.forEach((step, index) => {
      const stepStatus = step.status === 'pass' ? '✅' : step.status === 'fail' ? '❌' : '⏭️';
      const stepDuration = step.duration ? `${step.duration}ms` : '-';
      const target = step.target ? `\`${step.target}\`` : '-';
      content += `| ${index + 1} | ${step.action} | ${target} | ${stepStatus} | ${stepDuration} |\n`;
    });

    if (this.result.screenshots.length > 0) {
      content += `
## Screenshots

`;
      this.result.screenshots.forEach((screenshot) => {
        content += `- ![${screenshot}](../screenshots/${screenshot})\n`;
      });
    }

    content += `
---
*Generated by Mailpilot E2E Test Framework*
`;

    fs.writeFileSync(filepath, content);
    return filepath;
  }
}

export function createTestReporter(testInfo: TestInfo): TestReporter {
  return new TestReporter(testInfo);
}
