import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetConceptsCacheForTests,
  fetchLiveConcepts,
  getConcepts,
  loadSnapshotConcepts,
} from './fetch-concepts';
import conceptsManifest from './__generated__/concepts-manifest.json';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('fetch-concepts', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    __resetConceptsCacheForTests();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('falls back to the committed snapshot when the manifest fetch fails, without throwing', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await getConcepts();

    expect(result.source).toBe('snapshot');
    expect(result.docs).toEqual(loadSnapshotConcepts());
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('falling back to')
    );
  });

  it('falls back to the snapshot on a non-2xx manifest response', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response('not found', { status: 404 }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await getConcepts();

    expect(result.source).toBe('snapshot');
  });

  it('falls back to the snapshot when the manifest response is not an array', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ not: 'an array' }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await getConcepts();

    expect(result.source).toBe('snapshot');
  });

  it('falls back to the snapshot when a single doc fetch fails (whole-or-nothing)', async () => {
    const manifest = loadSnapshotConcepts().map(({ slug, title }) => ({
      slug,
      title,
    }));
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).endsWith('/public-api-docs/')) {
        return Promise.resolve(jsonResponse(manifest));
      }
      // Every per-doc request fails, exercising the partial-result path.
      return Promise.resolve(new Response('error', { status: 500 }));
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await getConcepts();

    expect(result.source).toBe('snapshot');
  });

  it('falls back to the snapshot when a doc response has a mismatched slug', async () => {
    const manifest = [{ slug: 'calendar-groups', title: 'Calendar Groups' }];
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).endsWith('/public-api-docs/')) {
        return Promise.resolve(jsonResponse(manifest));
      }
      // Wrong slug in the body — the backend served the wrong doc.
      return Promise.resolve(
        jsonResponse({
          slug: 'events',
          title: 'Events',
          markdown: '# Events',
        })
      );
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await getConcepts();

    expect(result.source).toBe('snapshot');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('had slug "events", expected "calendar-groups"')
    );
  });

  it('uses the live docs when every fetch succeeds', async () => {
    const manifest = [{ slug: 'calendar-groups', title: 'Calendar Groups' }];
    const doc = {
      slug: 'calendar-groups',
      title: 'Calendar Groups',
      markdown: '# Calendar Groups',
    };
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).endsWith('/public-api-docs/')) {
        return Promise.resolve(jsonResponse(manifest));
      }
      return Promise.resolve(jsonResponse(doc));
    });

    const result = await getConcepts();

    expect(result.source).toBe('live');
    expect(result.docs).toEqual([doc]);
  });

  it('treats a genuinely empty live manifest as success, not a failure', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse([]));

    const result = await getConcepts();

    expect(result.source).toBe('live');
    expect(result.docs).toEqual([]);
  });

  it('memoizes the result across repeated calls (one fetch attempt per process)', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('down'));
    global.fetch = fetchSpy;
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await getConcepts();
    await getConcepts();
    await getConcepts();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('fetchLiveConcepts resolves null (never throws) on manifest network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(fetchLiveConcepts()).resolves.toBeNull();
  });

  it('loadSnapshotConcepts returns the committed snapshot synchronously', () => {
    const docs = loadSnapshotConcepts();

    expect(docs.length).toBeGreaterThan(0);
    expect(
      docs.every(
        (doc) =>
          typeof doc.slug === 'string' &&
          typeof doc.title === 'string' &&
          typeof doc.markdown === 'string'
      )
    ).toBe(true);
    // Sanity-check against the real backend manifest documented in the phase.
    expect(docs.map((doc) => doc.slug).sort()).toEqual([
      'availability',
      'calendar-bundles',
      'calendar-groups',
      'calendars',
      'events',
      'recurrence',
    ]);
  });

  it('keeps the nav manifest snapshot in sync with the full concepts snapshot', () => {
    // `nav.ts`'s sidebar is built from `concepts-manifest.json`, never a
    // live fetch (see the comment there) — so the two committed snapshots
    // must always describe the same set of docs. If someone hand-edits one
    // file, or only runs `docs:refresh-concepts-snapshot` partway, this
    // catches the drift: a slug present in one file but not the other would
    // otherwise mean a dead sidebar link or a doc missing from the sidebar.
    const manifestSlugs = conceptsManifest.map((doc) => doc.slug).sort();
    const snapshotSlugs = loadSnapshotConcepts()
      .map((doc) => doc.slug)
      .sort();

    expect(manifestSlugs).toEqual(snapshotSlugs);
  });
});
