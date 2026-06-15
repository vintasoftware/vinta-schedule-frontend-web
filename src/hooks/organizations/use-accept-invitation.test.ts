/**
 * useAcceptInvitation tests (Phase 7 — UC4b).
 *
 * Covers:
 * - On success: invalidates MY_ORGANIZATIONS_QUERY_KEY and
 *   CURRENT_ORGANIZATION_QUERY_KEY.
 * - On success: detects the newly-joined org via fetchQuery diff and calls
 *   setActiveOrganizationId with the new org's id.
 * - WARM-LOAD: user had org A, accepted invite into org B → switches to B.
 * - COLD-LOAD: user had no orgs (before=[]), accepted → switches to B.
 * - AMBIGUOUS: two new orgs appear → does NOT call setActiveOrganizationId.
 * - When no new org is detected (already had both), leaves selection unchanged.
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
    organizationsMineList: vi.fn(),
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

import {
  invitationsAcceptCreate,
  organizationsMineList,
} from '@/client/sdk.gen';
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

// ---------------------------------------------------------------------------
// SDK response helpers
// ---------------------------------------------------------------------------

function makeAcceptResponse(
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

function makeMineListResponse(
  data: MyMembership[]
): Awaited<ReturnType<typeof organizationsMineList>> {
  return {
    data,
    response: new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof organizationsMineList>>;
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
      makeAcceptResponse(ACCEPT_TOKEN_RESPONSE)
    );
    // before: [A], after: [A, B]
    vi.mocked(organizationsMineList)
      .mockResolvedValueOnce(makeMineListResponse([MEMBERSHIP_A]))
      .mockResolvedValueOnce(
        makeMineListResponse([MEMBERSHIP_A, MEMBERSHIP_B])
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
      makeAcceptResponse(ACCEPT_TOKEN_RESPONSE)
    );
    // before: [A], after: [A, B]
    vi.mocked(organizationsMineList)
      .mockResolvedValueOnce(makeMineListResponse([MEMBERSHIP_A]))
      .mockResolvedValueOnce(
        makeMineListResponse([MEMBERSHIP_A, MEMBERSHIP_B])
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

  // -------------------------------------------------------------------------
  // WARM-LOAD: user already had org A, accepts invite into org B → switches to B
  // -------------------------------------------------------------------------

  it('WARM-LOAD: calls setActiveOrganizationId with B when user had A before and B appears after', async () => {
    vi.mocked(invitationsAcceptCreate).mockResolvedValue(
      makeAcceptResponse(ACCEPT_TOKEN_RESPONSE)
    );
    // before=[A], after=[A, B] — B is the new membership
    vi.mocked(organizationsMineList)
      .mockResolvedValueOnce(makeMineListResponse([MEMBERSHIP_A]))
      .mockResolvedValueOnce(
        makeMineListResponse([MEMBERSHIP_A, MEMBERSHIP_B])
      );

    const queryClient = makeQueryClient();

    const { result } = renderHook(() => useAcceptInvitation(), {
      wrapper: makeQueryWrapper(queryClient),
    });

    await act(async () => {
      await result.current.acceptInvitation({ token: 'tok' });
    });

    await waitFor(() => {
      expect(mockSetActiveOrganizationId).toHaveBeenCalledWith('2');
    });

    // Non-vacuity: if the diff were broken (e.g. before === after), this would fail.
    expect(mockSetActiveOrganizationId).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // COLD-LOAD: user had no orgs before (cold accept page visit) → switches to B
  // -------------------------------------------------------------------------

  it('COLD-LOAD: calls setActiveOrganizationId with B when before=[] and after=[B]', async () => {
    vi.mocked(invitationsAcceptCreate).mockResolvedValue(
      makeAcceptResponse(ACCEPT_TOKEN_RESPONSE)
    );
    // before=[], after=[B] — proves it works with no prior observer/cache
    vi.mocked(organizationsMineList)
      .mockResolvedValueOnce(makeMineListResponse([]))
      .mockResolvedValueOnce(makeMineListResponse([MEMBERSHIP_B]));

    const queryClient = makeQueryClient();

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

  // -------------------------------------------------------------------------
  // AMBIGUOUS: two new orgs appear → graceful fallback, no switch
  // -------------------------------------------------------------------------

  it('AMBIGUOUS: does NOT call setActiveOrganizationId when two new orgs appear', async () => {
    vi.mocked(invitationsAcceptCreate).mockResolvedValue(
      makeAcceptResponse(ACCEPT_TOKEN_RESPONSE)
    );
    // before=[], after=[A, B] — ambiguous, cannot determine which is "the" new org
    vi.mocked(organizationsMineList)
      .mockResolvedValueOnce(makeMineListResponse([]))
      .mockResolvedValueOnce(
        makeMineListResponse([MEMBERSHIP_A, MEMBERSHIP_B])
      );

    const queryClient = makeQueryClient();

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

  it('does NOT call setActiveOrganizationId when no new org is detected (already had both)', async () => {
    vi.mocked(invitationsAcceptCreate).mockResolvedValue(
      makeAcceptResponse(ACCEPT_TOKEN_RESPONSE)
    );
    // before=[A, B], after=[A, B] — no diff, no switch
    vi.mocked(organizationsMineList)
      .mockResolvedValueOnce(makeMineListResponse([MEMBERSHIP_A, MEMBERSHIP_B]))
      .mockResolvedValueOnce(
        makeMineListResponse([MEMBERSHIP_A, MEMBERSHIP_B])
      );

    const queryClient = makeQueryClient();

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
    // before fetch still resolves (fetchQuery runs before the accept)
    vi.mocked(organizationsMineList).mockResolvedValueOnce(
      makeMineListResponse([MEMBERSHIP_A])
    );

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
