# AI Development Instructions for Mailpilot

This document provides guidelines for AI assistants working on the Mailpilot codebase.

## Project Overview

Mailpilot is an AI-powered email processing daemon that uses LLM classification to organize emails. Built with TypeScript, Node.js 22+, and a Svelte 5 dashboard.

## Critical Rules

### Testing is MANDATORY (NON-NEGOTIABLE)

**Every code change MUST include tests. This is not optional.**

When implementing or modifying any feature:

1. **Unit Tests** - Create or update tests in `tests/unit/`
   - Run: `pnpm test` or `pnpm test:unit`
   - Tests must pass before committing

2. **E2E Tests** - Create or update Playwright tests in `tests/e2e/`
   - Run: `pnpm test:e2e`
   - For API changes: add tests in `api.spec.ts`
   - For dashboard changes: add tests in relevant spec files

3. **Execute Tests** - You MUST run tests to verify implementation
   - Don't assume code works - prove it with passing tests
   - Fix any failing tests before marking work complete

**This requirement CANNOT be skipped.** Untested code is incomplete code.

See `docs/e2e-testing.md` for full testing documentation.

### Git Operations (NEVER AUTOMATIC)

**NEVER push to any branch without explicit user approval.** This includes:

- `git push` to any branch (especially master/main)
- `git push --tags`
- `git push --force` (absolutely forbidden without explicit request)

**Workflow:**
1. Make commits locally when requested
2. Show the user what will be pushed (`git log origin/master..HEAD`)
3. **Wait for explicit approval** before pushing
4. Only push after user confirms

This protects against accidental pushes to production branches and gives the user control over what goes to remote.

### Package Lock Files (NEVER EDIT MANUALLY)

**NEVER manually edit `pnpm-lock.yaml` or any lock file.** Always use package manager commands:

```bash
# Add a dependency
pnpm add <package>              # Add to root
pnpm add -D <package>           # Add as devDependency
cd dashboard && pnpm add <pkg>  # Add to dashboard workspace

# Remove a dependency
pnpm remove <package>

# Update dependencies
pnpm update <package>

# Regenerate lock file
pnpm install
```

Manual edits to lock files cause:
- Broken dependency resolution
- CI failures with "broken lockfile" errors
- Inconsistent builds across environments

If the lock file gets corrupted, regenerate it with `pnpm install --no-frozen-lockfile`.

### Test CI Locally Before Pushing (MANDATORY)

**ALWAYS run the full CI check locally before pushing:**

```bash
pnpm install --frozen-lockfile  # Verify lockfile is valid
pnpm lint                       # Run linter
pnpm typecheck                  # Run TypeScript checks
pnpm build                      # Build backend + dashboard
pnpm test                       # Run all tests
```

**All commands must pass before pushing.** If any fail, fix the issues locally first.

Common CI failures and fixes:
- `ERR_PNPM_OUTDATED_LOCKFILE` → Run `pnpm install` to update lockfile
- `ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY` → Run `pnpm install` to regenerate
- Lint errors → Fix the code issues reported
- Type errors → Fix TypeScript type issues
- Build errors → Check for missing imports/dependencies

### Feature Branch Workflow (REQUIRED)

**All new feature implementations MUST follow this workflow:**

1. **Create a feature branch** - Never commit new features directly to master
   ```bash
   git checkout -b feat/feature-name
   # or: git checkout -b fix/bug-name
   ```

2. **Implement with full requirements:**
   - Working code with no placeholders
   - Unit tests covering the new functionality
   - Documentation updates (README, SPEC, AGENTS.md, Wiki as applicable)

3. **Verify before PR:**
   - `pnpm lint && pnpm typecheck && pnpm build` passes
   - `pnpm test` passes
   - E2E testing performed (see Browser Testing section)

4. **Create a GitHub Pull Request:**
   ```bash
   git push -u origin feat/feature-name
   gh pr create --title "feat: description" --body "..."
   ```

5. **PR must include:**
   - Clear description of what changed
   - Test plan or testing performed
   - Documentation changes included in the PR

**Branch naming conventions:**
- `feat/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation only changes

**Never commit directly to master for:**
- New features
- Significant refactoring
- Changes affecting multiple files
- Changes requiring review

## Quality Standards (NO SHORTCUTS)

**Every implementation MUST meet these quality standards. There are no exceptions.**

### Implementation Standards

1. **No half-measures** - Every feature must be fully implemented, not partially working
2. **No placeholder code** - Don't leave TODOs, FIXMEs, or stub implementations
3. **No silent failures** - Every error path must be handled explicitly
4. **No untested code paths** - If code exists, it must be tested
5. **No assumptions** - Verify behavior, don't assume it works

### Testing Standards

1. **Test what you build** - Every feature requires corresponding tests
2. **Test edge cases** - Don't just test the happy path
3. **Test error conditions** - Verify graceful failure handling
4. **Test integrations** - Verify components work together, not just in isolation
5. **Test in browser** - Dashboard changes MUST be verified visually

### Why This Matters

Shortcuts lead to:
- Bugs discovered by users instead of developers
- Technical debt that slows future development
- Regression bugs when assumptions break
- Lost trust when features don't work as documented

**Take the time to do it right the first time.**

---

## Feature Completion Requirements

**ALL implemented features MUST include the following before being considered complete:**

### 1. Unit Tests (REQUIRED)
- Add tests for all new functions/modules in `tests/unit/`
- Test files mirror `src/` structure (e.g., `src/llm/client.ts` → `tests/unit/llm/client.test.ts`)
- Cover happy path, edge cases, and error conditions
- Run `pnpm test` and ensure all tests pass
- Aim for meaningful coverage, not 100% line coverage

### 2. End-to-End Testing (REQUIRED - EXHAUSTIVE)

E2E testing must be thorough and cover the full spectrum of user interactions.

**Testing Approach:**
- Test complete user flows using Playwright MCP tools (see Browser Testing section)
- For API changes: test endpoints with real HTTP requests
- For dashboard changes: test UI interactions in actual browser
- For backend changes: verify behavior with running app (`pnpm dev`)
- Document test scenarios performed in commit message or PR

**Coverage Requirements:**
- **Normal use cases**: Test the primary intended functionality
- **Edge cases**: Test boundary conditions, empty states, maximum values
- **Error cases**: Test invalid inputs, network failures, permission errors
- **State transitions**: Test all possible state changes (e.g., connected → disconnected → reconnected)
- **User flows**: Test complete workflows from start to finish
- **Responsive behavior**: Test at different viewport sizes if UI changes

**What "Exhaustive" Means:**
```
Example: Testing a new "Add Account" feature
✓ Add account with valid credentials → success
✓ Add account with invalid credentials → proper error message
✓ Add account with empty fields → validation errors shown
✓ Add account with special characters in name → handled correctly
✓ Cancel mid-flow → no partial state saved
✓ Add duplicate account name → proper error message
✓ Network timeout during test → graceful handling
✓ Test connection button → shows loading, then result
✓ Form validation → real-time feedback on blur
✓ Keyboard navigation → all fields accessible via Tab
✓ Save button state → disabled until valid, shows loading
```

**Do NOT skip E2E testing because:**
- "It works in unit tests" - Unit tests don't catch integration issues
- "It's a small change" - Small changes can have big UI impacts
- "I tested it manually once" - One test isn't exhaustive
- "The code looks correct" - Working code ≠ working feature

### 3. Documentation Updates (REQUIRED)
- **README.md** - Update if features, configuration, or usage changes
- **SPEC.md** - Update if architecture, schemas, or behavior changes
- **AGENTS.md** - Update if LLM integration, prompts, or AI features change
- **GitHub Wiki** - Update user-facing docs for installation, configuration, troubleshooting
- **docs/** folder - Update technical docs (API reference, etc.)
- **ROADMAP.md** - Mark completed features, update plans if scope changed

### Completion Checklist
Before marking any feature as done, verify:
- [ ] Unit tests written and passing
- [ ] E2E testing performed and documented
- [ ] Relevant documentation updated
- [ ] `pnpm lint && pnpm typecheck && pnpm build` passes
- [ ] Changes committed with descriptive message

---

## Priority Guidelines

### Git Commits (HIGH PRIORITY)

**Commit frequently during development.** Don't wait until all work is complete.

1. **Commit after completing a logical unit of work** - feature, bugfix, refactor
2. **Commit before switching tasks** - Even if incomplete, commit WIP with descriptive message
3. **Use clear commit messages** - Describe what changed and why
4. **Never leave uncommitted changes overnight** - Risk of losing work

Example commit workflow:
```
feat(dashboard): add IMAP probe endpoint
feat(dashboard): add port locking to account wizard
fix(probe): use socket connection instead of auth
```

### Documentation Updates (HIGH PRIORITY)

When making changes to the codebase, documentation MUST be reviewed and updated:

1. **README.md** - Update if features, configuration, or usage changes
2. **SPEC.md** - Update if architecture, schemas, or behavior changes
3. **AGENTS.md** - Update if LLM integration, prompts, or AI features change
4. **GitHub Wiki** - User-facing documentation is hosted on the [wiki](https://github.com/metal0/mailpilot/wiki). Update wiki articles when user-facing features change:
   - Installation, configuration guides
   - Email provider setup (Gmail, Outlook, etc.)
   - LLM provider setup (OpenAI, Ollama, etc.)
   - Troubleshooting guides
5. **docs/** folder - Technical docs for developers:
   - `docs/dashboard.md` - Dashboard API reference
   - Other technical implementation docs

### Documentation Accuracy (CRITICAL)

**Documentation MUST be accurate.** Before writing or updating docs:

1. **Verify against code** - Check actual schema, endpoints, and behavior
2. **Use correct config names** - Check `src/config/schema.ts` for exact field names:
   - `folders.watch` (not `watch_folders`)
   - `backlog.mode` (not `process_existing`)
   - `polling_interval` (not `check_interval`)
   - `server.port` (no `server.host`)
3. **Check API endpoints** - Verify against `src/server/dashboard.ts`:
   - `/api/dead-letter` (singular, not `dead-letters`)
   - `/api/logs` supports `accountName` filter
4. **Prompt documentation** - Be clear about what's auto-injected vs user-written:
   - **Auto-injected:** folder lists, allowed actions, JSON schema, email content
   - **User writes:** classification rules only
5. **Version numbers** - Keep examples current with `package.json`

**Wrong documentation is worse than no documentation.**

### Learning from Mistakes (IMPORTANT)

When you fix an inaccuracy or the user corrects you about something being wrong:

1. **Fix the immediate issue** - Correct the documentation/code
2. **Consider adding to permanent instructions** - If the mistake could recur:
   - Add the correct information to `CLAUDE.md` or `AGENTS.md`
   - Document the "gotcha" so future sessions don't repeat the error
   - Include both what's wrong AND what's correct

Examples of things to document:
- Config field names that are commonly confused
- API endpoints with non-obvious paths
- Auto-injected content that shouldn't be manually added
- Default values that differ from intuition
- Architectural decisions that affect multiple areas

**Don't repeat the same mistake twice. If you learned something, write it down.**

### Unit Tests (HIGH PRIORITY)

When modifying code, unit tests MUST be checked and updated:

1. **Run existing tests** - `pnpm test` before and after changes
2. **Add tests for new functionality** - Every new feature needs tests
3. **Update tests for changed behavior** - Modified functions need test updates
4. **Test location**: `tests/unit/` mirrors `src/` structure

Test files:
- `tests/unit/providers.test.ts` - LLM provider logic and health tracking
- `tests/unit/config.test.ts` - Configuration parsing
- `tests/unit/parser.test.ts` - LLM response parsing
- `tests/unit/rate-limiter.test.ts` - Rate limiting logic
- etc.

## Code Style

### TypeScript
- Strict mode enabled
- No `any` types, `@ts-ignore`, or `@ts-expect-error`
- Use Zod for runtime validation
- Prefer explicit types over inference for public APIs

### Imports
- Use `.js` extension for local imports (ESM requirement)
- Group imports: external, internal, types

### Error Handling
- Use structured logging via `src/utils/logger.ts`
- Add context to errors (account name, message ID, etc.)
- Never swallow errors silently

## Architecture

### Key Directories

```
src/
  config/       # Configuration loading and validation
  accounts/     # Account lifecycle management
  imap/         # IMAP client and connection handling
  llm/          # LLM provider abstraction
  processor/    # Email processing pipeline
  actions/      # Action execution (move, flag, delete, etc.)
  storage/      # SQLite database operations
  server/       # HTTP/WebSocket server and dashboard API
  attachments/  # Tika client and attachment extraction
  webhooks/     # Webhook delivery
  utils/        # Shared utilities

dashboard/      # Svelte 5 SPA (separate build)
tests/          # Test suites
  unit/         # Vitest unit tests
  e2e/          # Playwright E2E tests
docs/           # Documentation articles
```

### Documentation Reference

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | AI development guidelines (this file) |
| `AGENTS.md` | LLM integration technical details |
| `docs/ai-e2e-testing.md` | AI agent browser testing protocol |
| `docs/e2e-testing.md` | Complete E2E testing reference |
| `docs/dashboard.md` | Dashboard API reference |
| `docs/database.md` | Database schema documentation |
| `docs/folder-modes.md` | Folder configuration modes |
| `docs/oauth-setup.md` | OAuth configuration guide |
| `docs/antivirus.md` | ClamAV integration |
| `docs/processing-headers.md` | Email header processing |
| `docs/ROADMAP.md` | Feature roadmap |

### Data Flow

1. IMAP client fetches new emails
2. Attachments extracted via Tika (if enabled)
3. Prompt built with email content + folders + schema
4. LLM classifies and returns actions
5. Actions executed (move, flag, etc.)
6. Audit log updated
7. WebSocket broadcasts to dashboard

### State Management

- **SQLite** for persistent state (processed messages, audit log, sessions)
- **In-memory Maps** for runtime state (provider stats, account status)
- **WebSocket** for real-time dashboard updates

## Dashboard (Svelte 5)

Located in `dashboard/` with separate `package.json`.

### Key Files
- `src/lib/stores/` - Svelte stores for state
- `src/lib/components/` - Reusable UI components
- `src/routes/` - Page components
- `src/lib/api.ts` - Backend API client

### Reactivity
- Uses Svelte 5 runes (`$state`, `$derived`, `$effect`)
- WebSocket updates flow through stores to components

## Common Tasks

### Adding a new API endpoint

1. Add route in `src/server/dashboard.ts`
2. Add permission to schema if needed (`src/config/schema.ts`)
3. Update `docs/dashboard.md` API tables
4. Add tests if applicable

### Adding a new LLM provider option

1. Update schema in `src/config/schema.ts`
2. Update provider handling in `src/llm/`
3. Update `docs/llm-providers.md`
4. Update `AGENTS.md` if behavior changes
5. Add unit tests

### Modifying the dashboard

1. Make changes in `dashboard/src/`
2. Test with `pnpm dashboard:dev`
3. Build with `pnpm dashboard:build`
4. Update `docs/dashboard.md` if UI features change

## E2E Testing

Mailpilot has two E2E testing approaches:

1. **Automated Playwright Tests** - Repeatable regression tests via `pnpm test:e2e`
2. **AI Agent Browser Testing** - Interactive testing using Chrome MCP tools

### Automated Playwright Tests

Located in `tests/e2e/`. Run with:

```bash
pnpm test:e2e              # Run all E2E tests (starts dev server automatically)
pnpm test:e2e:headed       # Run with visible browser
pnpm test:e2e:debug        # Debug mode with inspector
```

**Writing new tests:**
- Add tests in `tests/e2e/*.spec.ts`
- Use the `TestReporter` utility for audit trails
- Tests auto-generate reports in `tests/e2e/reports/`:
  - `json/` - Machine-readable test results
  - `markdown/` - Human-readable test reports
  - `screenshots/` - Visual evidence
  - `html/` - Playwright HTML report

**Example test structure:**
```typescript
import { test } from '@playwright/test';
import { createTestReporter, navigateTo } from './utils/index.js';

test('feature works correctly', async ({ page }, testInfo) => {
  const reporter = createTestReporter(testInfo);
  reporter.setPage(page);

  try {
    await navigateTo(page, '/', reporter);
    // ... test steps with reporter.step() calls
    reporter.complete('pass');
  } catch (error) {
    await reporter.stepFailed(error.message);
    reporter.complete('fail', error.message);
    throw error;
  } finally {
    reporter.saveJsonReport();
    reporter.saveMarkdownReport();
  }
});
```

### AI Agent Browser Testing Protocol

For interactive E2E testing during development, AI agents follow this protocol:

**Full documentation**: See `docs/ai-e2e-testing.md`

**Quick reference:**

1. **Start test environment:**
   ```bash
   pnpm dev   # Wait for "Dashboard server started on port 8085"
   ```

2. **Initialize browser context:**
   ```
   mcp__Claude_in_Chrome__tabs_context_mcp
   mcp__Claude_in_Chrome__tabs_create_mcp
   ```

3. **Navigate to dashboard:**
   ```
   mcp__Claude_in_Chrome__navigate with url: "http://localhost:8085"
   ```

4. **Essential MCP tools:**
   - `read_page` - Get DOM structure before interacting
   - `find` - Locate elements by natural language
   - `computer` with `action: "click"` - Click elements
   - `form_input` - Fill form fields
   - `computer` with `action: "screenshot"` - Capture evidence

5. **Document results** using the test report template in `docs/ai-e2e-testing.md`

**When to use each approach:**

| Scenario | Use Automated Tests | Use AI Agent Testing |
|----------|---------------------|----------------------|
| Regression testing | ✅ | |
| CI/CD pipeline | ✅ | |
| Exploratory testing | | ✅ |
| Feature development | | ✅ |
| Bug reproduction | | ✅ |
| Visual verification | | ✅ |

## Build & Test Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Run with hot reload
pnpm build            # Build backend + dashboard
pnpm test             # Run all tests
pnpm test:unit        # Run unit tests only
pnpm lint             # Run ESLint
pnpm typecheck        # Run TypeScript checks
```

## Release Process

1. Update version in `package.json`
2. Update documentation if needed
3. Run full test suite: `pnpm test`
4. Run lint and typecheck: `pnpm lint && pnpm typecheck`
5. Build: `pnpm build`
6. Commit with descriptive message
7. Tag release: `git tag v1.x.x`
8. Push with tags: `git push && git push --tags`
