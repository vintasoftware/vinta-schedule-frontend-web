/**
 * useCreateBookingCode — mint a single-use booking/reschedule/cancel code.
 *
 * SECURITY — no-persistence guarantee (mirrors `useCreatePublicApiToken`,
 * @/hooks/api-tokens/use-public-api-tokens.ts):
 *   - `BookingCodeCreateResult.code` is the plaintext booking code, returned
 *     exactly once by the API and never retrievable afterwards (see the
 *     plan's "No link inventory" guiding decision). There is no booking-code
 *     list query for this hook to seed or invalidate.
 *   - This hook does not set `onSuccess` cache handling for the response, so
 *     `code` never lands in the TanStack query cache under a durable key.
 *     It is returned only via `createBookingCode`'s resolved value; the
 *     caller (the mint dialog) MUST hold it in local component state only,
 *     build the shareable URL from it, and clear that state when the dialog
 *     closes.
 *   - Never logged. Never persisted to `localStorage` / `sessionStorage`.
 */

import type { BookingCodeCreate, BookingCodeCreateResult } from '@/client';
import { bookingCodesCreateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';

export function useCreateBookingCode() {
  const createBookingCodeMutation = useMutation({
    ...bookingCodesCreateMutation(),
  });

  /**
   * Mint a code. Returns the full `BookingCodeCreateResult`, including the
   * one-time plaintext `code` field. Callers MUST capture it in local state
   * only and clear it on dialog close.
   */
  const createBookingCode = async (
    body: BookingCodeCreate
  ): Promise<BookingCodeCreateResult> =>
    createBookingCodeMutation.mutateAsync({ body });

  return { createBookingCode, createBookingCodeMutation };
}
