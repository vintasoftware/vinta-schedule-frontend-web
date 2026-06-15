/**
 * APIClientAuthInitializationProvider wiring test (Phase 9, Part 1).
 *
 * The live provider must supply the recovery-wired QueryClient produced by
 * `makeQueryClient` (not a bare QueryClient). We prove this by reading the
 * QueryClient handed to consumers via useQueryClient and firing its QueryCache
 * onError — which must reach `recoverFromOrganizationQueryError`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';

// Mock the recovery module before importing anything that wires it in.
// vi.hoisted ensures the spy exists before the (hoisted) vi.mock factory runs.
const { mockRecover } = vi.hoisted(() => ({ mockRecover: vi.fn() }));
vi.mock('@/hooks/organizations/use-organization-error-recovery', () => ({
  recoverFromOrganizationQueryError: mockRecover,
}));

// Avoid running the real auth fetch-interceptor configuration on mount.
vi.mock('@/lib/authentication-fetch-interceptors', () => ({
  configureClientAuthentication: vi.fn(),
}));
vi.mock('@/lib/configure-api-clients', () => ({}));

import { APIClientAuthInitializationProvider } from './api-client-auth-initialization-provider';

function CaptureClient({ onClient }: { onClient: (c: QueryClient) => void }) {
  onClient(useQueryClient());
  return null;
}

describe('APIClientAuthInitializationProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecover.mockResolvedValue('ignored');
  });

  it('provides the recovery-wired makeQueryClient (QueryCache onError → recovery)', () => {
    let captured: QueryClient | undefined;
    render(
      <APIClientAuthInitializationProvider>
        <CaptureClient onClient={(c) => (captured = c)} />
      </APIClientAuthInitializationProvider>
    );

    expect(captured).toBeDefined();
    const onError = captured!.getQueryCache().config.onError;
    // A bare QueryClient has no onError; the makeQueryClient cache wires one.
    expect(onError).toBeTypeOf('function');

    const error = {
      detail: 'X-Organization-Id header required.',
    } as unknown as Error;
    onError?.(error, {} as Parameters<NonNullable<typeof onError>>[1]);

    expect(mockRecover).toHaveBeenCalledTimes(1);
    expect(mockRecover).toHaveBeenCalledWith(error, captured);
  });
});
