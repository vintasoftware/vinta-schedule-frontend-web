/**
 * Server-only policy document fetch logic.
 *
 * Mirrors the failure-safe pattern in `branding-server.ts`: a
 * `import 'server-only'` module that reads `NEXT_PUBLIC_API_BASE_URL` and
 * hits a public (unauthenticated) endpoint directly. Policy documents must be
 * readable before a session exists (mid-signup, pre-OAuth-completion), so no
 * auth token is attached.
 */
import 'server-only';

import type { DocumentTypeEnum, PolicyDocument } from '@/client';

/**
 * Fetch the latest published version of a single policy document type.
 *
 * `GET /policy-documents/latest/{document_type}/` is public (`AllowAny`) and
 * 404s when the type is unknown or has no published rows yet. On ANY
 * failure — 404, other non-2xx, network error, timeout, parse failure — we
 * return `null` so the caller can render a graceful placeholder instead of
 * an error. Never throws.
 */
export async function fetchLatestPolicyDocument(
  type: DocumentTypeEnum
): Promise<PolicyDocument | null> {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

  const endpoint = `${baseUrl}/policy-documents/latest/${type}/`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      // Don't block the page render for too long on a policy fetch.
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      return null;
    }

    const document = (await response.json()) as PolicyDocument | null;

    if (!document) {
      return null;
    }

    return document;
  } catch {
    // Network error, abort, parse failure — return the safe default.
    return null;
  }
}
