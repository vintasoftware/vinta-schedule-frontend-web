import * as React from 'react';

import { Flex, type FlexProps } from './flex';

/**
 * Center — centers its children on both axes. Pass `width`/`height`/`minHeight`
 * to size the centering area (e.g. `minHeight="screen"`).
 */
const Center = React.forwardRef<HTMLElement, Omit<FlexProps, 'align' | 'justify'>>(
  function Center({ inline, ...props }, ref) {
    return (
      <Flex
        ref={ref}
        align='center'
        justify='center'
        inline={inline}
        {...props}
      />
    );
  }
);

export { Center };
