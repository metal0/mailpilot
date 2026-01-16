# AI Agent E2E Testing Protocol

This document defines the standard protocol for AI agents to perform end-to-end testing of Mailpilot using headless browser automation.

## Overview

AI agents use the Chrome MCP tools to perform interactive E2E testing during development. This is separate from automated Playwright tests - it's for manual verification of features during implementation.

## Test Environment Setup

### Step 1: Start the Application

Before any browser testing, start the development server:

```bash
pnpm dev
```

This starts:
- Backend server on `http://localhost:8085`
- WebSocket server for real-time updates
- Serves the dashboard from `dashboard/dist/`

**Wait for**: Log message `Dashboard server started on port 8085`

### Step 2: Initialize Browser Context

Get the current MCP tab context:

```
mcp__Claude_in_Chrome__tabs_context_mcp
```

Create a new tab for testing (each test session should use a fresh tab):

```
mcp__Claude_in_Chrome__tabs_create_mcp
```

### Step 3: Navigate to Dashboard

```
mcp__Claude_in_Chrome__navigate with url: "http://localhost:8085"
```

**Verify**: Page loads without errors.

## Test Session Protocol

### Starting a Test Session

1. **Document the test objective** - State what you're testing
2. **Take initial screenshot** - Capture the starting state
3. **Plan test steps** - List the actions you'll take

### During Testing

For each test step:

1. **State the action** - What you're about to do
2. **Execute using MCP tools** - Perform the action
3. **Capture evidence** - Take screenshot after significant actions
4. **Verify result** - Check the outcome matches expectations
5. **Document findings** - Note any issues or observations

### Test Session Report Template

After completing a test session, document results in this format:

```markdown
## E2E Test Session: [Feature Name]

**Date**: YYYY-MM-DD HH:MM
**Tested By**: AI Agent
**Environment**: localhost:8085

### Test Objective
[What was being tested]

### Test Steps

| Step | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| 1 | Navigate to /settings | Settings page loads | Settings page loaded | ✅ |
| 2 | Click "Add Account" | Modal opens | Modal opened | ✅ |
| ... | ... | ... | ... | ... |

### Screenshots
- [step-1-initial.png] - Initial state
- [step-3-modal.png] - Add account modal
- ...

### Issues Found
- [ ] Issue 1: Description
- [ ] Issue 2: Description

### Conclusion
[Summary of test results - PASS/FAIL and any notes]
```

## MCP Tool Reference

### Navigation

```
mcp__Claude_in_Chrome__navigate
  url: string (full URL)
  tabId: number (from tabs_context_mcp)
```

### Reading Page State

```
mcp__Claude_in_Chrome__read_page
  tabId: number
  depth?: number (default: full tree)
  filter?: "interactive" (show only interactive elements)
```

Use `read_page` to understand the current DOM structure before interacting.

### Finding Elements

```
mcp__Claude_in_Chrome__find
  tabId: number
  query: string (natural language, e.g., "login button", "email input")
```

Returns element references (ref IDs) that can be used with other tools.

### Screenshots

```
mcp__Claude_in_Chrome__computer
  action: "screenshot"
  tabId: number
```

Take screenshots at key moments:
- Initial state before testing
- After significant actions
- When errors occur
- Final state after test completion

### Clicking Elements

```
mcp__Claude_in_Chrome__computer
  action: "click"
  coordinate: [x, y]
  tabId: number
```

Or use ref-based clicking:
```
mcp__Claude_in_Chrome__computer
  action: "click"
  ref: "element-ref-id"
  tabId: number
```

### Form Input

```
mcp__Claude_in_Chrome__form_input
  tabId: number
  ref: "input-element-ref"
  value: "text to enter"
```

Or use keyboard typing:
```
mcp__Claude_in_Chrome__computer
  action: "type"
  text: "text to type"
  tabId: number
```

### Keyboard Actions

```
mcp__Claude_in_Chrome__computer
  action: "key"
  text: "Enter" | "Tab" | "Escape" | etc.
  tabId: number
```

### Waiting

```
mcp__Claude_in_Chrome__computer
  action: "wait"
  duration: 1000 (milliseconds)
  tabId: number
```

Use waiting after actions that trigger:
- Network requests
- Animations
- State changes

### Console Monitoring

```
mcp__Claude_in_Chrome__read_console_messages
  tabId: number
  onlyErrors?: boolean
  pattern?: string (filter messages)
```

Check for JavaScript errors during testing.

### Network Monitoring

```
mcp__Claude_in_Chrome__read_network_requests
  tabId: number
  urlPattern?: string (filter by URL)
```

Verify API calls are made correctly.

## Common Test Scenarios

### Dashboard Load Test

1. Navigate to `http://localhost:8085`
2. Verify page title contains "Mailpilot"
3. Check navigation sidebar is visible
4. Verify stats widgets load (check for loading spinners → data)
5. Take screenshot of loaded dashboard

### Settings Page Test

1. Navigate to `/settings`
2. Verify all setting sections are visible:
   - Email Accounts
   - LLM Configuration
   - Webhooks (if enabled)
3. Test expand/collapse of sections
4. Verify form validation on inputs

### Account Management Test

1. Navigate to Settings → Email Accounts
2. Click "Add Account"
3. Fill in test IMAP details:
   - Host: `imap.example.com`
   - Port: `993`
   - Username: `test@example.com`
   - Password: `testpassword`
4. Click "Test Connection" (expect failure for fake credentials)
5. Verify error message is displayed
6. Cancel the modal
7. Verify modal closes cleanly

### Real-time Updates Test

1. Open dashboard
2. Open Network tab / monitor WebSocket
3. Verify WebSocket connection established
4. Trigger an action (if possible) or wait for periodic update
5. Verify UI updates without page refresh

## Error Handling

### If a step fails:

1. Take screenshot immediately
2. Check console for errors: `read_console_messages`
3. Check network for failed requests: `read_network_requests`
4. Document the failure in the test report
5. Attempt recovery or abort test session

### Common Issues

| Issue | Diagnosis | Resolution |
|-------|-----------|------------|
| Page blank | Check console | Fix JS errors |
| Element not found | Check read_page output | Use correct selector |
| Click has no effect | Element might be covered | Scroll or wait for animation |
| Form not submitting | Check network requests | Verify API endpoint |

## Test Coverage Checklist

For any dashboard feature, ensure you test:

- [ ] **Happy path** - Feature works as expected
- [ ] **Error handling** - Invalid inputs show proper errors
- [ ] **Loading states** - Loading indicators appear during async ops
- [ ] **Empty states** - Proper UI when no data exists
- [ ] **Responsive behavior** - Works at different viewport sizes
- [ ] **Keyboard navigation** - Tab through form fields
- [ ] **Real-time updates** - WebSocket updates reflect in UI

## Reporting Test Results

After each E2E test session:

1. **Create test report** - Use the template above
2. **Store screenshots** - Reference them in the report
3. **File issues** - Create GitHub issues for bugs found
4. **Update todo** - Mark testing task as complete with results

### Report Location

Test reports should be included in:
- PR description (summary of testing performed)
- Commit message (brief mention of E2E verification)
- GitHub issue (if bugs were found)

## Integration with Development Workflow

### When to Perform E2E Testing

1. **After implementing UI changes** - Verify the change works
2. **Before creating PR** - Full regression test of affected areas
3. **When fixing bugs** - Verify the fix and check for regressions
4. **After merging dependencies** - Smoke test the dashboard

### Minimum E2E Verification

Before any PR that touches dashboard code:

1. Dashboard loads without console errors
2. Navigation works (all pages accessible)
3. Changed feature works as expected
4. No visual regressions in affected areas
