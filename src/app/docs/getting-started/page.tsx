import type { Metadata } from 'next';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DocsProse } from '@/components/docs/docs-prose';
import { renderDocMarkdownToSafeHtml } from '@/lib/docs/render-doc-markdown';

export const metadata: Metadata = {
  title: 'Getting Started',
  description:
    'Mint a public API token and send your first authenticated GraphQL request.',
};

/**
 * Getting Started guide — how to mint a public-API token and make the first
 * authenticated call to the GraphQL API.
 *
 * Content is sourced from a committed markdown file. The markdown is rendered
 * through the docs pipeline (rehype-highlight + rehype-sanitize) at build time
 * to safe HTML, then injected into DocsProse.
 */
export default async function GettingStartedPage() {
  // Read the markdown file at build time
  const markdownPath = join(
    process.cwd(),
    'src/lib/docs/getting-started-content.md'
  );
  const markdown = readFileSync(markdownPath, 'utf-8');

  // Render to safe HTML with syntax highlighting
  const html = await renderDocMarkdownToSafeHtml(markdown);

  return <DocsProse html={html} />;
}
