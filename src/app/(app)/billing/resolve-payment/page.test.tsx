/**
 * ResolvePaymentPage (Phase 5) tests.
 *
 * The page owns the recovery route's guards; the money-path form is mocked to a
 * marker so the test asserts routing + gating only:
 *   • an org NOT in GRACE/RESTRICTED (active, or no subscription) is redirected
 *     to `/billing` — nothing to resolve;
 *   • a GRACE org with an admin sees the form;
 *   • a GRACE org with a plain member sees the access-denied state (not the
 *     form, and no redirect — the server `403` is the real backstop).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import type { Subscription } from '@/client';
import { RoleProvider } from '@/components/navigation/role-gate';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

vi.mock('@/hooks/billing/use-subscription', () => ({
  useSubscription: vi.fn(),
}));

vi.mock('@/components/billing/resolve-payment-form', () => ({
  ResolvePaymentForm: () => <div data-testid='resolve-payment-form-marker' />,
}));

import { useSubscription } from '@/hooks/billing/use-subscription';
import ResolvePaymentPage from './page';

function mockSubscription(
  subscription: Subscription | null,
  isLoading = false
) {
  vi.mocked(useSubscription).mockReturnValue({
    subscription,
    isLoading,
    isError: subscription === null && !isLoading,
    error: null,
    subscriptionQuery: {} as ReturnType<
      typeof useSubscription
    >['subscriptionQuery'],
  });
}

function makeSubscription(billingState: string): Subscription {
  return {
    id: 1,
    plan: { slug: 'team', name: 'Team', currency: 'USD' },
    billing_state: billingState,
    billing_interval: 'monthly',
    grace_period_ends_at: '2026-09-01T12:00:00Z',
    pending_plan_slug: '',
  } as unknown as Subscription;
}

function renderPage(role: 'admin' | 'member' | null) {
  return render(
    <RoleProvider role={role}>
      <ResolvePaymentPage />
    </RoleProvider>
  );
}

describe('ResolvePaymentPage (Phase 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects an ACTIVE org to /billing (nothing to resolve)', async () => {
    mockSubscription(makeSubscription('active'));

    renderPage('admin');

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/billing'));
    expect(
      screen.queryByTestId('resolve-payment-form-marker')
    ).not.toBeInTheDocument();
  });

  it('redirects a subscription-less org to /billing', async () => {
    mockSubscription(null);

    renderPage('admin');

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/billing'));
    expect(
      screen.queryByTestId('resolve-payment-form-marker')
    ).not.toBeInTheDocument();
  });

  it('renders the form for a GRACE org with an admin', async () => {
    mockSubscription(makeSubscription('grace'));

    renderPage('admin');

    await waitFor(() =>
      expect(
        screen.getByTestId('resolve-payment-form-marker')
      ).toBeInTheDocument()
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it('renders the form for a RESTRICTED org with an admin', async () => {
    mockSubscription(makeSubscription('restricted'));

    renderPage('admin');

    await waitFor(() =>
      expect(
        screen.getByTestId('resolve-payment-form-marker')
      ).toBeInTheDocument()
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it('does not flash the form or access-denied, nor redirect, while the role is still loading', () => {
    mockSubscription(makeSubscription('grace'));

    // role === null → the role signal is still loading: gate not yet decided.
    renderPage(null);

    expect(
      screen.queryByTestId('resolve-payment-form-marker')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('resolve-payment-access-denied')
    ).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('does not redirect while the subscription read is in flight', () => {
    // Mid-flight read: isLoading true even though the settled state (active)
    // would otherwise redirect. The `!isLoading` guard must hold the redirect.
    mockSubscription(makeSubscription('active'), true);

    renderPage('admin');

    expect(replace).not.toHaveBeenCalled();
  });

  it('shows the access-denied state for a GRACE org with a plain member', () => {
    mockSubscription(makeSubscription('grace'));

    renderPage('member');

    expect(
      screen.getByTestId('resolve-payment-access-denied')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('resolve-payment-form-marker')
    ).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
