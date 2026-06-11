import { profileRetrieveOptions } from '@/client/@tanstack/react-query.gen';
import { useQuery } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// useProfile
//
// Reads the authenticated user's profile (`GET /profile/me/`) via the main API
// (JWT-authenticated). Returns first/last name + picture. Use 'me' for the
// current user. Unlike the allauth session `display`, this is the user's real
// profile name.
// ---------------------------------------------------------------------------

export function useProfile({ enabled = true }: { enabled?: boolean } = {}) {
  const profileQuery = useQuery({
    ...profileRetrieveOptions({ path: { user: 'me' } }),
    enabled,
  });

  return {
    profile: profileQuery.data ?? null,
    isLoading: profileQuery.isLoading,
    isError: profileQuery.isError,
    profileQuery,
  };
}
