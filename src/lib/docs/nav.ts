/**
 * Static config for the public docs sidebar (`DocsSidebar`).
 *
 * No dynamic discovery — later phases only append `children` to an existing
 * section (e.g. the generated schema-reference sub-nav in Phase 2, per-doc
 * concept sub-nav in Phase 3) or add new top-level sections. The component
 * that renders this never needs to change shape.
 */

export interface DocsNavItem {
  /** Title as rendered in the sidebar. */
  title: string;
  /** Stable identifier, unique within its section. */
  slug: string;
  /** Route the item links to. */
  href: string;
}

export interface DocsNavSection extends DocsNavItem {
  /** Nested sub-nav items. Empty until a later phase populates them. */
  children?: DocsNavItem[];
}

/**
 * The five top-level docs sections. Only `/docs` exists as a real route so
 * far (Phase 0) — the other hrefs are wired ahead of their pages landing in
 * Phases 1–5, per the plan's guiding decision to keep the nav config static
 * and reviewable rather than discovered.
 */
export const DOCS_NAV: DocsNavSection[] = [
  {
    title: 'Getting Started',
    slug: 'getting-started',
    href: '/docs/getting-started',
  },
  {
    title: 'Schema Reference',
    slug: 'reference',
    href: '/docs/reference',
  },
  {
    title: 'Concepts',
    slug: 'concepts',
    href: '/docs/concepts',
  },
  {
    title: 'Webhooks',
    slug: 'webhooks',
    href: '/docs/webhooks',
  },
  {
    title: 'Explorer',
    slug: 'explorer',
    href: '/docs/explorer',
  },
];
