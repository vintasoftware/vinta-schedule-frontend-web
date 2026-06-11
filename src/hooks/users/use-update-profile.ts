import type { PatchedProfileWritable } from '@/client';
import { profilePartialUpdateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  const updateProfileMutation = useMutation({
    ...profilePartialUpdateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] as { _id?: string })?._id === 'profileRetrieve',
      });
    },
  });

  const updateProfile = async (body: PatchedProfileWritable) =>
    updateProfileMutation.mutateAsync({ path: { user: 'me' }, body });

  return { updateProfile, updateProfileMutation };
}
