import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getActiveOrganizationId,
  setActiveOrganizationId,
  subscribeActiveOrganization,
  clearActiveOrganization,
  ACTIVE_ORGANIZATION_STORAGE_KEY,
} from './active-organization';

describe('active-organization store', () => {
  beforeEach(() => {
    // Clear localStorage between tests.
    localStorage.clear();
    // Reset in-memory state.
    clearActiveOrganization();
  });

  afterEach(() => {
    localStorage.clear();
    clearActiveOrganization();
  });

  describe('getActiveOrganizationId', () => {
    it('returns null when nothing is stored', () => {
      const id = getActiveOrganizationId();
      expect(id).toBeNull();
    });

    it('returns the value after it has been set', () => {
      setActiveOrganizationId('123');
      expect(getActiveOrganizationId()).toBe('123');
    });
  });

  describe('setActiveOrganizationId', () => {
    it('persists an organization ID to localStorage', () => {
      setActiveOrganizationId('456');
      const stored = localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY);
      expect(stored).toBe('456');
    });

    it('updates the in-memory value', () => {
      setActiveOrganizationId('789');
      expect(getActiveOrganizationId()).toBe('789');
    });

    it('removes the key from localStorage when set to null', () => {
      setActiveOrganizationId('abc');
      expect(localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY)).toBe('abc');

      setActiveOrganizationId(null);
      expect(localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY)).toBeNull();
    });

    it('clears the in-memory value when set to null', () => {
      setActiveOrganizationId('def');
      setActiveOrganizationId(null);
      expect(getActiveOrganizationId()).toBeNull();
    });
  });

  describe('subscribeActiveOrganization', () => {
    it('calls the callback when the value changes', () => {
      let callCount = 0;
      const callback = () => {
        callCount++;
      };
      subscribeActiveOrganization(callback);

      setActiveOrganizationId('111');
      expect(callCount).toBe(1);

      setActiveOrganizationId('222');
      expect(callCount).toBe(2);
    });

    it('returns an unsubscribe function that stops firing callbacks', () => {
      let callCount = 0;
      const callback = () => {
        callCount++;
      };
      const unsubscribe = subscribeActiveOrganization(callback);

      setActiveOrganizationId('111');
      expect(callCount).toBe(1);

      unsubscribe();
      setActiveOrganizationId('222');
      expect(callCount).toBe(1); // Not called again.
    });

    it('does not call the callback if the value does not change', () => {
      let callCount = 0;
      const callback = () => {
        callCount++;
      };
      subscribeActiveOrganization(callback);

      setActiveOrganizationId('333');
      expect(callCount).toBe(1);

      setActiveOrganizationId('333'); // Same value.
      expect(callCount).toBe(1); // Not called again.
    });

    it('allows multiple subscribers to be registered', () => {
      let count1 = 0;
      let count2 = 0;
      const callback1 = () => {
        count1++;
      };
      const callback2 = () => {
        count2++;
      };
      subscribeActiveOrganization(callback1);
      subscribeActiveOrganization(callback2);

      setActiveOrganizationId('444');
      expect(count1).toBe(1);
      expect(count2).toBe(1);
    });
  });

  describe('clearActiveOrganization', () => {
    it('clears the active organization ID', () => {
      setActiveOrganizationId('555');
      expect(getActiveOrganizationId()).toBe('555');

      clearActiveOrganization();
      expect(getActiveOrganizationId()).toBeNull();
      expect(localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY)).toBeNull();
    });

    it('notifies subscribers when clearing', () => {
      let callCount = 0;
      const callback = () => {
        callCount++;
      };
      setActiveOrganizationId('666');
      subscribeActiveOrganization(callback);

      clearActiveOrganization();
      expect(callCount).toBe(1);
    });
  });

  describe('SSR safety', () => {
    it('returns null and does not touch localStorage when window is undefined', async () => {
      // Simulate a real SSR environment: hide the window global so the
      // `typeof window === 'undefined'` branch in active-organization.ts
      // is actually executed.
      vi.stubGlobal('window', undefined);

      try {
        // Reset modules so the module-level `initialized` flag is cleared
        // and ensureInitialized() runs fresh under the SSR condition.
        vi.resetModules();

        const {
          getActiveOrganizationId: ssrGet,
          setActiveOrganizationId: ssrSet,
        } = await import('./active-organization');

        // In SSR, getActiveOrganizationId must return null (no localStorage).
        expect(ssrGet()).toBeNull();

        // Setting a value must not throw even without localStorage.
        expect(() => ssrSet('777')).not.toThrow();

        // The value is held in memory on the server (currentValue is updated),
        // but localStorage must not be touched (window is undefined).
        // Verify localStorage was never written — jsdom's localStorage would
        // throw if accessed without a window, but since the production code
        // guards on typeof window, no write should have been attempted.
        // After restoring window we can confirm the key was never persisted.
      } finally {
        vi.unstubAllGlobals();
        // Reset again so subsequent tests get a clean browser-mode module.
        vi.resetModules();
      }

      // After restoring window, the real localStorage should be empty —
      // confirming the SSR code path never wrote to it.
      expect(localStorage.getItem('activeOrganizationId')).toBeNull();
    });
  });
});
