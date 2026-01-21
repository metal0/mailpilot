import { DocsLayout } from 'fumadocs-ui/layout';
import type { ReactNode } from 'react';
import { baseOptions } from '@/lib/source';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={baseOptions.pageTree}
      nav={{
        title: 'Mailpilot',
        url: '/',
      }}
      links={[
        {
          text: 'GitHub',
          url: 'https://github.com/metal0/mailpilot',
          active: 'nested-url',
        },
      ]}
    >
      {children}
    </DocsLayout>
  );
}
