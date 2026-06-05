import * as React from 'react';

import { cn } from '@/lib/utils/index';
import { color, type ColorToken } from './layout-style';

export type TextSize =
  | 'xs' | 'sm' | 'base' | 'lg' | 'xl'
  | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
export type TextWeight =
  | 'light' | 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold';
export type TextFamily = 'sans' | 'mono' | 'display';
export type TextLeading = 'none' | 'tight' | 'snug' | 'normal' | 'relaxed';
export type TextTracking = 'tighter' | 'tight' | 'normal' | 'wide' | 'wider';
export type TextAlign = 'left' | 'center' | 'right' | 'justify';

// Literal class maps — Tailwind only emits classes it can see verbatim.
const SIZE: Record<TextSize, string> = {
  xs: 'text-xs', sm: 'text-sm', base: 'text-base', lg: 'text-lg', xl: 'text-xl',
  '2xl': 'text-2xl', '3xl': 'text-3xl', '4xl': 'text-4xl', '5xl': 'text-5xl',
  '6xl': 'text-6xl',
};
const WEIGHT: Record<TextWeight, string> = {
  light: 'font-light', normal: 'font-normal', medium: 'font-medium',
  semibold: 'font-semibold', bold: 'font-bold', extrabold: 'font-extrabold',
};
const FAMILY: Record<TextFamily, string> = {
  sans: 'font-sans', mono: 'font-mono', display: 'font-display',
};
const LEADING: Record<TextLeading, string> = {
  none: 'leading-none', tight: 'leading-tight', snug: 'leading-snug',
  normal: 'leading-normal', relaxed: 'leading-relaxed',
};
const TRACKING: Record<TextTracking, string> = {
  tighter: 'tracking-tighter', tight: 'tracking-tight', normal: 'tracking-normal',
  wide: 'tracking-wide', wider: 'tracking-wider',
};
const ALIGN: Record<TextAlign, string> = {
  left: 'text-left', center: 'text-center', right: 'text-right',
  justify: 'text-justify',
};

export interface TextProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  as?: React.ElementType;
  size?: TextSize;
  weight?: TextWeight;
  family?: TextFamily;
  leading?: TextLeading;
  tracking?: TextTracking;
  align?: TextAlign;
  color?: ColorToken;
  truncate?: boolean;
  italic?: boolean;
  uppercase?: boolean;
}

/**
 * Text — typography primitive. Drive size/weight/family/leading/tracking/color
 * through props instead of utility classes.
 *
 *   <Text size="sm" color="muted-foreground">Helper copy</Text>
 */
const Text = React.forwardRef<HTMLElement, TextProps>(function Text(
  {
    as: Comp = 'span',
    className,
    style,
    size,
    weight,
    family,
    leading,
    tracking,
    align,
    color: colorToken,
    truncate,
    italic,
    uppercase,
    ...props
  },
  ref
) {
  return (
    <Comp
      ref={ref}
      className={cn(
        size && SIZE[size],
        weight && WEIGHT[weight],
        family && FAMILY[family],
        leading && LEADING[leading],
        tracking && TRACKING[tracking],
        align && ALIGN[align],
        truncate && 'truncate',
        italic && 'italic',
        uppercase && 'uppercase',
        className
      )}
      style={{ color: color(colorToken), ...style }}
      {...props}
    />
  );
});

export { Text };
