import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Mailpilot
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300">
          AI-powered email processing daemon
        </p>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
          Automatically classify, organize, and process your emails using LLM-powered intelligence.
          Privacy-focused, open-source, and runs on your infrastructure.
        </p>

        <div className="flex gap-4 justify-center pt-4">
          <Link
            href="/docs"
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="https://github.com/metal0/mailpilot"
            className="px-8 py-3 border border-gray-300 dark:border-gray-700 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
          <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg">
            <h3 className="font-semibold text-lg mb-2">🧠 LLM-Powered</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Use OpenAI, Anthropic, Ollama, or any local model to intelligently process emails
            </p>
          </div>
          <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg">
            <h3 className="font-semibold text-lg mb-2">🔒 Privacy-Focused</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Run entirely on your infrastructure. Your emails never leave your control.
            </p>
          </div>
          <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg">
            <h3 className="font-semibold text-lg mb-2">⚡ Open Source</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Fully open source and customizable. Extend it to fit your exact workflow.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
