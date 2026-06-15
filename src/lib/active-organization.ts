/**
 * Module-level store for the active organization ID.
 *
 * This is a synchronous, subscribable store backed by localStorage.
 * It serves as the single source of truth for the active organization
 * across both the request interceptor (which reads it synchronously)
 * and React components (which read it via useSyncExternalStore).
 *
 * Organization IDs from the API are numbers, but are stored and returned
 * as strings for consistency with the localStorage string-only constraint.
 */

const STORAGE_KEY = 'activeOrganizationId';

// Module-level state: cached value and subscribers.
let currentValue: string | null = null;
let initialized = false;
const subscribers = new Set<() => void>();

/**
 * Lazily initialize the current value from localStorage (browser only).
 * Called on first access when in a browser environment.
 */
function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;

  if (typeof window === 'undefined') {
    // Server-side (SSR): never touch localStorage.
    currentValue = null;
    return;
  }

  // Browser: read from localStorage.
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    currentValue = stored;
  } catch {
    // localStorage might be unavailable (e.g. privacy mode in some browsers).
    currentValue = null;
  }
}

/**
 * Get the active organization ID synchronously.
 * Returns a string ID if set, or null if not set.
 */
export function getActiveOrganizationId(): string | null {
  ensureInitialized();
  return currentValue;
}

/**
 * Set the active organization ID and persist it to localStorage.
 * Pass null to clear the selection.
 */
export function setActiveOrganizationId(id: string | null): void {
  ensureInitialized();

  // If the value hasn't changed, don't notify subscribers.
  if (currentValue === id) return;

  currentValue = id;

  // Persist to localStorage (only in browser).
  if (typeof window !== 'undefined') {
    try {
      if (id === null) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, id);
      }
    } catch {
      // localStorage might be unavailable.
    }
  }

  // Notify all subscribers.
  subscribers.forEach((callback) => callback());
}

/**
 * Subscribe to changes in the active organization ID.
 * Returns an unsubscribe function.
 */
export function subscribeActiveOrganization(callback: () => void): () => void {
  ensureInitialized();
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

/**
 * Clear the active organization ID (convenience function).
 */
export function clearActiveOrganization(): void {
  setActiveOrganizationId(null);
}

/**
 * Export the localStorage key for tests or debugging.
 */
export const ACTIVE_ORGANIZATION_STORAGE_KEY = STORAGE_KEY;
