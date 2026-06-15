/**
 * useAcceptInvitation tests (Phase 7 — UC4b).
 *
 * Covers:
 * - On success: invalidates MY_ORGANIZATIONS_QUERY_KEY and
 *   CURRENT_ORGANIZATION_QUERY_KEY.
 * - On success: detects the newly-joined org via cache-diff and calls
 *   setActiveOrganizationId with the new org's id.
 * - When no new org can be detected (e.g. already had it), leaves selection
 *   unchanged (setActiveOrganizationId NOT called with a new id).
 * - isAlreadyMemberError returns true for the new message "User is already a
 *   member of this organization." and for the DRF code
 *   "user_already_has_membership".
 * - isAlreadyMemberError returns false for unrelated errors.
 * - getAcceptInvitationErrorMessage extracts the error.error string.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import type { AcceptInvitation, MyMembership } from '@/client';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    invitationsAcceptCreate: vi.fn(),
  };
});

// Use vi.hoisted so the mock fn is initialized before vi.mock's factory runs.
const { mockSetActiveOrganizationId } = vi.hoisted(() => ({
  mockSetActiveOrganizationId: vi.fn(),
}));

// Mock the active-organization store so we can assert setActiveOrganizationId
// is called with the correct id without touching localStorage.
vi.mock('@/lib/active-organization', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/lib/active-organization')>();
  return {
    ...original,
    setActiveOrganizationId: mockSetActiveOrganizationId,
  };
});

import { invitationsAcceptCreate } from '@/client/sdk.gen';
import { CURRENT_ORGANIZATION_QUERY_KEY } from './use-current-organization';
import { MY_ORGANIZATIONS_QUERY_KEY } from './use-my-organizations';
import {
  useAcceptInvitation,
  isAlreadyMemberError,
  getAcceptInvitationErrorMessage,
} from './use-accept-invitation';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACCEPT_TOKEN_RESPONSE: AcceptInvitation = { token: 'test-token-123' };

const MEMBERSHIP_A: MyMembership = {
  organization: { id: 1, name: 'Org A' },
  role: 'admin',
};
const MEMBERSHIP_B: MyMembership = {
  organization: { id: 2, name: 'Org B' },
  role: 'member',
};

function makeSuccessResponse(
  data: AcceptInvitation
): Awaited<ReturnType<typeof invitationsAcceptCreate>> {
  return {
    data,
    response: new Response(JSON.stringify(data), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof invitationsAcceptCreate>>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryWrapper(queryClient: QueryClient) {
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  }
  return Wrapper;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

// ---------------------------------------------------------------------------
// Tests — isAlreadyMemberError
// ---------------------------------------------------------------------------

describe('isAlreadyMemberError', () => {
  it('returns true for the new same-org-duplicate message', () => {
    const err = { error: 'User is already a member of this organization.' };
    expect(isAlreadyMemberError(err)).toBe(true);
  });

  it('returns true for the DRF code user_already_has_membership', () => {
    const err = {
      error: 'User is already a member of this organization.',
      code: 'user_already_has_membership',
    };
    expect(isAlreadyMemberError(err)).toBe(true);
  });

  it('returns true for code-only match (message may differ in future)', () => {
    const err = { code: 'user_already_has_membership', error: 'Some message.' };
    expect(isAlreadyMemberError(err)).toBe(true);
  });

  it('returns false for the OLD one-org-per-user message (semantics changed)', () => {
    const err = { error: 'User already belongs to an organization.' };
    expect(isAlreadyMemberError(err)).toBe(false);
  });

  it('returns false for an unrelated 400 error', () => {
    const err = { error: 'Token not found.' };
    expect(isAlreadyMemberError(err)).toBe(false);
  });

  it('returns false for a generic Error instance', () => {
    expect(isAlreadyMemberError(new Error('Network error'))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isAlreadyMemberError(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests — getAcceptInvitationErrorMessage
// ---------------------------------------------------------------------------

describe('getAcceptInvitationErrorMessage', () => {
  it('extracts message from { error: string }', () => {
    expect(getAcceptInvitationErrorMessage({ error: 'Token expired.' })).toBe(
      'Token expired.'
    );
  });

  it('falls back to Error.message', () => {
    expect(getAcceptInvitationErrorMessage(new Error('Network error'))).toBe(
      'Network error'
    );
  });

  it('falls back to generic string for unknown shape', () => {
    expect(getAcceptInvitationErrorMessage({ detail: 'something' })).toBe(
      'Could not accept the invitation.'
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — useAcceptInvitation (cache invalidation + auto-switch)
// ---------------------------------------------------------------------------

describe('useAcceptInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invalidates MY_ORGANIZATIONS_QUERY_KEY on success', async () => {
    vi.mocked(invitationsAcceptCreate).mockResolvedValue(
      makeSuccessResponse(ACCEPT_TOKEN_RESPONSE)
    );

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAcceptInvitation(), {
      wrapper: makeQueryWrapper(queryClient),
    });

    await act(async () => {
      await result.current.acceptInvitation({ token: 'tok' });
    });

    await waitFor(() => {
      expect(
        invalidateSpy.mock.calls.some(
          (call) =>
            JSON.stringify(call[0]) ===
            JSON.stringify({ queryKey: MY_ORGANIZATIONS_QUERY_KEY })
        )
      ).toBe(true);
    });
  });

  it('invalidates CURRENT_ORGANIZATION_QUERY_KEY on success', async () => {
    vi.mocked(invitationsAcceptCreate).mockResolvedValue(
      makeSuccessResponse(ACCEPT_TOKEN_RESPONSE)
    );

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAcceptInvitation(), {
      wrapper: makeQueryWrapper(queryClient),
    });

    await act(async () => {
      await result.current.acceptInvitation({ token: 'tok' });
    });

    await waitFor(() => {
      expect(
        invalidateSpy.mock.calls.some(
          (call) =>
            JSON.stringify(call[0]) ===
            JSON.stringify({ queryKey: CURRENT_ORGANIZATION_QUERY_KEY })
        )
      ).toBe(true);
    });
  });

  it('calls setActiveOrganizationId with the new org id detected via cache-diff', async () => {
    vi.mocked(invitationsAcceptCreate).mockResolvedValue(
      makeSuccessResponse(ACCEPT_TOKEN_RESPONSE)
    );

    const queryClient = makeQueryClient();

    // Seed "before" state: only MEMBERSHIP_A in cache.
    queryClient.setQueryData(MY_ORGANIZATIONS_QUERY_KEY, [MEMBERSHIP_A]);

    // After invalidation, the query refetch will return both A and B.
    // We mock invalidateQueries to also update the cache with the new data.
    const originalInvalidate = queryClient.invalidateQueries.bind(queryClient);
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(
      async (filters, options) => {
        const result = await originalInvalidate(filters, options);
        // Simulate the refetch: update cache to show both memberships.
        if (
          filters &&
          typeof filters === 'object' &&
          'queryKey' in filters &&
          JSON.stringify(filters.queryKey) ===
            JSON.stringify(MY_ORGANIZATIONS_QUERY_KEY)
        ) {
          queryClient.setQueryData(MY_ORGANIZATIONS_QUERY_KEY, [
            MEMBERSHIP_A,
            MEMBERSHIP_B,
          ]);
        }
        return result;
      }
    );

    const { result } = renderHook(() => useAcceptInvitation(), {
      wrapper: makeQueryWrapper(queryClient),
    });

    await act(async () => {
      await result.current.acceptInvitation({ token: 'tok' });
    });

    await waitFor(() => {
      expect(mockSetActiveOrganizationId).toHaveBeenCalledWith('2');
    });
  });

  it('does NOT call setActiveOrganizationId when no new org is detected (e.g. already had both)', async () => {
    vi.mocked(invitationsAcceptCreate).mockResolvedValue(
      makeSuccessResponse(ACCEPT_TOKEN_RESPONSE)
    );

    const queryClient = makeQueryClient();

    // Both orgs already in cache before the accept — no new org appears.
    queryClient.setQueryData(MY_ORGANIZATIONS_QUERY_KEY, [
      MEMBERSHIP_A,
      MEMBERSHIP_B,
    ]);

    const { result } = renderHook(() => useAcceptInvitation(), {
      wrapper: makeQueryWrapper(queryClient),
    });

    await act(async () => {
      await result.current.acceptInvitation({ token: 'tok' });
    });

    await waitFor(() =>
      expect(result.current.acceptInvitationMutation.isSuccess).toBe(true)
    );

    expect(mockSetActiveOrganizationId).not.toHaveBeenCalled();
  });

  it('throws and does NOT invalidate queries when the API fails', async () => {
    const apiError = { error: 'Token not found.' };
    vi.mocked(invitationsAcceptCreate).mockRejectedValue(apiError);

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAcceptInvitation(), {
      wrapper: makeQueryWrapper(queryClient),
    });

    let caughtError: unknown;
    await act(async () => {
      try {
        await result.current.acceptInvitation({ token: 'bad-tok' });
      } catch (err) {
        caughtError = err;
      }
    });

    expect(caughtError).toBe(apiError);
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(mockSetActiveOrganizationId).not.toHaveBeenCalled();
  });
});
