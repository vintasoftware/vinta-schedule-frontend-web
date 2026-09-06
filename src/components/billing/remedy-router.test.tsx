/**
 * RemedyRouter tests (Phase 8, billing-hardening-gap-closure plan).
 *
 * Verifies the acting half of the global over-limit handler: a `remedy`
 * event on the bus routes to the right destination — navigation for
 * upgrade_plan/resolve_billing/unknown, an in-place PurchaseAddOnDialog for
 * purchase_add_on. `useSubscription` and `PurchaseAddOnDialog` are mocked so
 * the test asserts the routing decision, not the money-path dialog itself.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import type { Remedy } from '@/lib/billing/derive-remedy';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/hooks/billing/use-subscription', () => ({
  useSubscription: vi.fn(),
}));

vi.mock('./purchase-add-on-dialog', () => ({
  PurchaseAddOnDialog: ({
    open,
    resourceKey,
  }: {
    open: boolean;
    resourceKey?: string;
  }) =>
    open ? (
      <div data-testid='purchase-add-on-dialog'>
        <span data-testid='dialog-resource'>{resourceKey}</span>
      </div>
    ) : null,
}));

import { useSubscription } from '@/hooks/billing/use-subscription';
import { emitRemedy } from '@/lib/billing/remedy-bus';
import { RemedyRouter } from './remedy-router';

function mockSubscription() {
  vi.mocked(useSubscription).mockReturnValue({
    subscription: null,
    isLoading: false,
    isError: false,
    error: null,
    subscriptionQuery: {} as ReturnType<
      typeof useSubscription
    >['subscriptionQuery'],
  });
}

describe('RemedyRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscription();
  });

  it('navigates to the plans catalog with the resource for upgrade_plan', () => {
    render(<RemedyRouter />);

    emitRemedy({ remedy: 'upgrade_plan', resource: 'appointment_types' });

    expect(push).toHaveBeenCalledWith(
      '/billing/plans?resource=appointment_types'
    );
  });

  it('navigates to resolve-payment for resolve_billing', () => {
    render(<RemedyRouter />);

    emitRemedy({ remedy: 'resolve_billing', resource: 'event_occurrences' });

    expect(push).toHaveBeenCalledWith('/billing/resolve-payment');
  });

  it('opens PurchaseAddOnDialog pre-filled with the resource for purchase_add_on, without navigating', async () => {
    render(<RemedyRouter />);

    emitRemedy({ remedy: 'purchase_add_on', resource: 'event_occurrences' });

    await waitFor(() =>
      expect(screen.getByTestId('purchase-add-on-dialog')).toBeInTheDocument()
    );
    expect(screen.getByTestId('dialog-resource')).toHaveTextContent(
      'event_occurrences'
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('falls back to /billing for an unrecognized remedy', () => {
    render(<RemedyRouter />);

    emitRemedy({
      remedy: 'some_future_remedy' as Remedy,
      resource: 'appointment_types',
    });

    expect(push).toHaveBeenCalledWith('/billing');
  });

  it('stops routing once unmounted (no stale subscription)', () => {
    const { unmount } = render(<RemedyRouter />);
    unmount();

    emitRemedy({ remedy: 'upgrade_plan', resource: 'appointment_types' });

    expect(push).not.toHaveBeenCalled();
  });
});
