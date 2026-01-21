import { loader } from 'fumadocs-core/source';
import { createMDXSource, type InferPageType, type InferMetaType } from 'fumadocs-mdx';
import { docs, meta } from '@/.source';

const mdxSource = createMDXSource(docs, meta);

export const source = loader({
  baseUrl: '/docs',
  source: {
    files: mdxSource.files(),
  },
});

export type Page = InferPageType<typeof mdxSource>;
export type Meta = InferMetaType<typeof mdxSource>;

export const { getPage, getPages, pageTree } = source;

export const baseOptions = {
  pageTree,
};
