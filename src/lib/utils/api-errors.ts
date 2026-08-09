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

/** The billing write endpoints' 409 conflict body. */
export interface BillingConflictBody {
  detail: string;
}

/**
 * Reads a 409 conflict body the billing write endpoints return — e.g.
 * `{ "detail": "a plan change is already awaiting confirmation" }` or
 * `{ "detail": "provider not configured" }` (change-plan / add-on purchase).
 *
 * Returns the `{ detail }` shape on a well-formed body, or `null` for anything
 * else: a 402 over-limit body (which also carries `detail` but is keyed by
 * `code`), a DRF field-error 400, a 500/network `Error`, or a null/non-object
 * value — so a caller can only treat a genuine billing conflict as one. See
 * readOverLimitError's doc comment above for why these readers work off the
 * thrown body's shape rather than a status code.
 *
 * A body that is only `{ detail: "Not found." }` — the non-disclosure 404 —
 * has a valid `detail` string and so is NOT distinguished here; callers that
 * need to separate a 404 from a 409 should read the response status directly
 * (throwOnError:false), exactly as isNotFoundError's doc comment notes.
 */
export function readBillingConflict(
  error: unknown
): BillingConflictBody | null {
  if (error === null || typeof error !== 'object') {
    return null;
  }
  const body = error as Record<string, unknown>;
  // A 402 over-limit body also carries `detail` but is a different rejection —
  // exclude it so a caller branching on a 409 conflict never misreads one.
  if (body.code === 'limit_exceeded') {
    return null;
  }
  if (typeof body.detail !== 'string') {
    return null;
  }
  return { detail: body.detail };
}

/**
 * Reads whether a thrown error body is change-plan's `400
 * PaymentTokenRequiredError` — the rejection a caller gets when the billing root
 * is attaching a payment instrument for the first time (its
 * `Subscription.external_id` is still blank) but omitted `payment_token` (see
 * the `ChangePlanRequest` schema note + `SubscriptionService._initiate_upgrade`).
 * The change-plan flow branches on this to REVEAL the card field and retry with
 * the SAME idempotency key — never minting a second key, so the retry can't
 * double-charge.
 *
 * The API does not document the 400 body shape in `schema.yml`, so this reader
 * matches defensively on either a `code` discriminator (the repo's handoff
 * convention, cf. `limit_exceeded`) or a `detail`/`message` string mentioning a
 * required payment token/method. It is deliberately checked BEFORE
 * `readBillingConflict` (which matches any `{ detail }`) so a token-required 400
 * is never misread as a 409 conflict. It excludes the `limit_exceeded` 402 body
 * so an over-limit rejection is never misread as token-required.
 */
export function isPaymentTokenRequiredError(error: unknown): boolean {
  if (error === null || typeof error !== 'object' || error instanceof Error) {
    // A network/JS `Error` carries a `.message` that could coincidentally
    // mention a payment token — it is never the API's typed 400 body.
    return false;
  }
  const body = error as Record<string, unknown>;
  if (body.code === 'limit_exceeded') {
    return false;
  }
  if (
    body.code === 'payment_token_required' ||
    body.code === 'payment_token_required_error'
  ) {
    return true;
  }
  const message =
    typeof body.detail === 'string'
      ? body.detail
      : typeof body.message === 'string'
        ? body.message
        : null;
  if (message === null) {
    return false;
  }
  const normalized = message.toLowerCase();
  const mentionsPaymentInstrument =
    normalized.includes('payment token') ||
    normalized.includes('payment method') ||
    normalized.includes('payment_token');
  if (!mentionsPaymentInstrument) {
    return false;
  }
  // Only classify as token-required when the message ASSERTS the token is
  // required/missing — merely mentioning a "payment method" is too broad (a 409
  // like "payment method change already processing" mentions one but is a
  // conflict, not a first-time-attach 400).
  return (
    normalized.includes('required') ||
    normalized.includes('missing') ||
    normalized.includes('must be') ||
    normalized.includes('provide') ||
    normalized.includes('supply') ||
    normalized.includes('supplied') ||
    normalized.includes('needed')
  );
}

/**
 * Reads whether a thrown error body is the add-on purchase endpoint's `400
 * AddOnNotPurchasableError` — the rejection a caller gets when the chosen
 * `resource_key` cannot be bought as an add-on (the resource is not a pre-paid,
 * purchasable capacity). The purchase flow branches on this to show a clear
 * "this resource can't be purchased" message instead of the generic failure.
 *
 * The API does not document this 400 body shape in `schema.yml` (only the `409`
 * provider-unconfigured error is listed), so this reader matches DEFENSIVELY on
 * either a `code` discriminator (the repo's handoff convention, cf.
 * `limit_exceeded`) or a `detail`/`message` string asserting the resource isn't
 * purchasable as an add-on. It is deliberately checked BEFORE
 * `readBillingConflict` (which matches any `{ detail }`) so a not-purchasable
 * 400 is never misread as a 409 conflict. It excludes the `limit_exceeded` 402
 * body so an over-limit rejection is never misread as not-purchasable.
 */
export function isAddOnNotPurchasableError(error: unknown): boolean {
  if (error === null || typeof error !== 'object' || error instanceof Error) {
    // A network/JS `Error` carries a `.message` that could coincidentally
    // mention "add-on" — it is never the API's typed 400 body.
    return false;
  }
  const body = error as Record<string, unknown>;
  if (body.code === 'limit_exceeded') {
    return false;
  }
  if (
    body.code === 'add_on_not_purchasable' ||
    body.code === 'add_on_not_purchasable_error'
  ) {
    return true;
  }
  const message =
    typeof body.detail === 'string'
      ? body.detail
      : typeof body.message === 'string'
        ? body.message
        : null;
  if (message === null) {
    return false;
  }
  const normalized = message.toLowerCase();
  const mentionsAddOn =
    normalized.includes('add-on') ||
    normalized.includes('add on') ||
    normalized.includes('add_on') ||
    normalized.includes('addon');
  if (!mentionsAddOn) {
    return false;
  }
  // Only classify as not-purchasable when the message ASSERTS the resource
  // cannot be bought — merely mentioning "add-on" is too broad (a 409 like
  // "an add-on purchase is already processing" mentions one but is a conflict).
  return (
    normalized.includes('not purchasable') ||
    normalized.includes("can't be purchased") ||
    normalized.includes('cannot be purchased') ||
    normalized.includes('cannot purchase') ||
    normalized.includes('not available for purchase') ||
    normalized.includes('not a purchasable')
  );
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

/**
 * Reads a DRF-style non-field-errors rejection (400) — e.g.
 * `{ "non_field_errors": ["<constraint violation message>"] }` — into the
 * first message string, or `null` for anything else (a differently shaped
 * 400, a 500, a network failure). Used by the quota-rule form to surface the
 * one-rule-per-(calendar, slot, period) constraint the API enforces
 * (handoff doc section 3) as a form-level message instead of an unhandled
 * failure or a bare toast — see readOverLimitError's doc comment above for
 * why these readers work off the thrown body's shape rather than a status
 * code.
 */
export function readNonFieldError(error: unknown): string | null {
  if (error === null || typeof error !== 'object') {
    return null;
  }
  const body = error as Record<string, unknown>;
  const messages = body.non_field_errors;
  if (!Array.isArray(messages) || messages.length === 0) {
    return null;
  }
  const first = messages[0];
  return typeof first === 'string' ? first : null;
}
