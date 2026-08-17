/**
 * api-errors.ts — narrow readers for API error shapes shared across the
 * availability surfaces (windows, blocks, quota rules) and billing flows.
 *
 * The generated hey-api client's mutation factories use `throwOnError:true`
 * (this repo's default for mutations — see AGENTS.md's canonical hook
 * example), which throws the parsed JSON response body directly on a
 * non-2xx response. There is no status code attached to that thrown value,
 * only the body — see isConsentRequiredError in `@/lib/consent-errors.ts`
 * for the same convention applied to a different endpoint family. These
 * readers work off the body's shape for exactly that reason.
 *
 * Hardened billing error discrimination (Phase 1, billing-hardening plan):
 * Branch on stable `code` fields, never `detail`/`message` substrings. The
 * full recognized set of billing error codes is exactly these ten:
 * `limit_exceeded`, `charge_declined`, `payment_token_required`,
 * `unconfirmed_plan_change`, `payment_provider_not_configured`,
 * `add_on_not_purchasable`, `retry_payment_not_applicable`,
 * `subscription_not_attached`, `no_outstanding_balance`,
 * `collection_not_supported`.
 */

/** The stable set of hardened billing error codes. */
export type BillingErrorCode =
  | 'limit_exceeded'
  | 'charge_declined'
  | 'payment_token_required'
  | 'unconfirmed_plan_change'
  | 'payment_provider_not_configured'
  | 'add_on_not_purchasable'
  | 'retry_payment_not_applicable'
  | 'subscription_not_attached'
  | 'no_outstanding_balance'
  | 'collection_not_supported';

/**
 * Reads a billing error's stable `code` field, or null if the error is not
 * an object or lacks the `code` field. Billing errors discriminate solely on
 * the `code` field; this reader extracts it so callers can branch without
 * repeating the null-check and type-guard.
 */
export function readBillingErrorCode(error: unknown): BillingErrorCode | null {
  if (error === null || typeof error !== 'object') {
    return null;
  }
  const body = error as Record<string, unknown>;
  const code = body.code;
  // Narrow to the recognized set — unknown codes return null.
  if (
    code === 'limit_exceeded' ||
    code === 'charge_declined' ||
    code === 'payment_token_required' ||
    code === 'unconfirmed_plan_change' ||
    code === 'payment_provider_not_configured' ||
    code === 'add_on_not_purchasable' ||
    code === 'retry_payment_not_applicable' ||
    code === 'subscription_not_attached' ||
    code === 'no_outstanding_balance' ||
    code === 'collection_not_supported'
  ) {
    return code;
  }
  return null;
}

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
 * Maps an over-limit `resource` (from a 402 `OverLimitErrorBody`) to the billing
 * destination that lifts the limit: the plan picker, the general "upgrade to
 * raise your limits / buy more capacity" surface. The offending `resource` is
 * carried as a query param so the destination can highlight or pre-select it.
 *
 * Defined once here so every `readOverLimitError` consumer deep-links to the
 * same place instead of hard-coding a path: the calendar-groups `OverLimitAlert`
 * uses it today, and any future consumer reuses it. Kept alongside
 * `readOverLimitError` (rather than in a component) precisely so the reader and
 * the destination it maps to travel together.
 */
export function billingUpgradePath(resource?: string): string {
  const base = '/billing/plans';
  if (!resource) {
    return base;
  }
  return `${base}?resource=${encodeURIComponent(resource)}`;
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
 * Reads whether a thrown error body is the `payment_token_required` error —
 * the rejection a caller gets when attaching a payment instrument for the
 * first time but the `payment_token` was omitted. The flow branches on this
 * to reveal the card field and retry with the same idempotency key.
 *
 * Branches on the stable `code` field only — no substring fallback on
 * `detail`/`message` (the hardened contract guarantees the code).
 */
export function isPaymentTokenRequiredError(error: unknown): boolean {
  return readBillingErrorCode(error) === 'payment_token_required';
}

/**
 * Reads whether a thrown error body is the `add_on_not_purchasable` error —
 * the rejection a caller gets when the chosen resource cannot be bought as
 * an add-on. The flow branches on this to show a clear message.
 *
 * Branches on the stable `code` field only — no substring fallback on
 * `detail`/`message` (the hardened contract guarantees the code).
 */
export function isAddOnNotPurchasableError(error: unknown): boolean {
  return readBillingErrorCode(error) === 'add_on_not_purchasable';
}

/**
 * Reads whether a thrown error body is the `charge_declined` error — the
 * rejection when a payment provider declines the charge or refuses to attempt
 * it. Distinct from `limit_exceeded` (both use 402 status; `code` disambiguates).
 */
export function isChargeDeclinedError(error: unknown): boolean {
  return readBillingErrorCode(error) === 'charge_declined';
}

/**
 * Reads whether a thrown error body is the `unconfirmed_plan_change` error —
 * the rejection when a plan change is already awaiting confirmation.
 */
export function isUnconfirmedPlanChangeError(error: unknown): boolean {
  return readBillingErrorCode(error) === 'unconfirmed_plan_change';
}

/**
 * Reads whether a thrown error body is the `payment_provider_not_configured` error —
 * the rejection when the payment provider (e.g. Stripe) is not configured
 * in the deployment.
 */
export function isPaymentProviderNotConfiguredError(error: unknown): boolean {
  return readBillingErrorCode(error) === 'payment_provider_not_configured';
}

/**
 * Reads whether a thrown error body is the `retry_payment_not_applicable` error —
 * the rejection when retry-payment is not applicable (e.g. no outstanding
 * balance to retry).
 */
export function isRetryPaymentNotApplicableError(error: unknown): boolean {
  return readBillingErrorCode(error) === 'retry_payment_not_applicable';
}

/**
 * Reads whether a thrown error body is the `subscription_not_attached` error —
 * the rejection when a subscription has never attached a payment instrument
 * at the provider.
 */
export function isSubscriptionNotAttachedError(error: unknown): boolean {
  return readBillingErrorCode(error) === 'subscription_not_attached';
}

/**
 * Reads whether a thrown error body is the `no_outstanding_balance` error —
 * the rejection when there is no outstanding balance to retry.
 */
export function isNoOutstandingBalanceError(error: unknown): boolean {
  return readBillingErrorCode(error) === 'no_outstanding_balance';
}

/**
 * Reads whether a thrown error body is the `collection_not_supported` error —
 * the rejection when the resolved payment provider (e.g. MercadoPago) does not
 * support collection.
 */
export function isCollectionNotSupportedError(error: unknown): boolean {
  return readBillingErrorCode(error) === 'collection_not_supported';
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

/**
 * Reads a DRF field-validation 400 error body into a field-keyed map of
 * error messages. E.g. `{ "email": ["Invalid email address."],
 * "name": ["This field is required."] }` → `{ email: "Invalid email address.",
 * name: "This field is required." }` (one message per field).
 *
 * Also handles nested field errors (e.g. from nested serializers):
 * `{ "billing_address": { "street_name": ["This field is required."] } }`
 * → `{ "billing_address.street_name": "This field is required." }`.
 *
 * Returns `null` for anything else: a billing error (which carries a `code`),
 * a non-field-errors 400, a 500/network error, or a non-object value. Used
 * by the billing profile form to surface per-field validation errors from the
 * server directly on their form fields (Phase 4).
 */
export function readFieldValidationErrors(
  error: unknown
): Record<string, string> | null {
  if (error === null || typeof error !== 'object') {
    return null;
  }
  const body = error as Record<string, unknown>;

  // Exclude billing errors (which have a code field).
  if (body.code !== undefined) {
    return null;
  }

  // Exclude non-field-errors structure.
  if (body.non_field_errors !== undefined) {
    return null;
  }

  // Parse field-level errors: expect a Record<string, string[]> for top-level fields
  // and Record<string, Record<string, string[]>> for nested objects.
  // Flatten to Record<string, string> (first message per field).
  const result: Record<string, string> = {};
  let foundAnyField = false;

  for (const [key, value] of Object.entries(body)) {
    if (Array.isArray(value) && value.length > 0) {
      // Top-level field with array of messages
      const first = value[0];
      if (typeof first === 'string') {
        result[key] = first;
        foundAnyField = true;
      }
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      // Nested object case (e.g. from a nested serializer)
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        if (Array.isArray(nestedValue) && nestedValue.length > 0) {
          const first = nestedValue[0];
          if (typeof first === 'string') {
            result[`${key}.${nestedKey}`] = first;
            foundAnyField = true;
          }
        }
      }
    }
  }

  // Return the map only if we found at least one valid field error.
  return foundAnyField ? result : null;
}
