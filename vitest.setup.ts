import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Polyfill ResizeObserver for tests
if (!global.ResizeObserver) {
  global.ResizeObserver = class ResizeObserver {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    observe() {}
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    unobserve() {}
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    disconnect() {}
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

// Polyfill document.elementFromPoint for tests — jsdom doesn't implement it,
// and input-otp polls it on a timer.
if (!document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

// Polyfill Element.scrollIntoView for tests — jsdom doesn't implement it, and
// cmdk (the combobox/command list) calls it to reveal the active item.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    // no-op: layout/scrolling isn't simulated in jsdom
  };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  // Reset cookies between tests.
  document.cookie.split('; ').forEach((c) => {
    const name = c.split('=')[0];
    if (name) {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
  });
});
