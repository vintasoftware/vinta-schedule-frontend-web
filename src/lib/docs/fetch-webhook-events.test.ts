import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetWebhookEventsCacheForTests,
  fetchLiveWebhookEvents,
  getWebhookEvents,
  loadSnapshotWebhookEvents,
} from './fetch-webhook-events';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('fetch-webhook-events', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    __resetWebhookEventsCacheForTests();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('falls back to the committed snapshot when the fetch fails, without throwing', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await getWebhookEvents();

    expect(result.source).toBe('snapshot');
    expect(result.events).toEqual(loadSnapshotWebhookEvents());
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('falling back to')
    );
  });

  it('falls back to the snapshot on a non-2xx response', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response('not found', { status: 404 }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await getWebhookEvents();

    expect(result.source).toBe('snapshot');
  });

  it('falls back to the snapshot when the response is not an array', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ not: 'an array' }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await getWebhookEvents();

    expect(result.source).toBe('snapshot');
  });

  it('falls back to the snapshot when an event is missing required fields', async () => {
    const invalidEvents = [
      { value: 'event1', label: 'Event 1' }, // missing description
    ];
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(invalidEvents));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await getWebhookEvents();

    expect(result.source).toBe('snapshot');
  });

  it('uses the live events when the fetch succeeds', async () => {
    const liveEvents = [
      {
        value: 'test_event',
        label: 'Test Event',
        description: 'A test webhook event.',
      },
    ];
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(liveEvents));

    const result = await getWebhookEvents();

    expect(result.source).toBe('live');
    expect(result.events).toEqual(liveEvents);
  });

  it('memoizes the result across repeated calls (one fetch attempt per process)', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('down'));
    global.fetch = fetchSpy;
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await getWebhookEvents();
    await getWebhookEvents();
    await getWebhookEvents();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('fetchLiveWebhookEvents resolves null (never throws) on network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(fetchLiveWebhookEvents()).resolves.toBeNull();
  });

  it('loadSnapshotWebhookEvents returns the committed snapshot synchronously', () => {
    const events = loadSnapshotWebhookEvents();

    expect(events.length).toBeGreaterThan(0);
    expect(
      events.every(
        (event) =>
          typeof event.value === 'string' &&
          typeof event.label === 'string' &&
          typeof event.description === 'string'
      )
    ).toBe(true);
    // Sanity-check against the real backend manifest documented in the phase.
    expect(events.map((event) => event.value).sort()).toEqual([
      'calendar_event_attendee_added',
      'calendar_event_attendee_removed',
      'calendar_event_attendee_updated',
      'calendar_event_created',
      'calendar_event_deleted',
      'calendar_event_updated',
      'organization_member_created',
    ]);
  });
});
