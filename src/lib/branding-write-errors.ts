export type BrandingWriteForbiddenReason =
  | 'has_parent'
  | 'not_entitled'
  | 'no_slug'
  | 'unknown';

/** Substrings from the backend handoff — order matches gate check priority. */
const HAS_PARENT_SUBSTRING = 'has a parent';
const NOT_ENTITLED_SUBSTRING = 'white-label branding';
const NO_SLUG_SUBSTRING = 'public slug';

/**
 * Classify a branding write 403 `detail` string.
 * Uses substring matching so minor copy tweaks on the server do not break the UI.
 */
export function parseBrandingWriteForbidden(
  detail: string
): BrandingWriteForbiddenReason {
  const normalized = detail.toLowerCase();

  if (normalized.includes(HAS_PARENT_SUBSTRING)) {
    return 'has_parent';
  }
  if (normalized.includes(NOT_ENTITLED_SUBSTRING)) {
    return 'not_entitled';
  }
  if (normalized.includes(NO_SLUG_SUBSTRING)) {
    return 'no_slug';
  }

  return 'unknown';
}

/** Extract DRF `{ detail: "…" }` (or plain string / Error) from hey-api throws. */
export function extractApiErrorDetail(err: unknown): string | null {
  if (typeof err === 'string') {
    return err;
  }

  if (err instanceof Error) {
    return err.message;
  }

  if (err !== null && typeof err === 'object' && 'detail' in err) {
    const detail = (err as { detail?: unknown }).detail;
    if (typeof detail === 'string') {
      return detail;
    }
  }

  return null;
}

export function classifyBrandingWriteForbiddenError(
  err: unknown
): BrandingWriteForbiddenReason | null {
  const detail = extractApiErrorDetail(err);
  if (!detail) {
    return null;
  }

  const reason = parseBrandingWriteForbidden(detail);
  return reason === 'unknown' ? null : reason;
}
