# AI Development Instructions for Mailpilot

This document provides guidelines for AI assistants working on the Mailpilot codebase.

## Project Overview

Mailpilot is an AI-powered email processing daemon that uses LLM classification to organize emails. Built with TypeScript, Node.js 22+, and a Svelte 5 dashboard.

## Critical Rules

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
tests/          # Vitest test suites
docs/           # Documentation articles
```

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

### Browser Testing with Playwright MCP

For end-to-end testing of dashboard features, use Playwright MCP tools:

1. **Start the app**: `pnpm dev` (runs backend with hot reload + serves dashboard)
2. **Navigate**: Use `mcp__plugin_playwright_playwright__browser_navigate` to open `http://localhost:8085`
3. **Capture state**: Use `mcp__plugin_playwright_playwright__browser_snapshot` to get accessibility tree
4. **Interact**: Use `mcp__plugin_playwright_playwright__browser_click`, `browser_type`, `browser_select_option`
5. **Verify API responses**: Use `mcp__plugin_playwright_playwright__browser_evaluate` for fetch calls

Example workflow:
```
1. Start app: pnpm dev
2. Navigate to dashboard
3. Click Settings > Email Accounts > Add Account
4. Fill IMAP host, press Enter to probe
5. Verify port locking, TLS mode options, OAuth detection
6. Test TLS mode switching updates port correctly
```

This is useful for testing complex UI flows like the account wizard, configuration changes, etc.

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
