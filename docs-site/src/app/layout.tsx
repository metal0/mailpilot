import './global.css';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

const inter = Inter({ subsets: ['latin'] });

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body>
        <RootProvider
          search={{
            enabled: true
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}

export const metadata = {
  metadataBase: new URL('https://metal0.github.io/mailpilot'),
  title: {
    default: 'Mailpilot Documentation',
    template: '%s | Mailpilot Docs'
  },
  description: 'Complete documentation for Mailpilot - an AI-powered email processing daemon that uses LLMs to intelligently organize, classify, and automate your email workflow.',
  keywords: ['email', 'automation', 'AI', 'LLM', 'IMAP', 'email classification', 'email organization', 'OpenAI', 'Anthropic', 'Ollama'],
  authors: [{ name: 'Mailpilot Contributors' }],
  creator: 'metal0',
  publisher: 'Mailpilot',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://metal0.github.io/mailpilot/',
    title: 'Mailpilot Documentation',
    description: 'AI-powered email processing daemon - Intelligent email organization using LLMs',
    siteName: 'Mailpilot',
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Mailpilot - AI-Powered Email Processing'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mailpilot Documentation',
    description: 'AI-powered email processing daemon - Intelligent email organization using LLMs',
    images: ['/images/og-image.png'],
  },
  alternates: {
    canonical: 'https://metal0.github.io/mailpilot/',
  },
  category: 'technology',
};
