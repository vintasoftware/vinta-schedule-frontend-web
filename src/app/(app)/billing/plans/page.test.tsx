/**
 * BillingPlansPage (Phase 3) tests.
 *
 * The page renders the `BillingPlansPicker` client island. The catalog +
 * subscription hooks are mocked; the change-plan / cancel dialogs are mocked to
 * lightweight markers so the test can assert the picker's wiring (which plan is
 * marked current, that the monthly/annual toggle switches both the displayed
 * price AND the `billing_interval` handed to the dialog) and its role gating
 * (a non-admin sees no upgrade/cancel affordance).
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { BillingPlan, Subscription } from '@/client';
import { PermissionProvider } from '@/components/navigation/permission-gate';

// Map the legacy admin/member/null role param onto the resolved capability set
// the PermissionProvider now takes. An "admin" (manage_members) holds the full
// set; a plain member holds none; null models the still-loading state.
const ADMIN_PERMISSIONS = [
  'organizations.manage_members',
  'organizations.manage_organization',
  'organizations.manage_branding',
  'payments.manage_billing',
];
function permissionsForRole(
  role: 'admin' | 'member' | null
): readonly string[] | null {
  if (role === null) return null;
  return role === 'admin' ? ADMIN_PERMISSIONS : [];
}

vi.mock('@/hooks/billing/use-billing-plans', () => ({
  useBillingPlans: vi.fn(),
}));
vi.mock('@/hooks/billing/use-subscription', () => ({
  useSubscription: vi.fn(),
}));

// Lightweight dialog markers — render the props the picker hands them so the
// test can assert the interval + selected plan without the real money-path.
vi.mock('@/components/billing/change-plan-dialog', () => ({
  ChangePlanDialog: ({
    open,
    plan,
    billingInterval,
  }: {
    open: boolean;
    plan: BillingPlan;
    billingInterval: string;
  }) =>
    open ? (
      <div data-testid='change-plan-dialog'>
        <span data-testid='dialog-plan'>{plan.slug}</span>
        <span data-testid='dialog-interval'>{billingInterval}</span>
      </div>
    ) : null,
}));
vi.mock('@/components/billing/cancel-subscription-dialog', () => ({
  CancelSubscriptionDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid='cancel-dialog' /> : null,
}));

import { useBillingPlans } from '@/hooks/billing/use-billing-plans';
import { useSubscription } from '@/hooks/billing/use-subscription';
import BillingPlansPage from './page';

const STARTER: BillingPlan = {
  id: 1,
  slug: 'starter',
  name: 'Starter',
  is_active: true,
  is_default_for_new_organizations: false,
  monthly_price: '10.0000',
  annual_price: '100.0000',
  currency: 'USD',
  grace_period_days: 7,
  limits: [],
  entitlements: [],
};

const TEAM: BillingPlan = {
  ...STARTER,
  id: 2,
  slug: 'team',
  name: 'Team',
  monthly_price: '20.0000',
  annual_price: '200.0000',
};

const SUBSCRIPTION = {
  id: 1,
  plan: STARTER,
  billing_state: 'active',
  billing_interval: 'monthly',
  pending_plan_slug: '',
} as unknown as Subscription;

function mockPlans(plans: BillingPlan[]) {
  vi.mocked(useBillingPlans).mockReturnValue({
    plans,
    totalCount: plans.length,
    isLoading: false,
    isError: false,
    error: null,
    plansQuery: {} as ReturnType<typeof useBillingPlans>['plansQuery'],
  });
}

function mockSubscription(subscription: Subscription | null) {
  vi.mocked(useSubscription).mockReturnValue({
    subscription,
    isLoading: false,
    isError: subscription === null,
    error: null,
    subscriptionQuery: {} as ReturnType<
      typeof useSubscription
    >['subscriptionQuery'],
  });
}

// BillingPlansPage is an async Server Component (it awaits `searchParams`
// before returning JSX) — resolve it to a React element first, then hand
// that to `render()`, same convention as the other async-page tests in this
// repo (e.g. auth/login/[slug]/page.test.tsx).
async function renderPage(
  role: 'admin' | 'member' | null,
  searchParams: Record<string, string | string[] | undefined> = {}
) {
  const element = await BillingPlansPage({
    searchParams: Promise.resolve(searchParams),
  });
  return render(
    <PermissionProvider permissions={permissionsForRole(role)}>
      {element}
    </PermissionProvider>
  );
}

describe('BillingPlansPage (Phase 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlans([STARTER, TEAM]);
    mockSubscription(SUBSCRIPTION);
  });

  it('marks the current plan', async () => {
    await renderPage('admin');

    expect(screen.getByTestId('plan-current-starter')).toBeInTheDocument();
    expect(screen.queryByTestId('plan-current-team')).not.toBeInTheDocument();
  });

  it('defaults to monthly prices and switches to annual on the toggle', async () => {
    const user = userEvent.setup();
    await renderPage('admin');

    // Monthly default.
    expect(screen.getByTestId('plan-price-team')).toHaveTextContent('$20.00');

    await user.click(screen.getByTestId('interval-annual'));

    expect(screen.getByTestId('plan-price-team')).toHaveTextContent('$200.00');
  });

  it('hands the selected interval to the change-plan dialog', async () => {
    const user = userEvent.setup();
    await renderPage('admin');

    await user.click(screen.getByTestId('interval-annual'));
    fireEvent.click(screen.getByTestId('plan-change-team'));

    await waitFor(() =>
      expect(screen.getByTestId('change-plan-dialog')).toBeInTheDocument()
    );
    expect(screen.getByTestId('dialog-plan')).toHaveTextContent('team');
    expect(screen.getByTestId('dialog-interval')).toHaveTextContent('annual');
  });

  it('offers Cancel on the current paid plan for an admin', async () => {
    await renderPage('admin');

    expect(screen.getByTestId('plan-cancel-starter')).toBeInTheDocument();
  });

  it('hides upgrade/cancel affordances from a non-admin member', async () => {
    await renderPage('member');

    expect(screen.queryByTestId('plan-change-team')).not.toBeInTheDocument();
    expect(screen.queryByTestId('plan-cancel-starter')).not.toBeInTheDocument();
    // The catalog itself is still readable.
    expect(screen.getByTestId('plan-card-team')).toBeInTheDocument();
  });

  it('forwards ?resource= to the picker as a highlight hint', async () => {
    await renderPage('admin', { resource: 'organization_members' });

    expect(screen.getByTestId('plans-resource-hint')).toHaveTextContent(
      'organization members'
    );
  });

  it('renders no highlight hint without ?resource=', async () => {
    await renderPage('admin');

    expect(screen.queryByTestId('plans-resource-hint')).not.toBeInTheDocument();
  });
});
