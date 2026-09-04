/**
 * PublicBookingEntry tests.
 *
 * The single most important property this phase's routing decision has to
 * prove: the page NEVER issues a speculative read to discover a link's
 * target. `resolveBookingLinkTarget` is pure (covered directly, no network
 * involved at all); the component-level tests then prove that mounting it
 * with a given `?target=` fires EXACTLY the matching flow's read and NEVER
 * the other flow's — no calendar-then-group (or vice versa) probing,
 * regardless of what either read would have returned.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

let currentSearch = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => currentSearch,
}));

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    publicBookingCalendarBookableSlotsList: vi.fn(),
    publicBookingCalendarGroupBookableSlotsList: vi.fn(),
  };
});

import {
  publicBookingCalendarBookableSlotsList,
  publicBookingCalendarGroupBookableSlotsList,
} from '@/client/sdk.gen';
import {
  PublicBookingEntry,
  resolveBookingLinkTarget,
} from './public-booking-entry';

function renderEntry(code = 'secret-code') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<PublicBookingEntry code={code} />, { wrapper: Wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(publicBookingCalendarBookableSlotsList).mockResolvedValue({
    data: [],
    response: new Response(JSON.stringify([]), { status: 200 }),
  } as unknown as Awaited<
    ReturnType<typeof publicBookingCalendarBookableSlotsList>
  >);
  vi.mocked(publicBookingCalendarGroupBookableSlotsList).mockResolvedValue({
    data: [],
    response: new Response(JSON.stringify([]), { status: 200 }),
  } as unknown as Awaited<
    ReturnType<typeof publicBookingCalendarGroupBookableSlotsList>
  >);
});

describe('resolveBookingLinkTarget', () => {
  it('resolves group only for the literal target=group marker', () => {
    expect(
      resolveBookingLinkTarget(new URLSearchParams({ target: 'group' }))
    ).toBe('group');
  });

  it('resolves calendar for an explicit target=calendar marker', () => {
    expect(
      resolveBookingLinkTarget(new URLSearchParams({ target: 'calendar' }))
    ).toBe('calendar');
  });

  it('resolves calendar for a pre-Phase-3 link with duration but no target (back-compat)', () => {
    expect(
      resolveBookingLinkTarget(new URLSearchParams({ duration: '1800' }))
    ).toBe('calendar');
  });

  it('resolves calendar for an empty/malformed/missing target — never guesses group', () => {
    expect(resolveBookingLinkTarget(new URLSearchParams())).toBe('calendar');
    expect(
      resolveBookingLinkTarget(new URLSearchParams({ target: 'nonsense' }))
    ).toBe('calendar');
  });
});

describe('PublicBookingEntry — routing issues no speculative read', () => {
  it('target=group fires ONLY the group read, never the single-calendar read', async () => {
    currentSearch = new URLSearchParams({ target: 'group' });

    renderEntry();

    await waitFor(() =>
      expect(publicBookingCalendarGroupBookableSlotsList).toHaveBeenCalledTimes(
        1
      )
    );
    expect(publicBookingCalendarBookableSlotsList).not.toHaveBeenCalled();
  });

  it('target=calendar fires ONLY the single-calendar read, never the group read', async () => {
    currentSearch = new URLSearchParams({
      target: 'calendar',
      duration: '1800',
    });

    renderEntry();

    await waitFor(() =>
      expect(publicBookingCalendarBookableSlotsList).toHaveBeenCalledTimes(1)
    );
    expect(publicBookingCalendarGroupBookableSlotsList).not.toHaveBeenCalled();
  });

  it('a pre-Phase-3 calendar link (duration, no target) still fires only the calendar read', async () => {
    currentSearch = new URLSearchParams({ duration: '1800' });

    renderEntry();

    await waitFor(() =>
      expect(publicBookingCalendarBookableSlotsList).toHaveBeenCalledTimes(1)
    );
    expect(publicBookingCalendarGroupBookableSlotsList).not.toHaveBeenCalled();
  });
});
