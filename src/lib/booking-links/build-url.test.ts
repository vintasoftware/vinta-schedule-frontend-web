import { describe, it, expect } from 'vitest';
import { buildBookingLinkUrl } from './build-url';

describe('buildBookingLinkUrl', () => {
  it('builds a bare book link with an explicit calendar target when no slug is given', () => {
    const url = buildBookingLinkUrl({
      code: 'abc123',
      purpose: 'book',
      scope: { kind: 'calendar' },
    });
    expect(url).toBe('http://localhost:3000/book/abc123?target=calendar');
  });

  it('builds a branded book link with an explicit calendar target when a slug is given', () => {
    const url = buildBookingLinkUrl({
      code: 'abc123',
      purpose: 'book',
      slug: 'acme',
      scope: { kind: 'calendar' },
    });
    expect(url).toBe(
      'http://localhost:3000/o/acme/book/abc123?target=calendar'
    );
  });

  it('appends ?target=calendar&duration= for a calendar-scoped book link when durationSeconds is given', () => {
    const url = buildBookingLinkUrl({
      code: 'abc123',
      purpose: 'book',
      scope: { kind: 'calendar', durationSeconds: 1800 },
    });
    expect(url).toBe(
      'http://localhost:3000/book/abc123?target=calendar&duration=1800'
    );
  });

  it('does not append ?duration= for a calendar-scoped book link when durationSeconds is omitted', () => {
    const url = buildBookingLinkUrl({
      code: 'abc123',
      purpose: 'book',
      scope: { kind: 'calendar' },
    });
    expect(url).not.toContain('duration');
    expect(url).toContain('target=calendar');
  });

  it('marks a group-scoped book link with ?target=group and never a duration, since the field does not exist', () => {
    const url = buildBookingLinkUrl({
      code: 'abc123',
      purpose: 'book',
      scope: { kind: 'group' },
    });
    expect(url).toBe('http://localhost:3000/book/abc123?target=group');
    expect(url).not.toContain('duration');
  });

  it('appends the reschedule path segment plus ?target=calendar&duration= for a calendar scope with a duration — the two reschedule endpoints are not collapsed server-side, so the URL must carry which one to call', () => {
    const url = buildBookingLinkUrl({
      code: 'abc123',
      purpose: 'reschedule',
      scope: { kind: 'calendar', durationSeconds: 1800 },
    });
    expect(url).toBe(
      'http://localhost:3000/book/abc123/reschedule?target=calendar&duration=1800'
    );
  });

  it('marks a group-scoped reschedule link with ?target=group and never a duration, mirroring the book link rule', () => {
    const url = buildBookingLinkUrl({
      code: 'abc123',
      purpose: 'reschedule',
      scope: { kind: 'group' },
    });
    expect(url).toBe(
      'http://localhost:3000/book/abc123/reschedule?target=group'
    );
    expect(url).not.toContain('duration');
  });

  it('a group-scoped reschedule code is never routed to the single-calendar endpoint: the minted URL always says target=group, not target=calendar', () => {
    // This is the load-bearing assertion for "no probing" — the reschedule
    // page (`resolveBookingLinkTarget`) reads ONLY this marker to decide
    // which of `publicBookingEventsRescheduleCreate` /
    // `publicBookingGroupEventsRescheduleCreate` to call. If a group-scoped
    // code's minted URL ever said `target=calendar`, the page would call the
    // wrong endpoint and get an opaque `403 NOT_PERMITTED` it must never try
    // to recover from by falling back to the other endpoint.
    const url = buildBookingLinkUrl({
      code: 'group-secret',
      purpose: 'reschedule',
      scope: { kind: 'group' },
    });
    const target = new URL(url).searchParams.get('target');
    expect(target).toBe('group');
    expect(target).not.toBe('calendar');
  });

  it('appends the cancel path segment and never a target or duration query', () => {
    const url = buildBookingLinkUrl({
      code: 'abc123',
      purpose: 'cancel',
      scope: { kind: 'calendar', durationSeconds: 1800 },
    });
    expect(url).toBe('http://localhost:3000/book/abc123/cancel');
    expect(url).not.toContain('duration');
    expect(url).not.toContain('target');
  });

  it('builds a branded reschedule link', () => {
    const url = buildBookingLinkUrl({
      code: 'xyz789',
      purpose: 'reschedule',
      slug: 'acme',
      scope: { kind: 'calendar' },
    });
    expect(url).toBe(
      'http://localhost:3000/o/acme/book/xyz789/reschedule?target=calendar'
    );
  });

  it('builds a branded cancel link', () => {
    const url = buildBookingLinkUrl({
      code: 'xyz789',
      purpose: 'cancel',
      slug: 'acme',
      scope: { kind: 'calendar' },
    });
    expect(url).toBe('http://localhost:3000/o/acme/book/xyz789/cancel');
  });

  it('encodes a code containing reserved characters instead of producing a broken path', () => {
    const url = buildBookingLinkUrl({
      code: 'abc/123?x#y',
      purpose: 'book',
      scope: { kind: 'calendar' },
    });
    expect(url).toBe(
      'http://localhost:3000/book/abc%2F123%3Fx%23y?target=calendar'
    );
  });

  it('encodes a slug containing reserved characters instead of producing a broken path', () => {
    const url = buildBookingLinkUrl({
      code: 'abc123',
      purpose: 'book',
      slug: 'acme/co?x#y',
      scope: { kind: 'calendar' },
    });
    expect(url).toBe(
      'http://localhost:3000/o/acme%2Fco%3Fx%23y/book/abc123?target=calendar'
    );
  });
});
