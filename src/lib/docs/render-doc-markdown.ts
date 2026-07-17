/**
 * Server-only markdown → sanitized HTML renderer with syntax highlighting.
 *
 * Shares its parse chain and base sanitize schema with
 * `src/lib/render-markdown.ts` (via `createMarkdownProcessor` and
 * `extendSanitizeSchema`) so there is one place where sanitization is
 * configured. This pipeline only adds `rehype-highlight` for fenced code
 * blocks and extends the schema to allow the specific `className` values
 * that plugin produces.
 *
 * Ordering: highlight runs before sanitize, so sanitize sees (and can
 * filter) the classes highlight added, then strips anything else that
 * isn't on the schema (scripts, event handlers, `javascript:` URLs, …).
 */
import 'server-only';

import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize, { type Options } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import {
  createMarkdownProcessor,
  extendSanitizeSchema,
} from '@/lib/render-markdown';

/**
 * The default schema plus `className` on `code` and `span`, scoped to the
 * exact patterns `rehype-highlight` emits: `hljs`/`language-*` on `<code>`
 * and `hljs-*` on the token `<span>`s inside it. Every other tag keeps the
 * default schema's rules — this does not touch the wildcard (`*`) entry,
 * so no other element gains a new allowed attribute.
 */
export const docsSanitizeSchema: Options = extendSanitizeSchema({
  code: [['className', /^(language-|hljs)/]],
  span: [['className', /^hljs-/]],
});

/**
 * Render a markdown string to sanitized HTML with syntax highlighting.
 *
 * Output is safe to inject via `dangerouslySetInnerHTML`: `rehype-sanitize`
 * runs after `rehype-highlight` and before `rehype-stringify`, so anything
 * returned has already had disallowed markup and attributes removed.
 */
export async function renderDocMarkdownToSafeHtml(md: string): Promise<string> {
  const file = await createMarkdownProcessor()
    .use(rehypeHighlight)
    .use(rehypeSanitize, docsSanitizeSchema)
    .use(rehypeStringify)
    .process(md);

  return String(file);
}
