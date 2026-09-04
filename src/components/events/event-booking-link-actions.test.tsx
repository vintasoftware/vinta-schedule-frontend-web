/**
 * EventAttendeesSheet — "Get reschedule link" / "Get cancel link" actions
 * (Phase 4 of the public scheduling links plan).
 *
 * Covers:
 * - Both buttons are always offered (no extra permission gate — visibility
 *   of the event already implies eligibility, matching the ungated
 *   edit/reschedule/cancel actions on this same sheet).
 * - Clicking "Get reschedule link" for a single-calendar event (no
 *   `group_selections`) opens the mint dialog with an `event` target whose
 *   `eventScope` is `{ kind: 'calendar', durationSeconds }`, computed from
 *   the event's own start/end time.
 * - Clicking "Get reschedule link" for a calendar-GROUP event
 *   (`group_selections.length > 0`) opens the mint dialog with
 *   `eventScope: { kind: 'group' }` — never a calendar scope for a group
 *   event.
 * - Clicking "Get cancel link" opens the mint dialog with `purpose: 'cancel'`
 *   and offers no duration control.
 * - Minting either kind of link calls `bookingCodesCreate` with
 *   `{ purpose, event: <this event's id> }`.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { DateTime } from 'luxon';

beforeAll(() => {
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!window.HTMLElement.prototype.setPointerCapture) {
    window.HTMLElement.prototype.setPointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
  if (!global.ResizeObserver) {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/events',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/hooks/organizations/use-current-organization');

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarList: vi.fn(),
    bookingCodesCreate: vi.fn(),
  };
});

import { toast } from 'sonner';
import { calendarList, bookingCodesCreate } from '@/client/sdk.gen';
import * as orgHook from '@/hooks/organizations/use-current-organization';
import { EventAttendeesSheet } from './event-attendees-editor';
import type { CalendarEventVM } from '@/components/calendar/event-vm';
import type {
  BookingCodeCreateResult,
  CalendarEvent,
  PaginatedCalendarList,
  CalendarEventGroupSelection,
} from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRaw(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 42,
    title: 'Checkup',
    start_time: '2026-06-15T09:00:00-04:00',
    end_time: '2026-06-15T09:45:00-04:00',
    timezone: 'America/New_York',
    created: '2026-01-01T00:00:00Z',
    modified: '2026-01-01T00:00:00Z',
    external_id: 'ext-42',
    external_attendances: [],
    attendances: [],
    resource_allocations: [],
    group_selections: [],
    parent_recurring_object: {
      id: 0,
      title: '',
      external_id: '',
      start_time: '2026-01-01T00:00:00Z',
      end_time: '2026-01-01T00:00:00Z',
      created: '2026-01-01T00:00:00Z',
      modified: '2026-01-01T00:00:00Z',
    },
    is_recurring: false,
    is_recurring_instance: false,
    ...overrides,
  };
}

function makeEventVM(raw: CalendarEvent): CalendarEventVM {
  const zone = raw.timezone;
  const startDt = DateTime.fromISO(raw.start_time, { zone });
  const endDt = DateTime.fromISO(raw.end_time, { zone });
  return {
    id: String(raw.id),
    title: raw.title,
    start: startDt.toJSDate(),
    end: endDt.toJSDate(),
    startDt,
    endDt,
    timezone: zone,
    timezoneLabel: 'EDT (UTC-4)',
    calendarId: 1,
    isRecurring: false,
    isRecurringException: false,
    status: 'confirmed',
    _raw: raw,
  };
}

function makeCalendarsResponse(): Awaited<ReturnType<typeof calendarList>> {
  const data: PaginatedCalendarList = { count: 0, results: [] };
  return {
    data,
    response: new Response(JSON.stringify(data), { status: 200 }),
  } as unknown as Awaited<ReturnType<typeof calendarList>>;
}

function makeMintResponse(
  result: Partial<BookingCodeCreateResult>
): Awaited<ReturnType<typeof bookingCodesCreate>> {
  const body: BookingCodeCreateResult = {
    id: 1,
    code: 'plaintext-code-once',
    purpose: 'reschedule',
    calendar: null,
    calendar_group: null,
    event: null,
    expires_at: null,
    ...result,
  };
  return {
    data: body,
    response: new Response(JSON.stringify(body), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof bookingCodesCreate>>;
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return Wrapper;
}

function renderSheet(event: CalendarEventVM) {
  return render(
    <EventAttendeesSheet open event={event} onOpenChange={vi.fn()} />,
    { wrapper: makeWrapper() }
  );
}

describe('EventAttendeesSheet — booking-link actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(calendarList).mockResolvedValue(makeCalendarsResponse());
    vi.mocked(orgHook.useCurrentOrganization).mockReturnValue({
      organization: { slug: 'acme' },
      isOnboarded: true,
      isGated: false,
      isDisabled: false,
      membership: null,
      permissions: [],
      isLoading: false,
      isError: false,
      error: null,
      query: { data: undefined },
    } as unknown as ReturnType<typeof orgHook.useCurrentOrganization>);
  });

  it('always offers both "Get reschedule link" and "Get cancel link" buttons', () => {
    renderSheet(makeEventVM(makeRaw()));

    expect(
      screen.getByRole('button', { name: /get reschedule link/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /get cancel link/i })
    ).toBeInTheDocument();
  });

  it('a single-calendar event: "Get reschedule link" opens the dialog with a calendar-scoped duration control, defaulted to the event\'s own length', async () => {
    const user = userEvent.setup();
    renderSheet(makeEventVM(makeRaw()));

    await user.click(
      screen.getByRole('button', { name: /get reschedule link/i })
    );

    const durationInput = (await screen.findByLabelText(
      'Booking duration value'
    )) as HTMLInputElement;
    // 45 minutes — matches the fixture's start/end times.
    expect(durationInput.value).toBe('45');
  });

  it('mints a reschedule link for a single-calendar event with { purpose: reschedule, event: <id> } and a ?target=calendar URL', async () => {
    const user = userEvent.setup();
    vi.mocked(bookingCodesCreate).mockResolvedValueOnce(
      makeMintResponse({ purpose: 'reschedule', event: 42 })
    );

    renderSheet(makeEventVM(makeRaw()));

    await user.click(
      screen.getByRole('button', { name: /get reschedule link/i })
    );
    await user.click(await screen.findByTestId('create-booking-link-submit'));

    await waitFor(() =>
      expect(bookingCodesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ purpose: 'reschedule', event: 42 }),
        })
      )
    );
    const urlInput = (await screen.findByTestId(
      'booking-link-url-input'
    )) as HTMLInputElement;
    expect(urlInput.value).toContain('/reschedule');
    expect(urlInput.value).toContain('target=calendar');
  });

  it('a calendar-GROUP event (group_selections non-empty): "Get reschedule link" offers no duration control and never a calendar scope', async () => {
    const user = userEvent.setup();
    const groupSelection = {
      id: 1,
      slot: { id: 1, name: 'Slot', calendars: [], pools: [] },
      calendar: { id: 1, name: 'Room A' },
      is_in_current_roster: true,
    } as unknown as CalendarEventGroupSelection;
    renderSheet(makeEventVM(makeRaw({ group_selections: [groupSelection] })));

    await user.click(
      screen.getByRole('button', { name: /get reschedule link/i })
    );

    expect(
      screen.queryByLabelText('Booking duration value')
    ).not.toBeInTheDocument();
  });

  it('mints a reschedule link for a group event with ?target=group, never ?target=calendar (no probing)', async () => {
    const user = userEvent.setup();
    vi.mocked(bookingCodesCreate).mockResolvedValueOnce(
      makeMintResponse({ purpose: 'reschedule', event: 42 })
    );
    const groupSelection = {
      id: 1,
      slot: { id: 1, name: 'Slot', calendars: [], pools: [] },
      calendar: { id: 1, name: 'Room A' },
      is_in_current_roster: true,
    } as unknown as CalendarEventGroupSelection;

    renderSheet(makeEventVM(makeRaw({ group_selections: [groupSelection] })));

    await user.click(
      screen.getByRole('button', { name: /get reschedule link/i })
    );
    await user.click(await screen.findByTestId('create-booking-link-submit'));

    const urlInput = (await screen.findByTestId(
      'booking-link-url-input'
    )) as HTMLInputElement;
    const target = new URL(urlInput.value).searchParams.get('target');
    expect(target).toBe('group');
    expect(target).not.toBe('calendar');
  });

  it('"Get cancel link" opens the dialog with no duration control at all', async () => {
    const user = userEvent.setup();
    renderSheet(makeEventVM(makeRaw()));

    await user.click(screen.getByRole('button', { name: /get cancel link/i }));

    expect(
      await screen.findByTestId('create-booking-link-submit')
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Booking duration value')
    ).not.toBeInTheDocument();
  });

  it('mints a cancel link with { purpose: cancel, event: <id> } and a URL with no ?target= or ?duration=', async () => {
    const user = userEvent.setup();
    vi.mocked(bookingCodesCreate).mockResolvedValueOnce(
      makeMintResponse({ purpose: 'cancel', event: 42 })
    );

    renderSheet(makeEventVM(makeRaw()));

    await user.click(screen.getByRole('button', { name: /get cancel link/i }));
    await user.click(await screen.findByTestId('create-booking-link-submit'));

    await waitFor(() =>
      expect(bookingCodesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ purpose: 'cancel', event: 42 }),
        })
      )
    );
    const urlInput = (await screen.findByTestId(
      'booking-link-url-input'
    )) as HTMLInputElement;
    expect(urlInput.value).toContain('/cancel');
    expect(urlInput.value).not.toContain('target=');
    expect(urlInput.value).not.toContain('duration=');
  });

  // These buttons are deliberately ungated (see the doc comment above them
  // in event-attendees-editor.tsx) on the strength of the server's own
  // owner-or-org-admin check plus this inline surfacing of its rejection.
  // If a future change to handleMutationError / applyServerFieldErrors ever
  // demotes this to a toast-only failure, that reasoning stops holding.
  it("an unauthorized mint's 403 is surfaced inline on the form, not just as a toast", async () => {
    const user = userEvent.setup();
    vi.mocked(bookingCodesCreate).mockRejectedValueOnce({
      non_field_errors: [
        'You do not have permission to mint a link for this event.',
      ],
    });

    renderSheet(makeEventVM(makeRaw()));

    await user.click(
      screen.getByRole('button', { name: /get reschedule link/i })
    );
    await user.click(await screen.findByTestId('create-booking-link-submit'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You do not have permission to mint a link for this event.'
    );
    expect(toast.error).not.toHaveBeenCalled();
    // Still on the form view — no link was revealed.
    expect(
      screen.queryByTestId('booking-link-url-input')
    ).not.toBeInTheDocument();
  });
});
