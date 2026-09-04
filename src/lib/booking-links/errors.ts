/**
 * Error taxonomy for `/public/booking/*` calls.
 *
 * Reads and writes disagree on purpose (see the plan's "The opaque 403 is not
 * an auth failure" and "Writes carry a real error vocabulary" guiding
 * decisions):
 *
 *  - Code-gated READS answer every code failure — invalid, expired, used,
 *    revoked, wrong-scope — with the same `403 {"detail": "Invalid or
 *    expired code."}`, deliberately, so the endpoint can't be used to probe
 *    code state from the outside. `parseReadFailure` must therefore collapse
 *    every 403 into one opaque `'link-invalid'` and must NEVER branch on the
 *    response body — reading `detail` here would defeat the backend's own
 *    anti-probing design.
 *  - WRITES return a real, distinct vocabulary: `404 INVALID_CODE`,
 *    `403 NOT_PERMITTED` / `REVOKED`, `410 EXPIRED`, `409 ALREADY_USED`,
 *    `409 SLOT_UNAVAILABLE`. Only `SLOT_UNAVAILABLE` leaves the code
 *    unconsumed, so it's the one failure the UI can recover from in place.
 */

/** The write-path error vocabulary the backend returns as `error_code`. */
export type BookingCodeErrorCode =
  | 'INVALID_CODE'
  | 'NOT_PERMITTED'
  | 'REVOKED'
  | 'EXPIRED'
  | 'ALREADY_USED'
  | 'SLOT_UNAVAILABLE';

const KNOWN_ERROR_CODES: readonly BookingCodeErrorCode[] = [
  'INVALID_CODE',
  'NOT_PERMITTED',
  'REVOKED',
  'EXPIRED',
  'ALREADY_USED',
  'SLOT_UNAVAILABLE',
];

function isBookingCodeErrorCode(value: unknown): value is BookingCodeErrorCode {
  return (
    typeof value === 'string' &&
    (KNOWN_ERROR_CODES as readonly string[]).includes(value)
  );
}

/**
 * Reads collapse every code failure into one opaque state — never guess
 * which. `'ok'` is the success case; `'range-invalid'` is a genuine client
 * input error (e.g. a malformed search window), which is safe to
 * differentiate because it says nothing about the code's validity;
 * `'error'` is anything else (network failure, 5xx, unexpected shape).
 */
export type PublicReadState = 'ok' | 'link-invalid' | 'range-invalid' | 'error';

/** Writes discriminate; `SLOT_UNAVAILABLE` is the only recoverable one. */
export interface PublicWriteFailure {
  errorCode: BookingCodeErrorCode | null;
  detail: string;
  /** True only for SLOT_UNAVAILABLE — the code survives, so retry in place. */
  isRetryable: boolean;
}

/**
 * Map a failed read response's status to an opaque `PublicReadState`.
 *
 * Deliberately takes only the `Response`, never its parsed body — the read
 * endpoints' `403` always carries the same generic `detail`, and even if it
 * didn't, branching on it would reintroduce the state-probing the backend's
 * uniform 403 is designed to prevent.
 */
export function parseReadFailure(response: Response): PublicReadState {
  if (response.ok) return 'ok';
  if (response.status === 403) return 'link-invalid';
  if (response.status === 400) return 'range-invalid';
  return 'error';
}

/**
 * Map a failed write response + its parsed JSON body to a `PublicWriteFailure`.
 *
 * Unlike reads, writes return a real `{ error_code, detail }` vocabulary, so
 * this reads the body — but only to extract those two fields, never to infer
 * anything beyond what the backend already chose to disclose.
 */
export function parseWriteFailure(
  response: Response,
  body: unknown
): PublicWriteFailure {
  const record =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const rawErrorCode = record.error_code;
  const errorCode = isBookingCodeErrorCode(rawErrorCode) ? rawErrorCode : null;
  const detail =
    typeof record.detail === 'string' && record.detail.length > 0
      ? record.detail
      : response.statusText || 'Request failed';

  return {
    errorCode,
    detail,
    isRetryable: errorCode === 'SLOT_UNAVAILABLE',
  };
}
