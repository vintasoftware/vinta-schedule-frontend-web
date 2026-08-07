import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before any imports from the modules being mocked.
// ---------------------------------------------------------------------------

const { mockUploadProfilePicture } = vi.hoisted(() => ({
  mockUploadProfilePicture: vi.fn(),
}));

// Mock the sdk.gen boundary so the profile GET/PATCH never hit a real network.
vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    profileRetrieve: vi.fn(),
    profilePartialUpdate: vi.fn(),
  };
});

// Mock sonner to prevent missing Toaster context errors in tests.
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/hooks/users/use-upload-profile-picture', () => ({
  useUploadProfilePicture: () => ({
    uploadProfilePicture: mockUploadProfilePicture,
  }),
  UploadValidationError: class UploadValidationError extends Error {},
}));

import { profileRetrieve, profilePartialUpdate } from '@/client/sdk.gen';
import { toast } from 'sonner';
import type { Profile } from '@/client';
import ProfilePage from './page';
import { PROFILE_QUERY_KEY } from '@/hooks/users/use-profile';
import { UploadValidationError } from '@/hooks/users/use-upload-profile-picture';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OBJECT_KEY = 'uploads/profile_pictures/new-avatar.png';
const DELIVERY_URL = 'https://api.example.com/profile/picture/42/';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 42,
    first_name: 'Ada',
    last_name: 'Lovelace',
    profile_picture: null,
    ...overrides,
  } as Profile;
}

function mockGetProfile(profile: Profile) {
  vi.mocked(profileRetrieve).mockResolvedValue({ data: profile } as Awaited<
    ReturnType<typeof profileRetrieve>
  >);
}

function mockPatchProfile(profile: Profile) {
  vi.mocked(profilePartialUpdate).mockResolvedValue({
    data: profile,
  } as Awaited<ReturnType<typeof profilePartialUpdate>>);
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { ...render(<ProfilePage />, { wrapper }), queryClient };
}

function pngFile() {
  return new File([new Uint8Array([1, 2, 3])], 'avatar.png', {
    type: 'image/png',
  });
}

/** Waits for the profile GET to settle so the form replaces its skeleton. */
async function waitForForm() {
  await screen.findByLabelText(/first name/i);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProfile(makeProfile());
    mockUploadProfilePicture.mockResolvedValue(OBJECT_KEY);
  });

  describe('profile picture', () => {
    it('PATCHes the uploaded object key immediately, without a form submit', async () => {
      const user = userEvent.setup();
      mockPatchProfile(makeProfile({ profile_picture: DELIVERY_URL }));
      renderPage();
      await waitForForm();

      await user.upload(
        screen.getByLabelText(/upload profile picture/i),
        pngFile()
      );

      await waitFor(() => {
        expect(vi.mocked(profilePartialUpdate)).toHaveBeenCalledOnce();
      });

      const callArgs = vi.mocked(profilePartialUpdate).mock.calls[0][0];
      expect(callArgs?.path).toEqual({ user: 'me' });
      expect(callArgs?.body).toEqual({ profile_picture: OBJECT_KEY });
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'Profile picture updated'
      );
    });

    it('does not refetch the profile after the PATCH', async () => {
      const user = userEvent.setup();
      mockPatchProfile(makeProfile({ profile_picture: DELIVERY_URL }));
      renderPage();
      await waitForForm();

      await user.upload(
        screen.getByLabelText(/upload profile picture/i),
        pngFile()
      );

      await waitFor(() => {
        expect(vi.mocked(profilePartialUpdate)).toHaveBeenCalledOnce();
      });
      // The mutation seeds the cache with its response, so the only GET is the
      // one from the initial mount. See use-update-profile.test.ts.
      expect(vi.mocked(profileRetrieve)).toHaveBeenCalledOnce();
    });

    it('does not send the picture again on the next form submit', async () => {
      const user = userEvent.setup();
      mockPatchProfile(makeProfile({ profile_picture: DELIVERY_URL }));
      renderPage();
      await waitForForm();

      await user.upload(
        screen.getByLabelText(/upload profile picture/i),
        pngFile()
      );
      await waitFor(() => {
        expect(vi.mocked(profilePartialUpdate)).toHaveBeenCalledOnce();
      });

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(vi.mocked(profilePartialUpdate)).toHaveBeenCalledTimes(2);
      });
      expect(vi.mocked(profilePartialUpdate).mock.calls[1][0]?.body).toEqual({
        first_name: 'Ada',
        last_name: 'Lovelace',
      });
    });

    it('reports a rejected file and never PATCHes', async () => {
      const user = userEvent.setup();
      mockUploadProfilePicture.mockRejectedValue(
        new UploadValidationError('Image must be smaller than 5 MB')
      );
      renderPage();
      await waitForForm();

      await user.upload(
        screen.getByLabelText(/upload profile picture/i),
        pngFile()
      );

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
          'Image must be smaller than 5 MB'
        );
      });
      expect(vi.mocked(profilePartialUpdate)).not.toHaveBeenCalled();
    });

    it('reports a failed PATCH and leaves the stored picture in the cache', async () => {
      const user = userEvent.setup();
      mockGetProfile(makeProfile({ profile_picture: DELIVERY_URL }));
      vi.mocked(profilePartialUpdate).mockRejectedValue(new Error('500'));
      const { queryClient } = renderPage();
      await waitForForm();

      await user.upload(
        screen.getByLabelText(/upload profile picture/i),
        pngFile()
      );

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
          'Failed to update picture — please try again'
        );
      });
      expect(
        queryClient.getQueryData<Profile>(PROFILE_QUERY_KEY)?.profile_picture
      ).toBe(DELIVERY_URL);
      // The upload control returns to idle so the user can retry.
      expect(
        screen.getByRole('button', { name: /change photo/i })
      ).toBeEnabled();
    });
  });

  describe('personal information', () => {
    it('PATCHes the edited name on submit', async () => {
      const user = userEvent.setup();
      mockPatchProfile(makeProfile({ first_name: 'Grace' }));
      renderPage();
      await waitForForm();

      const firstName = screen.getByLabelText(/first name/i);
      await user.clear(firstName);
      await user.type(firstName, 'Grace');
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(vi.mocked(profilePartialUpdate)).toHaveBeenCalledOnce();
      });
      expect(vi.mocked(profilePartialUpdate).mock.calls[0][0]?.body).toEqual({
        first_name: 'Grace',
        last_name: 'Lovelace',
      });
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Profile updated');
    });
  });
});
