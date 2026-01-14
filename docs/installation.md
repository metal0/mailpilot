# Installation

## Prerequisites

- **Node.js 22+** - Required for ES2024 features and native ESM support
- **pnpm** - Recommended package manager (npm works but pnpm is faster)
- **OpenAI-compatible API** - Any LLM provider with OpenAI-compatible endpoint

## Quick Install

```bash
# Clone the repository
git clone https://github.com/metal0/mailpilot.git
cd mailpilot

# Install dependencies
pnpm install

# Build TypeScript
pnpm build

# Configure
cp config.example.yaml config.yaml
# Edit config.yaml with your credentials

# Run
pnpm start
```

## Docker Install

The easiest way to run Mailpilot is with Docker:

```bash
# Create configuration
mkdir -p data logs
cp config.example.yaml config.yaml
# Edit config.yaml

# Run with Docker Compose
docker compose up -d
```

## Verify Installation

Check that Mailpilot is running:

```bash
# Health check
curl http://localhost:8080/health
# Should return: {"status":"ok"}

# View logs
docker compose logs -f
# Or for non-Docker: check stdout
```

## Development Setup

For contributing or local development:

```bash
# Install dependencies
pnpm install

# Run in development mode (auto-reload)
pnpm dev

# Run tests
pnpm test

# Lint code
pnpm lint

# Type check
pnpm typecheck
```

## Upgrading

```bash
# Pull latest changes
git pull

# Update dependencies
pnpm install

# Rebuild
pnpm build

# Restart
pnpm start
# Or: docker compose pull && docker compose up -d
```

## Uninstalling

```bash
# Stop the service
docker compose down
# Or: pkill -f "node dist/index.js"

# Remove data (optional - destructive!)
rm -rf data/ logs/

# Remove the directory
cd .. && rm -rf mailpilot/
```
