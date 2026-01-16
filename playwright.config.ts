import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'tests/e2e/reports/html' }],
    ['json', { outputFile: 'tests/e2e/reports/results.json' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:8085',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'on-first-retry',
  },
  outputDir: 'tests/e2e/reports/artifacts',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:8085/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30 * 1000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      CONFIG_PATH: 'config.test.yaml',
    },
  },
});
