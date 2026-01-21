# Mailpilot Documentation

Official documentation for Mailpilot, built with [fumadocs](https://fumadocs.vercel.app/).

**Live Site:** https://metal0.github.io/mailpilot/

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

## Development

This documentation site is built with:

- **Framework:** Next.js 14 with App Router
- **Content:** MDX files with fumadocs
- **Styling:** Tailwind CSS
- **Deployment:** GitHub Pages via GitHub Actions

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed documentation.

## Structure

```
docs-site/
├── src/
│   ├── app/              # Next.js app router
│   ├── components/       # Interactive React components
│   ├── content/docs/     # MDX documentation content
│   └── lib/              # Generators and utilities
├── public/               # Static assets
└── DEPLOYMENT.md         # Deployment guide
```

## Key Features

### 📚 Comprehensive Documentation

- **Getting Started** - Installation and quick start
- **Email Providers** - Gmail, Outlook, Yahoo, iCloud, ProtonMail
- **LLM Providers** - OpenAI, Anthropic, Ollama, OpenRouter
- **Configuration** - Complete reference with 11 detailed pages
- **Features** - Dashboard, webhooks, antivirus, attachments
- **API Reference** - Auto-generated from source code
- **Troubleshooting** - Common issues and solutions
- **Recipes** - Cookbook examples for common use cases

### 🎨 Interactive Components

- **Setup Wizard** - Multi-step configuration generator
- **Config Sandbox** - YAML editor with validation
- **Version Diff** - Breaking change visualization
- **Matrix Chat Widget** - Community support integration

### 🤖 Automation

- **API Docs Generator** - Parses JSDoc from Hono routes
- **Changelog Generator** - Creates changelog from git history
- **Auto-deployment** - GitHub Actions workflow

## Contributing

### Adding Documentation

1. Create MDX file in `src/content/docs/`
2. Add frontmatter with title and description
3. Update `meta.json` for navigation
4. Test locally with `pnpm dev`

### Adding Components

1. Create component in `src/components/`
2. Use `'use client'` if interactive
3. Export component
4. Import in MDX files

### Updating API Docs

Add JSDoc `@openapi` comments to Hono routes:

```typescript
/**
 * @openapi
 * /api/example:
 *   get:
 *     summary: Example endpoint
 *     description: Detailed description
 */
```

## Deployment

Automatic deployment via GitHub Actions on push to main branch.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment guide.

## License

AGPL-3.0 (same as Mailpilot)
