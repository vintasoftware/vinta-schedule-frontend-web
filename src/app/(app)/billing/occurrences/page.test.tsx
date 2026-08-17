/**
 * BillingOccurrencesPage (Phase 8) tests.
 *
 * The page is the client island for `/billing/occurrences`: it owns the role
 * gate, the filter + pagination state, and reads `useOccurrenceLedger(filters)`.
 * Both data hooks are mocked so the test drives the behaviors that matter — and
 * the SECURITY BOUNDARY first:
 *
 *   • a non-admin / plain member sees the access-denied state and NEVER the
 *     table, and the ledger query is disabled for them (no fetch);
 *   • a mocked server `403` (admin client signal, denied by the API) also
 *     renders the access-denied state, not the table;
 *   • the overage-only toggle sends `is_within_allowance: false`;
 *   • the date range and org filters narrow the query;
 *   • with no period filter the query omits `billing_period_start` (the API then
 *     defaults to the current period).
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { MeteredOccurrence, UsageResponse } from '@/client';
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

// Radix Select relies on pointer-capture + scrollIntoView, absent in jsdom.
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
});

vi.mock('@/hooks/billing/use-occurrence-ledger', () => ({
  useOccurrenceLedger: vi.fn(),
}));

vi.mock('@/hooks/billing/use-billing-usage', () => ({
  useBillingUsage: vi.fn(),
}));

import { useOccurrenceLedger } from '@/hooks/billing/use-occurrence-ledger';
import { useBillingUsage } from '@/hooks/billing/use-billing-usage';
import BillingOccurrencesPage from './page';

function occurrence(
  overrides: Partial<MeteredOccurrence> = {}
): MeteredOccurrence {
  return {
    id: 1,
    organization: { id: 10, name: 'Acme Inc.' },
    event: {
      id: 100,
      title: 'Weekly sync',
      calendar: { id: 5, name: 'Team calendar' },
      owners: [{ user_id: 1, name: 'Ada Lovelace' }],
    },
    occurrence_start: '2026-08-03T14:00:00Z',
    billing_period_start: '2026-08-01T00:00:00Z',
    is_within_allowance: false,
    unit_price: '0.5000',
    ...overrides,
  };
}

function mockLedger({
  occurrences = [occurrence()],
  totalCount = occurrences.length,
  isLoading = false,
  isError = false,
  error = null,
}: {
  occurrences?: MeteredOccurrence[];
  totalCount?: number;
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
} = {}) {
  vi.mocked(useOccurrenceLedger).mockReturnValue({
    occurrences,
    totalCount,
    isLoading,
    isError,
    error: error as ReturnType<typeof useOccurrenceLedger>['error'],
    ledgerQuery: {} as ReturnType<typeof useOccurrenceLedger>['ledgerQuery'],
  });
}

function mockUsage(usage: UsageResponse | null = null) {
  vi.mocked(useBillingUsage).mockReturnValue({
    usage,
    isLoading: false,
    isError: false,
    error: null,
    usageQuery: {} as ReturnType<typeof useBillingUsage>['usageQuery'],
  });
}

function makeUsage(overrides: Partial<UsageResponse> = {}): UsageResponse {
  return {
    billing_state: 'active',
    billing_root_organization_id: 10,
    plan: {
      slug: 'team',
      name: 'Team',
      currency: 'USD',
    } as unknown as UsageResponse['plan'],
    billing_period: null,
    estimated_overage_total: '0.0000',
    limits: [],
    ...overrides,
  };
}

/** The `filters` object handed to the ledger hook on its most recent render. */
function lastFilters() {
  const calls = vi.mocked(useOccurrenceLedger).mock.calls;
  return calls[calls.length - 1][0]?.filters;
}

/** Whether the ledger query was enabled on its most recent render. */
function lastEnabled() {
  const calls = vi.mocked(useOccurrenceLedger).mock.calls;
  return calls[calls.length - 1][0]?.enabled;
}

function renderPage(role: 'admin' | 'member' | null) {
  return render(
    <PermissionProvider permissions={permissionsForRole(role)}>
      <BillingOccurrencesPage />
    </PermissionProvider>
  );
}

describe('BillingOccurrencesPage (Phase 8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLedger();
    mockUsage(makeUsage());
  });

  it('SECURITY: a plain member sees the access-denied state and NEVER the table', () => {
    renderPage('member');

    expect(
      screen.getByTestId('occurrence-ledger-access-denied')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('occurrence-ledger-table')
    ).not.toBeInTheDocument();
    // And the query is disabled for a member — no row is even fetched.
    expect(lastEnabled()).toBe(false);
  });

  it('does not flash the table or the denial while the role is still loading', () => {
    renderPage(null);

    expect(
      screen.queryByTestId('occurrence-ledger-table')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('occurrence-ledger-access-denied')
    ).not.toBeInTheDocument();
    // And no fetch is issued while the role is still resolving.
    expect(lastEnabled()).toBe(false);
  });

  it('renders the table for an admin and enables the query', () => {
    renderPage('admin');

    expect(screen.getByTestId('occurrence-ledger-table')).toBeInTheDocument();
    expect(lastEnabled()).toBe(true);
  });

  it('SECURITY: a mocked unclassified error (403/500/network) renders a neutral load error, not the table', () => {
    // The client throws only the body, so a genuine 403 is indistinguishable
    // from a 500 or a network failure. An entitled admin must NOT be told they
    // lack access — a neutral load-failure message shows instead, and still no
    // table.
    mockLedger({
      occurrences: [],
      isError: true,
      error: { detail: 'You do not have permission to perform this action.' },
    });

    renderPage('admin');

    expect(
      screen.getByTestId('occurrence-ledger-load-error')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('occurrence-ledger-access-denied')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('occurrence-ledger-table')
    ).not.toBeInTheDocument();
  });

  it('omits billing_period_start by default (API defaults to the current period)', () => {
    renderPage('admin');

    expect(lastFilters()).not.toHaveProperty('billing_period_start');
  });

  it('the overage-only toggle sends is_within_allowance: false', () => {
    renderPage('admin');

    // Default: no allowance filter at all (shows both included + overage).
    expect(lastFilters()).not.toHaveProperty('is_within_allowance');

    fireEvent.click(screen.getByTestId('filter-overage-only'));

    expect(lastFilters()).toMatchObject({ is_within_allowance: false });
  });

  it('the date range narrows the query', () => {
    renderPage('admin');

    fireEvent.change(screen.getByTestId('filter-start-after'), {
      target: { value: '2026-08-01' },
    });
    fireEvent.change(screen.getByTestId('filter-start-before'), {
      target: { value: '2026-08-31' },
    });

    expect(lastFilters()).toMatchObject({
      occurrence_start_after: '2026-08-01',
      occurrence_start_before: '2026-08-31',
    });
  });

  it('picking a period narrows the query with billing_period_start', () => {
    renderPage('admin');

    fireEvent.change(screen.getByTestId('filter-period-start'), {
      target: { value: '2026-07-01' },
    });

    expect(lastFilters()).toMatchObject({
      billing_period_start: '2026-07-01',
    });
  });

  it('the org filter (restricted to pool orgs) narrows the query', async () => {
    // Two pool orgs → the org Select renders and offers exactly those orgs.
    mockUsage(
      makeUsage({
        limits: [
          {
            resource_key: 'event_occurrences',
            kind: null,
            limit_value: 100,
            current_usage: 50,
            overage_unit_price: '0.5000',
            included_in_plan: 100,
            add_on_quantity: 0,
            by_organization: [
              { organization_id: 10, name: 'Acme Inc.', usage: 30 },
              { organization_id: 11, name: 'Beta LLC', usage: 20 },
            ],
          },
        ],
      })
    );

    const user = userEvent.setup();
    renderPage('admin');

    await user.click(screen.getByTestId('filter-organization'));
    await user.click(screen.getByRole('option', { name: 'Beta LLC' }));

    await waitFor(() => {
      expect(lastFilters()).toMatchObject({ organization: 11 });
    });
  });

  it('keeps the org filter mounted and clearable after the result set collapses to one org', async () => {
    // Usage carries no `by_organization` attribution, so the org options come
    // ONLY from the observed rows — the case where selecting an org collapses
    // the observed set (and `poolOrgs`) to length 1 and would otherwise unmount
    // the Select, stranding the user on one org.
    mockUsage(makeUsage());

    const acme = occurrence({
      id: 1,
      organization: { id: 10, name: 'Acme Inc.' },
    });
    const beta = occurrence({
      id: 2,
      organization: { id: 11, name: 'Beta LLC' },
    });
    vi.mocked(useOccurrenceLedger).mockImplementation((args) => {
      const org = args?.filters?.organization;
      const rows =
        org === undefined
          ? [acme, beta]
          : [acme, beta].filter((row) => row.organization.id === org);
      return {
        occurrences: rows,
        totalCount: rows.length,
        isLoading: false,
        isError: false,
        error: null,
        ledgerQuery: {} as ReturnType<
          typeof useOccurrenceLedger
        >['ledgerQuery'],
      };
    });

    const user = userEvent.setup();
    renderPage('admin');

    // Two observed orgs → the Select renders and offers both.
    await user.click(screen.getByTestId('filter-organization'));
    await user.click(screen.getByRole('option', { name: 'Beta LLC' }));

    await waitFor(() => {
      expect(lastFilters()).toMatchObject({ organization: 11 });
    });

    // The observed set has now collapsed to a single org, but the Select stays
    // mounted so the user can still get back to "All".
    expect(screen.getByTestId('filter-organization')).toBeInTheDocument();

    await user.click(screen.getByTestId('filter-organization'));
    await user.click(screen.getByRole('option', { name: 'All organizations' }));

    await waitFor(() => {
      expect(lastFilters()).not.toHaveProperty('organization');
    });
  });

  it('surfaces a filter validation error (out-of-pool org) distinctly from a denial', () => {
    mockLedger({
      occurrences: [],
      isError: true,
      error: {
        organization: [
          'Select a valid choice. That organization is not in your pool.',
        ],
      },
    });

    renderPage('admin');

    expect(screen.getByTestId('occurrence-ledger-error')).toHaveTextContent(
      'not in your pool'
    );
    expect(
      screen.queryByTestId('occurrence-ledger-table')
    ).not.toBeInTheDocument();
  });
});
