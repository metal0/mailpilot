import { loader } from 'fumadocs-core/source';
import { createMDXSource } from 'fumadocs-mdx';
import { docs, meta } from '@/.source';
import type { ReactElement } from 'react';
import type { TableOfContents } from 'fumadocs-core/server';

const mdxSource = createMDXSource(docs, meta);

// Handle both function and array API for compatibility
const files = typeof mdxSource.files === 'function' ? mdxSource.files() : mdxSource.files;

export const source = loader({
  baseUrl: '/docs',
  source: {
    files,
  },
});

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
