/**
 * BillingPeriodDetailPage (Phase 7) tests.
 *
 * The page unwraps its `[id]` param with React's `use()` and reads
 * `useBillingPeriod(id)`, which is mocked. Two behaviors matter:
 *
 *   • a resolved statement renders EVERY resource row in its breakdown;
 *   • an out-of-pool / missing pk answers 404 (the non-disclosure
 *     `{ detail: "Not found." }` body), which renders the not-found state —
 *     never a crash.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Suspense, type ReactNode } from 'react';

import type { BillingPeriodSummaryDetail } from '@/client';

vi.mock('@/hooks/billing/use-billing-period', () => ({
  useBillingPeriod: vi.fn(),
}));

import { useBillingPeriod } from '@/hooks/billing/use-billing-period';
import BillingPeriodDetailPage from './page';

const DETAIL: BillingPeriodSummaryDetail = {
  id: 42,
  billing_period_start: '2026-06-01T00:00:00Z',
  billing_period_end: '2026-07-01T00:00:00Z',
  plan_slug: 'team',
  plan_name: 'Team',
  billing_interval: 'monthly',
  currency: 'USD',
  overage_total: '12.5000',
  charged: true,
  payment_id: 1001,
  closed_at: '2026-07-01T02:00:00Z',
  resources: [
    {
      resource_key: 'event_occurrences',
      kind: 'postpaid',
      total: 125,
      limit_value: 100,
      overage_unit_price: '0.5000',
      by_organization: [],
    },
    {
      resource_key: 'organization_members',
      kind: 'prepaid',
      total: 0,
      limit_value: 10,
      overage_unit_price: null,
      by_organization: [],
    },
    {
      resource_key: 'calendar_groups',
      kind: 'prepaid',
      total: null,
      limit_value: null,
      overage_unit_price: null,
      by_organization: [],
    },
  ],
};

type PeriodHookReturn = ReturnType<typeof useBillingPeriod>;

function mockPeriod(overrides: Partial<PeriodHookReturn>) {
  vi.mocked(useBillingPeriod).mockReturnValue({
    period: null,
    isLoading: false,
    isError: false,
    error: null,
    periodQuery: {} as PeriodHookReturn['periodQuery'],
    ...overrides,
  });
}

async function renderPage(id = '42') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Suspense fallback={null}>{children}</Suspense>
  );
  await act(async () => {
    render(<BillingPeriodDetailPage params={Promise.resolve({ id })} />, {
      wrapper,
    });
  });
}

describe('BillingPeriodDetailPage (Phase 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders every resource row of a resolved statement', async () => {
    mockPeriod({ period: DETAIL });

    await renderPage();

    expect(await screen.findByText('Team')).toBeInTheDocument();
    expect(screen.getAllByTestId('period-resource-row')).toHaveLength(3);
    expect(screen.getByText('Event occurrences')).toBeInTheDocument();
    expect(screen.getByText('Organization members')).toBeInTheDocument();
    expect(screen.getByText('Calendar groups')).toBeInTheDocument();
  });

  it('renders the not-found state for an out-of-pool / 404 id', async () => {
    // The API's non-disclosure 404 body; `isNotFoundError` recognizes it.
    mockPeriod({
      isError: true,
      error: { detail: 'Not found.' } as unknown as Error,
    });

    await renderPage('9999');

    expect(await screen.findByTestId('period-not-found')).toBeInTheDocument();
    expect(screen.queryByText('Team')).not.toBeInTheDocument();
  });

  it('renders a generic error state for a non-404 failure', async () => {
    mockPeriod({
      isError: true,
      error: { detail: 'Server error' } as unknown as Error,
    });

    await renderPage();

    expect(await screen.findByTestId('period-load-error')).toBeInTheDocument();
    expect(screen.queryByTestId('period-not-found')).not.toBeInTheDocument();
  });
});
