import { loader } from 'fumadocs-core/source';
import { createMDXSource } from 'fumadocs-mdx';
import { docs, meta } from '@/.source';
import type { ReactElement } from 'react';
import type { TableOfContents } from 'fumadocs-core/server';
import { createElement } from 'react';
import {
  Rocket,
  Mail,
  Brain,
  Settings,
  Sparkles,
  BookOpen,
  Code2,
  Wrench,
  HelpCircle,
  History,
  Map,
} from 'lucide-react';

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  Rocket,
  Mail,
  Brain,
  Settings,
  Sparkles,
  BookOpen,
  Code2,
  Wrench,
  HelpCircle,
  History,
  Map,
};

const mdxSource = createMDXSource(docs, meta);

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
const filesSource = mdxSource.files as any;
// Call if function, use directly if array
const files = typeof filesSource === 'function' ? filesSource() : filesSource;

export const source = loader({
  baseUrl: '/docs',
  source: {
    files,
  },
  icon(icon) {
    if (!icon) return undefined;
    if (icon in icons) {
      return createElement(icons[icon], { className: 'size-4' });
    }
    return undefined;
  },
});
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */

export interface PageData {
  title: string;
  description?: string;
  body: (props: Record<string, unknown>) => ReactElement;
  toc: TableOfContents;
  full?: boolean;
}

export const { getPage, getPages, pageTree } = source;

export const baseOptions = {
  pageTree,
};
