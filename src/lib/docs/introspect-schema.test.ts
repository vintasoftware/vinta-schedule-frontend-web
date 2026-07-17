import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetSchemaIntrospectionCacheForTests,
  fetchLiveIntrospection,
  getSchemaIntrospection,
  loadSnapshotIntrospection,
} from './introspect-schema';

describe('introspect-schema', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    __resetSchemaIntrospectionCacheForTests();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('falls back to the committed snapshot when the live fetch fails, without throwing', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await getSchemaIntrospection();

    expect(result.source).toBe('snapshot');
    expect(result.schema).toEqual(loadSnapshotIntrospection());
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('falling back to')
    );
  });

  it('falls back to the snapshot on a non-2xx response', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response('not found', { status: 404 }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await getSchemaIntrospection();

    expect(result.source).toBe('snapshot');
  });

  it('falls back to the snapshot when the response has GraphQL errors', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: 'nope' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await getSchemaIntrospection();

    expect(result.source).toBe('snapshot');
  });

  it('uses the live schema when the fetch succeeds', async () => {
    const liveSchema = {
      queryType: { name: 'Query' },
      mutationType: null,
      subscriptionType: null,
      types: [],
    };
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { __schema: liveSchema } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await getSchemaIntrospection();

    expect(result.source).toBe('live');
    expect(result.schema).toEqual(liveSchema);
  });

  it('memoizes the result across repeated calls (one fetch attempt per process)', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('down'));
    global.fetch = fetchSpy;
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await getSchemaIntrospection();
    await getSchemaIntrospection();
    await getSchemaIntrospection();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('fetchLiveIntrospection resolves null (never throws) on network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(fetchLiveIntrospection()).resolves.toBeNull();
  });

  it('loadSnapshotIntrospection returns the committed snapshot schema synchronously', () => {
    const schema = loadSnapshotIntrospection();

    expect(schema.queryType?.name).toBe('Query');
    expect(schema.mutationType?.name).toBe('Mutation');
    expect(schema.types.length).toBeGreaterThan(0);
  });
});
