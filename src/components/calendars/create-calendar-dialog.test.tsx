import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Calendar } from '@/client';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

// Mock next/navigation (not needed by this component but required by deps).
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/calendars',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock the sdk.gen boundary — intercepts calendarCreate.
vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarCreate: vi.fn(),
  };
});

// Mock sonner — prevent missing Toaster context errors in tests.
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// After mocks are hoisted, import modules under test.
import { calendarCreate } from '@/client/sdk.gen';
import { toast } from 'sonner';
import { CreateCalendarDialog } from './create-calendar-dialog';

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

function renderDialog(open = true, onOpenChange = vi.fn()) {
  const queryClient = makeQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return {
    ...render(
      <CreateCalendarDialog open={open} onOpenChange={onOpenChange} />,
      {
        wrapper,
      }
    ),
    queryClient,
    onOpenChange,
  };
}

// Build a create response with a calendar object.
function makeCreateResponse(
  name: string,
  id = 42
): Awaited<ReturnType<typeof calendarCreate>> {
  const calendar: Calendar = {
    id,
    name,
    description: '',
    email: `calendar-${id}@example.com`,
    external_id: '',
    calendar_type: 'personal',
    provider: 'internal',
    is_active: true,
    capacity: null,
  };
  return {
    data: calendar,
    response: new Response(JSON.stringify(calendar), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof calendarCreate>>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CreateCalendarDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Zod validation
  // -------------------------------------------------------------------------

  describe('zod validation', () => {
    it('does not submit with an empty name', async () => {
      const user = userEvent.setup();
      renderDialog();

      const submitBtn = screen.getByRole('button', {
        name: /create calendar/i,
      });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/calendar name is required/i)
        ).toBeInTheDocument();
      });

      // calendarCreate must NOT have been called.
      expect(vi.mocked(calendarCreate)).not.toHaveBeenCalled();
    });

    it('does not submit with only whitespace in name', async () => {
      const user = userEvent.setup();
      renderDialog();

      const nameInput = screen.getByLabelText(/calendar name/i);
      await user.type(nameInput, '   ');

      const submitBtn = screen.getByRole('button', {
        name: /create calendar/i,
      });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/calendar name is required/i)
        ).toBeInTheDocument();
      });

      expect(vi.mocked(calendarCreate)).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Happy path — create a calendar
  // -------------------------------------------------------------------------

  describe('create — happy path', () => {
    it('calls calendarCreate with the correct body and closes the dialog', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      vi.mocked(calendarCreate).mockResolvedValue(
        makeCreateResponse('My Calendar')
      );

      renderDialog(true, onOpenChange);

      await user.type(screen.getByLabelText(/calendar name/i), 'My Calendar');
      await user.click(
        screen.getByRole('button', { name: /create calendar/i })
      );

      // Wait for the async flow to complete.
      await waitFor(() => {
        expect(vi.mocked(calendarCreate)).toHaveBeenCalledOnce();
      });

      // Verify the body passed to create.
      const createArgs = vi.mocked(calendarCreate).mock.calls[0][0];
      expect(createArgs?.body?.name).toBe('My Calendar');

      // Dialog should close.
      expect(onOpenChange).toHaveBeenCalledWith(false);

      // Success toast.
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'Calendar created',
        expect.objectContaining({
          description: expect.stringContaining('My Calendar'),
        })
      );
    });

    it('includes optional description in the request', async () => {
      const user = userEvent.setup();

      vi.mocked(calendarCreate).mockResolvedValue(
        makeCreateResponse('Work Calendar')
      );

      renderDialog();

      await user.type(screen.getByLabelText(/calendar name/i), 'Work Calendar');
      await user.type(
        screen.getByLabelText(/description/i),
        'Calendar for work events'
      );
      await user.click(
        screen.getByRole('button', { name: /create calendar/i })
      );

      await waitFor(() => {
        expect(vi.mocked(calendarCreate)).toHaveBeenCalledOnce();
      });

      const createArgs = vi.mocked(calendarCreate).mock.calls[0][0];
      expect(createArgs?.body?.name).toBe('Work Calendar');
      expect(createArgs?.body?.description).toBe('Calendar for work events');
    });

    it('does NOT include empty description in the request', async () => {
      const user = userEvent.setup();

      vi.mocked(calendarCreate).mockResolvedValue(
        makeCreateResponse('Simple Calendar')
      );

      renderDialog();

      await user.type(
        screen.getByLabelText(/calendar name/i),
        'Simple Calendar'
      );
      // Leave description empty (already is).
      await user.click(
        screen.getByRole('button', { name: /create calendar/i })
      );

      await waitFor(() => {
        expect(vi.mocked(calendarCreate)).toHaveBeenCalledOnce();
      });

      const createArgs = vi.mocked(calendarCreate).mock.calls[0][0];
      expect(createArgs?.body?.name).toBe('Simple Calendar');
      // description should not be in the body if empty
      expect(createArgs?.body).not.toHaveProperty('description');
    });
  });

  // -------------------------------------------------------------------------
  // Submit disabled while pending
  // -------------------------------------------------------------------------

  describe('submit disabled while pending', () => {
    it('submit button is disabled while the mutation is pending', async () => {
      const user = userEvent.setup();

      // Never resolve — stays pending forever.
      vi.mocked(calendarCreate).mockReturnValue(new Promise(() => {}) as never);

      renderDialog();

      await user.type(
        screen.getByLabelText(/calendar name/i),
        'Pending Calendar'
      );

      const submitBtn = screen.getByRole('button', {
        name: /create calendar/i,
      });
      await user.click(submitBtn);

      // After first click the button text changes to "Creating…" and is disabled.
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /creating/i });
        expect(btn).toBeDisabled();
      });
    });

    it('double-clicking submit does not call calendarCreate more than once', async () => {
      const user = userEvent.setup();

      // Simulate a slow create so both clicks happen while isPending is true.
      let resolveCreate!: (
        v: Awaited<ReturnType<typeof calendarCreate>>
      ) => void;
      const createPromise = new Promise<
        Awaited<ReturnType<typeof calendarCreate>>
      >((res) => {
        resolveCreate = res;
      });
      vi.mocked(calendarCreate).mockReturnValue(createPromise as never);

      renderDialog();

      await user.type(
        screen.getByLabelText(/calendar name/i),
        'Double Click Calendar'
      );

      const submitBtn = screen.getByRole('button', {
        name: /create calendar/i,
      });

      // First click — starts the create, button becomes disabled.
      await user.click(submitBtn);

      // Verify button is disabled (isPending guard active).
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /creating/i })
        ).toBeDisabled();
      });

      // Second click — button is disabled so userEvent won't fire the handler.
      await user.click(screen.getByRole('button', { name: /creating/i }));

      // Now resolve the create.
      resolveCreate(makeCreateResponse('Double Click Calendar'));

      await waitFor(() => {
        expect(vi.mocked(calendarCreate)).toHaveBeenCalledTimes(1);
      });

      // The critical assertion — create was called at most once.
      expect(vi.mocked(calendarCreate)).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Dialog open/close
  // -------------------------------------------------------------------------

  describe('dialog rendering', () => {
    it('renders the dialog title when open', () => {
      vi.mocked(calendarCreate).mockResolvedValue(
        makeCreateResponse('Test Calendar')
      );
      renderDialog(true);
      expect(screen.getByText('Create a calendar')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      renderDialog(false);
      expect(screen.queryByText('Create a calendar')).not.toBeInTheDocument();
    });

    it('cancel button calls onOpenChange(false)', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      renderDialog(true, onOpenChange);

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('shows error toast when creation fails', async () => {
      const user = userEvent.setup();

      const error = new Error('Network error');
      vi.mocked(calendarCreate).mockRejectedValue(error);

      renderDialog();

      await user.type(
        screen.getByLabelText(/calendar name/i),
        'Failed Calendar'
      );
      await user.click(
        screen.getByRole('button', { name: /create calendar/i })
      );

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
          'Failed to create calendar',
          expect.objectContaining({
            description: 'Network error',
          })
        );
      });

      // Dialog should still be open on error.
      expect(screen.getByText('Create a calendar')).toBeInTheDocument();
    });
  });
});
