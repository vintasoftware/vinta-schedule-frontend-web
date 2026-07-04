/**
 * useCreateConsent tests.
 *
 * Covers:
 * - On success, `createConsent` resolves to the created `UserConsent`.
 * - `createConsent` calls the generated mutation with the body.
 * - On failure (400, 401), the mutation throws and the error is propagated.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import type { UserConsent, DocumentTypeEnum } from '@/client';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    consentsCreate: vi.fn(),
  };
});

import { consentsCreate } from '@/client/sdk.gen';
import { useCreateConsent } from './use-create-consent';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SMS_CONSENT: UserConsent = {
  id: 42,
  document_type: 'sms_consent',
  policy_document: 1,
  policy_document_version: 1,
  source: 'api',
  accepted_at: '2026-07-04T12:00:00Z',
  ip_address: '192.168.1.1',
  user_agent: 'Mozilla/5.0',
  phone_number: '+14155552671',
};

function makeSuccessResponse(
  consent: UserConsent
): Awaited<ReturnType<typeof consentsCreate>> {
  return {
    data: consent,
    response: new Response(JSON.stringify(consent), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof consentsCreate>>;
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

describe('useCreateConsent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Resolves with the created UserConsent
  // -------------------------------------------------------------------------

  it('resolves with the created UserConsent on success', async () => {
    vi.mocked(consentsCreate).mockResolvedValue(
      makeSuccessResponse(SMS_CONSENT)
    );

    const { Wrapper } = makeQueryWrapper();

    const { result } = renderHook(() => useCreateConsent(), {
      wrapper: Wrapper,
    });

    let createdConsent: UserConsent | undefined;
    await act(async () => {
      createdConsent = await result.current.createConsent({
        document_type: 'sms_consent',
        phone_number: '+14155552671',
      });
    });

    expect(createdConsent).toEqual(SMS_CONSENT);
    expect(createdConsent?.id).toBe(42);
    expect(createdConsent?.phone_number).toBe('+14155552671');
  });

  // -------------------------------------------------------------------------
  // Calls the mutation with the correct body
  // -------------------------------------------------------------------------

  it('calls the generated mutation with the body and body-only path', async () => {
    vi.mocked(consentsCreate).mockResolvedValue(
      makeSuccessResponse(SMS_CONSENT)
    );

    const { Wrapper } = makeQueryWrapper();

    const { result } = renderHook(() => useCreateConsent(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.createConsent({
        document_type: 'sms_consent',
        phone_number: '+14155552671',
      });
    });

    expect(consentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          document_type: 'sms_consent',
          phone_number: '+14155552671',
        },
      })
    );
  });

  // -------------------------------------------------------------------------
  // Handles errors
  // -------------------------------------------------------------------------

  it('propagates a 400 error (invalid document type)', async () => {
    const error400 = new Error('Invalid document type');
    vi.mocked(consentsCreate).mockRejectedValue(error400);

    const { Wrapper } = makeQueryWrapper();

    const { result } = renderHook(() => useCreateConsent(), {
      wrapper: Wrapper,
    });

    let thrownError: Error | undefined;
    await act(async () => {
      await result.current
        .createConsent({
          document_type: 'invalid_type' as unknown as DocumentTypeEnum,
        })
        .catch((err) => {
          thrownError = err;
        });
    });

    await waitFor(() =>
      expect(result.current.createConsentMutation.isError).toBe(true)
    );
    expect(thrownError).toBe(error400);
  });

  it('propagates a 401 error (unauthenticated)', async () => {
    const error401 = new Error('Unauthorized');
    vi.mocked(consentsCreate).mockRejectedValue(error401);

    const { Wrapper } = makeQueryWrapper();

    const { result } = renderHook(() => useCreateConsent(), {
      wrapper: Wrapper,
    });

    let thrownError: Error | undefined;
    await act(async () => {
      await result.current
        .createConsent({
          document_type: 'sms_consent',
        })
        .catch((err) => {
          thrownError = err;
        });
    });

    await waitFor(() =>
      expect(result.current.createConsentMutation.isError).toBe(true)
    );
    expect(thrownError).toBe(error401);
  });

  // -------------------------------------------------------------------------
  // Exposes the raw mutation
  // -------------------------------------------------------------------------

  it('exposes the raw mutation for accessing states', async () => {
    vi.mocked(consentsCreate).mockResolvedValue(
      makeSuccessResponse(SMS_CONSENT)
    );

    const { Wrapper } = makeQueryWrapper();

    const { result } = renderHook(() => useCreateConsent(), {
      wrapper: Wrapper,
    });

    expect(result.current.createConsentMutation).toBeDefined();
    expect(result.current.createConsentMutation.isPending).toBe(false);

    await act(async () => {
      await result.current.createConsent({
        document_type: 'sms_consent',
      });
    });

    await waitFor(() =>
      expect(result.current.createConsentMutation.isSuccess).toBe(true)
    );
    expect(result.current.createConsentMutation.data).toEqual(SMS_CONSENT);
  });
});
