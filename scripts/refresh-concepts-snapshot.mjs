#!/usr/bin/env node
/**
 * refresh-concepts-snapshot.mjs
 *
 * Deliberately refreshes the committed concept-docs snapshots:
 *   - `src/lib/docs/__generated__/concepts.json` — full docs
 *     (`{ slug, title, markdown }`), the fallback `fetch-concepts.ts` reads.
 *   - `src/lib/docs/__generated__/concepts-manifest.json` — `{ slug, title }`
 *     only, imported by `src/lib/docs/nav.ts` to generate the sidebar's
 *     "Concepts" sub-nav without pulling every doc's full markdown into the
 *     client bundle (`nav.ts` is imported by the client-side `DocsSidebar`).
 *
 * Why a standalone script and not a build-time write: same rationale as
 * `refresh-graphql-schema-snapshot.mjs` — `next build` on Vercel doesn't
 * persist a mid-build write into `src/` to the deployed artifact. So both
 * snapshots are **committed artifacts, refreshed deliberately** — a
 * developer runs this against a reachable backend and commits the result —
 * while `src/lib/docs/fetch-concepts.ts` only *reads* the committed
 * `concepts.json` at build/render time (optionally preferring a live fetch
 * when the backend happens to be reachable).
 *
 * Usage:
 *   NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 node scripts/refresh-concepts-snapshot.mjs
 *   pnpm run docs:refresh-concepts-snapshot
 *
 * Unlike the build-time loader, this script fails loudly (non-zero exit) on
 * any error — a deliberate refresh should never silently no-op.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = join(
  __dirname,
  '..',
  'src',
  'lib',
  'docs',
  '__generated__'
);
const CONCEPTS_PATH = join(GENERATED_DIR, 'concepts.json');
const MANIFEST_PATH = join(GENERATED_DIR, 'concepts-manifest.json');

function relativeToRoot(path) {
  return path.replace(join(__dirname, '..') + '/', '');
}

async function fetchJson(endpoint) {
  const response = await fetch(endpoint, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(
      `Request to ${endpoint} failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

async function main() {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
  const manifestEndpoint = `${baseUrl}/public-api-docs/`;

  console.log(`Fetching concept-doc manifest from ${manifestEndpoint} ...`);
  const manifest = await fetchJson(manifestEndpoint);

  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error('Manifest response was empty or not an array.');
  }

  console.log(`Fetching ${manifest.length} concept doc(s) ...`);
  const docs = await Promise.all(
    manifest.map(async (entry) => {
      const endpoint = `${baseUrl}/public-api-docs/${entry.slug}/`;
      const doc = await fetchJson(endpoint);

      if (
        typeof doc.slug !== 'string' ||
        typeof doc.title !== 'string' ||
        typeof doc.markdown !== 'string'
      ) {
        throw new Error(
          `Doc response for "${entry.slug}" was missing slug/title/markdown.`
        );
      }

      return doc;
    })
  );

  await mkdir(GENERATED_DIR, { recursive: true });
  await writeFile(CONCEPTS_PATH, `${JSON.stringify(docs, null, 2)}\n`, 'utf-8');

  const manifestOnly = docs.map(({ slug, title }) => ({ slug, title }));
  await writeFile(
    MANIFEST_PATH,
    `${JSON.stringify(manifestOnly, null, 2)}\n`,
    'utf-8'
  );

  console.log(
    `Wrote ${docs.length} concept doc(s) to ${relativeToRoot(CONCEPTS_PATH)} ` +
      `and the manifest to ${relativeToRoot(MANIFEST_PATH)}`
  );
}

main().catch((error) => {
  console.error('Failed to refresh the concept docs snapshot:');
  console.error(error);
  process.exitCode = 1;
});
