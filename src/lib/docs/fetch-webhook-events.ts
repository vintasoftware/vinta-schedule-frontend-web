/**
 * Loads the webhook event catalog that `/docs/webhooks` renders.
 *
 * Mirrors `fetch-concepts.ts`'s snapshot-first shape (see that module's
 * docstring for the full rationale): the snapshot at `./__generated__/webhook-events.json`
 * is a **committed artifact, refreshed deliberately** by a developer running
 * `pnpm run docs:refresh-webhook-events-snapshot`
 * (`scripts/refresh-webhook-events-snapshot.mjs`) against a reachable backend, and
 * this module only *reads* it. At build/render time this module attempts
 * one live fetch first, falling back to the committed snapshot (with a
 * build warning) whenever that fetch is slow, unreachable, or errors.
 *
 * Unlike concept docs (which have a whole-or-nothing fetch of manifest + content),
 * webhook events are a single, flat list with no per-item fetch step.
 * If the fetch fails, we fall back to the snapshot.
 *
 * Memoized per build process: the static page calls this once during render.
 */
import 'server-only';

import webhookEventsSnapshot from './__generated__/webhook-events.json';

export interface WebhookEventDoc {
  value: string;
  label: string;
  description: string;
}

export type WebhookEventsSource = 'live' | 'snapshot';

export interface WebhookEventsResult {
  events: WebhookEventDoc[];
  source: WebhookEventsSource;
}

const LIVE_FETCH_TIMEOUT_MS = 8000;

function resolveBaseUrl(baseUrl?: string): string {
  return (
    baseUrl ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'
  );
}

/**
 * Attempt one live fetch of the webhook events list. Never throws — resolves
 * `null` on any failure so the caller can fall back to the snapshot.
 */
export async function fetchLiveWebhookEvents(
  baseUrl?: string
): Promise<WebhookEventDoc[] | null> {
  const resolvedBaseUrl = resolveBaseUrl(baseUrl);
  const endpoint = `${resolvedBaseUrl}/public-api-docs/webhook-events/`;

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
        `[docs] webhook-events request to ${endpoint} failed: HTTP ${response.status} ${response.statusText}`
      );
      return null;
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (parseError) {
      console.warn(
        `[docs] webhook-events response from ${endpoint} was not valid JSON:`,
        parseError
      );
      return null;
    }

    if (!Array.isArray(json)) {
      console.warn(
        `[docs] webhook-events response from ${endpoint} was not an array`
      );
      return null;
    }

    // Validate that each item has the expected shape
    if (
      !json.every(
        (item): item is WebhookEventDoc =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as Record<string, unknown>).value === 'string' &&
          typeof (item as Record<string, unknown>).label === 'string' &&
          typeof (item as Record<string, unknown>).description === 'string'
      )
    ) {
      console.warn(
        `[docs] webhook-events response from ${endpoint} did not contain all required fields (value, label, description)`
      );
      return null;
    }

    return json as WebhookEventDoc[];
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.warn(
        `[docs] webhook-events request to ${endpoint} timed out after ${LIVE_FETCH_TIMEOUT_MS}ms`
      );
    } else {
      console.warn(
        `[docs] webhook-events request to ${endpoint} threw:`,
        error
      );
    }
    return null;
  }
}

/** The committed snapshot's events, synchronously available (bundled JSON). */
export function loadSnapshotWebhookEvents(): WebhookEventDoc[] {
  return webhookEventsSnapshot as WebhookEventDoc[];
}

let cachedResult: Promise<WebhookEventsResult> | null = null;

async function resolveWebhookEvents(): Promise<WebhookEventsResult> {
  const live = await fetchLiveWebhookEvents();

  if (live) {
    return { events: live, source: 'live' };
  }

  console.warn(
    '[docs] webhook events were unreachable at build time — falling back to ' +
      'the committed snapshot (src/lib/docs/__generated__/webhook-events.json). ' +
      'Run `pnpm run docs:refresh-webhook-events-snapshot` against a live backend to update it.'
  );

  return {
    events: loadSnapshotWebhookEvents(),
    source: 'snapshot',
  };
}

/**
 * Get the webhook events to render, live-fetch-first with a snapshot
 * fallback. Memoized for the lifetime of the process so any repeated
 * renders share one fetch attempt.
 */
export function getWebhookEvents(): Promise<WebhookEventsResult> {
  if (!cachedResult) {
    cachedResult = resolveWebhookEvents();
  }
  return cachedResult;
}

/** Test-only: reset the memoized result between test cases. */
export function __resetWebhookEventsCacheForTests(): void {
  cachedResult = null;
}
