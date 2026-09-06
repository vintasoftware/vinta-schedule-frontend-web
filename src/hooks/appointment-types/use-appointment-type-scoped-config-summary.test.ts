/**
 * useAppointmentTypeScopedConfigSummary tests.
 *
 * Covers:
 * - counts appointment type correctly per calendar_id across the three list responses
 * - a calendar with no rows in a list resolves to 0 for that count
 * - isLoading / isError reflect the underlying queries
 * - isTruncated reflects whether any concept's total count exceeds the
 *   single page fetched
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    appointmentTypesSlotsAvailabilityWindowsList: vi.fn(),
    appointmentTypesSlotsBlockedTimesList: vi.fn(),
    appointmentTypesSlotsQuotaRulesList: vi.fn(),
  };
});

import {
  appointmentTypesSlotsAvailabilityWindowsList,
  appointmentTypesSlotsBlockedTimesList,
  appointmentTypesSlotsQuotaRulesList,
} from '@/client/sdk.gen';
import { useAppointmentTypeScopedConfigSummary } from './use-appointment-type-scoped-config-summary';

function makeListResponse<T>(results: T[]) {
  const body = { count: results.length, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown;
}

function makeErrorResponse() {
  return {
    data: undefined,
    response: new Response(null, { status: 500 }),
  } as unknown;
}

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
  return { Wrapper };
}

describe('useAppointmentTypeScopedConfigSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appointment types counts by calendar_id across the three lists', async () => {
    vi.mocked(appointmentTypesSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse([
        { calendar_id: 1 },
        { calendar_id: 1 },
        { calendar_id: 2 },
      ]) as Awaited<
        ReturnType<typeof appointmentTypesSlotsAvailabilityWindowsList>
      >
    );
    vi.mocked(appointmentTypesSlotsBlockedTimesList).mockResolvedValue(
      makeListResponse([{ calendar_id: 1 }]) as Awaited<
        ReturnType<typeof appointmentTypesSlotsBlockedTimesList>
      >
    );
    vi.mocked(appointmentTypesSlotsQuotaRulesList).mockResolvedValue(
      makeListResponse([]) as Awaited<
        ReturnType<typeof appointmentTypesSlotsQuotaRulesList>
      >
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(
      () =>
        useAppointmentTypeScopedConfigSummary({
          appointmentTypeId: 1,
          slotId: 10,
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.summaryFor(1)).toEqual({
      windowCount: 2,
      blockCount: 1,
      quotaCount: 0,
    });
    // Calendar 2 has one window and nothing else.
    expect(result.current.summaryFor(2)).toEqual({
      windowCount: 1,
      blockCount: 0,
      quotaCount: 0,
    });
    // A calendar absent from every list resolves to all zeros.
    expect(result.current.summaryFor(3)).toEqual({
      windowCount: 0,
      blockCount: 0,
      quotaCount: 0,
    });
    expect(result.current.isError).toBe(false);
  });

  it('sets isError:true when any of the three lists fails', async () => {
    vi.mocked(appointmentTypesSlotsAvailabilityWindowsList).mockResolvedValue(
      makeErrorResponse() as Awaited<
        ReturnType<typeof appointmentTypesSlotsAvailabilityWindowsList>
      >
    );
    vi.mocked(appointmentTypesSlotsBlockedTimesList).mockResolvedValue(
      makeListResponse([]) as Awaited<
        ReturnType<typeof appointmentTypesSlotsBlockedTimesList>
      >
    );
    vi.mocked(appointmentTypesSlotsQuotaRulesList).mockResolvedValue(
      makeListResponse([]) as Awaited<
        ReturnType<typeof appointmentTypesSlotsQuotaRulesList>
      >
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(
      () =>
        useAppointmentTypeScopedConfigSummary({
          appointmentTypeId: 1,
          slotId: 10,
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
  });

  it('sets isTruncated:true when a concept total exceeds the page size', async () => {
    // count (201) > SUMMARY_PAGE_SIZE (200): the single page fetched cannot
    // hold every row, so the per-calendar counts derived from it are a lower
    // bound, not exact.
    vi.mocked(appointmentTypesSlotsAvailabilityWindowsList).mockResolvedValue({
      data: { count: 201, results: [{ calendar_id: 1 }] },
      response: new Response(
        JSON.stringify({ count: 201, results: [{ calendar_id: 1 }] }),
        { status: 200 }
      ),
    } as unknown as Awaited<
      ReturnType<typeof appointmentTypesSlotsAvailabilityWindowsList>
    >);
    vi.mocked(appointmentTypesSlotsBlockedTimesList).mockResolvedValue(
      makeListResponse([]) as Awaited<
        ReturnType<typeof appointmentTypesSlotsBlockedTimesList>
      >
    );
    vi.mocked(appointmentTypesSlotsQuotaRulesList).mockResolvedValue(
      makeListResponse([]) as Awaited<
        ReturnType<typeof appointmentTypesSlotsQuotaRulesList>
      >
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(
      () =>
        useAppointmentTypeScopedConfigSummary({
          appointmentTypeId: 1,
          slotId: 10,
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isTruncated).toBe(true);
  });

  it('sets isTruncated:false when every concept total is within the page size', async () => {
    vi.mocked(appointmentTypesSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse([{ calendar_id: 1 }]) as Awaited<
        ReturnType<typeof appointmentTypesSlotsAvailabilityWindowsList>
      >
    );
    vi.mocked(appointmentTypesSlotsBlockedTimesList).mockResolvedValue(
      makeListResponse([]) as Awaited<
        ReturnType<typeof appointmentTypesSlotsBlockedTimesList>
      >
    );
    vi.mocked(appointmentTypesSlotsQuotaRulesList).mockResolvedValue(
      makeListResponse([]) as Awaited<
        ReturnType<typeof appointmentTypesSlotsQuotaRulesList>
      >
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(
      () =>
        useAppointmentTypeScopedConfigSummary({
          appointmentTypeId: 1,
          slotId: 10,
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isTruncated).toBe(false);
  });
});
