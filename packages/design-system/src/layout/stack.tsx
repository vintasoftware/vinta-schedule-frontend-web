import * as React from 'react';

import { Flex, type FlexProps } from './flex';

export type { FlexProps as StackOwnProps };

/**
 * Stack — vertical-by-default flex layout. Thin alias over <Flex>; gaps use the
 * 4px spacing scale (`gap={4}` → 16px). Switch to a row with `direction="row"`,
 * or use the dedicated <HStack> / <VStack>.
 */
const Stack = React.forwardRef<HTMLElement, FlexProps>(function Stack(
  { direction = 'column', gap = 4, ...props },
  ref
) {
  return <Flex ref={ref} direction={direction} gap={gap} {...props} />;
});

export { Stack };
