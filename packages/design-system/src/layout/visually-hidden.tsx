import * as React from 'react';

import { cn } from '../lib/utils';

export interface VisuallyHiddenProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
}

/**
 * VisuallyHidden — content available to screen readers but not shown visually
 * (the `sr-only` idiom). Used for the accessible name of an icon-only control,
 * or a required-but-hidden dialog title.
 *
 * This is one of the few things that genuinely cannot be an inline style: it
 * relies on a clip-path/position recipe, so it stays a class.
 */
const VisuallyHidden = React.forwardRef<HTMLElement, VisuallyHiddenProps>(
  function VisuallyHidden({ as: Comp = 'span', className, ...props }, ref) {
    return <Comp ref={ref} className={cn('sr-only', className)} {...props} />;
  }
);

export { VisuallyHidden };
