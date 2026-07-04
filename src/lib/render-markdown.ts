/**
 * Server-only markdown → sanitized HTML renderer.
 *
 * Policy documents (`body_markdown`) are admin-authored but must never be
 * injected as raw HTML — `rehype-sanitize` strips anything not on its
 * allow-list (scripts, event handlers, `javascript:` URLs, …) before the
 * result reaches a component. Guarded by `import 'server-only'` so this
 * pipeline never ships to the client bundle.
 */
import 'server-only';

import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

/**
 * Render a markdown string to sanitized HTML.
 *
 * Never trust the output of this function's *input* — always trust its
 * *output*: `rehype-sanitize` runs before `rehype-stringify`, so anything
 * returned is safe to inject via `dangerouslySetInnerHTML`.
 */
export async function renderMarkdownToSafeHtml(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(md);

  return String(file);
}
