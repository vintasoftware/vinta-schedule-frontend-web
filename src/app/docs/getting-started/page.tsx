import type { Metadata } from 'next';
import { DocsContainer } from '@/components/docs/docs-container';
import { DocsProse } from '@/components/docs/docs-prose';
import { renderDocMarkdownToSafeHtml } from '@/lib/docs/render-doc-markdown';
import gettingStartedContent from './content.md?raw' with {
  turbopackLoader: 'raw-loader',
  turbopackAs: '*.js',
};

export const metadata: Metadata = {
  title: 'Getting Started',
  description:
    'Mint a public API token and send your first authenticated GraphQL request.',
};

/**
 * Getting Started guide — how to mint a public-API token and make the first
 * authenticated call to the GraphQL API.
 *
 * Content is sourced from a colocated `.md` file, so it is bundled like any
 * other import rather than read from disk via `process.cwd()` at
 * request/build time. The `?raw` suffix is Vite/Vitest's native way to
 * import a file as a plain string; the `turbopackLoader`/`turbopackAs`
 * import attributes are Turbopack's equivalent (Turbopack has no built-in
 * module type for `.md`, and its `?raw` query alone does not resolve to
 * file content) — both are needed so the same import works under `next
 * build` and under Vitest. The markdown is rendered through the docs
 * pipeline (rehype-highlight + rehype-sanitize) at build time to safe HTML,
 * then injected into DocsProse.
 */
export default async function GettingStartedPage() {
  // Render to safe HTML with syntax highlighting
  const html = await renderDocMarkdownToSafeHtml(gettingStartedContent);

  return (
    <DocsContainer>
      <DocsProse html={html} />
    </DocsContainer>
  );
}
