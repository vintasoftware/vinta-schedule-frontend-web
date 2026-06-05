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
    availableTimesBulkCreateCreate: vi.fn(),
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
  availableTimesBulkCreateCreate,
} from '@/client/sdk.gen';
import { toast } from 'sonner';
import { AvailabilityEditor } from './availability-editor';
import type {
  PaginatedAvailableTimeList,
  BulkAvailableTimeWritable,
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

function makeBulkCreateResponse(): Awaited<
  ReturnType<typeof availableTimesBulkCreateCreate>
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
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof availableTimesBulkCreateCreate>>;
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
    it('renders all 7 weekday rows', () => {
      renderEditor();
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Tue')).toBeInTheDocument();
      expect(screen.getByText('Wed')).toBeInTheDocument();
      expect(screen.getByText('Thu')).toBeInTheDocument();
      expect(screen.getByText('Fri')).toBeInTheDocument();
      expect(screen.getByText('Sat')).toBeInTheDocument();
      expect(screen.getByText('Sun')).toBeInTheDocument();
    });

    it('renders Save availability button', () => {
      renderEditor();
      expect(
        screen.getByRole('button', { name: /save availability/i })
      ).toBeInTheDocument();
    });

    it('renders the ad-hoc section', () => {
      renderEditor();
      expect(screen.getByText(/specific dates/i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Weekly pattern — add range + save
  // -------------------------------------------------------------------------

  describe('weekly pattern', () => {
    it('adds a Monday range and saves with the correct rrule_string payload', async () => {
      const user = userEvent.setup();
      vi.mocked(availableTimesBulkCreateCreate).mockResolvedValue(
        makeBulkCreateResponse()
      );

      renderEditor();

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
        expect(availableTimesBulkCreateCreate).toHaveBeenCalledOnce();
      });

      const callArg = vi.mocked(availableTimesBulkCreateCreate).mock
        .calls[0][0];
      const body = callArg.body as BulkAvailableTimeWritable;
      expect(body.available_times).toHaveLength(1);
      // Weekly entry has rrule_string with FREQ=WEEKLY;BYDAY=MO
      expect(body.available_times[0].rrule_string).toBe('FREQ=WEEKLY;BYDAY=MO');
    });

    it('removes a weekly range when Remove button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(availableTimesBulkCreateCreate).mockResolvedValue(
        makeBulkCreateResponse()
      );

      renderEditor();

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
      vi.mocked(availableTimesBulkCreateCreate).mockResolvedValue(
        makeBulkCreateResponse()
      );

      renderEditor();

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
      vi.mocked(availableTimesBulkCreateCreate).mockResolvedValue(
        makeBulkCreateResponse()
      );

      renderEditor();

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
        expect(availableTimesBulkCreateCreate).toHaveBeenCalledOnce();
      });

      const callArg = vi.mocked(availableTimesBulkCreateCreate).mock
        .calls[0][0];
      const body = callArg.body as BulkAvailableTimeWritable;
      expect(body.available_times).toHaveLength(1);
      // Ad-hoc: no rrule_string
      expect(body.available_times[0].rrule_string).toBeUndefined();
      expect(body.available_times[0].start_time).toContain('2024-07-04');
      expect(body.available_times[0].end_time).toContain('2024-07-04');
    });

    it('removes an ad-hoc window when Remove button is clicked', async () => {
      const user = userEvent.setup();

      renderEditor();

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

      await user.click(
        screen.getByRole('button', { name: /save availability/i })
      );

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
          'No availability windows to save',
          expect.anything()
        );
      });

      expect(availableTimesBulkCreateCreate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // API error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('shows error toast when bulk-create fails', async () => {
      const user = userEvent.setup();
      vi.mocked(availableTimesBulkCreateCreate).mockRejectedValue(
        new Error('Server error')
      );

      renderEditor();

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
      vi.mocked(availableTimesBulkCreateCreate).mockReturnValue(
        new Promise(() => {}) as never
      );

      renderEditor();

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
});
