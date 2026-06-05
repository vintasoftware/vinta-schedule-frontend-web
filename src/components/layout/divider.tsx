import * as React from 'react';
import type { CSSProperties } from 'react';

import { cn } from '@/lib/utils/index';
import { color, resolveSpace, type ColorToken, type Space } from './layout-style';

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  /** Line color token. Defaults to `border`. */
  tone?: ColorToken;
  /** Margin on the cross axis (space around the line). */
  spacing?: Space;
}

/**
 * Divider — a hairline rule between content. Horizontal by default; set
 * `orientation="vertical"` inside an HStack.
 */
const Divider = React.forwardRef<HTMLDivElement, DividerProps>(function Divider(
  { className, style, orientation = 'horizontal', tone = 'border', spacing, ...props },
  ref
) {
  const vertical = orientation === 'vertical';
  const gap = spacing != null ? resolveSpace(spacing) : undefined;
  const s: CSSProperties = vertical
    ? {
        width: '1px',
        alignSelf: 'stretch',
        backgroundColor: color(tone),
        marginLeft: gap,
        marginRight: gap,
      }
    : {
        height: '1px',
        width: '100%',
        backgroundColor: color(tone),
        marginTop: gap,
        marginBottom: gap,
      };
  return (
    <div
      ref={ref}
      role='separator'
      aria-orientation={orientation}
      className={cn(className)}
      style={{ ...s, ...style }}
      {...props}
    />
  );
});

export { Divider };
