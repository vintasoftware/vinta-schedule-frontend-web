/**
 * Validate a client-supplied `next` redirect target (e.g. a login/signup
 * `?next=` query param) before navigating to it.
 *
 * Only a same-origin, path-relative destination is accepted: a single
 * leading `/` followed by anything except another `/` or `\` — browsers
 * treat both `//host/...` and `/\host/...` as scheme-relative URLs, which is
 * a classic open-redirect vector. Absolute URLs (`https://…`, `javascript:…`)
 * never start with a bare `/`, so the same check rejects them too.
 */
export function getSafeNextPath(
  next: string | null | undefined
): string | null {
  if (!next) return null;
  return /^\/(?!\/|\\)/.test(next) ? next : null;
}
