import * as React from 'react';

import { cn } from '@/lib/utils/index';
import { Box, type BoxProps } from './box';
import type { Size } from './layout-style';

/**
 * Container — horizontal layout frame. Centers content and applies the design
 * system's page margins (32px). `width` caps the content:
 *   contained → 1200px (DS --container-max)   prose → 68ch   full → edge-to-edge
 *
 * Accepts all Box style props (e.g. `py`, `bg`) on top of the width cap.
 */
export interface ContainerProps extends Omit<BoxProps, 'width' | 'maxWidth'> {
  width?: 'contained' | 'prose' | 'full';
}

const MAX_WIDTH: Record<NonNullable<ContainerProps['width']>, Size> = {
  contained: 1200,
  prose: '68ch',
  full: 'none',
};

const Container = React.forwardRef<HTMLElement, ContainerProps>(
  function Container({ className, width = 'contained', ...box }, ref) {
    return (
      <Box
        ref={ref}
        mx='auto'
        width='full'
        maxWidth={MAX_WIDTH[width]}
        className={cn('px-4 md:px-8', className)}
        {...box}
      />
    );
  }
);

export { Container };
