# E2E Testing Reference

This document provides complete reference documentation for E2E testing in Mailpilot.

## Overview

Mailpilot uses two complementary E2E testing approaches:

| Approach | Tool | Purpose | When to Use |
|----------|------|---------|-------------|
| **Automated Tests** | Playwright | Regression testing, CI/CD | Before releases, after major changes |
| **AI Agent Testing** | Chrome MCP | Interactive development testing | During feature development |

## Automated Playwright Tests

### Quick Start

```bash
# Run all E2E tests (headless)
pnpm test:e2e

# Run with visible browser
pnpm test:e2e:headed

# Debug mode with inspector
pnpm test:e2e:debug

# View HTML report
pnpm test:e2e:report
```

### Configuration

Playwright is configured in `playwright.config.ts`:

```typescript
{
  testDir: './tests/e2e',
  baseURL: 'http://localhost:8085',
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:8085',
    reuseExistingServer: !process.env.CI,
  },
  reporter: [
    ['html', { outputFolder: 'tests/e2e/reports/html' }],
    ['json', { outputFile: 'tests/e2e/reports/results.json' }],
    ['list'],
  ],
}
```

### Directory Structure

```
tests/e2e/
├── *.spec.ts           # Test files
├── utils/
│   ├── index.ts        # Re-exports
│   ├── test-reporter.ts   # Audit trail utilities
│   └── test-helpers.ts    # Test helper functions
├── fixtures/           # Test data and fixtures
└── reports/
    ├── html/           # Playwright HTML reports
    ├── json/           # Machine-readable results
    ├── markdown/       # Human-readable reports
    ├── screenshots/    # Visual evidence
    └── artifacts/      # Traces, videos
```

### Writing Tests

#### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { createTestReporter, navigateTo } from './utils/index.js';

test.describe('Feature Name', () => {
  test('test description', async ({ page }, testInfo) => {
    const reporter = createTestReporter(testInfo);
    reporter.setPage(page);

    try {
      // Test steps with reporting
      await navigateTo(page, '/', reporter);

      await reporter.step('Action description');
      // ... perform action
      await reporter.stepComplete(true); // true = capture screenshot

      reporter.complete('pass');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await reporter.stepFailed(errorMessage);
      reporter.complete('fail', errorMessage);
      throw error;
    } finally {
      reporter.saveJsonReport();
      reporter.saveMarkdownReport();
    }
  });
});
```

#### Available Helper Functions

```typescript
// Navigation
await navigateTo(page, '/settings', reporter);

// Interactions
await clickElement(page, 'button.submit', reporter);
await fillInput(page, 'input[name="email"]', 'test@example.com', reporter);
await selectOption(page, 'select#theme', 'dark', reporter);

// Assertions
await assertVisible(page, '.success-message', reporter);
await assertText(page, 'h1', 'Dashboard', reporter);
await assertNotVisible(page, '.error', reporter);

// Waiting
await waitForElement(page, '.loaded-content', reporter);
await waitForNetworkIdle(page, reporter);
await waitForResponse(page, '/api/status', reporter);
```

### Test Reporter API

```typescript
const reporter = createTestReporter(testInfo);
reporter.setPage(page);

// Record steps
await reporter.step('action', 'target?', 'value?');
await reporter.stepComplete(captureScreenshot?: boolean);
await reporter.stepFailed(errorMessage: string);

// Screenshots
await reporter.captureScreenshot('name');

// Complete test
reporter.complete('pass' | 'fail' | 'skip', error?: string);

// Save reports
reporter.saveJsonReport();   // → tests/e2e/reports/json/*.json
reporter.saveMarkdownReport(); // → tests/e2e/reports/markdown/*.md

// Get result object
const result = reporter.getResult();
```

### Report Formats

#### JSON Report

```json
{
  "testName": "loads and displays main navigation",
  "testFile": "dashboard.spec.ts",
  "startTime": "2026-01-16T10:30:00.000Z",
  "endTime": "2026-01-16T10:30:05.000Z",
  "duration": 5000,
  "status": "pass",
  "steps": [
    {
      "timestamp": "2026-01-16T10:30:01.000Z",
      "action": "Navigate",
      "target": "/",
      "status": "pass",
      "duration": 1200,
      "screenshot": "dashboard-step-1-1705401001000.png"
    }
  ],
  "screenshots": ["dashboard-step-1-1705401001000.png"]
}
```

#### Markdown Report

```markdown
# E2E Test Report: loads and displays main navigation

## Summary

| Property | Value |
|----------|-------|
| **Status** | ✅ PASS |
| **Test File** | `dashboard.spec.ts` |
| **Start Time** | 2026-01-16T10:30:00.000Z |
| **Duration** | 5.00s |

## Test Steps

| # | Action | Target | Status | Duration |
|---|--------|--------|--------|----------|
| 1 | Navigate | `/` | ✅ | 1200ms |
| 2 | Verify dashboard loaded | - | ✅ | 50ms |

## Screenshots

- ![dashboard-step-1-1705401001000.png](../screenshots/dashboard-step-1-1705401001000.png)
```

---

## AI Agent Browser Testing

For interactive testing during development, AI agents use Chrome MCP tools.

**Full protocol**: See `docs/ai-e2e-testing.md`

### Quick Reference

#### 1. Start Test Environment

```bash
pnpm dev
# Wait for: "Dashboard server started on port 8085"
```

#### 2. Initialize Browser

```
mcp__Claude_in_Chrome__tabs_context_mcp
mcp__Claude_in_Chrome__tabs_create_mcp
```

#### 3. Navigate

```
mcp__Claude_in_Chrome__navigate
  url: "http://localhost:8085"
  tabId: <from context>
```

#### 4. Test Steps

```
# Read page structure
mcp__Claude_in_Chrome__read_page
  tabId: <id>
  filter: "interactive"  # optional, shows only interactive elements

# Find elements
mcp__Claude_in_Chrome__find
  tabId: <id>
  query: "settings button"

# Click
mcp__Claude_in_Chrome__computer
  action: "click"
  ref: "<element-ref>"
  tabId: <id>

# Fill form
mcp__Claude_in_Chrome__form_input
  tabId: <id>
  ref: "<input-ref>"
  value: "test value"

# Screenshot
mcp__Claude_in_Chrome__computer
  action: "screenshot"
  tabId: <id>
```

#### 5. Document Results

Use the test report template from `docs/ai-e2e-testing.md`.

---

## Best Practices

### Test Organization

1. **One concern per test** - Each test should verify one specific behavior
2. **Descriptive names** - Test names should describe what's being tested
3. **Independent tests** - Tests shouldn't depend on each other's state
4. **Clean up** - Reset state after tests that modify data

### Coverage Guidelines

For any feature, test:

- [ ] **Happy path** - Feature works with valid inputs
- [ ] **Edge cases** - Boundary conditions, empty states
- [ ] **Error handling** - Invalid inputs show proper errors
- [ ] **Loading states** - Spinners, disabled buttons during async ops
- [ ] **Empty states** - Proper UI when no data exists
- [ ] **Real-time updates** - WebSocket changes reflect in UI

### When to Use Each Approach

| Scenario | Automated | AI Agent |
|----------|-----------|----------|
| Pre-commit regression | ✅ | |
| CI/CD pipeline | ✅ | |
| New feature development | | ✅ |
| Bug reproduction | | ✅ |
| Visual verification | | ✅ |
| Exploratory testing | | ✅ |
| Accessibility testing | ✅ | ✅ |

---

## Troubleshooting

### Automated Tests

| Issue | Solution |
|-------|----------|
| Tests timeout | Increase timeout in test or config |
| Element not found | Check selector, add wait |
| WebSocket not connecting | Ensure dev server started |
| Screenshots blank | Check page load state |

### AI Agent Testing

| Issue | Solution |
|-------|----------|
| Tab not found | Run `tabs_context_mcp` first |
| Element not clickable | Wait for animation, scroll into view |
| Form not submitting | Check network requests for errors |
| Console errors | Run `read_console_messages` |

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm run dashboard:build
      - run: npx playwright install chromium --with-deps
      - run: pnpm test:e2e

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: e2e-reports
          path: tests/e2e/reports/
```

---

## Appendix: Full MCP Tool Reference

See `docs/ai-e2e-testing.md` for complete MCP tool documentation.
