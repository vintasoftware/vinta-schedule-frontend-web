/**
 * useRevokeBookingCode — revoke a booking code by its opaque id.
 *
 * `bookingCodesDestroy` is a non-oracle (see its doc comment in
 * `src/client/types.gen.ts`): revoking an already-revoked code, an id that
 * doesn't exist in the caller's organization, and an id the caller isn't
 * authorized to revoke all answer `204` identically, without touching the
 * row. This hook mirrors that uniformity rather than translating it into a
 * "found" / "not found" distinction the backend deliberately doesn't expose
 * — reporting success unconditionally is not a bug here, it's the contract.
 *
 * No list query exists for this domain to invalidate (see the "No link
 * inventory" guiding decision) — there is nothing to refetch after a revoke.
 */

import { bookingCodesDestroyMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';

export function useRevokeBookingCode() {
  const revokeBookingCodeMutation = useMutation({
    ...bookingCodesDestroyMutation(),
  });

  /** Revoke a code by its id. Always resolves; never reports "not found". */
  const revokeBookingCode = async (id: number): Promise<void> => {
    await revokeBookingCodeMutation.mutateAsync({ path: { id: String(id) } });
  };

  return { revokeBookingCode, revokeBookingCodeMutation };
}
