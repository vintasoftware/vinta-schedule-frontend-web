import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DocsProse } from '@/components/docs/docs-prose';
import { getConcepts } from '@/lib/docs/fetch-concepts';
import { renderDocMarkdownToSafeHtml } from '@/lib/docs/render-doc-markdown';

/**
 * Loads the concept docs once per render — cheap even across
 * `generateStaticParams`, `generateMetadata`, and the page itself, because
 * `getConcepts` memoizes the underlying fetch/snapshot-read for the
 * lifetime of the build process.
 */
async function loadDocs() {
  const { docs } = await getConcepts();
  return docs;
}

/**
 * Statically generates one page per concept doc in the manifest. An empty
 * manifest (total live+snapshot failure — shouldn't happen since a snapshot
 * is always committed) simply yields zero pages rather than crashing the
 * build.
 */
export async function generateStaticParams() {
  const docs = await loadDocs();
  return docs.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const docs = await loadDocs();
  const doc = docs.find((d) => d.slug === slug);

  // Title comes from the manifest, not re-derived from the markdown body.
  return { title: doc?.title ?? 'Concept guide' };
}

export default async function ConceptDocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const docs = await loadDocs();
  const doc = docs.find((d) => d.slug === slug);

  if (!doc) {
    notFound();
  }

  const conceptSlugs = docs.map((d) => d.slug);
  const html = await renderDocMarkdownToSafeHtml(doc.markdown, {
    conceptSlugs,
  });

  return <DocsProse html={html} />;
}
