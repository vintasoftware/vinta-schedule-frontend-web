#!/usr/bin/env node
/**
 * refresh-graphql-schema-snapshot.mjs
 *
 * Deliberately refreshes the committed GraphQL introspection snapshot at
 * `src/lib/docs/__generated__/graphql-schema.json` by hitting a live backend.
 *
 * Why a standalone script and not a build-time write: `next build` runs in an
 * environment (Vercel) where writes into `src/` during the build don't
 * persist to the deployed artifact, and by the time a page renders, the
 * source tree is already bundled. So the snapshot is a **committed artifact,
 * refreshed deliberately** — a developer runs this against a reachable
 * backend and commits the result — while `src/lib/docs/introspect-schema.ts`
 * only *reads* the committed snapshot at build/render time (optionally
 * preferring a live fetch when the backend happens to be reachable). See the
 * Phase 2 implementation report for the full rationale.
 *
 * Usage:
 *   NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 node scripts/refresh-graphql-schema-snapshot.mjs
 *   pnpm run docs:refresh-schema-snapshot
 *
 * Unlike the build-time loader, this script fails loudly (non-zero exit) on
 * any error — a deliberate refresh should never silently no-op.
 *
 * NOTE: this query text is a hand-duplicated copy of
 * `src/lib/docs/graphql-introspection-query.ts`'s `GRAPHQL_INTROSPECTION_QUERY`
 * (this is a plain Node script and can't import TypeScript). Keep them in
 * sync if the query shape changes.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(
  __dirname,
  '..',
  'src',
  'lib',
  'docs',
  '__generated__',
  'graphql-schema.json'
);

const INTROSPECTION_QUERY = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      subscriptionType { name }
      types {
        ...FullType
      }
    }
  }

  fragment FullType on __Type {
    kind
    name
    description
    fields(includeDeprecated: true) {
      name
      description
      args {
        ...InputValue
      }
      type {
        ...TypeRef
      }
      isDeprecated
      deprecationReason
    }
    inputFields {
      ...InputValue
    }
    interfaces {
      ...TypeRef
    }
    enumValues(includeDeprecated: true) {
      name
      description
      isDeprecated
      deprecationReason
    }
    possibleTypes {
      ...TypeRef
    }
  }

  fragment InputValue on __InputValue {
    name
    description
    type { ...TypeRef }
    defaultValue
  }

  fragment TypeRef on __Type {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

async function main() {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
  const endpoint = `${baseUrl}/graphql/`;

  console.log(`Fetching GraphQL introspection from ${endpoint} ...`);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: INTROSPECTION_QUERY }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(
      `Introspection request failed: ${response.status} ${response.statusText}`
    );
  }

  const json = await response.json();

  if (json.errors) {
    throw new Error(
      `Introspection request returned errors: ${JSON.stringify(json.errors)}`
    );
  }

  if (!json.data?.__schema) {
    throw new Error('Introspection response is missing `data.__schema`.');
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(json, null, 2)}\n`, 'utf-8');

  const typeCount = json.data.__schema.types.length;
  console.log(
    `Wrote ${typeCount} types to ${OUTPUT_PATH.replace(join(__dirname, '..') + '/', '')}`
  );
}

main().catch((error) => {
  console.error('Failed to refresh the GraphQL schema snapshot:');
  console.error(error);
  process.exitCode = 1;
});
