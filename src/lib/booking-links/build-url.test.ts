import { describe, it, expect } from 'vitest';
import {
  buildBookingLinkUrl,
  buildAppointmentTypePublicBookingUrl,
} from './build-url';

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

  it('marks an appointment-type-scoped book link with ?target=appointmentType and never a duration, since the field does not exist', () => {
    const url = buildBookingLinkUrl({
      code: 'abc123',
      purpose: 'book',
      scope: { kind: 'appointmentType' },
    });
    expect(url).toBe(
      'http://localhost:3000/book/abc123?target=appointmentType'
    );
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

  it('marks an appointment-type-scoped reschedule link with ?target=appointmentType and never a duration, mirroring the book link rule', () => {
    const url = buildBookingLinkUrl({
      code: 'abc123',
      purpose: 'reschedule',
      scope: { kind: 'appointmentType' },
    });
    expect(url).toBe(
      'http://localhost:3000/book/abc123/reschedule?target=appointmentType'
    );
    expect(url).not.toContain('duration');
  });

  it('an appointment-type-scoped reschedule code is never routed to the single-calendar endpoint: the minted URL always says target=appointmentType, not target=calendar', () => {
    // This is the load-bearing assertion for "no probing" — the reschedule
    // page (`resolveBookingLinkTarget`) reads ONLY this marker to decide
    // which of `publicBookingEventsRescheduleCreate` /
    // `publicBookingAppointmentTypeEventsRescheduleCreate` to call. If an appointment-type-scoped
    // code's minted URL ever said `target=calendar`, the page would call the
    // wrong endpoint and get an opaque `403 NOT_PERMITTED` it must never try
    // to recover from by falling back to the other endpoint.
    const url = buildBookingLinkUrl({
      code: 'appointment-type-secret',
      purpose: 'reschedule',
      scope: { kind: 'appointmentType' },
    });
    const target = new URL(url).searchParams.get('target');
    expect(target).toBe('appointmentType');
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

describe('buildAppointmentTypePublicBookingUrl', () => {
  it('builds a bare codeless appointment type link when no org slug is given', () => {
    const url = buildAppointmentTypePublicBookingUrl({
      publicSlug: 'surgery-team',
    });
    expect(url).toBe('http://localhost:3000/g/surgery-team');
  });

  it('builds a branded codeless appointment type link when an org slug is given', () => {
    const url = buildAppointmentTypePublicBookingUrl({
      publicSlug: 'surgery-team',
      slug: 'acme',
    });
    expect(url).toBe('http://localhost:3000/o/acme/g/surgery-team');
  });

  it('never appends a target or duration query — unlike a minted book link, this URL has neither concept', () => {
    const url = buildAppointmentTypePublicBookingUrl({
      publicSlug: 'surgery-team',
    });
    expect(url).not.toContain('target');
    expect(url).not.toContain('duration');
  });

  it('encodes a public_slug containing reserved characters instead of producing a broken path', () => {
    const url = buildAppointmentTypePublicBookingUrl({
      publicSlug: 'team/a?b#c',
    });
    expect(url).toBe('http://localhost:3000/g/team%2Fa%3Fb%23c');
  });

  it('encodes an org slug containing reserved characters instead of producing a broken path', () => {
    const url = buildAppointmentTypePublicBookingUrl({
      publicSlug: 'surgery-team',
      slug: 'acme/co?x#y',
    });
    expect(url).toBe(
      'http://localhost:3000/o/acme%2Fco%3Fx%23y/g/surgery-team'
    );
  });
});
