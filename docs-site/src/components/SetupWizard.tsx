'use client';

import { useState } from 'react';

type WizardStep = 'email-provider' | 'llm-provider' | 'use-case' | 'result';

interface EmailProvider {
  id: string;
  name: string;
  host: string;
  port: number;
  authType: 'password' | 'oauth2';
  docsUrl: string;
}

interface LLMProvider {
  id: string;
  name: string;
  requiresApiKey: boolean;
  costLevel: 'free' | 'low' | 'medium' | 'high';
  docsUrl: string;
}

interface UseCase {
  id: string;
  name: string;
  description: string;
  promptTemplate: string;
}

const emailProviders: EmailProvider[] = [
  { id: 'gmail', name: 'Gmail', host: 'imap.gmail.com', port: 993, authType: 'password', docsUrl: '/docs/email-providers/gmail/' },
  { id: 'outlook', name: 'Outlook / Microsoft 365', host: 'outlook.office365.com', port: 993, authType: 'oauth2', docsUrl: '/docs/email-providers/outlook/' },
  { id: 'yahoo', name: 'Yahoo Mail', host: 'imap.mail.yahoo.com', port: 993, authType: 'password', docsUrl: '/docs/email-providers/yahoo/' },
  { id: 'icloud', name: 'iCloud Mail', host: 'imap.mail.me.com', port: 993, authType: 'password', docsUrl: '/docs/email-providers/icloud/' },
  { id: 'protonmail', name: 'ProtonMail', host: '127.0.0.1', port: 1143, authType: 'password', docsUrl: '/docs/email-providers/protonmail/' },
  { id: 'generic', name: 'Generic IMAP Server', host: 'imap.example.com', port: 993, authType: 'password', docsUrl: '/docs/email-providers/generic-imap/' },
];

const llmProviders: LLMProvider[] = [
  { id: 'openai', name: 'OpenAI (GPT-4o-mini)', requiresApiKey: true, costLevel: 'low', docsUrl: '/docs/llm-providers/openai/' },
  { id: 'anthropic', name: 'Anthropic (Claude)', requiresApiKey: true, costLevel: 'medium', docsUrl: '/docs/llm-providers/anthropic/' },
  { id: 'ollama', name: 'Ollama (Local)', requiresApiKey: false, costLevel: 'free', docsUrl: '/docs/llm-providers/ollama/' },
  { id: 'openrouter', name: 'OpenRouter', requiresApiKey: true, costLevel: 'low', docsUrl: '/docs/llm-providers/openrouter/' },
];

const useCases: UseCase[] = [
  {
    id: 'personal',
    name: 'Personal Email Organization',
    description: 'Organize newsletters, receipts, and personal messages',
    promptTemplate: `Classify personal email for inbox zero:

VIP Senders (flag + keep in INBOX):
- Family members
- Close friends
- Urgent matters

Rules:
- Marketing emails → Newsletters
- Order confirmations, receipts → Receipts
- Social media notifications → Social
- Everything else worth keeping → Archive`,
  },
  {
    id: 'business',
    name: 'Business / Sales',
    description: 'Manage client communication and leads',
    promptTemplate: `Classify business email for sales workflow:

VIP Clients (flag + keep in INBOX):
- @important-client.com
- Any email mentioning "urgent" or "ASAP"

Categorization:
- Existing clients → Clients/{Company Name}
- New inquiries → Leads
- Invoices/billing → Invoices
- Team communication → Team
- Automated reports → mark as read, Archive`,
  },
  {
    id: 'developer',
    name: 'Developer Inbox',
    description: 'GitHub notifications, CI/CD alerts, tech newsletters',
    promptTemplate: `Classify developer email:

High Priority (flag + keep in INBOX):
- PR reviews for my repositories
- Security advisories
- Production alerts

GitHub:
- Issues/PRs → GitHub/{repository-name}
- Dependabot → Security/Dependabot

CI/CD:
- Build failures → Deploy/Failed (flag)
- Successful builds → Deploy/Success (mark as read)

Other:
- Tech newsletters → Newsletters
- Marketing → Archive`,
  },
];

export function SetupWizard() {
  const [step, setStep] = useState<WizardStep>('email-provider');
  const [selectedEmail, setSelectedEmail] = useState<EmailProvider | null>(null);
  const [selectedLLM, setSelectedLLM] = useState<LLMProvider | null>(null);
  const [selectedUseCase, setSelectedUseCase] = useState<UseCase | null>(null);

  const handleEmailSelect = (provider: EmailProvider) => {
    setSelectedEmail(provider);
    setStep('llm-provider');
  };

  const handleLLMSelect = (provider: LLMProvider) => {
    setSelectedLLM(provider);
    setStep('use-case');
  };

  const handleUseCaseSelect = (useCase: UseCase) => {
    setSelectedUseCase(useCase);
    setStep('result');
  };

  const reset = () => {
    setStep('email-provider');
    setSelectedEmail(null);
    setSelectedLLM(null);
    setSelectedUseCase(null);
  };

  return (
    <div className="not-prose my-8 border border-fd-border rounded-lg p-6 bg-fd-card">
      <h3 className="text-lg font-semibold mb-4 text-fd-foreground">
        Interactive Setup Wizard
      </h3>

      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-6">
        <StepIndicator
          label="Email Provider"
          active={step === 'email-provider'}
          completed={selectedEmail !== null}
        />
        <div className="flex-1 h-px bg-fd-border mx-2" />
        <StepIndicator
          label="LLM Provider"
          active={step === 'llm-provider'}
          completed={selectedLLM !== null}
        />
        <div className="flex-1 h-px bg-fd-border mx-2" />
        <StepIndicator
          label="Use Case"
          active={step === 'use-case'}
          completed={selectedUseCase !== null}
        />
        <div className="flex-1 h-px bg-fd-border mx-2" />
        <StepIndicator
          label="Configuration"
          active={step === 'result'}
          completed={false}
        />
      </div>

      {/* Step content */}
      {step === 'email-provider' && (
        <EmailProviderStep
          providers={emailProviders}
          onSelect={handleEmailSelect}
        />
      )}

      {step === 'llm-provider' && (
        <LLMProviderStep
          providers={llmProviders}
          onSelect={handleLLMSelect}
          onBack={() => setStep('email-provider')}
        />
      )}

      {step === 'use-case' && (
        <UseCaseStep
          useCases={useCases}
          onSelect={handleUseCaseSelect}
          onBack={() => setStep('llm-provider')}
        />
      )}

      {step === 'result' && selectedEmail && selectedLLM && selectedUseCase && (
        <ResultStep
          email={selectedEmail}
          llm={selectedLLM}
          useCase={selectedUseCase}
          onReset={reset}
        />
      )}
    </div>
  );
}

function StepIndicator({ label, active, completed }: { label: string; active: boolean; completed: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
          completed
            ? 'bg-fd-primary text-fd-primary-foreground'
            : active
            ? 'bg-fd-primary/20 text-fd-primary border-2 border-fd-primary'
            : 'bg-fd-muted text-fd-muted-foreground'
        }`}
      >
        {completed ? '✓' : ''}
      </div>
      <span className="text-xs mt-1 text-fd-muted-foreground">{label}</span>
    </div>
  );
}

function EmailProviderStep({ providers, onSelect }: { providers: EmailProvider[]; onSelect: (p: EmailProvider) => void }) {
  return (
    <div>
      <h4 className="font-medium mb-4 text-fd-foreground">Choose your email provider:</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {providers.map((provider) => (
          <button
            key={provider.id}
            onClick={() => onSelect(provider)}
            className="p-4 border border-fd-border rounded-lg hover:border-fd-primary hover:bg-fd-accent transition-colors text-left"
          >
            <div className="font-medium text-fd-foreground">{provider.name}</div>
            <div className="text-sm text-fd-muted-foreground mt-1">
              {provider.host}:{provider.port}
            </div>
            <div className="text-xs text-fd-muted-foreground mt-1">
              Auth: {provider.authType === 'oauth2' ? 'OAuth 2.0' : 'App Password'}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function LLMProviderStep({
  providers,
  onSelect,
  onBack,
}: {
  providers: LLMProvider[];
  onSelect: (p: LLMProvider) => void;
  onBack: () => void;
}) {
  const costLabels = {
    free: 'Free (Local)',
    low: '~$0.05/mo',
    medium: '~$0.50/mo',
    high: '~$5/mo',
  };

  return (
    <div>
      <h4 className="font-medium mb-4 text-fd-foreground">Choose your LLM provider:</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {providers.map((provider) => (
          <button
            key={provider.id}
            onClick={() => onSelect(provider)}
            className="p-4 border border-fd-border rounded-lg hover:border-fd-primary hover:bg-fd-accent transition-colors text-left"
          >
            <div className="font-medium text-fd-foreground">{provider.name}</div>
            <div className="text-sm text-fd-muted-foreground mt-1">
              Cost: {costLabels[provider.costLevel]}
            </div>
            {provider.requiresApiKey && (
              <div className="text-xs text-fd-muted-foreground mt-1">
                Requires API key
              </div>
            )}
          </button>
        ))}
      </div>
      <button
        onClick={onBack}
        className="mt-4 px-4 py-2 text-sm border border-fd-border rounded-lg hover:bg-fd-accent text-fd-foreground"
      >
        ← Back
      </button>
    </div>
  );
}

function UseCaseStep({
  useCases,
  onSelect,
  onBack,
}: {
  useCases: UseCase[];
  onSelect: (u: UseCase) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <h4 className="font-medium mb-4 text-fd-foreground">What will you use Mailpilot for?</h4>
      <div className="grid grid-cols-1 gap-3">
        {useCases.map((useCase) => (
          <button
            key={useCase.id}
            onClick={() => onSelect(useCase)}
            className="p-4 border border-fd-border rounded-lg hover:border-fd-primary hover:bg-fd-accent transition-colors text-left"
          >
            <div className="font-medium text-fd-foreground">{useCase.name}</div>
            <div className="text-sm text-fd-muted-foreground mt-1">
              {useCase.description}
            </div>
          </button>
        ))}
      </div>
      <button
        onClick={onBack}
        className="mt-4 px-4 py-2 text-sm border border-fd-border rounded-lg hover:bg-fd-accent text-fd-foreground"
      >
        ← Back
      </button>
    </div>
  );
}

function ResultStep({
  email,
  llm,
  useCase,
  onReset,
}: {
  email: EmailProvider;
  llm: LLMProvider;
  useCase: UseCase;
  onReset: () => void;
}) {
  const envVars: string[] = [];

  if (email.authType === 'password') {
    if (email.id === 'gmail') {
      envVars.push('GMAIL_USER', 'GMAIL_APP_PASSWORD');
    } else {
      envVars.push('EMAIL_USER', 'EMAIL_PASSWORD');
    }
  }

  if (llm.requiresApiKey) {
    if (llm.id === 'openai') {
      envVars.push('OPENAI_API_KEY');
    } else if (llm.id === 'anthropic') {
      envVars.push('ANTHROPIC_API_KEY');
    } else if (llm.id === 'openrouter') {
      envVars.push('OPENROUTER_API_KEY');
    }
  }

  const config = generateConfig(email, llm, useCase);

  return (
    <div>
      <h4 className="font-medium mb-4 text-fd-foreground">Your customized configuration:</h4>

      <div className="space-y-4">
        {/* Summary */}
        <div className="bg-fd-muted p-4 rounded-lg">
          <div className="text-sm text-fd-foreground">
            <div><strong>Email:</strong> {email.name}</div>
            <div><strong>LLM:</strong> {llm.name}</div>
            <div><strong>Use Case:</strong> {useCase.name}</div>
          </div>
        </div>

        {/* Environment variables */}
        {envVars.length > 0 && (
          <div>
            <h5 className="text-sm font-medium mb-2 text-fd-foreground">1. Set environment variables:</h5>
            <pre className="bg-fd-muted p-3 rounded text-xs overflow-x-auto text-fd-foreground">
              {envVars.map((v) => `export ${v}="your-${v.toLowerCase().replace(/_/g, '-')}"`).join('\n')}
            </pre>
          </div>
        )}

        {/* Configuration */}
        <div>
          <h5 className="text-sm font-medium mb-2 text-fd-foreground">2. Create config.yaml:</h5>
          <pre className="bg-fd-muted p-3 rounded text-xs overflow-x-auto text-fd-foreground">
            {config}
          </pre>
        </div>

        {/* Next steps */}
        <div>
          <h5 className="text-sm font-medium mb-2 text-fd-foreground">3. Next steps:</h5>
          <ul className="text-sm space-y-1 list-disc list-inside text-fd-foreground">
            <li>
              <a href={email.docsUrl} className="text-fd-primary hover:underline">
                Follow {email.name} setup guide →
              </a>
            </li>
            <li>
              <a href={llm.docsUrl} className="text-fd-primary hover:underline">
                Configure {llm.name} →
              </a>
            </li>
            <li>
              <a href="/docs/getting-started/installation/" className="text-fd-primary hover:underline">
                Complete installation →
              </a>
            </li>
          </ul>
        </div>
      </div>

      <button
        onClick={onReset}
        className="mt-6 px-4 py-2 text-sm border border-fd-border rounded-lg hover:bg-fd-accent text-fd-foreground"
      >
        ← Start Over
      </button>
    </div>
  );
}

function generateConfig(email: EmailProvider, llm: LLMProvider, useCase: UseCase): string {
  const lines: string[] = [];

  // LLM provider config
  lines.push('llm_providers:');
  lines.push(`  - name: ${llm.id}`);

  if (llm.id === 'openai') {
    lines.push('    provider: openai');
    lines.push('    model: gpt-4o-mini');
    lines.push('    api_key: ${OPENAI_API_KEY}');
  } else if (llm.id === 'anthropic') {
    lines.push('    provider: anthropic');
    lines.push('    model: claude-3-haiku-20240307');
    lines.push('    api_key: ${ANTHROPIC_API_KEY}');
  } else if (llm.id === 'ollama') {
    lines.push('    provider: ollama');
    lines.push('    model: llama3.2:3b');
    lines.push('    base_url: http://localhost:11434');
  } else if (llm.id === 'openrouter') {
    lines.push('    provider: openrouter');
    lines.push('    model: anthropic/claude-3-haiku');
    lines.push('    api_key: ${OPENROUTER_API_KEY}');
  }

  lines.push('');

  // Folder mode
  lines.push('folders:');
  if (useCase.id === 'personal') {
    lines.push('  mode: predefined');
    lines.push('  allowed:');
    lines.push('    - Important');
    lines.push('    - Receipts');
    lines.push('    - Newsletters');
    lines.push('    - Social');
    lines.push('    - Archive');
  } else {
    lines.push('  mode: auto_create  # Automatically create folders as needed');
  }

  lines.push('');

  // Account config
  lines.push('accounts:');
  lines.push(`  - name: ${useCase.id}`);
  lines.push('    imap:');
  lines.push(`      host: ${email.host}`);
  lines.push(`      port: ${email.port}`);

  if (email.authType === 'oauth2') {
    lines.push('      auth: oauth2');
    lines.push('      username: you@example.com');
    lines.push('      oauth_client_id: ${OAUTH_CLIENT_ID}');
    lines.push('      oauth_client_secret: ${OAUTH_CLIENT_SECRET}');
    lines.push('      oauth_refresh_token: ${OAUTH_REFRESH_TOKEN}');
  } else {
    if (email.id === 'gmail') {
      lines.push('      username: ${GMAIL_USER}');
      lines.push('      password: ${GMAIL_APP_PASSWORD}');
    } else {
      lines.push('      username: ${EMAIL_USER}');
      lines.push('      password: ${EMAIL_PASSWORD}');
    }
  }

  lines.push('    folders:');
  lines.push('      - name: INBOX');
  lines.push(`        llm_provider: ${llm.id}`);
  lines.push('        prompt: |');

  // Add prompt template with proper indentation
  const promptLines = useCase.promptTemplate.split('\n');
  promptLines.forEach((line) => {
    lines.push(`          ${line}`);
  });

  return lines.join('\n');
}
