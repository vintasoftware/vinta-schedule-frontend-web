/**
 * Error taxonomy for the CODELESS, slug-addressed calendar-group reads
 * (`GET /public/booking/calendar-groups/{public_slug}/bookable-slots/` and
 * `POST .../availability/`).
 *
 * This is DELIBERATELY NOT `parseReadFailure` from `./errors.ts`, and the two
 * must never be unified — see `_resolve_public_group` /
 * `_resolve_public_group_duration` on the API side (`calendar_integration/
 * booking_read_views.py`):
 *
 *  - A code-gated read's `403` is opaque on purpose: the token IS the secret,
 *    so confirming/denying anything about it from the outside would be an
 *    oracle. `parseReadFailure` collapses every failure into one
 *    `'link-invalid'` for exactly that reason.
 *  - A codeless read's `public_slug` is the caller's OWN path input, not a
 *    secret — it came from the URL the caller already holds. So:
 *      - An unknown slug is a real `404`. Confirming "no such group" discloses
 *        nothing the caller didn't already risk by guessing/mistyping a slug.
 *      - A slug resolving to a real but non-public group (or a public group
 *        whose effective duration is unset — `_resolve_public_group_duration`
 *        fails closed the same way) is a real `403`: the group exists, but
 *        this route isn't open to it.
 *
 * Collapsing these two into one opaque state (the way `parseReadFailure`
 * does for the coded surface) would throw away a distinction the backend
 * deliberately exposes, and the phase spec that introduced this route
 * requires the two to render as distinct UI states. Do not "simplify" this
 * back into `parseReadFailure` — that would be removing intentional backend
 * behavior, not deduplicating code.
 */

/**
 * `'not-found'` = unknown `public_slug` (404); `'unavailable'` = a real group
 * that isn't bookable here — private, or public with no usable duration
 * (403). `'range-invalid'` is a genuine client input error (malformed search
 * window), safe to differentiate because it says nothing about the slug.
 * `'error'` is anything else (network failure, 5xx, unexpected shape).
 */
export type CodelessGroupReadState =
  | 'ok'
  | 'not-found'
  | 'unavailable'
  | 'range-invalid'
  | 'error';

/**
 * Map a failed codeless group read response's status to a
 * `CodelessGroupReadState`. Takes only the `Response` — there is no body to
 * distrust here (unlike `parseReadFailure`'s deliberate refusal to read one),
 * the status code alone already carries the real distinction.
 */
export function parseCodelessGroupReadFailure(
  response: Response
): CodelessGroupReadState {
  if (response.ok) return 'ok';
  if (response.status === 404) return 'not-found';
  if (response.status === 403) return 'unavailable';
  if (response.status === 400) return 'range-invalid';
  return 'error';
}

/**
 * Thrown by the codeless group read hooks (`use-codeless-group-booking.ts`)
 * so a failed `useQuery` (or the imperative availability fetch) carries the
 * already-mapped `CodelessGroupReadState` in `.state`. Components branch on
 * `.state` to choose between `<CodelessGroupNotFound />` and
 * `<CodelessGroupUnavailable />` — never on the raw response body.
 */
export class CodelessGroupReadFailureError extends Error {
  readonly state: Exclude<CodelessGroupReadState, 'ok'>;

  constructor(state: Exclude<CodelessGroupReadState, 'ok'>) {
    super(`codeless group read failed: ${state}`);
    this.name = 'CodelessGroupReadFailureError';
    this.state = state;
  }
}
