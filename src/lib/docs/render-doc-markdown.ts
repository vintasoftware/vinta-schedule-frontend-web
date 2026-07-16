/**
 * Server-only markdown → sanitized HTML renderer with syntax highlighting.
 *
 * Extends `src/lib/render-markdown.ts` with `rehype-highlight` for fenced code blocks.
 * The pipeline keeps `rehype-sanitize` to strip untrusted markup (backend-authored
 * concept docs are semi-trusted but still sanitized). Sanitization is configured
 * to permit `className` attributes on code blocks so highlighting is preserved.
 *
 * Ordering: highlight runs before sanitize, then sanitize allows the classes.
 * This ensures both highlighting works AND `javascript:` URLs are still stripped.
 */
import 'server-only';

import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize, { defaultSchema, type Options } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

/**
 * Extend the default sanitize schema to permit `className` on code/pre/span.
 * This allows rehype-highlight to style code blocks while still sanitizing
 * dangerous markup (scripts, event handlers, javascript: URLs, etc.).
 */
function createSanitizeSchemaWithHighlight(): Options {
  // Deep copy the default schema to avoid mutating it
  const schema = JSON.parse(JSON.stringify(defaultSchema)) as Options;

  // Permit className on span, code, pre elements so rehype-highlight's markup survives
  if (schema.attributes && typeof schema.attributes === 'object') {
    const attrs = schema.attributes as Record<
      string,
      string[] | Record<string, boolean>
    >;
    let universalAttrs = attrs['*'];
    if (!universalAttrs) {
      universalAttrs = attrs['*'] = [];
    }
    if (Array.isArray(universalAttrs)) {
      if (!universalAttrs.includes('className')) {
        universalAttrs.push('className');
      }
      // Also ensure class is allowed (CSS class attribute)
      if (!universalAttrs.includes('class')) {
        universalAttrs.push('class');
      }
    }
  }

  return schema;
}

/**
 * Render a markdown string to sanitized HTML with syntax highlighting.
 *
 * Output is safe to inject via `dangerouslySetInnerHTML` because:
 * 1. rehype-highlight adds className attributes to <span> elements in code blocks
 * 2. The extended sanitize schema allows className
 * 3. rehype-sanitize still strips scripts, event handlers, and javascript: URLs
 * 4. rehypeStringify converts the sanitized tree to HTML
 *
 * The ordering matters: highlight runs first (adds classes), sanitize runs second
 * (allows the classes and removes dangerous content), stringify converts to string.
 */
export async function renderDocMarkdownToSafeHtml(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeHighlight)
    .use(rehypeSanitize, createSanitizeSchemaWithHighlight())
    .use(rehypeStringify)
    .process(md);

  return String(file);
}
