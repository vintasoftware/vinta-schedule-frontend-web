/**
 * GroupQuotaRules tests.
 *
 * Covers:
 * - a cap below 1 is rejected by the form's own validation before any
 *   request reaches the API (the create endpoint is never called).
 * - a duplicate-period rejection (400 `non_field_errors`) renders the API's
 *   own message inline on the form, not a toast, and the dialog stays open.
 * - the UTC boundary helper text is present on the period field.
 * - a daily rule and a weekly rule for the same calendar/slot coexist in the
 *   list (the uniqueness constraint is per period, not per calendar+slot).
 * - a viewer without edit rights sees the rules but no add/edit/delete
 *   affordance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { GroupScopedQuotaRule } from '@/client';
import { GroupQuotaRules } from './group-quota-rules';
import { GroupPermissionsProvider } from './group-permissions-provider';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarGroupsSlotsQuotaRulesList: vi.fn(),
    calendarGroupsSlotsQuotaRulesCreate: vi.fn(),
    calendarGroupsSlotsQuotaRulesPartialUpdate: vi.fn(),
    calendarGroupsSlotsQuotaRulesDestroy: vi.fn(),
  };
});

import {
  calendarGroupsSlotsQuotaRulesList,
  calendarGroupsSlotsQuotaRulesCreate,
} from '@/client/sdk.gen';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

function makeRule(
  overrides: Partial<GroupScopedQuotaRule>
): GroupScopedQuotaRule {
  return {
    id: 1,
    calendar_id: 42,
    group_slot_id: 10,
    period: 'week',
    cap: 3,
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeListResponse(results: GroupScopedQuotaRule[]) {
  const body = { count: results.length, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Awaited<ReturnType<typeof calendarGroupsSlotsQuotaRulesList>>;
}

function renderRules(readOnly = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <GroupPermissionsProvider
        permissions={readOnly ? null : ['organizations.manage_members']}
        ownedCalendarIds={new Set()}
      >
        {children}
      </GroupPermissionsProvider>
    </QueryClientProvider>
  );
  return render(<GroupQuotaRules groupId={1} slotId={10} calendarId={42} />, {
    wrapper,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GroupQuotaRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a cap below 1 in the form before any request reaches the API', async () => {
    vi.mocked(calendarGroupsSlotsQuotaRulesList).mockResolvedValue(
      makeListResponse([])
    );

    const user = userEvent.setup();
    renderRules();

    await screen.findByTestId('group-quota-rules');
    await user.click(screen.getByRole('button', { name: /add rule/i }));

    const capInput = await screen.findByLabelText(/^cap$/i);
    await user.clear(capInput);
    await user.type(capInput, '0');

    await user.click(screen.getByTestId('quota-rule-submit'));

    expect(
      await screen.findByText('Cap must be at least 1')
    ).toBeInTheDocument();
    // The guard fired client-side -- no request was ever sent.
    expect(calendarGroupsSlotsQuotaRulesCreate).not.toHaveBeenCalled();
  });

  it('shows the UTC boundary helper text on the period field', async () => {
    vi.mocked(calendarGroupsSlotsQuotaRulesList).mockResolvedValue(
      makeListResponse([])
    );

    const user = userEvent.setup();
    renderRules();

    await screen.findByTestId('group-quota-rules');
    await user.click(screen.getByRole('button', { name: /add rule/i }));

    expect(
      await screen.findByText(
        "Day, week, and month boundaries are measured in UTC, not this calendar's local timezone."
      )
    ).toBeInTheDocument();
  });

  it('renders the API non_field_errors message on the form for a duplicate-period rejection, not a toast', async () => {
    vi.mocked(calendarGroupsSlotsQuotaRulesList).mockResolvedValue(
      makeListResponse([])
    );
    vi.mocked(calendarGroupsSlotsQuotaRulesCreate).mockRejectedValue({
      non_field_errors: [
        'The fields calendar, group_slot, period must make a unique set.',
      ],
    });

    const user = userEvent.setup();
    renderRules();

    await screen.findByTestId('group-quota-rules');
    await user.click(screen.getByRole('button', { name: /add rule/i }));

    const capInput = await screen.findByLabelText(/^cap$/i);
    await user.clear(capInput);
    await user.type(capInput, '3');
    await user.click(screen.getByTestId('quota-rule-submit'));

    expect(await screen.findByTestId('quota-form-error')).toHaveTextContent(
      'The fields calendar, group_slot, period must make a unique set.'
    );
    // Not a toast-and-forget: the dialog (and its submit control) is still
    // on screen so the admin can change the period and retry.
    expect(screen.getByTestId('quota-rule-submit')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('a daily rule and a weekly rule for the same calendar/slot coexist in the list', async () => {
    vi.mocked(calendarGroupsSlotsQuotaRulesList).mockResolvedValue(
      makeListResponse([
        makeRule({ id: 1, period: 'day', cap: 1 }),
        makeRule({ id: 2, period: 'week', cap: 3 }),
      ])
    );

    renderRules();

    expect(await screen.findByTestId('quota-rule-1')).toBeInTheDocument();
    expect(screen.getByTestId('quota-rule-2')).toBeInTheDocument();
    expect(screen.getByText('1 booking per day')).toBeInTheDocument();
    expect(screen.getByText('3 bookings per week')).toBeInTheDocument();
  });

  it('a viewer without edit rights sees the rules and no actions', async () => {
    vi.mocked(calendarGroupsSlotsQuotaRulesList).mockResolvedValue(
      makeListResponse([makeRule({ id: 1, period: 'week', cap: 3 })])
    );

    renderRules(true);

    expect(await screen.findByTestId('quota-rule-1')).toBeInTheDocument();
    expect(screen.getByText('3 bookings per week')).toBeInTheDocument();

    expect(
      screen.queryByRole('button', { name: /add rule/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit quota rule 1' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete quota rule 1' })
    ).not.toBeInTheDocument();
  });

  it('shows an empty state when no rules are configured', async () => {
    vi.mocked(calendarGroupsSlotsQuotaRulesList).mockResolvedValue(
      makeListResponse([])
    );

    renderRules();

    expect(
      await screen.findByText('No quota rules configured.')
    ).toBeInTheDocument();
  });

  it('a successful create closes the dialog and lists the new rule', async () => {
    const created = makeRule({ id: 900, period: 'week', cap: 3 });
    // Sequenced, not a single mockResolvedValue for every call: the list
    // starts empty, then the mutation's cache invalidation triggers a
    // refetch that must return the newly-created row -- a fixture that
    // returns [] unconditionally could never support asserting the row
    // appears (mirrors group-block-list.test.tsx's fixture shape for the
    // same reason).
    vi.mocked(calendarGroupsSlotsQuotaRulesList)
      .mockResolvedValueOnce(makeListResponse([]))
      .mockResolvedValueOnce(makeListResponse([created]));
    vi.mocked(calendarGroupsSlotsQuotaRulesCreate).mockResolvedValue({
      data: created,
      response: new Response(null, { status: 201 }),
    } as unknown as Awaited<
      ReturnType<typeof calendarGroupsSlotsQuotaRulesCreate>
    >);

    const user = userEvent.setup();
    renderRules();

    await screen.findByText('No quota rules configured.');
    await user.click(screen.getByRole('button', { name: /add rule/i }));

    const capInput = await screen.findByLabelText(/^cap$/i);
    await user.clear(capInput);
    await user.type(capInput, '3');
    await user.click(screen.getByTestId('quota-rule-submit'));

    await waitFor(() =>
      expect(calendarGroupsSlotsQuotaRulesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { calendar: 42, period: 'week', cap: 3 },
        })
      )
    );

    // The dialog closed after a successful save.
    expect(screen.queryByTestId('quota-rule-submit')).not.toBeInTheDocument();

    expect(await screen.findByTestId('quota-rule-900')).toBeInTheDocument();
    expect(
      screen.queryByText('No quota rules configured.')
    ).not.toBeInTheDocument();
  });
});
