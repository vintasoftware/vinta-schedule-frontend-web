import { client as apiClient } from '@/client/client.gen';
import { client as authClient } from '@/auth-client/client.gen';

/**
 * Point the generated API clients at the right base URL for the runtime.
 *
 * App API client: the backend resolved from the environment (the generated
 * `client.gen.ts` bakes in a localhost default, correct only for local dev).
 *
 * Auth client: in the BROWSER it points at the same-origin `/api/allauth`
 * BFF proxy — the allauth session token lives in an httpOnly cookie that only
 * the proxy can read, so browser JS must never call the backend auth API
 * directly. On the SERVER (route handlers, server components) it talks to
 * the backend directly; server code reads cookies itself when needed.
 *
 * `setConfig` merges, so other client config (interceptors, headers) is
 * preserved. The calls are idempotent.
 */
const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

if (baseUrl) {
  apiClient.setConfig({ baseUrl });
}

if (typeof window !== 'undefined') {
  authClient.setConfig({ baseUrl: '/api/allauth' });
} else if (baseUrl) {
  authClient.setConfig({ baseUrl });
}
