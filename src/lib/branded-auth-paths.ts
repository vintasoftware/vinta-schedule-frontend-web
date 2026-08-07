/**
 * Branded authentication routes live under a single `/o/{slug}/` prefix:
 *
 *   /o/{slug}/auth/login
 *   /o/{slug}/auth/signup
 *   /o/{slug}/auth/accept-invite
 *
 * `/auth/login/{slug}` predates this and now redirects into the prefix.
 *
 * Links rendered on a branded page must stay inside it — sending a visitor
 * from a branded signup to the generic `/auth/login` drops the tenant's logo
 * and colors mid-flow.
 */

/** The generic auth paths that have a branded counterpart. */
export type BrandableAuthPath =
  | '/auth/login'
  | '/auth/signup'
  | '/auth/accept-invite';

/**
 * Prefix an auth path with the tenant segment when a slug is in play.
 *
 * Without a slug the generic path is returned unchanged, so unbranded pages
 * keep today's URLs.
 */
export function brandedAuthPath(
  path: BrandableAuthPath,
  slug: string | undefined
): string {
  const trimmed = slug?.trim();
  if (!trimmed) {
    return path;
  }
  return `/o/${encodeURIComponent(trimmed)}${path}`;
}
