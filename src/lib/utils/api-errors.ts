/**
 * api-errors.ts — narrow readers for a couple of API error shapes shared
 * across the group-scoped availability surfaces (windows, blocks, quota
 * rules — CALENDAR_GROUP_SCOPED_AVAILABILITY), so callers branch on a typed
 * result instead of pattern-matching strings out of a caught error.
 *
 * The generated hey-api client's mutation factories use `throwOnError:true`
 * (this repo's default for mutations — see AGENTS.md's canonical hook
 * example), which throws the parsed JSON response body directly on a
 * non-2xx response. There is no status code attached to that thrown value,
 * only the body — see isConsentRequiredError in `@/lib/consent-errors.ts`
 * for the same convention applied to a different endpoint family. These
 * readers work off the body's shape for exactly that reason.
 */

/** The shared over-limit rejection body (402), documented in the handoff doc. */
export interface OverLimitErrorBody {
  code: 'limit_exceeded';
  resource: string;
  current_usage: number;
  limit: number;
  detail: string;
}

/**
 * Reads a 402 over-limit rejection — e.g.
 * `{ code: "limit_exceeded", resource: "availability_windows",
 *    current_usage: 50, limit: 50, detail: "..." }` — into its typed shape.
 *
 * Returns `null` for anything else: an ordinary 400 validation error, a 500,
 * a network failure (an `Error` instance), or any object missing one of the
 * documented fields — so a caller can't accidentally treat a differently
 * shaped rejection as an over-limit one.
 */
export function readOverLimitError(error: unknown): OverLimitErrorBody | null {
  if (error === null || typeof error !== 'object') {
    return null;
  }
  const body = error as Record<string, unknown>;
  if (body.code !== 'limit_exceeded') {
    return null;
  }
  if (typeof body.resource !== 'string') {
    return null;
  }
  if (typeof body.current_usage !== 'number') {
    return null;
  }
  if (typeof body.limit !== 'number') {
    return null;
  }
  if (typeof body.detail !== 'string') {
    return null;
  }
  return {
    code: 'limit_exceeded',
    resource: body.resource,
    current_usage: body.current_usage,
    limit: body.limit,
    detail: body.detail,
  };
}

/**
 * Reads whether a thrown error body is the API's non-disclosure 404
 * (`{ "detail": "Not found." }`) — returned byte-identically for a missing,
 * other-organization, out-of-slot, or unauthorized row (handoff doc's
 * non-disclosure note). Matches the exact documented body shape, not a
 * substring, so an unrelated 400/500 whose message happens to mention "not
 * found" is never misread as this case.
 *
 * `useGroupScopedWindows`'s delete path does NOT use this — it calls the
 * generated operation with `throwOnError:false` instead, so it can read
 * `response.status` directly, which is more robust than body-shape matching
 * for that case. This predicate is for call sites that only have the thrown
 * body to go on, such as a create/update rejected because another actor
 * deleted the row it targeted meanwhile (spec's concurrent-deletion edge
 * case).
 */
export function isNotFoundError(error: unknown): boolean {
  if (error === null || typeof error !== 'object') {
    return false;
  }
  const body = error as Record<string, unknown>;
  return body.detail === 'Not found.';
}
