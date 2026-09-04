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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

function renderEntry(code = 'secret-code', slug?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<PublicBookingEntry code={code} slug={slug} />, {
    wrapper: Wrapper,
  });
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

// The `slug` hop through this component to whichever flow it mounts — the
// entry→flow link in the branded-book chain (`/o/[slug]/book/[code]`) that
// nothing else covers: the branded page's own test mocks `PublicBookingEntry`
// wholesale, and the flow tests pass `slug` directly rather than through
// this component. Both flow modules are mocked here (via `vi.doMock` +
// `vi.resetModules()` + a dynamic re-import, so the earlier describe blocks
// above keep exercising the REAL flows unaffected) purely to observe the
// prop each one receives.
describe('PublicBookingEntry — slug forwarding', () => {
  afterEach(async () => {
    vi.doUnmock('./public-booking-flow');
    vi.doUnmock('./public-group-booking-flow');
    vi.resetModules();
  });

  it("forwards slug='acme' to PublicBookingFlow for a calendar-targeted link", async () => {
    vi.doMock('./public-booking-flow', () => ({
      PublicBookingFlow: ({ code, slug }: { code: string; slug?: string }) => (
        <div data-testid='calendar-flow'>
          <span data-testid='calendar-flow-code'>{code}</span>
          <span data-testid='calendar-flow-slug'>{slug}</span>
        </div>
      ),
    }));
    vi.doMock('./public-group-booking-flow', () => ({
      PublicGroupBookingFlow: () => <div data-testid='group-flow' />,
    }));
    vi.resetModules();

    currentSearch = new URLSearchParams({ target: 'calendar' });
    const { PublicBookingEntry: MockedEntry } =
      await import('./public-booking-entry');

    render(<MockedEntry code='secret-code' slug='acme' />);

    expect(screen.getByTestId('calendar-flow-slug')).toHaveTextContent('acme');
    expect(screen.queryByTestId('group-flow')).not.toBeInTheDocument();
  });

  it("forwards slug='acme' to PublicGroupBookingFlow for a group-targeted link", async () => {
    vi.doMock('./public-booking-flow', () => ({
      PublicBookingFlow: () => <div data-testid='calendar-flow' />,
    }));
    vi.doMock('./public-group-booking-flow', () => ({
      PublicGroupBookingFlow: ({
        code,
        slug,
      }: {
        code: string;
        slug?: string;
      }) => (
        <div data-testid='group-flow'>
          <span data-testid='group-flow-code'>{code}</span>
          <span data-testid='group-flow-slug'>{slug}</span>
        </div>
      ),
    }));
    vi.resetModules();

    currentSearch = new URLSearchParams({ target: 'group' });
    const { PublicBookingEntry: MockedEntry } =
      await import('./public-booking-entry');

    render(<MockedEntry code='secret-code' slug='acme' />);

    expect(screen.getByTestId('group-flow-slug')).toHaveTextContent('acme');
    expect(screen.queryByTestId('calendar-flow')).not.toBeInTheDocument();
  });
});
