/**
 * useUpdateOrganizationSlug tests.
 *
 * Covers:
 * - PATCH body `{ slug }` with the current org id.
 * - On success, BOTH CURRENT_ORGANIZATION_QUERY_KEY and MY_ORGANIZATIONS_QUERY_KEY
 *   are invalidated (slug lives on OrganizationBrief in mine/).
 * - On failure, no query keys are invalidated.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import type { Organization } from '@/client';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    organizationsPartialUpdate: vi.fn(),
  };
});

vi.mock('./use-current-organization', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./use-current-organization')>();
  return {
    ...original,
    useCurrentOrganization: vi.fn(),
  };
});

import { organizationsPartialUpdate } from '@/client/sdk.gen';
import { useCurrentOrganization } from './use-current-organization';
import { CURRENT_ORGANIZATION_QUERY_KEY } from './use-current-organization';
import { MY_ORGANIZATIONS_QUERY_KEY } from './use-my-organizations';
import { useUpdateOrganizationSlug } from './use-update-organization-slug';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const UPDATED_ORG: Organization = {
  id: 42,
  name: 'Acme Inc',
  slug: 'acme',
  google_service_account: null,
  can_invite_organizations: false,
  created: '2026-01-01T00:00:00Z',
  modified: '2026-01-01T00:00:00Z',
};

function makeSuccessResponse(
  org: Organization
): Awaited<ReturnType<typeof organizationsPartialUpdate>> {
  return {
    data: org,
    response: new Response(JSON.stringify(org), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof organizationsPartialUpdate>>;
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCurrentOrganization).mockReturnValue({
    organization: { id: 42, name: 'Acme Inc', slug: null },
  } as unknown as ReturnType<typeof useCurrentOrganization>);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useUpdateOrganizationSlug', () => {
  it('PATCHes the organization with { slug }', async () => {
    vi.mocked(organizationsPartialUpdate).mockResolvedValue(
      makeSuccessResponse(UPDATED_ORG)
    );

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useUpdateOrganizationSlug(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.updateOrganizationSlug('acme');
    });

    expect(vi.mocked(organizationsPartialUpdate)).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { id: '42' },
        body: { slug: 'acme' },
        throwOnError: true,
      })
    );
  });

  it('invalidates CURRENT_ORGANIZATION_QUERY_KEY on success', async () => {
    vi.mocked(organizationsPartialUpdate).mockResolvedValue(
      makeSuccessResponse(UPDATED_ORG)
    );

    const { Wrapper, queryClient } = makeQueryWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateOrganizationSlug(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.updateOrganizationSlug('acme');
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

  it('invalidates MY_ORGANIZATIONS_QUERY_KEY on success', async () => {
    vi.mocked(organizationsPartialUpdate).mockResolvedValue(
      makeSuccessResponse(UPDATED_ORG)
    );

    const { Wrapper, queryClient } = makeQueryWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateOrganizationSlug(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.updateOrganizationSlug('acme');
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

  it('throws when the organization is not loaded', async () => {
    vi.mocked(useCurrentOrganization).mockReturnValue({
      organization: null,
    } as unknown as ReturnType<typeof useCurrentOrganization>);

    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useUpdateOrganizationSlug(), {
      wrapper: Wrapper,
    });

    await expect(result.current.updateOrganizationSlug('acme')).rejects.toThrow(
      'Organization not loaded'
    );
    expect(vi.mocked(organizationsPartialUpdate)).not.toHaveBeenCalled();
  });

  it('does NOT invalidate any query key when the API fails', async () => {
    vi.mocked(organizationsPartialUpdate).mockRejectedValue(
      new Error('Bad Request')
    );

    const { Wrapper, queryClient } = makeQueryWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateOrganizationSlug(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.updateOrganizationSlug('acme').catch(() => {
        /* expected */
      });
    });

    await waitFor(() =>
      expect(result.current.updateOrganizationSlugMutation.isError).toBe(true)
    );

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
