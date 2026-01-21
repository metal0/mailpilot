import './global.css';
import { RootProvider } from 'fumadocs-ui/provider';
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
  title: 'Mailpilot Documentation',
  description: 'AI-powered email processing daemon documentation'
};
