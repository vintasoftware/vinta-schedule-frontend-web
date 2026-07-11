import * as React from 'react';

import { Text, type TextProps, type TextSize, type TextWeight } from './text';

type Level = 1 | 2 | 3 | 4 | 5 | 6;

const DEFAULT_SIZE: Record<Level, TextSize> = {
  1: '5xl',
  2: '4xl',
  3: '2xl',
  4: 'xl',
  5: 'lg',
  6: 'base',
};

const DEFAULT_WEIGHT: Record<Level, TextWeight> = {
  1: 'bold',
  2: 'semibold',
  3: 'semibold',
  4: 'semibold',
  5: 'semibold',
  6: 'semibold',
};

export interface HeadingProps extends TextProps {
  /** Heading level 1–6. Sets the tag and default size/weight. */
  level?: Level;
}

/**
 * Heading — semantic heading with design-system defaults per level. Override
 * any token via props.
 *
 *   <Heading level={2}>Section title</Heading>
 */
const Heading = React.forwardRef<HTMLElement, HeadingProps>(function Heading(
  { level = 2, size, weight, tracking = 'tight', leading = 'tight', ...props },
  ref
) {
  return (
    <Text
      ref={ref}
      as={`h${level}`}
      size={size ?? DEFAULT_SIZE[level]}
      weight={weight ?? DEFAULT_WEIGHT[level]}
      tracking={tracking}
      leading={leading}
      {...props}
    />
  );
});

export { Heading };
