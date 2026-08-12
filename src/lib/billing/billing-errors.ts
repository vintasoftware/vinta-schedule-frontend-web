/**
 * Billing error-contract parsing layer.
 *
 * Discriminates three billing error shapes:
 * - `LimitExceededError` — over-capacity with a remedy
 * - `CodedBillingError` — a specific coded error with a detail message
 * - `FieldValidationError` — field-keyed validation errors (no code)
 *
 * A single parsing layer that branches on `code`, never `detail`.
 */

import type { ResourceKeyEnum } from '@/client';

export type { ResourceKeyEnum } from '@/client';

/**
 * Remedy actions available when an operation hits a limit or fails payment.
 */
export type Remedy =
  | 'purchase_add_on'
  | 'upgrade_plan'
  | 'add_payment_method'
  | 'resolve_billing';

/**
 * Limit-exceeded error: `{ code: 'limit_exceeded', resource, current_usage, limit, remedy }`.
 */
export interface LimitExceededError {
  code: 'limit_exceeded';
  resource: ResourceKeyEnum;
  current_usage: number;
  limit: number | null;
  remedy: Remedy;
}

/**
 * Coded billing error: `{ code, detail }` for known billing error codes.
 */
export interface CodedBillingError {
  code:
    | 'payment_token_required'
    | 'unconfirmed_plan_change'
    | 'payment_provider_not_configured'
    | 'add_on_not_purchasable'
    | 'retry_payment_not_applicable'
    | 'subscription_not_attached'
    | 'no_outstanding_balance'
    | 'collection_not_supported'
    | 'charge_declined';
  detail: string;
}

/**
 * Field validation error: field-keyed, no `code`.
 * Mirrors DRF `{ field_name: ["error message"] }` structure.
 */
export interface FieldValidationError {
  type: 'field_validation';
  fields: Record<string, string[]>;
}

/**
 * Generic unrecognized billing error: fallback when structure doesn't match known shapes.
 */
export interface UnrecognizedBillingError {
  type: 'unrecognized';
  original: unknown;
}

/**
 * Discriminated union of all billing error shapes.
 */
export type BillingError =
  | LimitExceededError
  | CodedBillingError
  | FieldValidationError
  | UnrecognizedBillingError;

/**
 * Parse a billing error response into a discriminated union.
 *
 * Receives an already-parsed error body (JSON object) from a failed response
 * and returns the correct discriminated variant. Defensive against null,
 * undefined, non-objects, and missing/invalid fields.
 *
 * Returns an "unrecognized" variant for non-billing errors and unknowns.
 */
export function parseBillingError(response: unknown): BillingError {
  // Null/undefined or primitive → unrecognized
  if (response === null || response === undefined) {
    return {
      type: 'unrecognized',
      original: response,
    };
  }

  if (typeof response !== 'object') {
    return {
      type: 'unrecognized',
      original: response,
    };
  }

  const err = response as Record<string, unknown>;

  // Check for limit_exceeded shape: { code, resource, current_usage, limit, remedy }
  if (
    err.code === 'limit_exceeded' &&
    typeof err.resource === 'string' &&
    typeof err.current_usage === 'number' &&
    (typeof err.limit === 'number' || err.limit === null) &&
    isKnownRemedy(err.remedy)
  ) {
    return {
      code: 'limit_exceeded',
      resource: err.resource as ResourceKeyEnum,
      current_usage: err.current_usage,
      limit: err.limit as number | null,
      remedy: err.remedy,
    };
  }

  // Check for coded billing error: { code, detail }
  if (isKnownBillingErrorCode(err.code) && typeof err.detail === 'string') {
    return {
      code: err.code,
      detail: err.detail,
    };
  }

  // Check for field validation error: field-keyed shape with no `code`
  // Field validation errors are typically DRF format: { field_name: ["error message"] }
  if (!('code' in err) && isFieldValidationShape(err)) {
    return {
      type: 'field_validation',
      fields: extractFieldErrors(err),
    };
  }

  // Unrecognized shape
  return {
    type: 'unrecognized',
    original: response,
  };
}

/**
 * Check if a code is one of the known billing error codes.
 */
function isKnownBillingErrorCode(
  code: unknown
): code is CodedBillingError['code'] {
  const knownCodes: readonly CodedBillingError['code'][] = [
    'payment_token_required',
    'unconfirmed_plan_change',
    'payment_provider_not_configured',
    'add_on_not_purchasable',
    'retry_payment_not_applicable',
    'subscription_not_attached',
    'no_outstanding_balance',
    'collection_not_supported',
    'charge_declined',
  ];
  return (
    typeof code === 'string' && (knownCodes as readonly string[]).includes(code)
  );
}

/**
 * Check if a value is one of the known remedy values.
 */
function isKnownRemedy(value: unknown): value is Remedy {
  const knownRemedies: readonly Remedy[] = [
    'purchase_add_on',
    'upgrade_plan',
    'add_payment_method',
    'resolve_billing',
  ];
  return (
    typeof value === 'string' &&
    (knownRemedies as readonly string[]).includes(value)
  );
}

/**
 * Check if the error object looks like a field validation error.
 * A field validation error has no `code` and contains field names as keys
 * with string-array values.
 */
function isFieldValidationShape(err: Record<string, unknown>): boolean {
  if ('code' in err) {
    return false;
  }

  // At least one field should have a string-array value
  let hasAtLeastOneField = false;
  for (const [, value] of Object.entries(err)) {
    if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
      hasAtLeastOneField = true;
      break;
    }
  }

  return hasAtLeastOneField;
}

/**
 * Extract field errors from a validation error object.
 * Filters to only keys with string-array values (DRF field error format).
 */
function extractFieldErrors(
  err: Record<string, unknown>
): Record<string, string[]> {
  const fields: Record<string, string[]> = {};

  for (const [key, value] of Object.entries(err)) {
    if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
      fields[key] = value;
    }
  }

  return fields;
}

/**
 * Type guard: check if an error is a limit-exceeded error.
 */
export function isLimitExceeded(
  error: BillingError
): error is LimitExceededError {
  return 'code' in error && error.code === 'limit_exceeded';
}

/**
 * Type guard: check if an error is a charge-declined error.
 */
export function isChargeDeclined(error: BillingError): boolean {
  // Only LimitExceededError and CodedBillingError have a code property
  // Check for explicit 'charge_declined' code (excluding 'limit_exceeded')
  if (
    'code' in error &&
    error.code !== 'limit_exceeded' &&
    error.code === 'charge_declined'
  ) {
    return true;
  }

  return false;
}

/**
 * Extract the remedy from a limit-exceeded error.
 * Undefined for non-limit-exceeded errors.
 */
export function remedyOf(error: BillingError): Remedy | undefined {
  return isLimitExceeded(error) ? error.remedy : undefined;
}

/**
 * Extract the detail message from a billing error for logging.
 * Returns the human-readable detail if available, undefined otherwise.
 * Used for logs/debugging only — never for display or string-matching.
 */
export function billingErrorMessage(error: BillingError): string | undefined {
  if ('detail' in error && typeof error.detail === 'string') {
    return error.detail;
  }
  return undefined;
}
