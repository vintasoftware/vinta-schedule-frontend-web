import { describe, it, expect } from 'vitest';
import { buildBookingLinkUrl } from './build-url';

describe('buildBookingLinkUrl', () => {
  it('builds a bare book link when no slug is given', () => {
    const url = buildBookingLinkUrl({
      code: 'abc123',
      purpose: 'book',
      scope: { kind: 'calendar' },
    });
    expect(url).toBe('http://localhost:3000/book/abc123');
  });

  it('builds a branded book link when a slug is given', () => {
    const url = buildBookingLinkUrl({
      code: 'abc123',
      purpose: 'book',
      slug: 'acme',
      scope: { kind: 'calendar' },
    });
    expect(url).toBe('http://localhost:3000/o/acme/book/abc123');
  });

  it('appends ?duration= for a calendar-scoped book link when durationSeconds is given', () => {
    const url = buildBookingLinkUrl({
      code: 'abc123',
      purpose: 'book',
      scope: { kind: 'calendar', durationSeconds: 1800 },
    });
    expect(url).toBe('http://localhost:3000/book/abc123?duration=1800');
  });

  it('does not append ?duration= for a calendar-scoped book link when durationSeconds is omitted', () => {
    const url = buildBookingLinkUrl({
      code: 'abc123',
      purpose: 'book',
      scope: { kind: 'calendar' },
    });
    expect(url).not.toContain('duration');
  });

  it('never appends ?duration= for a group-scoped book link, since the field does not exist', () => {
    const url = buildBookingLinkUrl({
      code: 'abc123',
      purpose: 'book',
      scope: { kind: 'group' },
    });
    expect(url).toBe('http://localhost:3000/book/abc123');
    expect(url).not.toContain('duration');
  });

  it('appends the reschedule path segment and never a duration query, even for a calendar scope with a duration', () => {
    const url = buildBookingLinkUrl({
      code: 'abc123',
      purpose: 'reschedule',
      scope: { kind: 'calendar', durationSeconds: 1800 },
    });
    expect(url).toBe('http://localhost:3000/book/abc123/reschedule');
    expect(url).not.toContain('duration');
  });

  it('appends the cancel path segment and never a duration query', () => {
    const url = buildBookingLinkUrl({
      code: 'abc123',
      purpose: 'cancel',
      scope: { kind: 'calendar', durationSeconds: 1800 },
    });
    expect(url).toBe('http://localhost:3000/book/abc123/cancel');
    expect(url).not.toContain('duration');
  });

  it('builds a branded reschedule link', () => {
    const url = buildBookingLinkUrl({
      code: 'xyz789',
      purpose: 'reschedule',
      slug: 'acme',
      scope: { kind: 'calendar' },
    });
    expect(url).toBe('http://localhost:3000/o/acme/book/xyz789/reschedule');
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
    expect(url).toBe('http://localhost:3000/book/abc%2F123%3Fx%23y');
  });

  it('encodes a slug containing reserved characters instead of producing a broken path', () => {
    const url = buildBookingLinkUrl({
      code: 'abc123',
      purpose: 'book',
      slug: 'acme/co?x#y',
      scope: { kind: 'calendar' },
    });
    expect(url).toBe('http://localhost:3000/o/acme%2Fco%3Fx%23y/book/abc123');
  });
});
