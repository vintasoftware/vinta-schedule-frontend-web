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
  usePathname: () => '/resources',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock the sdk.gen boundary — intercepts calendarResourceCreate.
vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarResourceCreate: vi.fn(),
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
import { calendarResourceCreate } from '@/client/sdk.gen';
import { toast } from 'sonner';
import { CreateResourceCalendarDialog } from './create-resource-calendar-dialog';

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

function renderDialog(
  open = true,
  onOpenChange = vi.fn(),
  onCreated = vi.fn()
) {
  const queryClient = makeQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return {
    ...render(
      <CreateResourceCalendarDialog
        open={open}
        onOpenChange={onOpenChange}
        onCreated={onCreated}
      />,
      { wrapper }
    ),
    queryClient,
    onOpenChange,
    onCreated,
  };
}

// Build a create response with a resource calendar object.
function makeCreateResponse(
  name: string,
  id = 7
): Awaited<ReturnType<typeof calendarResourceCreate>> {
  const calendar: Calendar = {
    id,
    name,
    description: '',
    email: `resource-${id}@example.com`,
    external_id: '',
    calendar_type: 'resource',
    provider: 'internal',
    visibility: 'active',
    capacity: null,
  };
  return {
    data: calendar,
    response: new Response(JSON.stringify(calendar), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof calendarResourceCreate>>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CreateResourceCalendarDialog', () => {
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

      await user.click(
        screen.getByRole('button', { name: /create resource calendar/i })
      );

      await waitFor(() => {
        expect(
          screen.getByText(/resource name is required/i)
        ).toBeInTheDocument();
      });

      expect(vi.mocked(calendarResourceCreate)).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  describe('create — happy path', () => {
    it('sends name + capacity + manage_available_windows and closes', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const onCreated = vi.fn();

      vi.mocked(calendarResourceCreate).mockResolvedValue(
        makeCreateResponse('Conference Room A')
      );

      renderDialog(true, onOpenChange, onCreated);

      await user.type(
        screen.getByLabelText(/resource name/i),
        'Conference Room A'
      );
      await user.type(screen.getByLabelText(/capacity/i), '20');
      await user.click(
        screen.getByRole('switch', { name: /manage availability windows/i })
      );
      await user.click(
        screen.getByRole('button', { name: /create resource calendar/i })
      );

      await waitFor(() => {
        expect(vi.mocked(calendarResourceCreate)).toHaveBeenCalledOnce();
      });

      const body = vi.mocked(calendarResourceCreate).mock.calls[0][0]?.body;
      expect(body?.name).toBe('Conference Room A');
      expect(body?.capacity).toBe(20);
      expect(body?.manage_available_windows).toBe(true);

      expect(onCreated).toHaveBeenCalledOnce();
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'Resource calendar created',
        expect.objectContaining({
          description: expect.stringContaining('Conference Room A'),
        })
      );
    });

    it('omits capacity and description when left empty', async () => {
      const user = userEvent.setup();

      vi.mocked(calendarResourceCreate).mockResolvedValue(
        makeCreateResponse('Projector')
      );

      renderDialog();

      await user.type(screen.getByLabelText(/resource name/i), 'Projector');
      await user.click(
        screen.getByRole('button', { name: /create resource calendar/i })
      );

      await waitFor(() => {
        expect(vi.mocked(calendarResourceCreate)).toHaveBeenCalledOnce();
      });

      const body = vi.mocked(calendarResourceCreate).mock.calls[0][0]?.body;
      expect(body?.name).toBe('Projector');
      expect(body).not.toHaveProperty('capacity');
      expect(body).not.toHaveProperty('description');
      // manage_available_windows is always sent (defaults to false).
      expect(body?.manage_available_windows).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Submit disabled while pending
  // -------------------------------------------------------------------------

  describe('submit disabled while pending', () => {
    it('disables the submit button while the mutation is pending', async () => {
      const user = userEvent.setup();

      vi.mocked(calendarResourceCreate).mockReturnValue(
        new Promise(() => {}) as never
      );

      renderDialog();

      await user.type(screen.getByLabelText(/resource name/i), 'Pending Room');
      await user.click(
        screen.getByRole('button', { name: /create resource calendar/i })
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Dialog rendering
  // -------------------------------------------------------------------------

  describe('dialog rendering', () => {
    it('renders the title when open', () => {
      renderDialog(true);
      expect(
        screen.getByText('Create a resource calendar')
      ).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      renderDialog(false);
      expect(
        screen.queryByText('Create a resource calendar')
      ).not.toBeInTheDocument();
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
    it('shows error toast when creation fails and keeps the dialog open', async () => {
      const user = userEvent.setup();

      vi.mocked(calendarResourceCreate).mockRejectedValue(
        new Error('Network error')
      );

      renderDialog();

      await user.type(screen.getByLabelText(/resource name/i), 'Failed Room');
      await user.click(
        screen.getByRole('button', { name: /create resource calendar/i })
      );

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
          'Failed to create resource calendar',
          expect.objectContaining({ description: 'Network error' })
        );
      });

      expect(
        screen.getByText('Create a resource calendar')
      ).toBeInTheDocument();
    });
  });
});
