import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

import { cookies } from 'next/headers';

type CookieUpdate = { value: string; options: Partial<ResponseCookie> };

export class CookieManager {
  private updates: Map<string, CookieUpdate> = new Map();

  set(name: string, value: string, options: Partial<ResponseCookie> = {}) {
    // Always set Secure and SameSite=Lax for security
    const opts: Partial<ResponseCookie> = {
      ...options,
      secure: true,
      sameSite: 'lax',
    };
    this.updates.set(name, { value, options: opts });
  }

  async get(name: string): Promise<string | undefined> {
    const update = this.updates.get(name);
    return update?.value || (await cookies()).get(name)?.value;
  }

  async apply() {
    const cookieStorage = await cookies();

    // Each assignment to document.cookie adds or updates a single cookie, it does not overwrite others.
    // This loop is safe and will not remove or overwrite unrelated cookies.
    for (const [name, { value, options }] of this.updates.entries()) {
      cookieStorage.set(name, value, {
        ...options,
      });
    }
  }
}

// Per-request singleton (simple global for most SSR use cases)
let globalCookieManager: CookieManager | undefined;
export function getCookieManager() {
  if (!globalCookieManager) {
    globalCookieManager = new CookieManager();
  }
  return globalCookieManager;
}
