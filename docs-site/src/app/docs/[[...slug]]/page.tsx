import { getPage, getPages, type Page as PageType } from '@/lib/source';
import type { Metadata } from 'next';
import { DocsPage, DocsBody } from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { SetupWizard } from '@/components/SetupWizard';
import { ConfigSandbox } from '@/components/ConfigSandbox';
import { MatrixChatWidget } from '@/components/MatrixChatWidget';

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = getPage(params.slug);

  if (!page) notFound();

  const data = page.data as PageType;
  const MDX = data.body;

  return (
    <DocsPage toc={data.toc} full={data.full}>
      <DocsBody>
        <MDX components={{ ...defaultMdxComponents, SetupWizard, ConfigSandbox, MatrixChatWidget }} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return getPages().map((page) => ({
    slug: page.slugs,
  }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = getPage(params.slug);

  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
