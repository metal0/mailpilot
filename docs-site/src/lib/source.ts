import { loader } from 'fumadocs-core/source';
import { createMDXSource } from 'fumadocs-mdx';
import { docs, meta } from '@/.source';
import type { ReactElement } from 'react';
import type { TableOfContents } from 'fumadocs-core/server';

const mdxSource = createMDXSource(docs, meta);

export const source = loader({
  baseUrl: '/docs',
  source: {
    files: mdxSource.files(),
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
