import { permanentRedirect } from 'next/navigation';

/**
 * Legacy branded login URL. Branded auth now lives under one `/o/{slug}/`
 * prefix, so this redirects to `/o/{slug}/auth/login` and keeps every
 * previously-issued branded login link working.
 *
 * The query string is carried over — `?next=` decides where login lands.
 */
export default async function LegacyBrandedLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => query.append(key, entry));
    } else if (value !== undefined) {
      query.append(key, value);
    }
  }

  const queryString = query.toString();
  permanentRedirect(
    `/o/${encodeURIComponent(slug)}/auth/login${queryString ? `?${queryString}` : ''}`
  );
}
