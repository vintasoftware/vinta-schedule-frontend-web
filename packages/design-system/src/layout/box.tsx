import * as React from 'react';

import { cn } from '../lib/utils';
import {
  boxStyle,
  splitBoxProps,
  splitResponsiveBoxProps,
  type BoxStyleProps,
} from './layout-style';

export interface BoxProps
  extends BoxStyleProps, Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  /** Element/component to render. Defaults to `div`. */
  as?: React.ElementType;
}

/**
 * Box — the primitive every other layout component builds on. A styled element
 * driven entirely by token props (padding, margin, bg, radius, shadow, sizing…)
 * instead of utility classes.
 *
 * ```tsx
 * <Box p={4} bg="card" radius="lg" shadow="sm" border>…</Box>
 * ```
 */
const Box = React.forwardRef<HTMLElement, BoxProps>(function Box(
  { as: Comp = 'div', className, style, ...props },
  ref
) {
  // Responsive props become breakpoint classes and are removed from the props
  // that reach the inline-style path.
  const { classes, rest: plain } = splitResponsiveBoxProps(props);
  const { style: resolved, rest } = splitBoxProps(plain);
  return (
    <Comp
      ref={ref}
      className={cn(classes, className)}
      style={{ ...resolved, ...style }}
      {...rest}
    />
  );
});

export { Box, boxStyle };
