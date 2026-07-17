#!/usr/bin/env node
/**
 * refresh-webhook-events-snapshot.mjs
 *
 * Deliberately refreshes the committed webhook-events snapshot:
 *   - `src/lib/docs/__generated__/webhook-events.json` — the webhook event
 *     catalog (`[{ value, label, description }, ...]`), the fallback
 *     `fetch-webhook-events.ts` reads.
 *
 * Why a standalone script and not a build-time write: same rationale as
 * `refresh-graphql-schema-snapshot.mjs` — `next build` on Vercel doesn't
 * persist a mid-build write into `src/` to the deployed artifact. So the
 * snapshot is a **committed artifact, refreshed deliberately** — a developer
 * runs this against a reachable backend and commits the result — while
 * `src/lib/docs/fetch-webhook-events.ts` only *reads* the committed JSON
 * at build/render time (optionally preferring a live fetch when the backend
 * happens to be reachable).
 *
 * Usage:
 *   NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 node scripts/refresh-webhook-events-snapshot.mjs
 *   pnpm run docs:refresh-webhook-events-snapshot
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
const WEBHOOK_EVENTS_PATH = join(GENERATED_DIR, 'webhook-events.json');

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
  const endpoint = `${baseUrl}/public-api-docs/webhook-events/`;

  console.log(`Fetching webhook events from ${endpoint} ...`);
  const events = await fetchJson(endpoint);

  if (!Array.isArray(events) || events.length === 0) {
    throw new Error('Webhook events response was empty or not an array.');
  }

  // Validate each event has the required shape
  for (const event of events) {
    if (
      typeof event.value !== 'string' ||
      typeof event.label !== 'string' ||
      typeof event.description !== 'string'
    ) {
      throw new Error(
        `Webhook event response was missing value/label/description fields.`
      );
    }
  }

  await mkdir(GENERATED_DIR, { recursive: true });
  await writeFile(
    WEBHOOK_EVENTS_PATH,
    `${JSON.stringify(events, null, 2)}\n`,
    'utf-8'
  );

  console.log(
    `Wrote ${events.length} webhook event(s) to ${relativeToRoot(WEBHOOK_EVENTS_PATH)}`
  );
}

main().catch((error) => {
  console.error('Failed to refresh the webhook events snapshot:');
  console.error(error);
  process.exitCode = 1;
});
