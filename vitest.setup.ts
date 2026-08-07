import '@testing-library/jest-dom/vitest';
import * as React from 'react';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// `input-otp` schedules selection-sync timeouts at 0/10/50ms with no effect
// cleanup. After the last test in a file, Vitest tears down jsdom while those
// timers can still fire → `ReferenceError: window is not defined` and a failed
// run even though every assertion passed. App page tests only need a typed
// value; replace the DS wrapper (and thus the library) with a plain input.
vi.mock('vinta-schedule-design-system/ui/input-otp', () => {
  type InputOTPMockProps = {
    value?: string;
    onChange?: (value: string) => void;
    maxLength?: number;
    children?: React.ReactNode;
    containerClassName?: string;
    className?: string;
  } & React.InputHTMLAttributes<HTMLInputElement>;

  const InputOTP = React.forwardRef<HTMLInputElement, InputOTPMockProps>(
    function InputOTPMock(props, ref) {
      // Drop DS/library-only props so they never land on the DOM input.
      const {
        value = '',
        onChange,
        maxLength,
        children,
        containerClassName,
        className,
        ...rest
      } = props;
      void children;
      void containerClassName;
      void className;
      return React.createElement('input', {
        ...rest,
        ref,
        type: 'text',
        inputMode: 'numeric',
        value,
        maxLength,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChange?.(event.target.value),
      });
    }
  );
  InputOTP.displayName = 'InputOTP';

  function Passthrough({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }

  return {
    InputOTP,
    InputOTPGroup: Passthrough,
    InputOTPSlot: () => null,
    InputOTPSeparator: () => null,
  };
});

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

// Polyfill document.elementFromPoint for tests — jsdom doesn't implement it.
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
