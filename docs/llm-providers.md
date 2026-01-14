# LLM Providers Guide

Mailpilot supports any OpenAI-compatible API. This guide covers setup for popular providers.

## OpenAI

```yaml
llm_providers:
  - name: openai
    api_url: https://api.openai.com/v1/chat/completions
    api_key: ${OPENAI_API_KEY}
    default_model: gpt-4o-mini
    max_body_tokens: 4000
    rate_limit_rpm: 60
```

**Recommended models:**
- `gpt-4o-mini` - Fast, cheap, good for most use cases
- `gpt-4o` - More accurate, higher cost

**Get API key:** https://platform.openai.com/api-keys

## Anthropic Claude

```yaml
llm_providers:
  - name: anthropic
    api_url: https://api.anthropic.com/v1/messages
    api_key: ${ANTHROPIC_API_KEY}
    default_model: claude-3-haiku-20240307
    max_body_tokens: 8000
```

**Recommended models:**
- `claude-3-haiku-20240307` - Fast and cheap
- `claude-sonnet-4-20250514` - Better accuracy

**Get API key:** https://console.anthropic.com/

## Local Ollama

Run LLMs locally without API costs:

```yaml
llm_providers:
  - name: ollama
    api_url: http://localhost:11434/v1/chat/completions
    default_model: llama3.2
    max_body_tokens: 4000
```

**Setup:**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.2

# Start (runs automatically on install)
ollama serve
```

**Recommended models:**
- `llama3.2` - Good balance of speed and quality
- `llama3.2:1b` - Faster, lower quality
- `mistral` - Alternative option

## Groq

Fast inference with free tier:

```yaml
llm_providers:
  - name: groq
    api_url: https://api.groq.com/openai/v1/chat/completions
    api_key: ${GROQ_API_KEY}
    default_model: llama-3.3-70b-versatile
    rate_limit_rpm: 30
```

**Get API key:** https://console.groq.com/

## Together AI

```yaml
llm_providers:
  - name: together
    api_url: https://api.together.xyz/v1/chat/completions
    api_key: ${TOGETHER_API_KEY}
    default_model: meta-llama/Llama-3.3-70B-Instruct-Turbo
    max_body_tokens: 4000
```

**Get API key:** https://api.together.xyz/

## OpenRouter

Multi-provider gateway - access multiple LLMs with one API key:

```yaml
llm_providers:
  - name: openrouter
    api_url: https://openrouter.ai/api/v1/chat/completions
    api_key: ${OPENROUTER_API_KEY}
    default_model: anthropic/claude-sonnet-4
    max_body_tokens: 8000
```

**Get API key:** https://openrouter.ai/keys

## Azure OpenAI

```yaml
llm_providers:
  - name: azure
    api_url: https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT/chat/completions?api-version=2024-02-15-preview
    api_key: ${AZURE_OPENAI_KEY}
    default_model: gpt-4o
    rate_limit_rpm: 60
```

Replace `YOUR-RESOURCE` and `YOUR-DEPLOYMENT` with your Azure values.

## Multiple Providers

Configure multiple providers and select per-account:

```yaml
llm_providers:
  - name: openai-fast
    api_url: https://api.openai.com/v1/chat/completions
    api_key: ${OPENAI_API_KEY}
    default_model: gpt-4o-mini

  - name: openai-accurate
    api_url: https://api.openai.com/v1/chat/completions
    api_key: ${OPENAI_API_KEY}
    default_model: gpt-4o

  - name: local
    api_url: http://localhost:11434/v1/chat/completions
    default_model: llama3.2

accounts:
  - name: personal
    llm:
      provider: openai-fast    # Fast for personal email

  - name: work
    llm:
      provider: openai-accurate # Accurate for work email

  - name: backup
    llm:
      provider: local          # Free for low-priority
```

## Rate Limiting

Mailpilot respects rate limits automatically via 429 responses. You can also set manual limits:

```yaml
llm_providers:
  - name: openai
    api_url: https://api.openai.com/v1/chat/completions
    api_key: ${OPENAI_API_KEY}
    default_model: gpt-4o-mini
    rate_limit_rpm: 60         # Max 60 requests per minute
```

Rate limits are scoped per API endpoint URL. Two providers using different URLs have independent limits.

## Token Limits

Control costs by limiting tokens sent to the LLM:

```yaml
llm_providers:
  - name: openai
    max_body_tokens: 4000      # Truncate email body
    max_thread_tokens: 2000    # Limit thread context
```

Emails longer than `max_body_tokens` are truncated. Thread context beyond `max_thread_tokens` is omitted.
