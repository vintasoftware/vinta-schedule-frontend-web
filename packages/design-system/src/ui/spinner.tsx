import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { Icon, type IconProps } from './icon';

export interface SpinnerProps extends Omit<IconProps, 'icon' | 'spin'> {
  /**
   * Accessible name announced while busy. Defaults to `Loading`; pass an empty
   * string for a purely decorative spinner (e.g. inside a button that already
   * says "Saving…").
   */
  label?: string;
}

/**
 * Spinner — the spinning loader used by every pending state. Replaces the
 * repeated `<Loader2 className='animate-spin' />`; sizing/color come straight
 * from Icon, so there is exactly one size scale.
 *
 * Exposed as `role="status"` (a live region) with an accessible name, so the
 * pending state is announced instead of being a silent decorative glyph.
 */
const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(function Spinner(
  { label = 'Loading', ...props },
  ref
) {
  return (
    <Icon
      ref={ref}
      icon={Loader2}
      spin
      label={label}
      // A named spinner is a status live region, not an image; an unnamed one
      // stays decorative (Icon's aria-hidden) and gets no role at all.
      {...(label ? { role: 'status' } : {})}
      {...props}
    />
  );
});

export { Spinner };
