/**
 * ActiveAddOnsList tests.
 *
 * The subscription + cancel hooks are mocked. Load-bearing behaviors:
 *   • a RECURRING add-on exposes "Stop renewing" and, on confirm, calls the
 *     DELETE mutation with the add-on id;
 *   • a ONE-TIME pack exposes no such action (it isn't renewable);
 *   • the action is admin-only — a member sees no "Stop renewing" control.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import type { Subscription, SubscriptionAddOn } from '@/client';
import { RoleProvider } from '@/components/navigation/role-gate';

// ---- mocks -----------------------------------------------------------------

const h = vi.hoisted(() => ({
  cancelAddOn: vi.fn(),
  subscription: null as Subscription | null,
}));

vi.mock('@/hooks/billing/use-subscription', () => ({
  useSubscription: () => ({ subscription: h.subscription }),
}));

vi.mock('@/hooks/billing/use-cancel-add-on', () => ({
  useCancelAddOn: () => ({
    cancelAddOn: h.cancelAddOn,
    cancelAddOnMutation: { isPending: false },
  }),
}));

import { ActiveAddOnsList } from './active-add-ons-list';

// ---- fixtures --------------------------------------------------------------

function makeAddOn(overrides: Partial<SubscriptionAddOn>): SubscriptionAddOn {
  return {
    id: 1,
    resource_key: 'event_occurrences',
    quantity: 100,
    is_recurring: true,
    is_active: true,
    external_id: 'ext',
    created: '2026-08-09T00:00:00Z',
    ...overrides,
  } as SubscriptionAddOn;
}

const RECURRING = makeAddOn({ id: 1, is_recurring: true });
const ONE_TIME = makeAddOn({ id: 2, is_recurring: false });

function subscriptionWith(addOns: SubscriptionAddOn[]): Subscription {
  return {
    id: 1,
    billing_state: 'active',
    add_ons: addOns,
  } as unknown as Subscription;
}

function renderList(role: 'admin' | 'member' | null) {
  return render(
    <RoleProvider role={role}>
      <ActiveAddOnsList />
    </RoleProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.subscription = subscriptionWith([RECURRING, ONE_TIME]);
  h.cancelAddOn.mockResolvedValue(undefined);
});

describe('ActiveAddOnsList', () => {
  it('renders nothing when there are no add-ons', () => {
    h.subscription = subscriptionWith([]);
    const { container } = renderList('admin');
    expect(container).toBeEmptyDOMElement();
  });

  it('exposes "Stop renewing" on a recurring add-on but not a one-time pack', () => {
    renderList('admin');

    expect(screen.getByTestId('stop-renewing-1')).toBeInTheDocument();
    expect(screen.queryByTestId('stop-renewing-2')).not.toBeInTheDocument();
  });

  it('calls the DELETE mutation with the add-on id on confirm', async () => {
    renderList('admin');

    // Open the confirm, then confirm.
    fireEvent.click(screen.getByTestId('stop-renewing-1'));
    await waitFor(() =>
      expect(screen.getByTestId('confirm-stop-renewing-1')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTestId('confirm-stop-renewing-1'));

    await waitFor(() => expect(h.cancelAddOn).toHaveBeenCalledTimes(1));
    expect(h.cancelAddOn).toHaveBeenCalledWith(1);
  });

  it('hides the "Stop renewing" action from a member', () => {
    renderList('member');

    expect(screen.queryByTestId('stop-renewing-1')).not.toBeInTheDocument();
    // The add-ons themselves are still listed (a read is open to members).
    expect(screen.getAllByTestId('active-add-on-row')).toHaveLength(2);
  });
});
