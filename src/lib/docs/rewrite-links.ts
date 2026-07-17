/**
 * Rehype plugin that rewrites links inside backend-authored concept markdown.
 *
 * The concept docs live in the backend repo (`docs/concepts/*.md`) and link
 * to each other with backend-relative markdown paths (e.g.
 * `calendar-bundles.md`, `./events.md`, `recurrence.md#bulk-modifications`)
 * and to backend source files (e.g.
 * `../../calendar_integration/models.py`). Neither shape resolves in this
 * frontend: the former needs to become a `/docs/concepts/<slug>` route, the
 * latter has no frontend equivalent and would 404 if left as-is.
 *
 * Classification rule (see `classifyConceptLink`):
 * - Same-page anchors (`#section`), absolute URLs with a protocol
 *   (`https://…`, `mailto:…`), and already site-relative paths (`/docs/…`)
 *   are left untouched.
 * - A relative link whose path ends in `.md`/`.mdx` AND whose basename
 *   (extension stripped) is a known concept slug is rewritten to
 *   `/docs/concepts/<slug>`, preserving any `#anchor`. A `.md` link whose
 *   basename is *not* a known slug (e.g. `../glossary.md`, an ai-plans doc)
 *   is NOT assumed to be an in-docs route — it would 404 — so it falls
 *   through to neutralization just like a source-file link.
 * - Everything else relative (backend source files, unported docs) is
 *   neutralized: the element is turned from `<a>` into a plain `<span>`
 *   with its `href`/`target`/`rel` dropped, keeping the link text as
 *   ordinary prose instead of a dead link.
 *
 * This repo doesn't depend on `hast`'s own type package (not a direct
 * dependency — see `render-doc-markdown.test.ts` for the same ad hoc typing
 * convention), so the tree shape below is a minimal structural type covering
 * only what this plugin reads/writes.
 */

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  [key: string]: unknown;
}

export interface RewriteConceptLinksOptions {
  /** Slugs of concept docs that exist — cross-links to these become in-docs routes. */
  conceptSlugs: readonly string[];
}

export type ConceptLinkAction =
  | { type: 'leave' }
  | { type: 'rewrite'; href: string }
  | { type: 'neutralize' };

const ABSOLUTE_PROTOCOL_RE = /^[a-z][a-z0-9+.-]*:/i;
const MARKDOWN_LINK_RE = /([^/]+)\.mdx?$/i;

/**
 * Classify a single href from concept-doc markdown. Pure function, exported
 * for direct unit testing independent of the plugin/tree machinery.
 */
export function classifyConceptLink(
  href: string,
  conceptSlugs: ReadonlySet<string>
): ConceptLinkAction {
  if (!href || href.startsWith('#')) {
    // Empty or a same-page anchor — nothing to rewrite.
    return { type: 'leave' };
  }

  if (ABSOLUTE_PROTOCOL_RE.test(href)) {
    // http(s):, mailto:, tel:, etc. — external, leave as-is.
    return { type: 'leave' };
  }

  if (href.startsWith('/')) {
    // Already a site-root-relative path (a real frontend route).
    return { type: 'leave' };
  }

  const hashIndex = href.indexOf('#');
  const path = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : href.slice(hashIndex);

  const match = MARKDOWN_LINK_RE.exec(path);
  if (match) {
    const slug = match[1];
    if (conceptSlugs.has(slug)) {
      return { type: 'rewrite', href: `/docs/concepts/${slug}${hash}` };
    }
  }

  // Backend source files (`../../calendar_integration/models.py`) and
  // unported repo docs (`../glossary.md`, an ai-plans link) both 404 in the
  // frontend — neutralize either shape.
  return { type: 'neutralize' };
}

function visitAnchors(node: HastNode, callback: (element: HastNode) => void) {
  if (node.type === 'element' && node.tagName === 'a') {
    callback(node);
  }
  for (const child of node.children ?? []) {
    visitAnchors(child, callback);
  }
}

/**
 * Unified/rehype plugin: rewrites or neutralizes concept-doc links in place.
 * Must run before `rehype-sanitize` so the sanitizer sees (and can still
 * filter) the resulting `href`/tag — this plugin does not itself decide
 * what's ultimately safe to keep, sanitize still owns that.
 */
export function rehypeRewriteConceptLinks(options: RewriteConceptLinksOptions) {
  const conceptSlugs = new Set(options.conceptSlugs);

  return (tree: HastNode) => {
    visitAnchors(tree, (element) => {
      const href = element.properties?.href;
      if (typeof href !== 'string') {
        return;
      }

      const action = classifyConceptLink(href, conceptSlugs);

      if (action.type === 'rewrite') {
        element.properties = { ...element.properties, href: action.href };
        return;
      }

      if (action.type === 'neutralize') {
        element.tagName = 'span';
        if (element.properties) {
          delete element.properties.href;
          delete element.properties.target;
          delete element.properties.rel;
        }
      }
    });
  };
}
