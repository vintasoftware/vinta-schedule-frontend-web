/**
 * PoolDialog tests.
 *
 * Covers:
 * - Create mode: name + roster → POST body, success toast, dialog closes.
 * - Edit mode: prefilled from the pool, and the roster is PATCHed as a whole
 *   list (the API replaces it wholesale rather than applying a delta).
 * - Validation: a pool with no calendars is blocked before any request.
 * - Server field errors land on their input rather than in a toast.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarList: vi.fn(),
    calendarPoolsCreate: vi.fn(),
    calendarPoolsPartialUpdate: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import {
  calendarList,
  calendarPoolsCreate,
  calendarPoolsPartialUpdate,
} from '@/client/sdk.gen';
import { toast } from 'sonner';
import { PoolDialog } from './pool-dialog';
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

const CAL_A = cal(1, 'Alice');
const CAL_B = cal(2, 'Bob');
const CAL_C = cal(3, 'Carol');

const POOL_NURSES: CalendarPool = {
  id: 7,
  name: 'Nurses',
  description: 'Ward staff',
  calendars: [CAL_A, CAL_B],
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
};

function renderDialog(pool: CalendarPool | null = null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const onOpenChange = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const result = render(
    <PoolDialog open onOpenChange={onOpenChange} pool={pool} />,
    { wrapper }
  );
  return { ...result, onOpenChange };
}

/** Toggle calendars in the roster combobox, then close its popover. */
async function pickCalendars(
  user: ReturnType<typeof userEvent.setup>,
  names: string[]
) {
  await user.click(screen.getByRole('combobox', { name: /calendars/i }));
  for (const name of names) {
    await user.click(await screen.findByRole('option', { name }));
  }
  await user.keyboard('{Escape}');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PoolDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(calendarList).mockResolvedValue({
      data: { count: 3, results: [CAL_A, CAL_B, CAL_C] },
      response: new Response('{}', { status: 200 }),
    } as unknown as Awaited<ReturnType<typeof calendarList>>);
    vi.mocked(calendarPoolsCreate).mockResolvedValue({
      data: POOL_NURSES,
      response: new Response('{}', { status: 201 }),
    } as unknown as Awaited<ReturnType<typeof calendarPoolsCreate>>);
    vi.mocked(calendarPoolsPartialUpdate).mockResolvedValue({
      data: POOL_NURSES,
      response: new Response('{}', { status: 200 }),
    } as unknown as Awaited<ReturnType<typeof calendarPoolsPartialUpdate>>);
  });

  it('creates a pool with the calendars picked', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();

    expect(screen.getByText('New calendar pool')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('e.g. Nurses'), 'Nurses');
    await user.type(
      screen.getByPlaceholderText('What is this pool used for?'),
      'Ward staff'
    );
    await pickCalendars(user, ['Alice', 'Bob']);

    await user.click(screen.getByTestId('pool-submit'));

    await waitFor(() => {
      expect(calendarPoolsCreate).toHaveBeenCalledOnce();
    });
    expect(vi.mocked(calendarPoolsCreate).mock.calls[0]?.[0]?.body).toEqual({
      name: 'Nurses',
      description: 'Ward staff',
      calendar_ids: [1, 2],
    });
    expect(toast.success).toHaveBeenCalledWith(
      'Calendar pool created',
      expect.objectContaining({
        description: expect.stringContaining('Nurses'),
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('blocks a pool with no calendars before any request', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByPlaceholderText('e.g. Nurses'), 'Empty');
    await user.click(screen.getByTestId('pool-submit'));

    expect(
      await screen.findByText(/a pool needs at least one calendar/i)
    ).toBeInTheDocument();
    expect(calendarPoolsCreate).not.toHaveBeenCalled();
  });

  it('prefills from the pool being edited and PATCHes the whole replacement roster', async () => {
    const user = userEvent.setup();
    renderDialog(POOL_NURSES);

    expect(screen.getByText('Edit calendar pool')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Nurses')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ward staff')).toBeInTheDocument();

    // Drop Bob, add Carol. The API replaces the roster wholesale, so the body
    // must carry the full resulting list — not just the difference.
    await pickCalendars(user, ['Bob', 'Carol']);

    await user.click(screen.getByTestId('pool-submit'));

    await waitFor(() => {
      expect(calendarPoolsPartialUpdate).toHaveBeenCalledOnce();
    });
    const call = vi.mocked(calendarPoolsPartialUpdate).mock.calls[0]?.[0];
    expect(call?.path).toEqual({ id: '7' });
    expect(call?.body).toEqual({
      name: 'Nurses',
      description: 'Ward staff',
      calendar_ids: [1, 3],
    });
  });

  it('warns in edit mode that the roster is shared across appointment types', () => {
    renderDialog(POOL_NURSES);

    expect(screen.getByText('This roster is shared')).toBeInTheDocument();
  });

  it('does not show the shared-roster warning in create mode', () => {
    renderDialog();

    expect(screen.queryByText('This roster is shared')).not.toBeInTheDocument();
  });

  it('puts a server field error on its input instead of in a toast', async () => {
    const user = userEvent.setup();
    vi.mocked(calendarPoolsCreate).mockRejectedValueOnce({
      name: ['A pool with this name already exists.'],
    });
    renderDialog();

    await user.type(screen.getByPlaceholderText('e.g. Nurses'), 'Nurses');
    await pickCalendars(user, ['Alice']);
    await user.click(screen.getByTestId('pool-submit'));

    expect(
      await screen.findByText('A pool with this name already exists.')
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
