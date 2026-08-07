import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    profileRetrieve: vi.fn(),
    profilePartialUpdate: vi.fn(),
  };
});

import { profileRetrieve, profilePartialUpdate } from '@/client/sdk.gen';
import type { Profile } from '@/client';
import { PROFILE_QUERY_KEY } from './use-profile';
import { useUpdateProfile } from './use-update-profile';

const STORED: Profile = {
  id: 42,
  first_name: 'Ada',
  last_name: 'Lovelace',
  profile_picture: null,
} as Profile;

const PATCHED: Profile = {
  ...STORED,
  profile_picture: 'https://api.example.com/profile/picture/42/',
} as Profile;

function renderUpdateProfile() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(PROFILE_QUERY_KEY, STORED);

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { ...renderHook(() => useUpdateProfile(), { wrapper }), queryClient };
}

describe('useUpdateProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(profilePartialUpdate).mockResolvedValue({
      data: PATCHED,
    } as Awaited<ReturnType<typeof profilePartialUpdate>>);
  });

  it('PATCHes /profile/me/ with the given partial body', async () => {
    const { result } = renderUpdateProfile();

    await result.current.updateProfile({
      profile_picture: 'uploads/profile_pictures/new-avatar.png',
    });

    expect(vi.mocked(profilePartialUpdate)).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(profilePartialUpdate).mock.calls[0][0];
    expect(callArgs?.path).toEqual({ user: 'me' });
    expect(callArgs?.body).toEqual({
      profile_picture: 'uploads/profile_pictures/new-avatar.png',
    });
  });

  it('seeds the profile cache with the response instead of refetching', async () => {
    const { result, queryClient } = renderUpdateProfile();

    await result.current.updateProfile({ first_name: 'Ada' });

    await waitFor(() => {
      expect(queryClient.getQueryData<Profile>(PROFILE_QUERY_KEY)).toEqual(
        PATCHED
      );
    });
    expect(vi.mocked(profileRetrieve)).not.toHaveBeenCalled();
  });

  it('leaves the cached profile untouched when the PATCH fails', async () => {
    vi.mocked(profilePartialUpdate).mockRejectedValue(new Error('500'));
    const { result, queryClient } = renderUpdateProfile();

    await expect(
      result.current.updateProfile({ first_name: 'Grace' })
    ).rejects.toThrow();

    expect(queryClient.getQueryData<Profile>(PROFILE_QUERY_KEY)).toEqual(
      STORED
    );
  });
});
