/**
 * PoolsTable tests.
 *
 * Covers:
 * - Rendering a pool's name, description, and roster size + preview.
 * - Deleting a pool that nothing references: confirm → API call → success toast.
 * - Deleting a pool that IS referenced: the 409 keeps the dialog open and names
 *   the blocking appointment types on screen (rather than toasting them away), and the
 *   confirm button stops offering a retry that would only fail again.
 * - A non-409 delete failure falls through to the generic error toast.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

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
});

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/pools',
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarPoolsList: vi.fn(),
    calendarPoolsDestroy: vi.fn(),
    calendarList: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import {
  calendarPoolsList,
  calendarPoolsDestroy,
  calendarList,
} from '@/client/sdk.gen';
import { toast } from 'sonner';
import { PoolsTable } from './pools-table';
import type { Calendar, CalendarPool } from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function cal(id: number, name: string): Calendar {
  return {
    id,
    name,
    email: `c${id}@x.com`,
    external_id: `e${id}`,
    provider: 'internal',
    calendar_type: 'personal',
  } as Calendar;
}

const POOL_NURSES: CalendarPool = {
  id: 7,
  name: 'Nurses',
  description: 'Ward staff',
  calendars: [cal(1, 'Alice'), cal(2, 'Bob')],
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
};

function mockPoolList(pools: CalendarPool[] = [POOL_NURSES]) {
  vi.mocked(calendarPoolsList).mockResolvedValue({
    data: { count: pools.length, results: pools },
    response: new Response('{}', { status: 200 }),
  } as unknown as Awaited<ReturnType<typeof calendarPoolsList>>);
}

function renderTable() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<PoolsTable />, { wrapper });
}

/** Open a pool row's delete confirmation and click through it. */
async function confirmDelete(
  user: ReturnType<typeof userEvent.setup>,
  poolName: string
) {
  await user.click(
    screen.getByRole('button', {
      name: new RegExp(`delete pool ${poolName}`, 'i'),
    })
  );
  const dialog = await screen.findByRole('alertdialog');
  await user.click(within(dialog).getByRole('button', { name: /^delete$/i }));
  return dialog;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PoolsTable', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    vi.clearAllMocks();
    mockPoolList();
    vi.mocked(calendarList).mockResolvedValue({
      data: { count: 0, results: [] },
      response: new Response('{}', { status: 200 }),
    } as unknown as Awaited<ReturnType<typeof calendarList>>);
  });

  it('renders a pool with its description and roster preview', async () => {
    renderTable();

    expect(await screen.findByText('Nurses')).toBeInTheDocument();
    expect(screen.getByText('Ward staff')).toBeInTheDocument();
    // Roster size badge plus the names it holds.
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Alice, Bob')).toBeInTheDocument();
  });

  it('shows the empty state when the org has no pools', async () => {
    mockPoolList([]);
    renderTable();

    expect(
      await screen.findByText(/no calendar pools yet/i)
    ).toBeInTheDocument();
  });

  it('deletes an unreferenced pool and toasts success', async () => {
    const user = userEvent.setup();
    vi.mocked(calendarPoolsDestroy).mockResolvedValue({
      data: undefined,
      response: new Response(null, { status: 204 }),
    } as unknown as Awaited<ReturnType<typeof calendarPoolsDestroy>>);

    renderTable();
    await screen.findByText('Nurses');

    await confirmDelete(user, 'Nurses');

    await waitFor(() => {
      expect(vi.mocked(calendarPoolsDestroy).mock.calls[0]?.[0]?.path).toEqual({
        id: '7',
      });
    });
    expect(toast.success).toHaveBeenCalledWith('Calendar pool deleted');
  });

  it('keeps the confirmation open and names the blocking appointment types when the delete is refused', async () => {
    const user = userEvent.setup();
    vi.mocked(calendarPoolsDestroy).mockRejectedValue({
      detail: 'Pool is still attached to an appointment type slot.',
      appointment_types: ['Clinic Appointments', 'Follow-ups'],
    });

    renderTable();
    await screen.findByText('Nurses');

    await confirmDelete(user, 'Nurses');

    const blocked = await screen.findByTestId('pool-delete-blocked');
    expect(blocked).toHaveTextContent('Clinic Appointments, Follow-ups');

    // The appointment type names stay on screen instead of being toasted away, and the
    // confirm button no longer offers a retry that can only fail again.
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: /^delete$/i,
      })
    ).toBeDisabled();
  });

  it('falls back to the generic error toast for a non-409 failure', async () => {
    const user = userEvent.setup();
    vi.mocked(calendarPoolsDestroy).mockRejectedValue(
      new Error('Server error')
    );

    renderTable();
    await screen.findByText('Nurses');

    await confirmDelete(user, 'Nurses');

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to delete calendar pool',
        expect.objectContaining({ description: 'Server error' })
      );
    });
    expect(screen.queryByTestId('pool-delete-blocked')).not.toBeInTheDocument();
  });

  it('opens the edit dialog prefilled with the row it was given', async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByText('Nurses');

    await user.click(screen.getByRole('button', { name: /edit pool nurses/i }));

    expect(await screen.findByText('Edit calendar pool')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Nurses')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ward staff')).toBeInTheDocument();
  });
});
