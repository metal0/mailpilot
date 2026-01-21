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

  const runTest = () => {
    if (!validation?.parsed?.accounts?.[0]?.folders?.[0]?.prompt) {
      setTestResult('Error: No prompt found in configuration');
      return;
    }

    const prompt = validation.parsed.accounts[0].folders[0].prompt;

    // Simulate prompt testing (in reality, this would call the LLM)
    setTestResult(`Prompt to be sent to LLM:

${prompt}

Sample email:
${sampleEmail}

---
Note: This is a visualization of what would be sent to the LLM. In production, you would need to connect your API key to actually test classification.`);
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">Sample Email Content</label>
        <textarea
          value={sampleEmail}
          onChange={(e) => setSampleEmail(e.target.value)}
          className="w-full h-32 p-3 font-mono text-sm bg-muted rounded border focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Enter sample email content to test classification..."
        />
      </div>

      <button
        onClick={runTest}
        disabled={!validation?.valid}
        className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Test Classification
      </button>

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
