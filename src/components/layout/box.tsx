import * as React from 'react';

import { cn } from '@/lib/utils/index';
import { boxStyle, splitBoxProps, type BoxStyleProps } from './layout-style';

export interface BoxProps
  extends BoxStyleProps,
    Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  /** Element/component to render. Defaults to `div`. */
  as?: React.ElementType;
}

/**
 * Box — the primitive every other layout component builds on. A styled element
 * driven entirely by token props (padding, margin, bg, radius, shadow, sizing…)
 * instead of utility classes.
 *
 *   <Box p={4} bg="card" radius="lg" shadow="sm" border>…</Box>
 */
const Box = React.forwardRef<HTMLElement, BoxProps>(function Box(
  { as: Comp = 'div', className, style, ...props },
  ref
) {
  const { style: resolved, rest } = splitBoxProps(props);
  return (
    <Comp
      ref={ref}
      className={cn(className)}
      style={{ ...resolved, ...style }}
      {...rest}
    />
  );
});

export { Box, boxStyle };
