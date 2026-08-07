import type { PatchedProfileWritable, Profile } from '@/client';
import { profilePartialUpdateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PROFILE_QUERY_KEY } from './use-profile';

/**
 * Wraps PATCH /profile/me/ (partial update).
 *
 * Every field is optional, so this also persists a single field on its own —
 * e.g. `profile_picture` right after the S3 upload resolves, without waiting
 * for the user to submit the name form.
 *
 * On success it seeds the profile query cache with the response (the same shape
 * a GET returns) instead of invalidating and refetching. That echoes back the
 * delivery URL for a freshly uploaded picture: writes take the S3 object key,
 * reads return a URL.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  const updateProfileMutation = useMutation({
    ...profilePartialUpdateMutation(),
    onSuccess: (data: Profile) => {
      queryClient.setQueryData(PROFILE_QUERY_KEY, data);
    },
  });

  const updateProfile = async (body: PatchedProfileWritable) =>
    updateProfileMutation.mutateAsync({ path: { user: 'me' }, body });

  return { updateProfile, updateProfileMutation };
}
