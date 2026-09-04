/**
 * BookingConfirmation tests.
 *
 * Covers:
 * - `management` present renders working reschedule/cancel links, built
 *   through `buildBookingLinkUrl`, scoped correctly (`?target=calendar`
 *   with the CONFIRMED event's own duration, or `?target=group` with none),
 *   and branded when a slug is supplied.
 * - A plain statement of when the links expire (the event's own end time).
 * - `management` absent (an older backend's `201`) degrades to the base
 *   confirmation with NO self-service section — never crashes.
 * - Copying a link writes the FULL url (including the code) to the
 *   clipboard.
 * - Neither code ever reaches `console.*` — the phase's named leak-guard.
 */

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { CalendarEvent, CalendarEventWithManagementCodes } from '@/client';
import {
  BookingConfirmation,
  extractManagementCodes,
} from './booking-confirmation';

beforeAll(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 1,
    title: 'Appointment',
    start_time: '2026-03-02T15:00:00.000Z',
    end_time: '2026-03-02T15:30:00.000Z',
    timezone: 'America/New_York',
    created: '2026-03-01T00:00:00.000Z',
    modified: '2026-03-01T00:00:00.000Z',
    external_id: 'evt-1',
    external_attendances: [],
    attendances: [],
    resource_allocations: [],
    group_selections: [],
    parent_recurring_object: {
      id: 0,
      title: '',
      external_id: '',
      start_time: '2026-03-01T00:00:00.000Z',
      end_time: '2026-03-01T00:00:00.000Z',
      created: '2026-03-01T00:00:00.000Z',
      modified: '2026-03-01T00:00:00.000Z',
    },
    is_recurring_instance: false,
    is_recurring: false,
    ...overrides,
  } as CalendarEvent;
}

function makeEventWithManagement(
  overrides: Partial<CalendarEvent> = {}
): CalendarEventWithManagementCodes {
  return {
    ...makeEvent(overrides),
    management: {
      reschedule_code: 'plaintext-reschedule-code',
      cancel_code: 'plaintext-cancel-code',
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('extractManagementCodes', () => {
  it('returns the management object when both codes are present strings', () => {
    const event = makeEventWithManagement();
    expect(extractManagementCodes(event)).toEqual(event.management);
  });

  it('returns null when the event has no management key at all (older backend)', () => {
    expect(extractManagementCodes(makeEvent())).toBeNull();
  });

  it('returns null when management is present but malformed', () => {
    const event = {
      ...makeEvent(),
      management: { reschedule_code: 123, cancel_code: null },
    } as unknown as CalendarEventWithManagementCodes;
    expect(extractManagementCodes(event)).toBeNull();
  });
});

describe('BookingConfirmation', () => {
  it('renders the base confirmation and NO self-service section when management is absent', () => {
    render(
      <BookingConfirmation
        event={makeEvent()}
        timezone='America/New_York'
        scope={{ kind: 'calendar' }}
      />
    );

    expect(screen.getByTestId('booking-confirmation')).toBeInTheDocument();
    expect(
      screen.queryByTestId('booking-management-links')
    ).not.toBeInTheDocument();
  });

  it('renders working reschedule and cancel links for a calendar-scoped confirmation', () => {
    const event = makeEventWithManagement();
    render(
      <BookingConfirmation
        event={event}
        timezone='America/New_York'
        scope={{ kind: 'calendar' }}
      />
    );

    const rescheduleInput = screen.getByTestId(
      'reschedule-link-input'
    ) as HTMLInputElement;
    const cancelInput = screen.getByTestId(
      'cancel-link-input'
    ) as HTMLInputElement;

    expect(rescheduleInput.value).toContain('plaintext-reschedule-code');
    expect(rescheduleInput.value).toContain('/reschedule');
    expect(rescheduleInput.value).toContain('target=calendar');
    // 30-minute event (15:00–15:30 UTC) → 1800s, recomputed from the
    // CONFIRMED event's own span, never a caller-requested duration.
    expect(rescheduleInput.value).toContain('duration=1800');

    expect(cancelInput.value).toContain('plaintext-cancel-code');
    expect(cancelInput.value).toContain('/cancel');
    expect(cancelInput.value).not.toContain('target=');
    expect(cancelInput.value).not.toContain('duration=');
  });

  it('a group-scoped confirmation carries ?target=group and no duration on the reschedule link', () => {
    const event = makeEventWithManagement();
    render(
      <BookingConfirmation
        event={event}
        timezone='America/New_York'
        scope={{ kind: 'group' }}
      />
    );

    const rescheduleInput = screen.getByTestId(
      'reschedule-link-input'
    ) as HTMLInputElement;
    expect(rescheduleInput.value).toContain('target=group');
    expect(rescheduleInput.value).not.toContain('duration=');
  });

  it('builds branded links when a slug is supplied', () => {
    const event = makeEventWithManagement();
    render(
      <BookingConfirmation
        event={event}
        timezone='America/New_York'
        scope={{ kind: 'calendar' }}
        slug='acme'
      />
    );

    const rescheduleInput = screen.getByTestId(
      'reschedule-link-input'
    ) as HTMLInputElement;
    const cancelInput = screen.getByTestId(
      'cancel-link-input'
    ) as HTMLInputElement;
    expect(rescheduleInput.value).toContain('/o/acme/book/');
    expect(cancelInput.value).toContain('/o/acme/book/');
  });

  it("states plainly when the links expire — the event's own end time", () => {
    const event = makeEventWithManagement();
    render(
      <BookingConfirmation
        event={event}
        timezone='America/New_York'
        scope={{ kind: 'calendar' }}
      />
    );

    expect(screen.getByTestId('booking-management-links')).toHaveTextContent(
      /until your appointment ends/i
    );
  });

  it('copying a link writes the FULL url, including the code, to the clipboard', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      writable: true,
      configurable: true,
    });

    const event = makeEventWithManagement();
    render(
      <BookingConfirmation
        event={event}
        timezone='America/New_York'
        scope={{ kind: 'calendar' }}
      />
    );

    const rescheduleInput = screen.getByTestId(
      'reschedule-link-input'
    ) as HTMLInputElement;
    await user.click(screen.getByTestId('copy-reschedule-link-button'));

    expect(writeTextSpy).toHaveBeenCalledWith(rescheduleInput.value);
  });

  it('never passes the plaintext codes to console.log/warn/error', async () => {
    const user = userEvent.setup();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const event = makeEventWithManagement();
    render(
      <BookingConfirmation
        event={event}
        timezone='America/New_York'
        scope={{ kind: 'calendar' }}
      />
    );
    await user.click(screen.getByTestId('copy-reschedule-link-button'));
    await user.click(screen.getByTestId('copy-cancel-link-button'));

    const allCalls = [
      ...logSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
    ]
      .flat()
      .join(' ');
    expect(allCalls).not.toContain('plaintext-reschedule-code');
    expect(allCalls).not.toContain('plaintext-cancel-code');
  });
});
