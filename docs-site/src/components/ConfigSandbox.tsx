'use client';

import { useState } from 'react';
import YAML from 'yaml';

interface ConfigSandboxProps {
  initialConfig?: string;
  showPromptTester?: boolean;
}

export function ConfigSandbox({ initialConfig = '', showPromptTester = true }: ConfigSandboxProps) {
  const [config, setConfig] = useState(initialConfig || defaultConfig);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'test'>('editor');

  const handleConfigChange = (newConfig: string) => {
    setConfig(newConfig);
    validateConfig(newConfig);
  };

  const validateConfig = (configText: string) => {
    try {
      const parsed = YAML.parse(configText);
      const errors: string[] = [];
      const warnings: string[] = [];

      // Validate structure
      if (!parsed.llm_providers || !Array.isArray(parsed.llm_providers)) {
        errors.push('Missing or invalid llm_providers array');
      }

      if (!parsed.accounts || !Array.isArray(parsed.accounts)) {
        errors.push('Missing or invalid accounts array');
      }

      // Validate LLM providers
      parsed.llm_providers?.forEach((provider: any, idx: number) => {
        if (!provider.name) {
          errors.push(`llm_providers[${idx}]: Missing name`);
        }
        if (!provider.provider) {
          errors.push(`llm_providers[${idx}]: Missing provider type`);
        }
        if (provider.provider !== 'ollama' && !provider.api_key) {
          warnings.push(`llm_providers[${idx}]: No API key specified (using environment variable?)`);
        }
      });

      // Validate accounts
      parsed.accounts?.forEach((account: any, idx: number) => {
        if (!account.name) {
          errors.push(`accounts[${idx}]: Missing name`);
        }
        if (!account.imap) {
          errors.push(`accounts[${idx}]: Missing imap configuration`);
        } else {
          if (!account.imap.host) {
            errors.push(`accounts[${idx}].imap: Missing host`);
          }
          if (!account.imap.username) {
            errors.push(`accounts[${idx}].imap: Missing username`);
          }
        }
        if (!account.folders || !Array.isArray(account.folders)) {
          warnings.push(`accounts[${idx}]: No folders configured`);
        }
      });

      setValidationResult({
        valid: errors.length === 0,
        errors,
        warnings,
        parsed,
      });
    } catch (err) {
      setValidationResult({
        valid: false,
        errors: [`YAML Parse Error: ${(err as Error).message}`],
        warnings: [],
        parsed: null,
      });
    }
  };

  return (
    <div className="not-prose my-6 border rounded-lg overflow-hidden">
      {/* Security warning */}
      <div className="bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800 p-3">
        <div className="flex items-start gap-2">
          <span className="text-orange-600 dark:text-orange-400 text-sm">🔒</span>
          <p className="text-xs text-orange-800 dark:text-orange-300">
            <strong>Security Notice:</strong> This sandbox runs entirely in your browser.
            Configuration is not sent to any server. API keys you enter here are for testing only
            and should never be shared.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-muted border-b flex">
        <button
          onClick={() => setActiveTab('editor')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'editor'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Config Editor
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'preview'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Preview
        </button>
        {showPromptTester && (
          <button
            onClick={() => setActiveTab('test')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'test'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Test Prompt
          </button>
        )}
      </div>

      {/* Content */}
      <div className="bg-card">
        {activeTab === 'editor' && (
          <EditorTab
            config={config}
            onChange={handleConfigChange}
            validation={validationResult}
          />
        )}

        {activeTab === 'preview' && (
          <PreviewTab validation={validationResult} />
        )}

        {activeTab === 'test' && showPromptTester && (
          <PromptTestTab config={config} validation={validationResult} />
        )}
      </div>
    </div>
  );
}

function EditorTab({
  config,
  onChange,
  validation,
}: {
  config: string;
  onChange: (v: string) => void;
  validation: ValidationResult | null;
}) {
  return (
    <div className="p-4">
      <div className="mb-3">
        <label className="text-sm font-medium mb-2 block">Configuration (YAML)</label>
        <textarea
          value={config}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-96 p-3 font-mono text-sm bg-muted rounded border focus:outline-none focus:ring-2 focus:ring-primary"
          spellCheck={false}
        />
      </div>

      {/* Validation results */}
      {validation && (
        <div className="space-y-2">
          {validation.valid ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3">
              <div className="flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400">✓</span>
                <span className="text-sm text-green-800 dark:text-green-200 font-medium">
                  Configuration is valid
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
              <div className="flex items-start gap-2">
                <span className="text-red-600 dark:text-red-400">✗</span>
                <div className="flex-1">
                  <div className="text-sm text-red-800 dark:text-red-200 font-medium mb-1">
                    Validation errors:
                  </div>
                  <ul className="text-xs text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
                    {validation.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
              <div className="flex items-start gap-2">
                <span className="text-yellow-600 dark:text-yellow-400">⚠</span>
                <div className="flex-1">
                  <div className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-1">
                    Warnings:
                  </div>
                  <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1 list-disc list-inside">
                    {validation.warnings.map((warn, idx) => (
                      <li key={idx}>{warn}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewTab({ validation }: { validation: ValidationResult | null }) {
  if (!validation || !validation.parsed) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Enter valid configuration to see preview
      </div>
    );
  }

  const { parsed } = validation;

  return (
    <div className="p-4 space-y-4">
      {/* LLM Providers */}
      <div>
        <h4 className="text-sm font-semibold mb-2">LLM Providers ({parsed.llm_providers?.length || 0})</h4>
        <div className="space-y-2">
          {parsed.llm_providers?.map((provider: any, idx: number) => (
            <div key={idx} className="bg-muted p-3 rounded text-sm">
              <div className="font-medium">{provider.name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Provider: {provider.provider} | Model: {provider.model || 'default'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Accounts */}
      <div>
        <h4 className="text-sm font-semibold mb-2">Email Accounts ({parsed.accounts?.length || 0})</h4>
        <div className="space-y-2">
          {parsed.accounts?.map((account: any, idx: number) => (
            <div key={idx} className="bg-muted p-3 rounded text-sm">
              <div className="font-medium">{account.name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {account.imap?.host}:{account.imap?.port || 993}
              </div>
              <div className="text-xs text-muted-foreground">
                Folders: {account.folders?.length || 0}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Folder Mode */}
      {parsed.folders && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Folder Configuration</h4>
          <div className="bg-muted p-3 rounded text-sm">
            <div>Mode: {parsed.folders.mode || 'predefined'}</div>
            {parsed.folders.allowed && (
              <div className="text-xs text-muted-foreground mt-1">
                Allowed folders: {parsed.folders.allowed.join(', ')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PromptTestTab({
  config,
  validation,
}: {
  config: string;
  validation: ValidationResult | null;
}) {
  const [sampleEmail, setSampleEmail] = useState(defaultSampleEmail);
  const [testResult, setTestResult] = useState<string>('');
  const [isTestingReal, setIsTestingReal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [testMode, setTestMode] = useState<'preview' | 'real'>('preview');
  const [isLoading, setIsLoading] = useState(false);

  const runPreviewTest = () => {
    if (!validation?.parsed?.accounts?.[0]?.folders?.[0]?.prompt) {
      setTestResult('Error: No prompt found in configuration');
      return;
    }

    const prompt = validation.parsed.accounts[0].folders[0].prompt;

    setTestResult(`Prompt to be sent to LLM:

${prompt}

Sample email:
${sampleEmail}

---
Note: This is a preview of what would be sent to the LLM. Switch to "Real API Test" mode to test with your actual API key.`);
  };

  const runRealTest = async () => {
    if (!validation?.parsed?.llm_providers?.[0]) {
      setTestResult('Error: No LLM provider found in configuration');
      return;
    }

    if (!apiKey.trim()) {
      setTestResult('Error: Please enter your API key');
      return;
    }

    const provider = validation.parsed.llm_providers[0];
    const prompt = validation.parsed.accounts?.[0]?.folders?.[0]?.prompt ||
                   'Classify this email and suggest an action.';

    setIsLoading(true);
    setTestResult('');

    try {
      const result = await testLLMClassification(provider, apiKey, prompt, sampleEmail);
      setTestResult(`✓ Classification Result:

${result}

---
Test completed successfully. Your API key was used for this request but was never stored or transmitted to our servers.`);
    } catch (error: any) {
      setTestResult(`✗ Error:

${error.message}

${error.corsError ? '\n⚠️ CORS Error: Direct browser requests to this provider are blocked. This is a browser security limitation, not an issue with your configuration. The same setup will work when running the actual mailpilot daemon.' : ''}

---
Your API key was never stored or transmitted to our servers.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Mode selector */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
        <div className="flex items-start gap-2 mb-3">
          <span className="text-blue-600 dark:text-blue-400">ℹ️</span>
          <div className="text-xs text-blue-800 dark:text-blue-300">
            <strong>Testing Modes:</strong>
            <ul className="mt-1 space-y-1 list-disc list-inside">
              <li><strong>Preview Mode:</strong> Shows what would be sent to the LLM (no API call)</li>
              <li><strong>Real API Test:</strong> Makes actual API call using your key (client-side only, never stored)</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setTestMode('preview')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              testMode === 'preview'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border'
            }`}
          >
            Preview Mode
          </button>
          <button
            onClick={() => setTestMode('real')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              testMode === 'real'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border'
            }`}
          >
            Real API Test
          </button>
        </div>
      </div>

      {/* API Key input (only in real mode) */}
      {testMode === 'real' && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded p-3 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-orange-600 dark:text-orange-400">🔐</span>
            <div className="text-xs text-orange-800 dark:text-orange-300 flex-1">
              <strong>Security Warning:</strong> Your API key is processed entirely in your browser.
              It is NEVER sent to our servers, only directly to the LLM provider.
              The key is not stored anywhere - it exists only in memory during the test.
            </div>
          </div>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={`Enter your ${validation?.parsed?.llm_providers?.[0]?.provider || 'LLM'} API key`}
            className="w-full p-2 text-sm bg-white dark:bg-gray-800 rounded border focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
      )}

      {/* Sample email input */}
      <div>
        <label className="text-sm font-medium mb-2 block">Sample Email Content</label>
        <textarea
          value={sampleEmail}
          onChange={(e) => setSampleEmail(e.target.value)}
          className="w-full h-32 p-3 font-mono text-sm bg-muted rounded border focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Enter sample email content to test classification..."
        />
      </div>

      {/* Test button */}
      <button
        onClick={testMode === 'preview' ? runPreviewTest : runRealTest}
        disabled={!validation?.valid || (testMode === 'real' && !apiKey.trim()) || isLoading}
        className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Testing...' : testMode === 'preview' ? 'Preview Prompt' : 'Test with Real API'}
      </button>

      {/* Test result */}
      {testResult && (
        <div>
          <label className="text-sm font-medium mb-2 block">Test Result</label>
          <pre className="bg-muted p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap">
            {testResult}
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * Test LLM classification with real API call (client-side only)
 */
async function testLLMClassification(
  provider: any,
  apiKey: string,
  prompt: string,
  email: string
): Promise<string> {
  const providerType = provider.provider.toLowerCase();
  const model = provider.model || getDefaultModel(providerType);

  const fullPrompt = `${prompt}\n\nEmail to classify:\n${email}\n\nProvide your classification response:`;

  try {
    if (providerType === 'openai') {
      return await testOpenAI(apiKey, model, fullPrompt);
    } else if (providerType === 'anthropic') {
      return await testAnthropic(apiKey, model, fullPrompt);
    } else if (providerType === 'ollama') {
      return await testOllama(provider.base_url || 'http://localhost:11434', model, fullPrompt);
    } else {
      throw new Error(`Provider "${providerType}" is not supported for browser testing. Supported: openai, anthropic, ollama`);
    }
  } catch (error: any) {
    if (error.message.includes('CORS') || error.name === 'TypeError') {
      error.corsError = true;
    }
    throw error;
  }
}

async function testOpenAI(apiKey: string, model: string, prompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(`OpenAI API Error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function testAnthropic(apiKey: string, model: string, prompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(`Anthropic API Error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function testOllama(baseUrl: string, model: string, prompt: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API Error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.response;
}

function getDefaultModel(provider: string): string {
  const defaults: Record<string, string> = {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-haiku-20240307',
    ollama: 'llama2',
  };
  return defaults[provider] || 'gpt-4o-mini';
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  parsed: any;
}

const defaultConfig = `llm_providers:
  - name: openai
    provider: openai
    model: gpt-4o-mini
    api_key: \${OPENAI_API_KEY}

folders:
  mode: predefined
  allowed:
    - Important
    - Newsletters
    - Receipts
    - Archive

accounts:
  - name: personal
    imap:
      host: imap.gmail.com
      port: 993
      username: \${GMAIL_USER}
      password: \${GMAIL_APP_PASSWORD}
    folders:
      - name: INBOX
        llm_provider: openai
        prompt: |
          Classify personal email:

          VIP Senders (flag + keep in INBOX):
          - Family members
          - Close friends

          Rules:
          - Marketing → Newsletters
          - Receipts → Receipts
          - Everything else → Archive
`;

const defaultSampleEmail = `From: newsletter@techcrunch.com
Subject: Latest tech news from TechCrunch
Date: 2026-01-20 09:30:00

Here are today's top technology stories...

[Newsletter content]

Unsubscribe | Manage preferences`;
