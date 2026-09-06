/**
 * useAppointmentType tests.
 *
 * Covers:
 * - 200 → returns the appointment type, isNotFound:false
 * - 404 → returns null + isNotFound:true, NOT an error (non-disclosure state)
 * - Other non-ok → isError:true
 * - Rejection (network failure) → isError:true
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    appointmentTypesRetrieve: vi.fn(),
  };
});

import { appointmentTypesRetrieve } from '@/client/sdk.gen';
import { useAppointmentType } from './use-appointment-type';
import type { AppointmentType } from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_APPOINTMENT_TYPE: AppointmentType = {
  id: 1,
  name: 'Surgery Team',
  description: 'Operating room coverage',
  slots: [],
  public_booking_slug: 'surgery-team',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AppointmentTypeRetrieveResult = Awaited<
  ReturnType<typeof appointmentTypesRetrieve>
>;

function makeOkResponse(
  appointmentType: AppointmentType
): AppointmentTypeRetrieveResult {
  return {
    data: appointmentType,
    response: new Response(JSON.stringify(appointmentType), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as AppointmentTypeRetrieveResult;
}

function make404Response(): AppointmentTypeRetrieveResult {
  return {
    data: undefined,
    response: new Response(JSON.stringify({ detail: 'Not found.' }), {
      status: 404,
    }),
  } as unknown as AppointmentTypeRetrieveResult;
}

function make500Response(): AppointmentTypeRetrieveResult {
  return {
    data: undefined,
    response: new Response(null, { status: 500 }),
  } as unknown as AppointmentTypeRetrieveResult;
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
  return { Wrapper, queryClient };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAppointmentType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the appointment type and isNotFound:false on 200', async () => {
    vi.mocked(appointmentTypesRetrieve).mockResolvedValue(
      makeOkResponse(FIXTURE_APPOINTMENT_TYPE)
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useAppointmentType('1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.appointmentType).toEqual(FIXTURE_APPOINTMENT_TYPE);
    expect(result.current.isNotFound).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('maps 404 to isNotFound:true, NOT an error', async () => {
    vi.mocked(appointmentTypesRetrieve).mockResolvedValue(make404Response());

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useAppointmentType('999'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.appointmentType).toBeNull();
    expect(result.current.isNotFound).toBe(true);
    // 404 is a normal, handled state — must NOT be flagged as an error.
    expect(result.current.isError).toBe(false);
  });

  it('sets isError:true (and isNotFound:false) on a non-404 error status', async () => {
    vi.mocked(appointmentTypesRetrieve).mockResolvedValue(make500Response());

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useAppointmentType('1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.isNotFound).toBe(false);
    expect(result.current.appointmentType).toBeNull();
  });

  it('sets isError:true when appointmentTypesRetrieve rejects', async () => {
    vi.mocked(appointmentTypesRetrieve).mockRejectedValue(
      new Error('Network error')
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useAppointmentType('1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.isNotFound).toBe(false);
  });
});
