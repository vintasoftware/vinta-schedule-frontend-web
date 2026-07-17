/**
 * Server-only markdown → sanitized HTML renderer with syntax highlighting
 * and concept-link rewriting.
 *
 * Shares its parse chain and base sanitize schema with
 * `src/lib/render-markdown.ts` (via `createMarkdownProcessor` and
 * `extendSanitizeSchema`) so there is one place where sanitization is
 * configured. This pipeline adds `rehype-highlight` for fenced code blocks
 * (extending the schema to allow the specific `className` values that
 * plugin produces) and `rehypeRewriteConceptLinks` to rewrite/neutralize
 * backend-relative links in concept-doc markdown (see `rewrite-links.ts`).
 *
 * Ordering: link rewriting and highlighting both run before sanitize, so
 * sanitize sees (and can filter) whatever they produced, then strips
 * anything else that isn't on the schema (scripts, event handlers,
 * `javascript:` URLs, …). Callers that don't pass `conceptSlugs` get an
 * empty slug set, so the link-rewrite pass is a no-op for non-concept
 * content (e.g. the getting-started guide, whose links are already
 * site-relative and get left alone regardless).
 */
import 'server-only';

import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize, { type Options } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import {
  createMarkdownProcessor,
  extendSanitizeSchema,
} from '@/lib/render-markdown';
import { rehypeRewriteConceptLinks } from './rewrite-links';

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

export interface RenderDocMarkdownOptions {
  /**
   * Slugs of concept docs that exist, used by the link-rewrite pass to tell
   * an in-docs cross-link (`calendar-bundles.md` → `/docs/concepts/calendar-bundles`)
   * apart from a backend-relative link that has no frontend equivalent
   * (`../../calendar_integration/models.py`, `../glossary.md`), which gets
   * neutralized instead. Omit for non-concept content — the pass is then a
   * no-op for any link that isn't already a same-page anchor, an external
   * URL, or a site-relative path.
   */
  conceptSlugs?: readonly string[];
}

/**
 * Render a markdown string to sanitized HTML with syntax highlighting and
 * concept-link rewriting.
 *
 * Output is safe to inject via `dangerouslySetInnerHTML`: `rehype-sanitize`
 * runs after the link-rewrite and highlight passes and before
 * `rehype-stringify`, so anything returned has already had disallowed
 * markup and attributes removed.
 */
export async function renderDocMarkdownToSafeHtml(
  md: string,
  options: RenderDocMarkdownOptions = {}
): Promise<string> {
  const file = await createMarkdownProcessor()
    .use(rehypeRewriteConceptLinks, {
      conceptSlugs: options.conceptSlugs ?? [],
    })
    .use(rehypeHighlight)
    .use(rehypeSanitize, docsSanitizeSchema)
    .use(rehypeStringify)
    .process(md);

  return String(file);
}
