/**
 * Loads the concept-guide docs the `/docs/concepts/*` pages render.
 *
 * Mirrors `introspect-schema.ts`'s snapshot-first shape (see that module's
 * docstring for the full rationale): a mid-build write into `src/` doesn't
 * persist on Vercel, so the snapshot at `./__generated__/concepts.json` is a
 * **committed artifact, refreshed deliberately** by a developer running
 * `pnpm run docs:refresh-concepts-snapshot`
 * (`scripts/refresh-concepts-snapshot.mjs`) against a reachable backend, and
 * this module only *reads* it. At build/render time this module attempts
 * one live fetch first, falling back to the committed snapshot (with a
 * build warning) whenever that fetch is slow, unreachable, or errors.
 *
 * The live fetch is whole-or-nothing: it fetches the manifest
 * (`GET /public-api-docs/`) and then every doc's full markdown
 * (`GET /public-api-docs/{slug}/`) in parallel. If any single doc fetch
 * fails, the entire live result is discarded in favor of the snapshot —
 * a partial result would silently drop a page from the sidebar and 404 a
 * nav link, which is worse than serving slightly-stale content for every
 * doc uniformly.
 *
 * Memoized per build process for the same reason as introspection: several
 * static pages (`generateStaticParams` plus every `/docs/concepts/<slug>`
 * page) would otherwise each attempt their own live fetch.
 */
import 'server-only';

import type { ConceptDoc, ConceptDocSummary } from '@/client';
import conceptsSnapshot from './__generated__/concepts.json';

const LIVE_FETCH_TIMEOUT_MS = 8000;

export type ConceptsSource = 'live' | 'snapshot';

export interface ConceptsResult {
  docs: ConceptDoc[];
  source: ConceptsSource;
}

function resolveBaseUrl(baseUrl?: string): string {
  return (
    baseUrl ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'
  );
}

async function fetchManifest(
  baseUrl: string
): Promise<ConceptDocSummary[] | null> {
  const endpoint = `${baseUrl}/public-api-docs/`;

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      // Deliberately no `cache: 'no-store'` — see introspect-schema.ts's
      // comment on why that throws `DYNAMIC_SERVER_USAGE` inside a
      // prerendered page and always forces the snapshot fallback.
      signal: AbortSignal.timeout(LIVE_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(
        `[docs] concept-docs manifest request to ${endpoint} failed: HTTP ${response.status} ${response.statusText}`
      );
      return null;
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (parseError) {
      console.warn(
        `[docs] concept-docs manifest response from ${endpoint} was not valid JSON:`,
        parseError
      );
      return null;
    }

    if (!Array.isArray(json)) {
      console.warn(
        `[docs] concept-docs manifest response from ${endpoint} was not an array`
      );
      return null;
    }

    return json as ConceptDocSummary[];
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.warn(
        `[docs] concept-docs manifest request to ${endpoint} timed out after ${LIVE_FETCH_TIMEOUT_MS}ms`
      );
    } else {
      console.warn(
        `[docs] concept-docs manifest request to ${endpoint} threw:`,
        error
      );
    }
    return null;
  }
}

async function fetchDoc(
  baseUrl: string,
  slug: string
): Promise<ConceptDoc | null> {
  const endpoint = `${baseUrl}/public-api-docs/${slug}/`;

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(LIVE_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(
        `[docs] concept doc request to ${endpoint} failed: HTTP ${response.status} ${response.statusText}`
      );
      return null;
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (parseError) {
      console.warn(
        `[docs] concept doc response from ${endpoint} was not valid JSON:`,
        parseError
      );
      return null;
    }

    const doc = json as Partial<ConceptDoc> | null;
    if (
      !doc ||
      typeof doc.slug !== 'string' ||
      typeof doc.title !== 'string' ||
      typeof doc.markdown !== 'string'
    ) {
      console.warn(
        `[docs] concept doc response from ${endpoint} was missing slug/title/markdown`
      );
      return null;
    }

    if (doc.slug !== slug) {
      // A backend bug could serve the wrong doc body for a requested slug.
      // Treat that as a failed fetch, same as a missing field, so it
      // triggers the whole-or-nothing snapshot fallback instead of silently
      // rendering the wrong content under this slug's route.
      console.warn(
        `[docs] concept doc response from ${endpoint} had slug "${doc.slug}", expected "${slug}"`
      );
      return null;
    }

    return doc as ConceptDoc;
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.warn(
        `[docs] concept doc request to ${endpoint} timed out after ${LIVE_FETCH_TIMEOUT_MS}ms`
      );
    } else {
      console.warn(`[docs] concept doc request to ${endpoint} threw:`, error);
    }
    return null;
  }
}

/**
 * Attempt one live fetch of the full concept-doc set (manifest + every
 * doc's markdown). Never throws — resolves `null` on any failure so the
 * caller can fall back to the snapshot.
 */
export async function fetchLiveConcepts(
  baseUrl?: string
): Promise<ConceptDoc[] | null> {
  const resolvedBaseUrl = resolveBaseUrl(baseUrl);
  const manifest = await fetchManifest(resolvedBaseUrl);

  if (!manifest) {
    return null;
  }

  if (manifest.length === 0) {
    // A genuinely empty manifest is a legitimate live response, not a
    // failure mode — don't force a fallback to a possibly-stale snapshot
    // just because the backend has zero concept docs today.
    return [];
  }

  const docs = await Promise.all(
    manifest.map((entry) => fetchDoc(resolvedBaseUrl, entry.slug))
  );

  if (docs.some((doc) => doc === null)) {
    console.warn(
      `[docs] one or more concept docs failed to fetch from ${resolvedBaseUrl} — discarding the partial live result`
    );
    return null;
  }

  return docs as ConceptDoc[];
}

/** The committed snapshot's docs, synchronously available (bundled JSON). */
export function loadSnapshotConcepts(): ConceptDoc[] {
  return conceptsSnapshot as ConceptDoc[];
}

let cachedResult: Promise<ConceptsResult> | null = null;

async function resolveConcepts(): Promise<ConceptsResult> {
  const live = await fetchLiveConcepts();

  if (live) {
    return { docs: live, source: 'live' };
  }

  console.warn(
    '[docs] concept docs were unreachable at build time — falling back to ' +
      'the committed snapshot (src/lib/docs/__generated__/concepts.json). ' +
      'Run `pnpm run docs:refresh-concepts-snapshot` against a live backend to update it.'
  );

  return { docs: loadSnapshotConcepts(), source: 'snapshot' };
}

/**
 * Get the concept docs to render, live-fetch-first with a snapshot
 * fallback. Memoized for the lifetime of the process so the manifest page
 * plus every static `/docs/concepts/<slug>` page share one fetch attempt.
 */
export function getConcepts(): Promise<ConceptsResult> {
  if (!cachedResult) {
    cachedResult = resolveConcepts();
  }
  return cachedResult;
}

/** Test-only: reset the memoized result between test cases. */
export function __resetConceptsCacheForTests(): void {
  cachedResult = null;
}
