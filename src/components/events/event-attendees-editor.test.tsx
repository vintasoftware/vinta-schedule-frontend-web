/**
 * EventAttendeesEditor tests.
 *
 * Covers:
 * - Renders existing attendees from initial props.
 * - Add an internal attendee → Save calls calendarEventsPartialUpdate with the
 *   correct attendances array (including the new entry).
 * - Remove an external attendee → Save sends the stripped array.
 * - Add a resource allocation → Save sends resource_allocations with the new row.
 * - Full-array replacement: existing + new rows are sent together.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Browser API stubs required by Radix UI Select in jsdom
// ---------------------------------------------------------------------------

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
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/events',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarEventsPartialUpdate: vi.fn(),
    calendarList: vi.fn(),
    organizationMembersList: vi.fn(),
  };
});

import {
  calendarEventsPartialUpdate,
  calendarList,
  organizationMembersList,
} from '@/client/sdk.gen';
import { toast } from 'sonner';
import { EventAttendeesEditor } from './event-attendees-editor';
import type {
  EventAttendance,
  EventExternalAttendance,
  ResourceAllocation,
  Calendar,
  PaginatedCalendarList,
  OrganizationMembership,
  PaginatedOrganizationMembershipList,
} from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_INTERNAL_ATTENDANCE: EventAttendance = {
  id: 1,
  membership: { user_id: 10, organization_id: 1, role: 'member' },
  status: 'accepted',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
};

const FIXTURE_EXTERNAL_ATTENDANCE: EventExternalAttendance = {
  id: 2,
  external_attendee: {
    id: 5,
    email: 'bob@external.com',
    name: 'Bob Jones',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  },
  status: 'pending',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
};

const FIXTURE_RESOURCE_ALLOCATION: ResourceAllocation = {
  id: 3,
  calendar: 20,
  status: 'accepted',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
};

const FIXTURE_RESOURCE_CALENDAR: Calendar = {
  id: 20,
  name: 'Meeting Room A',
  description: undefined,
  email: 'room-a@example.com',
  external_id: 'cal-20',
  provider: 'internal',
  calendar_type: 'resource',
  capacity: 10,
  manage_available_windows: false,
  visibility: 'active',
};

const FIXTURE_RESOURCE_CALENDAR_2: Calendar = {
  id: 21,
  name: 'Meeting Room B',
  description: undefined,
  email: 'room-b@example.com',
  external_id: 'cal-21',
  provider: 'internal',
  calendar_type: 'resource',
  capacity: 5,
  manage_available_windows: false,
  visibility: 'active',
};

/** Org members returned by the member-search combobox (internal attendees). */
const MEMBER_SEARCH_FIXTURES: OrganizationMembership[] = [
  {
    user_id: 99,
    organization_id: 1,
    role: 'member',
    is_active: true,
    user_email: 'new@example.com',
    user_first_name: 'New',
    user_last_name: 'Member',
  },
  {
    user_id: 55,
    organization_id: 1,
    role: 'member',
    is_active: true,
    user_email: 'dave@corp.com',
    user_first_name: 'Dave',
    user_last_name: 'Stone',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMembersResponse(
  results: OrganizationMembership[]
): Awaited<ReturnType<typeof organizationMembersList>> {
  const body: PaginatedOrganizationMembershipList = {
    count: results.length,
    results,
  };
  return {
    data: body,
    response: new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof organizationMembersList>>;
}

function makeCalendarsResponse(
  results: Calendar[]
): Awaited<ReturnType<typeof calendarList>> {
  const body: PaginatedCalendarList = { count: results.length, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof calendarList>>;
}

function makePartialUpdateResponse(
  eventId = 42
): Awaited<ReturnType<typeof calendarEventsPartialUpdate>> {
  const body = {
    id: eventId,
    title: 'Test Event',
    start_time: '2024-06-15T09:00:00Z',
    end_time: '2024-06-15T10:00:00Z',
    timezone: 'UTC',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    external_id: 'ext-42',
    attendances: [],
    external_attendances: [],
    resource_allocations: [],
    parent_recurring_object: {
      id: 0,
      title: '',
      external_id: '',
      start_time: '2024-01-01T00:00:00Z',
      end_time: '2024-01-01T00:00:00Z',
      created: '2024-01-01T00:00:00Z',
      modified: '2024-01-01T00:00:00Z',
    },
    is_recurring: false,
    is_recurring_instance: false,
  };
  return {
    data: body,
    response: new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof calendarEventsPartialUpdate>>;
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function renderEditor(
  props?: Partial<{
    eventId: number;
    initialAttendances: EventAttendance[];
    initialExternalAttendances: EventExternalAttendance[];
    initialResourceAllocations: ResourceAllocation[];
    onSaved: () => void;
  }>
) {
  return render(
    <EventAttendeesEditor
      eventId={props?.eventId ?? 42}
      initialAttendances={props?.initialAttendances ?? []}
      initialExternalAttendances={props?.initialExternalAttendances ?? []}
      initialResourceAllocations={props?.initialResourceAllocations ?? []}
      onSaved={props?.onSaved}
    />,
    { wrapper }
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EventAttendeesEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(calendarList).mockResolvedValue(
      makeCalendarsResponse([
        FIXTURE_RESOURCE_CALENDAR,
        FIXTURE_RESOURCE_CALENDAR_2,
      ])
    );
    vi.mocked(calendarEventsPartialUpdate).mockResolvedValue(
      makePartialUpdateResponse()
    );
    vi.mocked(organizationMembersList).mockResolvedValue(
      makeMembersResponse(MEMBER_SEARCH_FIXTURES)
    );
  });

  describe('initial render', () => {
    it('renders existing internal attendee names', () => {
      renderEditor({ initialAttendances: [FIXTURE_INTERNAL_ATTENDANCE] });
      // The membership representation has no name/email, so the row is
      // labelled by user id.
      expect(screen.getByText('User 10')).toBeInTheDocument();
    });

    it('renders existing external attendees', () => {
      renderEditor({
        initialExternalAttendances: [FIXTURE_EXTERNAL_ATTENDANCE],
      });
      expect(screen.getByText('bob@external.com')).toBeInTheDocument();
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    });

    it('renders existing resource allocation calendar name', async () => {
      renderEditor({
        initialResourceAllocations: [FIXTURE_RESOURCE_ALLOCATION],
      });
      // Wait for the calendar list to load (provides the name "Meeting Room A").
      await waitFor(() => {
        expect(screen.getByText('Meeting Room A')).toBeInTheDocument();
      });
    });

    it('shows empty state messages when all arrays are empty', () => {
      renderEditor();
      expect(screen.getByText('No internal attendees.')).toBeInTheDocument();
      expect(screen.getByText('No external attendees.')).toBeInTheDocument();
      expect(
        screen.getByText('No resource calendars allocated.')
      ).toBeInTheDocument();
    });
  });

  describe('add internal attendee + Save', () => {
    it('adds an internal attendee and sends the full attendances array on Save', async () => {
      const user = userEvent.setup();
      renderEditor({ initialAttendances: [FIXTURE_INTERNAL_ATTENDANCE] });

      // Existing attendee (user_id=10) already visible.
      expect(screen.getByText('User 10')).toBeInTheDocument();

      // Open the member-search combobox and search for the new member.
      await user.click(
        screen.getByRole('combobox', { name: 'Add internal attendee' })
      );
      await user.type(
        screen.getByPlaceholderText('Search by name or email…'),
        'new'
      );

      // Wait for the (debounced) search results and pick the member (id=99).
      await user.click(await screen.findByText('New Member'));

      // The new row should appear (the popover closes on select).
      expect(
        screen.getByRole('button', { name: 'Remove New Member' })
      ).toBeInTheDocument();

      // Click Save.
      await user.click(screen.getByRole('button', { name: 'Save attendees' }));

      await waitFor(() => {
        expect(vi.mocked(calendarEventsPartialUpdate)).toHaveBeenCalledWith(
          expect.objectContaining({
            path: { id: '42' },
            body: expect.objectContaining({
              // Full array: existing (id=10) + new (id=99)
              attendances: expect.arrayContaining([
                expect.objectContaining({ user_id: 10 }),
                expect.objectContaining({ user_id: 99 }),
              ]),
            }),
          })
        );
      });
    });
  });

  describe('remove external attendee + Save', () => {
    it('removes an external attendee and saves without it', async () => {
      const user = userEvent.setup();
      renderEditor({
        initialExternalAttendances: [FIXTURE_EXTERNAL_ATTENDANCE],
      });

      expect(screen.getByText('bob@external.com')).toBeInTheDocument();

      // Remove the external attendee.
      const removeBtn = screen.getByRole('button', {
        name: 'Remove external attendee bob@external.com',
      });
      await user.click(removeBtn);

      expect(screen.queryByText('bob@external.com')).not.toBeInTheDocument();

      // Save.
      await user.click(screen.getByRole('button', { name: 'Save attendees' }));

      await waitFor(() => {
        expect(vi.mocked(calendarEventsPartialUpdate)).toHaveBeenCalledWith(
          expect.objectContaining({
            path: { id: '42' },
            body: expect.objectContaining({
              external_attendances: [],
            }),
          })
        );
      });
    });
  });

  describe('add external attendee + Save', () => {
    it('adds an external attendee and sends it in the body', async () => {
      const user = userEvent.setup();
      renderEditor();

      const nameInput = screen.getByLabelText('External attendee name');
      const emailInput = screen.getByLabelText('External attendee email');

      await user.type(nameInput, 'Carol White');
      await user.type(emailInput, 'carol@example.com');

      await user.click(
        screen.getByRole('button', { name: 'Add external attendee' })
      );

      expect(screen.getByText('carol@example.com')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Save attendees' }));

      await waitFor(() => {
        expect(vi.mocked(calendarEventsPartialUpdate)).toHaveBeenCalledWith(
          expect.objectContaining({
            path: { id: '42' },
            body: expect.objectContaining({
              external_attendances: [
                expect.objectContaining({
                  external_attendee: expect.objectContaining({
                    email: 'carol@example.com',
                    name: 'Carol White',
                  }),
                }),
              ],
            }),
          })
        );
      });
    });
  });

  describe('add resource allocation + Save', () => {
    it('adds a resource calendar and sends resource_allocations in the body', async () => {
      const user = userEvent.setup();
      renderEditor();

      // Wait for resource calendars to load (the combobox is disabled until then).
      const selectTrigger = screen.getByRole('combobox', {
        name: 'Add resource calendar',
      });
      await waitFor(() => {
        expect(selectTrigger).toBeEnabled();
      });

      // Open the combobox and choose "Meeting Room B" — selecting adds the row.
      await user.click(selectTrigger);
      await user.click(await screen.findByText('Meeting Room B'));

      // The new allocation row should appear.
      expect(
        screen.getByRole('button', { name: 'Remove resource Meeting Room B' })
      ).toBeInTheDocument();

      // Save.
      await user.click(screen.getByRole('button', { name: 'Save attendees' }));

      await waitFor(() => {
        expect(vi.mocked(calendarEventsPartialUpdate)).toHaveBeenCalledWith(
          expect.objectContaining({
            path: { id: '42' },
            body: expect.objectContaining({
              resource_allocations: [expect.objectContaining({ calendar: 21 })],
            }),
          })
        );
      });
    });
  });

  describe('full round-trip: all three kinds', () => {
    it('sends all three arrays populated after adding each kind', async () => {
      const user = userEvent.setup();
      renderEditor();

      // Add internal attendee via the member-search combobox (id=55).
      await user.click(
        screen.getByRole('combobox', { name: 'Add internal attendee' })
      );
      await user.type(
        screen.getByPlaceholderText('Search by name or email…'),
        'dave'
      );
      await user.click(await screen.findByText('Dave Stone'));

      // Add external attendee.
      await user.type(
        screen.getByLabelText('External attendee email'),
        'dave@example.com'
      );
      await user.click(
        screen.getByRole('button', { name: 'Add external attendee' })
      );

      // Add resource calendar — wait for the list to load, then select.
      const selectTrigger = screen.getByRole('combobox', {
        name: 'Add resource calendar',
      });
      await waitFor(() => {
        expect(selectTrigger).toBeEnabled();
      });
      await user.click(selectTrigger);
      await user.click(await screen.findByText('Meeting Room A'));

      // Save.
      await user.click(screen.getByRole('button', { name: 'Save attendees' }));

      await waitFor(() => {
        const call = vi.mocked(calendarEventsPartialUpdate).mock.calls[0][0];
        expect(call.path).toEqual({ id: '42' });
        expect(call.body?.attendances).toHaveLength(1);
        expect(call.body?.attendances?.[0]).toMatchObject({ user_id: 55 });
        expect(call.body?.external_attendances).toHaveLength(1);
        expect(call.body?.external_attendances?.[0]).toMatchObject({
          external_attendee: expect.objectContaining({
            email: 'dave@example.com',
          }),
        });
        expect(call.body?.resource_allocations).toHaveLength(1);
        expect(call.body?.resource_allocations?.[0]).toMatchObject({
          calendar: 20,
        });
      });
    });
  });

  describe('toast feedback', () => {
    it('shows a success toast after a successful save', async () => {
      const user = userEvent.setup();
      renderEditor();

      await user.click(screen.getByRole('button', { name: 'Save attendees' }));

      await waitFor(() => {
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
          'Attendees updated'
        );
      });
    });

    it('shows an error toast when the API call fails', async () => {
      vi.mocked(calendarEventsPartialUpdate).mockRejectedValue(
        new Error('Server error')
      );

      const user = userEvent.setup();
      renderEditor();

      await user.click(screen.getByRole('button', { name: 'Save attendees' }));

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
          'Failed to update attendees',
          expect.objectContaining({ description: 'Server error' })
        );
      });
    });
  });
});
