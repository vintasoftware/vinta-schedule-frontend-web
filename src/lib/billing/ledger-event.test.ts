/**
 * normalizeLedgerEvent tests.
 *
 * The generated `LedgerEvent` declares only `id` since vinta-django-billing
 * 0.6.0 — `title` / `calendar` / `owners` are undeclared extra keys this
 * project's `OccurrenceSource.describe` attaches. Nothing in the type system
 * guarantees them any more, so these cover both the shape the backend really
 * sends and every way it could stop sending it.
 */

import { describe, it, expect } from 'vitest';

import type { CalendarLedgerEvent } from './ledger-event';
import { normalizeLedgerEvent } from './ledger-event';

describe('normalizeLedgerEvent', () => {
  it('resolves the payload this project actually sends', () => {
    const event: CalendarLedgerEvent = {
      id: 100,
      title: 'Weekly sync',
      calendar: { id: 5, name: 'Team calendar' },
      owners: [
        { user_id: 1, name: 'Ada Lovelace' },
        { user_id: 2, name: 'Alan Turing' },
      ],
    };

    expect(normalizeLedgerEvent(event)).toEqual({
      id: 100,
      title: 'Weekly sync',
      calendar: { id: 5, name: 'Team calendar' },
      owners: [
        { user_id: 1, name: 'Ada Lovelace' },
        { user_id: 2, name: 'Alan Turing' },
      ],
    });
  });

  it('returns null for a null event', () => {
    // A MeteredOccurrence outlives its event by design, so this is an expected
    // state the ledger renders as "Event deleted" — never an error.
    expect(normalizeLedgerEvent(null)).toBeNull();
    expect(normalizeLedgerEvent(undefined)).toBeNull();
  });

  it('keeps a null calendar as null', () => {
    const event: CalendarLedgerEvent = {
      id: 100,
      title: 'One-off review',
      calendar: null,
      owners: [],
    };

    expect(normalizeLedgerEvent(event)).toEqual({
      id: 100,
      title: 'One-off review',
      calendar: null,
      owners: [],
    });
  });

  it('falls back to empty values when the source sends only the declared id', () => {
    // What a differently-configured OccurrenceSource would send. The row must
    // still render — with em-dashes — rather than crash on `owners.map`.
    expect(normalizeLedgerEvent({ id: 100 })).toEqual({
      id: 100,
      title: null,
      calendar: null,
      owners: [],
    });
  });

  it('drops malformed extras instead of passing them through', () => {
    const malformed = {
      id: 100,
      title: 42,
      calendar: { id: 'five', name: 'Team calendar' },
      owners: 'Ada Lovelace',
    } as unknown as CalendarLedgerEvent;

    expect(normalizeLedgerEvent(malformed)).toEqual({
      id: 100,
      title: null,
      calendar: null,
      owners: [],
    });
  });

  it('keeps the well-formed owners and drops only the broken ones', () => {
    const partial = {
      id: 100,
      title: 'Weekly sync',
      calendar: null,
      owners: [
        { user_id: 1, name: 'Ada Lovelace' },
        { user_id: 'two', name: 'Alan Turing' },
        null,
      ],
    } as unknown as CalendarLedgerEvent;

    expect(normalizeLedgerEvent(partial)?.owners).toEqual([
      { user_id: 1, name: 'Ada Lovelace' },
    ]);
  });
});
