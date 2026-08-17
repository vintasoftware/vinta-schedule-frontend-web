/**
 * BillingOverview — the "Buy more" affordance wiring (Phase 4).
 *
 * The read hooks are mocked; `PurchaseAddOnDialog` is mocked to a marker so the
 * test asserts the wiring — that a row's "Buy more" opens the dialog
 * pre-selected to THAT resource — without the real money-path. It also asserts
 * the affordance is role-gated: a member sees no "Buy more" control.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import type { Subscription, UsageResponse } from '@/client';
import { PermissionProvider } from '@/components/navigation/permission-gate';

vi.mock('@/hooks/billing/use-billing-usage', () => ({
  useBillingUsage: vi.fn(),
}));
vi.mock('@/hooks/billing/use-subscription', () => ({
  useSubscription: vi.fn(),
}));

// A marker so the dialog's real money-path hooks never run — we only assert the
// resource it was opened with.
vi.mock('./purchase-add-on-dialog', () => ({
  PurchaseAddOnDialog: ({
    open,
    resourceKey,
  }: {
    open: boolean;
    resourceKey?: string;
  }) =>
    open ? (
      <div data-testid='purchase-dialog'>
        <span data-testid='dialog-resource'>{resourceKey}</span>
      </div>
    ) : null,
}));

import { useBillingUsage } from '@/hooks/billing/use-billing-usage';
import { useSubscription } from '@/hooks/billing/use-subscription';
import { BillingOverview } from './billing-overview';

const USAGE: UsageResponse = {
  billing_state: 'active',
  billing_root_organization_id: 1,
  plan: { slug: 'team', name: 'Team', currency: 'USD' },
  billing_period: {
    start: '2026-08-01T00:00:00Z',
    end: '2026-09-01T00:00:00Z',
  },
  estimated_overage_total: '0.0000',
  limits: [
    // Near its limit (95/100) AND prepaid → the "Buy more" affordance shows.
    {
      resource_key: 'event_occurrences',
      kind: 'prepaid',
      limit_value: 100,
      current_usage: 95,
      overage_unit_price: null,
      included_in_plan: 100,
      add_on_quantity: 0,
      by_organization: [],
    },
    // Postpaid (overage billed automatically) → no affordance, even for admin.
    {
      resource_key: 'organization_members',
      kind: 'postpaid',
      limit_value: 100,
      current_usage: 40,
      overage_unit_price: '0.5000',
      included_in_plan: 100,
      add_on_quantity: 0,
      by_organization: [],
    },
  ],
} as unknown as UsageResponse;

function mockHooks(subscription: Subscription | null) {
  vi.mocked(useBillingUsage).mockReturnValue({
    usage: USAGE,
    isLoading: false,
    isError: false,
    error: null,
    usageQuery: {} as ReturnType<typeof useBillingUsage>['usageQuery'],
  });
  vi.mocked(useSubscription).mockReturnValue({
    subscription,
    isLoading: false,
    isError: false,
    error: null,
    subscriptionQuery: {} as ReturnType<
      typeof useSubscription
    >['subscriptionQuery'],
  });
}

const SUBSCRIPTION = {
  id: 1,
  billing_state: 'active',
  add_ons: [],
} as unknown as Subscription;

// A billing manager holds `payments.manage_billing`; a plain member holds no
// capabilities; `null` models the still-loading permission set.
function permissionsFor(
  role: 'admin' | 'member' | null
): readonly string[] | null {
  if (role === null) return null;
  return role === 'admin' ? ['payments.manage_billing'] : [];
}

function renderOverview(role: 'admin' | 'member' | null) {
  return render(
    <PermissionProvider permissions={permissionsFor(role)}>
      <BillingOverview />
    </PermissionProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHooks(SUBSCRIPTION);
});

describe('BillingOverview — buy-more affordance', () => {
  it("opens the purchase dialog pre-selected to the row's resource for an admin", async () => {
    renderOverview('admin');

    const buyMore = screen.getByTestId('resource-buy-more');
    expect(buyMore).toBeInTheDocument();

    fireEvent.click(buyMore);

    await waitFor(() =>
      expect(screen.getByTestId('purchase-dialog')).toBeInTheDocument()
    );
    expect(screen.getByTestId('dialog-resource')).toHaveTextContent(
      'event_occurrences'
    );
  });

  it('scopes "Buy more" to the near-limit prepaid row — never the postpaid one', () => {
    renderOverview('admin');

    // Exactly the prepaid, near-limit row exposes the affordance; the postpaid
    // row (overage billed automatically) shows none.
    expect(screen.getAllByTestId('resource-buy-more')).toHaveLength(1);
  });

  it('hides the "Buy more" affordance from a member', () => {
    renderOverview('member');

    expect(screen.queryByTestId('resource-buy-more')).not.toBeInTheDocument();
    expect(screen.queryByTestId('purchase-dialog')).not.toBeInTheDocument();
  });
});
