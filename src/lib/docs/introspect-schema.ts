/**
 * Loads the GraphQL introspection schema the reference pages render.
 *
 * Snapshot-first, not build-writes-a-file: `next build` on Vercel runs in an
 * environment where a write into `src/` mid-build doesn't persist to the
 * deployed artifact (the page is already bundled by the time it would run,
 * and the filesystem isn't durable across the build/deploy boundary anyway).
 * A "the build writes the snapshot" design would silently no-op in
 * production and only ever appear to work locally.
 *
 * So the snapshot at `./__generated__/graphql-schema.json` is a **committed
 * artifact, refreshed deliberately** by a developer running
 * `pnpm run docs:refresh-schema-snapshot` (`scripts/refresh-graphql-schema-snapshot.mjs`)
 * against a reachable backend, and this module only *reads* it. What this
 * module *does* do at build/render time is attempt one live fetch first —
 * honoring the "always current when possible" half of the guiding decision —
 * and fall back to the committed snapshot (with a build warning) whenever
 * that fetch is slow, unreachable, or errors. That fallback is the path that
 * actually runs today: the backend isn't deployed, so every production build
 * takes it.
 *
 * The live fetch is memoized per build process: `generateStaticParams` plus
 * every type-detail page would otherwise each attempt (and each wait out the
 * timeout on) their own live fetch, which — multiplied by ~140 static pages —
 * would make an unreachable backend stall the build for many minutes instead
 * of one bounded timeout. Note the memoization is per-*process*, not global:
 * Next's static generation fans out across several build workers, so a
 * reachable-but-slow backend can still see up to `workerCount` concurrent
 * introspection requests. Each worker still only ever attempts one.
 */
import 'server-only';

import type { IntrospectionSchema } from './graphql-introspection-query';
import { GRAPHQL_INTROSPECTION_QUERY } from './graphql-introspection-query';
import schemaSnapshot from './__generated__/graphql-schema.json';

const LIVE_FETCH_TIMEOUT_MS = 8000;

export type IntrospectionSource = 'live' | 'snapshot';

export interface SchemaIntrospectionResult {
  schema: IntrospectionSchema;
  source: IntrospectionSource;
}

/**
 * Attempt one live introspection request against
 * `NEXT_PUBLIC_API_BASE_URL/graphql/`. Never throws — any failure (network
 * error, timeout, non-2xx, GraphQL errors, malformed body) resolves `null`
 * so the caller can fall back to the snapshot.
 */
export async function fetchLiveIntrospection(
  baseUrl: string = process.env.NEXT_PUBLIC_API_BASE_URL ??
    'http://localhost:8000'
): Promise<IntrospectionSchema | null> {
  const endpoint = `${baseUrl}/graphql/`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query: GRAPHQL_INTROSPECTION_QUERY }),
      // Bounded so an unreachable/hanging backend can't stall the build —
      // it must fail fast onto the snapshot fallback. Deliberately no
      // `cache: 'no-store'`: these reference pages are statically generated
      // (`generateStaticParams`), and an opt-out-of-caching fetch inside a
      // page Next is trying to render statically throws `DYNAMIC_SERVER_USAGE`
      // — which this function would otherwise swallow as a false "live fetch
      // failed" and always fall back to the snapshot, live backend or not.
      // The default (cacheable) fetch is exactly what a build-time-only,
      // fetch-once value wants anyway.
      signal: AbortSignal.timeout(LIVE_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as {
      data?: { __schema?: IntrospectionSchema };
      errors?: unknown;
    };

    if (json.errors || !json.data?.__schema) {
      return null;
    }

    return json.data.__schema;
  } catch {
    return null;
  }
}

/** The committed snapshot's schema, synchronously available (bundled JSON). */
export function loadSnapshotIntrospection(): IntrospectionSchema {
  return schemaSnapshot.data.__schema as IntrospectionSchema;
}

let cachedResult: Promise<SchemaIntrospectionResult> | null = null;

async function resolveSchemaIntrospection(): Promise<SchemaIntrospectionResult> {
  const live = await fetchLiveIntrospection();

  if (live) {
    return { schema: live, source: 'live' };
  }

  // Deliberate build-time warning, per the plan's resiliency contract.
  console.warn(
    '[docs] GraphQL introspection was unreachable at build time — falling back to ' +
      'the committed snapshot (src/lib/docs/__generated__/graphql-schema.json). ' +
      'Run `pnpm run docs:refresh-schema-snapshot` against a live backend to update it.'
  );

  return { schema: loadSnapshotIntrospection(), source: 'snapshot' };
}

/**
 * Get the schema introspection to render, live-fetch-first with a
 * snapshot fallback. Memoized for the lifetime of the process so the many
 * static docs/reference pages share one fetch attempt instead of one each.
 */
export function getSchemaIntrospection(): Promise<SchemaIntrospectionResult> {
  if (!cachedResult) {
    cachedResult = resolveSchemaIntrospection();
  }
  return cachedResult;
}

/** Test-only: reset the memoized result between test cases. */
export function __resetSchemaIntrospectionCacheForTests(): void {
  cachedResult = null;
}
