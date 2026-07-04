export const CONSENT_REQUIRED_CODE = 'consent_required';

export interface ConsentError {
  status?: number;
  errors?: Array<{
    code?: string;
    message?: string;
  }>;
}

/**
 * Safely detect a consent_required error from API responses.
 *
 * Matches a top-level `errors[]` array containing an item with
 * `code === 'consent_required'`. The generated hey-api clients throw
 * the parsed JSON response directly, so this detector inspects the
 * top-level structure: `{ status?, errors: [...] }`.
 *
 * Defensive against null/undefined, non-objects, missing/non-array
 * `errors`, and items without `code`.
 */
export function isConsentRequiredError(error: unknown): boolean {
  if (error === null || error === undefined) {
    return false;
  }

  if (typeof error !== 'object') {
    return false;
  }

  const err = error as ConsentError;

  // Handle both direct and wrapped error shapes
  const errors = err.errors;

  if (!Array.isArray(errors)) {
    return false;
  }

  return errors.some((item) => item?.code === CONSENT_REQUIRED_CODE);
}
