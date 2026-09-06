/**
 * useAppointmentTypeScopedQuota tests.
 *
 * Covers:
 * - list: appointment_type_id/slot_id go through as path params, calendarId filters the
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
import type { AppointmentTypeScopedQuotaRule } from '@/client';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    appointmentTypesSlotsQuotaRulesList: vi.fn(),
    appointmentTypesSlotsQuotaRulesCreate: vi.fn(),
    appointmentTypesSlotsQuotaRulesPartialUpdate: vi.fn(),
    appointmentTypesSlotsQuotaRulesDestroy: vi.fn(),
  };
});

import {
  appointmentTypesSlotsQuotaRulesList,
  appointmentTypesSlotsQuotaRulesCreate,
  appointmentTypesSlotsQuotaRulesPartialUpdate,
  appointmentTypesSlotsQuotaRulesDestroy,
} from '@/client/sdk.gen';
import {
  useAppointmentTypeScopedQuota,
  APPOINTMENT_TYPE_SCOPED_QUOTA_PAGE_SIZE,
} from './use-appointment-type-scoped-quota';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRule(
  overrides: Partial<AppointmentTypeScopedQuotaRule>
): AppointmentTypeScopedQuotaRule {
  return {
    id: 1,
    calendar_id: 42,
    appointment_type_slot_id: 7,
    period: 'week',
    cap: 3,
    created: '2026-01-01T00:00:00Z',
    modified: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeListResponse(results: AppointmentTypeScopedQuotaRule[]) {
  const body = { count: results.length, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Awaited<
    ReturnType<typeof appointmentTypesSlotsQuotaRulesList>
  >;
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

describe('useAppointmentTypeScopedQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------

  describe('list', () => {
    it('requests the list by appointment_type_id/slot_id path params', async () => {
      vi.mocked(appointmentTypesSlotsQuotaRulesList).mockResolvedValue(
        makeListResponse([])
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedQuota({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(
        vi.mocked(appointmentTypesSlotsQuotaRulesList)
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { appointment_type_id: 1, slot_id: 10 },
          query: { limit: APPOINTMENT_TYPE_SCOPED_QUOTA_PAGE_SIZE },
        })
      );
    });

    it('returns every row when calendarId is omitted', async () => {
      vi.mocked(appointmentTypesSlotsQuotaRulesList).mockResolvedValue(
        makeListResponse([
          makeRule({ id: 1, calendar_id: 42 }),
          makeRule({ id: 2, calendar_id: 43 }),
        ])
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedQuota({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.rules.map((r) => r.id)).toEqual([1, 2]);
    });

    it('filters to one calendar client-side when calendarId is set', async () => {
      vi.mocked(appointmentTypesSlotsQuotaRulesList).mockResolvedValue(
        makeListResponse([
          makeRule({ id: 1, calendar_id: 42 }),
          makeRule({ id: 2, calendar_id: 43 }),
          makeRule({ id: 3, calendar_id: 42, period: 'day' }),
        ])
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedQuota({
            appointmentTypeId: 1,
            slotId: 10,
            calendarId: 42,
          }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.rules.map((r) => r.id)).toEqual([1, 3]);
    });

    it('isTruncated is true when count > page size', async () => {
      vi.mocked(appointmentTypesSlotsQuotaRulesList).mockResolvedValue({
        data: {
          count: 250,
          results: Array.from({ length: 200 }, (_, i) =>
            makeRule({ id: i + 1 })
          ),
        },
        response: new Response(null, { status: 200 }),
      } as unknown as Awaited<
        ReturnType<typeof appointmentTypesSlotsQuotaRulesList>
      >);

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedQuota({ appointmentTypeId: 1, slotId: 10 }),
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
      vi.mocked(appointmentTypesSlotsQuotaRulesList).mockResolvedValue(
        makeListResponse([])
      );
      const createdRule = makeRule({
        id: 501,
        calendar_id: 42,
        period: 'week',
        cap: 3,
      });
      vi.mocked(appointmentTypesSlotsQuotaRulesCreate).mockResolvedValue({
        data: createdRule,
        response: new Response(null, { status: 201 }),
      } as unknown as Awaited<
        ReturnType<typeof appointmentTypesSlotsQuotaRulesCreate>
      >);

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedQuota({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      let writeResult:
        | Awaited<ReturnType<typeof result.current.createQuotaRule>>
        | undefined;
      await act(async () => {
        writeResult = await result.current.createQuotaRule({
          appointmentTypeId: 1,
          slotId: 10,
          body: { calendar: 42, period: 'week', cap: 3 },
        });
      });

      // The request body carried period and cap through untouched.
      expect(
        vi.mocked(appointmentTypesSlotsQuotaRulesCreate)
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
      vi.mocked(appointmentTypesSlotsQuotaRulesList).mockResolvedValue(
        makeListResponse([])
      );
      vi.mocked(appointmentTypesSlotsQuotaRulesCreate).mockResolvedValue({
        data: makeRule({}),
        response: new Response(null, { status: 201 }),
      } as unknown as Awaited<
        ReturnType<typeof appointmentTypesSlotsQuotaRulesCreate>
      >);

      const { Wrapper } = makeQueryWrapper();

      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedQuota({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const callsBeforeMutation = vi.mocked(appointmentTypesSlotsQuotaRulesList)
        .mock.calls.length;

      await act(async () => {
        await result.current.createQuotaRule({
          appointmentTypeId: 1,
          slotId: 10,
          body: { calendar: 42, period: 'day', cap: 1 },
        });
      });

      await waitFor(() => {
        expect(
          vi.mocked(appointmentTypesSlotsQuotaRulesList).mock.calls.length
        ).toBeGreaterThan(callsBeforeMutation);
      });
    });
  });

  // -------------------------------------------------------------------------
  // updateQuotaRule
  // -------------------------------------------------------------------------

  describe('updateQuotaRule', () => {
    beforeEach(() => {
      vi.mocked(appointmentTypesSlotsQuotaRulesList).mockResolvedValue(
        makeListResponse([])
      );
    });

    it('sends period and cap in the update body and resolves the updated rule', async () => {
      const updatedRule = makeRule({ id: 501, period: 'month', cap: 5 });
      vi.mocked(appointmentTypesSlotsQuotaRulesPartialUpdate).mockResolvedValue(
        {
          data: updatedRule,
          response: new Response(null, { status: 200 }),
        } as unknown as Awaited<
          ReturnType<typeof appointmentTypesSlotsQuotaRulesPartialUpdate>
        >
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedQuota({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      let writeResult:
        | Awaited<ReturnType<typeof result.current.updateQuotaRule>>
        | undefined;
      await act(async () => {
        writeResult = await result.current.updateQuotaRule({
          appointmentTypeId: 1,
          slotId: 10,
          ruleId: 501,
          body: { period: 'month', cap: 5 },
        });
      });

      expect(
        vi.mocked(appointmentTypesSlotsQuotaRulesPartialUpdate)
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { period: 'month', cap: 5 },
        })
      );
      expect(writeResult).toEqual(updatedRule);
    });

    it('omitting period sends a body with only cap (period unchanged)', async () => {
      vi.mocked(appointmentTypesSlotsQuotaRulesPartialUpdate).mockResolvedValue(
        {
          data: makeRule({ id: 501, cap: 4 }),
          response: new Response(null, { status: 200 }),
        } as unknown as Awaited<
          ReturnType<typeof appointmentTypesSlotsQuotaRulesPartialUpdate>
        >
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedQuota({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await act(async () => {
        await result.current.updateQuotaRule({
          appointmentTypeId: 1,
          slotId: 10,
          ruleId: 501,
          body: { cap: 4 },
        });
      });

      const call = vi.mocked(appointmentTypesSlotsQuotaRulesPartialUpdate).mock
        .calls[0]?.[0] as { body: Record<string, unknown> };
      expect('period' in call.body).toBe(false);
      expect(call.body).toEqual({ cap: 4 });
    });

    it('invalidates the slot list query on success', async () => {
      vi.mocked(appointmentTypesSlotsQuotaRulesPartialUpdate).mockResolvedValue(
        {
          data: makeRule({}),
          response: new Response(null, { status: 200 }),
        } as unknown as Awaited<
          ReturnType<typeof appointmentTypesSlotsQuotaRulesPartialUpdate>
        >
      );

      const { Wrapper } = makeQueryWrapper();

      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedQuota({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const callsBeforeMutation = vi.mocked(appointmentTypesSlotsQuotaRulesList)
        .mock.calls.length;

      await act(async () => {
        await result.current.updateQuotaRule({
          appointmentTypeId: 1,
          slotId: 10,
          ruleId: 501,
          body: { cap: 2 },
        });
      });

      await waitFor(() => {
        expect(
          vi.mocked(appointmentTypesSlotsQuotaRulesList).mock.calls.length
        ).toBeGreaterThan(callsBeforeMutation);
      });
    });
  });

  // -------------------------------------------------------------------------
  // deleteQuotaRule
  // -------------------------------------------------------------------------

  describe('deleteQuotaRule', () => {
    beforeEach(() => {
      vi.mocked(appointmentTypesSlotsQuotaRulesList).mockResolvedValue(
        makeListResponse([])
      );
    });

    it('resolves { status: "deleted" } on 204 and invalidates the list', async () => {
      vi.mocked(appointmentTypesSlotsQuotaRulesDestroy).mockResolvedValue({
        data: undefined,
        response: new Response(null, { status: 204 }),
      } as unknown as Awaited<
        ReturnType<typeof appointmentTypesSlotsQuotaRulesDestroy>
      >);

      const { Wrapper } = makeQueryWrapper();

      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedQuota({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const callsBeforeMutation = vi.mocked(appointmentTypesSlotsQuotaRulesList)
        .mock.calls.length;

      let deleteResult:
        | Awaited<ReturnType<typeof result.current.deleteQuotaRule>>
        | undefined;
      await act(async () => {
        deleteResult = await result.current.deleteQuotaRule({
          appointmentTypeId: 1,
          slotId: 10,
          ruleId: 501,
        });
      });

      expect(deleteResult).toEqual({ status: 'deleted' });
      await waitFor(() => {
        expect(
          vi.mocked(appointmentTypesSlotsQuotaRulesList).mock.calls.length
        ).toBeGreaterThan(callsBeforeMutation);
      });
    });

    it('resolves { status: "row_gone" } on 404 -- not a rejection', async () => {
      vi.mocked(appointmentTypesSlotsQuotaRulesDestroy).mockResolvedValue({
        data: undefined,
        response: new Response(JSON.stringify({ detail: 'Not found.' }), {
          status: 404,
        }),
      } as unknown as Awaited<
        ReturnType<typeof appointmentTypesSlotsQuotaRulesDestroy>
      >);

      const { Wrapper } = makeQueryWrapper();

      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedQuota({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const callsBeforeMutation = vi.mocked(appointmentTypesSlotsQuotaRulesList)
        .mock.calls.length;

      let deleteResult:
        | Awaited<ReturnType<typeof result.current.deleteQuotaRule>>
        | undefined;
      let threw = false;
      await act(async () => {
        try {
          deleteResult = await result.current.deleteQuotaRule({
            appointmentTypeId: 1,
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
          vi.mocked(appointmentTypesSlotsQuotaRulesList).mock.calls.length
        ).toBeGreaterThan(callsBeforeMutation);
      });
    });

    it('rejects on a transport failure (500) rather than returning row_gone', async () => {
      vi.mocked(appointmentTypesSlotsQuotaRulesDestroy).mockResolvedValue({
        data: undefined,
        response: new Response(null, { status: 500 }),
      } as unknown as Awaited<
        ReturnType<typeof appointmentTypesSlotsQuotaRulesDestroy>
      >);

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedQuota({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await expect(
        result.current.deleteQuotaRule({
          appointmentTypeId: 1,
          slotId: 10,
          ruleId: 501,
        })
      ).rejects.toThrow();
    });
  });
});
