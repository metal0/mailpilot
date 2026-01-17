# Mailpilot

[![Test](https://github.com/metal0/mailpilot/actions/workflows/test.yml/badge.svg)](https://github.com/metal0/mailpilot/actions/workflows/test.yml)
[![Release](https://github.com/metal0/mailpilot/actions/workflows/release.yml/badge.svg)](https://github.com/metal0/mailpilot/actions/workflows/release.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Matrix](https://img.shields.io/badge/Matrix-%23mailpilot-blue?logo=matrix)](https://matrix.to/#/#mailpilot:i0.tf)

AI-powered email processing daemon that uses LLM classification to automatically organize, flag, and manage your inbox.

<p align="center">
  <img src="docs/images/dashboard-overview.png" alt="Mailpilot Dashboard" width="800">
</p>

## Features

- **Smart LLM Classification** - Uses any OpenAI-compatible API (OpenAI, Anthropic, Ollama, Azure, etc.) with confidence scoring, multi-action support, and vision capabilities for image analysis
- **Powerful Email Actions** - Move to folders, mark as spam, flag, mark read, delete — multiple actions per email with automatic folder creation
- **Multi-Account Management** - Process unlimited email accounts with per-account LLM providers, models, and classification rules
- **Real-Time Dashboard** - Modern web interface with live updates, activity logs, and provider health monitoring
- **Rule Testing Sandbox** - Test your classification prompts against sample emails before deploying to production
- **Attachment Intelligence** - Extract and analyze text from PDFs, Word docs, and spreadsheets via Apache Tika
- **Dead Letter Queue** - Failed classifications automatically queued for manual review with one-click retry
- **Privacy-First Design** - Email content never stored or logged; only message IDs and action records persisted
- **Works With Any IMAP Server** - Gmail, Outlook, FastMail, self-hosted — any provider with IMAP support
- **Antivirus Integration** - Optional ClamAV scanning to quarantine or flag suspicious attachments

## Quick Start

```bash
# Clone and install
git clone https://github.com/metal0/mailpilot.git
cd mailpilot
pnpm install

# Configure
cp config.example.yaml config.yaml
# Edit config.yaml with your settings

# Build and run
pnpm build
pnpm start
```

### Minimal Configuration

```yaml
llm_providers:
  - name: openai
    api_url: https://api.openai.com/v1/chat/completions
    api_key: ${OPENAI_API_KEY}
    default_model: gpt-4o-mini

accounts:
  - name: personal
    imap:
      host: imap.gmail.com
      username: ${GMAIL_USER}
      password: ${GMAIL_APP_PASSWORD}
```

Set environment variables:
```bash
export OPENAI_API_KEY="sk-..."
export GMAIL_USER="you@gmail.com"
export GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"
```

## Documentation

Full documentation is available on the **[GitHub Wiki](https://github.com/metal0/mailpilot/wiki)**.

| Guide | Description |
|-------|-------------|
| [Installation](https://github.com/metal0/mailpilot/wiki/Installation) | Setup and requirements |
| [Quick Start](https://github.com/metal0/mailpilot/wiki/Quick-Start) | Get running in 5 minutes |
| [Configuration Reference](https://github.com/metal0/mailpilot/wiki/Configuration-Reference) | All configuration options |
| [Gmail Setup](https://github.com/metal0/mailpilot/wiki/Gmail-Setup) | Gmail with App Passwords |
| [Outlook Setup](https://github.com/metal0/mailpilot/wiki/Outlook-&-Microsoft-365) | Microsoft 365/Outlook |
| [LLM Providers](https://github.com/metal0/mailpilot/wiki/OpenAI-Setup) | OpenAI, Ollama, Claude, etc. |
| [Prompts Guide](https://github.com/metal0/mailpilot/wiki/Prompts-Guide) | Writing classification prompts |
| [Troubleshooting](https://github.com/metal0/mailpilot/wiki/Troubleshooting) | Common issues and solutions |

## Docker Deployment

### Basic

```yaml
services:
  mailpilot:
    image: ghcr.io/metal0/mailpilot:latest
    ports:
      - "8080:8080"
    volumes:
      - ./config.yaml:/app/config.yaml:ro
      - ./data:/app/data
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
```

### Full (with Tika + ClamAV)

```bash
docker compose -f docker-compose.full.yaml up -d
```

Includes Apache Tika for attachment extraction and ClamAV for virus scanning.

## Development

```bash
pnpm dev          # Run with hot reload
pnpm test         # Run tests
pnpm lint         # Run ESLint
pnpm typecheck    # Type check
```

## Community

- **[Matrix Chat](https://matrix.to/#/#mailpilot:i0.tf)** - Join the community chat room
- **[GitHub Issues](https://github.com/metal0/mailpilot/issues)** - Report bugs or request features
- **[GitHub Wiki](https://github.com/metal0/mailpilot/wiki)** - Full documentation

## License

AGPL-3.0
