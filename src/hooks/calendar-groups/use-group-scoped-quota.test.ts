/**
 * useGroupScopedQuota tests.
 *
 * Covers:
 * - list: group_id/slot_id go through as path params, calendarId filters the
 *   returned rows client-side (the REST endpoint has no calendar_id query
 *   param), and every row is returned when calendarId is omitted.
 * - createQuotaRule / updateQuotaRule: `period` and `cap` round-trip through
 *   the create and update bodies and back out of the resolved value
 *   unchanged (the API returns the rule directly, nothing to unwrap); each
 *   success invalidates the list query.
 * - deleteQuotaRule: a 204 resolves `{ status: 'deleted' }` and invalidates
 *   the list; a 404 resolves `{ status: 'row_gone' }` (not a rejection) and
 *   still invalidates the list; a 500 rejects.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import type { GroupScopedQuotaRule } from '@/client';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

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
  calendarGroupsSlotsQuotaRulesPartialUpdate,
  calendarGroupsSlotsQuotaRulesDestroy,
} from '@/client/sdk.gen';
import {
  useGroupScopedQuota,
  GROUP_SCOPED_QUOTA_PAGE_SIZE,
} from './use-group-scoped-quota';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRule(
  overrides: Partial<GroupScopedQuotaRule>
): GroupScopedQuotaRule {
  return {
    id: 1,
    calendar_id: 42,
    group_slot_id: 7,
    period: 'week',
    cap: 3,
    created: '2026-01-01T00:00:00Z',
    modified: '2026-01-01T00:00:00Z',
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  }
  return { Wrapper, queryClient };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useGroupScopedQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------

  describe('list', () => {
    it('requests the list by group_id/slot_id path params', async () => {
      vi.mocked(calendarGroupsSlotsQuotaRulesList).mockResolvedValue(
        makeListResponse([])
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useGroupScopedQuota({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(vi.mocked(calendarGroupsSlotsQuotaRulesList)).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { group_id: 1, slot_id: 10 },
          query: { limit: GROUP_SCOPED_QUOTA_PAGE_SIZE },
        })
      );
    });

    it('returns every row when calendarId is omitted', async () => {
      vi.mocked(calendarGroupsSlotsQuotaRulesList).mockResolvedValue(
        makeListResponse([
          makeRule({ id: 1, calendar_id: 42 }),
          makeRule({ id: 2, calendar_id: 43 }),
        ])
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useGroupScopedQuota({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.rules.map((r) => r.id)).toEqual([1, 2]);
    });

    it('filters to one calendar client-side when calendarId is set', async () => {
      vi.mocked(calendarGroupsSlotsQuotaRulesList).mockResolvedValue(
        makeListResponse([
          makeRule({ id: 1, calendar_id: 42 }),
          makeRule({ id: 2, calendar_id: 43 }),
          makeRule({ id: 3, calendar_id: 42, period: 'day' }),
        ])
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useGroupScopedQuota({ groupId: 1, slotId: 10, calendarId: 42 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.rules.map((r) => r.id)).toEqual([1, 3]);
    });

    it('isTruncated is true when count > page size', async () => {
      vi.mocked(calendarGroupsSlotsQuotaRulesList).mockResolvedValue({
        data: {
          count: 250,
          results: Array.from({ length: 200 }, (_, i) =>
            makeRule({ id: i + 1 })
          ),
        },
        response: new Response(null, { status: 200 }),
      } as unknown as Awaited<
        ReturnType<typeof calendarGroupsSlotsQuotaRulesList>
      >);

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useGroupScopedQuota({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isTruncated).toBe(true);
      expect(result.current.totalCount).toBe(250);
    });
  });

  // -------------------------------------------------------------------------
  // createQuotaRule
  // -------------------------------------------------------------------------

  describe('createQuotaRule', () => {
    it('sends period and cap in the create body and resolves the rule the API returned, unwrapped', async () => {
      vi.mocked(calendarGroupsSlotsQuotaRulesList).mockResolvedValue(
        makeListResponse([])
      );
      const createdRule = makeRule({
        id: 501,
        calendar_id: 42,
        period: 'week',
        cap: 3,
      });
      vi.mocked(calendarGroupsSlotsQuotaRulesCreate).mockResolvedValue({
        data: createdRule,
        response: new Response(null, { status: 201 }),
      } as unknown as Awaited<
        ReturnType<typeof calendarGroupsSlotsQuotaRulesCreate>
      >);

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useGroupScopedQuota({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      let writeResult:
        | Awaited<ReturnType<typeof result.current.createQuotaRule>>
        | undefined;
      await act(async () => {
        writeResult = await result.current.createQuotaRule({
          groupId: 1,
          slotId: 10,
          body: { calendar: 42, period: 'week', cap: 3 },
        });
      });

      // The request body carried period and cap through untouched.
      expect(
        vi.mocked(calendarGroupsSlotsQuotaRulesCreate)
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { calendar: 42, period: 'week', cap: 3 },
        })
      );

      // The response is the rule directly — not a write-result wrapper, and
      // not an `orphaned_bookings`-carrying shape (there is none for quota).
      expect(writeResult).toEqual(createdRule);
      expect(writeResult).not.toHaveProperty('orphaned_bookings');
    });

    it('invalidates the slot list query on success', async () => {
      vi.mocked(calendarGroupsSlotsQuotaRulesList).mockResolvedValue(
        makeListResponse([])
      );
      vi.mocked(calendarGroupsSlotsQuotaRulesCreate).mockResolvedValue({
        data: makeRule({}),
        response: new Response(null, { status: 201 }),
      } as unknown as Awaited<
        ReturnType<typeof calendarGroupsSlotsQuotaRulesCreate>
      >);

      const { Wrapper } = makeQueryWrapper();

      const { result } = renderHook(
        () => useGroupScopedQuota({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const callsBeforeMutation = vi.mocked(calendarGroupsSlotsQuotaRulesList)
        .mock.calls.length;

      await act(async () => {
        await result.current.createQuotaRule({
          groupId: 1,
          slotId: 10,
          body: { calendar: 42, period: 'day', cap: 1 },
        });
      });

      await waitFor(() => {
        expect(
          vi.mocked(calendarGroupsSlotsQuotaRulesList).mock.calls.length
        ).toBeGreaterThan(callsBeforeMutation);
      });
    });
  });

  // -------------------------------------------------------------------------
  // updateQuotaRule
  // -------------------------------------------------------------------------

  describe('updateQuotaRule', () => {
    beforeEach(() => {
      vi.mocked(calendarGroupsSlotsQuotaRulesList).mockResolvedValue(
        makeListResponse([])
      );
    });

    it('sends period and cap in the update body and resolves the updated rule', async () => {
      const updatedRule = makeRule({ id: 501, period: 'month', cap: 5 });
      vi.mocked(calendarGroupsSlotsQuotaRulesPartialUpdate).mockResolvedValue({
        data: updatedRule,
        response: new Response(null, { status: 200 }),
      } as unknown as Awaited<
        ReturnType<typeof calendarGroupsSlotsQuotaRulesPartialUpdate>
      >);

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useGroupScopedQuota({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      let writeResult:
        | Awaited<ReturnType<typeof result.current.updateQuotaRule>>
        | undefined;
      await act(async () => {
        writeResult = await result.current.updateQuotaRule({
          groupId: 1,
          slotId: 10,
          ruleId: 501,
          body: { period: 'month', cap: 5 },
        });
      });

      expect(
        vi.mocked(calendarGroupsSlotsQuotaRulesPartialUpdate)
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { period: 'month', cap: 5 },
        })
      );
      expect(writeResult).toEqual(updatedRule);
    });

    it('omitting period sends a body with only cap (period unchanged)', async () => {
      vi.mocked(calendarGroupsSlotsQuotaRulesPartialUpdate).mockResolvedValue({
        data: makeRule({ id: 501, cap: 4 }),
        response: new Response(null, { status: 200 }),
      } as unknown as Awaited<
        ReturnType<typeof calendarGroupsSlotsQuotaRulesPartialUpdate>
      >);

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useGroupScopedQuota({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await act(async () => {
        await result.current.updateQuotaRule({
          groupId: 1,
          slotId: 10,
          ruleId: 501,
          body: { cap: 4 },
        });
      });

      const call = vi.mocked(calendarGroupsSlotsQuotaRulesPartialUpdate).mock
        .calls[0]?.[0] as { body: Record<string, unknown> };
      expect('period' in call.body).toBe(false);
      expect(call.body).toEqual({ cap: 4 });
    });

    it('invalidates the slot list query on success', async () => {
      vi.mocked(calendarGroupsSlotsQuotaRulesPartialUpdate).mockResolvedValue({
        data: makeRule({}),
        response: new Response(null, { status: 200 }),
      } as unknown as Awaited<
        ReturnType<typeof calendarGroupsSlotsQuotaRulesPartialUpdate>
      >);

      const { Wrapper } = makeQueryWrapper();

      const { result } = renderHook(
        () => useGroupScopedQuota({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const callsBeforeMutation = vi.mocked(calendarGroupsSlotsQuotaRulesList)
        .mock.calls.length;

      await act(async () => {
        await result.current.updateQuotaRule({
          groupId: 1,
          slotId: 10,
          ruleId: 501,
          body: { cap: 2 },
        });
      });

      await waitFor(() => {
        expect(
          vi.mocked(calendarGroupsSlotsQuotaRulesList).mock.calls.length
        ).toBeGreaterThan(callsBeforeMutation);
      });
    });
  });

  // -------------------------------------------------------------------------
  // deleteQuotaRule
  // -------------------------------------------------------------------------

  describe('deleteQuotaRule', () => {
    beforeEach(() => {
      vi.mocked(calendarGroupsSlotsQuotaRulesList).mockResolvedValue(
        makeListResponse([])
      );
    });

    it('resolves { status: "deleted" } on 204 and invalidates the list', async () => {
      vi.mocked(calendarGroupsSlotsQuotaRulesDestroy).mockResolvedValue({
        data: undefined,
        response: new Response(null, { status: 204 }),
      } as unknown as Awaited<
        ReturnType<typeof calendarGroupsSlotsQuotaRulesDestroy>
      >);

      const { Wrapper } = makeQueryWrapper();

      const { result } = renderHook(
        () => useGroupScopedQuota({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const callsBeforeMutation = vi.mocked(calendarGroupsSlotsQuotaRulesList)
        .mock.calls.length;

      let deleteResult:
        | Awaited<ReturnType<typeof result.current.deleteQuotaRule>>
        | undefined;
      await act(async () => {
        deleteResult = await result.current.deleteQuotaRule({
          groupId: 1,
          slotId: 10,
          ruleId: 501,
        });
      });

      expect(deleteResult).toEqual({ status: 'deleted' });
      await waitFor(() => {
        expect(
          vi.mocked(calendarGroupsSlotsQuotaRulesList).mock.calls.length
        ).toBeGreaterThan(callsBeforeMutation);
      });
    });

    it('resolves { status: "row_gone" } on 404 -- not a rejection', async () => {
      vi.mocked(calendarGroupsSlotsQuotaRulesDestroy).mockResolvedValue({
        data: undefined,
        response: new Response(JSON.stringify({ detail: 'Not found.' }), {
          status: 404,
        }),
      } as unknown as Awaited<
        ReturnType<typeof calendarGroupsSlotsQuotaRulesDestroy>
      >);

      const { Wrapper } = makeQueryWrapper();

      const { result } = renderHook(
        () => useGroupScopedQuota({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const callsBeforeMutation = vi.mocked(calendarGroupsSlotsQuotaRulesList)
        .mock.calls.length;

      let deleteResult:
        | Awaited<ReturnType<typeof result.current.deleteQuotaRule>>
        | undefined;
      let threw = false;
      await act(async () => {
        try {
          deleteResult = await result.current.deleteQuotaRule({
            groupId: 1,
            slotId: 10,
            ruleId: 501,
          });
        } catch {
          threw = true;
        }
      });

      expect(threw).toBe(false);
      expect(deleteResult).toEqual({ status: 'row_gone' });
      await waitFor(() => {
        expect(
          vi.mocked(calendarGroupsSlotsQuotaRulesList).mock.calls.length
        ).toBeGreaterThan(callsBeforeMutation);
      });
    });

    it('rejects on a transport failure (500) rather than returning row_gone', async () => {
      vi.mocked(calendarGroupsSlotsQuotaRulesDestroy).mockResolvedValue({
        data: undefined,
        response: new Response(null, { status: 500 }),
      } as unknown as Awaited<
        ReturnType<typeof calendarGroupsSlotsQuotaRulesDestroy>
      >);

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useGroupScopedQuota({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await expect(
        result.current.deleteQuotaRule({ groupId: 1, slotId: 10, ruleId: 501 })
      ).rejects.toThrow();
    });
  });
});
