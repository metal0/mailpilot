# Fumadocs Documentation Deployment Guide

## Overview

The Mailpilot documentation is built with fumadocs (Next.js 14 + MDX) and deployed to GitHub Pages via GitHub Actions.

**Live URL:** https://metal0.github.io/mailpilot/

## Architecture

- **Framework:** Next.js 14 with App Router
- **Content:** MDX files in `src/content/docs/`
- **Static Generation:** `output: 'export'` for GitHub Pages
- **Automation:** API docs and changelog auto-generated from source
- **Deployment:** GitHub Actions workflow (`.github/workflows/docs.yml`)

## Local Development

### Prerequisites

- Node.js 22+
- pnpm 10.28.0+

### Commands

```bash
# Install dependencies
cd docs-site
pnpm install

# Start dev server (http://localhost:3001)
pnpm dev

# Build static site
pnpm build

# Preview production build
pnpm start
```

### Available Scripts

- `pnpm dev` - Development server with hot reload
- `pnpm build` - Production build with static export
- `pnpm generate:api` - Generate API docs from source code
- `pnpm generate:changelog` - Generate changelog from git history

## Content Structure

```
src/content/docs/
├── getting-started/     # Installation and quick start
├── email-providers/     # Gmail, Outlook, etc. setup guides
├── llm-providers/       # OpenAI, Anthropic, Ollama guides
├── configuration/       # Configuration reference (11 pages)
├── features/           # Dashboard, webhooks, positioning
├── development/        # Contributing, testing, benchmarks
├── api/                # API reference
│   └── generated/      # Auto-generated from JSDoc
├── troubleshooting/    # Common issues
├── recipes/            # Cookbook examples
├── changelog.mdx       # Manual changelog
└── roadmap.mdx         # Feature roadmap
```

## Navigation

Navigation is defined in `meta.json` files at each directory level:

```json
{
  "title": "Section Title",
  "pages": ["page1", "page2"],
  "icon": "BookOpen"
}
```

## Components

Interactive React components in `src/components/`:

- **SetupWizard** - Multi-step configuration wizard
- **ConfigSandbox** - Interactive YAML config editor
- **VersionDiff** - Breaking change visualization
- **MatrixChatWidget** - Community chat integration

Usage in MDX:
```mdx
import { SetupWizard } from '@/components/SetupWizard';

<SetupWizard />
```

## Automation

### API Documentation

**Source:** `src/lib/generate-api-docs.ts`

Parses JSDoc `@openapi` comments from Hono routes and generates MDX documentation.

**Add API docs to a route:**
```typescript
/**
 * @openapi
 * /api/example:
 *   get:
 *     summary: Example endpoint
 *     description: Detailed description
 *     tags: [Example]
 *     responses:
 *       200:
 *         description: Success
 */
app.get('/api/example', async (c) => {
  // ...
});
```

**Output:** `src/content/docs/api/generated/endpoints.mdx`

### Changelog

**Source:** `src/lib/generate-changelog.ts`

Generates changelog from git tags and conventional commit messages.

**Commit format:**
```
type(scope): subject

feat: add new feature
fix: resolve bug
docs: update documentation
```

**Output:** `src/content/docs/changelog/generated.mdx`

## Deployment

### GitHub Actions Workflow

**File:** `.github/workflows/docs.yml`

**Triggers:**
- Push to `main`/`master` branch
- Changes to `docs-site/**` or `src/server/**`
- Manual workflow dispatch

**Steps:**
1. Checkout repository (full history for changelog)
2. Setup pnpm + Node.js
3. Install dependencies
4. Generate API docs (continue-on-error)
5. Generate changelog (continue-on-error)
6. Build static site
7. Deploy to GitHub Pages

**Deployment URL:** Automatically available at `https://metal0.github.io/mailpilot/`

### Manual Deployment

If you need to deploy manually:

```bash
# Build the site
cd docs-site
pnpm build

# Output is in docs-site/out/
# Upload to your hosting provider
```

## GitHub Pages Setup

**Required Repository Settings:**

1. Go to repository **Settings → Pages**
2. **Source:** GitHub Actions (not branch)
3. **URL:** `https://metal0.github.io/mailpilot/`

The workflow handles everything automatically. No manual configuration needed.

## Configuration

### Base Path

Production uses `/mailpilot` base path for GitHub Pages:

```js
// next.config.mjs
basePath: process.env.NODE_ENV === 'production' ? '/mailpilot' : ''
```

All links automatically include the base path.

### Environment Variables

None required. All content is static.

## Troubleshooting

### Build Fails

**Check:**
1. All MDX files have valid frontmatter
2. No broken imports in components
3. `meta.json` files are valid JSON
4. Generator scripts (can fail gracefully)

**Run locally:**
```bash
pnpm build
```

### Links Not Working

**Internal links** should use format:
```mdx
[Link text](/docs/section/page/)
```

**External links:**
```mdx
[Link text](https://example.com)
```

### Components Not Rendering

**Check:**
1. Component is exported from file
2. Import path is correct in MDX
3. Component uses `'use client'` if it has state

### Generators Failing

Generators use `continue-on-error` in GitHub Actions, so they won't break builds.

**Test locally:**
```bash
pnpm generate:api
pnpm generate:changelog
```

## Updating Documentation

### Add a New Page

1. Create MDX file: `src/content/docs/section/page.mdx`
2. Add frontmatter:
   ```mdx
   ---
   title: Page Title
   description: Page description
   ---
   ```
3. Update `meta.json` in section directory
4. Commit and push

### Update Navigation

Edit `meta.json` in the relevant section:

```json
{
  "title": "Section Name",
  "pages": ["page1", "page2", "new-page"],
  "icon": "BookOpen"
}
```

### Add Interactive Component

1. Create component in `src/components/`
2. Use `'use client'` for interactivity
3. Import in MDX: `import { Component } from '@/components/Component';`
4. Use in content: `<Component />`

## Performance

### Build Time

- Full build: ~30-60 seconds
- Incremental dev: <1 second hot reload

### Output Size

- Static site: ~5-10 MB
- First load: ~200-300 KB (fumadocs framework)

## Security

- No backend - fully static
- No secrets required
- Client-side only components
- No user data collection

## Monitoring

### Check Deployment Status

1. GitHub → Actions tab
2. View "Deploy Documentation" workflow
3. Check deployment status and logs

### Broken Links

Currently manual verification. Consider adding:
- Link checker in CI
- Lighthouse CI for performance

## Support

- **Issues:** https://github.com/metal0/mailpilot/issues
- **Discussions:** https://github.com/metal0/mailpilot/discussions
- **Matrix Chat:** https://matrix.to/#/#mailpilot:i0.tf

## Next Steps

After deployment:

1. Verify all links work on live site
2. Test interactive components
3. Check mobile responsiveness
4. Monitor GitHub Actions for failures
5. Consider adding:
   - Link checker
   - SEO optimization
   - Analytics (privacy-friendly)
