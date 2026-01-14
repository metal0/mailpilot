# AI Development Instructions for Mailpilot

This document provides guidelines for AI assistants working on the Mailpilot codebase.

## Project Overview

Mailpilot is an AI-powered email processing daemon that uses LLM classification to organize emails. Built with TypeScript, Node.js 22+, and a Svelte 5 dashboard.

## Priority Guidelines

### Documentation Updates (HIGH PRIORITY)

When making changes to the codebase, documentation MUST be reviewed and updated:

1. **README.md** - Update if features, configuration, or usage changes
2. **SPEC.md** - Update if architecture, schemas, or behavior changes
3. **AGENTS.md** - Update if LLM integration, prompts, or AI features change
4. **docs/** folder - Update relevant documentation articles:
   - `docs/dashboard.md` - Dashboard features and API
   - `docs/configuration.md` - Config options
   - `docs/llm-providers.md` - Provider setup
   - Other topic-specific docs

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
