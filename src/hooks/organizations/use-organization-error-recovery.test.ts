/**
 * recoverFromOrganizationQueryError tests (Phase 8 — UC5; Phase 9 — UC6).
 *
 * Covers:
 * ---- 400 path (UC5) ----
 * - 400 detail + no selection + mine [A, B] → setActiveOrganizationId('1') +
 *   invalidateQueries called → returns 'recovered-400'.
 * - 400 detail + mine [] → no set, no invalidate → 'ignored'.
 * - 400 detail + VALID current selection already set → no set, no invalidate →
 *   'ignored' (loop guard).
 * - 400 detail + INVALID (stale) current selection + mine [A] → recovers to A
 *   → returns 'recovered-400'.
 * - non-400 error (500, different detail) → 'ignored', nothing called.
 *
 * ---- 403 stale-org path (UC6) ----
 * - stale-org 403 + mine [A, B] → setActiveOrganizationId('1') + invalidate
 *   + toast → returns 'recovered-403'.
 * - stale-org 403 + mine [] → clearActiveOrganization + no toast → 'ignored'.
 * - 'No active organization membership.' 403 → 'ignored' (NOT treated as stale).
 * - stale-org 403 + VALID current selection → 'ignored' (loop guard).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import type { MyMembership } from '@/client';
import { organizationsMineListQueryKey } from '@/client/@tanstack/react-query.gen';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

// Use vi.hoisted so the mock fns are initialized before vi.mock factories run.
const {
  mockGetActiveOrganizationId,
  mockSetActiveOrganizationId,
  mockClearActiveOrganization,
} = vi.hoisted(() => ({
  mockGetActiveOrganizationId: vi.fn(),
  mockSetActiveOrganizationId: vi.fn(),
  mockClearActiveOrganization: vi.fn(),
}));

vi.mock('@/lib/active-organization', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/lib/active-organization')>();
  return {
    ...original,
    getActiveOrganizationId: mockGetActiveOrganizationId,
    setActiveOrganizationId: mockSetActiveOrganizationId,
    clearActiveOrganization: mockClearActiveOrganization,
  };
});

// Mock sonner toast so tests don't need a DOM toast container.
// Must be hoisted (vi.hoisted) so the mock factory can reference it before imports.
const { mockToast } = vi.hoisted(() => ({
  mockToast: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: mockToast,
}));

import { recoverFromOrganizationQueryError } from './use-organization-error-recovery';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MEMBERSHIP_A: MyMembership = {
  organization: { id: 1, name: 'Org A' },
  role: 'admin',
};
const MEMBERSHIP_B: MyMembership = {
  organization: { id: 2, name: 'Org B' },
  role: 'member',
};

/** The exact 400 body the backend sends for a missing X-Organization-Id. */
const ERROR_400_HEADER_REQUIRED = {
  detail: 'X-Organization-Id header required.',
};

/**
 * The exact 403 body for a stale/non-member header (UC6 — recoverable).
 * Must NOT match the genuine no-membership 403 below.
 */
const ERROR_403_STALE_ORG = {
  detail:
    'X-Organization-Id header names an organization you are not an active member of.',
};

/**
 * The exact 403 body for genuinely having no active membership (NOT recoverable
 * by this function — left to the disabled/no-access gate).
 */
const ERROR_403_NO_MEMBERSHIP = {
  detail: 'No active organization membership.',
};

// ---------------------------------------------------------------------------
// QueryClient mock factory
//
// We don't need a full React wrapper here — the function only uses
// queryClient.fetchQuery and queryClient.invalidateQueries, so we create
// a lightweight mock object.
// ---------------------------------------------------------------------------

function makeMockQueryClient(fetchQueryResult: MyMembership[]) {
  const fetchQuery = vi.fn().mockResolvedValue(fetchQueryResult);
  const invalidateQueries = vi.fn().mockResolvedValue(undefined);
  return {
    fetchQuery,
    invalidateQueries,
  } as unknown as QueryClient;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('recoverFromOrganizationQueryError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToast.mockClear();
  });

  // -------------------------------------------------------------------------
  // Core recovery: 400 + no selection + mine [A, B] → recovered-400
  // -------------------------------------------------------------------------

  it('400 + no selection + mine [A, B] → sets first org + invalidates + returns recovered-400', async () => {
    mockGetActiveOrganizationId.mockReturnValue(null);
    const queryClient = makeMockQueryClient([MEMBERSHIP_A, MEMBERSHIP_B]);

    const result = await recoverFromOrganizationQueryError(
      ERROR_400_HEADER_REQUIRED,
      queryClient
    );

    expect(result).toBe('recovered-400');
    expect(mockSetActiveOrganizationId).toHaveBeenCalledWith('1');
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
    // Guard against fetching the wrong key — must use the generated options key.
    expect(queryClient.fetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: organizationsMineListQueryKey({}),
      })
    );
  });

  it('400 + no selection + mine [A] (single org) → sets A + invalidates + returns recovered-400', async () => {
    mockGetActiveOrganizationId.mockReturnValue(null);
    const queryClient = makeMockQueryClient([MEMBERSHIP_A]);

    const result = await recoverFromOrganizationQueryError(
      ERROR_400_HEADER_REQUIRED,
      queryClient
    );

    expect(result).toBe('recovered-400');
    expect(mockSetActiveOrganizationId).toHaveBeenCalledWith('1');
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Empty mine/ → user is gated → ignored (onboarding gate handles it)
  // -------------------------------------------------------------------------

  it('400 + mine [] → no set, no invalidate → returns ignored', async () => {
    mockGetActiveOrganizationId.mockReturnValue(null);
    const queryClient = makeMockQueryClient([]);

    const result = await recoverFromOrganizationQueryError(
      ERROR_400_HEADER_REQUIRED,
      queryClient
    );

    expect(result).toBe('ignored');
    expect(mockSetActiveOrganizationId).not.toHaveBeenCalled();
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Loop guard: valid selection already set → do NOT re-set → ignored
  // -------------------------------------------------------------------------

  it('400 + VALID current selection (present in mine/) → no set, no invalidate → returns ignored', async () => {
    // Current selection is org 1 = MEMBERSHIP_A.organization.id
    mockGetActiveOrganizationId.mockReturnValue('1');
    const queryClient = makeMockQueryClient([MEMBERSHIP_A, MEMBERSHIP_B]);

    const result = await recoverFromOrganizationQueryError(
      ERROR_400_HEADER_REQUIRED,
      queryClient
    );

    // Loop guard: selection is valid, don't re-set (would cause infinite loop).
    expect(result).toBe('ignored');
    expect(mockSetActiveOrganizationId).not.toHaveBeenCalled();
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Stale selection (not in mine/) → recover to first org
  // -------------------------------------------------------------------------

  it('400 + stale selection (not in mine/) + mine [A] → sets A + returns recovered-400', async () => {
    // Current selection is org 99 (stale, not in mine/)
    mockGetActiveOrganizationId.mockReturnValue('99');
    const queryClient = makeMockQueryClient([MEMBERSHIP_A]);

    const result = await recoverFromOrganizationQueryError(
      ERROR_400_HEADER_REQUIRED,
      queryClient
    );

    expect(result).toBe('recovered-400');
    expect(mockSetActiveOrganizationId).toHaveBeenCalledWith('1');
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Non-matching errors → ignored, nothing called
  // -------------------------------------------------------------------------

  it('non-400 error with different detail → returns ignored, nothing called', async () => {
    mockGetActiveOrganizationId.mockReturnValue(null);
    const queryClient = makeMockQueryClient([MEMBERSHIP_A]);

    const result = await recoverFromOrganizationQueryError(
      { detail: 'Not found.' },
      queryClient
    );

    expect(result).toBe('ignored');
    expect(mockSetActiveOrganizationId).not.toHaveBeenCalled();
    expect(queryClient.fetchQuery).not.toHaveBeenCalled();
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it('500 error (no detail field) → returns ignored, nothing called', async () => {
    mockGetActiveOrganizationId.mockReturnValue(null);
    const queryClient = makeMockQueryClient([MEMBERSHIP_A]);

    const result = await recoverFromOrganizationQueryError(
      { message: 'Internal Server Error' },
      queryClient
    );

    expect(result).toBe('ignored');
    expect(mockSetActiveOrganizationId).not.toHaveBeenCalled();
    expect(queryClient.fetchQuery).not.toHaveBeenCalled();
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it('generic Error instance → returns ignored, nothing called', async () => {
    mockGetActiveOrganizationId.mockReturnValue(null);
    const queryClient = makeMockQueryClient([MEMBERSHIP_A]);

    const result = await recoverFromOrganizationQueryError(
      new Error('Network error'),
      queryClient
    );

    expect(result).toBe('ignored');
    expect(mockSetActiveOrganizationId).not.toHaveBeenCalled();
    expect(queryClient.fetchQuery).not.toHaveBeenCalled();
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it('null error → returns ignored, nothing called', async () => {
    mockGetActiveOrganizationId.mockReturnValue(null);
    const queryClient = makeMockQueryClient([MEMBERSHIP_A]);

    const result = await recoverFromOrganizationQueryError(null, queryClient);

    expect(result).toBe('ignored');
    expect(mockSetActiveOrganizationId).not.toHaveBeenCalled();
    expect(queryClient.fetchQuery).not.toHaveBeenCalled();
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it('detail matches case-sensitively — different casing → returns ignored', async () => {
    mockGetActiveOrganizationId.mockReturnValue(null);
    const queryClient = makeMockQueryClient([MEMBERSHIP_A]);

    // Exact string must match; case or punctuation difference → no recovery
    const result = await recoverFromOrganizationQueryError(
      { detail: 'x-organization-id header required.' },
      queryClient
    );

    expect(result).toBe('ignored');
    expect(queryClient.fetchQuery).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Phase 9 — UC6: 403 stale-org recovery
  // ---------------------------------------------------------------------------

  describe('403 stale-org recovery (UC6)', () => {
    // -------------------------------------------------------------------------
    // Core recovery: stale-org 403 + mine [A, B] → recovered-403 with toast
    // -------------------------------------------------------------------------

    it('stale-org 403 + mine [A, B] → sets first org + invalidates + toasts + returns recovered-403', async () => {
      mockGetActiveOrganizationId.mockReturnValue(null);
      const queryClient = makeMockQueryClient([MEMBERSHIP_A, MEMBERSHIP_B]);

      const result = await recoverFromOrganizationQueryError(
        ERROR_403_STALE_ORG,
        queryClient
      );

      expect(result).toBe('recovered-403');
      expect(mockSetActiveOrganizationId).toHaveBeenCalledWith('1');
      expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
      expect(mockToast).toHaveBeenCalledWith(
        'That organization is no longer available — switched to Org A.'
      );
      // Must still fetch mine/ to discover the valid orgs.
      expect(queryClient.fetchQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: organizationsMineListQueryKey({}),
        })
      );
    });

    it('stale-org 403 + mine [A] (single remaining org) → sets A + toasts + returns recovered-403', async () => {
      mockGetActiveOrganizationId.mockReturnValue(null);
      const queryClient = makeMockQueryClient([MEMBERSHIP_A]);

      const result = await recoverFromOrganizationQueryError(
        ERROR_403_STALE_ORG,
        queryClient
      );

      expect(result).toBe('recovered-403');
      expect(mockSetActiveOrganizationId).toHaveBeenCalledWith('1');
      expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
      expect(mockToast).toHaveBeenCalledWith(
        'That organization is no longer available — switched to Org A.'
      );
    });

    // -------------------------------------------------------------------------
    // Empty mine/ → clear stale selection, no toast, 'ignored'
    // -------------------------------------------------------------------------

    it('stale-org 403 + mine [] → clearActiveOrganization + no toast + returns ignored', async () => {
      mockGetActiveOrganizationId.mockReturnValue('99');
      const queryClient = makeMockQueryClient([]);

      const result = await recoverFromOrganizationQueryError(
        ERROR_403_STALE_ORG,
        queryClient
      );

      expect(result).toBe('ignored');
      expect(mockClearActiveOrganization).toHaveBeenCalledTimes(1);
      expect(mockSetActiveOrganizationId).not.toHaveBeenCalled();
      expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
      // No toast when genuinely no orgs left — redirect to no-access handles it.
      expect(mockToast).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // 'No active organization membership.' 403 → NOT treated as stale → 'ignored'
    // -------------------------------------------------------------------------

    it('"No active organization membership." 403 → not treated as stale-org → returns ignored', async () => {
      mockGetActiveOrganizationId.mockReturnValue(null);
      const queryClient = makeMockQueryClient([MEMBERSHIP_A]);

      const result = await recoverFromOrganizationQueryError(
        ERROR_403_NO_MEMBERSHIP,
        queryClient
      );

      expect(result).toBe('ignored');
      expect(queryClient.fetchQuery).not.toHaveBeenCalled();
      expect(mockSetActiveOrganizationId).not.toHaveBeenCalled();
      expect(mockClearActiveOrganization).not.toHaveBeenCalled();
      expect(mockToast).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Loop guard: valid selection already in mine/ → 'ignored'
    // -------------------------------------------------------------------------

    it('stale-org 403 + VALID current selection (present in mine/) → loop guard → returns ignored', async () => {
      // Current selection is org 1 = MEMBERSHIP_A.organization.id
      mockGetActiveOrganizationId.mockReturnValue('1');
      const queryClient = makeMockQueryClient([MEMBERSHIP_A, MEMBERSHIP_B]);

      const result = await recoverFromOrganizationQueryError(
        ERROR_403_STALE_ORG,
        queryClient
      );

      // A valid selection shouldn't produce this 403; re-setting would loop.
      expect(result).toBe('ignored');
      expect(mockSetActiveOrganizationId).not.toHaveBeenCalled();
      expect(mockClearActiveOrganization).not.toHaveBeenCalled();
      expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
      expect(mockToast).not.toHaveBeenCalled();
    });
  });
});
