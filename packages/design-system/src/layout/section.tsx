import * as React from 'react';

import { Box, type BoxProps } from './box';
import type { Space } from './layout-style';

export interface SectionProps extends Omit<BoxProps, 'py'> {
  /** Vertical rhythm between page sections. Defaults to 16 (64px). */
  py?: Space;
}

/**
 * Section — a vertical page band with consistent top/bottom padding. Renders a
 * `<section>` by default; override with `as`.
 */
const Section = React.forwardRef<HTMLElement, SectionProps>(function Section(
  { as = 'section', py = 16, ...props },
  ref
) {
  return <Box ref={ref} as={as} py={py} {...props} />;
});

export { Section };
