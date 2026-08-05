import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/addicional-auth-client/provider-login-json', () => ({
  postAppV1AuthProviderRedirectJson: vi.fn(),
}));

import { postAppV1AuthProviderRedirectJson } from '@/addicional-auth-client/provider-login-json';
import { useProviderLogin } from './use-provider-login';

const mockPost = vi.mocked(postAppV1AuthProviderRedirectJson);

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return Wrapper;
}

describe('useProviderLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('throws with the backend field error on a 400 response', async () => {
    mockPost.mockResolvedValue({
      ok: false,
      json: async () => ({ callback_url: ['Invalid URL.'] }),
    } as Response);

    const { result } = renderHook(() => useProviderLogin(), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.providerLogin({
        provider: 'google',
        callbackUrl: 'http://localhost:3000/auth/social/google/callback',
        process: 'login',
      })
    ).rejects.toThrow('Invalid URL.');
  });

  it('returns redirect_url on success', async () => {
    mockPost.mockResolvedValue({
      ok: true,
      json: async () => ({
        redirect_url: 'https://accounts.google.com/o/oauth2/auth',
      }),
    } as Response);

    const { result } = renderHook(() => useProviderLogin(), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.providerLogin({
        provider: 'google',
        callbackUrl: 'http://localhost:3000/auth/social/google/callback',
        process: 'login',
      })
    ).resolves.toEqual({
      redirect_url: 'https://accounts.google.com/o/oauth2/auth',
    });
  });

  it('throws when a 200 response omits redirect_url', async () => {
    mockPost.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useProviderLogin(), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.providerLogin({
        provider: 'google',
        callbackUrl: 'http://localhost:3000/auth/social/google/callback',
        process: 'login',
      })
    ).rejects.toThrow('Could not start social sign-in. Please try again.');
  });
});
