import { loader } from 'fumadocs-core/source';
import { createMDXSource } from 'fumadocs-mdx';
import { docs, meta } from '@/.source';
import type { ReactElement } from 'react';
import type { TableOfContents } from 'fumadocs-core/server';

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
