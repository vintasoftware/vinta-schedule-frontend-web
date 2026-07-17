/**
 * Server-only markdown → sanitized HTML renderer.
 *
 * Policy documents (`body_markdown`) are admin-authored but must never be
 * injected as raw HTML — `rehype-sanitize` strips anything not on its
 * allow-list (scripts, event handlers, `javascript:` URLs, …) before the
 * result reaches a component. Guarded by `import 'server-only'` so this
 * pipeline never ships to the client bundle.
 *
 * `createMarkdownProcessor` and `extendSanitizeSchema` are also exported so
 * other markdown renderers (e.g. `render-doc-markdown.ts`) share this same
 * parse chain and start from this same sanitize schema, instead of
 * re-declaring their own copy that could drift out of sync.
 */
import 'server-only';

import rehypeSanitize, { defaultSchema, type Options } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

/**
 * The parse → gfm → rehype chain shared by every markdown renderer in this
 * repo. Callers add their own rehype plugins (if any), a sanitize schema,
 * `rehypeStringify`, then call `.process()`.
 */
export function createMarkdownProcessor() {
  return unified().use(remarkParse).use(remarkGfm).use(remarkRehype);
}

/**
 * Add extra per-tag attribute rules on top of `defaultSchema`'s existing
 * `attributes`, without touching any entries already there.
 *
 * `defaultSchema.attributes.code` is `[['className', /^language-./]]` — a
 * RegExp-scoped rule. Round-tripping the schema through
 * `JSON.parse(JSON.stringify(...))` silently turns that RegExp into `{}`,
 * which then matches nothing. Spreading `defaultSchema.attributes` instead
 * keeps every existing entry (RegExp instances included) intact, and only
 * `extraAttributes`'s keys are added or replaced.
 */
export function extendSanitizeSchema(
  extraAttributes: NonNullable<Options['attributes']>
): Options {
  return {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      ...extraAttributes,
    },
  };
}

/**
 * Render a markdown string to sanitized HTML.
 *
 * Never trust the output of this function's *input* — always trust its
 * *output*: `rehype-sanitize` runs before `rehype-stringify`, so anything
 * returned is safe to inject via `dangerouslySetInnerHTML`.
 */
export async function renderMarkdownToSafeHtml(md: string): Promise<string> {
  const file = await createMarkdownProcessor()
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(md);

  return String(file);
}
