/**
 * Static config for the public docs sidebar (`DocsSidebar`).
 *
 * No dynamic discovery — later phases only append `children` to an existing
 * section (e.g. the generated schema-reference sub-nav in Phase 2, per-doc
 * concept sub-nav in Phase 3) or add new top-level sections. The component
 * that renders this never needs to change shape.
 */
import conceptsManifest from './__generated__/concepts-manifest.json';

export interface DocsNavItem {
  /** Title as rendered in the sidebar. */
  title: string;
  /** Stable identifier, unique within its section. */
  slug: string;
  /** Route the item links to. */
  href: string;
}

export interface DocsNavSection extends DocsNavItem {
  /** One-line description for top-level section, rendered on the landing page. */
  description: string;
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
    description:
      'Mint a public API token and send your first authenticated GraphQL request.',
  },
  {
    title: 'Schema Reference',
    slug: 'reference',
    href: '/docs/reference',
    description:
      'Every query, mutation, and type in the public GraphQL schema.',
    // Generated section is grouped by kind, not enumerated per query/mutation/
    // type — the live schema has 82 operations and 140+ types, so a flat
    // per-item sub-nav would make the sidebar unusable. Each entry anchors
    // into the corresponding section of the index page; "Types" links to the
    // types table, from which every individual type page is reachable.
    children: [
      { title: 'Queries', slug: 'queries', href: '/docs/reference#queries' },
      {
        title: 'Mutations',
        slug: 'mutations',
        href: '/docs/reference#mutations',
      },
      { title: 'Types', slug: 'types', href: '/docs/reference#types' },
    ],
  },
  {
    title: 'Concepts',
    slug: 'concepts',
    href: '/docs/concepts',
    description:
      'How Calendar Groups, Events, Availability, and Bundles fit together.',
    // Generated from the committed concept-docs manifest snapshot (`{ slug,
    // title }` only — no markdown), refreshed by
    // `pnpm run docs:refresh-concepts-snapshot`. Deliberately not the full
    // `concepts.json` (which carries every doc's full markdown): this
    // module is imported by the client-side `DocsSidebar`, so keeping the
    // manifest markdown-free keeps that content out of the client bundle.
    children: conceptsManifest.map((doc) => ({
      title: doc.title,
      slug: doc.slug,
      href: `/docs/concepts/${doc.slug}`,
    })),
  },
  {
    title: 'Webhooks',
    slug: 'webhooks',
    href: '/docs/webhooks',
    description:
      'The outbound event catalog and the webhook configuration types.',
  },
  {
    title: 'Explorer',
    slug: 'explorer',
    href: '/docs/explorer',
    description: 'A live GraphiQL console to try requests against /graphql/.',
  },
];
