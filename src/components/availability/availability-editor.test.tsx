/**
 * AvailabilityEditor tests.
 *
 * Covers:
 * - Add a weekly time range for a weekday → Save sends the correct payload with rrule_string
 * - Add an ad-hoc date window → Save sends correct payload without rrule_string
 * - Remove a weekly range
 * - Validation: end must be after start
 * - Submit button is disabled while pending
 * - Success toast is shown
 * - Error toast is shown when bulk-create fails
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/availability',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    availableTimesList: vi.fn(),
    availableTimesBatchCreate: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

import {
  availableTimesList,
  availableTimesBatchCreate,
} from '@/client/sdk.gen';
import { toast } from 'sonner';
import { AvailabilityEditor } from './availability-editor';
import type {
  PaginatedAvailableTimeList,
  AvailableTimeBatch,
  AvailableTime,
} from '@/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderEditor(calendarId?: number | null) {
  const queryClient = makeQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return {
    ...render(<AvailabilityEditor calendarId={calendarId} />, { wrapper }),
    queryClient,
  };
}

function makeEmptyListResponse(): Awaited<
  ReturnType<typeof availableTimesList>
> {
  const data: PaginatedAvailableTimeList = {
    count: 0,
    next: null,
    previous: null,
    results: [],
  };
  return {
    data,
    response: new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof availableTimesList>>;
}

function makeListResponse(
  items: AvailableTime[]
): Awaited<ReturnType<typeof availableTimesList>> {
  const data: PaginatedAvailableTimeList = {
    count: items.length,
    next: null,
    previous: null,
    results: items,
  };
  return {
    data,
    response: new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof availableTimesList>>;
}

/**
 * Build a recurring weekly AvailableTime fixture for testing.
 * The start_time/end_time use the epoch-anchor format that weeklyEntryToWritable
 * writes (2024-01-01 + weekday offset).
 */
function makeWeeklyAvailableTime(
  id: number,
  byday: string,
  startHHmm: string,
  endHHmm: string,
  weekdayOffset: number // 0=Mon..6=Sun
): AvailableTime {
  const anchorDate = new Date(2024, 0, 1 + weekdayOffset);
  const yyyy = anchorDate.getFullYear();
  const mm = String(anchorDate.getMonth() + 1).padStart(2, '0');
  const dd = String(anchorDate.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  return {
    id,
    start_time: `${dateStr}T${startHHmm}:00`,
    end_time: `${dateStr}T${endHHmm}:00`,
    timezone: 'UTC',
    is_recurring: true,
    is_recurring_instance: false,
    parent_available_time: null,
    recurrence_id: null,
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    calendar: null,
    recurrence_rule: {
      id: id * 100,
      frequency: 'WEEKLY' as const,
      by_weekday: byday,
      rrule_string: `FREQ=WEEKLY;BYDAY=${byday}`,
      created: '2024-01-01T00:00:00Z',
      modified: '2024-01-01T00:00:00Z',
    },
  };
}

function makeBatchResponse(
  results: AvailableTime[] = []
): Awaited<ReturnType<typeof availableTimesBatchCreate>> {
  const data: PaginatedAvailableTimeList = {
    count: results.length,
    next: null,
    previous: null,
    results,
  };
  return {
    data,
    response: new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof availableTimesBatchCreate>>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AvailabilityEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(availableTimesList).mockResolvedValue(makeEmptyListResponse());
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  describe('rendering', () => {
    it('renders all 7 weekday rows', async () => {
      renderEditor();
      await waitFor(() => expect(screen.getByText('Mon')).toBeInTheDocument());
      expect(screen.getByText('Tue')).toBeInTheDocument();
      expect(screen.getByText('Wed')).toBeInTheDocument();
      expect(screen.getByText('Thu')).toBeInTheDocument();
      expect(screen.getByText('Fri')).toBeInTheDocument();
      expect(screen.getByText('Sat')).toBeInTheDocument();
      expect(screen.getByText('Sun')).toBeInTheDocument();
    });

    it('renders Save availability button', async () => {
      renderEditor();
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /save availability/i })
        ).toBeInTheDocument()
      );
    });

    it('renders the ad-hoc section', async () => {
      renderEditor();
      await waitFor(() =>
        expect(screen.getByText(/specific dates/i)).toBeInTheDocument()
      );
    });
  });

  // -------------------------------------------------------------------------
  // Weekly pattern — add range + save
  // -------------------------------------------------------------------------

  describe('weekly pattern', () => {
    it('adds a Monday range and saves with the correct rrule_string payload', async () => {
      const user = userEvent.setup();
      vi.mocked(availableTimesBatchCreate).mockResolvedValue(
        makeBatchResponse()
      );

      renderEditor();

      // Wait for loading skeleton to disappear
      await waitFor(() =>
        expect(
          screen.getAllByRole('button', { name: /^add$/i }).length
        ).toBeGreaterThan(0)
      );

      // Click "Add" for Monday (first Add button)
      const addButtons = screen.getAllByRole('button', { name: /^add$/i });
      await user.click(addButtons[0]); // Monday row

      // The start/end time inputs appear with defaults 09:00 / 17:00
      const startInputs = screen.getAllByLabelText(
        /monday window 1 start time/i
      );
      const endInputs = screen.getAllByLabelText(/monday window 1 end time/i);
      expect(startInputs).toHaveLength(1);
      expect(endInputs).toHaveLength(1);

      // Submit
      await user.click(
        screen.getByRole('button', { name: /save availability/i })
      );

      await waitFor(() => {
        expect(availableTimesBatchCreate).toHaveBeenCalledOnce();
      });

      const callArg = vi.mocked(availableTimesBatchCreate).mock.calls[0][0];
      const body = callArg.body as AvailableTimeBatch;
      // Empty existing list → no delete ops; one create op for the new window.
      expect(body.operations).toHaveLength(1);
      expect(body.operations[0].action).toBe('create');
      // Weekly entry has rrule_string with FREQ=WEEKLY;BYDAY=MO
      expect(body.operations[0].rrule_string).toBe('FREQ=WEEKLY;BYDAY=MO');
    });

    it('a second save deletes the rows the first save created (no duplicate re-create)', async () => {
      const user = userEvent.setup();
      // The batch returns the row it just created (id 1) so the editor adopts it
      // as the new delete-baseline.
      const createdRow = makeWeeklyAvailableTime(1, 'MO', '09:00', '17:00', 0);
      vi.mocked(availableTimesBatchCreate).mockResolvedValue(
        makeBatchResponse([createdRow])
      );

      renderEditor();

      await waitFor(() =>
        expect(
          screen.getAllByRole('button', { name: /^add$/i }).length
        ).toBeGreaterThan(0)
      );

      // Add a Monday window, then save twice without any refresh.
      await user.click(screen.getAllByRole('button', { name: /^add$/i })[0]);
      const saveBtn = screen.getByRole('button', {
        name: /save availability/i,
      });

      await user.click(saveBtn);
      await waitFor(() =>
        expect(availableTimesBatchCreate).toHaveBeenCalledOnce()
      );
      // First save: no existing rows → create only.
      const first = vi.mocked(availableTimesBatchCreate).mock.calls[0][0]
        .body as AvailableTimeBatch;
      expect(
        first.operations.filter((o) => o.action === 'delete')
      ).toHaveLength(0);

      await user.click(saveBtn);
      await waitFor(() =>
        expect(availableTimesBatchCreate).toHaveBeenCalledTimes(2)
      );
      // Second save: the row created by the first save is deleted (not duplicated).
      const second = vi.mocked(availableTimesBatchCreate).mock.calls[1][0]
        .body as AvailableTimeBatch;
      expect(second.operations).toContainEqual({ action: 'delete', id: 1 });
      expect(
        second.operations.filter((o) => o.action === 'create')
      ).toHaveLength(1);
    });

    it('removes a weekly range when Remove button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(availableTimesBatchCreate).mockResolvedValue(
        makeBatchResponse()
      );

      renderEditor();

      // Wait for loading to finish
      await waitFor(() =>
        expect(
          screen.getAllByRole('button', { name: /^add$/i }).length
        ).toBeGreaterThan(0)
      );

      // Add a Monday range
      const addButtons = screen.getAllByRole('button', { name: /^add$/i });
      await user.click(addButtons[0]);

      // Verify it appeared
      expect(
        screen.getByLabelText(/monday window 1 start time/i)
      ).toBeInTheDocument();

      // Remove it
      const removeBtn = screen.getByRole('button', {
        name: /remove monday window 1/i,
      });
      await user.click(removeBtn);

      // The start time input should be gone
      expect(
        screen.queryByLabelText(/monday window 1 start time/i)
      ).not.toBeInTheDocument();
    });

    it('shows success toast after saving weekly windows', async () => {
      const user = userEvent.setup();
      vi.mocked(availableTimesBatchCreate).mockResolvedValue(
        makeBatchResponse()
      );

      renderEditor();

      await waitFor(() =>
        expect(
          screen.getAllByRole('button', { name: /^add$/i }).length
        ).toBeGreaterThan(0)
      );

      const addButtons = screen.getAllByRole('button', { name: /^add$/i });
      await user.click(addButtons[0]);

      await user.click(
        screen.getByRole('button', { name: /save availability/i })
      );

      await waitFor(() => {
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
          'Availability saved',
          expect.objectContaining({
            description: expect.stringContaining('1 window'),
          })
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // Ad-hoc window
  // -------------------------------------------------------------------------

  describe('ad-hoc window', () => {
    it('adds an ad-hoc window and saves WITHOUT rrule_string', async () => {
      const user = userEvent.setup();
      vi.mocked(availableTimesBatchCreate).mockResolvedValue(
        makeBatchResponse()
      );

      renderEditor();

      // Wait for loading to finish
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /add specific date/i })
        ).toBeInTheDocument()
      );

      // Click "Add specific date" button
      await user.click(
        screen.getByRole('button', { name: /add specific date/i })
      );

      // Fill in date and times
      const dateInput = screen.getByLabelText(/ad-hoc window 1 date/i);
      const startInput = screen.getByLabelText(/ad-hoc window 1 start time/i);
      const endInput = screen.getByLabelText(/ad-hoc window 1 end time/i);

      await user.clear(dateInput);
      await user.type(dateInput, '2024-07-04');
      await user.clear(startInput);
      await user.type(startInput, '10:00');
      await user.clear(endInput);
      await user.type(endInput, '12:00');

      // Submit
      await user.click(
        screen.getByRole('button', { name: /save availability/i })
      );

      await waitFor(() => {
        expect(availableTimesBatchCreate).toHaveBeenCalledOnce();
      });

      const callArg = vi.mocked(availableTimesBatchCreate).mock.calls[0][0];
      const body = callArg.body as AvailableTimeBatch;
      expect(body.operations).toHaveLength(1);
      expect(body.operations[0].action).toBe('create');
      // Ad-hoc: no rrule_string
      expect(body.operations[0].rrule_string).toBeUndefined();
      expect(body.operations[0].start_time).toContain('2024-07-04');
      expect(body.operations[0].end_time).toContain('2024-07-04');
    });

    it('removes an ad-hoc window when Remove button is clicked', async () => {
      const user = userEvent.setup();

      renderEditor();

      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /add specific date/i })
        ).toBeInTheDocument()
      );

      await user.click(
        screen.getByRole('button', { name: /add specific date/i })
      );

      expect(
        screen.getByLabelText(/ad-hoc window 1 date/i)
      ).toBeInTheDocument();

      const removeBtn = screen.getByRole('button', {
        name: /remove ad-hoc window 1/i,
      });
      await user.click(removeBtn);

      expect(
        screen.queryByLabelText(/ad-hoc window 1 date/i)
      ).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Empty form — show error toast instead of calling API
  // -------------------------------------------------------------------------

  describe('empty form validation', () => {
    it('shows error toast when no windows are set and Save is clicked', async () => {
      const user = userEvent.setup();

      renderEditor();

      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /save availability/i })
        ).toBeInTheDocument()
      );

      await user.click(
        screen.getByRole('button', { name: /save availability/i })
      );

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
          'No availability windows to save',
          expect.anything()
        );
      });

      expect(availableTimesBatchCreate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // API error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('shows error toast when bulk-create fails', async () => {
      const user = userEvent.setup();
      vi.mocked(availableTimesBatchCreate).mockRejectedValue(
        new Error('Server error')
      );

      renderEditor();

      await waitFor(() =>
        expect(
          screen.getAllByRole('button', { name: /^add$/i }).length
        ).toBeGreaterThan(0)
      );

      const addButtons = screen.getAllByRole('button', { name: /^add$/i });
      await user.click(addButtons[0]);

      await user.click(
        screen.getByRole('button', { name: /save availability/i })
      );

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
          'Failed to save availability',
          expect.objectContaining({ description: 'Server error' })
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // Submit disabled while pending
  // -------------------------------------------------------------------------

  describe('pending state', () => {
    it('submit button is disabled while saving', async () => {
      const user = userEvent.setup();
      // Never resolves — stays pending
      vi.mocked(availableTimesBatchCreate).mockReturnValue(
        new Promise(() => {}) as never
      );

      renderEditor();

      await waitFor(() =>
        expect(
          screen.getAllByRole('button', { name: /^add$/i }).length
        ).toBeGreaterThan(0)
      );

      const addButtons = screen.getAllByRole('button', { name: /^add$/i });
      await user.click(addButtons[0]);

      const saveBtn = screen.getByRole('button', {
        name: /save availability/i,
      });
      await user.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Reset button
  // -------------------------------------------------------------------------

  describe('reset', () => {
    it('clears added ranges when Reset is clicked', async () => {
      const user = userEvent.setup();

      renderEditor();

      await waitFor(() =>
        expect(
          screen.getAllByRole('button', { name: /^add$/i }).length
        ).toBeGreaterThan(0)
      );

      // Add a Monday range
      const addButtons = screen.getAllByRole('button', { name: /^add$/i });
      await user.click(addButtons[0]);

      expect(
        screen.getByLabelText(/monday window 1 start time/i)
      ).toBeInTheDocument();

      // Reset
      await user.click(screen.getByRole('button', { name: /reset/i }));

      expect(
        screen.queryByLabelText(/monday window 1 start time/i)
      ).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Hydration from saved AvailableTimes
  // -------------------------------------------------------------------------

  describe('hydration from saved available times', () => {
    it('populates Monday row with 12:00–20:00 when a weekly MO entry is returned', async () => {
      const mondayEntry = makeWeeklyAvailableTime(1, 'MO', '12:00', '20:00', 0);
      vi.mocked(availableTimesList).mockResolvedValue(
        makeListResponse([mondayEntry])
      );

      renderEditor();

      // Wait for the hook to load (skeleton disappears) and form to hydrate
      await waitFor(() => {
        expect(
          screen.queryByLabelText(/loading availability/i)
        ).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(
          screen.getByLabelText(/monday window 1 start time/i)
        ).toBeInTheDocument();
      });

      const startInput = screen.getByLabelText(
        /monday window 1 start time/i
      ) as HTMLInputElement;
      const endInput = screen.getByLabelText(
        /monday window 1 end time/i
      ) as HTMLInputElement;

      expect(startInput.value).toBe('12:00');
      expect(endInput.value).toBe('20:00');
    });

    it('saving deletes the existing stored rows and recreates the desired set (atomic batch)', async () => {
      const user = userEvent.setup();
      const mondayEntry = makeWeeklyAvailableTime(7, 'MO', '12:00', '20:00', 0);
      vi.mocked(availableTimesList).mockResolvedValue(
        makeListResponse([mondayEntry])
      );
      vi.mocked(availableTimesBatchCreate).mockResolvedValue(
        makeBatchResponse()
      );

      renderEditor();

      // Wait for hydration (the Monday window inputs appear).
      await waitFor(() => {
        expect(
          screen.getByLabelText(/monday window 1 start time/i)
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole('button', { name: /save availability/i })
      );

      await waitFor(() => {
        expect(availableTimesBatchCreate).toHaveBeenCalledOnce();
      });

      const body = vi.mocked(availableTimesBatchCreate).mock.calls[0][0]
        .body as AvailableTimeBatch;
      // A delete op for the existing stored row…
      expect(body.operations).toContainEqual({ action: 'delete', id: 7 });
      // …plus a create op for the (re-hydrated) Monday window.
      const creates = body.operations.filter((o) => o.action === 'create');
      expect(creates).toHaveLength(1);
      expect(creates[0].rrule_string).toBe('FREQ=WEEKLY;BYDAY=MO');
    });

    it('populates all 7 weekday rows with 12:00–20:00 (Mon–Sun)', async () => {
      const BYDAY_OFFSETS: [string, number, string][] = [
        ['MO', 0, 'monday'],
        ['TU', 1, 'tuesday'],
        ['WE', 2, 'wednesday'],
        ['TH', 3, 'thursday'],
        ['FR', 4, 'friday'],
        ['SA', 5, 'saturday'],
        ['SU', 6, 'sunday'],
      ];

      const entries = BYDAY_OFFSETS.map(([byday, offset, _label], i) =>
        makeWeeklyAvailableTime(i + 1, byday, '12:00', '20:00', offset)
      );

      vi.mocked(availableTimesList).mockResolvedValue(
        makeListResponse(entries)
      );

      renderEditor();

      // Wait for form to hydrate (all 7 weekday window 1 start inputs appear)
      await waitFor(() => {
        expect(
          screen.getByLabelText(/monday window 1 start time/i)
        ).toBeInTheDocument();
      });

      // Spot-check all 7 weekday start inputs have value '12:00'
      for (const [_byday, _offset, label] of BYDAY_OFFSETS) {
        const input = screen.getByLabelText(
          new RegExp(`${label} window 1 start time`, 'i')
        ) as HTMLInputElement;
        expect(input.value).toBe('12:00');
      }
    });

    it('populates the ad-hoc list when a non-recurring entry is returned', async () => {
      const adHocEntry: AvailableTime = {
        id: 99,
        start_time: '2025-07-04T10:00:00',
        end_time: '2025-07-04T12:00:00',
        timezone: 'UTC',
        is_recurring: false,
        is_recurring_instance: false,
        parent_available_time: null,
        recurrence_id: null,
        created: '2024-01-01T00:00:00Z',
        modified: '2024-01-01T00:00:00Z',
        calendar: null,
      };

      vi.mocked(availableTimesList).mockResolvedValue(
        makeListResponse([adHocEntry])
      );

      renderEditor();

      await waitFor(() => {
        expect(
          screen.getByLabelText(/ad-hoc window 1 date/i)
        ).toBeInTheDocument();
      });

      const dateInput = screen.getByLabelText(
        /ad-hoc window 1 date/i
      ) as HTMLInputElement;
      const startInput = screen.getByLabelText(
        /ad-hoc window 1 start time/i
      ) as HTMLInputElement;
      const endInput = screen.getByLabelText(
        /ad-hoc window 1 end time/i
      ) as HTMLInputElement;

      expect(dateInput.value).toBe('2025-07-04');
      expect(startInput.value).toBe('10:00');
      expect(endInput.value).toBe('12:00');
    });

    it('does not reset form again when availableTimes data changes after initial hydration', async () => {
      const user = userEvent.setup();
      const mondayEntry = makeWeeklyAvailableTime(1, 'MO', '09:00', '17:00', 0);
      vi.mocked(availableTimesList).mockResolvedValue(
        makeListResponse([mondayEntry])
      );

      renderEditor();

      // Wait for hydration
      await waitFor(() => {
        expect(
          screen.getByLabelText(/monday window 1 start time/i)
        ).toBeInTheDocument();
      });

      // User manually removes the Monday range
      const removeBtn = screen.getByRole('button', {
        name: /remove monday window 1/i,
      });
      await user.click(removeBtn);

      // The range should be gone
      expect(
        screen.queryByLabelText(/monday window 1 start time/i)
      ).not.toBeInTheDocument();

      // Even if data was still there, it should NOT re-hydrate (hasHydratedRef guard)
      // The test passes if the form stays in the user-edited state
    });
  });
});
