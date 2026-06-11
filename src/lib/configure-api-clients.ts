import { client as apiClient } from '@/client/client.gen';
import { client as authClient } from '@/auth-client/client.gen';

/**
 * Point the generated API clients at the backend resolved from the
 * environment instead of the codegen-time default (`http://localhost:8000`).
 *
 * The generated `client.gen.ts` files bake in a localhost baseUrl, which is
 * correct for local dev but wrong for any deployed environment. Importing this
 * module for its side effect (server entry, browser entry, and standalone API
 * routes) overrides that baseUrl at runtime. `setConfig` merges, so all other
 * client config (interceptors, headers) is preserved. The call is idempotent.
 *
 * `NEXT_PUBLIC_API_BASE_URL` is inlined at build time and available in both the
 * server and browser bundles. When unset (e.g. local dev) the clients keep
 * their localhost default.
 */
const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

if (baseUrl) {
  apiClient.setConfig({ baseUrl });
  authClient.setConfig({ baseUrl });
}
