/**
 * MintedBookingLink — the in-memory value a mint dialog holds between a
 * successful `POST /booking-codes/` and the moment the dialog closes.
 *
 * Not a server resource the frontend can re-read: the API exposes no `list`
 * or `retrieve` for booking codes (see the plan's "No link inventory" guiding
 * decision), and the plaintext `code` is returned exactly once, baked into
 * `url` by `buildBookingLinkUrl`. Nothing here is written to the TanStack
 * query cache, `localStorage`, or a log — it lives only in the dialog's local
 * component state and is gone once the dialog closes.
 */

import type { PurposeEnum } from '@/client';

export interface MintedBookingLink {
  /** Server id — the only handle revoke accepts. Lost when the dialog closes. */
  id: number;
  purpose: PurposeEnum;
  /** Absolute URL handed to the member, already branded when a slug was known. */
  url: string;
  expiresAt: string | null;
  /** Seconds, calendar-scoped links only; null for appointment type links (server-pinned). */
  durationSeconds: number | null;
}
